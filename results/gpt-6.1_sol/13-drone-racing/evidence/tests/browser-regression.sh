#!/usr/bin/env bash
set -euo pipefail
cd /home/pyro/projects/naked/sol61/13-drone-racing
export AGENT_BROWSER_SESSION=apex-regression-sol61
agent-browser open
agent-browser network route 'https://**' --abort
agent-browser network route 'http://**' --abort
agent-browser set viewport 1280 800
agent-browser open file:///home/pyro/projects/naked/sol61/13-drone-racing/index.html
agent-browser snapshot -i
agent-browser find role button click --name 'Enable engine audio'
agent-browser find role button click --name 'Arm & fly'
agent-browser keydown w
agent-browser wait --fn 'apex.getState().inputs.throttle > 0.52'
agent-browser keyup w
agent-browser keydown s
agent-browser wait --fn 'apex.getState().inputs.throttle < 0.39'
agent-browser keyup s
agent-browser press h
agent-browser keydown ArrowUp
agent-browser wait --fn 'apex.getState().gate >= 2'
agent-browser keyup ArrowUp
agent-browser press p
agent-browser eval --stdin <<'JS' > evidence/logs/clean-regression-state.json
(()=>{const s=apex.getState();if(s.gate!==2||s.sectors.length!==2||s.collisions!==0||!s.paused||s.telemetrySamples<20||s.audio.state!=='running')throw Error('Regression failed');window.validationBeforeCamera=s;return {p:s.p,v:s.v,q:s.q,gate:s.gate,sectors:s.sectors,time:s.time,penalty:s.penalty,fps:s.fps,dimensions:s.dimensions,telemetry:s.telemetrySamples,audio:s.audio};})()
JS
agent-browser screenshot /home/pyro/projects/naked/sol61/13-drone-racing/evidence/screenshots/clean-regression-flight.png
agent-browser find role button click --name 'Chase camera'
agent-browser eval --stdin <<'JS'
(()=>{const s=apex.getState(),old=window.validationBeforeCamera;if(JSON.stringify(s.p)!==JSON.stringify(old.p)||JSON.stringify(s.v)!==JSON.stringify(old.v)||JSON.stringify(s.q)!==JSON.stringify(old.q)||s.time!==old.time)throw Error('Camera altered physical state');return {camera:s.camera,physicalStateUnchanged:true};})()
JS
agent-browser set viewport 390 844 2
agent-browser wait --fn 'apex.getState().dimensions[0] > 700'
agent-browser eval --stdin <<'JS'
(()=>{const s=apex.getState();if(document.documentElement.scrollWidth!==390||devicePixelRatio!==2)throw Error('Viewport regression');return {screen:[innerWidth,innerHeight],dpr:devicePixelRatio,render:s.dimensions,fps:s.fps};})()
JS
agent-browser screenshot --full /home/pyro/projects/naked/sol61/13-drone-racing/evidence/screenshots/clean-regression-mobile.png
agent-browser errors --json > evidence/logs/clean-regression-errors.json
agent-browser console --json > evidence/logs/clean-regression-console.json
agent-browser network requests --json > evidence/logs/clean-regression-network.json
agent-browser close
