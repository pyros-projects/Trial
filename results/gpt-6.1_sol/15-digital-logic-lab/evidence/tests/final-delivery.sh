#!/usr/bin/env bash
set -euo pipefail
set -x
b(){ agent-browser --session dl-sol61-final "$@"; }
root=/home/pyro/projects/naked/sol61/15-digital-logic-lab
load(){ b find role button click --name Examples --exact; b find role button click --name "Load $1" --exact; b wait --fn 'JSON.stringify(Array.from(document.querySelectorAll("#nodes-layer [data-node]"),n=>n.dataset.node))===JSON.stringify(lab.circuit.components.map(c=>c.id))'; }
b press Escape
b set viewport 1280 800
load Multiplexer
b click '[aria-label="Advance Bus A"]'
b find role button click --name 'Export circuit' --exact
b click '[data-export="share"]'
link=$(b eval 'document.querySelector("#share-link").value' --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["result"])')
printf '%s\n' "$link" > "$root/evidence/exports/mux-share-link.txt"
b press Escape
load 'Half adder'
b open about:blank
b open "$link"
b wait '[aria-label="Advance Bus A"]'
b eval 'if(lab.circuit.name!=="Multiplexer"||lab.circuit.components.length!==5||lab.circuit.wires.length!==4||lab.engine.output("o")!==6)throw Error("Share navigation round trip");({name:lab.circuit.name,components:lab.circuit.components.length,wires:lab.circuit.wires.length,output:lab.engine.output("o"),hashLength:location.hash.length})'
b open "file://$root/index.html"
load 'Tiny 4-bit CPU'
for i in $(seq 1 4); do b find role button click --name 'Step clock tick' --exact; done
b eval 'if(lab.engine.output("display")!==2||lab.engine.samples.at(-1).values.p4!==2)throw Error("CPU final export state");lab.engine.samples.at(-1)'
b find role button click --name 'Zoom out' --exact
b find role button click --name 'Zoom out' --exact
b find role button click --name 'Zoom out' --exact
b find role button click --name 'Zoom out' --exact
b eval '({cameraZoom:lab.view.z,overview:document.querySelector("#world").classList.contains("overview")})'
b find role button click --name 'Export circuit' --exact
b download '[data-export="svg"]' "$root/evidence/exports/final-cpu.svg"
b download '[data-export="png"]' "$root/evidence/exports/final-cpu.png"
b press Escape
load 'Half adder'
b click '[data-inspector="properties"]'
b click '[data-instrument="wave"]'
b find role button click --name 'Fit circuit to view' --exact
b screenshot "$root/evidence/screenshots/19-final-desktop.png"
b eval 'if(lab.engine.output("s")!==1||lab.engine.output("c")!==0||lab.engine.pendingCount||document.documentElement.scrollWidth>1280)throw Error("Default desktop");({name:lab.circuit.name,a:lab.engine.output("a"),b:lab.engine.output("b"),sum:lab.engine.output("s"),carry:lab.engine.output("c"),components:lab.circuit.components.length,wires:lab.circuit.wires.length})'
b set viewport 390 844
b find role button click --name 'Fit circuit to view' --exact
b click '[aria-label="Toggle Input B"]'
b eval 'if(lab.engine.output("s")!==0||lab.engine.output("c")!==1||document.documentElement.scrollWidth>390)throw Error("Final mobile interaction");({sum:lab.engine.output("s"),carry:lab.engine.output("c"),sample:lab.engine.samples.at(-1)})'
b click '[aria-label="Toggle Input B"]'
b screenshot "$root/evidence/screenshots/20-final-mobile.png"
b set viewport 1280 800
b find role button click --name 'Fit circuit to view' --exact
b focus '[data-action="save"]'
b press Enter
b wait '#save-name'
b eval 'if(!document.querySelector("#save-name"))throw Error("Native button keyboard regression");document.querySelector("#modal h2").textContent'
b press Escape
b errors --json
b console
b network requests
