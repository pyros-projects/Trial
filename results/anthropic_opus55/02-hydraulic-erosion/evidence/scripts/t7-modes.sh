#!/usr/bin/env bash
# Cycle all 7 visualization modes via real clicks while the sim runs; the state must never reset.
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
$AB click "[data-preset=mountain]" >/dev/null
$AB wait --fn "lab.S.time >= 90" --timeout 240000 >/dev/null
$AB eval "lab.renderScale=1; 1" >/dev/null
i=0
for m in Shaded Elevation Water Sediment "Erosion Δ" Slope Flow; do
  $AB click "#modes button[data-mode='$i']" >/dev/null; $AB wait 900 >/dev/null
  $AB eval "(()=>{const S=lab.S; const r={mode:'$m', active:document.querySelector('#modes button[aria-pressed=true]').textContent, t:+S.time.toFixed(2), steps:S.steps, legend:document.querySelector('#legendTitle').textContent+' ['+document.querySelector('#legendMin').textContent+' .. '+document.querySelector('#legendMax').textContent+']', hudView:[...document.querySelectorAll('#hudGrid .v')].pop().textContent}; window.__prev=window.__prev||0; r.monotonic=S.steps>=window.__prev; window.__prev=S.steps; return JSON.stringify(r)})()"
  $AB screenshot "evidence/screenshots/21-mode-$i-$(echo $m | tr ' Δ' '-d' | tr A-Z a-z).png" >/dev/null
  i=$((i+1))
done
$AB press 1 >/dev/null
