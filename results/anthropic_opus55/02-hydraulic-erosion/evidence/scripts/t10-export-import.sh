#!/usr/bin/env bash
# Export PNG + JSON via the real buttons (browser download), verify files, re-import JSON through the file input, check exact resume.
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
OUT=$PWD/evidence/exports
HASH="(()=>{let a=0; const h=lab.S.h; for(let i=0;i<h.length;i+=3) a=(a*31 + Math.round(h[i]*1e6))|0; const d=lab.S.d; for(let i=0;i<d.length;i+=3) a=(a*31 + Math.round(d[i]*1e6))|0; return a})()"
$AB reload >/dev/null; $AB wait 1200 >/dev/null
$AB wait --fn "lab.S.time >= 30" --timeout 120000 >/dev/null
$AB click "#btnPause" >/dev/null; $AB wait 300 >/dev/null
$AB eval "(()=>{const S=lab.S,N=S.N; const idx=[0, 1234, 32768+77, N*N-1, 40000, 51111]; let mn=Infinity,mx=-Infinity; for(const v of S.h){if(v<mn)mn=v;if(v>mx)mx=v;} window.__snap={t:S.time,steps:S.steps,hash:$HASH}; return JSON.stringify({N, t:S.time, steps:S.steps, min:mn, max:mx, samples:idx.map(i=>[i,S.h[i]]), hash:window.__snap.hash})})()" | tee $OUT/page-at-export.json
$AB download "#btnExportPng" $OUT/heightmap.png
$AB download "#btnExportJson" $OUT/state.json
ls -la $OUT
# advance the paused sim by 20 single steps (real key presses), remember the result
$AB click "#view" >/dev/null 2>&1 || true
for i in $(seq 1 20); do $AB press n >/dev/null; done; $AB wait 400 >/dev/null
$AB eval "window.__after20={t:lab.S.time,steps:lab.S.steps,hash:$HASH}; JSON.stringify(window.__after20)"
# change the world completely, then import the exported file through the real file input
$AB click "[data-preset=island]" >/dev/null; $AB wait 1500 >/dev/null; $AB click "#btnPause" >/dev/null
$AB eval "JSON.stringify({before_import:{type:lab.S.gen.type, t:lab.S.time}})"
$AB upload "#importFile" $OUT/state.json; $AB wait 2500 >/dev/null
$AB eval "JSON.stringify({after_import:{type:lab.S.gen.type, N:lab.S.N, t:lab.S.time, steps:lab.S.steps, hash:$HASH, matchesExport:$HASH===window.__snap.hash && lab.S.time===window.__snap.t, paused:lab.paused, toast:document.querySelector('#toast').textContent}})"
$AB click "#view" >/dev/null 2>&1 || true
for i in $(seq 1 20); do $AB press n >/dev/null; done; $AB wait 400 >/dev/null
$AB eval "JSON.stringify({resumed20:{t:lab.S.time, steps:lab.S.steps, hash:$HASH, identicalToOriginalContinuation:$HASH===window.__after20.hash}})"
$AB screenshot evidence/screenshots/24-after-import.png >/dev/null
# malformed file must be rejected without touching the state
$AB eval "window.__pre=$HASH; 1" >/dev/null
printf '{"format":"hydraulic-erosion-lab-state","version":1,"N":256,"arrays":{"h":{"type":"f64","data":"AAAA"}}}' > $OUT/broken-state.json
$AB upload "#importFile" $OUT/broken-state.json; $AB wait 1200 >/dev/null
$AB eval "JSON.stringify({brokenImport:{toast:document.querySelector('#toast').textContent, isError:document.querySelector('#toast').classList.contains('err'), stateUnchanged:$HASH===window.__pre}})"
$AB screenshot evidence/screenshots/25-import-error.png >/dev/null
echo 'not json at all' > $OUT/not-json.json
$AB upload "#importFile" $OUT/not-json.json; $AB wait 1200 >/dev/null
$AB eval "JSON.stringify({notJson:{toast:document.querySelector('#toast').textContent, stateUnchanged:$HASH===window.__pre}})"
