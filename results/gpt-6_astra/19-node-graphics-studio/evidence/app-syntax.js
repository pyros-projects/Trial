
'use strict';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;
','<':'&lt;
','>':'&gt;
','"':'&quot;
',"'":'&#39;
'}[c]));

const icon=(n)=>`<svg class="icon"><use href="#i-${n}"/></svg>`;
const clone=o=>JSON.parse(JSON.stringify(o));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const num=(label,value,min=0,max=10,step=.01)=>({label,value,min,max,step});
const col=(label,value)=>({label,value,kind:'color'});
const opt=(label,value,options)=>({label,value,min:0,max:options.length-1,step:1,options});

const types={vector:'#74c7d7',scalar:'#b49af7',color:'#d4b77f',field:'#93c3ad',image:'#b8f5d0',exec:'#e49e9e'};

const D={};
function def(type,name,cat,glyph,out,inputs,params,body,description,weight=1){D[type]={type,name,cat,glyph,out,inputs,params,body,description,weight}}
def('uv','UV coordinates','Inputs','⌖','vector',[],{scale:num('Scale',1,.01,30)},(n,I,U)=>`return vec4(p*${U('scale')},0.,1.);
`,'Normalized 2D coordinates. Connect to a pattern’s UV input.');

def('time','Time','Inputs','◷','scalar',[],{speed:num('Speed',.2,-5,5),offset:num('Offset',0,-60,60)},(n,I,U)=>`return S(u_time*${U('speed')}+${U('offset')});
`,'Timeline time in seconds, with speed and phase offset.');

def('frame','Frame','Inputs','#','scalar',[],{},()=>`return S(u_frame);
`,'Current integer timeline frame.');

def('clock','Execution clock','Inputs','↯','exec',[],{},()=>`return S(u_frame);
`,'An execution dependency. Connect only to the Output trigger port.');

