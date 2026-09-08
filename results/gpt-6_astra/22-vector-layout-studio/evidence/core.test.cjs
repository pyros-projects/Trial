const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.existsSync('index.html')?fs.readFileSync('index.html','utf8'):'';
const source=html.split('/* CORE START */')[1]?.split('/* CORE END */')[0];
assert.ok(source,'Production geometry core must exist');
const ctx=vm.createContext({});vm.runInContext(source+';globalThis.core={M,inv,pt,curveBox,validateDoc,leafBox,worldMatrix,bounds,normalizeSelection,groupSelection,ungroupSelection,distributeItems};',ctx);
const c=ctx.core, near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
let b=c.curveBox([{x:100,y:100,in:{x:100,y:100},out:{x:100,y:0}},{x:200,y:100,in:{x:200,y:0},out:{x:200,y:100}}],false);[100,25,100,75].forEach((v,i)=>near([b.x,b.y,b.w,b.h][i],v));
const mat=[0,2,-2,0,50,70],p={x:20,y:35};const q=c.pt(c.inv(mat),c.pt(mat,p));near(q.x,p.x);near(q.y,p.y);
const item=(id,x,y,w,h,parent=null)=>({id,parent,type:'rect',name:id,visible:true,locked:false,transform:[1,0,0,1,x,y],width:w,height:h,rx:0,style:{fill:'#ff0000',stroke:'none',strokeWidth:0,opacity:1}});
let d={app:'Forma',version:1,name:'Test',artboard:{width:1200,height:800,background:'#ffffff',transparent:false},items:[item('a',40,60,80,40),item('b',180,100,60,40),item('c',320,160,80,40)]};
c.validateDoc(d);c.distributeItems(d,['a','b','c'],'x');near(c.bounds(d,'b').x,190);near(c.bounds(d,'a').x,40);near(c.bounds(d,'c').x,320);
let old=c.bounds(d,'a');c.groupSelection(d,['a','b'],'g');d.items.find(x=>x.id==='g').transform=mat;const before=['a','b'].map(id=>c.bounds(d,id));c.ungroupSelection(d,['g']);['a','b'].forEach((id,i)=>{const r=c.bounds(d,id);for(const k of ['x','y','w','h'])near(r[k],before[i][k]);});
assert.throws(()=>c.groupSelection(d,['a','c'],'g2'),/contiguous/);
for(const mutate of [x=>x.items.push({...x.items[0]}),x=>x.items[0].type='script',x=>x.items[0].transform[0]=Infinity,x=>x.items[0].parent=x.items[0].id,x=>x.version=999,x=>x.items[0].style.fill='url(https://evil.test/a)',x=>x.items[0].transform=[0,0,0,0,0,0]]){const z=JSON.parse(JSON.stringify(d));mutate(z);assert.throws(()=>c.validateDoc(z));}
{ const z=JSON.parse(JSON.stringify(d));z.items[0].parent='';assert.throws(()=>c.validateDoc(z),/parent/i); }
console.log('PASS: exact curve extrema, inverse coordinates, equal gaps, group world invariance, noncontiguous refusal, seven hostile schema variants plus empty-parent rejection');
