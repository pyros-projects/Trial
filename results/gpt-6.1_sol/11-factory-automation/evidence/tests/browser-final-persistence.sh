#!/usr/bin/env bash
set -euo pipefail
ab(){ agent-browser --session "${FERRO_QA_SESSION:-ferro}" "$@"; }
ab fill '#slotName2' 'QA verified factory'
ab find role button click --name 'Save slot 3' --exact
ab eval '(()=>{const slot=JSON.parse(localStorage.getItem("ferro.slot.2"));if(slot.name!=="QA verified factory"||JSON.stringify(slot.state.factory)!==JSON.stringify(Ferro.factory.dump()))throw Error("Named slot mismatch");return "PASS: named slot saves exact paused factory";})()'
ab find role button click --name 'Close dialog' --exact
ab wait --fn '(()=>{const a=JSON.parse(localStorage.getItem("ferro.autosave"));return a?.state.view.paused&&JSON.stringify(a.state.factory)===JSON.stringify(Ferro.factory.dump())&&JSON.stringify(a.state.view.camera)===JSON.stringify(Ferro.camera);})()'
ab reload
ab click '#resumeAutosave'
ab eval '(()=>{const a=JSON.parse(localStorage.getItem("ferro.autosave"));if(!Ferro.diagnostics().paused||JSON.stringify(a.state.factory)!==JSON.stringify(Ferro.factory.dump()))throw Error("Autosave reload did not preserve exact state");const s=JSON.parse(localStorage.getItem("ferro.slot.2"));if(s.name!=="QA verified factory")throw Error("Named slot lost after reload");return {status:"PASS: autosave and named slot persist after direct-file reload",diagnostics:Ferro.diagnostics(),camera:Ferro.camera};})()'
ab find role button click --name 'Save factory' --exact
ab --json eval 'Ferro.snapshot()' > evidence/logs/import-validation-baseline.json
python3 - <<'PY'
import json
with open('evidence/logs/import-validation-baseline.json') as f:
    state=json.load(f)['data']['result']
next(e for e in state['factory']['cells'] if e['kind']=='generator')['items']={}
with open('evidence/tests/incompatible-import.json','w') as f:
    json.dump(state,f)
PY
ab upload '#importFile' "$PWD/evidence/tests/incompatible-import.json"
ab wait --fn 'document.getElementById("importError").textContent.includes("Packet queues")'
ab eval '(()=>{const a=JSON.parse(localStorage.getItem("ferro.autosave"));if(JSON.stringify(a.state.factory)!==JSON.stringify(Ferro.factory.dump()))throw Error("Invalid import modified the live factory");return {status:"PASS: incompatible packet field rejected without replacing factory",error:document.getElementById("importError").textContent};})()'
ab screenshot evidence/screenshots/incompatible-import-error.png
ab find role button click --name 'Close dialog' --exact
ab errors
ab console