def('constant','Number','Inputs','1','scalar',[],{value:num('Value',.5,-100,100)},(n,I,U)=>`return S(${U('value')});
`,'A scalar constant;
 automatically broadcasts to vector or color.');

def('vector','Vector','Inputs','↗','vector',[],{x:num('X',.5,-10,10),y:num('Y',.5,-10,10)},(n,I,U)=>`return vec4(${U('x')},${U('y')},0.,1.);
`,'A two-dimensional vector.');

def('color','Color','Inputs','◉','color',[],{color:col('Color','#b8f5d0'),alpha:num('Alpha',1,0,1)},(n,I,U)=>`return vec4(${U('color')},${U('alpha')});
`,'A solid RGBA color.');

for(const[type,name,glyph,expr]of[['add','Add','+','a+b'],['multiply','Multiply','×','a*b'],['divide','Divide','÷','a/(sign(b)*max(abs(b),vec4(.0001))+vec4(.000001))'],['subtract','Subtract','−','a-b']])def(type,name,'Math',glyph,'field',[['A','field'],['B','field']],{a:num('A',.5,-10,10),b:num('B',.5,-10,10)},(n,I,U)=>`vec4 a=${I(0,`S(${U('a')})`)},b=${I(1,`S(${U('b')})`)};
return ${expr};
`,'Per-channel arithmetic. Unconnected inputs use the values below.');

def('remap','Remap','Math','↔','scalar',[['Value','scalar']],{low:num('Input min',0,-10,10),high:num('Input max',1,-10,10),min:num('Output min',0,-10,10),max:num('Output max',1,-10,10)},(n,I,U)=>`float v=${I(0,'S(p.x)')}.r;
return S(mix(${U('min')},${U('max')},(v-${U('low')})/max(.0001,${U('high')}-${U('low')})));
`,'Remap an input interval into a new output range.');

def('clamp','Clamp','Math','⊣','field',[['Value','field']],{min:num('Minimum',0,-10,10),max:num('Maximum',1,-10,10)},(n,I,U)=>`return clamp(${I(0,'S(p.x)')},vec4(${U('min')}),vec4(max(${U('min')},${U('max')})));
`,'Limit every channel to a safe range.');

def('smoothstep','Smoothstep','Math','∫','scalar',[['Value','scalar']],{low:num('Low edge',.35,-2,2),high:num('High edge',.65,-2,2)},(n,I,U)=>`return S(smoothstep(${U('low')},max(${U('low')}+.0001,${U('high')}),${I(0,'S(p.x)')}.r));
`,'A smooth threshold, useful for masks and contour bands.');

def('sine','Sine wave','Math','∿','scalar',[['Value','scalar'],['Phase','scalar']],{frequency:num('Frequency',6,.1,50),phase:num('Phase',0,-20,20)},(n,I,U)=>`return S(.5+.5*sin(${I(0,'S(p.x)')}.r*${U('frequency')}*6.283185+${I(1,`S(${U('phase')})`)}.r));
`,'A repeating wave with an animatable phase input.');

def('gradient','Gradient','Patterns','▥','scalar',[['UV','vector']],{angle:num('Angle',0,-180,180),scale:num('Scale',1,.1,20),mode:opt('Mode',0,['Linear','Radial','Angular'])},(n,I,U)=>`vec2 q=${I(0,'vec4(p,0.,1.)')}.xy-.5;
float a=radians(${U('angle')});
float v=dot(q,vec2(cos(a),sin(a)))+.5;
if(${U('mode')}>.5)v=length(q)*2.;
if(${U('mode')}>1.5)v=atan(q.y,q.x)/6.283185+.5;
return S(v*${U('scale')});
`,'Linear, radial, or angular scalar gradient.');

def('noise','Value noise','Patterns','▧','scalar',[['UV','vector'],['Time','scalar']],{scale:num('Scale',5,.1,40),detail:num('Detail',1,1,1,1)},(n,I,U)=>`vec2 q=${I(0,'vec4(p,0.,1.)')}.xy*${U('scale')};
return S(noise(q+vec2(${I(1,'S(0.)')}.r*.3,u_seed)));
`,'Smooth deterministic lattice noise.');

def('fbm','Fractal noise','Patterns','≋','scalar',[['UV','vector'],['Time','scalar']],{scale:num('Scale',3,.1,25),octaves:num('Octaves',5,1,7,1),roughness:num('Roughness',.53,.1,.85)},(n,I,U)=>`vec2 q=${I(0,'vec4(p,0.,1.)')}.xy*${U('scale')}+u_seed;
float t=${I(1,'S(0.)')}.r;
float f=0.,a=.5,s=0.;
for(int i=0;
i<7;
i++){if(float(i)>=${U('octaves')})break;
f+=a*noise(q+vec2(t*.2,-t*.15));
s+=a;
q=mat2(.8,-.6,.6,.8)*q*2.03+7.1;
a*=${U('roughness')};
}return S(f/max(s,.001));
`,'Layered noise with independently controlled scale, octaves, and roughness.');

def('hash','Random hash','Patterns','⁙','scalar',[['UV','vector']],{scale:num('Cells',30,1,200,1)},(n,I,U)=>`return S(hash21(floor(${I(0,'vec4(p,0.,1.)')}.xy*${U('scale')})+u_seed));
`,'Seeded, deterministic random values per cell.');

def('voronoi','Voronoi cells','Patterns','⬡','scalar',[['UV','vector'],['Time','scalar']],{scale:num('Scale',7,1,30),jitter:num('Jitter',1,0,1),mode:opt('Pattern',0,['Distance','Cell edges','Cell ID'])},(n,I,U)=>`vec2 q=${I(0,'vec4(p,0.,1.)')}.xy*${U('scale')},g=floor(q),f=fract(q);
float d=8.,e=8.,id=0.;
for(int y=-1;
y<=1;
y++)for(int x=-1;
x<=1;
x++){vec2 b=vec2(x,y),r=hash22(g+b+u_seed);
vec2 o=.5+.45*sin(r*6.283185+${I(1,'S(0.)')}.r);
o=mix(vec2(.5),o,${U('jitter')});
float z=length(b+o-f);
if(z<d){e=d;
d=z;
id=r.x;
}else e=min(e,z);
}return S(${U('mode')}<.5?d:(${U('mode')}<1.5?(e-d)*2.:id));
`,'Cellular distance, boundary, or stable cell identity.');

def('shape','Shape / SDF','Patterns','◯','scalar',[['UV','vector']],{shape:opt('Shape',0,['Circle','Box','Diamond','Ring']),radius:num('Radius',.3,.01,1),softness:num('Soft edge',.01,.001,.3)},(n,I,U)=>`vec2 q=${I(0,'vec4(p,0.,1.)')}.xy-.5;
float d=length(q)-${U('radius')};
if(${U('shape')}>.5)d=max(abs(q.x),abs(q.y))-${U('radius')};
if(${U('shape')}>1.5)d=(abs(q.x)+abs(q.y))*.707-${U('radius')};
if(${U('shape')}>2.5)d=abs(length(q)-${U('radius')})-.035;
return S(1.-smoothstep(-${U('softness')},${U('softness')},d));
`,'Antialiased signed-distance primitives converted into a mask.');

def('transform','Transform','Transform','⤢','vector',[['UV','vector']],{scale:num('Scale',1,.05,15),rotate:num('Rotation',0,-360,360),x:num('Offset X',0,-5,5),y:num('Offset Y',0,-5,5)},(n,I,U)=>`vec2 q=${I(0,'vec4(p,0.,1.)')}.xy-.5;
float a=radians(${U('rotate')});
q=mat2(cos(a),-sin(a),sin(a),cos(a))*q/${U('scale')};
return vec4(q+.5+vec2(${U('x')},${U('y')}),0.,1.);
`,'Scale, rotate, and translate the incoming coordinate field.');

def('tile','Tile','Transform','▦','vector',[['UV','vector']],{x:num('Repeat X',4,1,30),y:num('Repeat Y',4,1,30),mirror:opt('Wrap',0,['Repeat','Mirror'])},(n,I,U)=>`vec2 q=${I(0,'vec4(p,0.,1.)')}.xy*vec2(${U('x')},${U('y')});
q=${U('mirror')}<.5?fract(q):abs(fract(q*.5)*2.-1.);
return vec4(q,0.,1.);
`,'Repeat or mirror the UV domain.');

def('polar','Polar coordinates','Transform','◎','vector',[['UV','vector']],{rings:num('Radial scale',2,.1,15),twist:num('Twist',0,-10,10)},(n,I,U)=>`vec2 q=${I(0,'vec4(p,0.,1.)')}.xy-.5;
float r=length(q);
return vec4(atan(q.y,q.x)/6.283185+.5+r*${U('twist')},r*${U('rings')},0.,1.);
`,'Convert Cartesian coordinates into angle and distance.');

def('warp','Domain warp','Transform','≈','vector',[['UV','vector'],['Displacement','scalar']],{strength:num('Strength',.5,-3,3)},(n,I,U)=>`vec2 q=${I(0,'vec4(p,0.,1.)')}.xy;
float a=${I(1,'S(noise(p*4.))')}.r;
float b=${I(1,'S(noise(p*4.+7.))','p+vec2(.37,.19)')}.r;
return vec4(q+(vec2(a,b)-.5)*${U('strength')},0.,1.);
`,'Displace UVs using two offset samples of an input field.',2);

def('distort','Image distortion','Transform','⌁','field',[['Image','field'],['Displacement','scalar']],{strength:num('Strength',.15,-1,1)},(n,I,U)=>`float d=${I(1,'S(noise(p*5.))')}.r-.5;
return ${I(0,'vec4(p,0.,1.)',`p+vec2(d,-d)*${U('strength')}`)};
`,'Resample an image at displaced coordinates.');

def('ramp','Color ramp','Color','◒','color',[['Factor','scalar']],{shadow:col('Shadows','#102b35'),low:col('Low midtones','#284c65'),mid:col('Midtones','#9479b4'),high:col('High midtones','#e7b7ac'),light:col('Highlights','#e6e7c1'),contrast:num('Contrast',1.25,.1,4),offset:num('Offset',0,-1,1)},(n,I,U)=>`float t=clamp((${I(0,'S(p.x)')}.r-.5)*${U('contrast')}+.5+${U('offset')},0.,1.);
vec3 c=mix(${U('shadow')},${U('low')},smoothstep(0.,.25,t));
c=mix(c,${U('mid')},smoothstep(.25,.5,t));
c=mix(c,${U('high')},smoothstep(.5,.75,t));
c=mix(c,${U('light')},smoothstep(.75,1.,t));
return vec4(c,1.);
`,'Five editable color stops map a scalar field to a rich color palette.');

def('blend','Blend','Color','◑','color',[['Base','field'],['Layer','field'],['Mask','scalar']],{opacity:num('Opacity',.5,0,1),mode:opt('Blend mode',0,['Mix','Multiply','Screen','Overlay','Add','Difference'])},(n,I,U)=>`vec4 a=${I(0,'vec4(.1,.3,.4,1.)')},b=${I(1,'vec4(.8,.4,.5,1.)')};
vec3 c=b.rgb;
int m=int(${U('mode')});
if(m==1)c=a.rgb*b.rgb;
if(m==2)c=1.-(1.-a.rgb)*(1.-b.rgb);
if(m==3)c=mix(2.*a.rgb*b.rgb,1.-2.*(1.-a.rgb)*(1.-b.rgb),step(.5,a.rgb));
if(m==4)c=a.rgb+b.rgb;
if(m==5)c=abs(a.rgb-b.rgb);
return vec4(mix(a.rgb,c,clamp(${U('opacity')}*${I(2,'S(1.)')}.r,0.,1.)),mix(a.a,b.a,${U('opacity')}));
`,'Six blend modes with an optional spatial opacity mask.');

def('mask','Alpha mask','Color','◌','color',[['Color','field'],['Mask','scalar']],{invert:opt('Invert mask',0,['Off','On'])},(n,I,U)=>`vec4 c=${I(0,'vec4(1.)')};
float m=${I(1,'S(1.)')}.r;
return vec4(c.rgb,c.a*clamp(${U('invert')}>.5?1.-m:m,0.,1.));
`,'Apply a field to the alpha channel.');

def('invert','Invert','Color','◐','field',[['Value','field']],{},(n,I)=>`vec4 c=${I(0,'S(p.x)')};
return vec4(1.-c.rgb,c.a);
`,'Invert RGB while preserving alpha.');

def('blur','Soft blur','Finish','◍','field',[['Image','field']],{radius:num('Radius',.004,0,.06,.001)},(n,I,U)=>`vec4 c=${I(0,'S(0.)')}*4.;
c+=${I(0,'S(0.)',`p+vec2(${U('radius')},0.)`)}+${I(0,'S(0.)',`p-vec2(${U('radius')},0.)`)}+${I(0,'S(0.)',`p+vec2(0.,${U('radius')})`)}+${I(0,'S(0.)',`p-vec2(0.,${U('radius')})`)};
return c/8.;
`,'A five-tap neighborhood approximation of a soft Gaussian blur.',5);

def('normal','Normal map','Finish','↟','color',[['Height','scalar']],{strength:num('Strength',2,0,10),step:num('Sample step',.003,.001,.03,.001)},(n,I,U)=>`float h=${I(0,'S(0.)')}.r;
float x=${I(0,'S(0.)',`p+vec2(${U('step')},0.)`)}.r-h;
float y=${I(0,'S(0.)',`p+vec2(0.,${U('step')})`)}.r-h;
vec3 v=normalize(vec3(-x,-y,${U('step')}/max(.01,${U('strength')})));
return vec4(v*.5+.5,1.);
`,'Derive a tangent-space normal from finite differences of a height field.',3);

def('light','Surface lighting','Finish','☼','color',[['Color','field'],['Height','scalar']],{strength:num('Relief',1.5,0,8),angle:num('Light angle',125,-180,180),ambient:num('Ambient',.6,0,1)},(n,I,U)=>`float h=${I(1,'S(0.)')}.r;
float x=${I(1,'S(0.)','p+vec2(.002,0.)')}.r-h,y=${I(1,'S(0.)','p+vec2(0.,.002)')}.r-h;
vec3 N=normalize(vec3(-x*${U('strength')},-y*${U('strength')},.01));
float a=radians(${U('angle')});
vec3 L=normalize(vec3(cos(a),sin(a),.7));
float l=${U('ambient')}+(1.-${U('ambient')})*max(0.,dot(N,L));
vec4 c=${I(0,'vec4(.7,.8,.6,1.)')};
return vec4(c.rgb*l+pow(max(0.,dot(reflect(-L,N),vec3(0.,0.,1.))),24.)*.16,c.a);
`,'Diffuse relief lighting and a soft specular highlight from a height field.',3);

def('output','Output','Finish','↗','image',[['Surface','field'],['Trigger','exec']],{exposure:num('Exposure',1,.1,3),alpha:num('Opacity',1,0,1)},(n,I,U)=>`vec4 c=${I(0,'vec4(0.,0.,0.,0.)')};
return vec4(c.rgb*${U('exposure')},c.a*${U('alpha')});
`,'Final image. The optional execution port explicitly orders evaluation.');

const defaults=type=>Object.fromEntries(Object.entries(D[type].params).map(([k,v])=>[k,v.value]));

const presetNames=['Chromatic currents','Italian marble','Heartwood','Cloud atlas','Molten core','Circuit garden','Cellular bloom','Neon passage','Alpine terrain','Electric plasma'];

const presetDescriptions=['Fluid color · animated','Veined stone · layered','Growth rings · organic','Atmosphere · soft','Volcanic flow · animated','Etched circuitry · geometric','Living cells · animated','Radial geometry · animated','24 nodes · height & normals','Wave interference · animated'];

function makePreset(index=0){let id=0;
const g={version:1,name:presetNames[index],nodes:[],edges:[],frames:[],timeline:{duration:8,fps:30,time:0,loop:true,interpolation:'smooth'},settings:{resolution:512,seed:7,aa:1,colorSpace:0,quality:1,cache:true,grid:true,snap:false,theme:'dark',limit:30,diagnostic:0}};
function n(type,p={},label){const z={id:++id,type,x:0,y:0,p:{...defaults(type),...p},keys:{}};
if(label)z.label=label;
g.nodes.push(z);
return z.id}function e(a,b,port=0){g.edges.push({from:a,to:b,port});
return b}const uv=n('uv'),time=n('time',{speed:.22});
let field, color;

if(index===0||index===1||index===4){const f=n('fbm',{scale:index===1?2.4:2.8,roughness:.56}),w=n('warp',{strength:index===1?.8:1.4}),f2=n('fbm',{scale:2.8,octaves:4,roughness:.46}),s=n('sine',{frequency:index===1?5:2.8});
e(uv,f);
e(time,f,1);
e(uv,w);
e(f,w,1);
e(w,f2);
e(time,f2,1);
e(f2,s);
e(time,s,1);
field=s;
color=n('ramp',index===1?{shadow:'#182421',low:'#768981',mid:'#d0d7c3',high:'#f0f0de',light:'#faf5e3',contrast:1.5}:index===4?{shadow:'#0e101a',low:'#21172c',mid:'#951d36',high:'#f86724',light:'#ffe3a0',contrast:1.8}:{});
e(field,color);
const l=n('light',{strength:index===0?.8:1.7,ambient:.8});
e(color,l);
e(f2,l,1);
color=l}
if(index===2){const t=n('transform',{scale:.85,rotate:30}),p=n('polar',{rings:2,twist:.1}),f=n('fbm',{scale:7,roughness:.4}),w=n('warp',{strength:.05}),gr=n('gradient',{angle:90,scale:1.3}),s=n('sine',{frequency:19});
e(uv,t);
e(t,p);
e(uv,f);
e(p,w);
e(f,w,1);
e(w,gr);
e(gr,s);
field=s;
color=n('ramp',{shadow:'#23170f',low:'#553223',mid:'#9d6035',high:'#c99455',light:'#eed4a0',contrast:1});
e(s,color)}
if(index===3){const t=n('transform',{scale:1.3,rotate:15}),f=n('fbm',{scale:4,octaves:6,roughness:.6}),f2=n('noise',{scale:12}),b=n('blend',{mode:2,opacity:.3}),sm=n('smoothstep',{low:.24,high:.8});
e(uv,t);
e(t,f);
e(time,f,1);
e(t,f2);
e(f,b);
e(f2,b,1);
e(b,sm);
field=sm;
color=n('ramp',{shadow:'#182b4f',low:'#405d83',mid:'#93abbc',high:'#dde3d8',light:'#fff3dd'});
e(sm,color);
const blur=n('blur',{radius:.008});
e(color,blur);
color=blur}
if(index===5){const t=n('transform',{rotate:45}),til=n('tile',{x:8,y:8}),shape=n('shape',{shape:1,radius:.4,softness:.015}),v=n('voronoi',{scale:8,mode:1,jitter:0}),sm=n('smoothstep',{low:.2,high:.29}),mult=n('multiply');
e(uv,t);
e(t,til);
e(til,shape);
e(t,v);
e(v,sm);
e(sm,mult);
e(shape,mult,1);
field=mult;
color=n('ramp',{shadow:'#071b1e',low:'#0c4540',mid:'#318777',high:'#a3bc78',light:'#e2f2b8',contrast:1.5});
e(mult,color)}
if(index===6){const f=n('fbm',{scale:3}),w=n('warp',{strength:.23}),v=n('voronoi',{scale:8,mode:1}),s=n('smoothstep',{low:.04,high:.7});
e(uv,f);
e(time,f,1);
e(uv,w);
e(f,w,1);
e(w,v);
e(time,v,1);
e(v,s);
field=s;
color=n('ramp',{shadow:'#071e2a',low:'#114e56',mid:'#47937b',high:'#e5b3b5',light:'#f6e7c9'});
e(s,color);
const l=n('light',{strength:2,ambient:.7});
e(color,l);
e(s,l,1);
color=l}
if(index===7){const p=n('polar',{rings:5,twist:1}),t=n('transform',{rotate:0,scale:1}),gr=n('gradient',{angle:90}),s=n('sine',{frequency:5}),f=n('fbm',{scale:5}),m=n('multiply',{b:.9});
e(uv,p);
e(p,t);
t&&Object.assign(g.nodes.find(x=>x.id===t).keys,{y:[{t:0,v:0},{t:8,v:1.6}]});
e(t,gr);
e(gr,s);
e(time,s,1);
e(uv,f);
e(s,m);
e(f,m,1);
field=m;
color=n('ramp',{shadow:'#090923',low:'#302367',mid:'#8744c2',high:'#f277ca',light:'#a5fff0',contrast:2});
e(m,color)}
if(index===8){const t=n('transform',{rotate:23,scale:1.2}),f=n('fbm',{scale:3.2,octaves:6,roughness:.6}),f2=n('fbm',{scale:8,octaves:4}),w=n('warp',{strength:.25}),mix=n('blend',{opacity:.25,mode:0}),r=n('remap',{low:.15,high:.85}),cl=n('clamp'),height=n('smoothstep',{low:.1,high:.95});
e(uv,t);
e(t,f);
e(t,f2);
e(uv,w);
e(f2,w,1);
const f3=n('fbm',{scale:3,octaves:5});
e(w,f3);
e(f,mix);
e(f3,mix,1);
e(mix,r);
e(r,cl);
e(cl,height);
field=height;
color=n('ramp',{shadow:'#163d53',low:'#347677',mid:'#768b51',high:'#b4ae83',light:'#eef1df'});
e(height,color);
const norm=n('normal',{strength:2},'Terrain normals');
e(height,norm);
const li=n('light',{strength:3,ambient:.4});
e(color,li);
e(height,li,1);
color=li;
const grad=n('gradient',{angle:90}),snow=n('smoothstep',{low:.72,high:.8}),rock=n('noise',{scale:28}),rockRamp=n('ramp',{shadow:'#323c38',light:'#a5aa97'}),mul=n('multiply',{b:.1}),add=n('add'),mask=n('mask'),colN=n('color',{color:'#f0edda'});
e(height,snow);
e(uv,grad);
e(uv,rock);
e(rock,rockRamp);
e(rock,mul);
e(mul,add);
e(height,add,1);
e(colN,mask);
e(snow,mask,1);
const b=n('blend',{opacity:.3});
e(color,b);
e(mask,b,1);
e(snow,b,2);
color=b}
if(index===9){const t=n('transform',{rotate:35}),gr=n('gradient',{angle:0,scale:2}),gr2=n('gradient',{angle:90,scale:2}),s1=n('sine',{frequency:2}),s2=n('sine',{frequency:3}),b=n('blend',{opacity:.5}),f=n('fbm',{scale:2}),add=n('blend',{opacity:.25});
e(uv,t);
e(t,gr);
e(t,gr2);
e(gr,s1);
e(time,s1,1);
e(gr2,s2);
e(time,s2,1);
e(s1,b);
e(s2,b,1);
e(uv,f);
e(time,f,1);
e(b,add);
e(f,add,1);
field=add;
color=n('ramp',{shadow:'#0f1e52',low:'#36559d',mid:'#e255a0',high:'#ffc089',light:'#f3ffe3',contrast:1.7});
e(add,color)}
const out=n('output');
e(color,out);
const positions=[[30,70],[30,244],[220,70],[220,244],[410,70],[410,244],[30,428],[220,428],[410,428]];
g.nodes.forEach((n,i)=>{const p=positions[i]||[30+(i%5)*190,70+Math.floor(i/5)*183];
n.x=p[0];
n.y=p[1]});
if(g.nodes.length>9)g.nodes.forEach((n,i)=>{n.x=30+(i%4)*190;
n.y=70+Math.floor(i/4)*180});
g.frames=[{x:13,y:51,w:g.nodes.length>9?745:566,h:347,label:'01  /  GENERATIVE FIELD'},{x:13,y:409,w:g.nodes.length>9?745:566,h:165,label:'02  /  COLOR & SURFACE'}];
return g}
let project=makePreset(0),selection=new Set([7]),view={x:0,y:0,z:1},previewView={z:1,x:0,y:0,tile:false,channel:0,compare:false},settingsTab=false,activeParam='contrast',history=[],future=[],clipboard=null,pendingPort=null,spaceHeld=false,interaction=null,needsRender=true,thumbsNeeded=true,lastThumbnail=0,dirty=new Set(),autosaveTimer,playing=true,frameCount=0,fpsMeasured=0,compileStatus='ready',compileError='',evalMs=0,sourceText='',renderCount=0,exporting=false,toastTimer, lastDraw=0,frameStart=0,lastFpsTime=0,glProgram=null,uniforms={},programCache=new Map(),thumbData=new Map();

const glCanvas=document.createElement('canvas'),gl=glCanvas.getContext('webgl2',{preserveDrawingBuffer:true,alpha:true,antialias:false,premultipliedAlpha:false});
const previewCanvas=$('#previewCanvas'),ctx=previewCanvas.getContext('2d',{willReadFrequently:true});

const GLSL=`#version 300 es
precision highp float;

uniform float u_time,u_frame,u_seed;

uniform vec2 u_resolution;

uniform int u_root,u_diag,u_aa,u_tile,u_srgb;

out vec4 frag;

vec4 S(float v){return vec4(v,v,v,1.);
}
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));
p+=dot(p,p+45.32);
return fract(p.x*p.y);
}
vec2 hash22(vec2 p){return vec2(hash21(p),hash21(p+17.7));
}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);
f=f*f*(3.-2.*f);
return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.),f.x),f.y);
}
`;

const VS=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
gl_Position=vec4(p*2.-1.,0.,1.);
}`;

function buildSource(g){const valid=GraphCore.validate(g,D);
if(!valid.ok)throw Error(valid.error);
let text=GLSL,cost={};
for(const n of valid.order){const d=D[n.type];
cost[n.id]=1+g.edges.filter(e=>e.to===n.id).reduce((sum,e)=>sum+(cost[e.from]||1),0)*d.weight;
if(cost[n.id]>3500)throw Error(`Node ${n.id} (${d.name}) exceeds the safe sampling budget. Reduce nested blur, lighting, or warp.`);
for(const[k,p]of Object.entries(d.params))text+=`uniform ${p.kind==='color'?'vec3':'float'} n${n.id}_${k};
\n`;
const U=k=>`n${n.id}_${k}`;
const I=(port,fallback='S(0.)',coord='p')=>{const edge=g.edges.find(e=>e.to===n.id&&e.port===port);
if(!edge)return fallback;
const source=g.nodes.find(n=>n.id===edge.from),a=D[source.type].out,b=d.inputs[port][1],call=`f${edge.from}(${coord})`;
if(b==='scalar'&&a!=='scalar')return`S(dot(${call}.rgb,vec3(.2126,.7152,.0722)))`;
if(a==='scalar'&&b==='vector')return`vec4(${call}.rr,0.,1.)`;
return call};
text+=`// NODE ${n.id}: ${d.name}\nvec4 f${n.id}(vec2 p){${d.body(n,I,U)}}\n`}
text+='vec4 sampleGraph(vec2 p){\n';
for(const n of g.nodes)text+=`if(u_root==${n.id})return f${n.id}(p);
\n`;
text+='return vec4(0.);
}\n';
text+=`void main(){vec2 p=gl_FragCoord.xy/u_resolution;
 p.y=1.-p.y;
if(u_tile==1)p=fract(p*3.);
vec4 c=sampleGraph(p);
if(u_aa==1){vec2 d=.35/u_resolution;
c=(sampleGraph(p+d)+sampleGraph(p-d)+sampleGraph(p+vec2(d.x,-d.y))+sampleGraph(p+vec2(-d.x,d.y)))*.25;
}float l=dot(c.rgb,vec3(.2126,.7152,.0722));
if(u_diag>=1&&u_diag<=4)c=vec4(vec3(c[u_diag-1]),1.);
if(u_diag==5)c=vec4(vec3(l),1.);
if(u_diag==6){float x=dot(sampleGraph(p+vec2(.002,0.)).rgb,vec3(.2126,.7152,.0722))-l;
float y=dot(sampleGraph(p+vec2(0.,.002)).rgb,vec3(.2126,.7152,.0722))-l;
c=vec4(normalize(vec3(-x,-y,.01))*.5+.5,1.);
}if(u_diag==7)c=vec4(fract(vec3(.137,.413,.731)*float(u_root))*(.35+.65*clamp(l,0.,1.)),1.);
if(u_diag==8)c=vec4(l<0.?vec3(.1,.4,1.):(l>1.?vec3(1.,.2,.1):vec3(0.,l,.2)),1.);
if(u_diag==9)c=vec4(any(isnan(c))||any(isinf(c))?vec3(1.,0.,.7):vec3(.035,.07,.045),1.);
if(u_srgb==1&&u_diag==0)c.rgb=pow(max(c.rgb,vec3(0.)),vec3(1./2.2));
frag=clamp(c,0.,1.);
}`;
return text}
function shader(type,src){const s=gl.createShader(type);
gl.shaderSource(s,src);
gl.compileShader(s);
if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);
gl.deleteShader(s);
throw Error(log)}return s}
function getProgram(src){if(programCache.has(src)&&project.settings.cache)return programCache.get(src);
const v=shader(gl.VERTEX_SHADER,VS),f=shader(gl.FRAGMENT_SHADER,src),p=gl.createProgram();
gl.attachShader(p,v);
gl.attachShader(p,f);
gl.linkProgram(p);
gl.deleteShader(v);
gl.deleteShader(f);
if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const log=gl.getProgramInfoLog(p);
gl.deleteProgram(p);
throw Error(log)}programCache.set(src,p);
while(programCache.size>5){const[key,val]=programCache.entries().next().value;
if(val!==glProgram)gl.deleteProgram(val);
programCache.delete(key)}return p}
function outputId(g=project){return g.nodes.find(n=>n.type==='output')?.id||g.nodes.at(-1)?.id||0}
function rootId(){return Number($('#previewTarget').value)||outputId()}
function compile(){if(!gl){compileStatus='error';
compileError='WebGL 2 is unavailable. Enable hardware acceleration or use a WebGL 2 capable browser. The graph remains editable.';
displayError();
return}try{const src=buildSource(project);
const p=getProgram(src);
glProgram=p;
sourceText=src;
uniforms={};
compileStatus='ready';
compileError='';
const out=project.nodes.find(n=>n.type==='output');
if(!out)compileError='No Output node. Add Output and connect a surface to finish your graph.';
else if(!project.edges.some(e=>e.to===out.id&&e.port===0))compileError=`Output #${out.id} has no Surface connection. Connect a field, color, or image.`;
if(compileError)compileStatus='incomplete';
needsRender=true;
thumbsNeeded=true}catch(e){compileStatus='error';
compileError=e.message+' Last valid preview retained.';
console.warn('Graph compilation:',e.message)}displayError();
updateStatus()}
function displayError(){$('#errorBanner').hidden=!compileError;
$('#errorBanner').textContent=compileError;
$('#livePill').innerHTML=compileStatus==='error'?'PREVIEW HELD':playing?'<span class="dot"></span>LIVE':'PAUSED'}
function u(name){return uniforms[name]??(uniforms[name]=gl.getUniformLocation(glProgram,name))}
function hexRGB(hex){return[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)}
function valueAt(n,k,time=project.timeline.time){return GraphCore.sampleKeys(n.keys?.[k],time,project.timeline.interpolation)??n.p[k]??D[n.type].params[k].value}
function renderGL(size,root,time,diag=0,tile=false,aa=project.settings.aa,g=project){glCanvas.width=size;
glCanvas.height=size;
gl.viewport(0,0,size,size);
gl.useProgram(glProgram);
gl.uniform1f(u('u_time'),time);
gl.uniform1f(u('u_frame'),Math.floor(time*g.timeline.fps+.0001));
gl.uniform1f(u('u_seed'),g.settings.seed);
gl.uniform2f(u('u_resolution'),size,size);
gl.uniform1i(u('u_root'),root);
gl.uniform1i(u('u_diag'),diag);
gl.uniform1i(u('u_aa'),aa);
gl.uniform1i(u('u_tile'),tile?1:0);
gl.uniform1i(u('u_srgb'),g.settings.colorSpace);
for(const n of g.nodes)for(const[k,p]of Object.entries(D[n.type].params)){const value=GraphCore.sampleKeys(n.keys?.[k],time,g.timeline.interpolation)??n.p[k]??p.value;
if(p.kind==='color')gl.uniform3fv(u(`n${n.id}_${k}`),hexRGB(value));
else gl.uniform1f(u(`n${n.id}_${k}`),value)}gl.drawArrays(gl.TRIANGLES,0,3)}
function drawPreview(){if(!glProgram||compileStatus==='error')return;
const start=performance.now();
const size=Number(project.settings.resolution),diag=previewView.channel||project.settings.diagnostic;
renderGL(size,rootId(),project.timeline.time,diag>9?0:diag,previewView.tile);
if(previewCanvas.width!==size){previewCanvas.width=size;
previewCanvas.height=size}ctx.clearRect(0,0,size,size);
ctx.drawImage(glCanvas,0,0);
evalMs=performance.now()-start;
dirty.clear();
needsRender=false;
renderCount++;
$('#previewSizeLabel').textContent=`${size} × ${size}`;
if(diag===10||diag===11||diag===12){ctx.font=`${size/32}px monospace`;
ctx.fillStyle='#0b131de0';
ctx.fillRect(0,0,size,size/7);
ctx.fillStyle='#b8f5d0';
ctx.fillText(diag===10?`CPU submit + copy: ${evalMs.toFixed(1)} ms`:diag===11?`Program cache: ${programCache.size} · ${dirty.size} dirty`:`Preview: ${size} × ${size} · ${project.settings.aa?'4×':'1×'} AA`,size/30,size/12)}if(thumbsNeeded&&performance.now()-lastThumbnail>350&&project.settings.quality>0){drawThumbnails();
lastThumbnail=performance.now();
thumbsNeeded=false}}
function drawThumbnails(){if(!glProgram||compileStatus==='error')return;
for(const canvas of $$('.node-preview')){const id=Number(canvas.dataset.node);
renderGL(project.settings.quality===2?128:64,id,project.timeline.time,0,false,0);
const c=canvas.getContext('2d');
c.clearRect(0,0,134,44);
c.drawImage(glCanvas,0,0,134,44)} }
function snapshot(){return JSON.stringify(project)}function checkpoint(){history.push(snapshot());
if(history.length>70)history.shift();
future=[];
updateHistory()}
function updateHistory(){$('#undoBtn').disabled=!history.length;
$('#redoBtn').disabled=!future.length}
function markDirty(id){const visit=x=>{if(dirty.has(x))return;
dirty.add(x);
project.edges.filter(e=>e.from===x).forEach(e=>visit(e.to))};
if(id)visit(id);
else project.nodes.forEach(n=>dirty.add(n.id));
needsRender=true;
thumbsNeeded=true;
autosave();
updateStatus()}
function autosave(){clearTimeout(autosaveTimer);
$('#autosaveState').textContent='◌ Saving…';
$('#saveLabel').innerHTML='<span class="dot"></span>Saving changes…';
autosaveTimer=setTimeout(()=>{try{localStorage.setItem('formlab-autosave-v1',snapshot());
$('#autosaveState').textContent='✓ Autosaved';
$('#saveLabel').innerHTML='<span class="dot"></span>All changes saved'}catch(e){$('#autosaveState').textContent='Storage unavailable';
$('#saveLabel').textContent='Save JSON to keep your work'}},500)}
function toast(text,error=false){clearTimeout(toastTimer);
$('#toast').textContent=text;
$('#toast').className='toast show'+(error?' error':'');
toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4200)}
function applyHistory(from,to){if(!from.length)return;
to.push(snapshot());
project=JSON.parse(from.pop());
selection=new Set([...selection].filter(id=>project.nodes.some(n=>n.id===id)));
syncUI();
renderGraph();
renderInspector();
compile();
markDirty();
updateHistory()}
function refreshGraph(semantic=true){renderGraph();
renderInspector();
syncTargets();
if(semantic)compile();
markDirty()}
function selectedNode(){return project.nodes.find(n=>selection.has(n.id))}
function selectNode(id,multi=false){if(!multi)selection.clear();
if(multi&&selection.has(id))selection.delete(id);
else selection.add(id);
$$('.node').forEach(el=>el.classList.toggle('selected',selection.has(Number(el.dataset.id))));
settingsTab=false;
renderInspector();
updateStatus();
drawTimeline()}
function portPos(n,port,out=false){return{x:n.x+(out?156:0),y:n.y+32+(n.collapsed?2:8)+11+(out?0:port*22)}}
function pathWire(a,b){const dx=Math.max(40,Math.abs(b.x-a.x)*.5);
return`M${a.x},${a.y} C${a.x+dx},${a.y} ${b.x-dx},${b.y} ${b.x},${b.y}`}
function renderWires(){const lines=project.edges.map((e,i)=>{const a=project.nodes.find(n=>n.id===e.from),b=project.nodes.find(n=>n.id===e.to);
if(!a||!b)return'';
return`<path class="wire" data-edge="${i}" d="${pathWire(portPos(a,0,true),portPos(b,e.port))}" stroke="${types[D[a.type].out]}" aria-label="${escapeHTML(D[a.type].name)} to ${escapeHTML(D[b.type].name)}"/>`}).join('');
$('#wires').innerHTML=lines+'<path id="wirePreview" class="wire-preview"/>';
$$('.wire').forEach(el=>el.addEventListener('dblclick',e=>{e.stopPropagation();
checkpoint();
project.edges.splice(Number(el.dataset.edge),1);
refreshGraph();
toast('Connection removed')}));
if(pendingPort)drawConnectionPreview(pendingPort.point)}
function renderGraph(){const layer=$('#nodesLayer');
layer.innerHTML=project.nodes.map(n=>{const d=D[n.type],color=types[d.out],rows=Math.max(1,d.inputs.length);
return`<article class="node ${selection.has(n.id)?'selected':''} ${n.collapsed?'collapsed':''}" data-id="${n.id}" style="left:${n.x}px;
top:${n.y}px;
--node-color:${color}" aria-label="${escapeHTML(n.label||d.name)} node ${n.id}"><div class="node-head" data-drag="${n.id}"><span class="node-glyph">${d.glyph}</span><span class="node-name">${escapeHTML(n.label||d.name)}</span><button data-collapse="${n.id}" aria-label="${n.collapsed?'Expand':'Collapse'} ${escapeHTML(d.name)}">${n.collapsed?'+':'−'}</button></div><div class="node-body">${Array.from({length:rows},(_,i)=>`<div class="port-row">${d.inputs[i]?`<button class="port in" data-id="${n.id}" data-port="${i}" data-dir="in" aria-label="${escapeHTML(d.name)} ${n.id} input ${d.inputs[i][0]} (${d.inputs[i][1]})" title="${d.inputs[i][1]} · Alt-click to disconnect" style="--port-color:${types[d.inputs[i][1]]}"></button><span>${d.inputs[i][0]}</span>`:'<span></span>'}${i===0?`<span class="port-label">${d.out}</span><button class="port out" data-id="${n.id}" data-port="0" data-dir="out" aria-label="${escapeHTML(d.name)} ${n.id} output (${d.out})" title="${d.out}" style="--port-color:${color}"></button>`:''}</div>`).join('')}<canvas class="node-preview" width="134" height="44" data-node="${n.id}" aria-label="${escapeHTML(d.name)} intermediate preview"></canvas><div class="node-info"><span>${Object.keys(d.params)[0]?escapeHTML(d.params[Object.keys(d.params)[0]].label):'Evaluated'}</span><b>${nodeSummary(n)}</b></div></div></article>`}).join('');
$('#framesLayer').innerHTML=(project.frames||[]).map((f,i)=>f.comment?`<div class="comment" data-comment="${i}" style="left:${f.x}px;
top:${f.y}px">${escapeHTML(f.label)}</div>`:`<div class="frame" style="left:${f.x}px;
top:${f.y}px;
width:${f.w}px;
height:${f.h}px"><span class="frame-label">${escapeHTML(f.label)}</span></div>`).join('');
if(!project.nodes.length)layer.innerHTML='<div class="empty" style="position:absolute;
left:50px;
top:100px;
width:260px"><strong>Your next idea starts here.</strong>Add a pattern, connect a Color ramp, then finish with an Output node.<br>Press Tab to explore the library.</div>';
renderWires();
applyView();
$('#graphCount').textContent=project.nodes.length+' nodes';
thumbsNeeded=true}
function nodeSummary(n){const k=Object.keys(D[n.type].params)[0];
if(!k)return'✓';
const v=n.p[k];
return typeof v==='string'?v.toUpperCase():Number(v).toFixed(Number.isInteger(v)?0:2)}
function applyView(){view.z=clamp(view.z,.18,2.4);
$('#graphWorld').style.transform=`translate(${view.x}px,${view.y}px) scale(${view.z})`;
$('#graphArea').style.backgroundSize=`${20*view.z}px ${20*view.z}px`;
$('#graphArea').style.backgroundPosition=`${view.x}px ${view.y}px`;
$('#graphZoom').textContent=Math.round(view.z*100)+'%';
drawMinimap()}
function graphBounds(){if(!project.nodes.length)return{x:0,y:0,w:500,h:400};
return{x:Math.min(...project.nodes.map(n=>n.x))-20,y:Math.min(...project.nodes.map(n=>n.y))-35,w:Math.max(...project.nodes.map(n=>n.x+156))-Math.min(...project.nodes.map(n=>n.x))+40,h:Math.max(...project.nodes.map(n=>n.y+155))-Math.min(...project.nodes.map(n=>n.y))+65}}
function fitGraph(){const b=graphBounds(),r=$('#graphArea').getBoundingClientRect();
if(r.width===0)return;
view.z=clamp(Math.min((r.width-36)/b.w,(r.height-106)/b.h),.18,1.12);
view.x=(r.width-b.w*view.z)/2-b.x*view.z;
view.y=(r.height-b.h*view.z)/2-b.y*view.z-7;
applyView()}
function zoomGraph(f,x,y){const r=$('#graphArea').getBoundingClientRect();
x??=r.width/2;
y??=r.height/2;
const z=clamp(view.z*f,.18,2.4);
view.x=x-(x-view.x)*z/view.z;
view.y=y-(y-view.y)*z/view.z;
view.z=z;
applyView()}
function graphPoint(x,y){const r=$('#graphArea').getBoundingClientRect();
return{x:(x-r.left-view.x)/view.z,y:(y-r.top-view.y)/view.z}}
function drawMinimap(){const c=$('#minimap'),ctx=c.getContext('2d'),b=graphBounds(),scale=Math.min(188/b.w,120/b.h),ox=(208-b.w*scale)/2,oy=(140-b.h*scale)/2;
ctx.clearRect(0,0,208,140);
ctx.fillStyle='#222830';
for(const n of project.nodes){ctx.fillStyle=selection.has(n.id)?'#a2d7b6':'#536775';
ctx.fillRect(ox+(n.x-b.x)*scale,oy+(n.y-b.y)*scale,156*scale,100*scale)}const r=$('#graphArea').getBoundingClientRect();
ctx.strokeStyle='#a4d8b880';
ctx.lineWidth=1;
ctx.strokeRect(ox+(-view.x/view.z-b.x)*scale,oy+(-view.y/view.z-b.y)*scale,r.width/view.z*scale,r.height/view.z*scale);
c._map={b,scale,ox,oy}}
function addNode(type,point){if(project.nodes.length>=80)return toast('The graph is limited to 80 nodes.',true);
checkpoint();
const r=$('#graphArea').getBoundingClientRect(),p=point||graphPoint(r.left+r.width/2,r.top+r.height/2);
const n={id:Math.max(0,...project.nodes.map(n=>n.id))+1,type,x:Math.round(p.x-78),y:Math.round(p.y-60),p:defaults(type),keys:{}};
project.nodes.push(n);
selection=new Set([n.id]);
refreshGraph();
toast(D[type].name+' added');
return n}
function connect(from,to,port){const edges=project.edges.filter(e=>!(e.to===to&&e.port===port));
edges.push({from,to,port});
const valid=GraphCore.validate({...project,edges},D);
if(!valid.ok){toast(valid.error,true);
return false}checkpoint();
project.edges=edges;
refreshGraph();
toast('Connected · '+D[project.nodes.find(n=>n.id===from).type].out+' → '+D[project.nodes.find(n=>n.id===to).type].inputs[port][1]);
return true}
function disconnect(id,port){if(!project.edges.some(e=>e.to===id&&e.port===port))return toast('This input is already disconnected');
checkpoint();
project.edges=project.edges.filter(e=>!(e.to===id&&e.port===port));
refreshGraph();
toast('Connection removed')}
function deleteSelection(){if(!selection.size)return;
checkpoint();
project.nodes=project.nodes.filter(n=>!selection.has(n.id));
project.edges=project.edges.filter(e=>!selection.has(e.from)&&!selection.has(e.to));
selection.clear();
refreshGraph();
toast('Selection deleted')}
function copySelection(){if(!selection.size)return;
clipboard={nodes:clone(project.nodes.filter(n=>selection.has(n.id))),edges:clone(project.edges.filter(e=>selection.has(e.from)&&selection.has(e.to)))};
toast(`${clipboard.nodes.length} node${clipboard.nodes.length===1?'':'s'} copied`)}
function pasteSelection(){if(!clipboard)return toast('Select and copy some nodes first');
if(project.nodes.length+clipboard.nodes.length>80)return toast('Pasting would exceed the 80-node limit.',true);
checkpoint();
let id=Math.max(0,...project.nodes.map(n=>n.id));
const map={};
selection.clear();
for(const old of clipboard.nodes){const n=clone(old);
map[n.id]=++id;
n.id=id;
n.x+=36;
n.y+=36;
project.nodes.push(n);
selection.add(n.id)}for(const e of clipboard.edges)project.edges.push({...e,from:map[e.from],to:map[e.to]});
refreshGraph();
toast('Pasted '+selection.size+' nodes')}
function duplicateSelection(){copySelection();
pasteSelection()}
function frameSelection(){if(!selection.size)return toast('Select nodes to frame first');
checkpoint();
const a=project.nodes.filter(n=>selection.has(n.id)),x=Math.min(...a.map(n=>n.x))-15,y=Math.min(...a.map(n=>n.y))-20;
project.frames.push({x,y,w:Math.max(...a.map(n=>n.x+156))-x+15,h:Math.max(...a.map(n=>n.y+155))-y+15,label:'CREATIVE EXPLORATION'});
refreshGraph(false);
toast('Selection framed · drag any selected node to move the selection')}
function renderCatalog(query=''){const q=query.toLowerCase().trim();
const cats=['Inputs','Math','Patterns','Transform','Color','Finish'];
$('#libraryCount').textContent=Object.keys(D).length;
$('#catalog').innerHTML=cats.map(cat=>{const a=Object.values(D).filter(d=>d.cat===cat&&(!q||(d.name+' '+d.description).toLowerCase().includes(q)));
if(!a.length)return'';
return`<div class="category"><button class="category-toggle" data-category="${cat}"><span>${cat}</span><span>⌄</span></button><div class="category-items">${a.map(d=>`<button class="node-choice" data-add="${d.type}"><span class="tile" style="color:${types[d.out]};
background:${types[d.out]}0b;
border-color:${types[d.out]}19">${d.glyph}</span>${d.name}<span class="plus">+</span></button>`).join('')}</div></div>`}).join('')||'<div class="empty">No matching nodes.<br>Try “noise” or “color”.</div>';
$$('[data-add]').forEach(b=>b.onclick=()=>addNode(b.dataset.add));
$$('.category-toggle').forEach(b=>b.onclick=()=>{const x=b.nextElementSibling;
x.hidden=!x.hidden;
b.lastElementChild.textContent=x.hidden?'›':'⌄'})}
function syncTargets(){const selected=$('#previewTarget').value;
$('#previewTarget').innerHTML='<option value="0">Final output</option>'+project.nodes.filter(n=>n.type!=='output'&&D[n.type].out!=='exec').map(n=>`<option value="${n.id}">${escapeHTML(n.label||D[n.type].name)} #${n.id}</option>`).join('');
$('#previewTarget').value=[...$('#previewTarget').options].some(o=>o.value===selected)?selected:'0'}
function renderInspector(){const n=selectedNode();
$('#propertiesTab').classList.toggle('active',!settingsTab);
$('#settingsTab').classList.toggle('active',settingsTab);
$('#nodeIdLabel').textContent=settingsTab?'PROJECT':n?'NODE '+String(n.id).padStart(3,'0'):'NO SELECTION';
if(settingsTab){renderSettings();
return}if(!n){$('#inspectorContent').innerHTML='<div class="empty"><strong>Make it your own.</strong>Select a node to adjust its parameters.<br>Double-click the graph to add a new idea.</div>';
return}const d=D[n.type];
if(!d.params[activeParam])activeParam=Object.keys(d.params).find(k=>d.params[k].kind!=='color')||Object.keys(d.params)[0];
let h=`<div class="inspector-heading"><span class="node-glyph">${d.glyph}</span><strong>${escapeHTML(n.label||d.name)}</strong><small>${d.cat} / ${d.out}</small><button class="icon-btn" id="inspectNode" aria-label="Preview selected node" title="Preview this node">${icon('eye')}</button></div>`;
const colors=Object.entries(d.params).filter(([k,p])=>p.kind==='color');
if(n.type==='ramp'){h+=`<div class="ramp-strip" style="background:linear-gradient(90deg,${colors.map(([k])=>n.p[k]).join(',')})"></div><div class="color-stops">${colors.map(([k,p])=>`<div class="color-stop"><input type="color" data-param="${k}" value="${n.p[k]}" aria-label="${p.label}" title="${p.label}"><button class="key-btn ${n.keys[k]?.length?'active':''}" data-key="${k}" aria-label="Keyframe ${p.label}">◇</button></div>`).join('')}</div>`}for(const[k,p]of Object.entries(d.params)){if(n.type==='ramp'&&p.kind==='color')continue;
h+=`<div class="param-row"><label for="param-${k}">${p.label}</label>${p.kind==='color'?`<input type="color" id="param-${k}" data-param="${k}" value="${n.p[k]}" aria-label="${p.label}"><span class="mono subtle" style="flex:1;
font-size:10px">${n.p[k].toUpperCase()}</span>`:p.options?`<select id="param-${k}" data-param="${k}" aria-label="${p.label}">${p.options.map((o,i)=>`<option value="${i}" ${n.p[k]===i?'selected':''}>${o}</option>`).join('')}</select>`:`<input type="range" id="param-${k}" data-param="${k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${n.p[k]}" aria-label="${p.label}"><input type="number" data-param="${k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${n.p[k]}" aria-label="${p.label} value">`}<button class="key-btn ${n.keys[k]?.length?'active':''}" data-key="${k}" aria-label="Keyframe ${p.label}" title="Add keyframe at current time">◇</button></div>`}h+=`<p class="inspector-note">${d.description}</p>`;
h+=d.inputs.map(([label,type],i)=>{const e=project.edges.find(e=>e.to===n.id&&e.port===i),src=e&&project.nodes.find(n=>n.id===e.from);
return`<div class="connection-row"><span>${label} <small class="subtle">${src?'← '+escapeHTML(src.label||D[src.type].name):'· default '+type}</small></span>${e?`<button data-disconnect="${i}" aria-label="Disconnect ${label}">Disconnect ×</button>`:''}</div>`}).join('');
h+=`<div class="connection-row"><span>Node actions</span><div><button id="renameNode">Rename</button><button id="deleteNode">Delete</button></div></div>`;
$('#inspectorContent').innerHTML=h;
$$('[data-param]').forEach(input=>{let changed=false;
input.addEventListener('focus',()=>{changed=false;
activeParam=input.dataset.param;
drawTimeline()});
input.addEventListener('pointerdown',()=>{changed=false;
activeParam=input.dataset.param});
input.addEventListener('input',()=>{const k=input.dataset.param,p=d.params[k];
let v=p.kind==='color'?input.value:Number(input.value);
if(input.value===''||!Number.isFinite(v)&&p.kind!=='color')return;
if(p.kind!=='color')v=clamp(v,p.min,p.max);
if(!changed){checkpoint();
changed=true}n.p[k]=v;
activeParam=k;
$$(`[data-param="${k}"]`).forEach(el=>{if(el!==input)el.value=v});
const strip=$('.ramp-strip');
if(strip)strip.style.background=`linear-gradient(90deg,${colors.map(([k])=>n.p[k]).join(',')})`;
markDirty(n.id);
drawTimeline()});
input.addEventListener('change',()=>{changed=false;
const k=input.dataset.param;
input.value=n.p[k];
const el=$(`.node[data-id="${n.id}"] .node-info b`);
if(el)el.textContent=nodeSummary(n)})});
$$('[data-key]').forEach(b=>b.onclick=()=>{activeParam=b.dataset.key;
addKeyframe()});
$$('[data-disconnect]').forEach(b=>b.onclick=()=>disconnect(n.id,Number(b.dataset.disconnect)));
$('#inspectNode').onclick=()=>{$('#previewTarget').value=String(n.id);
needsRender=true;
toast('Previewing '+d.name);
setMobile('preview')};
$('#deleteNode').onclick=deleteSelection;
$('#renameNode').onclick=()=>textDialog('Rename node','Node name',n.label||d.name,value=>{checkpoint();
n.label=value.slice(0,120);
refreshGraph(false)});
drawTimeline()}
const diagNames=['Final color','Red channel','Green channel','Blue channel','Alpha','Luminance','Derived normal','Node contribution / ID','Value range','NaN / invalid pixels','Evaluation time','Cached vs dirty','Preview resolution'];

function settingSelect(id,label,value,options){return`<div class="param-row"><label for="${id}">${label}</label><select id="${id}" data-setting="${id}">${options.map(([v,t])=>`<option value="${v}" ${String(value)===String(v)?'selected':''}>${t}</option>`).join('')}</select></div>`}
function renderSettings(){const s=project.settings;
$('#inspectorContent').innerHTML=`<div class="setting-group"><div class="eyebrow">Preview & diagnostics</div>${settingSelect('resolution','Resolution',s.resolution,[[128,'128 × 128 · Draft'],[256,'256 × 256'],[512,'512 × 512'],[1024,'1024 × 1024']])}${settingSelect('diagnostic','Diagnostic view',s.diagnostic,diagNames.map((x,i)=>[i,x]))}${settingSelect('aa','Antialiasing',s.aa,[[0,'1 sample'],[1,'4 samples']])}${settingSelect('colorSpace','Color space',s.colorSpace,[[0,'Display RGB'],[1,'Linear → sRGB ≈ γ2.2']])}${settingSelect('quality','Node previews',s.quality,[[0,'Off'],[1,'64 px · Efficient'],[2,'128 px · Detailed']])}</div><div class="setting-group"><div class="eyebrow">Evaluation</div><div class="param-row"><label>Backend</label><span style="font-size:10px">WebGL 2 · GPU shader</span></div><div class="param-row"><label for="seedSetting">Seed</label><input id="seedSetting" aria-label="Global seed" type="number" min="0" max="99999" value="${s.seed}" style="width:90px"></div>${settingSelect('limit','Frame limit',s.limit,[[15,'15 fps'],[30,'30 fps'],[60,'60 fps']])}${settingSelect('cache','Program cache',s.cache,[[true,'Enabled · 5 programs'],[false,'Disabled']])}<button id="recompileBtn">Recompile graph ↻</button></div><div class="setting-group"><div class="eyebrow">Workspace</div>${settingSelect('theme','Appearance',s.theme,[['dark','Midnight'],['light','Paper'],['contrast','High contrast']])}${settingSelect('grid','Dot grid',s.grid,[[true,'Visible'],[false,'Hidden']])}${settingSelect('snap','Alignment',s.snap,[[false,'Free movement'],[true,'Snap to 20 px grid']])}</div><p class="inspector-note">Scalar values broadcast to vectors and colors. Colors convert to scalars using luminance. Execution ports only connect to execution inputs. Cycles are prevented. Maximum 80 nodes, 200 wires, 24 levels.</p>`;
$$('[data-setting]').forEach(el=>el.onchange=()=>{checkpoint();
const k=el.dataset.setting;
project.settings[k]=['theme'].includes(k)?el.value:['cache','grid','snap'].includes(k)?el.value==='true':Number(el.value);
applySettings();
markDirty();
if(k==='diagnostic'){previewView.channel=0;
syncChannels()}if(k==='cache')compile()});
$('#seedSetting').onchange=e=>{checkpoint();
s.seed=clamp(Number(e.target.value)||0,0,99999);
e.target.value=s.seed;
markDirty()};
$('#recompileBtn').onclick=()=>{compile();
toast(compileStatus==='error'?'Compilation failed: '+compileError:'Graph recompiled',compileStatus==='error')}}
function applySettings(){const s=project.settings;
document.body.classList.toggle('light',s.theme==='light');
document.body.classList.toggle('contrast',s.theme==='contrast');
$('#graphArea').classList.toggle('nogrid',!s.grid);
$('#snapBtn').classList.toggle('active',s.snap);
if(!s.quality)$$('.node-preview').forEach(c=>{const x=c.getContext('2d');
x.clearRect(0,0,c.width,c.height)})}
function syncUI(){$('#projectName').value=project.name;
$('#graphCaption').textContent=project.name;
$('#duration').value=project.timeline.duration;
$('#fps').value=project.timeline.fps;
$('#interpolation').value=project.timeline.interpolation;
$('#loopBtn').classList.toggle('active',project.timeline.loop);
syncTargets();
applySettings();
drawTimeline();
updateHistory()}
function updateStatus(){$('#status').className=compileStatus==='ready'?'status-good':'status-bad';
$('#status').textContent=compileStatus==='ready'?'● Graph ready':compileStatus==='incomplete'?'● Incomplete graph':'● Compile error';
$('#statsCounts').textContent=`${project.nodes.length} nodes · ${project.edges.length} edges`;
$('#statsDirty').textContent=`${dirty.size} dirty · ${programCache.size} cached`;
$('#statsPerf').textContent=`${fpsMeasured} fps · ${evalMs.toFixed(1)} ms`;
$('#statsRes').textContent=`${project.settings.resolution} × ${project.settings.resolution}`;
$('#statsFrame').textContent=`f ${Math.round(project.timeline.time*project.timeline.fps)} · ${project.timeline.time.toFixed(2)}s`;
$('#statsSelected').textContent=selectedNode()?D[selectedNode().type].name:'No selection'}
function setMobile(tab){$('#workspace').dataset.mobile=tab;
$$('[data-mobile]').filter(el=>el.tagName==='BUTTON').forEach(el=>el.classList.toggle('active',el.dataset.mobile===tab));
requestAnimationFrame(()=>{fitPreview();
if(tab==='graph'&&view.z<.4)fitGraph();
drawTimeline();
needsRender=true})}
function fitPreview(){const r=$('#previewStage').getBoundingClientRect();
if(!r.width)return;
const size=Math.max(60,Math.min(r.width-80,r.height-57));
$('#artWrap').style.width=size+'px';
$('#artWrap').style.height=size+'px';
applyPreviewView()}
function applyPreviewView(){$('#artWrap').style.transform=`translate(${previewView.x}px,${previewView.y}px) scale(${previewView.z})`;
$('#previewZoomLabel').textContent=previewView.z===1?'Fit':Math.round(previewView.z*100)+'%'}
function syncChannels(){$$('[data-channel]').forEach(b=>b.classList.toggle('active',Number(b.dataset.channel)===previewView.channel))}
function playToggle(force){playing=force??!playing;
$('#playBtn').setAttribute('aria-label',playing?'Pause playback':'Play animation');
$('#playBtn').innerHTML=icon(playing?'pause':'play');
displayError();
frameStart=performance.now();
lastDraw=0}
function setTime(t){project.timeline.time=clamp(t,0,project.timeline.duration);
needsRender=true;
drawTimeline();
updateStatus();
const ms=Math.round(project.timeline.time*1000);
$('#timecode').textContent=`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`}
function addKeyframe(){const n=selectedNode();
if(!n||!D[n.type].params[activeParam])return toast('Select a numeric or color parameter first');
checkpoint();
n.keys??={};
n.keys[activeParam]??=[];
const t=Math.round(project.timeline.time*project.timeline.fps)/project.timeline.fps;
const i=n.keys[activeParam].findIndex(k=>Math.abs(k.t-t)<.5/project.timeline.fps);
const key={t,v:n.p[activeParam]};
if(i>=0)n.keys[activeParam][i]=key;
else if(n.keys[activeParam].length<120)n.keys[activeParam].push(key);
else return toast('Maximum 120 keys per parameter',true);
n.keys[activeParam].sort((a,b)=>a.t-b.t);
renderInspector();
markDirty(n.id);
toast('Keyframe added at '+t.toFixed(2)+' s')}
function drawTimeline(){const canvas=$('#timelineCanvas');
if(!canvas)return;
const rail=$('#timelineRail'),r=rail.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
if(!r.width)return;
if(canvas.width!==Math.round(r.width*dpr)||canvas.height!==Math.round(r.height*dpr)){canvas.width=Math.round(r.width*dpr);
canvas.height=Math.round(r.height*dpr)}const c=canvas.getContext('2d');
c.setTransform(dpr,0,0,dpr,0,0);
c.clearRect(0,0,r.width,r.height);
const duration=project.timeline.duration,pad=17,w=r.width-34;
const n=selectedNode(),p=n&&D[n.type].params[activeParam],keys=n?.keys?.[activeParam]||[];
$('#trackName').textContent=n&&p?D[n.type].name+' · '+p.label:'Time · seconds';
c.font='9px monospace';
c.fillStyle='#7d8795';
const step=Math.max(1,Math.ceil(duration/(r.width/85)));
for(let t=0;
t<=duration;
t+=step){const x=pad+t/duration*w;
c.fillText(t.toFixed(0)+'s',x,13);
c.strokeStyle='#ffffff08';
c.beginPath();
c.moveTo(x,20);
c.lineTo(x,r.height);
c.stroke()}c.fillStyle='#b8f5d008';
c.fillRect(pad,31,w,25);
c.strokeStyle='#536c605c';
c.beginPath();
c.moveTo(pad,55);
c.lineTo(pad+w,55);
c.stroke();
if(keys.length){const numeric=typeof keys[0].v==='number',values=keys.map(k=>numeric?k.v:hexRGB(k.v).reduce((a,b)=>a+b)/3),min=Math.min(...values),max=Math.max(...values);
c.strokeStyle='#86ba99';
c.lineWidth=1;
c.beginPath();
for(let x=0;
x<w;
x+=2){const v=GraphCore.sampleKeys(keys,x/w*duration,project.timeline.interpolation);
const value=numeric?v:hexRGB(v).reduce((a,b)=>a+b)/3;
const y=56-(max>min?(value-min)/(max-min):.5)*22;
if(x===0)c.moveTo(pad+x,y);
else c.lineTo(pad+x,y)}c.stroke();
for(const k of keys){const x=pad+k.t/duration*w;
c.fillStyle='#b8f5d0';
c.beginPath();
c.moveTo(x,38);
c.lineTo(x+4,43);
c.lineTo(x,48);
c.lineTo(x-4,43);
c.closePath();
c.fill()}}else{c.fillStyle='#6a747f';
c.font='9px sans-serif';
c.fillText('◇  Select a parameter and add a keyframe',pad+9,47)}const x=pad+project.timeline.time/duration*w;
c.fillStyle='#b8f5d0';
c.beginPath();
c.moveTo(x-4,19);
c.lineTo(x+4,19);
c.lineTo(x+4,25);
c.lineTo(x,30);
c.lineTo(x-4,25);
c.fill();
c.fillRect(x-.5,28,1,r.height-28)}
function tick(now){requestAnimationFrame(tick);
if(exporting)return;
const elapsed=frameStart?Math.min((now-frameStart)/1000,.12):0;
frameStart=now;
if(playing&&document.visibilityState==='visible'){let t=project.timeline.time+elapsed;
if(t>project.timeline.duration){if(project.timeline.loop)t%=project.timeline.duration;
else{t=project.timeline.duration;
playToggle(false)}}setTime(t);
for(const n of project.nodes)if(n.type==='time'||n.type==='frame'||Object.keys(n.keys||{}).length)dirty.add(n.id)}const target=1000/Math.min(project.timeline.fps,project.settings.limit);
if((needsRender||playing)&&now-lastDraw>=target){drawPreview();
lastDraw=now;
frameCount++}if(now-lastFpsTime>1000){fpsMeasured=Math.round(frameCount*1000/(now-lastFpsTime));
frameCount=0;
lastFpsTime=now;
updateStatus()}}
function drawConnectionPreview(point){if(!pendingPort||!point)return;
const n=project.nodes.find(n=>n.id===pendingPort.id);
if(!n)return;
const a=portPos(n,pendingPort.port,pendingPort.dir==='out'),b=point;
$('#wirePreview')?.setAttribute('d',pathWire(pendingPort.dir==='out'?a:b,pendingPort.dir==='out'?b:a))}
function clearInteraction(){interaction=null;
pendingPort=null;
$$('.port.pending').forEach(el=>el.classList.remove('pending'));
$('#wirePreview')?.setAttribute('d','');
$('#selectionBox').hidden=true;
$$('.guide').forEach(x=>x.remove());
$('#graphArea').style.cursor=''}
$('#graphArea').addEventListener('pointerdown',e=>{if(e.button===2)return;
const port=e.target.closest('.port');
if(port){e.preventDefault();
e.stopPropagation();
const info={id:Number(port.dataset.id),port:Number(port.dataset.port),dir:port.dataset.dir};
if(e.altKey&&info.dir==='in'){disconnect(info.id,info.port);
return}if(pendingPort&&pendingPort.dir!==info.dir){const from=info.dir==='out'?info.id:pendingPort.id,to=info.dir==='in'?info.id:pendingPort.id,p=info.dir==='in'?info.port:pendingPort.port;
connect(from,to,p);
clearInteraction();
return}pendingPort={...info,point:graphPoint(e.clientX,e.clientY),startX:e.clientX,startY:e.clientY};
port.classList.add('pending');
interaction={kind:'wire',moved:false};
return}const collapse=e.target.closest('[data-collapse]');
if(collapse){e.stopPropagation();
checkpoint();
const n=project.nodes.find(n=>n.id===Number(collapse.dataset.collapse));
n.collapsed=!n.collapsed;
refreshGraph(false);
return}if(pendingPort){clearInteraction();
return}const nodeEl=e.target.closest('.node'),comment=e.target.closest('.comment');
if((spaceHeld||e.button===1)||(!nodeEl&&!comment&&!e.shiftKey)){if(!spaceHeld&&e.button!==1){selection.clear();
$$('.node').forEach(el=>el.classList.remove('selected'));
renderInspector()}interaction={kind:'pan',x:e.clientX,y:e.clientY,origX:view.x,origY:view.y};
$('#graphArea').style.cursor='grabbing'}else if(comment){checkpoint();
const f=project.frames[Number(comment.dataset.comment)];
interaction={kind:'comment',x:e.clientX,y:e.clientY,f,ox:f.x,oy:f.y}}else if(nodeEl){const id=Number(nodeEl.dataset.id);
if(e.shiftKey||!selection.has(id))selectNode(id,e.shiftKey);
if(e.target.closest('.node-head')){checkpoint();
interaction={kind:'move',x:e.clientX,y:e.clientY,orig:project.nodes.filter(n=>selection.has(n.id)).map(n=>({id:n.id,x:n.x,y:n.y}))}}else if(e.shiftKey){const r=$('#graphArea').getBoundingClientRect();
interaction={kind:'box',x:e.clientX-r.left,y:e.clientY-r.top};
$('#selectionBox').hidden=false}if(interaction)e.preventDefault()});

window.addEventListener('pointermove',e=>{if(pendingPort){pendingPort.point=graphPoint(e.clientX,e.clientY);
drawConnectionPreview(pendingPort.point);
if(interaction&&Math.hypot(e.clientX-pendingPort.startX,e.clientY-pendingPort.startY)>4)interaction.moved=true}if(!interaction)return;
const a=interaction;
if(a.kind==='pan'){view.x=a.origX+e.clientX-a.x;
view.y=a.origY+e.clientY-a.y;
applyView()}if(a.kind==='move'){const dx=(e.clientX-a.x)/view.z,dy=(e.clientY-a.y)/view.z;
for(const orig of a.orig){const n=project.nodes.find(n=>n.id===orig.id);
n.x=clamp(orig.x+dx,-49000,49000);
n.y=clamp(orig.y+dy,-49000,49000);
if(project.settings.snap){n.x=Math.round(n.x/20)*20;
n.y=Math.round(n.y/20)*20}const el=$(`.node[data-id="${n.id}"]`);
el.style.left=n.x+'px';
el.style.top=n.y+'px'}$$('.guide').forEach(el=>el.remove());
const n=selectedNode(),other=n&&project.nodes.find(x=>!selection.has(x.id)&&Math.abs(x.x-n.x)<6);
if(other){const line=document.createElement('div');
line.className='guide';
line.style.left=other.x+'px';
$('#graphWorld').append(line)}renderWires();
drawMinimap()}if(a.kind==='comment'){a.f.x=a.ox+(e.clientX-a.x)/view.z;
a.f.y=a.oy+(e.clientY-a.y)/view.z;
const el=$(`.comment[data-comment="${project.frames.indexOf(a.f)}"]`);
el.style.left=a.f.x+'px';
el.style.top=a.f.y+'px'}if(a.kind==='box'){const r=$('#graphArea').getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
a.rect={x:Math.min(x,a.x),y:Math.min(y,a.y),w:Math.abs(x-a.x),h:Math.abs(y-a.y)};
Object.assign($('#selectionBox').style,{left:a.rect.x+'px',top:a.rect.y+'px',width:a.rect.w+'px',height:a.rect.h+'px'});
selection=new Set(project.nodes.filter(n=>{const nx=n.x*view.z+view.x,ny=n.y*view.z+view.y;
return nx+156*view.z>a.rect.x&&nx<a.rect.x+a.rect.w&&ny+135*view.z>a.rect.y&&ny<a.rect.y+a.rect.h}).map(n=>n.id));
$$('.node').forEach(el=>el.classList.toggle('selected',selection.has(Number(el.dataset.id))))}if(a.kind==='split'){const r=$('#workspace').getBoundingClientRect(),width=clamp(r.right-e.clientX,320,r.width*.65);
document.documentElement.style.setProperty('--side',width+'px');
fitPreview()}if(a.kind==='inspector'){const h=clamp(a.height+a.y-e.clientY,130,$('.right-panel').clientHeight-160);
$('#inspector').style.height=h+'px';
fitPreview()}if(a.kind==='preview'){if(previewView.compare&&!e.altKey){const r=$('#artWrap').getBoundingClientRect(),p=clamp((e.clientX-r.left)/r.width*100,0,100);
$('#reference').style.clipPath=`inset(0 ${100-p}% 0 0)`;
$('#compareHandle').style.left=p+'%'}else{previewView.x=a.ox+e.clientX-a.x;
previewView.y=a.oy+e.clientY-a.y;
applyPreviewView()}}if(a.kind==='timeline'){const r=$('#timelineRail').getBoundingClientRect(),t=clamp((e.clientX-r.left-17)/(r.width-34)*project.timeline.duration,0,project.timeline.duration);
if(a.key){a.key.t=Math.round(t*project.timeline.fps)/project.timeline.fps;
drawTimeline();
markDirty(selectedNode()?.id)}else setTime(t)}});

window.addEventListener('pointerup',e=>{if(interaction?.kind==='wire'&&pendingPort){const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.port');
if(el&&el.dataset.dir!==pendingPort.dir){const info={id:Number(el.dataset.id),port:Number(el.dataset.port),dir:el.dataset.dir};
connect(info.dir==='out'?info.id:pendingPort.id,info.dir==='in'?info.id:pendingPort.id,info.dir==='in'?info.port:pendingPort.port);
clearInteraction();
return}if(!interaction.moved){interaction=null;
return}}if(['move','comment','timeline'].includes(interaction?.kind))autosave();
if(interaction?.kind==='box')renderInspector();
clearInteraction()});
window.addEventListener('pointercancel',clearInteraction);
window.addEventListener('blur',()=>{spaceHeld=false;
clearInteraction()});
document.addEventListener('visibilitychange',()=>{frameStart=0;
clearInteraction()});

$('#graphArea').addEventListener('wheel',e=>{e.preventDefault();
const r=$('#graphArea').getBoundingClientRect();
zoomGraph(Math.exp(-e.deltaY*.001),e.clientX-r.left,e.clientY-r.top)},{passive:false});
$('#graphArea').addEventListener('dblclick',e=>{if(!e.target.closest('.node,.wire,.graph-tools,.minimap'))openCommand(graphPoint(e.clientX,e.clientY))});

$('#graphArea').addEventListener('contextmenu',e=>{e.preventDefault();
const n=e.target.closest('.node');
if(n&&!selection.has(Number(n.dataset.id)))selectNode(Number(n.dataset.id));
const p=graphPoint(e.clientX,e.clientY);
showContext(e.clientX,e.clientY,[["Add node",'Tab',()=>openCommand(p)],["Duplicate",'Ctrl D',duplicateSelection],["Copy",'Ctrl C',copySelection],["Paste",'Ctrl V',pasteSelection],["Frame selection",'Ctrl G',frameSelection],["Add comment",'',()=>addComment(p)],["Delete selection",'⌫',deleteSelection]])});

$('#minimap').addEventListener('pointerdown',e=>{e.stopPropagation();
const c=e.currentTarget,m=c._map,r=c.getBoundingClientRect(),x=(e.clientX-r.left)*208/r.width,y=(e.clientY-r.top)*140/r.height,area=$('#graphArea').getBoundingClientRect();
view.x=area.width/2-((x-m.ox)/m.scale+m.b.x)*view.z;
view.y=area.height/2-((y-m.oy)/m.scale+m.b.y)*view.z;
applyView()});

$('#panelResizer').onpointerdown=e=>{interaction={kind:'split'};
e.preventDefault()};
$('#inspectorResizer').onpointerdown=e=>{interaction={kind:'inspector',y:e.clientY,height:$('#inspector').offsetHeight};
e.preventDefault()};

$('#previewStage').addEventListener('wheel',e=>{e.preventDefault();
previewView.z=clamp(previewView.z*Math.exp(-e.deltaY*.001),.3,8);
applyPreviewView()},{passive:false});
$('#previewStage').onpointerdown=e=>{interaction={kind:'preview',x:e.clientX,y:e.clientY,ox:previewView.x,oy:previewView.y};
e.preventDefault()};
$('#previewStage').addEventListener('pointermove',e=>{const r=previewCanvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*previewCanvas.width),y=Math.floor((e.clientY-r.top)/r.height*previewCanvas.height);
if(x<0||y<0||x>=previewCanvas.width||y>=previewCanvas.height)return;
const c=ctx.getImageData(x,y,1,1).data;
$('#pixelRead').textContent=`${x}, ${y}  ·  RGBA ${c[0]} ${c[1]} ${c[2]} ${c[3]}  ·  #${[...c].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('')}`});

$('#timelineRail').onpointerdown=e=>{playToggle(false);
const r=e.currentTarget.getBoundingClientRect(),t=clamp((e.clientX-r.left-17)/(r.width-34)*project.timeline.duration,0,project.timeline.duration),n=selectedNode(),keys=n?.keys?.[activeParam]||[],key=keys.find(k=>Math.abs(k.t-t)/project.timeline.duration*(r.width-34)<7&&e.clientY-r.top>30);
if(key){checkpoint();
if(e.altKey){n.keys[activeParam]=keys.filter(k=>k!==key);
drawTimeline();
markDirty(n.id);
toast('Keyframe removed');
return}setTime(key.t);
interaction={kind:'timeline',key}}else{setTime(t);
interaction={kind:'timeline'}}e.preventDefault()};

$('#timelineRail').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();
playToggle(false);
setTime(project.timeline.time+(e.key==='ArrowRight'?1:-1)/project.timeline.fps)}};

let modalToken=0;

function closeModal(){modalToken++;
$('#modalHost').innerHTML='';
$('#contextMenu').hidden=true;
needsRender=true}
function modal(title,body,footer='',wide=false){closeModal();
$('#modalHost').innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="modal-header"><h2>${title}</h2><button id="closeModal" class="icon-btn" aria-label="Close dialog">${icon('x')}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</section></div>`;
$('#closeModal').onclick=closeModal;
$('.modal-backdrop').onclick=e=>{if(e.target===e.currentTarget)closeModal()};
requestAnimationFrame(()=>$('.modal input, .modal select, .modal button')?.focus())}
function textDialog(title,label,value,callback){modal(title,`<div class="field"><label for="textValue">${escapeHTML(label)}</label><input id="textValue" value="${escapeHTML(value)}" maxlength="120"></div>`,'<button id="textCancel">Cancel</button><button id="textConfirm" class="primary">Save</button>');
$('#textCancel').onclick=closeModal;
const save=()=>{const v=$('#textValue').value.trim();
if(!v)return toast('Please enter a name',true);
callback(v);
closeModal()};
$('#textConfirm').onclick=save;
$('#textValue').onkeydown=e=>{if(e.key==='Enter')save()}}
function showContext(x,y,items){const m=$('#contextMenu');
m.innerHTML=items.map(([label,key],i)=>`<button data-menu="${i}">${label}<kbd>${key||' '}</kbd></button>`).join('');
m.hidden=false;
m.style.left=Math.min(x,innerWidth-190)+'px';
m.style.top=Math.min(y,innerHeight-items.length*36-15)+'px';
m.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{m.hidden=true;
items[i][2]()})}
function addComment(p){modal('Add a comment','<div class="field"><label for="commentText">A note for your future self</label><textarea id="commentText" rows="3" maxlength="500" placeholder="Try a slower flow, or explore a different palette…"></textarea></div>','<button class="primary" id="saveComment">Add comment</button>');
$('#saveComment').onclick=()=>{const label=$('#commentText').value.trim();
if(!label)return;
checkpoint();
project.frames.push({x:p.x,y:p.y,w:180,h:90,label,comment:true});
refreshGraph(false);
closeModal()}}
function openCommand(point){modal('A little idea goes a long way.',`<div class="search-wrap">${icon('search')}<input id="commandSearch" aria-label="Search nodes and commands" placeholder="Search nodes, presets, commands…" autocomplete="off"><kbd>ESC</kbd></div><div class="command-results" id="commandResults"></div>`);
function show(){const q=$('#commandSearch').value.toLowerCase();
const commands=[['Browse presets','Collection',openPresets],['Save a project','Project',openProjects],['Export artwork','Export',openExport],['Fit graph','View',fitGraph],['Frame selection','Graph',frameSelection],['Add comment','Graph',()=>addComment(point||{x:100,y:100})],['New empty graph','Project',newProject]];
let items=Object.values(D).filter(d=>(d.name+' '+d.cat+' '+d.description).toLowerCase().includes(q)).map(d=>[d.glyph+'  '+d.name,d.cat,()=>addNode(d.type,point)]);
if(q)items=items.concat(commands.filter(c=>c[0].toLowerCase().includes(q)));
$('#commandResults').innerHTML=items.map(([label,cat],i)=>`<button data-command="${i}">${escapeHTML(label)}<small>${cat} ↗</small></button>`).join('')||'<div class="empty">No results. Try “noise”, “output”, or “presets”.</div>';
$$('[data-command]').forEach(b=>b.onclick=()=>{const fn=items[Number(b.dataset.command)][2];
closeModal();
fn()});
$('#commandSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();
$$('[data-command]')[0]?.click()}if(e.key==='ArrowDown'){e.preventDefault();
$$('[data-command]')[0]?.focus()}}}$('#commandSearch').oninput=show;
show();
setTimeout(()=>$('#commandSearch')?.focus(),30)}
function loadPreset(index){checkpoint();
project=makePreset(index);
selection=new Set([project.nodes.find(n=>n.type==='ramp')?.id||project.nodes[0].id]);
previewView.channel=0;
previewView.compare=false;
$('#reference').hidden=true;
$('#compareHandle').hidden=true;
$('#compareLabel').hidden=true;
$('#compareBtn').classList.remove('active');
settingsTab=false;
syncUI();
syncChannels();
renderGraph();
renderInspector();
compile();
fitGraph();
fitPreview();
playToggle(true);
markDirty();
closeModal();
toast(project.name+' · editable preset loaded')}
function openPresets(){modal('A starting point. An open possibility.',`<div class="preset-intro"><p>Explore ten fully editable graphs. Make any of them your own.</p><span class="badge">BUILT WITH NODES</span></div><div class="preset-grid">${presetNames.map((name,i)=>`<button class="preset-card" data-preset="${i}"><canvas width="192" height="128" id="presetCanvas${i}" aria-label="${name} preview"></canvas><div class="preset-info"><h3>${String(i+1).padStart(2,'0')} &nbsp;
 ${name}</h3><small>${presetDescriptions[i]}</small></div></button>`).join('')}</div>`,'<span class="subtle" style="margin-right:auto;
font-size:10px">Your current graph stays available in Undo.</span><button id="emptyProject">Start from scratch ↗</button>',true);
$$('[data-preset]').forEach(b=>b.onclick=()=>loadPreset(Number(b.dataset.preset)));
$('#emptyProject').onclick=()=>{closeModal();
newProject()};
const token=modalToken;
const draw=async()=>{for(let i=0;
i<10;
i++){if(token!==modalToken)return;
const c=$('#presetCanvas'+i);
if(thumbData.has(i)){const im=new Image();
im.onload=()=>c?.getContext('2d').drawImage(im,0,0,192,128);
im.src=thumbData.get(i);
continue}if(gl){const g=makePreset(i),saved=glProgram;
try{glProgram=getProgram(buildSource(g));
uniforms={};
renderGL(128,outputId(g),2,0,false,0,g);
c.getContext('2d').drawImage(glCanvas,0,0,192,128);
thumbData.set(i,c.toDataURL())}catch(e){c.getContext('2d').fillStyle='#a06464';
c.getContext('2d').fillText('Preview unavailable',10,60)}finally{glProgram=getProgram(sourceText);
uniforms={};
needsRender=true}}await new Promise(r=>setTimeout(r,30))}};
setTimeout(draw,30)}
function newProject(){checkpoint();
project=makePreset(0);
project.name='Untitled exploration';
project.nodes=[];
project.edges=[];
project.frames=[];
selection.clear();
playToggle(false);
setTime(0);
syncUI();
refreshGraph();
fitGraph();
toast('Empty graph ready · Add a pattern, a color ramp, and an output')}
function validateLoaded(raw){const g=clone(raw);
g.timeline={duration:8,fps:30,time:0,loop:true,interpolation:'smooth',...g.timeline};
g.settings={...makePreset(0).settings,...g.settings};
g.frames??=[];
const rules={resolution:[128,256,512,1024],aa:[0,1],colorSpace:[0,1],quality:[0,1,2],cache:[true,false],grid:[true,false],snap:[true,false],theme:['dark','light','contrast'],limit:[15,30,60],diagnostic:Array.from({length:13},(_,i)=>i)};
for(const[k,a]of Object.entries(rules))if(!a.includes(g.settings[k]))throw Error('Invalid setting: '+k);
if(!Number.isFinite(g.settings.seed)||g.settings.seed<0||g.settings.seed>99999)throw Error('Seed must be between 0 and 99999');
if(!['linear','smooth','hold'].includes(g.timeline.interpolation)||typeof g.timeline.loop!=='boolean')throw Error('Invalid timeline settings');
const valid=GraphCore.validate(g,D);
if(!valid.ok)throw Error(valid.error);
for(const n of g.nodes){n.p={...defaults(n.type),...n.p};
n.keys??={};
n.collapsed=!!n.collapsed}return g}
function adoptProject(g){checkpoint();
project=validateLoaded(g);
selection=new Set(project.nodes.length?[project.nodes.find(n=>n.type==='ramp')?.id||project.nodes[0].id]:[]);
previewView.channel=0;
settingsTab=false;
playToggle(false);
syncUI();
renderGraph();
renderInspector();
compile();
fitGraph();
markDirty();
toast('Project loaded · '+project.nodes.length+' editable nodes')}
function localProjects(){try{return JSON.parse(localStorage.getItem('formlab-projects-v1')||'[]')}catch{return[]}}
function openProjects(){const list=localProjects();
modal('Your explorations',`<p>Named projects are stored in this browser. Save a JSON copy to move your work or keep a backup.</p><div class="field"><label for="localName">Save current project as</label><div style="display:flex;
gap:8px"><input id="localName" value="${escapeHTML(project.name)}" maxlength="80" style="flex:1"><button class="primary" id="saveLocal">Save project</button></div></div><div id="localList">${list.length?list.map((item,i)=>`<div class="project-row"><span>${escapeHTML(item.name)}<small>${item.graph.nodes.length} nodes · ${escapeHTML(new Date(item.date).toLocaleDateString())}</small></span><button data-load-local="${i}">Open ↗</button><button data-remove-local="${i}" aria-label="Delete saved project ${escapeHTML(item.name)}">×</button></div>`).join(''):'<div class="empty">Your collection starts with this graph.</div>'}</div><div class="error-text" id="projectError"></div>`,'<button id="importJSON">Import JSON</button><button id="importShare">Paste graph text</button><button id="downloadJSON">Download JSON ↓</button>');
$('#saveLocal').onclick=()=>{const name=$('#localName').value.trim();
if(!name)return $('#projectError').textContent='Give your project a name.';
try{const all=localProjects(),i=all.findIndex(x=>x.name===name),entry={name,date:new Date().toISOString(),graph:{...clone(project),name}};
if(i>=0)all[i]=entry;
else if(all.length<20)all.unshift(entry);
else throw Error('Local library is full (20 projects). Delete a saved project or export JSON.');
localStorage.setItem('formlab-projects-v1',JSON.stringify(all));
checkpoint();
project.name=name;
syncUI();
autosave();
openProjects();
toast('Saved “'+name+'” in this browser')}catch(e){$('#projectError').textContent=e.message}};
$$('[data-load-local]').forEach(b=>b.onclick=()=>{try{adoptProject(list[Number(b.dataset.loadLocal)].graph);
closeModal()}catch(e){$('#projectError').textContent=e.message}});
$$('[data-remove-local]').forEach(b=>b.onclick=()=>{const a=localProjects();
a.splice(Number(b.dataset.removeLocal),1);
try{localStorage.setItem('formlab-projects-v1',JSON.stringify(a));
openProjects()}catch(e){toast(e.message,true)}});
$('#importJSON').onclick=()=>$('#projectFile').click();
$('#importShare').onclick=openShare;
$('#downloadJSON').onclick=exportJSON}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');
a.href=url;
a.download=name;
document.body.append(a);
a.click();
a.remove();
setTimeout(()=>URL.revokeObjectURL(url),30000);
window.lastExport={name,size:blob.size,type:blob.type,time:project.timeline.time};
return blob}
function safeName(){return project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'form-lab'}
function exportJSON(){download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),safeName()+'.json');
toast('Graph JSON exported')}
async function encodeShare(){let bytes=new TextEncoder().encode(snapshot()),prefix='FL1:';
if(typeof CompressionStream!=='undefined'){bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
prefix='FL1G:'}let text='';
for(let i=0;
i<bytes.length;
i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
return prefix+btoa(text)}
async function decodeShare(text){if(text.length>2000000)throw Error('Project text exceeds 2 MB.');
if(text.trim().startsWith('{'))return JSON.parse(text);
const zipped=text.startsWith('FL1G:');
if(!zipped&&!text.startsWith('FL1:'))throw Error('Paste Form Lab graph text (FL1 / FL1G) or project JSON.');
const b=Uint8Array.from(atob(text.slice(zipped?5:4)),c=>c.charCodeAt(0));
let bytes=b;
if(zipped){if(typeof DecompressionStream==='undefined')throw Error('This browser cannot decode compressed text. Import JSON instead.');
const reader=new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
let len=0,parts=[];
while(true){const {value,done}=await reader.read();
if(done)break;
len+=value.length;
if(len>2000000){reader.cancel();
throw Error('Decompressed project exceeds 2 MB.')}parts.push(value)}bytes=new Uint8Array(len);
let offset=0;
for(const p of parts){bytes.set(p,offset);
offset+=p.length}}return JSON.parse(new TextDecoder().decode(bytes))}
async function openShare(){modal('A graph worth sharing',`<p>Compact graph text includes your nodes, connections, settings, and animation. Copy it, or replace the text below to import someone else’s graph.</p><textarea id="shareText" aria-label="Shareable graph text" rows="7" spellcheck="false"></textarea><div id="shareError" class="error-text"></div>`,'<button id="copyShare">Copy text</button><button id="loadShare" class="primary">Load graph text</button>');
const token=modalToken;
const text=await encodeShare();
if(token!==modalToken)return;
$('#shareText').value=text;
$('#copyShare').onclick=async()=>{const t=$('#shareText');
t.select();
try{await navigator.clipboard.writeText(t.value);
toast('Graph text copied')}catch{document.execCommand('copy');
toast('Graph text selected and copied')}};
$('#loadShare').onclick=async()=>{try{const g=await decodeShare($('#shareText').value.trim());
adoptProject(g);
closeModal()}catch(e){$('#shareError').textContent=e.message}}}
$('#projectFile').onchange=async e=>{const file=e.target.files[0];
if(!file)return;
try{if(file.size>2000000)throw Error('Project files are limited to 2 MB.');
const g=await decodeShare(await file.text());
const valid=validateLoaded(g);
adoptProject(valid);
closeModal()}catch(err){toast('Import rejected: '+err.message,true);
if($('#projectError'))$('#projectError').textContent=err.message}e.target.value=''};

function openExport(){modal('Take it out into the world.',`<p>Render the final Output node at the current timeline time. PNG includes alpha. Frame sequences contain individual PNGs and a manifest in a TAR archive.</p><div class="field-row"><div class="field"><label for="exportFormat">Format</label><select id="exportFormat"><option value="png">PNG image</option><option value="sequence">PNG frame sequence (.tar)</option><option value="json">Project JSON</option><option value="glsl">Compiled GLSL source</option><option value="share">Shareable graph text</option></select></div><div class="field"><label for="exportResolution">Resolution</label><select id="exportResolution"><option value="256">256 × 256</option><option value="512">512 × 512</option><option value="1024" selected>1024 × 1024</option><option value="2048">2048 × 2048</option></select></div></div><div id="sequenceFields" hidden><div class="field-row"><div class="field"><label for="exportFrames">Frame count (1–120)</label><input type="number" id="exportFrames" min="1" max="120" value="60"></div><div class="field"><label for="exportStart">Start time (seconds)</label><input type="number" id="exportStart" min="0" max="60" step="0.1" value="0"></div></div><p>Uses your timeline’s ${project.timeline.fps} fps and loop setting. Maximum 1024 px per frame and 32 million total pixels. Export can be canceled.</p></div><div class="field"><label>Render settings</label><div class="mono subtle" style="font-size:11px">${project.nodes.length} nodes &nbsp;
·&nbsp;
 ${project.timeline.time.toFixed(3)} s &nbsp;
·&nbsp;
 ${project.settings.aa?'4×':'1×'} AA &nbsp;
·&nbsp;
 ${project.settings.colorSpace?'sRGB approximation':'Display RGB'}</div></div><div id="exportError" class="error-text"></div><div id="exportProgress" class="mono subtle" role="status" style="font-size:11px"></div>`,'<button id="exportCancel">Cancel</button><button class="primary" id="exportGo">Export PNG '+icon('export')+'</button>');
$('#exportCancel').onclick=()=>{if(exporting){exporting=false;
toast('Export canceled')}closeModal()};
$('#exportFormat').onchange=e=>{const f=e.target.value;
$('#sequenceFields').hidden=f!=='sequence';
$('#exportResolution').disabled=['json','glsl','share'].includes(f);
$('#exportGo').textContent={png:'Export PNG ↗',sequence:'Export sequence ↗',json:'Export JSON ↗',glsl:'Export GLSL ↗',share:'Get graph text ↗'}[f];
if(f==='sequence')$('#exportResolution').value='512'};
$('#exportGo').onclick=performExport}
function canvasBlob(canvas,type='image/png'){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('The browser could not encode this image.')),type))}
function tarHeader(name,size){const b=new Uint8Array(512),enc=new TextEncoder();
const put=(offset,s)=>b.set(enc.encode(s),offset);
put(0,name);
put(100,'0000644\0');
put(108,'0000000\0');
put(116,'0000000\0');
put(124,size.toString(8).padStart(11,'0')+'\0');
put(136,'00000000000\0');
put(148,'        ');
put(156,'0');
put(257,'ustar\0');
put(263,'00');
const sum=b.reduce((a,v)=>a+v,0);
put(148,sum.toString(8).padStart(6,'0')+'\0 ');
return b}
async function performExport(){const format=$('#exportFormat').value,size=Number($('#exportResolution').value);
try{$('#exportError').textContent='';
if(format==='json'){exportJSON();
return}if(format==='share'){openShare();
return}if(compileStatus!=='ready')throw Error('Connect a valid final Output before rendering.');
if(format==='glsl'){download(new Blob(['// Form Lab fragment shader. WebGL 2. Uniform values and timeline:\n// '+JSON.stringify(project)+'\n'+sourceText],{type:'text/plain'}),safeName()+'.frag');
toast('Compiled shader exported');
return}if(![256,512,1024,2048].includes(size))throw Error('Unsupported export size.');
const savedTime=project.timeline.time;
exporting=true;
$('#exportGo').disabled=true;
if(format==='png'){renderGL(size,outputId(),savedTime,0,false);
const blob=await canvasBlob(glCanvas);
download(blob,safeName()+'.png');
$('#exportProgress').textContent=`PNG ready · ${size} × ${size} · ${(blob.size/1024).toFixed(0)} KB`;
toast('PNG exported at '+size+' × '+size)}else{const count=Number($('#exportFrames').value),start=Number($('#exportStart').value);
if(!Number.isInteger(count)||count<1||count>120)throw Error('Choose between 1 and 120 frames.');
if(size>1024||size*size*count>32000000)throw Error('Sequence exceeds the 32-million-pixel budget. Reduce resolution or frame count.');
if(!Number.isFinite(start)||start<0||start>project.timeline.duration)throw Error('Start time must lie inside your timeline.');
const parts=[],times=[];
for(let i=0;
i<count;
i++){if(!exporting)throw Error('Export canceled.');
let time=start+i/project.timeline.fps;
time=project.timeline.loop?time%project.timeline.duration:Math.min(time,project.timeline.duration);
times.push(time);
renderGL(size,outputId(),time,0,false);
const png=await canvasBlob(glCanvas);
parts.push(tarHeader(`frame-${String(i).padStart(4,'0')}.png`,png.size),png,new Uint8Array((512-png.size%512)%512));
if($('#exportProgress'))$('#exportProgress').textContent=`Rendering frame ${i+1} / ${count}…`;
await new Promise(r=>setTimeout(r,0))}const manifest=new Blob([JSON.stringify({project:project.name,width:size,height:size,fps:project.timeline.fps,frames:count,times},null,2)]);
parts.push(tarHeader('manifest.json',manifest.size),manifest,new Uint8Array((512-manifest.size%512)%512),new Uint8Array(1024));
const blob=new Blob(parts,{type:'application/x-tar'});
download(blob,safeName()+'-frames.tar');
if($('#exportProgress'))$('#exportProgress').textContent=`${count} PNG frames ready · ${(blob.size/1048576).toFixed(1)} MB`;
toast('Frame sequence exported')} }catch(e){if($('#exportError'))$('#exportError').textContent=e.message;
else toast(e.message,true)}finally{exporting=false;
frameStart=performance.now();
needsRender=true;
if($('#exportGo'))$('#exportGo').disabled=false}}
function openHelp(){modal('A few tools for your next idea.',`<p>Add a node from the library, drag an output dot to an input dot, and edit its Properties. You can also click one port, then another. Every visible wire contributes to the graph. Select an intermediate output from the preview menu.</p><div class="shortcut-grid">${[['Add / search nodes','Tab or /'],['Command palette','Ctrl K'],['Pan canvas','Space + drag / middle drag'],['Box select','Shift + drag empty canvas'],['Select multiple','Shift + click'],['Zoom graph','Scroll wheel'],['Fit graph','F'],['Disconnect input','Alt + click port'],['Delete a wire','Double-click wire'],['Copy / paste','Ctrl C / Ctrl V'],['Duplicate','Ctrl D'],['Delete selection','Delete / Backspace'],['Frame selection','Ctrl G'],['Undo / redo','Ctrl Z / Ctrl Shift Z'],['Play / pause','Space'],['Step frame','← / →'],['Keyframe parameter','◇ in Properties'],['Move keyframe','Drag diamond on timeline'],['Delete keyframe','Alt + click diamond'],['Cancel operation','Escape']].map(([a,b])=>`<span>${a}</span><kbd>${b}</kbd>`).join('')}</div><p style="margin-top:20px">On touch screens, tap ports to connect. Use the zoom controls and drag the background to pan. The Graph, Preview, and Inspector tabs give every panel room to work. Compare freezes the visible image;
 drag the comparison divider to reveal it, or Alt-drag to pan.</p>`)}
