#!/usr/bin/env bash
# Reset restores t=0 terrain exactly; Regenerate with the same seed is deterministic; a new seed gives new terrain.
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
HASH="(()=>{let a=0; const h=lab.S.h; for(let i=0;i<h.length;i+=7) a=(a*31 + Math.round(h[i]*1000))|0; return a})()"
$AB reload >/dev/null; $AB wait 1500 >/dev/null
$AB wait --fn "lab.S.time >= 20" --timeout 120000 >/dev/null
$AB eval "JSON.stringify({before_reset_t:+lab.S.time.toFixed(2), maxDelta:+lab.stats.maxDelta.toFixed(3), water:+lab.stats.water.toFixed(0), hash0:$HASH})"
$AB click "#btnPause" >/dev/null
$AB click "#btnReset" >/dev/null; $AB wait 200 >/dev/null
$AB eval "(()=>{const S=lab.S; let m=0; for(let i=0;i<S.h.length;i++) m=Math.max(m,Math.abs(S.h[i]-S.h0[i])); let w=0; for(let i=0;i<S.d.length;i++) w+=S.d[i]; return JSON.stringify({after_reset_t:S.time, steps:S.steps, max_abs_h_minus_h0:m, water_sum:w, toast:document.querySelector('#toast').textContent})})()"
$AB eval "window.__hA=$HASH; window.__hA"
$AB click "#btnRegen" >/dev/null; $AB wait 800 >/dev/null
$AB eval "JSON.stringify({regen_same_seed_hash:$HASH, identical:$HASH===window.__hA, seed:lab.gen.seed})"
$AB fill "#g-seed" "98765" >/dev/null; $AB press Enter >/dev/null
$AB click "#btnRegen" >/dev/null; $AB wait 800 >/dev/null
$AB eval "window.__hB=$HASH; JSON.stringify({new_seed:lab.gen.seed, hash:window.__hB, differs:window.__hB!==window.__hA, toast:document.querySelector('#toast').textContent})"
$AB screenshot evidence/screenshots/22-regen-seed-98765.png >/dev/null
$AB click "#btnRegen" >/dev/null; $AB wait 800 >/dev/null
$AB eval "JSON.stringify({regen_again_same_seed_identical:$HASH===window.__hB})"
$AB press g >/dev/null; $AB wait 800 >/dev/null
$AB eval "JSON.stringify({key_G_same_seed_identical:$HASH===window.__hB})"
# terrain parameter change + landform change via real controls
$AB select "#g-type" "island" >/dev/null; $AB focus "#g-relief" >/dev/null; $AB press End >/dev/null
$AB click "#btnRegen" >/dev/null; $AB wait 1000 >/dev/null
$AB eval "JSON.stringify({type:lab.S.gen.type, relief:lab.gen.relief, boundary:lab.P.boundary, seaLevel:lab.P.seaLevel, heightRange:[+lab.stats.minH.toFixed(1),+lab.stats.maxH.toFixed(1)]})"
$AB screenshot evidence/screenshots/23-regen-island-max-relief.png >/dev/null
