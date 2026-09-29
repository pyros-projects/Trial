#!/usr/bin/env bash
set -euo pipefail
ab(){ agent-browser --session ferro "$@"; }
moveCell(){
  local point px py
  point=$(ab --json eval "Ferro.cellToScreen($1,$2)")
  read -r px py < <(python3 -c 'import json,sys; r=json.load(sys.stdin)["data"]["result"]; print(round(r["x"]),round(r["y"]))' <<< "$point")
  ab mouse move "$px" "$py"
}
clickCell(){ moveCell "$1" "$2"; ab mouse down; ab mouse up; }
check(){ ab eval "(()=>{if(!($1))throw Error('Browser assertion failed: $2');return '$2: PASS';})()"; }
ab find role button click --name 'Delete tool'
moveCell 5 6
ab mouse down
moveCell 6 6
ab mouse up
check '!Ferro.factory.at(5,6)&&!Ferro.factory.at(6,6)' 'delete two conveyors'
ab find role button click --name 'Build Conveyor' --exact
moveCell 5 6
ab mouse down
moveCell 5 7
moveCell 6 7
moveCell 7 7
ab mouse up
check 'Ferro.factory.at(5,6).dir===1&&Ferro.factory.at(5,7).dir===0&&Ferro.factory.at(6,7).dir===0' 'continuous route creates corner'
ab press V
clickCell 7 7
ab press R
ab press R
ab press R
check 'Ferro.factory.at(7,7).dir===3' 'rotate final conveyor to smelter'
ab screenshot evidence/screenshots/desktop-rerouted-chain.png
ab find role button click --name 'Single simulation step' --exact
check 'Ferro.diagnostics().paused===true&&Ferro.factory.tick===3' 'single step increments exactly one tick'
ab select '#speedSelect' '8'
ab find role button click --name 'Resume simulation' --exact
ab wait --fn 'Ferro.factory.time>=50 && (Ferro.factory.delivered.ironPlate||0)>=10'
ab find role button click --name 'Pause simulation' --exact
check '(Ferro.factory.delivered.ironPlate||0)>=10&&(Ferro.factory.delivered.gear||0)>0&&Ferro.factory.at(10,6).flow>20' 'rerouted extraction smelting splitting delivery'
ab --json eval 'Ferro.diagnostics()' > evidence/logs/rerouted-chain-state.json
ab screenshot evidence/screenshots/desktop-working-chain.png
