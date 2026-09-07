#!/bin/bash
# Compact end-to-end regression over the delivered index.html (file:// only).
set -u
S=ero
F="file:///home/pyro/projects/naked/opus5/02-hydraulic-erosion/index.html"
D="$(dirname "$0")/drag.sh"
ev(){ agent-browser --session $S eval "$1" 2>&1; }
evs(){ cat | agent-browser --session $S eval --stdin 2>&1; }
say(){ printf '\n== %s ==\n' "$1"; }

say "1 boot (direct file://, 1280x800)"
agent-browser --session $S set viewport 1280 800 >/dev/null 2>&1
agent-browser --session $S open "$F" >/dev/null 2>&1; sleep 4
echo "errors: $(agent-browser --session $S errors 2>&1 | head -3)"
echo "console: $(agent-browser --session $S console 2>&1 | head -3)"
ev "JSON.stringify({booted:!!window.__ERO,fatalShown:document.getElementById('fatal').classList.contains('on'),renderer:window.__ERO.app.rend.info()})"

say "2 external network requests"
agent-browser --session $S network requests 2>&1 | grep -coE "(https?|wss?)://" | sed 's/^/count: /'

say "3 unattended evolution (20 s of the real rAF loop)"
ev "(()=>{window.__b=Float32Array.from(window.__ERO.sim.h);return window.__ERO.sim.steps})()"
sleep 20
evs <<'JS'
(()=>{const E=window.__ERO,s=E.sim,b=window.__b;let c=0,mx=0;for(let i=0;i<s.n;i++){const d=Math.abs(s.h[i]-b[i]);if(d>1e-4)c++;if(d>mx)mx=d;}
const st=E.stats();return JSON.stringify({steps:st.steps,fps:+st.fps.toFixed(1),qLevel:E.app.quality.level,
 cellsChanged:c,maxChangeM:+(mx*1000/s.N).toFixed(2),waterM3:+st.waterM3.toFixed(0),erodedM3:+st.erodedM3.toFixed(0),
 depositedM3:+st.depositedM3.toFixed(0),recoveries:st.recoveries});})()
JS

say "4 pause / step / resume"
agent-browser --session $S click "#bPause" >/dev/null 2>&1; sleep 2
A=$(ev "window.__ERO.sim.steps"); sleep 2; B=$(ev "window.__ERO.sim.steps")
echo "paused steps: $A then $B (must be equal)"
agent-browser --session $S click "#bStep" >/dev/null 2>&1; sleep 1
echo "after one step: $(ev "window.__ERO.sim.steps")"

say "5 brush edit with real pointer input (water + raise)"
agent-browser --session $S click "[data-tool=water]" >/dev/null 2>&1
ev "(()=>{let w=0;const s=window.__ERO.sim;for(let i=0;i<s.n;i++)w+=s.w[i];window.__w0=w;return +w.toFixed(1)})()"
bash "$D" $S 540 430 700 480 16 left 500 >/dev/null
ev "(()=>{let w=0;const s=window.__ERO.sim;for(let i=0;i<s.n;i++)w+=s.w[i];return JSON.stringify({waterBefore:+window.__w0.toFixed(1),waterAfter:+w.toFixed(1),added:+(w-window.__w0).toFixed(1)})})()"
agent-browser --session $S click "[data-tool=raise]" >/dev/null 2>&1
ev "(()=>{window.__h0=Float32Array.from(window.__ERO.sim.h);return 'snap'})()"
bash "$D" $S 620 500 700 540 12 left 400 >/dev/null
ev "(()=>{const s=window.__ERO.sim,b=window.__h0;let mx=0,c=0;for(let i=0;i<s.n;i++){const d=s.h[i]-b[i];if(Math.abs(d)>1e-5)c++;if(d>mx)mx=d;}return JSON.stringify({cellsRaised:c,maxRaiseM:+(mx*1000/s.N).toFixed(2)})})()"

say "6 camera: right-drag orbit with a brush tool active, middle-drag pan, wheel zoom"
ev "JSON.stringify({az:+window.__ERO.app.cam.az.toFixed(3),dist:+window.__ERO.app.cam.dist.toFixed(3)})"
bash "$D" $S 600 400 740 350 12 right >/dev/null
bash "$D" $S 600 400 660 450 8 middle >/dev/null
agent-browser --session $S mouse wheel -240 >/dev/null 2>&1; sleep 1
ev "JSON.stringify({az:+window.__ERO.app.cam.az.toFixed(3),dist:+window.__ERO.app.cam.dist.toFixed(3),tgt:window.__ERO.app.cam.target.map(v=>+v.toFixed(3))})"

say "7 visualisation modes do not reset the simulation"
evs <<'JS'
(()=>{const E=window.__ERO;const before={steps:E.sim.steps,t:E.sim.time,hash:E.hHash()};
 for(let i=0;i<7;i++) document.querySelectorAll('#modebar button')[i].click();
 const after={steps:E.sim.steps,t:E.sim.time,hash:E.hHash()};
 document.querySelectorAll('#modebar button')[0].click();
 return JSON.stringify({before,after,identical:before.steps===after.steps&&before.hash===after.hash});})()
JS

