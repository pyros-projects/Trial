#!/usr/bin/env bash
set -euo pipefail
ab(){ agent-browser --session ferro "$@"; }
moveCell(){ local point px py; point=$(ab --json eval "Ferro.cellToScreen($1,$2)"); read -r px py < <(python3 -c 'import json,sys; r=json.load(sys.stdin)["data"]["result"]; print(round(r["x"]),round(r["y"]))' <<< "$point"); ab mouse move "$px" "$py"; }
clickCell(){ moveCell "$1" "$2"; ab mouse down; ab mouse up; }
check(){ ab eval "(()=>{if(!($1))throw Error('Browser assertion failed: $2');return '$2: PASS';})()"; }
ab press Q
clickCell 6 7
clickCell 16 6
check 'Ferro.factory.at(16,6).kind==="belt"&&Ferro.factory.at(16,6).items.length===0' 'eyedropper copies structure without inventory'
ab press H
clickCell 16 6
clickCell 17 6
check '!Ferro.factory.at(16,6)&&Ferro.factory.at(17,6).kind==="belt"' 'move places structure in new cell'
ab find role button click --name 'Undo construction' --exact
check 'Ferro.factory.at(16,6)&&!Ferro.factory.at(17,6)' 'undo move'
ab find role button click --name 'Redo construction' --exact
check '!Ferro.factory.at(16,6)&&Ferro.factory.at(17,6)' 'redo move'
ab press B
clickCell 16 6
ab press Z
moveCell 16 6
ab mouse down
moveCell 17 6
ab mouse up
ab find role button click --name 'Copy layout' --exact
clickCell 16 9
check 'Ferro.factory.at(16,9).kind==="belt"&&Ferro.factory.at(17,9).kind==="belt"' 'area layout copy places two structures'
ab press Z
moveCell 16 9
ab mouse down
moveCell 17 9
ab mouse up
ab find role button click --name 'Delete selected' --exact
check '!Ferro.factory.at(16,9)&&!Ferro.factory.at(17,9)' 'area delete removes both structures'
ab find role button click --name 'Undo construction' --exact
check 'Ferro.factory.at(16,9)&&Ferro.factory.at(17,9)' 'undo restores selected layout'
ab press L
moveCell 16 4
ab mouse down
moveCell 17 4
moveCell 18 4
moveCell 19 4
moveCell 20 4
ab mouse up
check 'Ferro.factory.at(16,4).kind==="pole"&&Ferro.factory.at(20,4).kind==="pole"' 'continuous power-line drawing spaces connectors'
ab select '#overlaySelect' 'power'
ab screenshot evidence/screenshots/power-line-drawing.png
ab press V
clickCell 7 6
ab select '#selectedRecipe' 'copper'
ab find role button click --name 'Single simulation step' --exact
check 'Ferro.factory.at(7,6).recipe==="copper"&&Ferro.factory.at(7,6).status==="starved"' 'incorrect supplied recipe waits for required input'
ab select '#selectedRecipe' 'iron'
ab find role button click --name 'Single simulation step' --exact
check 'Ferro.factory.at(7,6).recipe==="iron"&&Ferro.factory.at(7,6).active' 'recipe correction resumes active batch'
ab find role button click --name 'Upgrade (120)' --exact
check 'Ferro.factory.at(7,6).level===2' 'machine upgrade alters level and power demand'
ab find role button click --name 'Single simulation step' --exact
check 'Ferro.factory.power.demand>76' 'upgraded machine requests more power'
ab find role button click --name 'Enable sound' --exact
check 'Ferro.audio.enabled&&Ferro.audio.state==="running"' 'user gesture activates Web Audio'
ab find role button click --name 'Save factory' --exact
ab download '#exportJSON' evidence/exported-factory.json
ab download '#exportPNG' evidence/exported-factory.png
ab upload '#importFile' evidence/exported-factory.json
ab wait --fn 'document.getElementById("modalBack").hidden===true'
check 'Ferro.factory.at(7,6).level===2&&Ferro.diagnostics().paused===true' 'JSON file export and import restore changed factory'
ab errors
ab console
