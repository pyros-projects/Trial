#!/usr/bin/env python3
"""Export an allowlisted public gallery without reading run metadata or evidence."""
from __future__ import annotations

import argparse
import csv
import ipaddress
import io
import json
import os
import re
import shutil
import sys
import tempfile
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlsplit

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE_ROOT))
from gallery import server
from gallery.demos import DEMO_PATH, DEMO_CSP, demo_file, validate_static_html

STATIC_FILES = ("index.html", "app.js", "appsettings.json", "styles.css", "favicon.svg", "logo-mark.svg", "deep-swe-snapshot.png")
CATALOG_FIELDS = ("id", "title", "category", "icon", "description", "look_for", "track", "artifact_type", "rubric")
# Existing settings without siteUrl keep using the established public origin.
DEFAULT_SITE_URL = "https://trial-by-pyro.netlify.app"
OWNER_MARKER = "public-static-export-v1\n"
REDIRECTS = "/api/data /api/data.json 200\n/api/catalog /prompts/catalog.json 200\n/sources/* /artifacts/:splat 200\n/demo-sources/* /demos/:splat 200\n"
ARTIFACT_SANDBOX = "sandbox allow-scripts allow-downloads allow-modals allow-pointer-lock"
HEADERS = f"""/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
/api/*
  Cache-Control: public, max-age=0, must-revalidate
/artifacts/*
  Content-Security-Policy: {ARTIFACT_SANDBOX}
  Cache-Control: public, max-age=0, must-revalidate, no-transform
/sources/*
  Content-Type: application/octet-stream
  Content-Disposition: attachment
  Content-Security-Policy: {ARTIFACT_SANDBOX}
  Cache-Control: public, max-age=0, must-revalidate, no-transform
/demos/*
  Content-Security-Policy: {DEMO_CSP}
  Cache-Control: public, max-age=0, must-revalidate, no-transform
/demo-sources/*
  Content-Type: application/octet-stream
  Content-Disposition: attachment
  Content-Security-Policy: {DEMO_CSP}
  Cache-Control: public, max-age=0, must-revalidate, no-transform
/api/export.csv
  Content-Disposition: attachment; filename="results.csv"
"""


def linked(path: Path) -> bool:
    """Windows junctions and symbolic links must not enter an export or cleanup."""
    return path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())


def regular_file(base: Path, relative: str) -> Path | None:
    path = server.safe_relative_file(base, relative)
    if path is None:
        return None
    current = base
    for part in Path(relative).parts:
        current = current / part
        if linked(current):
            return None
    return path


def directory(path: Path) -> bool:
    return server.real_directory(path) and not linked(path)


def public_catalog(root: Path) -> list[dict[str, str]]:
    catalog_path = regular_file(root, "prompts/catalog.json")
    if catalog_path is None:
        raise ValueError("prompts/catalog.json must be a regular file inside the package.")
    raw = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("The prompt catalog must be a JSON array.")
    catalog = []
    identifiers = set()
    for task in raw:
        if not isinstance(task, dict) or not isinstance(task.get("id"), str):
            raise ValueError("Every catalog entry requires an id.")
        task_id = task["id"]
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", task_id) or task_id in identifiers:
            raise ValueError(f"Invalid or duplicate task id: {task_id!r}")
        identifiers.add(task_id)
        item = {key: task[key] for key in CATALOG_FIELDS if isinstance(task.get(key), str)}
        item["prompt_file"] = f"{task_id}/prompt.md"
        catalog.append(item)
    return catalog


