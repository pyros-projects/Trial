#!/usr/bin/env bash
set -euo pipefail
ab(){ agent-browser --session ferro-transfer "$@"; }
ab set viewport 1280 800
ab network route 'http://**/*' --abort
ab network route 'https://**/*' --abort
ab open file:///home/pyro/projects/naked/sol61/11-factory-automation/index.html
ab find role button click --name 'Pause simulation' --exact
ab find role button click --name 'Save factory' --exact
ab upload '#importFile' "$PWD/evidence/ferro-starter-3810.json"
ab wait --fn 'document.getElementById("modalBack").hidden&&Ferro.factory.tick===3810'
# Preserve browser JSON as a string: the CLI's object re-encoding rounded some analytics floats.
ab --json eval 'JSON.stringify(Ferro.factory.dump())' > evidence/logs/final-imported-factory.json
python3 - <<'PY'
import json
with open('evidence/ferro-starter-3810.json') as f:
    exported=json.load(f)['factory']
with open('evidence/logs/final-imported-factory.json') as f:
    actual=json.loads(json.load(f)['data']['result'])
assert actual==exported, 'Imported factory differs from the complete exported state'
print('PASS: exported JSON file imports through the actual file control with exact factory equality')
PY
ab eval '(()=>{if(!Ferro.diagnostics().paused||Ferro.factory.at(7,6).level!==2)throw Error("Imported view/upgrade lost");return {status:"PASS",tick:Ferro.factory.tick,paused:Ferro.diagnostics().paused,level:Ferro.factory.at(7,6).level};})()'
ab screenshot evidence/screenshots/final-json-import.png
ab errors
ab console
ab close
