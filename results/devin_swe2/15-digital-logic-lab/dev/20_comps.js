/* ============================== COMPONENTS ============================== */
const ok=v=>v&&v.s==='ok';
const bit1=(v,b)=>ok(v)?((v.v>>b)&1):null;
function gAnd(ins,w){const vs=Object.values(ins);if(vs.some(v=>ok(v)&&v.v===0))return V(0);if(vs.every(ok)){let r=MASK(w);for(const v of vs)r&=v.v;return V(r);}return V(0,'x');}
function gOr(ins,w){const vs=Object.values(ins);if(vs.some(v=>ok(v)&&v.v===MASK(w)))return V(MASK(w));if(vs.every(ok)){let r=0;for(const v of vs)r|=v.v;return V(r);}return V(0,'x');}
function gXor(ins,w){const vs=Object.values(ins);if(vs.every(ok)){let r=0;for(const v of vs)r^=v.v;return V(r);}return V(0,'x');}
function gNot(v,w){return ok(v)?V(maskW(~v.v,w)):V(0,'x');}
const INY=(i,n,h)=>Math.round(h*(i+1)/(n+1));

/* layout helper: insLeft(count,offsets), outsRight */
function layRect(w,h,ins,outs){ // ins/outs: [{name,w,bit?}] even spaced
  const pins=[];
  ins.forEach((p,i)=>pins.push({name:p.name,dir:'in',w:p.w,x:0,y:INY(i,ins.length,h)}));
  outs.forEach((p,i)=>pins.push({name:p.name,dir:'out',w:p.w,x:w,y:INY(i,outs.length,h)}));
  return{w,h,pins};
}
function gateLay(n,cw,ch,bits){
  const ins=[];for(let i=0;i<n;i++)ins.push({name:'ABCDEF'[i],w:bits});
  return layRect(cw,ch,ins,[{name:'Q',w:bits}]);
}

const CT={};

CT.switch={label:'Switch',grp:'I/O',glyph:'⏻',help:'Toggle input. Click to flip (1-bit) or edit value in inspector.',
  defProps:()=>({bits:S.settings.defBits===1?1:S.settings.defBits}),
  layout:c=>layRect(46,34,[],[{name:'Q',w:c.props.bits}]),
  init:c=>{c.state.val=0;},
  eval:(c,i)=>({Q:V(maskW(c.state.val||0,c.props.bits))}),
  onTap:c=>{const m=MASK(c.props.bits);c.state.val=c.props.bits===1?(c.state.val?0:1):(c.state.val+1)&m;},
};

CT.button={label:'Button',grp:'I/O',glyph:'◉',help:'Momentary push-button: 1 while held.',
  defProps:()=>({bits:1}),
  layout:c=>layRect(46,34,[],[{name:'Q',w:c.props.bits}]),
  init:c=>{c.state.val=0;},
  eval:(c,i)=>({Q:V(maskW(c.state.val||0,c.props.bits))}),
  onDown:c=>{c.state.val=MASK(c.props.bits);},onUp:c=>{c.state.val=0;},
};

CT.const={label:'Constant',grp:'I/O',glyph:'≣',help:'Constant value source (bit width + value).',
  defProps:()=>({bits:1,val:1}),
  layout:c=>layRect(46,30,[],[{name:'Q',w:c.props.bits}]),
  eval:(c,i)=>({Q:V(maskW(c.props.val,c.props.bits))}),
};

CT.led={label:'LED / Probe',grp:'I/O',glyph:'●',help:'Output indicator; shows 0/1 (or bus value).',
  defProps:()=>({bits:1}),
  layout:c=>layRect(34,34,[{name:'D',w:c.props.bits}],[]),
  eval:(c,i)=>({}),
};

CT.display={label:'Hex Display',grp:'I/O',glyph:'▣',help:'Displays bus value as hex/decimal.',
  defProps:()=>({bits:4}),
  layout:c=>layRect(56,44,[{name:'D',w:c.props.bits}],[]),
  eval:(c,i)=>({}),
};

