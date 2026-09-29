"""T11b: isolated belt physics — a back-fed Mk1 line into a hub (free-flow throughput),
then with the hub removed (jam packing per tile) for densities 2/3/4.
Uses the page's own simulation functions on a scratch world (diagnostic, not UI)."""
import os, json
from ab import ab, ev
ab("open", "file://" + os.path.abspath("index.html")); ab("wait", 600)
r = ev("""(()=>{const out={};
for(const d of [2,3,4]){SET.density=d;applyDensity();W=newWorld(30,10);resetStats();topoDirty=true;
 const B=builder();const line=B.belt(2,5,0,10);B.put('hub',12,5,0);rebuildTopo();
 const feed=()=>{const b=line[0];if(canAccept(b,IT.iron_ore,2))offer(b,IT.iron_ore,2,0)};
 for(let i=0;i<600;i++){feed();simTick()}const t0=W.delivered[IT.iron_ore];for(let i=0;i<600;i++){feed();simTick()}
 const flow=(W.delivered[IT.iron_ore]-t0)/10;removeStruct(structAt(12,5));for(let i=0;i<1200;i++){feed();simTick()}
 out['density'+d]={capacity_theory_per_s:1.5*d,free_flow_per_s:flow,jam_items_per_tile:line.map(b=>b.items.length).join(','),tile3_positions:line[3].items.map(i=>+i.p.toFixed(3))}}
SET.density=3;applyDensity();startWorld('sandbox','starter',true);return out})()""")
print(json.dumps(r, indent=1))
open("evidence/logs/t11b.log", "w").write(json.dumps(r, indent=1))
