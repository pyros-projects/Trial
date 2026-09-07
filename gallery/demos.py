"""Fixed, static Real Apps demo contract; never build or launch submitted code."""
from html.parser import HTMLParser
from pathlib import Path
import codecs
import stat

DEMO_PATH = Path('project/gallery/index.html')
DEMO_SANDBOX = 'allow-scripts allow-downloads'
DEMO_CSP = (
    f"sandbox {DEMO_SANDBOX}; default-src 'none'; "
    "script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; "
    "img-src data: blob:; font-src data:; media-src data: blob:; "
    "connect-src 'none'; worker-src blob:; frame-src 'none'; "
    "object-src 'none'; base-uri 'none'; form-action 'none'"
)


def demo_file(run: Path) -> Path | None:
    """Resolve only the agreed file, rejecting links and Windows reparse points."""
    current = run
    try:
        for part in ('', *DEMO_PATH.parts):
            if part:
                current /= part
            if current.is_symlink() or getattr(current.lstat(), 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                return None
        return current if current.is_file() else None
    except OSError:
        return None


class _FormOptInParser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        # A browser CSP does not stop a host from provisioning form endpoints at deploy time.
        if any(name in {'netlify', 'data-netlify'} for name, _ in attrs):
            raise ValueError('Gallery demos must not opt into Netlify Forms.')


def validate_static_html(source: bytes) -> None:
    """Reject host-side form opt-ins; runtime isolation is enforced by response headers."""
    # Inspect markup without rewriting legacy HTML bytes. ASCII-compatible encodings
    # retain attribute names; Unicode BOMs must be decoded before looking for opt-ins.
    encoding = 'utf-8-sig'
    if source.startswith((codecs.BOM_UTF32_LE, codecs.BOM_UTF32_BE)):
        encoding = 'utf-32'
    elif source.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        encoding = 'utf-16'
    _FormOptInParser().feed(source.decode(encoding, errors='replace'))
