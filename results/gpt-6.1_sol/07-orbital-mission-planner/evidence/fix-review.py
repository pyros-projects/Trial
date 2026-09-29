from pathlib import Path
import re
p=Path('index.html');s=p.read_text()
# Pairwise contact caps must use geometric separation, independent of softening.
s=s.replace("const r=Math.hypot(bs[i].x-bs[j].x,bs[i].y-bs[j].y,c.softening||0),v=", "const geometric=Math.hypot(bs[i].x-bs[j].x,bs[i].y-bs[j].y),r=Math.hypot(geometric,c.softening||0),v=")
s=s.replace("c.tolerance*r/Math.max(v,1e-12)","c.tolerance*geometric/Math.max(v,1e-12)").replace("return Math.max(h,1e-6);","return Math.max(h,1e-9);")
# Merges maintain the graph and cancel maneuvers belonging to absorbed bodies.
s=s.replace('function collision(bs,c,time){','function collision(bs,c,time,nodes=[]){')
s=s.replace("for(const child of bs)if(child.primaryId===other.id)child.primaryId=keep.id;", "for(const child of bs){if(child.primaryId===other.id)child.primaryId=keep.id;if(child.primaryId===child.id)delete child.primaryId;}const canceledNodeIds=[];for(let k=nodes.length-1;k>=0;k--){if(nodes[k].bodyId===other.id){canceledNodeIds.push(nodes[k].id);nodes.splice(k,1);}else if(nodes[k].primaryId===other.id){nodes[k].primaryId=nodes[k].bodyId===keep.id?undefined:keep.id;}}")
s=s.replace("return{type:'merge',time,ids:names,deltaEnergy:","return{type:'merge',time,ids:names,survivorId:keep.id,removedId:other.id,canceledNodeIds,deltaEnergy:")
s=s.replace('const col=collision(bs,c,t);','const col=collision(bs,c,t,nodes);',1)
s=s.replace("const col=collision(bs,c,t);if(col){events.push(col);halted=!!col.halted;}","const col=halted?null:collision(bs,c,t,nodes);if(col){events.push(col);halted=!!col.halted;}")
# The module keeps import validation independent of DOM/UI behavior.
a=s.index('function boundedNumber(');z=s.index('function applyMission(',a);validation=s[a:z]
validation=validation.replace('function validateMission(raw)','function validate(raw)')
validation=validation.replace("!ids.has(n.bodyId)||!ids.has(n.primaryId)","!ids.has(n.bodyId)||(n.primaryId!=null&&n.primaryId!==''&&!ids.has(n.primaryId))")
validation=validation.replace("primaryId:n.primaryId,time:","primaryId:n.primaryId||undefined,time:")
validation=validation.replace("executed:!!n.executed};", "executed:!!n.executed,resolvedDV:typeof n.resolvedDV==='number'&&Number.isFinite(n.resolvedDV)?Math.max(0,Math.min(2000,n.resolvedDV)):undefined};")
consts='\n'.join(re.search(r'const '+name+r'=.*?;\n',s).group(0).strip() for name in ['palette','defaultConfig','scenarioNames'])
mission='<script id="mission-core">\nconst Mission=(()=>{\n'+consts+'\n'+validation+"function uniqueId(prefix,items){let n=1;while(items.some(i=>i.id===prefix+'-'+n))n++;return prefix+'-'+n;}\nreturn{defaultConfig,palette,scenarioNames,boundedNumber,validate,uniqueId};\n})();\n</script>\n"
s=s[:a]+"function boundedNumber(...args){return Mission.boundedNumber(...args);}\nfunction validateMission(raw){return Mission.validate(raw);}\n"+s[z:]
s=s.replace('<script id="application">',mission+'<script id="application">')
s=s.replace("const node={id:'node-'+(++uid),bodyId:b.id", "const node={id:Mission.uniqueId('node',S.nodes),bodyId:b.id")
# Continuous editing of a capped velocity handle uses displacement from the saved velocity.
s=s.replace("frame:currentFrame(),moved:false};return;}let hit", "frame:currentFrame(),initialVelocity:{x:selected().vx,y:selected().vy},moved:false};return;}let hit")
old="const origin=screen(b,drag.frame),vx=(q.x-origin.x)/(S.camera.scale*S.config.vectorScale),vy=-(q.y-origin.y)/(S.camera.scale*S.config.vectorScale),f=drag.frame,c=Math.cos(f.angle),s=Math.sin(f.angle),dx=b.x-f.x,dy=b.y-f.y;b.vx=f.vx+c*vx-s*vy-f.omega*dy;b.vy=f.vy+s*vx+c*vy+f.omega*dx;"
new="const vx=(q.x-drag.start.x)/(S.camera.scale*S.config.vectorScale),vy=-(q.y-drag.start.y)/(S.camera.scale*S.config.vectorScale),f=drag.frame,c=Math.cos(f.angle),s=Math.sin(f.angle);b.vx=drag.initialVelocity.x+c*vx-s*vy;b.vy=drag.initialVelocity.y+s*vx+c*vy;"
assert old in s;s=s.replace(old,new)
# Checkpoint history belongs to the trusted captured state.
s=s.replace("applyMission(cp);record('Checkpoint restored'", "applyMission(cp);if(Array.isArray(cp.history)&&cp.history.length)S.history=P.clone(cp.history);record('Checkpoint restored'")
# Orbital primary edits follow through to future nodes for this spacecraft.
s=s.replace("Object.assign(b,values);b.color=palette[b.kind];", "const oldPrimary=b.primaryId;Object.assign(b,values);for(const n of S.nodes)if(!n.executed&&n.bodyId===b.id&&n.primaryId===oldPrimary)n.primaryId=b.primaryId;b.color=palette[b.kind];")
# Magnitudes use burn-time vector sums, including nonorthogonal prograde and radial vectors.
insert="""function nodeDV(n){if(n.executed&&Number.isFinite(n.resolvedDV))return n.resolvedDV;const event=S.predictions[n.bodyId]?.planned.events.find(e=>e.nodeId===n.id);if(event)return event.dv;if(n.mode==='cartesian')return Math.hypot(n.a,n.b);const body=S.bodies.find(b=>b.id===n.bodyId);if(!body)return Math.hypot(n.a,n.b);const p=S.bodies.find(b=>b.id===n.primaryId),vx=body.vx-(p?.vx||0),vy=body.vy-(p?.vy||0),x=body.x-(p?.x||0),y=body.y-(p?.y||0),cos=(x*vx+y*vy)/Math.max(Math.hypot(x,y)*Math.hypot(vx,vy),1e-12);return Math.sqrt(Math.max(0,n.a*n.a+n.b*n.b+2*n.a*n.b*cos));}\n"""
s=s.replace('function renderNodes(){',insert+'function renderNodes(){')
s=s.replace('Math.hypot(n.a,n.b)','nodeDV(n)')
# Keep fallback calculations inside the magnitude helper from recursing.
s=s.replace("if(n.mode==='cartesian')return nodeDV(n);", "if(n.mode==='cartesian')return Math.hypot(n.a,n.b);")
s=s.replace("if(!body)return nodeDV(n);", "if(!body)return Math.hypot(n.a,n.b);")
s=s.replace("S.expectedEnergy+=e.deltaEnergy;S.expectedPx+=e.deltaPx;S.expectedPy+=e.deltaPy;const b=S.bodies.find", "S.expectedEnergy+=e.deltaEnergy;S.expectedPx+=e.deltaPx;S.expectedPy+=e.deltaPy;const executedNode=S.nodes.find(n=>n.id===e.nodeId);if(executedNode)executedNode.resolvedDV=e.dv;const b=S.bodies.find")
s=s.replace("e.ids.join(' + '),e.time);", "e.ids.join(' + ')+(e.canceledNodeIds.length?' · '+e.canceledNodeIds.length+' maneuvers canceled':''),e.time);")
p.write_text(s)