def share_settings(root: Path) -> tuple[str, dict[str, str]]:
    """Read public presentation settings, defaulting siteUrl to DEFAULT_SITE_URL."""
    path = regular_file(root, "gallery/static/appsettings.json")
    if path is None:
        raise ValueError("gallery/static/appsettings.json must be a regular file inside the package.")
    settings = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(settings, dict):
        raise ValueError("appsettings.json must contain a JSON object.")
    origin = settings.get("siteUrl", DEFAULT_SITE_URL)
    error = "appsettings.siteUrl must be an HTTP(S) origin without credentials, path, query, or fragment."
    if not isinstance(origin, str) or not origin or any(character.isspace() or ord(character) < 32 or character in "\\?#" for character in origin):
        raise ValueError(error)
    try:
        parsed = urlsplit(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username is not None or parsed.password is not None or parsed.path not in {"", "/"}:
            raise ValueError(error)
        hostname = parsed.hostname.encode("idna").decode("ascii")
        if ":" in hostname:
            hostname = f"[{ipaddress.IPv6Address(hostname)}]"
        elif not all(re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?", label) for label in hostname.split(".")):
            raise ValueError(error)
        port = f":{parsed.port}" if parsed.port is not None else ""
    except (ValueError, UnicodeError) as exc:
        raise ValueError(error) from exc
    labels = {}
    models = settings.get("models", [])
    if isinstance(models, list):
        for model in models:
            if isinstance(model, dict) and isinstance(model.get("key"), str) and isinstance(model.get("label"), str) and model["label"].strip():
                labels.setdefault(model["key"], model["label"])
    return f"{parsed.scheme}://{hostname}{port}", labels


def social_page(title: str, description: str, canonical: str, viewer: str, *,
                image: str | None, image_alt: str, link_text: str) -> str:
    """Keep initial crawler metadata and an escaped browser handoff in one page."""
    metadata = [
        ("name", "description", description),
        ("property", "og:type", "website"),
        ("property", "og:site_name", "Trial - a Vibe Benchmark"),
        ("property", "og:title", title),
        ("property", "og:description", description),
        ("property", "og:url", canonical),
        ("name", "twitter:card", "summary_large_image" if image else "summary"),
        ("name", "twitter:title", title),
        ("name", "twitter:description", description),
    ]
    if image:
        metadata.extend([
            ("property", "og:image", image), ("property", "og:image:alt", image_alt),
            ("name", "twitter:image", image), ("name", "twitter:image:alt", image_alt),
        ])
    tags = "\n".join(f'<meta {attribute}="{key}" content="{escape(value, quote=True)}">' for attribute, key, value in metadata)
    # JSON quotes the script string; escaping '<' also protects the script boundary.
    redirect = json.dumps(viewer, ensure_ascii=True).replace("<", "\\u003c")
    return f'''<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<link rel="canonical" href="{escape(canonical, quote=True)}">
{tags}
</head>
<body>
<h1>{escape(title)}</h1>
<p>{escape(description)}</p>
<p><a href="{escape(viewer, quote=True)}">{escape(link_text)}</a></p>
<script>location.replace({redirect});</script>
</body>
</html>
'''


def share_page(row: dict[str, Any], origin: str, model_label: str) -> str:
    """Render crawler metadata without duplicating the submitted artifact."""
    description = " ".join(part for part in (
        row["description"].strip(), f"Explore {model_label}'s interactive implementation on Trial."
    ) if part)
    viewer = "/#play/" + "/".join(quote(row[key], safe="") for key in ("model_key", "run_key"))
    screenshot = row["artifact"]["screenshot_url"]
    return social_page(
        f"{model_label}: {row['task_title']} | Trial", description, origin + row["share_url"], viewer,
        image=origin + screenshot if screenshot else None,
        image_alt=f"{model_label}: {row['task_title']} implementation screenshot",
        link_text="Open the interactive implementation",
    )


class PublicGalleryState(server.GalleryState):
    """Reuse gallery discovery rules and task inference, with no private file reads."""

    def __init__(self, root: Path, catalog: list[dict[str, str]]):
        self.root = root
        self.results_root = root / "results"
        self.artifact_origin = "/artifacts"
        self.catalog = catalog
        self.catalog_by_id = {task["id"]: task for task in catalog}

    def scan(self) -> list[dict[str, Any]]:
        rows = []
        if not directory(self.results_root):
            return rows
        for model in sorted(self.results_root.iterdir()):
            if not directory(model) or model.name.startswith("."):
                continue
            for run in sorted(model.iterdir()):
                if not directory(run) or run.name.startswith("."):
                    continue
                files = {path.name.lower(): path for path in run.iterdir() if path.is_file() and not linked(path)}
                task_id = self.infer_task_id({}, run.name)
                task = self.catalog_by_id.get(task_id, {})
                is_demo = task.get('track') == 'real-apps'
                html = demo_file(run) if is_demo else server.find_named(files, server.HTML_NAMES)
                if html is None:
                    continue
                validate_static_html(html.read_bytes())
                route = 'demos' if is_demo else 'artifacts'
                source_route = 'demo-sources' if is_demo else 'sources'
                encoded = "/".join(quote(part, safe="") for part in (model.name, run.name, html.name))
                # Explicit fields only. Metadata and evaluator output never enter these rows.
                rows.append({
                    "id": f"{model.name}/{run.name}", "model_key": model.name, "model": model.name,
                    "run_key": run.name, "run_id": run.name, "task_id": task_id,
                    "task_title": task.get("title", "Unassigned task"),
                    "category": task.get("category", "Uncategorized"), "icon": task.get("icon", "◇"),
                    "description": task.get("description", ""), "track": task.get("track", "html"),
                    "rubric": task.get("rubric"), "modified_at": server.utc_iso(html.stat().st_mtime),
                    "tags": [], "score": None, "reported_score": None, "report_binding": "none",
                    "checks": {"pass": 0, "fail": 0, "blocked": 0, "not-run": 0},
                    "artifact": {
                        "exists": True, "kind": "html", "filename": html.name,
                        "url": f"/{route}/{encoded}", "source_url": f"/{source_route}/{encoded}",
                        **({'demo': True} if is_demo else {}),
                        "screenshot_url": None, "bytes": html.stat().st_size, "file_count": 1,
                        "sha256": server.file_sha256(html), "checks": [],
                    },
                    "prompts": self.prompt_urls(task_id),
                })
        return sorted(rows, key=lambda row: (row["model"].lower(), row["run_id"].lower()))


def pillow_modules():
    try:
        from PIL import Image, ImageOps
        return Image, ImageOps
    except ImportError:
        return None


def thumbnail(source: Path, destination: Path, modules) -> None:
    image_module, image_ops = modules
    with image_module.open(source) as original:
        image = image_ops.exif_transpose(original)
        image.thumbnail((1280, 1280), image_module.Resampling.LANCZOS)
        # A fresh image carries no source EXIF, XMP, comments, or color profile.
        mode = "RGBA" if "A" in image.getbands() else "RGB"
        clean = image_module.new(mode, image.size)
        clean.paste(image.convert(mode))
        clean.save(destination, "WEBP", quality=78, method=4)


def collection_image(stage: Path, title: str, candidates: list[tuple[str, str, str | None]],
                     counts: str, modules, *, image_url: str, banner: str,
                     footer: str) -> tuple[str | None, str]:
    """Compose up to three distinct published thumbnails, or reuse an image URL."""
    candidates = [candidate for candidate in candidates if candidate[2]]
    if not candidates:
        return None, ""
    _, first_label, first_url = candidates[0]
    fallback = (first_url, f"{first_label}: {title} screenshot")
    if modules is None:
        return fallback
    from PIL import ImageDraw, ImageFont

    image_module, image_ops = modules
    panels = []
    seen = set()
    for key, label, screenshot_url in candidates:
        if key in seen:
            continue
        source = regular_file(stage, unquote(screenshot_url).lstrip("/"))
        if source is None:
            continue
        try:
            with image_module.open(source) as original:
                panels.append((label, original.convert("RGB")))
        except (OSError, ValueError):
            continue
        seen.add(key)
        if len(panels) == 3:
            break
    if not panels:
        return fallback

    def font(size: int):
        for name in ("DejaVuSans.ttf", "Arial.ttf"):
            try:
                return ImageFont.truetype(name, size)
            except OSError:
                pass
        return ImageFont.load_default(size=size)

    try:
        title_font, label_font, small_font = font(44), font(22), font(20)
    except (OSError, TypeError):
        # Older Pillow versions without a scalable bundled font still get an image.
        return fallback
    canvas = image_module.new("RGB", (1200, 630), "#151713")
    draw = ImageDraw.Draw(canvas)

    def fit(text: str, face, width: int) -> str:
        value = " ".join(text.split())[:400]
        if draw.textlength(value, font=face) <= width:
            return value
        while value and draw.textlength(value + "...", font=face) > width:
            value = value[:-1]
        return value.rstrip() + "..."

    draw.rectangle((48, 42, 79, 47), fill="#e48b69")
    draw.text((93, 29), banner, font=small_font, fill="#d6b5a2")
    draw.text((48, 89), fit(title, title_font, 1104), font=title_font, fill="#f4eee3")
    draw.text((48, 168), counts, font=label_font, fill="#b9bdaf")
    width = min(560, (1104 - 18 * (len(panels) - 1)) // len(panels))
    start = (1200 - width * len(panels) - 18 * (len(panels) - 1)) // 2
    for index, (label, screenshot) in enumerate(panels):
        left = start + index * (width + 18)
        draw.rounded_rectangle((left, 237, left + width, 557), radius=12, fill="#242720", outline="#3c4135")
        preview = image_ops.contain(screenshot, (width - 2, 234), image_module.Resampling.LANCZOS)
        canvas.paste(preview, (left + (width - preview.width) // 2, 246 + (234 - preview.height) // 2))
        draw.text((left + 16, 507), fit(label, label_font, width - 32), font=label_font, fill="#f4eee3")
    draw.text((48, 586), footer, font=small_font, fill="#a7ad9c")
    destination = stage / unquote(image_url).lstrip("/")
    destination.parent.mkdir(parents=True, exist_ok=True)
    # New RGB canvas: source metadata and submitted image bytes stay untouched.
    canvas.save(destination, "JPEG", quality=82, optimize=True, progressive=True)
    return image_url, f"{title}: {', '.join(label for label, _ in panels)}. {counts}."


def comparison_image(stage: Path, task: dict[str, str], rows: list[dict[str, Any]],
                     labels: dict[str, str], counts: str, modules) -> tuple[str | None, str]:
    candidates = [(row["model_key"], labels.get(row["model_key"], row["model"]),
                   row["artifact"]["screenshot_url"]) for row in rows]
    return collection_image(
        stage, task.get("title", task["id"]), candidates, counts, modules,
        image_url=f"/comparisons/{quote(task['id'], safe='')}.jpg",
        banner="TRIAL / COMPARE", footer="One prompt. Explore every implementation.",
    )


def comparison_pages(stage: Path, catalog: list[dict[str, str]], rows: list[dict[str, Any]],
                     origin: str, labels: dict[str, str], modules) -> dict[str, str]:
    order = {key: index for index, key in enumerate(labels)}
    urls = {}
    for task in catalog:
        builds = sorted((row for row in rows if row["task_id"] == task["id"]), key=lambda row: (
            order.get(row["model_key"], len(order)), row["model_key"].casefold(), row["run_key"].casefold()))
        if not builds:
            continue
        models = list(dict.fromkeys(row["model_key"] for row in builds))
        counts = f"{len(builds)} {'build' if len(builds) == 1 else 'builds'} from {len(models)} {'model' if len(models) == 1 else 'models'}"
        description = f"Compare {counts} for the same prompt. Models: {', '.join(labels.get(key, key) for key in models)}."
        encoded = quote(task["id"], safe="")
        urls[task["id"]] = f"/compare/{encoded}/"
        image_url, image_alt = comparison_image(stage, task, builds, labels, counts, modules)
        page = stage / "compare" / task["id"] / "index.html"
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text(social_page(
            f"{task.get('title', task['id'])} | Trial", description, origin + urls[task["id"]],
            f"/#compare/{encoded}", image=origin + image_url if image_url else None,
            image_alt=image_alt, link_text="Open the interactive comparison",
        ), encoding="utf-8")
    return urls


def model_pages(stage: Path, catalog: list[dict[str, str]], rows: list[dict[str, Any]],
                origin: str, labels: dict[str, str], modules) -> dict[str, str]:
    prompt_order = {task["id"]: index for index, task in enumerate(catalog)}
    model_order = {key: index for index, key in enumerate(labels)}
    collections: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        collections.setdefault(row["model_key"], []).append(row)
    urls = {}
    for model_key in sorted(collections, key=lambda key: (model_order.get(key, len(model_order)), key.casefold())):
        builds = sorted(collections[model_key], key=lambda row: (
            prompt_order.get(row["task_id"], len(prompt_order)), row["run_key"].casefold()))
        prompts = {row["task_id"] for row in builds if row["task_id"] in prompt_order}
        label = labels.get(model_key, model_key)
        counts = f"{len(builds)} {'build' if len(builds) == 1 else 'builds'} across {len(prompts)} {'prompt' if len(prompts) == 1 else 'prompts'}"
        description = f"Browse {counts} by {label} on Trial."
        unassigned = sum(row["task_id"] not in prompt_order for row in builds)
        if unassigned:
            description += f" {unassigned} {'build has' if unassigned == 1 else 'builds have'} no assigned catalog prompt."
        encoded = quote(model_key, safe="")
        urls[model_key] = f"/models/{encoded}/"
        candidates = [(
            "task:" + row["task_id"] if row["task_id"] in prompt_order else "run:" + row["run_key"],
            row["task_title"] if row["task_id"] in prompt_order else f"Unassigned: {row['run_id']}",
            row["artifact"]["screenshot_url"],
        ) for row in builds]
        image_url, image_alt = collection_image(
            stage, f"{label} builds", candidates, counts, modules,
            image_url=urls[model_key] + "preview.jpg", banner="TRIAL / MODEL",
            footer="One model. Explore every implementation.",
        )
        page = stage / "models" / model_key / "index.html"
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text(social_page(
            f"{label} builds | Trial - a Vibe Benchmark", description, origin + urls[model_key],
            f"/#model/{encoded}", image=origin + image_url if image_url else None,
            image_alt=image_alt, link_text="Open the interactive model collection",
        ), encoding="utf-8")
    return urls


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def export_csv(rows: list[dict[str, Any]]) -> bytes:
    stream = io.StringIO(newline="")
    fields = ("model", "run_id", "task_id", "task_title", "track", "artifact_sha256", "artifact_bytes")
    writer = csv.DictWriter(stream, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        values = {key: row.get(key) or "" for key in fields}
        values.update(artifact_sha256=row["artifact"]["sha256"], artifact_bytes=row["artifact"]["bytes"])
        writer.writerow({key: server.csv_cell(value) for key, value in values.items()})
    return stream.getvalue().encode("utf-8-sig")


def validate_output(root: Path, output: Path) -> Path:
    expected = root / "dist/site"
    if output.absolute() != expected or output.resolve() != expected:
        raise ValueError("The public export destination must be the package's dist/site directory.")
    for path in (root / "dist", output):
        if linked(path) or (path.exists() and not path.is_dir()):
            raise ValueError(f"Refusing an output path that is a link or non-directory: {path}")
    marker = root / "dist/.site-export-owned"
    if linked(marker):
        raise ValueError("The export ownership marker must not be a link.")
    if output.exists() and any(output.iterdir()):
        if not marker.is_file() or marker.read_text(encoding="utf-8") != OWNER_MARKER:
            raise ValueError("dist/site contains files not owned by this exporter; choose an empty directory by moving them first.")
        # Check the complete resolved cleanup target before recursive deletion.
        for parent, directories, files in os.walk(output, followlinks=False):
            for name in (*directories, *files):
                if linked(Path(parent) / name):
                    raise ValueError("Refusing to replace an export that contains links or junctions.")
    return marker


def build_site(root: Path = PACKAGE_ROOT, output: Path | None = None, *, screenshots: str = "auto") -> dict[str, Any]:
    if screenshots not in {"auto", "none"}:
        raise ValueError("screenshots must be 'auto' or 'none'.")
    root = root.expanduser().resolve(strict=True)
    output = output.expanduser() if output is not None else root / "dist/site"
    if not output.is_absolute():
        output = root / output
    marker = validate_output(root, output)
    catalog = public_catalog(root)
    site_origin, model_labels = share_settings(root)
    state = PublicGalleryState(root, catalog)
    rows = state.scan()
    modules = pillow_modules() if screenshots == "auto" else None
    report: dict[str, Any] = {"output": str(output), "html_files": len(rows), "screenshots": 0,
                              "unoptimized_screenshots": 0, "source_screenshot_bytes": 0,
                              "screenshot_bytes": 0, "comparison_images": 0,
                              "comparison_image_bytes": 0, "warnings": []}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".site-build-", dir=output.parent) as temporary:
        stage = Path(temporary) / "site"
        stage.mkdir()
        for name in STATIC_FILES:
            source = regular_file(root, f"gallery/static/{name}")
            if source is None:
                raise ValueError(f"Required gallery asset is missing or linked: {name}")
            shutil.copyfile(source, stage / name)
        for task in catalog:
            for name in ("prompt.md", "acceptance.md"):
                relative = f"prompts/{task['id']}/{name}"
                source = regular_file(root, relative)
                if source is None:
                    raise ValueError(f"Required prompt document is missing or linked: {relative}")
                target = stage / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
        write_json(stage / "prompts/catalog.json", catalog)
        for row in rows:
            run = state.results_root / row["model_key"] / row["run_key"]
            relative = Path(row["model_key"]) / row["run_key"] / row["artifact"]["filename"]
            source_relative = relative.parent / DEMO_PATH if row['artifact'].get('demo') else relative
            source = regular_file(state.results_root, source_relative.as_posix())
            if source is None:
                raise ValueError("A source HTML artifact changed or became a link during export.")
            route = 'demos' if row['artifact'].get('demo') else 'artifacts'
            target = stage / route / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            validate_static_html(target.read_bytes())
            row["artifact"].update(bytes=target.stat().st_size, sha256=server.file_sha256(target))
            if screenshots == "none":
                continue
            files = {path.name.lower(): path for path in run.iterdir() if path.is_file() and not linked(path)}
            shot = server.find_named(files, server.SCREENSHOT_NAMES)
            if shot is None:
                continue
            report["source_screenshot_bytes"] += shot.stat().st_size
            if modules is None:
                if not report["warnings"]:
                    report["warnings"].append("Pillow is unavailable; selected screenshots were copied at original size. Install it in the build interpreter with 'python -m pip install Pillow' for smaller 1280px WebP previews.")
                thumb = target.parent / shot.name
                shutil.copyfile(shot, thumb)
                report["unoptimized_screenshots"] += 1
            else:
                thumb = target.parent / "screenshot.webp"
                try:
                    thumbnail(shot, thumb, modules)
                except (OSError, ValueError) as error:
                    thumb.unlink(missing_ok=True)
                    report["warnings"].append(f"Skipped unreadable screenshot for {row['id']}: {type(error).__name__}.")
                    continue
            row["artifact"]["screenshot_url"] = f"/{route}/" + "/".join(quote(part, safe="") for part in (*relative.parts[:-1], thumb.name))
            report["screenshots"] += 1
            report["screenshot_bytes"] += thumb.stat().st_size
        for row in rows:
            encoded = "/".join(quote(row[key], safe="") for key in ("model_key", "run_key"))
            row["share_url"] = f"/share/{encoded}/"
            page = stage / "share" / row["model_key"] / row["run_key"] / "index.html"
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text(share_page(row, site_origin, model_labels.get(row["model_key"], row["model"])), encoding="utf-8")
        comparison_urls = comparison_pages(stage, catalog, rows, site_origin, model_labels, modules)
        comparison_images = list((stage / "comparisons").glob("*.jpg"))
        report.update(comparison_pages=len(comparison_urls), comparison_images=len(comparison_images),
                      comparison_image_bytes=sum(path.stat().st_size for path in comparison_images))
        model_urls = model_pages(stage, catalog, rows, site_origin, model_labels, modules)
        model_images = list((stage / "models").glob("*/preview.jpg"))
        report.update(model_pages=len(model_urls), model_images=len(model_images),
                      model_image_bytes=sum(path.stat().st_size for path in model_images))
        data = {"mode": "public", "generated_at": server.utc_iso(), "artifact_origin": "/artifacts",
                "catalog": catalog, "summary": state.summary(rows), "results": rows,
                "comparison_urls": comparison_urls, "model_urls": model_urls,
                "model_profiles": server.load_model_profiles(state.results_root, (row["model_key"] for row in rows))}
        write_json(stage / "api/data.json", data)
        (stage / "api/export.csv").write_bytes(export_csv(rows))
        (stage / "_redirects").write_text(REDIRECTS, encoding="utf-8")
        (stage / "_headers").write_text(HEADERS, encoding="utf-8")
        files = [path for path in stage.rglob("*") if path.is_file()]
        report.update(files=len(files), bytes=sum(path.stat().st_size for path in files))
        validate_output(root, output)
        if output.exists():
            shutil.rmtree(output)
        stage.replace(output)
        marker.write_text(OWNER_MARKER, encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screenshots", choices=("auto", "none"), default="auto", help="Auto creates 1280px WebP images with optional Pillow; otherwise selected screenshots retain their original bytes and extension.")
    parser.add_argument("--json", action="store_true", help="Print the build size report as JSON.")
    args = parser.parse_args()
    try:
        report = build_site(screenshots=args.screenshots)
    except (OSError, ValueError) as error:
        print(f"Build failed: {error}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Built {report['html_files']} HTML results and {report['screenshots']} screenshots.")
        print(f"Publish: {report['output']}")
        print(f"Size: {report['bytes']:,} bytes ({report['bytes'] / 1024 / 1024:.2f} MiB) in {report['files']} files.")
        if report["source_screenshot_bytes"]:
            print(f"Screenshots: {report['source_screenshot_bytes']:,} source bytes -> {report['screenshot_bytes']:,} published bytes.")
        for warning in report["warnings"]:
            print(f"Note: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
