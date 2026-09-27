#!/usr/bin/env bash
# Export/import part of the final regression in a session without screen recording
# (agent-browser cancels downloads after `record start/stop` in the same session - reproduced, tool-side).
export AGENT_BROWSER_SESSION=regress-io
AB=agent-browser
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=$ROOT/evidence
HASH="(()=>{let a=0; const h=lab.S.h; for(let i=0;i<h.length;i+=3) a=(a*31 + Math.round(h[i]*1e6))|0; const d=lab.S.d; for(let i=0;i<d.length;i+=3) a=(a*31 + Math.round(d[i]*1e6))|0; return a})()"
$AB open "file://$ROOT/index.html" >/dev/null; $AB set viewport 1280 800 >/dev/null
$AB wait --fn "lab.S.time > 10" --timeout 60000 >/dev/null
$AB click "#btnPause" >/dev/null; $AB wait 200 >/dev/null
$AB eval "(()=>{const S=lab.S; let mn=Infinity,mx=-Infinity; for(const v of S.h){if(v<mn)mn=v;if(v>mx)mx=v;} window.__snap=$HASH; window.__st=S.time; return JSON.stringify({N:S.N,t:S.time,steps:S.steps,min:mn,max:mx,samples:[0,999,20000,33333,50000,65535].map(i=>[i,S.h[i]]),hash:window.__snap})})()" > $OUT/exports/regression-page-at-export.json
$AB download "#btnExportJson" $OUT/exports/regression-state.json
$AB download "#btnExportPng" $OUT/exports/regression-heightmap.png
$AB click "#btnReset" >/dev/null; $AB wait 300 >/dev/null
$AB eval "JSON.stringify({afterReset_t:lab.S.time})"
$AB upload "#importFile" $OUT/exports/regression-state.json >/dev/null; $AB wait 2500 >/dev/null
$AB eval "JSON.stringify({R8_import:{exact:$HASH===window.__snap && lab.S.time===window.__st, t:lab.S.time, toast:document.querySelector('#toast').textContent}})"
$AB errors
$AB close >/dev/null
node $ROOT/evidence/scripts/verify-png.js $OUT/exports/regression-heightmap.png $OUT/exports/regression-page-at-export.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(JSON.stringify({R12_png:{grayscale:r.grayscale,bitDepth:r.bitDepth,crcOk:r.crcOk,size:r.ihdr.w+'x'+r.ihdr.h,maxAbsErr_m:r.maxAbsErr_m,quantStep_m:r.quantStep_m}}))})"
