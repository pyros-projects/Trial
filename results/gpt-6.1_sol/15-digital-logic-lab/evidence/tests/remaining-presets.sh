#!/usr/bin/env bash
set -euo pipefail
set -x
b(){ agent-browser --session dl-sol61-final "$@"; }
load(){ b find role button click --name Examples --exact; b find role button click --name "Load $1" --exact; b wait --fn 'JSON.stringify(Array.from(document.querySelectorAll("#nodes-layer [data-node]"),n=>n.dataset.node))===JSON.stringify(lab.circuit.components.map(c=>c.id))'; }
b set viewport 1280 800
b press Escape
load 'Full adder'
b eval 'if(lab.engine.output("s")!==0||lab.engine.output("c")!==1)throw Error("Full adder initial 1+0+1");({sum:lab.engine.output("s"),carry:lab.engine.output("c")})'
b click '[aria-label="Toggle B"]'
b eval 'if(lab.engine.output("s")!==1||lab.engine.output("c")!==1)throw Error("Full adder 1+1+1");lab.engine.samples.at(-1)'
b click '[data-instrument="truth"]'
b click '[data-action="truth"]'
b click '[data-action="generatetruth"]'
b eval --stdin <<'JS'
(()=>{const t=lab.truthTable;if(t.rows.length!==8)throw Error('Full table row count');for(const r of t.rows){const v=r.inputs.reduce((a,b)=>a+b,0);if(r.outputs[0]!==v%2||r.outputs[1]!==+(v>1))throw Error('Full table mismatch')}return JSON.stringify(t.rows)})()
JS
b click '[data-instrument="wave"]'
load Multiplexer
b click '[aria-label="Toggle Select"]'
b eval 'if(lab.engine.output("o")!==10||lab.engine.samples.at(-1).values.p1!==10)throw Error("Mux B");lab.engine.output("o")'
b click '[aria-label="Toggle Select"]'
b eval 'if(lab.engine.output("o")!==5)throw Error("Mux A");lab.engine.output("o")'
load 'SR latch'
b eval 'if(lab.engine.output("q")!==0||lab.engine.output("nq")!==1)throw Error("Latch reset");({q:lab.engine.output("q"),nq:lab.engine.output("nq")})'
b click '[aria-label="Toggle Reset R"]'
b click '[aria-label="Toggle Set S"]'
b eval 'if(lab.engine.output("q")!==1||lab.engine.output("nq")!==0)throw Error("Latch set");lab.engine.samples.at(-1)'
b click '[aria-label="Toggle Set S"]'
b eval 'if(lab.engine.output("q")!==1)throw Error("Latch hold");lab.engine.output("q")'
b click '[aria-label="Toggle Reset R"]'
b eval 'if(lab.engine.output("q")!==0||lab.engine.pendingCount)throw Error("Latch reset/settle");({q:lab.engine.output("q"),warnings:lab.engine.warnings})'
load 'Edge-triggered register'
b find role button click --name 'Step clock tick' --exact
b click '[aria-label="Advance Data D"]'
b eval 'if(lab.engine.output("data")!==6||lab.engine.output("reg")!==5)throw Error("Register held between ticks");({d:lab.engine.output("data"),q:lab.engine.output("reg")})'
b find role button click --name 'Step clock tick' --exact
b click '[aria-label="Toggle Enable"]'
b click '[aria-label="Advance Data D"]'
b find role button click --name 'Step clock tick' --exact
b eval 'if(lab.engine.output("reg")!==6||lab.engine.samples.at(-1).values.p2!==6)throw Error("Register disabled hold");lab.engine.samples.at(-1)'
b focus '[aria-label="Hold Reset"]'
b press Enter
b eval 'if(lab.engine.output("reg")!==0||lab.engine.output("rst")!==0)throw Error("Register asynchronous reset/release");({q:lab.engine.output("reg"),rst:lab.engine.output("rst")})'
load 'Small ALU'
b eval 'if(lab.engine.output("o")!==8)throw Error("ALU add");lab.engine.output("o")'
b click '[aria-label="Advance Operation"]'
b eval 'if(lab.engine.output("o")!==1)throw Error("ALU AND");lab.engine.output("o")'
b click '[aria-label="Advance Operation"]'
b eval 'if(lab.engine.output("o")!==6)throw Error("ALU XOR");lab.engine.output("o")'
b click '[aria-label="Advance Operation"]'
b eval 'if(lab.engine.output("o")!==5)throw Error("ALU pass B");lab.engine.output("o")'
load 'Memory test'
b eval 'if(lab.engine.output("o")!==0)throw Error("RAM initial");lab.engine.output("o")'
b find role button click --name 'Step clock tick' --exact
b eval 'if(lab.engine.output("o")!==9||lab.engine.samples.at(-1).values.p2!==9)throw Error("RAM write");lab.engine.samples.at(-1)'
b click '[aria-label="Toggle Write enable"]'
b click '[aria-label="Advance Address"]'
b eval 'if(lab.engine.output("o")!==0)throw Error("RAM async other address");lab.engine.output("o")'
b click '[data-node="addr"] .node-title'
b fill '[aria-label="Input value"]' 0
b press Tab
b click '[aria-label="Advance Write data"]'
b find role button click --name 'Step clock tick' --exact
b eval 'if(lab.engine.output("data")!==10||lab.engine.output("o")!==9)throw Error("RAM disabled write/retained word");({data:lab.engine.output("data"),read:lab.engine.output("o"),memory:lab.engine.values.get("ram").memory})'
b find role button click --name 'Reset simulation' --exact
b eval 'if(lab.engine.output("o")!==0||lab.engine.ticks)throw Error("RAM deterministic reset");lab.engine.output("o")'
b click '[data-node="ram"] .node-title'
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
for i in $(seq 1 25); do pending=$(b eval 'lab.engine.pendingCount'); if [ "$pending" = 0 ]; then break; fi; b find role button click --name 'Step propagation event' --exact; done
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