function openTimelineOptions(){modal('Animation settings',`<div class="field-row"><div class="field"><label for="tlDuration">Duration (seconds)</label><input id="tlDuration" type="number" min="1" max="60" value="${project.timeline.duration}"></div><div class="field"><label for="tlFps">Frame rate</label><input id="tlFps" type="number" min="1" max="60" value="${project.timeline.fps}"></div></div><div class="field"><label for="tlInterpolation">Interpolation</label><select id="tlInterpolation"><option value="smooth">Smooth</option><option value="linear">Linear</option><option value="hold">Hold</option></select></div><p>Add a keyframe using the diamond beside a parameter, move the playhead, edit the value, and add a second keyframe. Drag timeline diamonds to retime them;
 Alt-click a diamond to delete it.</p>`,'<button id="tlKey">Add keyframe</button><button class="primary" id="tlApply">Apply</button>');
$('#tlInterpolation').value=project.timeline.interpolation;
$('#tlApply').onclick=()=>{const dur=Number($('#tlDuration').value),fps=Number($('#tlFps').value);
if(!Number.isFinite(dur)||dur<1||dur>60||!Number.isInteger(fps)||fps<1||fps>60)return toast('Use 1–60 seconds and 1–60 fps.',true);
checkpoint();
project.timeline.duration=dur;
project.timeline.fps=fps;
project.timeline.interpolation=$('#tlInterpolation').value;
setTime(Math.min(project.timeline.time,dur));
syncUI();
markDirty();
closeModal()};
$('#tlKey').onclick=()=>{closeModal();
addKeyframe()}}
$('#presetsBtn').onclick=openPresets;
$('#projectsBtn').onclick=openProjects;
$('#exportBtn').onclick=openExport;
$('#helpBtn').onclick=openHelp;
$('#commandBtn').onclick=()=>openCommand();
$('#studioNav').onclick=()=>{closeModal();
setMobile('graph')};
$('#moreBtn').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();
showContext(r.right-170,r.bottom+8,[['Browse presets','',openPresets],['Saved projects','',openProjects],['Import JSON','',()=>$('#projectFile').click()],['Share graph','',openShare],['New graph','',newProject],['Shortcuts & guide','?',openHelp]])};
$('#addNode').onclick=()=>openCommand();
$('#nodeSearch').oninput=e=>renderCatalog(e.target.value);
$('#undoBtn').onclick=()=>applyHistory(history,future);
$('#redoBtn').onclick=()=>applyHistory(future,history);
$('#fitGraph').onclick=fitGraph;
$('#zoomIn').onclick=()=>zoomGraph(1.2);
$('#zoomOut').onclick=()=>zoomGraph(1/1.2);
$('#snapBtn').onclick=()=>{project.settings.snap=!project.settings.snap;
applySettings();
autosave();
toast('Grid snap '+(project.settings.snap?'enabled':'disabled'))};
$('#propertiesTab').onclick=()=>{settingsTab=false;
renderInspector()};
$('#settingsTab').onclick=()=>{settingsTab=true;
renderInspector()};
$('#projectName').onchange=e=>{checkpoint();
project.name=e.target.value.trim().slice(0,80)||'Untitled exploration';
syncUI();
autosave()};
$$('button[data-mobile]').forEach(b=>b.onclick=()=>setMobile(b.dataset.mobile));
$('#previewTarget').onchange=()=>{needsRender=true;
updateStatus()};
$('#previewExpand').onclick=()=>{previewView.z=1;
previewView.x=previewView.y=0;
fitPreview()};
$('#previewZoomIn').onclick=()=>{previewView.z=clamp(previewView.z*1.25,.3,8);
applyPreviewView()};
$('#previewZoomOut').onclick=()=>{previewView.z=clamp(previewView.z/1.25,.3,8);
applyPreviewView()};
$('#tileBtn').onclick=()=>{previewView.tile=!previewView.tile;
$('#tileBtn').classList.toggle('active',previewView.tile);
needsRender=true};
$('#checkerBtn').onclick=()=>{$('#previewStage').classList.toggle('checker');
$('#checkerBtn').classList.toggle('active')};
$('#compareBtn').onclick=()=>{previewView.compare=!previewView.compare;
const canvas=$('#reference');
if(previewView.compare){canvas.width=previewCanvas.width;
canvas.height=previewCanvas.height;
canvas.getContext('2d').drawImage(previewCanvas,0,0);
canvas.style.clipPath='inset(0 50% 0 0)';
$('#compareHandle').style.left='50%';
toast('Reference frozen · drag the image to compare')}canvas.hidden=!previewView.compare;
$('#compareHandle').hidden=!previewView.compare;
$('#compareLabel').hidden=!previewView.compare;
$('#compareBtn').classList.toggle('active',previewView.compare)};
$$('[data-channel]').forEach(b=>b.onclick=()=>{previewView.channel=Number(b.dataset.channel);
project.settings.diagnostic=0;
syncChannels();
needsRender=true});
$('#playBtn').onclick=()=>{playToggle();
if(!playing)autosave()};
$('#resetBtn').onclick=()=>{playToggle(false);
setTime(0);
autosave()};
$('#stepBtn').onclick=()=>{playToggle(false);
setTime(project.timeline.time+1/project.timeline.fps);
autosave()};
$('#loopBtn').onclick=()=>{project.timeline.loop=!project.timeline.loop;
$('#loopBtn').classList.toggle('active',project.timeline.loop);
autosave()};
$('#duration').onchange=e=>{checkpoint();
project.timeline.duration=clamp(Number(e.target.value)||8,1,60);
setTime(Math.min(project.timeline.time,project.timeline.duration));
e.target.value=project.timeline.duration;
autosave()};
$('#fps').onchange=e=>{checkpoint();
project.timeline.fps=clamp(Math.round(Number(e.target.value))||30,1,60);
e.target.value=project.timeline.fps;
autosave()};
$('#interpolation').onchange=e=>{checkpoint();
project.timeline.interpolation=e.target.value;
markDirty();
drawTimeline()};
$('#addKey').onclick=addKeyframe;
$('#timelineOptions').onclick=openTimelineOptions;

