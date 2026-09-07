#!/usr/bin/env python3
"""Export an allowlisted public gallery without reading run metadata or evidence."""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import quote

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE_ROOT))
from gallery import server

STATIC_FILES = ("index.html", "app.js", "appsettings.json", "styles.css", "favicon.svg", "logo-mark.svg", "deep-swe-snapshot.png")
CATALOG_FIELDS = ("id", "title", "category", "icon", "description", "look_for", "track", "artifact_type", "rubric")
OWNER_MARKER = "public-static-export-v1\n"
REDIRECTS = "/api/data /api/data.json 200\n/api/catalog /prompts/catalog.json 200\n/sources/* /artifacts/:splat 200\n"
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
                html = server.find_named(files, server.HTML_NAMES)
                if html is None:
                    continue
                task_id = self.infer_task_id({}, run.name)
                task = self.catalog_by_id.get(task_id, {})
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
                        "url": f"/artifacts/{encoded}", "source_url": f"/sources/{encoded}",
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
    state = PublicGalleryState(root, catalog)
    rows = state.scan()
    modules = pillow_modules() if screenshots == "auto" else None
    report: dict[str, Any] = {"output": str(output), "html_files": len(rows), "screenshots": 0,
                              "unoptimized_screenshots": 0, "source_screenshot_bytes": 0,
                              "screenshot_bytes": 0, "warnings": []}
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
            source = regular_file(state.results_root, relative.as_posix())
            if source is None:
                raise ValueError("A source HTML artifact changed or became a link during export.")
            target = stage / "artifacts" / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
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
            row["artifact"]["screenshot_url"] = "/artifacts/" + "/".join(quote(part, safe="") for part in (*relative.parts[:-1], thumb.name))
            report["screenshots"] += 1
            report["screenshot_bytes"] += thumb.stat().st_size
        data = {"mode": "public", "generated_at": server.utc_iso(), "artifact_origin": "/artifacts",
                "catalog": catalog, "summary": state.summary(rows), "results": rows}
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
