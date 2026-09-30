#!/usr/bin/env bash
set -uo pipefail
set -x
b(){ agent-browser --session dl-sol61 "$@"; }
root=/home/pyro/projects/naked/sol61/15-digital-logic-lab
b set viewport 1280 800
b find role button click --name 'Reset simulation' --exact
b find role button click --name 'Settings' --exact
b select '[aria-label="Propagation delay model"]' 'transport'
b click '[data-action="closemodal"]'
b find role button click --name 'Instrument controls' --exact
b uncheck '#recording'
b click '#modal [data-action="closemodal"]'
b find role button click --name 'Add NOT' --exact
b wait '[aria-label="NOT output Q (1 bit)"]'
b eval 'window.__captureBefore=lab.engine.samples.length;lab.engine.samples.length'
b click '[aria-label="Toggle Enable"]'
b eval 'if(lab.engine.samples.length!==window.__captureBefore)throw Error("Paused capture resumed after rebuild: "+window.__captureBefore+"→"+lab.engine.samples.length);lab.engine.samples.length'
b find role button click --name 'Instrument controls' --exact
b check '#recording'
b click '#modal [data-action="closemodal"]'
b find role button click --name 'Settings' --exact
b select '[aria-label="Propagation delay model"]' 'inertial'
b click '[data-action="closemodal"]'
b find role button click --name 'Examples' --exact
b find role button click --name 'Load Half adder' --exact
b find role button click --name 'Fit circuit to view' --exact
b click '[data-instrument="truth"]'
b click '[data-action="truth"]'
b click '[data-action="generatetruth"]'
b click '[aria-label="Wire Sum logic Q to SUM A"] .wire-hit'
b press Delete
b eval 'if(lab.truthTable!==null||document.querySelector(".truth-table"))throw Error("Invalidated truth table still visible");document.querySelector(".truth-body").innerText'
b screenshot "$root/evidence/screenshots/14-stale-truth-red.png"
b click '[data-node="a"] .node-title'
b click '[aria-label="Input A output Q (1 bit)"]'
b press Delete
b wait '[aria-label="Sum logic input A (1 bit)"]'
b click '[aria-label="Sum logic input A (1 bit)"]'
b errors
b console
