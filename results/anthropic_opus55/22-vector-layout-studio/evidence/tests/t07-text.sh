#!/usr/bin/env bash
# Check 7: text & typography, hostile text, layout box vs export, text history
source "$(dirname "$0")/../ab.sh"
field() { $AB scrollintoview "[data-field=$1]" >/dev/null; $AB fill "[data-field=$1]" "$2" >/dev/null; $AB press Enter >/dev/null; $AB press Escape >/dev/null; }
T() { diag "d.project.items.find(i=>i.id==='sub')$1"; }
fresh
$AB scrollintoview '#layers .lrow[data-id=sub] .lname' >/dev/null; $AB click '#layers .lrow[data-id=sub] .lname' >/dev/null
echo "selected: $(diag 'd.selection') text=$(T .text)"
H0=$(diag 'd.history.undo')
echo "== 7a multiline edit committed with Ctrl+Enter"
$AB scrollintoview '#insText' >/dev/null; $AB click '#insText' >/dev/null; $AB press Control+a >/dev/null
$AB keyboard type "Longest light" >/dev/null; $AB press Enter >/dev/null; $AB keyboard type "of the year" >/dev/null
echo "   live: history=$(diag 'd.history.undo') live=$(diag 'd.liveTransaction') scene tspans=$($AB eval '[...document.querySelectorAll("#scene [data-id=sub] tspan")].map(t=>t.textContent).join("|")')"
$AB press Backspace >/dev/null; $AB press Backspace >/dev/null; $AB keyboard type "ar" >/dev/null
echo "   Backspace inside textarea: items=$(diag 'd.items') (expect 24, nothing deleted)"
$AB press Control+Enter >/dev/null
echo "   committed: text=$(T .text) history $H0 -> $(diag 'd.history.undo') (expect +1) label=$(diag 'd.history.labels.at(-1)')"
echo "== 7b typography controls"
$AB scrollintoview '[data-field=font-family]' >/dev/null; $AB select '[data-field=font-family]' serif >/dev/null
field font-size 44
$AB click "button[title='Bold weight (700)']" >/dev/null
$AB click "button[title='Align text center']" >/dev/null
field line-height 1.5
field fill '#22aa88'
echo "   $(diag "(({fontFamily,fontSize,fontWeight,align,lineHeight,fill})=>({fontFamily,fontSize,fontWeight,align,lineHeight,fill}))(d.project.items.find(i=>i.id==='sub'))")"
echo "   rendered: $($AB eval '(()=>{const t=document.querySelector("#scene [data-id=sub] text");return [t.getAttribute("font-family"),t.getAttribute("font-size"),t.getAttribute("font-weight"),t.getAttribute("text-anchor"),t.getAttribute("fill")].join(" | ")})()')"
echo "== 7c hostile text stays text"
$AB network requests --clear >/dev/null 2>&1
$AB scrollintoview '#insText' >/dev/null; $AB click '#insText' >/dev/null; $AB press Control+a >/dev/null
$AB keyboard type '<img src=x onerror=alert(1)> & "layout"' >/dev/null; $AB press Control+Enter >/dev/null
echo "   model text: $(T .text)"
echo "   injected img elements: $($AB eval 'document.querySelectorAll("img:not(#previewImg), #scene img, #scene foreignObject, script:not(:first-of-type)").length') ; scene text node: $($AB eval 'document.querySelector("#scene [data-id=sub] tspan").textContent')"
echo "   layer name/inspector title untouched; dialog? $($AB dialog status 2>&1 | head -1)"
echo "== 7d rotate the text, add a line break, compare editor layout with exported SVG"
field rot 20
$AB scrollintoview '#insText' >/dev/null; $AB click '#insText' >/dev/null; $AB press End >/dev/null; $AB press Control+End >/dev/null; $AB press Enter >/dev/null; $AB keyboard type "second line" >/dev/null; $AB press Control+Enter >/dev/null
$AB download '#btnExportSVG' evidence/downloads/t07-text.svg >/dev/null
EDITOR=$($AB eval '(()=>{const g=document.querySelector("#scene [data-id=sub]");return JSON.stringify({tf:g.getAttribute("transform"),t:[...g.querySelectorAll("tspan")].map(s=>[s.getAttribute("x"),s.getAttribute("y"),s.textContent]),box:[...g.querySelectorAll("rect.hit")].map(r=>[r.getAttribute("width"),r.getAttribute("height")])})})()')
echo "   editor: $EDITOR"
echo "   bounds (inspector/diag): $(diag 'd.bounds.sub')"
python3 - "$EDITOR" evidence/downloads/t07-text.svg <<'PY'
import json,sys,re,xml.etree.ElementTree as ET
ed=json.loads(json.loads(sys.argv[1])); svg=open(sys.argv[2]).read()
root=ET.fromstring(svg); ns={'s':'http://www.w3.org/2000/svg'}
hit=None
for g in root.iter('{http://www.w3.org/2000/svg}g'):
    t=g.find('s:text',ns)
    if t is not None and any('layout' in (ts.text or '') for ts in t.findall('s:tspan',ns)): hit=(g,t)
g,t=hit
ex={'tf':g.get('transform'),'t':[[s.get('x'),s.get('y'),s.text] for s in t.findall('s:tspan',ns)]}
print("   export : ", json.dumps(ex, ensure_ascii=False))
print("   transform equal:", ex['tf']==ed['tf'], "| tspans equal:", ex['t']==ed['t'])
bad=[(e.tag,a) for e in root.iter() for a in e.attrib if a.lower().startswith('on')]
tags=sorted({e.tag.split('}')[1] for e in root.iter()})
print("   raw escaped in SVG:", '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;layout&quot;' in svg, "| element types:", tags, "| on* attributes:", bad)
PY
echo "   network requests during test (non-app): $($AB network requests 2>&1 | grep -v 'index.html' | grep -ci 'http' )"
echo "== 7e undo text commit in one step; cancel another edit with Escape"
H1=$(diag 'd.history.undo'); $AB focus '#stage' >/dev/null; $AB press Control+z >/dev/null
echo "   after undo: text=$(T .text) history $H1 -> $(diag 'd.history.undo') sel=$(diag 'd.selection')"
P0=$(diag 'd.project'); H2=$(diag 'd.history.undo')
$AB scrollintoview '#insText' >/dev/null; $AB click '#insText' >/dev/null; $AB keyboard type " CANCEL ME" >/dev/null
echo "   live preview while typing: $($AB eval 'document.querySelector("#scene [data-id=sub] tspan:last-child").textContent')"
$AB press Escape >/dev/null
[ "$P0" = "$(diag 'd.project')" ] && echo "   Escape: document restored exactly, history $H2 -> $(diag 'd.history.undo') PASS" || echo "   Escape: DOCUMENT CHANGED FAIL"
$AB screenshot evidence/screens/07-text.png >/dev/null