say "8 seed determinism / regenerate / reset"
evs <<'JS'
(()=>{const E=window.__ERO,f=document.getElementById('fSeed');
 const seed=v=>{f.value=String(v);f.dispatchEvent(new Event('change'));return E.hHash();};
 const a=seed(1337), b=seed(20260907), c=seed(1337);
 for(let i=0;i<300;i++)E.sim.step(E.P,E.sim.pickDt(E.P));
 const ran=E.hHash();
 document.getElementById('bReset').click();
 let w=0,dm=0;for(let i=0;i<E.sim.n;i++){w+=E.sim.w[i];dm=Math.max(dm,Math.abs(E.sim.h[i]-E.sim.h0[i]));}
 return JSON.stringify({seed1337:a,otherSeed:b,seed1337again:c,deterministic:a===c,differsBySeed:a!==b,
  afterRun:ran,afterReset:E.hHash(),resetRestores:E.hHash()===c,waterAfterReset:w,maxDeltaAfterReset:dm});})()
JS

say "9 export PNG + JSON, then import round-trip"
ev "(()=>{document.querySelectorAll('details.sec').forEach(d=>d.open=true);return 'sections open'})()"
evs <<'JS'
(()=>{const E=window.__ERO;E.app.paused=true;
 for(let i=0;i<500;i++)E.sim.step(E.P,E.sim.pickDt(E.P));
 E.sim.computeStats();
 window.__saved=JSON.stringify(buildStateObject());
 window.__pre={hash:E.hHash(),steps:E.sim.steps,t:E.sim.time,water:E.sim.waterVol};
 return JSON.stringify({jsonBytes:window.__saved.length});})()
JS
agent-browser --session $S click "#bPng" >/dev/null 2>&1; sleep 3
echo "png toast: $(ev "document.getElementById('toast').textContent")"
agent-browser --session $S click "#bJson" >/dev/null 2>&1; sleep 3
echo "json toast: $(ev "document.getElementById('toast').textContent")"
evs <<'JS'
(()=>{const E=window.__ERO;
 document.getElementById('bReset').click(); E.P.seed=5; document.getElementById('bRegen').click();
 const perturbed=E.hHash();
 importState(JSON.parse(window.__saved));
 return JSON.stringify({perturbed,restored:E.hHash(),expected:window.__pre.hash,
   steps:E.sim.steps,expectedSteps:window.__pre.steps,exact:E.hHash()===window.__pre.hash&&E.sim.steps===window.__pre.steps});})()
JS

say "10 presets"
ev "window.__ERO.app.paused=false;document.getElementById('bPause').innerHTML='Pause <span class=\"k\">&#9251;</span>';'resumed'"
for p in "Mountain drainage" "Canyon formation" "Island rainfall" "River valley" "Aggressive stress test"; do
  agent-browser --session $S find text "$p" click >/dev/null 2>&1; sleep 1
  ev "JSON.stringify({preset:window.__ERO.app.presetName,res:window.__ERO.P.res,shape:window.__ERO.P.shape,substeps:window.__ERO.P.substeps})"
done
sleep 8
ev "JSON.stringify({stressRunning:!window.__ERO.app.paused,steps:window.__ERO.sim.steps,fps:+window.__ERO.stats().fps.toFixed(1),N:window.__ERO.sim.N,recoveries:window.__ERO.stats().recoveries})"

say "11 stability under extreme parameters"
evs <<'JS'
(()=>{const E=window.__ERO,P=E.P;E.app.paused=true;
 Object.assign(P,{res:256,flow:40,rain:0.08,evap:0,capacity:4,erode:2.5,deposit:2.5,thermal:1.5,talus:12,speed:4,substeps:8,minSlope:0.2});
 document.getElementById('ctl_res').value='256';document.getElementById('ctl_res').dispatchEvent(new Event('change'));
 for(let i=0;i<800;i++)E.sim.step(P,E.sim.pickDt(P));
 let bad=0,negW=0;for(let i=0;i<E.sim.n;i++){if(!isFinite(E.sim.h[i])||!isFinite(E.sim.w[i])||!isFinite(E.sim.s[i]))bad++;if(E.sim.w[i]<0)negW++;}
 return JSON.stringify({nonFinite:bad,negativeWater:negW,recoveries:E.sim.recoveries,dt:+E.sim.dt.toFixed(4),clamped:E.sim.dtClamped});})()
JS

say "12 responsive layout"
for vp in "1280 800" "390 844"; do
  agent-browser --session $S set viewport $vp >/dev/null 2>&1; sleep 2
  ev "JSON.stringify({vw:innerWidth,vh:innerHeight,noHScroll:document.documentElement.scrollWidth<=innerWidth,buf:[document.getElementById('gl').width,document.getElementById('gl').height],hudBottom:Math.round(document.getElementById('hud').getBoundingClientRect().bottom),panelTop:Math.round(document.getElementById('panel').getBoundingClientRect().top)})"
done
agent-browser --session $S set viewport 1280 800 >/dev/null 2>&1

say "13 final error / console sweep"
echo "errors: $(agent-browser --session $S errors 2>&1 | head -5)"
echo "console: $(agent-browser --session $S console 2>&1 | head -5)"
