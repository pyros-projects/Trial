"""Load public video experiments without discovering or uploading video media."""
from __future__ import annotations

import json
import re
import stat
import unicodedata
from pathlib import Path
from typing import Any
from urllib.parse import quote

CATALOG_MAX_BYTES = 1024 * 1024
TEXT_LIMITS = {"title": 200, "description": 4000, "look_for": 4000, "format": 100}


def _regular_path(path: Path, *, directory: bool = False) -> None:
    try:
        info = path.lstat()
        expected_type = stat.S_ISDIR if directory else stat.S_ISREG
        if (not expected_type(info.st_mode)
                or getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT
                or (hasattr(path, "is_junction") and path.is_junction())):
            raise ValueError(f"Video path must be a regular {'directory' if directory else 'file'} without links: {path}")
    except OSError as error:
        raise ValueError(f"Video path is missing or unreadable: {path}") from error


def _text(value: Any, field: str, limit: int) -> str:
    if (not isinstance(value, str) or not value.strip() or len(value) > limit
            or any(unicodedata.category(char).startswith("C") for char in value)):
        raise ValueError(f"Video {field} must be non-empty plain text of at most {limit} characters.")
    return value.strip()


def _slug(value: Any) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", value):
        raise ValueError("Video experiment id must be a lowercase slug of at most 80 characters.")
    return value


def video_prompt_file(videos_root: Path, experiment_id: str) -> Path:
    """Resolve the one permitted prompt location, rejecting every linked component."""
    experiment = videos_root / _slug(experiment_id)
    prompt = experiment / "prompt.md"
    _regular_path(videos_root, directory=True)
    _regular_path(experiment, directory=True)
    _regular_path(prompt)
    return prompt


def load_video_experiments(videos_root: Path) -> list[dict[str, Any]]:
    """Missing catalog means no experiments; malformed public configuration is an error."""
    catalog = videos_root / "catalog.json"
    try:
        videos_root.lstat()
    except FileNotFoundError:
        return []
    _regular_path(videos_root, directory=True)
    try:
        catalog.lstat()
    except FileNotFoundError:
        return []
    _regular_path(catalog)
    try:
        with catalog.open("rb") as handle:
            content = handle.read(CATALOG_MAX_BYTES + 1)
        if len(content) > CATALOG_MAX_BYTES:
            raise ValueError("Video catalog exceeds the 1 MiB limit.")
        raw = json.loads(content.decode("utf-8"))
    except (OSError, UnicodeError, ValueError, RecursionError) as error:
        raise ValueError("Video catalog must be readable UTF-8 JSON of at most 1 MiB.") from error
    if not isinstance(raw, list):
        raise ValueError("Video catalog must be a JSON array.")
    experiments = []
    identifiers = set()
    for entry in raw:
        if not isinstance(entry, dict):
            raise ValueError("Every video experiment must be an object.")
        experiment_id = _slug(entry.get("id"))
        if experiment_id in identifiers:
            raise ValueError("Video experiment ids must be unique.")
        identifiers.add(experiment_id)
        item = {"id": experiment_id, **{field: _text(entry.get(field), field, limit)
                                        for field, limit in TEXT_LIMITS.items()}}
        videos = entry.get("videos")
        if not isinstance(videos, list) or not videos:
            raise ValueError("Every video experiment requires a non-empty videos array.")
        base = f"/videos/{quote(experiment_id, safe='')}/"
        item.update(prompt_url=base + "prompt.md", share_url=base, videos=[])
        youtube_ids = set()
        for video in videos:
            if not isinstance(video, dict):
                raise ValueError("Every video must be an object.")
            youtube_id = video.get("youtube_id")
            if not isinstance(youtube_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{11}", youtube_id):
                raise ValueError("Video youtube_id must be an 11-character YouTube ID.")
            # Distinct IDs must also have distinct paths on Windows exports.
            if youtube_id.casefold() in youtube_ids:
                raise ValueError("Video YouTube IDs must be unique within each experiment, including case-only path collisions.")
            youtube_ids.add(youtube_id.casefold())
            model_key = _text(video.get("model_key"), "model_key", 200)
            if model_key.startswith(".") or any(char in model_key for char in "/\\:"):
                raise ValueError("Video model_key must be a single model folder name.")
            public = {"youtube_id": youtube_id, "model_key": model_key,
                      "share_url": base + quote(youtube_id, safe="") + "/"}
            for field, limit in (("title", 200), ("setting", 100)):
                if field in video:
                    public[field] = _text(video[field], field, limit)
            if "duration" in video:
                duration = video["duration"]
                if not isinstance(duration, str) or not re.fullmatch(r"[0-9]{1,3}:[0-5][0-9]", duration):
                    raise ValueError("Video duration must use minutes:seconds, such as 7:00.")
                public["duration"] = duration
            item["videos"].append(public)
        video_prompt_file(videos_root, experiment_id)
        experiments.append(item)
    return experiments
