"""T13: contracts 2 and 3 are solvable within budget — a straightforward layout is placed through the
same planning/cost code the tools use (commitBuild), then simulated to completion (diagnostic run)."""
import os, json
from ab import ab, ev
ab("open", "file://" + os.path.abspath("index.html")); ab("wait", 600)
js = r"""(()=>{
const out={};
function place(type,cells,cfg,dir){BP[type].dir=dir||0;BP[type].tier=0;BP[type].cfg=Object.assign(defCfg(type),cfg||{});return commitBuild(type,cells.map(([x,y,d])=>({x,y,d:d===undefined?(dir||0):d})))}
function beltPath(pts){const B=[];for(let k=0;k+1<pts.length;k++){const [ax,ay]=pts[k],[bx,by]=pts[k+1];const sx=Math.sign(bx-ax),sy=Math.sign(by-ay);let x=ax,y=ay;while(x!==bx||y!==by){B.push({x,y});x+=sx;y+=sy}}B.push({x:pts[pts.length-1][0],y:pts[pts.length-1][1]});return place('belt',pathCellsFor('belt',B).map(c=>[c.x,c.y,c.d]))}
function run(id,build){
  buildWorld('campaign',id,SET.seed);undoStack.length=0;const b0=W.credits;
  build();const np0=FW.count('pole');builder().autoPower();const added=FW.count('pole')-np0;W.credits-=added*structCost('pole',0);W.spent+=added*structCost('pole',0);topoDirty=true;const spent=b0-W.credits;
  let t=0;while(!W.camp.done&&t<60*900){simTick();t++}
  const sc=campaignScore();
  return {polesAutoPlaced:added,built:W.structs.size,spent,creditsLeft:Math.floor(W.credits),done:W.camp.done,simSeconds:+(t/60).toFixed(1),par:W.camp.par,score:sc.total,stars:sc.stars,unpowered:TOPO.consumers.filter(c=>c.net<0).length,powerSat:+(W.camp.satN?W.camp.satSum/W.camp.satN:1).toFixed(3)};
}
out.c2=run('c2',()=>{
  place('extractor',[[6,6],[6,8]]);beltPath([[7,6],[7,13],[11,13]]);place('splitter',[[12,13]]);
  beltPath([[12,12],[12,11]]);structAt(12,11)&&0;place('belt',[[12,11,0]]);place('smelter',[[13,11]],{rec:RC.iron_plate});beltPath([[14,11],[15,11],[15,12]]);
  beltPath([[12,14],[12,15]]);place('belt',[[12,15,0]]);place('smelter',[[13,15]],{rec:RC.iron_plate});beltPath([[14,15],[15,15],[15,14]]);
  place('merger',[[15,13]]);place('belt',[[16,13,0]]);place('assembler',[[17,13]],{rec:RC.gear});beltPath([[18,13],[33,13]]);
  place('extractor',[[6,20]]);beltPath([[7,20],[9,20]]);
});
out.c3=run('c3',()=>{
  place('extractor',[[6,13]]);place('smelter',[[7,13]],{rec:RC.copper_plate});place('assembler',[[8,13]],{rec:RC.wire});place('assembler',[[9,13]],{rec:RC.circuit});
  beltPath([[10,13],[36,13],[36,14],[37,14]]);
  place('extractor',[[6,6]]);place('smelter',[[7,6]],{rec:RC.iron_plate});beltPath([[8,6],[9,6],[9,12]]);
  place('extractor',[[6,23]]);beltPath([[7,23],[9,23]]);place('generator',[[10,24]]);place('belt',[[9,24,0]]);
});
startWorld('sandbox','starter',true);
return out})()"""
r = ev(js)
print(json.dumps(r, indent=1))
open("evidence/logs/t13.log", "w").write(json.dumps(r, indent=1))