function regGate(t,label,glyph,fn,inv,help){
  CT[t]={label,grp:'Gates',glyph,help,
    defProps:()=>({n:2,bits:1}),
    layout:c=>gateLay(c.props.n,58,Math.max(40,c.props.n*16+12),c.props.bits),
    eval:(c,i)=>{const ins={};'ABCDEF'.slice(0,c.props.n).split('').forEach(k=>ins[k]=i[k]);
      const r=fn(ins,c.props.bits);return{Q:inv?gNot(r,c.props.bits):r};},
  };
}
regGate('and','AND','&',gAnd,false,'Bitwise AND. Inputs configurable (2-4), bit width configurable.');
regGate('or','OR','≥1',gOr,false,'Bitwise OR.');
regGate('xor','XOR','=1',gXor,false,'Bitwise XOR (parity for >2 inputs).');
regGate('nand','NAND','&̄',gAnd,true,'Bitwise NAND.');
regGate('nor','NOR','≥1̄',gOr,true,'Bitwise NOR.');

CT.not={label:'NOT',grp:'Gates',glyph:'1',help:'Inverter.',
  defProps:()=>({bits:1}),
  layout:c=>gateLay(1,46,32,c.props.bits),
  eval:(c,i)=>({Q:gNot(i.A,c.props.bits)})};
CT.buf={label:'Buffer',grp:'Gates',glyph:'▷',help:'Buffer / driver.',
  defProps:()=>({bits:1}),
  layout:c=>gateLay(1,46,32,c.props.bits),
  eval:(c,i)=>({Q:ok(i.A)?V(i.A.v):V(0,'x')})};
CT.tri={label:'Tri-State',grp:'Gates',glyph:'▽',help:'Tri-state buffer: drives A when EN=1, else high-Z.',
  defProps:()=>({bits:1}),
  layout:c=>layRect(56,46,[{name:'A',w:c.props.bits},{name:'EN',w:1}],[{name:'Q',w:c.props.bits}]),
  eval:(c,i)=>{const en=i.EN;if(ok(en)&&en.v===0)return{Q:{v:0,s:'z'}};
    if(!ok(en))return{Q:V(0,'x')};return{Q:ok(i.A)?V(i.A.v):V(0,'x')};},
};

CT.mux={label:'MUX',grp:'Comb',glyph:'M',help:'Multiplexer: selects one of N data inputs by SEL.',
  defProps:()=>({n:2,bits:1}),
  layout:c=>{const n=c.props.n,h=Math.max(48,n*16+30);
    const ins=[];for(let i=0;i<n;i++)ins.push({name:'D'+i,w:c.props.bits});
    ins.push({name:'S',w:Math.log2(n)});
    const L=layRect(56,h,ins,[{name:'Q',w:c.props.bits}]);
    return L;},
  eval:(c,i)=>{const s=i.S;if(!ok(s))return{Q:V(0,'x')};
    const d=i['D'+s.v];return{Q:d&&ok(d)?V(d.v):V(0,'x')};},
};

CT.dec={label:'Decoder',grp:'Comb',glyph:'D',help:'Decoder: n-bit input + EN → 2^n one-hot outputs.',
  defProps:()=>({n:2}),
  layout:c=>{const m=1<<c.props.n,h=Math.max(46,m*14+12);
    const L=layRect(56,h,[{name:'A',w:c.props.n},{name:'EN',w:1}],[]);
    for(let k=0;k<m;k++)L.pins.push({name:'Y'+k,dir:'out',w:1,x:56,y:Math.round(h*(k+0.5)/m)});
    return L;},
  eval:(c,i)=>{const o={};const m=1<<c.props.n;
    for(let k=0;k<m;k++)o['Y'+k]=V(0);
    if(ok(i.EN)&&i.EN.v&&ok(i.A))o['Y'+i.A.v]=V(1);
    else if(!ok(i.EN)||!ok(i.A))for(let k=0;k<m;k++)o['Y'+k]=V(0,'x');
    return o;},
};

