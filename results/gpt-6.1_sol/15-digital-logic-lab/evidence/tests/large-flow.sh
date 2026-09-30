#!/usr/bin/env bash
set -euo pipefail
set -x
b(){ agent-browser --session dl-sol61-final "$@"; }
root=/home/pyro/projects/naked/sol61/15-digital-logic-lab
b set viewport 1280 800
b find role button click --name 'Export circuit' --exact
b click '#modal [data-action="import"]'
b upload '[aria-label="Import circuit file"]' "$root/evidence/fixtures/large-circuit.json"
b wait --fn 'document.getElementById("import-text").value.includes("510 components")'
b click '[data-action="importjson"]'
b wait '[data-node="src0"] .node-body'
b eval 'if(lab.circuit.components.length!==510||lab.circuit.wires.length!==500||lab.engine.output("out0")!==1||lab.engine.pendingCount)throw Error("Large circuit import/settling failed");window.__largeEvents=lab.engine.events;({components:lab.circuit.components.length,wires:lab.circuit.wires.length,iterations:lab.engine.iterations,evaluations:lab.engine.events,view:lab.view})'
b screenshot "$root/evidence/screenshots/17-large-overview.png"
coords=$(b get box '[data-node="src0"] .node-body' --json | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(round(d["x"]+d["width"]/2),round(d["y"]+d["height"]/2))')
read -r px py <<< "$coords"
b mouse move "$px" "$py"
node evidence/tests/browser-wheel.cjs "$px" "$py" -1200
b wait '[aria-label="Toggle Source 0"]'
b click '[aria-label="Toggle Source 0"]'
b eval --stdin <<'JS'
(()=>{const delta=lab.engine.events-window.__largeEvents;if(lab.engine.output('src0')!==0||lab.engine.output('out0')!==0||lab.engine.samples.at(-1).values.p0!==0||lab.engine.pendingCount)throw Error('Large live propagation failed');if(delta>150)throw Error('Unrelated circuit was reevaluated');return JSON.stringify({evaluationsForSourceChange:delta,output:lab.engine.output('out0'),sample:lab.engine.samples.at(-1),pending:lab.engine.pendingCount,counts:{components:lab.circuit.components.length,wires:lab.circuit.wires.length},fps:document.getElementById('footer-fps').innerText})})()
JS
b screenshot "$root/evidence/screenshots/18-large-edited.png"
b errors --json
b console
