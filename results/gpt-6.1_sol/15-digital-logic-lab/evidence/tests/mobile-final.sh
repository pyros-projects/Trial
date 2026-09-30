#!/usr/bin/env bash
set -euo pipefail
set -x
b(){ agent-browser --session dl-sol61-final "$@"; }
root=/home/pyro/projects/naked/sol61/15-digital-logic-lab
shots="$root/evidence/screenshots"
dragtitle(){ local coords;coords=$(b get box "$1" --json | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(round(d["x"]+d["width"]/2),round(d["y"]+d["height"]/2))');read -r px py <<< "$coords";b mouse move "$px" "$py";b mouse down;b mouse move "$2" "$3";b mouse up; }
b set viewport 390 844
b focus '#scene'
b press f
b find role button click --name 'Step clock tick' --exact
b find role button click --name 'Step clock tick' --exact
b eval 'if(lab.engine.output("count")!==2)throw Error("Narrow clock tick failed");lab.engine.output("count")'
b focus '[aria-label="Hold Reset"]'
b press Space
b eval 'if(lab.engine.output("rst")!==0||lab.engine.output("count")!==0)throw Error("Space momentary release failed");({rst:lab.engine.output("rst"),count:lab.engine.output("count"),focused:document.activeElement.getAttribute("aria-label")})'
coords=$(b get box '[aria-label="Hold Reset"]' --json | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"];print(round(d["x"]+d["width"]/2),round(d["y"]+d["height"]/2))')
read -r px py <<< "$coords"
b mouse move "$px" "$py"
b mouse down
b eval 'if(lab.engine.output("rst")!==1)throw Error("Pointer button did not press");lab.engine.output("rst")'
b mouse up
b eval 'if(lab.engine.output("rst")!==0)throw Error("Pointer button did not release");lab.selection'
b set viewport 1280 800
b set viewport 390 844
b eval 'if(lab.circuit.wires.length!==5||!lab.selection.includes("rst"))throw Error("Resize lost wires or selection");({wires:lab.circuit.wires.length,selection:lab.selection})'
b focus '#scene'
b press f
b click '.toolbar [data-action="palette"]'
b fill '[aria-label="Find a component"]' 'not'
b snapshot -i
b find role button click --name 'Add NOT' --exact
b click '.toolbar [data-action="inspector"]'
b fill '[aria-label="Component label"]' 'Enable mirror'
b press Tab
b eval 'if(!lab.circuit.components.some(c=>c.label==="Enable mirror"))throw Error("Mobile inspector edit failed");lab.circuit.components.length'
b find role button click --name 'Close properties' --exact
b wait '[aria-label="Enable mirror NOT"] .node-title'
dragtitle '[aria-label="Enable mirror NOT"] .node-title' 300 260
b click '[aria-label="Enable output Q (1 bit)"]'
b click '[aria-label="Enable mirror input A (1 bit)"]'
b eval --stdin <<'JS'
const n=lab.circuit.components.find(c=>c.label==='Enable mirror');if(lab.circuit.wires.length!==6||lab.engine.output(n.id)!==0)throw Error('Mobile port wiring failed');JSON.stringify({mirror:lab.engine.output(n.id),wires:lab.circuit.wires.length})
JS
b click '[aria-label="Toggle Enable"]'
b eval '(()=>{const n=lab.circuit.components.find(c=>c.label==="Enable mirror");if(lab.engine.output(n.id)!==1)throw Error("Mirror did not invert enable");return lab.engine.output(n.id)})()'
b click '.canvas-tools [data-action="undo"]'
b eval 'if(lab.engine.output("en")!==1)throw Error("Mobile Undo failed");lab.engine.output("en")'
b click '.canvas-tools [data-action="undo"]'
b eval 'if(lab.circuit.wires.length!==5)throw Error("Mobile wire Undo failed");lab.circuit.wires.length'
b click '.canvas-tools [data-action="redo"]'
b eval 'if(lab.circuit.wires.length!==6)throw Error("Mobile Redo failed");lab.circuit.wires.length'
b click '[aria-label="Enable mirror NOT"] .node-title'
b click '.toolbar [data-action="inspector"]'
b click '#inspector-content [data-action="delete"]'
b eval 'if(lab.circuit.components.length!==6||lab.circuit.wires.length!==5)throw Error("Mobile Delete failed");({components:lab.circuit.components.length,wires:lab.circuit.wires.length})'
b find role button click --name 'Close properties' --exact
b click '.canvas-tools [data-action="undo"]'
b eval 'if(lab.circuit.components.length!==7||lab.circuit.wires.length!==6)throw Error("Mobile restore failed");lab.circuit.components.length'
b find role button click --name 'Zoom in' --exact
b find role button click --name 'Zoom in' --exact
b eval 'window.__validationView=lab.view;lab.view'
b find role button click --name 'Toggle pan tool' --exact
b mouse move 170 500
b mouse down
b mouse move 210 530
b mouse up
b eval 'if(Math.abs(lab.view.x-window.__validationView.x-40)>1||Math.abs(lab.view.y-window.__validationView.y-30)>1)throw Error("Pan did not preserve pointer distance");lab.view'
b click '#minimap'
b find role button click --name 'Toggle pan tool' --exact
b find role button click --name 'Fit circuit to view' --exact
b find role button click --name 'Instrument controls' --exact
b click '#modal [data-action="settings"]'
b select '[aria-label="Clock frequency"]' '2'
b select '[aria-label="Appearance"]' 'contrast'
b click '[data-action="closemodal"]'
b find role button click --name 'Run simulation' --exact
b wait --fn 'window.lab.engine.ticks>=4'
b find role button click --name 'Pause simulation' --exact
b eval --stdin <<'JS'
if(lab.running||lab.engine.samples.at(-1).values.p1!==lab.engine.output('count'))throw Error('Narrow running waveform mismatch');if(document.documentElement.scrollWidth!==390)throw Error('Narrow overflow');JSON.stringify({viewport:{w:innerWidth,h:innerHeight},components:lab.circuit.components.length,wires:lab.circuit.wires.length,ticks:lab.engine.ticks,count:lab.engine.output('count'),sample:lab.engine.samples.at(-1),theme:lab.settings.theme})
JS
b screenshot "$shots/13-mobile-edited-counter.png"
b find role button click --name 'Instrument controls' --exact
b click '#modal [data-action="settings"]'
b select '[aria-label="Appearance"]' 'light'
b click '[data-action="closemodal"]'
b errors
b console
b network requests
