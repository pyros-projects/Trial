#!/usr/bin/env bash
# Check 1b: opaque-origin sandboxed iframe (allow-scripts allow-downloads), driven via snapshot refs + real pointer
source "$(dirname "$0")/../ab.sh"
ROOT=$PWD
ref() { $AB snapshot -i 2>/dev/null | grep -F -m1 "$1" | grep -o 'ref=e[0-9]*' | cut -d= -f2; }
press_btn() { $AB click "@$(ref "button \"$1\"")" >/dev/null; }
status() { $AB snapshot 2>/dev/null | sed -n '/contentinfo "Diagnostics"/,$p' | grep StaticText | sed 's/.*StaticText "//; s/"$//' | tr '\n' ' '; echo; }
$AB set viewport 1280 800 >/dev/null
$AB open "http://127.0.0.1:8765/evidence/sandbox-frame.html?v=$(date +%s%N)" >/dev/null; $AB wait 600 >/dev/null
echo "   parent page origin check: iframe sandbox attr = $($AB eval 'document.getElementById("app").getAttribute("sandbox")')"
echo "   boot status: $(status)"
press_btn "Ellipse tool"; $AB mouse move 500 400 >/dev/null; $AB mouse down left >/dev/null; $AB mouse move 540 430 >/dev/null; $AB mouse move 580 470 >/dev/null; $AB mouse up left >/dev/null
echo "   after drawing an ellipse: $(status)"
$AB press Control+z >/dev/null; echo "   after Ctrl+Z: $(status)"
$AB press Control+Shift+z >/dev/null; echo "   after redo: $(status)"
press_btn "Reset"; $AB wait 150 >/dev/null
echo "   Reset opens in-app dialog: $($AB snapshot -i 2>/dev/null | grep -c 'button "Reset session"')"
press_btn "Cancel"
rm -f $ROOT/evidence/downloads/t01-iframe.vls.json $ROOT/evidence/downloads/t01-iframe.svg $ROOT/evidence/downloads/t01-iframe.png
$AB download "@$(ref 'button "Project JSON"')" $ROOT/evidence/downloads/t01-iframe.vls.json >/dev/null 2>&1
$AB download "@$(ref 'button "SVG"')" $ROOT/evidence/downloads/t01-iframe.svg >/dev/null 2>&1
$AB download "@$(ref 'button "PNG"')" $ROOT/evidence/downloads/t01-iframe.png >/dev/null 2>&1
ls -la $ROOT/evidence/downloads/t01-iframe.* 2>&1 | awk '{print "   download:", $5, $9}'
python3 -c "import json;p=json.load(open('$ROOT/evidence/downloads/t01-iframe.vls.json'));print('   project from sandbox:',p['format'],len(p['items']),'items; has ellipse:',any(i['type']=='ellipse' and i['name'].startswith('Ellipse') for i in p['items']))" 2>&1
echo "   status after downloads: $(status)"
press_btn "Preview"; $AB wait 300 >/dev/null; $AB screenshot $ROOT/evidence/screens/01-sandbox-preview.png >/dev/null; $AB press Escape >/dev/null
$AB screenshot $ROOT/evidence/screens/01-sandbox-iframe.png >/dev/null
echo "   page errors: '$($AB errors 2>&1)'"
