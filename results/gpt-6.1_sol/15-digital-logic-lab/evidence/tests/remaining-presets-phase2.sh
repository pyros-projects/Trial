#!/usr/bin/env bash
set -euo pipefail
set -x
b(){ agent-browser --session dl-sol61-final "$@"; }
load(){ b find role button click --name Examples --exact; b find role button click --name "Load $1" --exact; b wait --fn 'JSON.stringify(Array.from(document.querySelectorAll("#nodes-layer [data-node]"),n=>n.dataset.node))===JSON.stringify(lab.circuit.components.map(c=>c.id))'; }
b scroll down 400 --selector '.inspector'
b click '[data-action="memory"]'
b fill '[aria-label="Memory words"]' '99'
b click '[data-action="applymemory"]'
b eval 'if(!document.getElementById("memory-error").innerText.includes("16"))throw Error("Memory validation");document.getElementById("memory-error").innerText'
b fill '[aria-label="Memory words"]' '0xB 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0'
b click '[data-action="applymemory"]'
b eval 'if(lab.engine.output("o")!==11)throw Error("Memory edited words");({read:lab.engine.output("o"),word0:lab.circuit.components.find(c=>c.id==="ram").memory[0]})'
load 'Half adder'
b find role button click --name Settings --exact
b select '[aria-label="Propagation delay model"]' manual
b click '[data-action="closemodal"]'
b click '[aria-label="Toggle Input A"]'
b eval 'if(!lab.engine.pendingCount||lab.engine.output("s")!==1)throw Error("Manual queue did not hold events");({pending:lab.engine.pendingCount,sum:lab.engine.output("s")})'
for i in $(seq 1 6); do b find role button click --name 'Step propagation event' --exact; done
b eval 'if(lab.engine.pendingCount||lab.engine.output("s")!==0)throw Error("Event steps failed to settle");({pending:lab.engine.pendingCount,sum:lab.engine.output("s"),sample:lab.engine.samples.at(-1)})'
b find role button click --name Settings --exact
b select '[aria-label="Propagation delay model"]' inertial
b select '[aria-label="Wire routing"]' orthogonal
b select '[aria-label="Value radix"]' hex
b select '[aria-label="Appearance"]' dark
b click '[data-action="closemodal"]'
b click '[aria-label="Toggle Input A"]'
b eval 'if(lab.engine.output("s")!==1||!document.body.classList.contains("dark")||lab.settings.wire!=="orthogonal")throw Error("Settings update");({settings:lab.settings,sumLabel:document.querySelector("[data-node=s] .value-text").textContent})'
b click '[data-inspector="diagnostics"]'
b scroll down 600 --selector '.inspector'
b select '#overlay-select' order
b wait --fn '!!document.querySelector(".node-note")'
b eval 'if(!document.querySelector(".node-note"))throw Error("Order overlay");document.querySelector("#inspector-content").innerText'
b select '#overlay-select' fanout
b eval 'document.querySelector("#inspector-content").innerText'
b find role button click --name Settings --exact
b select '[aria-label="Wire routing"]' curve
b select '[aria-label="Value radix"]' bin
b select '[aria-label="Appearance"]' light
b click '[data-action="closemodal"]'
b select '#overlay-select' none
b errors --json
b console
