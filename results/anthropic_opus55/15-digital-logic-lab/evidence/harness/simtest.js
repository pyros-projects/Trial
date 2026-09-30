const fs=require('fs'),vm=require('vm');
// Extracts the application script from the delivered single-file index.html and runs the engine headlessly.
const html=fs.readFileSync(require('path').join(__dirname,'..','..','index.html'),'utf8');
const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
const src=script+'\n;globalThis.__x={T,Sim,fmtVal,layoutOf,defaultProps,F_OSC,F_CONT,F_FLOAT};';
const ctx={console,performance};vm.createContext(ctx);vm.runInContext(src,ctx);
const {T,Sim,fmtVal,defaultProps,F_OSC,F_CONT}=ctx.__x;
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
function doc(){const d={components:[],wires:[],probes:[]};let i=0;return{d,add(t,p={}){const id='c'+(++i);d.components.push({id,type:t,x:0,y:0,props:Object.assign(defaultProps(t),p)});return id;},w(a,ap,b,bp){d.wires.push({id:'w'+d.wires.length,a:{c:a,p:ap},b:{c:b,p:bp}});}};}
const val=(s,id,p)=>{const r=s.portValue({c:id,p});return fmtVal(r.v,r.x,r.w,'hex');};
// half adder
{const b=doc();const A=b.add('switch'),B=b.add('switch'),X=b.add('xor'),N=b.add('and'),S=b.add('led'),C=b.add('led');
b.w(A,'out',X,'in0');b.w(B,'out',X,'in1');b.w(A,'out',N,'in0');b.w(B,'out',N,'in1');b.w(X,'out',S,'in');b.w(N,'out',C,'in');
const s=new Sim();s.build(b.d);s.reset();s.settle();
const rows=[];for(const [a,bb] of [[0,0],[0,1],[1,0],[1,1]]){b.d.components[0].props.value=a;b.d.components[1].props.value=bb;s.touch(s.byId.get(A));s.touch(s.byId.get(B));s.settle();rows.push(val(s,S,'in')+val(s,C,'in'));}
ok(rows.join(',')==='00,10,10,01','half adder truth '+rows.join(','));}
// ring oscillator
{const b=doc();const n1=b.add('not'),n2=b.add('not'),n3=b.add('not');b.w(n1,'out',n2,'in');b.w(n2,'out',n3,'in');b.w(n3,'out',n1,'in');
const s=new Sim();s.limit=2000;s.build(b.d);s.reset();s.settle();ok(!s.fault,'no fault initially (X stable) fault='+s.fault);
// X-init loop is stable; now break symmetry: make it NAND with enable
}
{const b=doc();const en=b.add('switch'),g=b.add('nand'),n2=b.add('not'),n3=b.add('not');b.w(en,'out',g,'in0');b.w(g,'out',n2,'in');b.w(n2,'out',n3,'in');b.w(n3,'out',g,'in1');
const s=new Sim();s.limit=2000;s.build(b.d);s.reset();s.settle();ok(val(s,g,'out')==='1','enable=0 -> nand out 1');
b.d.components[0].props.value=1;s.touch(s.byId.get(en));s.settle();
const oscN=[...s.netF].filter(f=>f&F_OSC).length;ok(s.oscFlag&&oscN>=3&&!s.fault,'ring osc contained: oscNets='+oscN+' fault='+s.fault+' contains='+s.stats.contains);
b.d.components[0].props.value=0;s.touch(s.byId.get(en));s.settle();ok(val(s,g,'out')==='1'&&val(s,n3,'out')==='1','disable resolves loop: '+val(s,n3,'out'));
const oscN2=[...s.netF].filter(f=>f&F_OSC).length;ok(oscN2===0,'osc flags cleared once known: '+oscN2);}
// SR latch (NOR)
{const b=doc();const S=b.add('switch'),R=b.add('switch'),g1=b.add('nor'),g2=b.add('nor');
b.w(R,'out',g1,'in0');b.w(g2,'out',g1,'in1');b.w(S,'out',g2,'in0');b.w(g1,'out',g2,'in1');
const s=new Sim();s.build(b.d);s.reset();s.settle();ok(val(s,g1,'out')==='X','SR latch unknown at reset');
b.d.components[0].props.value=1;s.touch(s.byId.get(S));s.settle();b.d.components[0].props.value=0;s.touch(s.byId.get(S));s.settle();
ok(val(s,g1,'out')==='1'&&val(s,g2,'out')==='0','SR set holds Q=1: '+val(s,g1,'out')+val(s,g2,'out'));
b.d.components[1].props.value=1;s.touch(s.byId.get(R));s.settle();b.d.components[1].props.value=0;s.touch(s.byId.get(R));s.settle();
ok(val(s,g1,'out')==='0'&&val(s,g2,'out')==='1','SR reset holds Q=0');}
// sync counter from DFF + clock
{const b=doc();const clk=b.add('clock'),ff=b.add('dff',{width:4}),add=b.add('adder',{width:4}),one=b.add('const',{width:4,value:1});
b.w(clk,'clk',ff,'clk');b.w(ff,'q',add,'a');b.w(one,'out',add,'b');b.w(add,'sum',ff,'d');
const s=new Sim();s.build(b.d);s.reset();s.settle();const seq=[];for(let i=0;i<18;i++){s.halfTick();s.settle();s.halfTick();s.settle();seq.push(parseInt(val(s,ff,'q'),16));}
ok(seq.join(',')==='1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0,1,2','counter '+seq.join(','));}
// tristate contention
{const b=doc();const a=b.add('const',{value:1}),z=b.add('const',{value:0}),e1=b.add('switch'),e2=b.add('switch'),t1=b.add('tristate'),t2=b.add('tristate'),L=b.add('led');
b.w(a,'out',t1,'in');b.w(z,'out',t2,'in');b.w(e1,'out',t1,'en');b.w(e2,'out',t2,'en');b.w(t1,'out',L,'in');b.w(t2,'out',L,'in');
const s=new Sim();s.build(b.d);s.reset();s.settle();const n=s.netOfRef({c:L,p:'in'});
ok(val(s,L,'in')==='Z'&&(s.netF[n]&4),'floating bus Z');
b.d.components[2].props.value=1;s.touch(s.byId.get(e1));s.settle();ok(val(s,L,'in')==='1','bus driven by t1 =1');
b.d.components[3].props.value=1;s.touch(s.byId.get(e2));s.settle();ok(val(s,L,'in')==='X'&&(s.netF[n]&F_CONT),'contention X + flag');
b.d.components[2].props.value=0;s.touch(s.byId.get(e1));s.settle();ok(val(s,L,'in')==='0'&&!(s.netF[n]&F_CONT),'t2 alone =0, flag cleared');}
// RAM write/read + width mismatch
{const b=doc();const A=b.add('switch',{width:4,value:3}),D=b.add('switch',{width:8,value:0x5A}),W=b.add('switch',{value:1}),clk=b.add('clock'),ram=b.add('ram'),L=b.add('led'),Dp=b.add('display');b.w(ram,'q',Dp,'in');
b.w(A,'out',ram,'a');b.w(D,'out',ram,'d');b.w(W,'out',ram,'we');b.w(clk,'clk',ram,'clk');const Wd=b.add('switch',{width:4});b.w(Wd,'out',L,'in');
const s=new Sim();s.build(b.d);s.reset();s.settle();ok(val(s,ram,'q')==='0x00','ram initially 0');s.halfTick();s.settle();ok(val(s,ram,'q')==='0x5A','ram write-through read 0x5A');
const n=s.netOfRef({c:L,p:'in'});ok(s.nets[n].err==='width'&&val(s,L,'in')==='X','width mismatch net flagged');}
console.log(fails?fails+' FAILURES':'ALL PASS');process.exit(fails?1:0);
