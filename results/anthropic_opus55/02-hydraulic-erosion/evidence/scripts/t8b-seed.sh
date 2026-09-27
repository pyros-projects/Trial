#!/usr/bin/env bash
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
HASH="(()=>{let a=0; const h=lab.S.h; for(let i=0;i<h.length;i+=7) a=(a*31 + Math.round(h[i]*1000))|0; return a})()"
$AB reload >/dev/null; $AB wait 1500 >/dev/null
$AB eval "window.__hA=$HASH; window.__hA"
$AB find text "Terrain generation" click >/dev/null
$AB fill "#g-seed" "98765" >/dev/null
$AB click "#btnRegen" >/dev/null; $AB wait 800 >/dev/null
$AB eval "window.__hB=$HASH; JSON.stringify({seed:lab.gen.seed, hash:window.__hB, differsFrom1337:window.__hB!==window.__hA, toast:document.querySelector('#toast').textContent})"
$AB screenshot evidence/screenshots/22-regen-seed-98765.png >/dev/null
$AB click "#btnRegen" >/dev/null; $AB wait 800 >/dev/null
$AB eval "JSON.stringify({regen_again_identical:$HASH===window.__hB})"
$AB fill "#g-seed" "1337" >/dev/null; $AB click "#btnRegen" >/dev/null; $AB wait 800 >/dev/null
$AB eval "JSON.stringify({back_to_1337_identical_to_first:$HASH===window.__hA})"
$AB select "#g-type" "island" >/dev/null; $AB focus "#g-relief" >/dev/null; $AB press End >/dev/null
$AB click "#btnRegen" >/dev/null; $AB wait 1000 >/dev/null
$AB eval "JSON.stringify({type:lab.S.gen.type, relief:lab.gen.relief, boundary:lab.P.boundary, seaLevel:lab.P.seaLevel, heightRange:[+lab.stats.minH.toFixed(1),+lab.stats.maxH.toFixed(1)]})"
$AB screenshot evidence/screenshots/23-regen-island-max-relief.png >/dev/null
