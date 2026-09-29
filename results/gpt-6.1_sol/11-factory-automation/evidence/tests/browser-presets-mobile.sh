#!/usr/bin/env bash
set -euo pipefail
ab(){ agent-browser --session ferro "$@"; }
check(){ ab eval "(()=>{if(!($1))throw Error('Browser assertion failed: $2');return '$2: PASS';})()"; }
ab find role button click --name 'Choose factory preset' --exact
ab click '#sandboxMode'
ab click '[data-preset="balanced"]'
ab fill '#presetSeed' '1847'
ab click '#loadPreset'
ab select '#speedSelect' '8'
ab wait --fn 'Ferro.factory.time>=70 && (Ferro.factory.delivered.circuit||0)>=10'
ab find role button click --name 'Pause simulation' --exact
ab --json eval 'Ferro.diagnostics()' > evidence/logs/balanced-desktop.json
ab find role button click --name 'Production analytics' --exact
ab screenshot evidence/screenshots/analytics-balanced.png
ab find role button click --name 'Back to factory' --exact
ab find role button click --name 'Recipe book' --exact
check 'document.querySelectorAll(".recipecard").length===7' 'recipe book displays all seven working recipes'
ab screenshot evidence/screenshots/recipe-book.png
ab find role button click --name 'Back to factory' --exact
for overlay in flow graph power utilization congestion blocked status none; do ab select '#overlaySelect' "$overlay"; done
ab find role button click --name 'Simulation settings' --exact
ab focus '#beltSpeedInput'
ab press Home
check 'Ferro.factory.settings.beltSpeed===0.5' 'keyboard range input changes belt speed'
ab focus '#machineSpeedInput'
ab press Home
check 'Ferro.factory.settings.machineSpeed===0.25' 'keyboard range input changes recipe speed'
ab select '#densityInput' '1'
ab select '#powerDifficultyInput' '1.6'
ab select '#costInput' 'on'
check 'Ferro.factory.settings.density===1&&Ferro.factory.settings.cost&&Ferro.factory.mode==="campaign"' 'density and cost modes affect factory settings'
ab focus '#beltSpeedInput'
ab press ArrowRight
ab select '#costInput' 'off'
ab select '#powerDifficultyInput' '1'
ab select '#densityInput' '3'
ab focus '#beltSpeedInput'
ab press End
ab focus '#machineSpeedInput'
ab press End
ab find role button click --name 'Done' --exact
ab set viewport 390 844 2
ab find role button click --name 'Resume simulation' --exact
ab wait --fn 'Ferro.factory.time>=110 && (Ferro.factory.delivered.circuit||0)>=30'
ab find role button click --name 'Pause simulation' --exact
check 'Ferro.factory.cells.every(e=>{const p=Ferro.cellToScreen(e.x,e.y);return p.x>0&&p.x<390})&&Ferro.factory.delivered.circuit>=30' 'balanced factory stays visible and continues producing after narrow resize'
check 'document.getElementById("factoryCanvas").width===780&&devicePixelRatio===2' 'high-DPI canvas renders at physical pixel resolution'
ab --json eval 'Ferro.diagnostics()' > evidence/logs/balanced-mobile.json
ab screenshot evidence/screenshots/mobile-balanced.png
ab find role button click --name 'Open factory overview' --exact
ab screenshot evidence/screenshots/mobile-overview.png
ab find role button click --name 'Close inspector' --exact
ab find role button click --name 'Open construction tools' --exact
ab find role button click --name 'Build Conveyor' --exact
ab find role button click --name 'Close construction tools' --exact
ab find role button click --name 'Choose factory preset' --exact
ab click '[data-preset="stress"]'
ab click '#sandboxMode'
ab screenshot evidence/screenshots/mobile-preset-menu.png
ab find role button click --name 'Load factory' --exact
ab select '#speedSelect' '1'
ab set viewport 1280 800 1
ab wait --fn 'Ferro.factory.time>=10'
ab find role button click --name 'Pause simulation' --exact
check 'Ferro.factory.cells.reduce((n,e)=>n+(e.items?.length||0),0)>1000 && Object.values(Ferro.factory.delivered).reduce((a,b)=>a+b,0)>100' 'stress preset moves over one thousand real packets and delivers'
ab --json eval '({diagnostics:Ferro.diagnostics(),moving:Ferro.factory.cells.reduce((n,e)=>n+(e.items?.length||0),0),structures:Ferro.factory.cells.length})' > evidence/logs/stress-performance.json
ab screenshot evidence/screenshots/stress-test.png
ab find role button click --name 'Single simulation step' --exact
ab errors
ab console
ab network requests > evidence/logs/final-network.txt
