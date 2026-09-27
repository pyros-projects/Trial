#!/usr/bin/env bash
# Compact regression over the final index.html (file://, 1280x800), with a screen recording of the main workflow.
export AGENT_BROWSER_SESSION=regress
AB=agent-browser
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=$ROOT/evidence
HASH="(()=>{let a=0; const h=lab.S.h; for(let i=0;i<h.length;i+=3) a=(a*31 + Math.round(h[i]*1e6))|0; const d=lab.S.d; for(let i=0;i<d.length;i+=3) a=(a*31 + Math.round(d[i]*1e6))|0; return a})()"
$AB open "file://$ROOT/index.html" >/dev/null; $AB set viewport 1280 800 >/dev/null; $AB wait 3000 >/dev/null
$AB eval "JSON.stringify({R1_loaded:!!window.lab, running:!lab.paused, t:+lab.S.time.toFixed(2), N:lab.S.N, preset:lab.presetId})"
$AB record start $OUT/videos/main-workflow.webm >/dev/null
$AB mouse move 480 450 >/dev/null; $AB mouse down right >/dev/null; for x in 500 530 560 590; do $AB mouse move $x 440 >/dev/null; $AB wait 150 >/dev/null; done; $AB mouse up right >/dev/null
$AB mouse wheel -250 >/dev/null; $AB wait 500 >/dev/null
$AB eval "JSON.stringify({R2_camera:{yaw:+lab.api.cam.yaw.toFixed(2), dist:+lab.api.cam.dist.toFixed(0)}})"
$AB click "#toolbar button[data-tool=raise]" >/dev/null
$AB eval "window.__h=lab.S.h.slice(); 1" >/dev/null
$AB mouse move 470 470 >/dev/null; $AB mouse down left >/dev/null; for x in 480 495 510 525; do $AB mouse move $x 470 >/dev/null; $AB wait 250 >/dev/null; done; $AB mouse up left >/dev/null
$AB eval "(()=>{let up=0; for(let i=0;i<lab.S.h.length;i++) if(lab.S.h[i]>window.__h[i]+0.5) up++; return JSON.stringify({R3_raise_cellsRaisedOver50cm:up})})()"
$AB click "#toolbar button[data-tool=water]" >/dev/null
$AB eval "window.__w=lab.stats.water; 1" >/dev/null
$AB mouse move 420 520 >/dev/null; $AB mouse down left >/dev/null; $AB wait 1500 >/dev/null; $AB mouse up left >/dev/null; $AB wait 300 >/dev/null
$AB eval "JSON.stringify({R4_water:{brushW_m3:+lab.S.bal.brushW.toFixed(0), waterBefore:+window.__w.toFixed(0), waterAfter:+lab.stats.water.toFixed(0)}})"
for m in 3 5 7 1; do $AB press $m >/dev/null; $AB wait 900 >/dev/null; done
$AB eval "JSON.stringify({R5_modes_noReset:{t:+lab.S.time.toFixed(1), steps:lab.S.steps, mode:lab.view.mode}})"
$AB record stop >/dev/null
$AB click "#btnPause" >/dev/null; $AB wait 200 >/dev/null
$AB eval "window.__t=lab.S.time; 1" >/dev/null; $AB click "#btnStep" >/dev/null; $AB wait 300 >/dev/null
$AB eval "JSON.stringify({R6_step:{paused:lab.paused, dtAdvanced:+(lab.S.time-window.__t).toFixed(4)}})"
$AB eval "window.__snap=$HASH; window.__st=lab.S.time; 1" >/dev/null
$AB download "#btnExportJson" $OUT/exports/regression-state.json >/dev/null
$AB download "#btnExportPng" $OUT/exports/regression-heightmap.png >/dev/null
$AB click "#btnReset" >/dev/null; $AB wait 300 >/dev/null
$AB eval "(()=>{let m=0; for(let i=0;i<lab.S.h.length;i++) m=Math.max(m,Math.abs(lab.S.h[i]-lab.S.h0[i])); return JSON.stringify({R7_reset:{t:lab.S.time, maxAbsDiffToInitial:m}})})()"
$AB upload "#importFile" $OUT/exports/regression-state.json >/dev/null; $AB wait 2500 >/dev/null
$AB eval "JSON.stringify({R8_import:{exact:$HASH===window.__snap && lab.S.time===window.__st, toast:document.querySelector('#toast').textContent}})"
$AB select "#p-res" "192" >/dev/null; $AB click "#btnPause" >/dev/null; $AB wait 3000 >/dev/null
$AB eval "JSON.stringify({R9_resolution:{N:lab.S.N, running:!lab.paused, finite:lab.stats.finite, t:+lab.S.time.toFixed(1)}})"
$AB eval "JSON.stringify({R10_balance:{mass:lab.stats.matRel.toExponential(1), water:lab.stats.waterRel.toExponential(1), recoveries:lab.recoveries}})"
echo "R11 page errors:"; $AB errors
echo "R11 console (non-GPU-stall):"; $AB console | grep -iv "GPU stall" | head -5
$AB screenshot $OUT/screenshots/50-regression-final.png >/dev/null
$AB close >/dev/null