window.addEventListener('keydown',e=>{const input=e.target.closest('input,textarea,select'),modalOpen=!!$('.modal');
if(e.key==='Escape'){closeModal();
clearInteraction();
return}if(modalOpen){if(e.key==='Tab'){const els=$$('.modal button,.modal input,.modal select,.modal textarea').filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length),first=els[0],last=els.at(-1);
if(e.shiftKey&&document.activeElement===first){e.preventDefault();
last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();
first?.focus()}}return}if(input)return;
const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
if(mod&&key==='z'){e.preventDefault();
e.shiftKey?applyHistory(future,history):applyHistory(history,future)}else if(mod&&key==='y'){e.preventDefault();
applyHistory(future,history)}else if(mod&&key==='c'){e.preventDefault();
copySelection()}else if(mod&&key==='v'){e.preventDefault();
pasteSelection()}else if(mod&&key==='d'){e.preventDefault();
duplicateSelection()}else if(mod&&key==='g'){e.preventDefault();
frameSelection()}else if(mod&&key==='s'){e.preventDefault();
openProjects()}else if(mod&&key==='k'||e.key==='Tab'||e.key==='/'){e.preventDefault();
openCommand()}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();
deleteSelection()}else if(e.key===' '&&!e.repeat){e.preventDefault();
spaceHeld=true;
spaceHeld.started=performance.now()}else if(key==='f'){e.preventDefault();
fitGraph()}else if(e.key==='?')openHelp();
else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){if(e.target===$('#timelineRail'))return;
e.preventDefault();
playToggle(false);
setTime(project.timeline.time+(e.key==='ArrowRight'?1:-1)/project.timeline.fps)}});

