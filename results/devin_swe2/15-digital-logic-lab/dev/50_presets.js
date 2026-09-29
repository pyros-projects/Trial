/* ============================== PRESETS ============================== */
/* builder helpers */
function bComp(L,type,x,y,props,label){const d=CT[type];
  const c={id:uid(),type,x,y,label:label||'',props:Object.assign(d.defProps(),props||{}),state:{}};
  if(d.init)d.init(c);L.comps.push(c);return c;}
function bWire(L,a,ap,b,bp){L.wires.push({id:uid(),a:{c:a.id,p:ap},b:{c:b.id,p:bp}});}
function bProbe(L,c,p,n){L.probes.push({name:n,ref:c.id+'.'+p});}
function presetDef(name,fn){return{name,id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''),build:fn};}

const PRESETS=[
presetDef('Welcome — switch AND LED',L=>{
  const a=bComp(L,'switch',80,80,{},'A'),b=bComp(L,'switch',80,180,{},'B');
  const g=bComp(L,'and',260,110),o=bComp(L,'led',420,125,{},'OUT');
  bWire(L,a,'Q',g,'A');bWire(L,b,'Q',g,'B');bWire(L,g,'Q',o,'D');
  bProbe(L,g,'Q','out');L.view={x:30,y:20,z:1.3};
}),
presetDef('Half Adder',L=>{
  const a=bComp(L,'switch',80,60,{},'A'),b=bComp(L,'switch',80,150,{},'B');
  const x=bComp(L,'xor',250,70),g=bComp(L,'and',250,180);
  const s=bComp(L,'led',430,80,{},'SUM'),c=bComp(L,'led',430,190,{},'COUT');
  bWire(L,a,'Q',x,'A');bWire(L,b,'Q',x,'B');bWire(L,a,'Q',g,'A');bWire(L,b,'Q',g,'B');
  bWire(L,x,'Q',s,'D');bWire(L,g,'Q',c,'D');bProbe(L,x,'Q','sum');bProbe(L,g,'Q','cout');
}),
presetDef('Full Adder',L=>{
  const a=bComp(L,'switch',60,40,{},'A'),b=bComp(L,'switch',60,110,{},'B'),ci=bComp(L,'switch',60,180,{},'CIN');
  const x1=bComp(L,'xor',220,60),g1=bComp(L,'and',220,140);
  const x2=bComp(L,'xor',390,80),g2=bComp(L,'and',390,170),o=bComp(L,'or',540,130);
  const s=bComp(L,'led',660,90,{},'SUM'),co=bComp(L,'led',680,170,{},'COUT');
  bWire(L,a,'Q',x1,'A');bWire(L,b,'Q',x1,'B');bWire(L,a,'Q',g1,'A');bWire(L,b,'Q',g1,'B');
  bWire(L,x1,'Q',x2,'A');bWire(L,ci,'Q',x2,'B');bWire(L,x1,'Q',g2,'A');bWire(L,ci,'Q',g2,'B');
  bWire(L,g1,'Q',o,'A');bWire(L,g2,'Q',o,'B');bWire(L,x2,'Q',s,'D');bWire(L,o,'Q',co,'D');
  bProbe(L,x2,'Q','sum');bProbe(L,o,'Q','cout');
}),
presetDef('MUX 2:1',L=>{
  const d0=bComp(L,'switch',80,60,{},'D0'),d1=bComp(L,'switch',80,140,{},'D1'),s=bComp(L,'switch',80,220,{},'SEL');
  const m=bComp(L,'mux',280,110);const o=bComp(L,'led',440,130,{},'Q');
  bWire(L,d0,'Q',m,'D0');bWire(L,d1,'Q',m,'D1');bWire(L,s,'Q',m,'S');bWire(L,m,'Q',o,'D');
  bProbe(L,m,'Q','q');
}),
presetDef('SR Latch (NOR)',L=>{
  const r=bComp(L,'switch',80,60,{},'R'),s=bComp(L,'switch',80,200,{},'S');
  const n1=bComp(L,'nor',300,70,{},'NOR_Q'),n2=bComp(L,'nor',300,190,{},'NOR_QN');
  const q=bComp(L,'led',500,75,{},'Q'),qn=bComp(L,'led',500,195,{},'QN');
  bWire(L,r,'Q',n1,'A');bWire(L,n2,'Q',n1,'B');bWire(L,n1,'Q',q,'D');
  bWire(L,s,'Q',n2,'B');bWire(L,n1,'Q',n2,'A');bWire(L,n2,'Q',qn,'D');
  bProbe(L,n1,'Q','q');bProbe(L,n2,'Q','qn');
}),
presetDef('Edge-Triggered Register',L=>{
  const d=bComp(L,'switch',60,80,{bits:4},'D');
  const en=bComp(L,'switch',60,170,{},'EN');
  const clk=bComp(L,'button',60,250,{},'CLK');
  const rst=bComp(L,'button',60,330,{},'RST');
  const r=bComp(L,'reg',300,140,{bits:4},'REG');
  const o=bComp(L,'display',470,150,{bits:4},'Q');
  bWire(L,d,'Q',r,'D');bWire(L,clk,'Q',r,'CLK');bWire(L,en,'Q',r,'EN');bWire(L,rst,'Q',r,'RST');
  bWire(L,r,'Q',o,'D');bProbe(L,r,'Q','q');bProbe(L,clk,'Q','clk');
}),
presetDef('4-bit Counter',L=>{
  const k=bComp(L,'clock',60,100,{period:1},'CLK');
  const rst=bComp(L,'button',60,190,{},'RST');
  const c1=bComp(L,'const',60,270,{bits:1,val:1},'EN=1');
  const c=bComp(L,'cnt',260,120,{bits:4},'CNT');
  const o=bComp(L,'display',440,130,{bits:4},'COUNT');
  bWire(L,k,'Q',c,'CLK');bWire(L,rst,'Q',c,'RST');bWire(L,c1,'Q',c,'EN');
  bWire(L,c,'Q',o,'D');bProbe(L,k,'Q','clk');bProbe(L,c,'Q','q');
}),
presetDef('ALU 4-bit',L=>{
  const a=bComp(L,'switch',50,60,{bits:4},'A'),b=bComp(L,'switch',50,160,{bits:4},'B');
  const op=bComp(L,'switch',50,270,{bits:2},'OP 0&1|+2|-3');
  const c0=bComp(L,'const',50,360,{bits:1,val:0},'0');
  const gA=bComp(L,'and',230,50,{bits:4},'AND'),gO=bComp(L,'or',230,140,{bits:4},'OR');
  const add=bComp(L,'adder',230,230,{bits:4},'ADD');
  const xs=bComp(L,'xor',230,330,{bits:4},'B^1111');
  const cF=bComp(L,'const',50,440,{bits:4,val:15},'F');
  const c1=bComp(L,'const',50,520,{bits:1,val:1},'CIN1');
  const sub=bComp(L,'adder',230,430,{bits:4},'SUB');
  const m=bComp(L,'mux',460,180,{bits:4,n:4},'MUX4');
  const o=bComp(L,'display',640,190,{bits:4},'RESULT');
  const co=bComp(L,'led',640,300,{},'COUT+');
  const orc=bComp(L,'or',530,320,{n:2},'CO∨');
  bWire(L,a,'Q',gA,'A');bWire(L,b,'Q',gA,'B');
  bWire(L,a,'Q',gO,'A');bWire(L,b,'Q',gO,'B');
  bWire(L,a,'Q',add,'A');bWire(L,b,'Q',add,'B');bWire(L,c0,'Q',add,'CIN');
  bWire(L,b,'Q',xs,'A');bWire(L,cF,'Q',xs,'B');
  bWire(L,a,'Q',sub,'A');bWire(L,xs,'Q',sub,'B');bWire(L,c1,'Q',sub,'CIN');
  bWire(L,gA,'Q',m,'D0');bWire(L,gO,'Q',m,'D1');bWire(L,add,'S',m,'D2');bWire(L,sub,'S',m,'D3');
  bWire(L,op,'Q',m,'S');bWire(L,m,'Q',o,'D');
  bWire(L,add,'CO',orc,'A');bWire(L,sub,'CO',orc,'B');bWire(L,orc,'Q',co,'D');
  bProbe(L,m,'Q','alu');bProbe(L,op,'Q','op');
}),
presetDef('Memory Test (RAM 16x4)',L=>{
  const k=bComp(L,'clock',50,80,{period:4},'CLK');
  const sw=bComp(L,'switch',50,180,{bits:4},'DATA');
  const we=bComp(L,'switch',50,270,{},'WE');
  const c=bComp(L,'cnt',240,60,{bits:4},'ADDR');
  const c1=bComp(L,'const',50,350,{bits:1,val:1},'1');
  const rst=bComp(L,'button',50,430,{},'RST');
  const m=bComp(L,'ram',430,140,{aw:4,bits:4},'RAM');
  const o=bComp(L,'display',620,160,{bits:4},'DOUT');
  bWire(L,k,'Q',c,'CLK');bWire(L,c1,'Q',c,'EN');bWire(L,rst,'Q',c,'RST');
  bWire(L,c,'Q',m,'A');bWire(L,sw,'Q',m,'D');bWire(L,we,'Q',m,'WE');bWire(L,k,'Q',m,'CLK');
  bWire(L,m,'Q',o,'D');bProbe(L,c,'Q','addr');bProbe(L,m,'Q','dout');bProbe(L,k,'Q','clk');
}),

/* ---------------- TINY 4-BIT CPU ----------------
 Harvard: program ROM (16x8, WE=0) + data RAM (16x4).
 instr = ROM[PC] : opcode=hi4, operand=lo4
 1 LDA imm | 2 ADD imm | 3 SUB imm | 4 STA a | 5 LDM a | 6 JMP a | 7 JZ a | 8 HLT
 Single-cycle: one instruction per rising edge of gated clock.          */
presetDef('Tiny CPU (4-bit)',L=>{
  const k=bComp(L,'clock',40,40,{period:1},'CLK');
  const rst=bComp(L,'button',40,120,{},'RESET');
  const c1=bComp(L,'const',40,200,{bits:1,val:1},'1');
  const c0=bComp(L,'const',40,270,{bits:1,val:0},'0');
  const c04=bComp(L,'const',40,340,{bits:4,val:0},'0x0');
  const c08=bComp(L,'const',40,410,{bits:8,val:0},'0x00');
  const hlt=bComp(L,'dff',250,40,{},'HALT');
  const nh=bComp(L,'not',400,50,{},'~halt');
  const cg=bComp(L,'and',500,60,{},'CLKG');
  bWire(L,k,'Q',cg,'A');bWire(L,hlt,'Q',nh,'A');bWire(L,nh,'Q',cg,'B');
  bWire(L,rst,'Q',hlt,'RST');bWire(L,c1,'Q',hlt,'EN');
  // PC + ROM + IR
  const pc=bComp(L,'cnt',170,190,{bits:4},'PC');
  const rom=bComp(L,'ram',350,180,{aw:4,bits:8,mem:[0x10,0x4F,0x5F,0x21,0x4F,0x62,0x82]},'ROM prog');
  const ir=bComp(L,'reg',350,330,{bits:8},'IR');
  bWire(L,pc,'Q',rom,'A');bWire(L,c08,'Q',rom,'D');bWire(L,c0,'Q',rom,'WE');
  bWire(L,rom,'Q',ir,'D');bWire(L,cg,'Q',ir,'CLK');bWire(L,c1,'Q',ir,'EN');bWire(L,rst,'Q',ir,'RST');
  bWire(L,cg,'Q',pc,'CLK');bWire(L,c1,'Q',pc,'EN');bWire(L,rst,'Q',pc,'RST');
  // decode
  const sp=bComp(L,'split',530,250,{parts:[4,4]},'op|opnd'); // O0=lo=operand, O1=hi=opcode
  const dec=bComp(L,'dec',680,120,{n:4},'OPDEC');
  bWire(L,rom,'Q',sp,'B');bWire(L,sp,'O1',dec,'A');bWire(L,c1,'Q',dec,'EN');
  // control lines
  const oAL=bComp(L,'or',830,430,{n:4},'aLoad');
  bWire(L,dec,'Y1',oAL,'A');bWire(L,dec,'Y2',oAL,'B');bWire(L,dec,'Y3',oAL,'C');bWire(L,dec,'Y5',oAL,'D');
  const jz=bComp(L,'and',830,340,{},'JZ&zero');
  const cmp=bComp(L,'cmp',680,590,{bits:4},'A==0');
  const orJ=bComp(L,'or',980,370,{},'pcLoad');
  bWire(L,dec,'Y7',jz,'A');bWire(L,cmp,'EQ',jz,'B');
  bWire(L,dec,'Y6',orJ,'A');bWire(L,jz,'Q',orJ,'B');
  bWire(L,orJ,'Q',pc,'LD');
  const opnd=sp; // operand = O0
  bWire(L,opnd,'O0',pc,'D');
  // ALU: sub = operand XOR broadcast(sub3) ; adder A + aluB + cin(sub3)
  const bc=bComp(L,'join',830,690,{parts:[1,1,1,1]},'sub*F');
  bWire(L,dec,'Y3',bc,'I0');bWire(L,dec,'Y3',bc,'I1');bWire(L,dec,'Y3',bc,'I2');bWire(L,dec,'Y3',bc,'I3');
  const xb=bComp(L,'xor',700,700,{bits:4},'opnd^sub');
  bWire(L,opnd,'O0',xb,'A');bWire(L,bc,'Q',xb,'B');
  const reg=bComp(L,'reg',1230,560,{bits:4},'A');
  const add=bComp(L,'adder',850,560,{bits:4},'ALU');
  bWire(L,reg,'Q',add,'A');bWire(L,xb,'Q',add,'B');bWire(L,dec,'Y3',add,'CIN');
  // data RAM
  const dm=bComp(L,'ram',1050,680,{aw:4,bits:4},'RAM data');
  bWire(L,opnd,'O0',dm,'A');bWire(L,reg,'Q',dm,'D');bWire(L,dec,'Y4',dm,'WE');bWire(L,cg,'Q',dm,'CLK');
  // A next mux4: D0=alu, D1=imm, D2=ram, S={ldm,lda}
  const mx=bComp(L,'mux',1040,480,{bits:4,n:4},'Asrc');
  bWire(L,add,'S',mx,'D0');bWire(L,opnd,'O0',mx,'D1');bWire(L,dm,'Q',mx,'D2');bWire(L,c04,'Q',mx,'D3');
  const sel=bComp(L,'join',920,470,{parts:[1,1]},'sel');
  bWire(L,dec,'Y5',sel,'I1');bWire(L,dec,'Y1',sel,'I0');bWire(L,sel,'Q',mx,'S');
  bWire(L,mx,'Q',reg,'D');bWire(L,oAL,'Q',reg,'EN');bWire(L,cg,'Q',reg,'CLK');bWire(L,rst,'Q',reg,'RST');
  // halt decode → halt dff
  bWire(L,dec,'Y8',hlt,'D');bWire(L,cg,'Q',hlt,'CLK');
  // comparator A==0
  bWire(L,reg,'Q',cmp,'A');bWire(L,c04,'Q',cmp,'B');
  // output
  const dsp=bComp(L,'display',1400,560,{bits:4},'OUT = A');
  const led=bComp(L,'led',680,40,{},'HALTED');
  const dsp2=bComp(L,'display',530,340,{bits:8},'INSTR');
  bWire(L,reg,'Q',dsp,'D');bWire(L,hlt,'Q',led,'D');bWire(L,rom,'Q',dsp2,'D');
  // probes
  bProbe(L,k,'Q','clk');bProbe(L,pc,'Q','pc');bProbe(L,reg,'Q','A');
  bProbe(L,rom,'Q','instr');bProbe(L,cg,'Q','clkg');
  L.view={x:-20,y:0,z:0.8};
}),
];

function loadPreset(id){
  const p=PRESETS.find(x=>x.id===id);if(!p)return;
  const L={comps:[],wires:[],probes:[]};p.build(L);
  S.comps.clear();S.wires.clear();S.sel.clear();S.ttIns.clear();S.ttOuts.clear();
  for(const c of L.comps)S.comps.set(c.id,c);
  for(const w of L.wires)S.wires.set(w.id,w);
  S.probes=L.probes.map(pr=>({id:uid(),name:pr.name,ref:pr.ref,samples:[]}));
  if(L.view)S.view={...S.view,...L.view};
  rebuildNets();for(const pr of S.probes)pr.net=S.netOf.get(pr.ref);
  S.hist=[];S.histI=-1;simReset();pushHist();renderInspector();renderAnalyzer();
}
