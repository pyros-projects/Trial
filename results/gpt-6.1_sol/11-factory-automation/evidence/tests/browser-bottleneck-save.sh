#!/usr/bin/env bash
set -euo pipefail
ab(){ agent-browser --session ferro "$@"; }
moveCell(){ local point px py; point=$(ab --json eval "Ferro.cellToScreen($1,$2)"); read -r px py < <(python3 -c 'import json,sys; r=json.load(sys.stdin)["data"]["result"]; print(round(r["x"]),round(r["y"]))' <<< "$point"); ab mouse move "$px" "$py"; }
clickCell(){ moveCell "$1" "$2"; ab mouse down; ab mouse up; }
check(){ ab eval "(()=>{if(!($1))throw Error('Browser assertion failed: $2');return '$2: PASS';})()"; }
ab --json eval 'Ferro.diagnostics()' > evidence/logs/bottleneck-before.json
ab find role button click --name 'Delete tool' --exact
clickCell 8 6
ab select '#overlaySelect' 'blocked'
ab find role button click --name 'Resume simulation' --exact
ab wait --fn 'Ferro.factory.time>=160 && Ferro.factory.at(7,6).status==="blocked" && Ferro.factory.at(4,6).status==="blocked"'
ab find role button click --name 'Pause simulation' --exact
check 'Ferro.factory.at(7,6).status==="blocked"&&Ferro.factory.at(4,6).status==="blocked"&&Ferro.factory.queueLength()>20' 'deliberate output break creates upstream backpressure'
ab --json eval 'Ferro.diagnostics()' > evidence/logs/bottleneck-blocked.json
ab screenshot evidence/screenshots/desktop-bottleneck.png
ab find role button click --name 'Build Conveyor' --exact
clickCell 8 6
ab select '#overlaySelect' 'none'
ab find role button click --name 'Resume simulation' --exact
ab wait --fn 'Ferro.factory.time>=190 && Ferro.factory.at(7,6).status!=="blocked" && (Ferro.factory.delivered.ironPlate||0)>30'
ab find role button click --name 'Pause simulation' --exact
check 'Ferro.factory.at(7,6).status!=="blocked"&&(Ferro.factory.delivered.ironPlate||0)>30' 'repair drains jam and resumes delivery'
ab --json eval 'Ferro.diagnostics()' > evidence/logs/bottleneck-recovered.json
ab find role button click --name 'Save factory' --exact
ab fill '#slotName0' 'QA routed factory'
ab find role button click --name 'Save slot 1' --exact
check 'JSON.stringify(Ferro.factory.dump())===JSON.stringify(JSON.parse(localStorage.getItem("ferro.slot.0")).state.factory)' 'named slot saves exact factory state'
ab --json eval 'JSON.parse(localStorage.getItem("ferro.slot.0"))' > evidence/logs/saved-slot.json
ab screenshot evidence/screenshots/archive-saved.png
ab find role button click --name 'Close dialog' --exact
ab find role button click --name 'Single simulation step' --exact
ab find role button click --name 'Single simulation step' --exact
ab find role button click --name 'Single simulation step' --exact
check 'Ferro.factory.tick===JSON.parse(localStorage.getItem("ferro.slot.0")).state.factory.tick+3' 'state changes after save'
ab find role button click --name 'Save factory' --exact
ab find role button click --name 'Load slot 1' --exact
check 'JSON.stringify(Ferro.factory.dump())===JSON.stringify(JSON.parse(localStorage.getItem("ferro.slot.0")).state.factory)&&Ferro.diagnostics().paused===true' 'named slot reload restores exact state'
ab find role button click --name 'Save factory' --exact
ab fill '#importText' '{"version":1,"settings":{"w":32},"cells":[{"kind":"not-a-machine"}]}'
ab find role button click --name 'Import factory' --exact
check 'document.getElementById("importError").textContent.length>0 && JSON.stringify(Ferro.factory.dump())===JSON.stringify(JSON.parse(localStorage.getItem("ferro.slot.0")).state.factory)' 'malformed import rejects without replacing active factory'
ab screenshot evidence/screenshots/import-error.png
ab find role button click --name 'Create share code' --exact
ab wait --fn 'document.getElementById("importText").value.startsWith("FERRO1")'
ab --json eval 'document.getElementById("importText").value' > evidence/logs/share-code.json
ab find role button click --name 'Import factory' --exact
check 'JSON.stringify(Ferro.factory.dump())===JSON.stringify(JSON.parse(localStorage.getItem("ferro.slot.0")).state.factory)' 'compressed share text round-trip retains exact factory'
ab errors
ab console
