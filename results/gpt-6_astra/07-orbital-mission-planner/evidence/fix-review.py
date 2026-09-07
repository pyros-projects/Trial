from pathlib import Path
p=Path('index.html');s=p.read_text()
s=s.replace('min="0.01" max="100" step="0.1" data-cfg="G"','min="0.01" max="100" step="0.01" data-cfg="G"')
s=s.replace('min="0.001" max="1" step="0.01" data-cfg="dt"','min="0.001" max="1" step="0.001" data-cfg="dt"')
s=s.replace('min="0.001" max="2" step="0.01" data-cfg="softening"','min="0.001" max="2" step="0.001" data-cfg="softening"')
s=s.replace('rebuildBodies();refreshNodes();updateUI();updateHint();dirty()}','rebuildBodies();refreshNodes();updateEncounter();updatePredictionTelemetry();updateUI();updateHint();dirty()}')
s=s.replace("camera={x:9,y:10,scale:s.view.scale};", "camera={x:9,y:10,scale:s.view.scale*1.3};")
s=s.replace("checkpoint={state:O.clone(state),baseline:O.clone(baseline)}", "checkpoint={state:O.clone(state),baseline:O.clone(baseline),cfg:O.clone(cfg)}")
s=s.replace("state=O.clone(checkpoint.state);baseline=O.clone(checkpoint.baseline);", "state=O.clone(checkpoint.state);if(checkpoint.cfg)cfg=O.clone(checkpoint.cfg);baseline=O.clone(checkpoint.baseline);syncSettings();")
s=s.replace("lastEventCount=state.events.length;rebuildBodies();refreshNodes();schedulePrediction(true)", "lastEventCount=state.events.length;const survivor=selected();selectedId=survivor.id;primaryId=survivor.primary||survivor.id;updateFrameOptions();rebuildBodies();refreshNodes();schedulePrediction(true)")
s=s.replace("e.preventDefault();e.target.click()", "e.preventDefault();e.stopPropagation();e.target.click()")
s=s.replace("document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')", "document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.target.matches('input,select,textarea')")
s=s.replace("||document.querySelector('dialog[open]'))return;if(e.key===' ')", "||document.querySelector('dialog[open]'))return;if(e.key===' '&&e.target.closest('button,[role=button]'))return;if(e.key===' ')")
needle="throw new Error('Mission diagnostics are invalid.');};checkState(p.state);"
replacement="""throw new Error('Mission diagnostics are invalid.');for(const e of s.events){if(!e||!['burn','collision','note'].includes(e.type)||!Number.isFinite(e.time)||e.time<0||e.time>s.time+1e-8)throw new Error('Mission contains an invalid event.');if(e.type==='burn'&&(typeof e.nodeId!=='string'||!ids.has(e.craftId)||![e.dvx,e.dvy,e.dv].every(Number.isFinite)||e.dv<0))throw new Error('Mission contains an invalid burn event.');if(e.type==='collision'&&(!Array.isArray(e.ids)||e.ids.length!==2||!e.ids.every(id=>ids.has(id))||!['merge','bounce','pass'].includes(e.behavior)))throw new Error('Mission contains an invalid collision event.');if(e.type==='note'&&typeof e.message!=='string')throw new Error('Mission contains an invalid note.');}};checkState(p.state);"""
assert needle in s;s=s.replace(needle,replacement)
needle="if(p.checkpoint){checkState(p.checkpoint.state);"
replacement="if(p.checkpoint){checkState(p.checkpoint.state);if(p.checkpoint.cfg){for(const [k,[min,max]]of Object.entries(bounds))if(!Number.isFinite(p.checkpoint.cfg[k])||p.checkpoint.cfg[k]<min||p.checkpoint.cfg[k]>max)throw new Error('Checkpoint settings are invalid.');if(!Number.isInteger(p.checkpoint.cfg.resolution)||!['merge','bounce','pass'].includes(p.checkpoint.cfg.collision))throw new Error('Checkpoint settings are invalid.');}"
assert needle in s;s=s.replace(needle,replacement)
p.write_text(s)
