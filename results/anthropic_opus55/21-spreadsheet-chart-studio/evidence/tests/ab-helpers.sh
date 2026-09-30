# Helpers for agent-browser checks (source this file). Session defaults to $AGENT_BROWSER_SESSION.
ab() { agent-browser "$@"; }
# cells A1 B2 ... -> "A1=<text> B2=<text>"
cells() { local out=""; for a in "$@"; do out+="$a=$(agent-browser get text "#c-$a") "; done; echo "$out"; }
fbar() { agent-browser get value "#formula-input"; }
namebox() { agent-browser get text "#name-box"; }
status() { agent-browser get text "#status-msg"; }
# rendered chart marks (aria-label of each focusable bar/point, in DOM order)
marks() { agent-browser eval "Array.from(document.querySelectorAll('#chart-host .mark')).map(m => m.getAttribute('aria-label')).join(' | ')"; }
notes() { agent-browser get text "#chart-notes"; }
clickcell() { agent-browser scrollintoview "#c-$1" >/dev/null; agent-browser click "#c-$1"; }
# type-to-edit: click the cell, send the first character as a real keydown (starts the in-cell editor),
# insert the remainder into the focused editor, then press Enter to commit (moves down).
typecell() {
  clickcell "$1" >/dev/null || { echo "typecell: could not click $1" >&2; return 1; }
  if [ -z "$2" ]; then agent-browser press Delete >/dev/null; return; fi
  agent-browser press "${2:0:1}" >/dev/null
  [ ${#2} -gt 1 ] && agent-browser keyboard type "${2:1}" >/dev/null
  agent-browser press Enter >/dev/null
}