CT.adder={label:'Adder',grp:'Comb',glyph:'+',help:'Full adder: SUM=A+B+CIN, plus carry-out.',
  defProps:()=>({bits:4}),
  layout:c=>layRect(60,64,[{name:'A',w:c.props.bits},{name:'B',w:c.props.bits},{name:'CIN',w:1}],[{name:'S',w:c.props.bits},{name:'CO',w:1}]),
  eval:(c,i)=>{const w=c.props.bits;
    if(ok(i.A)&&ok(i.B)){const ci=ok(i.CIN)?i.CIN.v&1:0;const s=i.A.v+i.B.v+ci;
      return{S:V(maskW(s,w)),CO:V(s>>w?1:0)};}
    return{S:V(0,'x'),CO:V(0,'x')};},
};

CT.cmp={label:'Compare',grp:'Comb',glyph:'⋚',help:'Comparator: GT/EQ/LT outputs.',
  defProps:()=>({bits:4}),
  layout:c=>layRect(56,60,[{name:'A',w:c.props.bits},{name:'B',w:c.props.bits}],[{name:'GT',w:1},{name:'EQ',w:1},{name:'LT',w:1}]),
  eval:(c,i)=>{if(ok(i.A)&&ok(i.B))return{GT:V(i.A.v>i.B.v?1:0),EQ:V(i.A.v===i.B.v?1:0),LT:V(i.A.v<i.B.v?1:0)};
    return{GT:V(0,'x'),EQ:V(0,'x'),LT:V(0,'x')};},
};

CT.split={label:'Splitter',grp:'Comb',glyph:'⋔',help:'Splits a bus into parts (widths like "4,4").',
  defProps:()=>({parts:[2,2]}),
  layout:c=>{const ps=c.props.parts,h=Math.max(40,ps.length*16+14);
    const L=layRect(48,h,[{name:'B',w:ps.reduce((a,b)=>a+b,0)}],[]);
    ps.forEach((w,k)=>L.pins.push({name:'O'+k,dir:'out',w,x:48,y:Math.round(h*(k+0.5)/ps.length)}));
    return L;},
  eval:(c,i)=>{const o={};let off=0;const ps=c.props.parts;
    ps.forEach((w,k)=>{o['O'+k]=ok(i.B)?V((i.B.v>>off)&MASK(w)):V(0,'x');off+=w;});
    return o;},
};

CT.join={label:'Joiner',grp:'Comb',glyph:'⋓',help:'Joins parts into a bus (widths like "4,4").',
  defProps:()=>({parts:[2,2]}),
  layout:c=>{const ps=c.props.parts,h=Math.max(40,ps.length*16+14);
    const ins=ps.map((w,k)=>({name:'I'+k,w}));
    const L=layRect(48,h,ins,[{name:'Q',w:ps.reduce((a,b)=>a+b,0)}]);
    return L;},
  eval:(c,i)=>{const ps=c.props.parts;let v=0,off=0,bad=false;
    ps.forEach((w,k)=>{const p=i['I'+k];if(ok(p))v|=(p.v&MASK(w))<<off;else bad=true;off+=w;});
    return{Q:bad?V(v,'x'):V(v)};},
};

CT.clock={label:'Clock',grp:'Seq',glyph:'⏱',help:'Clock generator: toggles every <period> events.',
  defProps:()=>({period:1}),
  layout:c=>layRect(46,34,[],[{name:'Q',w:1}]),
  init:c=>{c.state.out=0;},
  eval:(c,i)=>({Q:V(c.state.out||0)}),
};

CT.dff={label:'D Flip-Flop',grp:'Seq',glyph:'D',help:'Edge-triggered DFF with EN and async-reset pin.',
  defProps:()=>({}),
  layout:c=>layRect(58,72,[{name:'D',w:1},{name:'CLK',w:1},{name:'EN',w:1},{name:'RST',w:1}],[{name:'Q',w:1},{name:'QN',w:1}]),
  init:c=>{c.state.q=0;},
  clkPin:'CLK',
  eval:(c,i)=>{const r=ok(i.RST)&&i.RST.v;const q=r?0:(c.state.q||0);return{Q:V(q),QN:V(q?0:1)};},
  edge:(c,snap,sim)=>{const s=seqSample(c,snap,['D','EN','RST']);
    if(ok(s.RST)&&s.RST.v){c.state.q=0;}else if(!ok(s.EN)||s.EN.v){c.state.q=ok(s.D)?s.D.v&1:0;}
    sim.dirty.add(c.id);},
};

