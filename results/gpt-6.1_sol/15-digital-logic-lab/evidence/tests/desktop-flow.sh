#!/usr/bin/env bash
set -euo pipefail
set -x
b(){ agent-browser --session dl-sol61 "$@"; }
shots=/home/pyro/projects/naked/sol61/15-digital-logic-lab/evidence/screenshots
b click '[aria-label="Toggle Input B"]'
b eval --stdin <<'JS'
if(lab.engine.output('s')!==0||lab.engine.output('c')!==1)throw Error('Wrong half adder output for 11');const s=lab.engine.samples.at(-1);if(s.values.p2!==0||s.values.p3!==1)throw Error('Waveforms disagree');JSON.stringify({inputA:1,inputB:1,sum:lab.engine.output('s'),carry:lab.engine.output('c'),lastSample:s})
JS
b screenshot "$shots/02-half-adder-11.png"
b click '[aria-label="Wire Sum logic Q to SUM A"] .wire-hit'
b press Delete
b eval --stdin <<'JS'
if(lab.circuit.wires.length!==5||lab.engine.input('s','A')!=='Z')throw Error('Wire deletion did not change connectivity');JSON.stringify({wires:lab.circuit.wires.length,disconnectedOutput:lab.engine.output('s')})
JS
b snapshot -i
b click '[aria-label="Sum logic output Q (1 bit)"]'
b click '[aria-label="SUM input A (1 bit)"]'
b eval --stdin <<'JS'
if(lab.circuit.wires.length!==6||lab.engine.output('s')!==0)throw Error('Interactive wiring failed');JSON.stringify(lab.circuit.wires.at(-1))
JS
b click '[aria-label="Toggle Input A"]'
b eval --stdin <<'JS'
if(lab.engine.output('s')!==1||lab.engine.output('c')!==0)throw Error('New wire did not propagate input 01');JSON.stringify({sum:lab.engine.output('s'),carry:lab.engine.output('c'),lastSample:lab.engine.samples.at(-1)})
JS
b press Control+z
b press Control+z
b eval 'if(lab.circuit.wires.length!==5)throw Error("Undo topology failed");lab.circuit.wires.length'
b press Control+Shift+z
b press Control+Shift+z
b eval 'if(lab.circuit.wires.length!==6||lab.engine.output("s")!==1)throw Error("Redo failed");lab.circuit.wires.length'
b click '[data-node="sum"] .node-title'
b press Control+d
b eval 'if(lab.circuit.components.length!==7)throw Error("Duplicate failed");lab.selection'
b press Control+z
b focus '#scene'
b press Control+a
b eval 'if(lab.selection.length!==6)throw Error("Multi-select failed");lab.selection'
b press Control+c
b press Control+v
b eval 'if(lab.circuit.components.length!==12||lab.circuit.wires.length!==12)throw Error("Copy/paste topology failed");({components:lab.circuit.components.length,wires:lab.circuit.wires.length})'
b press Control+z
b click '[data-node="sum"] .node-title'
b press Delete
b eval 'if(lab.circuit.components.length!==5||lab.circuit.wires.length!==3)throw Error("Delete selection failed");({components:lab.circuit.components.length,wires:lab.circuit.wires.length})'
b press Control+z
b click '[data-instrument="truth"]'
b click '[data-action="truth"]'
b snapshot -i
b click '[data-action="generatetruth"]'
b eval --stdin <<'JS'
const rows=lab.truthTable.rows;if(JSON.stringify(rows.map(r=>r.outputs))!=='[[0,0],[1,0],[1,0],[0,1]]')throw Error('Incorrect truth table');JSON.stringify({rows:rows,liveA:lab.engine.output('a'),liveB:lab.engine.output('b'),expressions:document.querySelector('.truth-body').innerText})
JS
b screenshot "$shots/03-truth-table.png"
b click '[data-instrument="wave"]'
b find role button click --name 'Examples' --exact
b snapshot -i
b find role button click --name 'Load Binary counter' --exact
b find role button click --name 'Step clock tick' --exact
b find role button click --name 'Step clock tick' --exact
b eval --stdin <<'JS'
if(lab.engine.ticks!==2||lab.engine.output('count')!==2||lab.engine.samples.at(-1).values.p1!==2)throw Error('Counter/waveform mismatch');JSON.stringify({tick:lab.engine.ticks,count:lab.engine.output('count'),samples:lab.engine.samples})
JS
b select '#speed' '4'
b find role button click --name 'Run simulation' --exact
b wait --fn 'window.lab.engine.ticks>=8'
b find role button click --name 'Pause simulation' --exact
b eval --stdin <<'JS'
if(lab.running||lab.engine.samples.at(-1).values.p1!==lab.engine.output('count'))throw Error('Pause or counter capture failed');JSON.stringify({tick:lab.engine.ticks,count:lab.engine.output('count'),samples:lab.engine.samples.length,running:lab.running})
JS
b screenshot "$shots/04-counter-waveforms.png"
b find role button click --name 'Reset simulation' --exact
b eval 'if(lab.engine.ticks!==0||lab.engine.output("count")!==0)throw Error("Reset failed");({tick:lab.engine.ticks,count:lab.engine.output("count")})'
b find role button click --name 'Examples' --exact
b find role button click --name 'Load Tiny 4-bit CPU' --exact
b find role button click --name 'Step clock tick' --exact
b eval 'if(lab.engine.output("acc")!==1||lab.engine.output("pc")!==1)throw Error("CPU LDI failed");({pc:lab.engine.output("pc"),acc:lab.engine.output("acc")})'
b find role button click --name 'Step clock tick' --exact
b eval 'if(lab.engine.output("outreg")!==1)throw Error("CPU OUT failed");lab.engine.output("outreg")'
b find role button click --name 'Step clock tick' --exact
b find role button click --name 'Step clock tick' --exact
b eval --stdin <<'JS'
if(lab.engine.output('outreg')!==2||lab.engine.samples.at(-1).values.p4!==2)throw Error('CPU ADD/OUT capture failed');JSON.stringify({tick:lab.engine.ticks,pc:lab.engine.output('pc'),acc:lab.engine.output('acc'),output:lab.engine.output('outreg'),lastSample:lab.engine.samples.at(-1),warnings:lab.engine.warnings})
JS
b click '[data-inspector="diagnostics"]'
b screenshot "$shots/05-cpu-execution.png"
b errors
b console
b network requests
