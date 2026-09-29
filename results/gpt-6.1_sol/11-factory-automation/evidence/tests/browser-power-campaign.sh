#!/usr/bin/env bash
set -euo pipefail
ab(){ agent-browser --session ferro "$@"; }
moveCell(){ local point px py; point=$(ab --json eval "Ferro.cellToScreen($1,$2)"); read -r px py < <(python3 -c 'import json,sys; r=json.load(sys.stdin)["data"]["result"]; print(round(r["x"]),round(r["y"]))' <<< "$point"); ab mouse move "$px" "$py"; }
clickCell(){ moveCell "$1" "$2"; ab mouse down; ab mouse up; }
check(){ ab eval "(()=>{if(!($1))throw Error('Browser assertion failed: $2');return '$2: PASS';})()"; }
ab find role button click --name 'Choose factory preset' --exact
ab click '#sandboxMode'
ab click '[data-preset="crisis"]'
ab fill '#presetSeed' '-1'
ab click '#loadPreset'
check 'document.getElementById("presetError").textContent.length>0&&Ferro.factory.tick===3810' 'invalid seed rejects scenario replacement'
ab fill '#presetSeed' '1847'
ab click '#loadPreset'
ab find role button click --name 'Pause simulation' --exact
ab select '#overlaySelect' 'power'
ab --json eval 'Ferro.diagnostics()' > evidence/logs/power-crisis-before.json
check 'Ferro.factory.power.factor<0.5&&Ferro.factory.at(4,6).power<0.5' 'power crisis slows actual consumer'
ab screenshot evidence/screenshots/power-crisis.png
ab press V
clickCell 7 3
ab find role button click --name 'Upgrade (180)' --exact
ab find role button click --name 'Upgrade (270)' --exact
ab press G
clickCell 9 2
ab press V
clickCell 9 2
ab find role button click --name 'Add 10 coal · sandbox' --exact
ab find role button click --name 'Single simulation step' --exact
check 'Ferro.factory.power.factor===1&&Ferro.factory.at(4,6).power===1&&Ferro.factory.power.supply>Ferro.factory.power.demand' 'added fueled generation restores full machine power'
ab --json eval 'Ferro.diagnostics()' > evidence/logs/power-crisis-recovered.json
ab screenshot evidence/screenshots/power-recovered.png
ab find role button click --name 'Choose factory preset' --exact
ab click '#campaignMode'
ab click '[data-preset="starter"]'
ab click '#loadPreset'
ab select '#speedSelect' '8'
ab wait --fn 'Ferro.factory.contract.complete===true'
ab find role button click --name 'Pause simulation' --exact
check 'Ferro.factory.contract.score>0&&(Ferro.factory.delivered.ironPlate||0)>=60' 'first contract completes with score'
ab --json eval 'Ferro.diagnostics()' > evidence/logs/campaign-stage1.json
ab screenshot evidence/screenshots/contract-complete.png
ab click '#nextContract'
ab wait --fn 'Ferro.factory.contract.complete===true'
ab find role button click --name 'Pause simulation' --exact
check 'Ferro.factory.contract.stage===2&&(Ferro.factory.delivered.circuit||0)>=30' 'second contract uses continuously assembled circuits'
ab --json eval 'Ferro.diagnostics()' > evidence/logs/campaign-stage2.json
ab click '#nextContract'
ab wait --fn 'Ferro.factory.contract.complete===true'
ab find role button click --name 'Pause simulation' --exact
check 'Ferro.factory.contract.stage===3&&(Ferro.factory.delivered.motor||0)>=16' 'third contract combines circuit and gear lines into motors'
ab --json eval 'Ferro.diagnostics()' > evidence/logs/campaign-stage3.json
ab screenshot evidence/screenshots/campaign-complete.png
ab find role button click --name 'Reset factory' --exact
ab click '#confirmReset'
ab find role button click --name 'Pause simulation' --exact
check 'Ferro.factory.contract.stage===3&&Ferro.factory.contract.complete===false&&Ferro.factory.time<3' 'restart resets production and current contract'
ab errors
ab console
