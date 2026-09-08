#!/usr/bin/env python3
"""Dev-time assembler: inlines src/* into the single delivered index.html.

index.html is the shipped artefact and stays fully self-contained; this
script (plus the src/ tree) is a development tool, not a runtime dependency.
"""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src"

shell = (src / "shell.html").read_text()
style = (src / "style.css").read_text()
parts = [
    (src / "sim.js").read_text(),
    (src / "ui1.js").read_text(),
    (src / "ui2.js").read_text(),
    (src / "ui3.js").read_text(),
]
js = "\n".join(parts)

for token, body in (("/*__STYLE__*/", style), ("/*__SIM__*/\n/*__UI__*/", js)):
    if token not in shell:
        sys.exit("marker missing in shell: " + token)
    shell = shell.replace(token, body)

for bad in ("</scr" + "ipt>",):
    if js.count(bad):
        sys.exit("JS contains a script terminator")

out = root / "index.html"
out.write_text(shell)
print("built %s (%.1f KiB)" % (out, out.stat().st_size / 1024))