let spaceWasPanning=false;
window.addEventListener('pointerdown',()=>{if(spaceHeld)spaceWasPanning=true});
window.addEventListener('keyup',e=>{if(e.key===' '){if(spaceHeld&&!spaceWasPanning&&!e.target.closest('input,textarea,select')&&!$('.modal'))playToggle();
spaceHeld=false;
spaceWasPanning=false}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#contextMenu,#moreBtn'))$('#contextMenu').hidden=true});

window.addEventListener('resize',()=>{fitPreview();
drawTimeline();
drawMinimap()});
new ResizeObserver(()=>{fitPreview();
drawTimeline()}).observe($('#workspace'));
window.addEventListener('beforeunload',()=>{try{localStorage.setItem('formlab-autosave-v1',snapshot())}catch{}});

if(gl){glCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();
compileStatus='error';
compileError='Graphics context lost. Your graph is safe. Waiting for the browser to restore it…';
displayError()});
glCanvas.addEventListener('webglcontextrestored',()=>{programCache.clear();
compile()})}
try{const saved=localStorage.getItem('formlab-autosave-v1');
if(saved){project=validateLoaded(JSON.parse(saved));
selection=new Set([project.nodes.find(n=>n.type==='ramp')?.id||project.nodes[0]?.id]);
}}catch(e){toast('Autosave could not be restored. The starter graph is ready.',true)}
renderCatalog();
syncUI();
renderGraph();
renderInspector();
compile();
requestAnimationFrame(()=>{fitGraph();
fitPreview();
setTime(project.timeline.time);
requestAnimationFrame(tick)});
autosave();

window.studio={get project(){return clone(project)},get diagnostics(){return{status:compileStatus,error:compileError,nodes:project.nodes.length,edges:project.edges.length,dirty:dirty.size,programs:programCache.size,resolution:project.settings.resolution,renderCount,evalMs,fps:fpsMeasured,frame:Math.floor(project.timeline.time*project.timeline.fps),time:project.timeline.time,playing,selection:[...selection],view:{...view},preview:{...previewView},root:rootId(),backend:gl?'WebGL2':'Unavailable'}},get source(){return sourceText},validate:g=>GraphCore.validate(g,D)};

