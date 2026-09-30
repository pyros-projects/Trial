#!/usr/bin/env bash
# Check 1: direct file:// open, opaque-origin sandboxed iframe, no network
source "$(dirname "$0")/../ab.sh"
ROOT=$PWD
echo "== 1a direct file:// open (separate browser session, no server)"
S=vls-file
agent-browser --session $S set viewport 1280 800 >/dev/null
agent-browser --session $S open "file://$ROOT/index.html" >/dev/null; agent-browser --session $S wait 400 >/dev/null
echo "   url=$(agent-browser --session $S get url) title=$(agent-browser --session $S get title)"
echo "   scene items rendered: $(agent-browser --session $S eval 'document.querySelectorAll("#scene [data-id]").length') status: $(agent-browser --session $S eval 'document.querySelector("[data-diag=io]").textContent')"
agent-browser --session $S find role button click --name "Rectangle tool" >/dev/null
agent-browser --session $S mouse move 400 300 >/dev/null; agent-browser --session $S mouse down left >/dev/null; agent-browser --session $S mouse move 460 340 >/dev/null; agent-browser --session $S mouse move 500 380 >/dev/null; agent-browser --session $S mouse up left >/dev/null
echo "   drew a rectangle: selection=$(agent-browser --session $S eval 'document.querySelector("[data-diag=selection] b").textContent') items=$(agent-browser --session $S eval 'document.querySelector("[data-diag=items] b").textContent')"
echo "   network requests: $(agent-browser --session $S network requests 2>&1 | grep -v '^$' | head -5 | tr '\n' ' ')"
echo "   errors: '$(agent-browser --session $S errors 2>&1)'"
agent-browser --session $S screenshot $ROOT/evidence/screens/01-file-url.png >/dev/null
agent-browser --session $S close >/dev/null
echo "== 1b sandbox=\"allow-scripts allow-downloads\" iframe (opaque origin), served from the local server"
fresh >/dev/null
$AB open "http://127.0.0.1:8765/evidence/sandbox-frame.html?v=$(date +%s)" >/dev/null; $AB wait 600 >/dev/null
$AB frame '#app' >/dev/null
echo "   in-frame origin=$($AB eval 'self.origin') sandboxed storage: $($AB eval '(()=>{try{localStorage.length;return "accessible"}catch(e){return "blocked ("+e.name+")"}})()')"
echo "   scene items: $($AB eval 'document.querySelectorAll("#scene [data-id]").length') io: $($AB eval 'document.querySelector("[data-diag=io]").textContent')"
$AB snapshot -i 2>/dev/null | grep -m3 -i "button \"New\"\|Rectangle tool\|Reset" | sed 's/^/   /'
$AB find role button click --name "Ellipse tool" >/dev/null
$AB mouse move 500 400 >/dev/null; $AB mouse down left >/dev/null; $AB mouse move 540 430 >/dev/null; $AB mouse move 580 470 >/dev/null; $AB mouse up left >/dev/null
echo "   drew ellipse in iframe: sel=$($AB eval 'document.querySelector("[data-diag=selection] b").textContent') history=$($AB eval 'document.querySelector("[data-diag=history] b").textContent')"
$AB press Control+z >/dev/null; echo "   undo in iframe: history=$($AB eval 'document.querySelector("[data-diag=history] b").textContent')"
$AB click '#btnReset' >/dev/null; $AB wait 150 >/dev/null; echo "   Reset uses in-app dialog (no window.confirm): $($AB eval '!document.getElementById("modal").hidden')"; $AB find role button click --name "Cancel" >/dev/null
rm -f $ROOT/evidence/downloads/t01-iframe.vls.json; $AB download '#btnExportJSON' $ROOT/evidence/downloads/t01-iframe.vls.json >/dev/null 2>&1
echo "   project download from sandbox: $(python3 -c "import json;p=json.load(open('$ROOT/evidence/downloads/t01-iframe.vls.json'));print(p['format'],len(p['items']),'items')" 2>&1)"
$AB upload '#fileImport' $ROOT/evidence/downloads/t01-iframe.vls.json >/dev/null; $AB wait 400 >/dev/null
[ "$($AB eval '!document.getElementById("modal").hidden')" = "true" ] && $AB find role button click --name "Replace document" >/dev/null
echo "   reimport in sandbox: $($AB eval 'document.querySelector("[data-diag=io]").textContent')"
$AB frame main >/dev/null
$AB screenshot $ROOT/evidence/screens/01-sandbox-iframe.png >/dev/null
echo "   requests (all): $($AB network requests 2>&1 | grep -o 'http[^ ]*' | sed 's/?v=[0-9]*//' | sort -u | tr '\n' ' ')"
echo "   page errors: '$($AB errors 2>&1)'"
