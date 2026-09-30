#!/usr/bin/env bash
set -euo pipefail
set -x
b(){ agent-browser --session dl-sol61 "$@"; }
root=/home/pyro/projects/naked/sol61/15-digital-logic-lab
shots="$root/evidence/screenshots"
mkdir -p "$root/evidence/exports"
dragtitle(){ local coords; coords=$(b get box "$1" --json | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(round(d["x"]+d["width"]/2),round(d["y"]+d["height"]/2))'); read -r px py <<< "$coords";b mouse move "$px" "$py";b mouse down;b mouse move "$2" "$3";b mouse up; }
b wait '[aria-label="NOT output Q (1 bit)"]'
dragtitle '[aria-label="NOT NOT"] .node-title' 650 280
b click '[aria-label="NOT output Q (1 bit)"]'
b click '[aria-label="NOT input A (1 bit)"]'
b eval --stdin <<'JS'
if(lab.circuit.wires.length!==1||!lab.engine.warnings.some(w=>/feedback/i.test(w))||lab.engine.pendingCount!==0)throw Error('Feedback was not contained');JSON.stringify({warnings:lab.engine.warnings,signal:lab.engine.output(lab.circuit.components[0].id),loops:lab.engine.loops})
JS
b screenshot "$shots/07-unresolved-feedback.png"
b find role button click --name 'Add Switch' --exact
b wait '[aria-label="Toggle Switch"]'
b select '[aria-label="Component bit width"]' '4'
b wait '[aria-label="Switch output Q (4 bit)"]'
dragtitle '[aria-label="Switch Switch"] .node-title' 390 300
b click '[aria-label="Switch output Q (4 bit)"]'
b click '[aria-label="NOT input A (1 bit)"]'
b eval 'if(lab.circuit.wires.length!==1)throw Error("Invalid width was accepted");document.getElementById("toast").innerText'
b screenshot "$shots/08-invalid-width.png"
b find role button click --name 'Add Output / LED' --exact
b select '[aria-label="Component bit width"]' '4'
b wait '[aria-label="Output / LED input A (4 bit)"]'
dragtitle '[aria-label="Output / LED Output / LED"] .node-title' 840 385
b click '[aria-label="Switch output Q (4 bit)"]'
b click '[aria-label="Output / LED input A (4 bit)"]'
b click '[aria-label="Advance Switch"]'
b eval --stdin <<'JS'
const sw=lab.circuit.components.find(c=>c.type==='SWITCH'),out=lab.circuit.components.find(c=>c.type==='LED');if(lab.engine.output(sw.id)!==1||lab.engine.output(out.id)!==1)throw Error('Constructed bus did not simulate');JSON.stringify({switch:lab.engine.output(sw.id),output:lab.engine.output(out.id),wires:lab.circuit.wires.length,positions:lab.circuit.components.map(c=>({id:c.id,x:c.x,y:c.y}))})
JS
b click '[aria-label="Output / LED Output / LED"] .node-title'
b click '#inspector-content [data-probe-dir="out"]'
b fill '[aria-label="Probe name"]' 'BUS OUT'
b click '[data-action="attachprobe"]'
b click '[aria-label="Advance Switch"]'
b eval --stdin <<'JS'
const p=lab.circuit.probes.at(-1);if(p.name!=='BUS OUT'||lab.engine.samples.at(-1).values[p.id]!==2)throw Error('Named probe failed');JSON.stringify({probe:p,sample:lab.engine.samples.at(-1)})
JS
b find role button click --name 'Save project' --exact
b fill '[aria-label="Project name"]' 'Bus experiment'
b click '#project-form button[type="submit"]'
b eval 'if(!Object.values(JSON.parse(localStorage.getItem("logiclab.projects"))).some(p=>p.circuit.name==="Bus experiment"))throw Error("Save failed");document.querySelector("#project-list").innerText'
b press Escape
b find role button click --name 'Examples' --exact
b find role button click --name 'Load Half adder' --exact
b find role button click --name 'Save project' --exact
b click '[data-load-project]'
b eval 'if(lab.circuit.name!=="Bus experiment"||lab.circuit.components.length!==3||lab.circuit.wires.length!==2)throw Error("Project load failed");({name:lab.circuit.name,components:lab.circuit.components.length,wires:lab.circuit.wires.length})'
b reload
b eval 'if(lab.circuit.name!=="Bus experiment"||lab.circuit.probes[0].name!=="BUS OUT")throw Error("Autosave did not survive reload");lab.circuit.name'
b find role button click --name 'Export circuit' --exact
b download '[data-export="json"]' "$root/evidence/exports/bus-experiment.json"
b download '[data-export="svg"]' "$root/evidence/exports/bus-experiment.svg"
b download '[data-export="png"]' "$root/evidence/exports/bus-experiment.png"
b download '[data-export="csv"]' "$root/evidence/exports/bus-waveforms.csv"
b download '[data-export="vcd"]' "$root/evidence/exports/bus-waveforms.vcd"
b click '[data-action="import"]'
b fill '[aria-label="Circuit JSON"]' '{"version":1,"name":"bad","components":[{"id":"x","type":"RUN_CODE","bits":1,"x":0,"y":0}],"wires":[]}'
b click '[data-action="importjson"]'
b eval 'if(lab.circuit.name!=="Bus experiment")throw Error("Bad import corrupted live circuit");document.getElementById("import-error").innerText'
b screenshot "$shots/09-invalid-import.png"
b upload '[aria-label="Import circuit file"]' "$root/evidence/exports/bus-experiment.json"
b wait --fn 'document.getElementById("import-text").value.includes("Bus experiment")'
b click '[data-action="importjson"]'
b eval 'if(lab.circuit.wires.length!==2||lab.circuit.probes[0].name!=="BUS OUT")throw Error("JSON round trip failed");({name:lab.circuit.name,wires:lab.circuit.wires.length,probes:lab.circuit.probes.length})'
b find role button click --name 'Export circuit' --exact
b click '[data-export="share"]'
b eval --stdin <<'JS'
const link=document.getElementById('share-link').value;const raw=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(link.split('#c=')[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));if(raw.wires.length!==2||raw.name!=='Bus experiment')throw Error('Share encoding failed');JSON.stringify({urlLength:link.length,decodedName:raw.name,wireCount:raw.wires.length})
JS
b press Escape
b errors
b console
b network requests