CT.reg={label:'Register',grp:'Seq',glyph:'R',help:'N-bit register: D→Q on rising CLK when EN.',
  defProps:()=>({bits:4}),
  layout:c=>layRect(62,72,[{name:'D',w:c.props.bits},{name:'CLK',w:1},{name:'EN',w:1},{name:'RST',w:1}],[{name:'Q',w:c.props.bits}]),
  init:c=>{c.state.q=0;},
  clkPin:'CLK',
  eval:(c,i)=>{const r=ok(i.RST)&&i.RST.v;return{Q:V(r?0:maskW(c.state.q||0,c.props.bits))};},
  edge:(c,snap,sim)=>{const s=seqSample(c,snap,['D','EN','RST']);
    if(ok(s.RST)&&s.RST.v)c.state.q=0;else if(!ok(s.EN)||s.EN.v)c.state.q=ok(s.D)?s.D.v:0;
    sim.dirty.add(c.id);},
};

CT.cnt={label:'Counter',grp:'Seq',glyph:'#',help:'N-bit counter: EN counts, LD loads D, RST clears.',
  defProps:()=>({bits:4}),
  layout:c=>layRect(66,84,[{name:'D',w:c.props.bits},{name:'CLK',w:1},{name:'EN',w:1},{name:'RST',w:1},{name:'LD',w:1}],[{name:'Q',w:c.props.bits}]),
  init:c=>{c.state.q=0;},
  clkPin:'CLK',
  eval:(c,i)=>{const r=ok(i.RST)&&i.RST.v;return{Q:V(r?0:maskW(c.state.q||0,c.props.bits))};},
  edge:(c,snap,sim)=>{const s=seqSample(c,snap,['D','EN','RST','LD']);
    if(ok(s.RST)&&s.RST.v)c.state.q=0;
    else if(ok(s.LD)&&s.LD.v)c.state.q=ok(s.D)?s.D.v:0;
    else if(ok(s.EN)&&s.EN.v)c.state.q=(c.state.q+1)&MASK(c.props.bits);
    sim.dirty.add(c.id);},
};

CT.ram={label:'RAM',grp:'Seq',glyph:'▦',help:'RAM: combinational read DOUT=mem[ADDR]; write on CLK when WE.',
  defProps:()=>({aw:4,bits:4,mem:[]}),
  layout:c=>layRect(78,96,[{name:'A',w:c.props.aw},{name:'D',w:c.props.bits},{name:'WE',w:1},{name:'CLK',w:1}],[{name:'Q',w:c.props.bits}]),
  init:(c,keep)=>{const sz=1<<c.props.aw;c.state.mem=new Array(sz).fill(0);
    if(keep&&c.state._mem)c.state.mem=c.state._mem;
    (c.props.mem||[]).forEach((v,i)=>{if(i<sz)c.state.mem[i]=v&MASK(c.props.bits);});},
  clkPin:'CLK',
  eval:(c,i)=>{const a=ok(i.A)?i.A.v&MASK(c.props.aw):0;
    return{Q:V(c.state.mem[a]||0)};},
  edge:(c,snap,sim)=>{const s=seqSample(c,snap,['A','D','WE']);
    if(ok(s.WE)&&s.WE.v){const a=ok(s.A)?s.A.v&MASK(c.props.aw):0;
      c.state.mem[a]=ok(s.D)?s.D.v&MASK(c.props.bits):0;c.state._mem=c.state.mem;}
    sim.dirty.add(c.id);},
};

/* expose pins getter */
for(const t in CT){const d=CT[t];d.pins=c=>(d.layout?d.layout(c):d._lay(c)).pins;
  d.size=c=>{const L=d.layout?d.layout(c):d._lay(c);return{w:L.w,h:L.h};};}
