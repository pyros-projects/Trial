"""Safe authored-source snapshots and explicit local application preview URLs.

This module never installs dependencies, extracts submitted archives, starts an
application, follows source symlinks, or contacts a preview URL.
"""
from __future__ import annotations

import hashlib
import io
import ipaddress
import os
import struct
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

EXCLUDED_DIRS = frozenset({
    '.git', '.venv', 'venv', 'env', 'node_modules', '__pycache__', '.pytest_cache',
    '.mypy_cache', '.ruff_cache', '.cache', '.next', 'coverage', 'data', 'runtime',
    'dist', 'build', 'playwright-report', 'test-results',
})
EXCLUDED_SUFFIXES = ('.pyc', '.pyo', '.sqlite', '.sqlite3', '.db', '.db-wal',
                     '.db-shm', '.sqlite-wal', '.sqlite-shm', '.sqlite3-wal', '.sqlite3-shm', '.log')
MAX_SOURCE_FILES = 6000
MAX_SOURCE_BYTES = 64 * 1024 * 1024
DIGEST_VERSION = 'frontier-source-v1'


def excluded_entry(path: Path) -> bool:
    """Skip runtime/dependencies/secrets while retaining authored dotfiles."""
    name = path.name
    if path.is_symlink():
        return True
    if path.is_dir():
        return name in EXCLUDED_DIRS
    if name == '.env' or (name.startswith('.env.') and name not in {'.env.example', '.env.sample'}):
        return True
    return name.lower().endswith(EXCLUDED_SUFFIXES) or name in {'.DS_Store', 'Thumbs.db'}


def source_files(root: Path) -> list[Path]:
    """Enumerate a bounded source tree, without following symlinks."""
    if root.is_symlink() or not root.is_dir():
        raise ValueError('A source project must be a real directory, not a symlink.')
    result: list[Path] = []
    total = 0
    for current, directories, names in os.walk(root, followlinks=False):
        directory = Path(current)
        directories[:] = sorted(name for name in directories if not excluded_entry(directory / name))
        for name in sorted(names):
            path = directory / name
            if excluded_entry(path) or not path.is_file():
                continue
            total += path.stat().st_size
            result.append(path)
            if len(result) > MAX_SOURCE_FILES or total > MAX_SOURCE_BYTES:
                raise ValueError('Source snapshot exceeds 6,000 files or 64 MiB; remove generated dependencies/data.')
    result.sort(key=lambda path: path.relative_to(root).as_posix())
    return result


def project_summary(root: Path) -> dict[str, int | str]:
    """Hash names and bytes using an unambiguous length-prefixed format.

    sha256(version + NUL + each sorted path-length/path/file-size/file-bytes).
    Lengths are unsigned big-endian 64-bit integers. Timestamps are excluded.
    """
    paths = source_files(root)
    digest = hashlib.sha256((DIGEST_VERSION + '\0').encode('ascii'))
    total = 0
    for path in paths:
        relative = path.relative_to(root).as_posix().encode('utf-8')
        size = path.stat().st_size
        digest.update(struct.pack('>Q', len(relative)))
        digest.update(relative)
        digest.update(struct.pack('>Q', size))
        read_size = 0
        with path.open('rb') as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b''):
                read_size += len(chunk)
                if total + read_size > MAX_SOURCE_BYTES:
                    raise ValueError('Source tree grew beyond the snapshot limit while reading.')
                digest.update(chunk)
        if read_size != size:
            raise ValueError('Source file changed while reading; retry once edits have finished.')
        total += size
    return {'file_count': len(paths), 'bytes': total, 'sha256': digest.hexdigest(), 'digest_version': DIGEST_VERSION}


def project_zip(root: Path) -> bytes:
    """Return a bounded source-only ZIP. Stable ZIP metadata aids comparisons."""
    paths = source_files(root)
    output = io.BytesIO()
    total = 0
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in paths:
            data = path.read_bytes()
            total += len(data)
            if total > MAX_SOURCE_BYTES:
                raise ValueError('Source tree grew beyond the ZIP size limit while reading.')
            info = zipfile.ZipInfo(path.relative_to(root).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o100755 if path.stat().st_mode & 0o111 else 0o100644) << 16
            archive.writestr(info, data)
    return output.getvalue()


def validate_preview_url(value: str) -> str:
    """Permit only explicitly supplied HTTP(S) loopback URLs with a port."""
    if not isinstance(value, str) or not value or any(ch.isspace() or ord(ch) < 32 for ch in value):
        raise ValueError('Preview URL must be a nonempty URL without whitespace.')
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        port = parsed.port
    except ValueError as error:
        raise ValueError('Preview URL has an invalid host or port.') from error
    if parsed.scheme not in {'http', 'https'} or not host or port is None or not 1 <= port <= 65535:
        raise ValueError('Preview URL requires http/https and an explicit valid local port.')
    if parsed.username is not None or parsed.password is not None or '\\' in value:
        raise ValueError('Preview URL must not contain credentials or backslashes.')
    local = host.lower() == 'localhost'
    if not local:
        try:
            local = ipaddress.ip_address(host).is_loopback
        except ValueError:
            local = False
    if not local:
        raise ValueError('Only localhost or a literal loopback IP is allowed for project previews.')
    return value
