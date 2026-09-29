// ================= WebGL2 renderer =================
let gl=null,canvas=$('gl');
const PROG={};
const TEX={};
let terrainVAO=null,terrainN=0;
let lineVAO=null,lineVBO=null,lineCap=0;
let sliceVAO=null,sliceVBO=null;
let quadVAO=null,cubeVAO=null,cubeN=0;
let flash={pos:[0,0,0],i:0};
let aspect=1,viewM=null,projM=null,invVP=null;
const cam={mode:'orbit',tgt:[0,3,0],yaw:0.9,pitch:0.55,dist:70,
           pos:[0,8,50],fyaw:-1.6,fpitch:-0.05,speed:9};
let camPos=[0,8,60];
let renderScaleEff=1;

// ---- minimal mat4 (column major) ----
function m4persp(f,a,n,fa){const t=1/Math.tan(f/2),d=1/(n-fa);
  return new Float32Array([t/a,0,0,0, 0,t,0,0, 0,0,(fa+n)*d,-1, 0,0,2*fa*n*d,0]);}
function m4lookAt(e,c,up){
  const z=norm3([e[0]-c[0],e[1]-c[1],e[2]-c[2]]);
  const x=norm3([up[1]*z[2]-up[2]*z[1],up[2]*z[0]-up[0]*z[2],up[0]*z[1]-up[1]*z[0]]);
  const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-x[0]*z[1]];
  return new Float32Array([
    x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]),-(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]),-(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]),1]);}
function m4mul(a,b){const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}
function m4inv(m){const x=new Float32Array(16);
  x[0]=m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
  x[4]=-m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
  x[8]=m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
  x[12]=-m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
  x[1]=-m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
  x[5]=m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
  x[9]=-m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
  x[13]=m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
  x[2]=m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
  x[6]=-m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
  x[10]=m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
  x[14]=-m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
  x[3]=-m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
  x[7]=m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
  x[11]=-m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
  x[15]=m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
  let det=m[0]*x[0]+m[1]*x[4]+m[2]*x[8]+m[3]*x[12];
  if(!det)return m.slice();
  det=1/det;for(let i=0;i<16;i++)x[i]*=det;return x;}
function m4v(m,v){const o=[0,0,0,0];
  for(let r=0;r<4;r++)o[r]=m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3];return o;}

// ---- shader helpers ----
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('shader: '+gl.getShaderInfoLog(s));
  return s;}
function prog(vs,fs){const p=gl.createProgram();
  gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('link: '+gl.getProgramInfoLog(p));
  p._u={};return p;}
function U(p,n){if(!(n in p._u))p._u[n]=gl.getUniformLocation(p,n);return p._u[n];}

const VS_QUAD=`#version 300 es
out vec2 vuv;void main(){vec2 p=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3))[gl_VertexID];
vuv=p*0.5+0.5;gl_Position=vec4(p,0,1);}`;

const GLSL_CMAP=`
vec3 cmap(float t){t=clamp(t,0.,1.);
 vec3 c1=vec3(.05,.12,.45),c2=vec3(.05,.65,.75),c3=vec3(.95,.8,.15),c4=vec3(.9,.12,.08);
 return t<.33?mix(c1,c2,t/.33):t<.66?mix(c2,c3,(t-.33)/.33):mix(c3,c4,(t-.66)/.34);}`;

// ---------- shaders ----------
const FS_SKY=`#version 300 es
precision highp float;in vec2 vuv;out vec4 o;
uniform mat4 uInvVP;uniform vec3 uSun,uCam;uniform float uFlash,uExp,uTime;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec4 wp=uInvVP*vec4(vuv*2.-1.,1.,1.);vec3 rd=normalize(wp.xyz/wp.w);
 float e=uSun.y;float day=smoothstep(-0.02,0.22,e);
 vec3 hor=mix(vec3(.03,.045,.08),mix(vec3(.55,.72,.9),vec3(1.,.5,.22),clamp(1.-e*4.,0.,1.)*.85),day);
 vec3 zen=mix(vec3(.01,.015,.04),vec3(.12,.32,.72),day);
 vec3 c=mix(hor,zen,pow(clamp(rd.y,0.,1.),.55));
 float s=dot(rd,uSun);
 c+=vec3(1.,.85,.6)*day*(smoothstep(.9993,.9998,s)*1.8+pow(max(s,0.),20.)*.3);
 vec3 moon=normalize(vec3(-uSun.x,max(.15,-uSun.y+.2),-uSun.z));
 float ms=dot(rd,moon);
 c+=vec3(.75,.8,.95)*(1.-day)*(smoothstep(.9996,.9999,ms)*1.+pow(max(ms,0.),90.)*.12);
 if(day<.35&&rd.y>.03){vec2 sp=rd.xz/(rd.y+.18)*30.;vec2 cell=floor(sp);
   float st=hash(cell);
   if(st>.991)c+=vec3(.9,.95,1.)*(st-.991)*130.*(.35-day)*(.6+.4*sin(uTime*3.+st*40.));}
 c=mix(c,hor,exp(-abs(rd.y)*8.)*.3);
 c+=vec3(1.,.97,.9)*uFlash*.5;
 o=vec4(c*uExp,1.);}`;

const VS_TERRAIN=`#version 300 es
layout(location=0) in vec2 aCell;
uniform sampler2D uH;uniform mat4 uVP;uniform vec2 uDim;uniform float uHmax;
out vec3 vW;out vec3 vN;out vec2 vUV;
float hgt(vec2 c){return texture(uH,(clamp(c,vec2(0),uDim-1.)+.5)/uDim).r*uHmax;}
void main(){
 float h=hgt(aCell);
 vec3 p=vec3((aCell.x/(uDim.x-1.)-.5)*60.,h,(aCell.y/(uDim.y-1.)-.5)*60.);
 float cs=60./(uDim.x-1.);
 float hx=hgt(aCell+vec2(1,0))-hgt(aCell-vec2(1,0));
 float hz=hgt(aCell+vec2(0,1))-hgt(aCell-vec2(0,1));
 vN=normalize(vec3(-hx/(2.*cs),1.,-hz/(2.*cs)));
 vW=p;vUV=aCell/(uDim-1.);
 gl_Position=uVP*vec4(p,1.);}`;

const FS_TERRAIN=`#version 300 es
precision highp float;in vec3 vW,vN;in vec2 vUV;out vec4 o;
uniform sampler2D uH,uS,uWet,uDiag;uniform vec3 uSun,uCam,uFlashPos;
uniform float uExp,uSea,uDiagMix,uHmax,uTime,uFlash;
${GLSL_CMAP}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 float h=texture(uH,vUV).r*uHmax;
 float s=floor(texture(uS,vUV).r*8.+.5);
 float wet=texture(uWet,vUV).r*3.;
 vec3 n=normalize(vN);
 float day=clamp(uSun.y*4.+.15,.08,1.);
 float ndl=max(dot(n,uSun),0.)*day;
 float vr=hash(floor(vUV*300.));
 vec3 base;
 if(s<.5)base=mix(vec3(.22,.38,.16),vec3(.5,.45,.35),clamp(h/8.,0.,1.));
 else if(s<1.5)base=vec3(.65,.6,.4);             // ocean floor -> sand
 else if(s<2.5)base=vec3(.1,.3,.12);              // forest
 else if(s<3.5)base=vec3(.42,.4,.44);             // city
 else if(s<4.5)base=vec3(.9,.92,.96);             // snow surf
 else base=vec3(.76,.68,.5);                      // sand
 base*=.9+.2*vr;
 // snow on high ground
 if(h>7.5)base=mix(base,vec3(.92,.94,.98),clamp((h-7.5)/2.,0.,1.)*.9);
 // wetness darkening
 base*=1.-clamp(wet,0.,1.)*.45;
 vec3 c=base*(.25+.85*ndl+.15*day);
 // diag tint
 if(uDiagMix>0.01){vec3 dc=cmap(texture(uDiag,vUV).r);c=mix(c,dc,uDiagMix*.72);}
 // haze / fog
 float d=distance(uCam,vW);
 float fog=1.-exp(-d*0.0065);
 vec3 fogc=mix(vec3(.02,.03,.06),vec3(.45,.58,.78),day)*(.7+.3*day);
 c=mix(c,fogc,clamp(fog,0.,.85));
 c+=vec3(1.)*uFlash*exp(-distance(uFlashPos,vW)*.06)*.5;
 o=vec4(c*uExp,1.);}`;

const VS_WATER=`#version 300 es
layout(location=0) in vec2 aP;
uniform mat4 uVP;uniform float uSea;
out vec3 vW;out vec2 vUV;
void main(){vec3 p=vec3((aP.x-.5)*60.,uSea,(aP.y-.5)*60.);vW=p;vUV=aP;
 gl_Position=uVP*vec4(p,1.);}`;

const FS_WATER=`#version 300 es
precision highp float;in vec3 vW;in vec2 vUV;out vec4 o;
uniform sampler2D uH,uS;uniform vec3 uSun,uCam;uniform float uSea,uExp,uTime,uFlash,uHmax;
void main(){
 float s=floor(texture(uS,vUV).r*8.+.5);
 float h=texture(uH,vUV).r*uHmax;
 if(!(s>.5&&s<1.5))discard;
 float depth=clamp((uSea-h)/2.,0.,1.);
 vec2 q=vUV*60.;
 vec3 n=normalize(vec3(sin(q.x*.9+uTime*1.3)*.06+sin(q.y*1.7-uTime*.9)*.05,1.,cos(q.x*1.3-uTime*1.1)*.06));
 vec3 v=normalize(uCam-vW);
 float day=clamp(uSun.y*4.+.15,.05,1.);
 vec3 c=mix(vec3(.06,.22,.35),vec3(.02,.08,.16),depth)*day;
 float spec=pow(max(dot(reflect(-uSun,n),v),0.),90.)*day*.9;
 float fres=pow(1.-max(dot(n,v),0.),3.);
 vec3 skyc=mix(vec3(.03,.04,.08),vec3(.5,.65,.85),day);
 c=mix(c,skyc,fres*.5+.15)+spec;
 c+=vec3(1.)*uFlash*exp(-distance(uCam,vW)*.01)*.3;
 o=vec4(c*uExp,.92);}`;

const VS_BOX=`#version 300 es
layout(location=0) in vec3 aP;
uniform mat4 uVP;out vec3 vW;
void main(){vec3 p=vec3((aP.x-.5)*60.,aP.y*16.,(aP.z-.5)*60.);vW=p;
 gl_Position=uVP*vec4(p,1.);}`;

const FS_CLOUD=`#version 300 es
precision highp float;precision highp sampler3D;in vec3 vW;out vec4 o;
uniform sampler3D uQ;uniform sampler2D uH;
uniform vec3 uCam,uSun;uniform float uExp,uTime,uHmax,uDens,uFlash,uQual;uniform vec3 uFlashPos;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec2 boxT(vec3 ro,vec3 rd){
 vec3 bmin=vec3(-30.,0.,-30.),bmax=vec3(30.,16.,30.);
 vec3 t1=(bmin-ro)/rd,t2=(bmax-ro)/rd;
 vec3 tn=min(t1,t2),tf=max(t1,t2);
 return vec2(max(max(tn.x,tn.y),tn.z),min(min(tf.x,tf.y),tf.z));}
float hgt(vec2 xz){return texture(uH,clamp(xz/60.+.5,0.,1.)).r*uHmax;}
float dens(vec3 p){
 vec3 uvw=vec3(p.x/60.+.5,p.z/60.+.5,p.y/16.);
 if(uvw.y<0.||uvw.y>1.)return 0.;
 float q=texture(uQ,uvw).r*6.;
 if(q<=0.03)return 0.;
 float n=noise(p*0.55+vec3(0.,-uTime*0.15,0.));
 float n2=noise(p*1.7)*0.5;
 return max(0.,(q-0.05)*(0.6+0.55*n+0.4*n2))*uDens;}
void main(){
 vec3 ro=uCam;vec3 rd=normalize(vW-ro);
 vec2 tt=boxT(ro,rd);float t0=max(tt.x,0.),t1=tt.y;
 if(t1<=t0){discard;}
 int STEPS=int(20.+uQual*44.);
 float dt=(t1-t0)/float(STEPS);
 float day=clamp(uSun.y*4.+.2,.06,1.);
 vec3 sunC=mix(vec3(.9,.85,.8),vec3(1.,.75,.5),clamp(1.-uSun.y*3.,0.,1.));
 vec3 amb=mix(vec3(.05,.06,.1),vec3(.45,.52,.62),day);
 vec3 acc=vec3(0.);float T=1.;
 float jitter=hash(vec3(rd.xy*51.,uTime*7.));
 float t=t0+dt*jitter;
 for(int i=0;i<64;i++){
  if(i>=STEPS||t>t1||T<.02)break;
  vec3 p=ro+rd*t;
  if(p.y<hgt(p.xz)){t+=dt;continue;}
  float d=dens(p);
  if(d>0.001){
   // light march toward sun (2 samples)
   float dl=dens(p+uSun*dt*2.)*1.5+dens(p+uSun*dt*5.)*1.2;
   float li=exp(-dl*1.8);
   vec3 cc=(amb+sunC*li*1.4)*day;
   cc+=vec3(1.,.95,.8)*uFlash*exp(-distance(p,uFlashPos)*.12)*2.5;
   float a=1.-exp(-d*dt*2.2);
   acc+=cc*a*T;T*=1.-a;
  }
  t+=dt;}
 o=vec4(acc*uExp,1.-T);}`;

const VS_LINE=`#version 300 es
layout(location=0) in vec3 aP;layout(location=1) in vec4 aC;
uniform mat4 uVP;out vec4 vC;
void main(){vC=aC;gl_Position=uVP*vec4(aP,1.);}`;
const FS_LINE=`#version 300 es
precision highp float;in vec4 vC;out vec4 o;uniform float uExp;
void main(){o=vec4(vC.rgb*uExp,vC.a);}`;

const VS_DIAG=`#version 300 es
layout(location=0) in vec2 aP;
uniform mat4 uVP;uniform float uY;
out vec2 vUV;out vec3 vW;
void main(){vec3 p=vec3((aP.x-.5)*60.,uY,(aP.y-.5)*60.);vW=p;vUV=aP;
 gl_Position=uVP*vec4(p,1.);}`;
const FS_DIAG=`#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;out vec4 o;
uniform sampler2D uDiag;uniform float uAlpha,uExp;
${GLSL_CMAP}
void main(){float v=texture(uDiag,vUV).r;
 vec3 c=cmap(v);
 // subtle iso-lines
 float f=abs(fract(v*12.)-.5);float iso=smoothstep(.46,.5,f);
 o=vec4((c+iso*.35)*uExp,uAlpha*(0.25+0.75*smoothstep(.02,.2,v)));}`;

const VS_SLICE=`#version 300 es
layout(location=0) in vec2 aP;
uniform mat4 uVP;uniform vec3 uA;uniform vec3 uB;uniform float uLift;
out vec2 vUV;
void main(){vec3 p=uA+(uB-uA)*aP.x;p.y+=aP.y*16.+uLift;vUV=aP;
 gl_Position=uVP*vec4(p,1.);}`;
const FS_SLICE=`#version 300 es
precision highp float;in vec2 vUV;out vec4 o;
uniform sampler2D uSlice;uniform float uExp;
${GLSL_CMAP}
void main(){float v=texture(uSlice,vUV).r;vec3 c=cmap(v);
 float f=abs(fract(v*12.)-.5);float iso=smoothstep(.46,.5,f);
 o=vec4((c+iso*.3)*uExp,.28+.6*smoothstep(.02,.2,v));}`;

// ---------- GL init ----------
function initGL(){
  canvas=$('gl');
  gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
  if(!gl){fatal('WebGL2 is not available in this browser. Storm Lab needs WebGL2 — try Chrome/Firefox/Edge with hardware acceleration enabled.');return false;}
  try{
    PROG.sky=prog(VS_QUAD,FS_SKY);
    PROG.terrain=prog(VS_TERRAIN,FS_TERRAIN);
    PROG.water=prog(VS_WATER,FS_WATER);
    PROG.cloud=prog(VS_BOX,FS_CLOUD);
    PROG.line=prog(VS_LINE,FS_LINE);
    PROG.diag=prog(VS_DIAG,FS_DIAG);
    PROG.slice=prog(VS_SLICE,FS_SLICE);
  }catch(e){fatal('Shader compile failed: '+e.message);return false;}
  // quad vao (empty)
  quadVAO=gl.createVertexArray();
  // terrain textures
  TEX.h=mkTex(NX,NZ);TEX.s=mkTex(NX,NZ);TEX.w=mkTex(NX,NZ);TEX.diag=mkTex(NX,NZ);
  TEX.slice=gl.createTexture();
  TEX.q=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D,TEX.q);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
  allocQTex();
  buildTerrainMesh();buildCube();buildSliceVAO();
  lineVAO=gl.createVertexArray();
  gl.bindVertexArray(lineVAO);
  lineVBO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,lineVBO);
  lineCap=65536;gl.bufferData(gl.ARRAY_BUFFER,lineCap*28,gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,28,12);
  gl.bindVertexArray(null);
  gl.enable(gl.DEPTH_TEST);
  return true;
}
function fatal(msg){const f=$('fatal');f.style.display='grid';
  $('fatalText').innerHTML='<h2 style="color:#ef5350;margin-bottom:8px">Storm Lab cannot start</h2><p>'+msg+'</p>';}
function mkTex(w,h){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,w,h,0,gl.RED,gl.UNSIGNED_BYTE,null);return t;}
function updTex(t,w,h,data){gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,w,h,0,gl.RED,gl.UNSIGNED_BYTE,data);}
function allocQTex(){gl.bindTexture(gl.TEXTURE_3D,TEX.q);
  gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,NX,NZ,NL,0,gl.RED,gl.UNSIGNED_BYTE,null);}
function uploadQ(){
  // pack qc -> bytes (transposed to x,z,y layout for texture)
  if(!uploadQ.buf||uploadQ.buf.length!==N)uploadQ.buf=new Uint8Array(N);
  const b=uploadQ.buf;
  const qc=F.qc,qr=F.qr;
  for(let k=0;k<NL;k++)for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const v=qc[IDX(i,j,k)]+qr[IDX(i,j,k)]*0.7;
    b[(k*NZ+j)*NX+i]=clamp(v*255/6,0,255);}
  gl.bindTexture(gl.TEXTURE_3D,TEX.q);
  gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,NX,NZ,NL,gl.RED,gl.UNSIGNED_BYTE,b);}
function uploadSurf(){
  const b=new Uint8Array(NX*NZ);
  for(let c=0;c<b.length;c++)b[c]=Sur[c]*32;
  updTex(TEX.s,NX,NZ,b);}
function uploadH(){
  const b=new Uint8Array(NX*NZ);
  for(let c=0;c<b.length;c++)b[c]=clamp(Ht[c]/16*255,0,255);
  updTex(TEX.h,NX,NZ,b);}
function uploadWet(){
  const b=new Uint8Array(NX*NZ);
  for(let c=0;c<b.length;c++)b[c]=clamp(Wet[c]/3*255,0,255);
  updTex(TEX.w,NX,NZ,b);}
function rebuildTerrainGPU(){uploadH();uploadSurf();uploadWet();}
function buildTerrainMesh(){
  const verts=new Float32Array(NX*NZ*2);
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){verts[(j*NX+i)*2]=i;verts[(j*NX+i)*2+1]=j;}
  const idx=new Uint32Array((NX-1)*(NZ-1)*6);let q=0;
  for(let j=0;j<NZ-1;j++)for(let i=0;i<NX-1;i++){
    const a=j*NX+i,b=a+1,c=a+NX,d=c+1;
    idx[q++]=a;idx[q++]=c;idx[q++]=b;idx[q++]=b;idx[q++]=c;idx[q++]=d;}
  terrainVAO=gl.createVertexArray();gl.bindVertexArray(terrainVAO);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);
  gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
  terrainN=idx.length;gl.bindVertexArray(null);}
function buildCube(){
  const v=new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0, 0,0,1, 1,0,1, 1,1,1, 0,1,1]);
  const ix=new Uint16Array([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2]);
  cubeVAO=gl.createVertexArray();gl.bindVertexArray(cubeVAO);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);
  gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ix,gl.STATIC_DRAW);
  cubeN=ix.length;gl.bindVertexArray(null);}
function buildSliceVAO(){
  sliceVAO=gl.createVertexArray();gl.bindVertexArray(sliceVAO);
  sliceVBO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,sliceVBO);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);}
function waterVAO(){ // reuse sliceVAO geometry
  return sliceVAO;}

// ---------- camera ----------
const CAM_PRESETS={
  overview(){cam.mode='orbit';cam.tgt=[0,3,0];cam.yaw=0.9;cam.pitch=0.55;cam.dist=70;},
  chase(){cam.mode='orbit';cam.tgt=[0,4,0];cam.yaw=2.3;cam.pitch=0.18;cam.dist=42;},
  ground(){cam.mode='orbit';cam.tgt=[0,3,0];cam.yaw=1.5;cam.pitch=0.05;cam.dist=30;},
  top(){cam.mode='orbit';cam.tgt=[0,0,0];cam.yaw=0;cam.pitch=1.45;cam.dist=75;},
  fly(){cam.mode='fly';cam.pos=[-20,7,34];cam.fyaw=-0.55;cam.fpitch=-0.06;},
  inside(){cam.mode='fly';cam.pos=[0,kH(NL*0.55),0];cam.fyaw=0.8;cam.fpitch=0.05;},
};
function camDir(){return[Math.cos(cam.fpitch)*Math.sin(cam.fyaw),Math.sin(cam.fpitch),Math.cos(cam.fpitch)*Math.cos(cam.fyaw)];}
function updateCamera(){
  if(cam.mode==='fly'){camPos=cam.pos;
    const d=camDir();viewM=m4lookAt(camPos,[camPos[0]+d[0],camPos[1]+d[1],camPos[2]+d[2]],[0,1,0]);}
  else{cam.pitch=clamp(cam.pitch,-1.5,1.55);cam.dist=clamp(cam.dist,6,240);
    camPos=[cam.tgt[0]+cam.dist*Math.cos(cam.pitch)*Math.sin(cam.yaw),
            cam.tgt[1]+cam.dist*Math.sin(cam.pitch),
            cam.tgt[2]+cam.dist*Math.cos(cam.pitch)*Math.cos(cam.yaw)];
    if(camPos[1]<0.4)camPos[1]=0.4;
    viewM=m4lookAt(camPos,cam.tgt,[0,1,0]);}
  projM=m4persp(58*Math.PI/180,aspect,0.15,600);
  invVP=m4inv(m4mul(projM,viewM));
  return m4mul(projM,viewM);
}
function pickGround(px,py){
  // px,py in CSS pixels -> NDC; march ray down to terrain
  const r=canvas.getBoundingClientRect();
  const nx=(px-r.left)/r.width*2-1, ny=1-(py-r.top)/r.height*2;
  const a=m4v(invVP,[nx,ny,-1,1]),b=m4v(invVP,[nx,ny,1,1]);
  const ro=[a[0]/a[3],a[1]/a[3],a[2]/a[3]];
  const rd=norm3([b[0]/b[3]-ro[0],b[1]/b[3]-ro[1],b[2]/b[3]-ro[2]]);
  if(ro[1]>20&&rd[1]>0)return null;
  let t=0;
  for(let s=0;s<400;s++){
    const wx=ro[0]+rd[0]*t,wy=ro[1]+rd[1]*t,wz=ro[2]+rd[2]*t;
    const gx=(wx/60+0.5)*NX,gz=(wz/60+0.5)*NZ;
    if(gx<0||gx>=NX||gz<0||gz>=NZ){t+=1.5;if(t>500)return null;continue;}
    const i=clamp(gx|0,0,NX-1),j=clamp(gz|0,0,NZ-1);
    const surf=Math.max(Ht[ID2(i,j)],Sur[ID2(i,j)]===1?WORLD.sea:0);
    if(wy<=surf)return{i,j,x:wx,y:surf,z:wz};
    t+=Math.max(0.35,(wy-surf)*0.5);
    if(t>500)return null;
  }
  return null;
}
function hAtWorld(x,z){const gx=clamp((x/60+0.5)*NX,0,NX-1.001),gz=clamp((z/60+0.5)*NZ,0,NZ-1.001);
  const i=gx|0,j=gz|0;return Ht[ID2(i,j)];}

// ---------- viz field extraction ----------
const VIZ={
  cinematic:{label:'Cinematic',field:null},
  temp:{label:'Temperature',lvl:true,get:(i,j,k)=>F.tp[IDX(i,j,k)]+tbase(k),r:[-12,34]},
  humidity:{label:'Humidity RH',lvl:true,get:(i,j,k)=>RHof(k,F.tp[IDX(i,j,k)],F.qv[IDX(i,j,k)])*100,r:[0,110]},
  cloud:{label:'Cloud water',col:true,get:(i,j)=>{let s=0;const kg=KG[ID2(i,j)];for(let k=kg;k<NL;k++)s+=F.qc[IDX(i,j,k)];return s;},r:[0,4]},
  precip:{label:'Precip rate',surf:true,get:(i,j)=>Rain2[ID2(i,j)],r:[0,3]},
  pressure:{label:'Pressure/Buoy.',lvl:true,get:(i,j,k)=>F.p[IDX(i,j,k)],r:[-8,8]},
  wind:{label:'Wind speed',lvl:true,get:(i,j,k)=>Math.hypot(F.u[IDX(i,j,k)],F.v[IDX(i,j,k)]),r:[0,18]},
  vertical:{label:'Vertical motion',lvl:true,get:(i,j,k)=>F.w[IDX(i,j,k)],r:[-5,5]},
  vort:{label:'Vorticity',lvl:true,get:(i,j,k)=>{const i1=(i+1)%NX,i0=(i-1+NX)%NX,j1=Math.min(j+1,NZ-1),j0=Math.max(j-1,0);
      return (F.v[IDX(i1,j,k)]-F.v[IDX(i0,j,k)])/2-(F.u[IDX(i,j1,k)]-F.u[IDX(i,j0,k)])/2;},r:[-3,3]},
  terrain:{label:'Terrain height',surf:true,get:(i,j)=>Ht[ID2(i,j)],r:[0,9]},
  wetness:{label:'Surface moisture',surf:true,get:(i,j)=>Wet[ID2(i,j)],r:[0,3]},
};
let diagBuf=null;
function buildDiag(){
  const vz=VIZ[P.viz];diagBuf=diagBuf&&diagBuf.length===NX*NZ?diagBuf:new Float32Array(NX*NZ);
  const out=new Uint8Array(NX*NZ);
  if(!vz.field&&P.viz==='cinematic'){out.fill(0);diagBuf.fill(0);updTex(TEX.diag,NX,NZ,out);return diagBuf;}
  const [lo,hi]=vz.r;
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    let v;
    if(vz.col)v=vz.get(i,j);
    else if(vz.surf)v=vz.get(i,j);
    else{const k=clamp(P.mapLayer|0,KG[ID2(i,j)],NL-1);v=vz.get(i,j,k);}
    diagBuf[ID2(i,j)]=v;out[ID2(i,j)]=clamp((v-lo)/(hi-lo)*255,0,255);}
  updTex(TEX.diag,NX,NZ,out);
  return diagBuf;
}
function buildSliceTex(){
  // vertical cross-section along x or z at slicePos, of current viz field
  const vz=VIZ[P.viz];const get=vz.field?vz.get:(vz.col||vz.surf)?vz.get:VIZ.temp.get;
  const w=P.sliceAxis==='x'?NZ:NX;
  const b=new Uint8Array(w*NL);
  const fixed=clamp(Math.round(P.slicePos*(P.sliceAxis==='x'?NX:NZ)-0.5),0,(P.sliceAxis==='x'?NX:NZ)-1);
  const [lo,hi]=vz.r||[0,1];
  for(let a=0;a<w;a++)for(let k=0;k<NL;k++){
    const i=P.sliceAxis==='x'?fixed:a, j=P.sliceAxis==='x'?a:fixed;
    let v;
    if(vz.col||vz.surf)v=vz.get(i,j);
    else v=vz.get(i,j,k);
    b[k*w+a]=Solid[IDX(i,j,k)]?0:clamp((v-lo)/(hi-lo)*255,0,255);}
  gl.bindTexture(gl.TEXTURE_2D,TEX.slice);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,w,NL,0,gl.RED,gl.UNSIGNED_BYTE,b);}

// ---------- particles ----------
const MAXP=12000;
const rain={n:0,p:new Float32Array(MAXP*3),v:new Float32Array(MAXP*3),life:new Float32Array(MAXP),snow:new Uint8Array(MAXP)};
const NSTREAK=420;
const streak={p:new Float32Array(NSTREAK*3),life:new Float32Array(NSTREAK)};
function cellWindAt(x,z,k,out){
  const gx=clamp((x/60+0.5)*NX,0,NX-1.001),gz=clamp((z/60+0.5)*NZ,0,NZ-1.001);
  const i=gx|0,j=gz|0,id=IDX(i,j,clamp(k|0,0,NL-1));
  out[0]=F.u[id];out[1]=F.w[id];out[2]=F.v[id];}
const _w3=[0,0,0];
function spawnRain(dt){
  // iterate columns with precip
  const want=Math.min(MAXP,P.precipDensity*9000)|0;
  let tries=0;
  while(rain.n<want&&tries++<800){
    const i=(frand()*NX)|0,j=(frand()*NZ)|0,c=ID2(i,j);
    if(Rain2[c]<0.15&&!(frand()<0.01))continue;
    const kg=KG[c];if(kg>=NL)continue;
    // find cloud base (lowest k with qc)
    let kb=Math.min(kg+2,NL-1);
    for(let k=kg;k<NL;k++)if(F.qc[IDX(i,j,k)]>0.15){kb=k;break;}
    const cold=(tbase(kb)+F.tp[IDX(i,j,kb)])<0;
    const n=rain.n;
    rain.p[n*3]=(i+frand())/NX*60-30;
    rain.p[n*3+1]=kH(kb)+0.2;
    rain.p[n*3+2]=(j+frand())/NZ*60-30;
    cellWindAt(rain.p[n*3],rain.p[n*3+2],kb,_w3);
    rain.v[n*3]=_w3[0]*cellX()*0.6;
    rain.v[n*3+1]=cold?-2.6:-6.5;
    rain.v[n*3+2]=_w3[2]*cellX()*0.6;
    rain.life[n]=3;rain.snow[n]=cold?1:0;
    rain.n++;
  }
}
function updateRain(dt){
  let n=rain.n;
  for(let a=0;a<n;a++){
    rain.life[a]-=dt;
    const x=rain.p[a*3]+rain.v[a*3]*dt,y=rain.p[a*3+1]+rain.v[a*3+1]*dt,z=rain.p[a*3+2]+rain.v[a*3+2]*dt;
    if(rain.life[a]<=0||y<hAtWorld(x,z)+0.05||x<-32||x>32||z<-32||z>32){
      n--;rain.p[a*3]=rain.p[n*3];rain.p[a*3+1]=rain.p[n*3+1];rain.p[a*3+2]=rain.p[n*3+2];
      rain.v[a*3]=rain.v[n*3];rain.v[a*3+1]=rain.v[n*3+1];rain.v[a*3+2]=rain.v[n*3+2];
      rain.life[a]=rain.life[n];rain.snow[a]=rain.snow[n];a--;continue;}
    rain.p[a*3]=x;rain.p[a*3+1]=y;rain.p[a*3+2]=z;
  }
  rain.n=n;
}
function updateStreaks(dt){
  for(let a=0;a<NSTREAK;a++){
    streak.life[a]-=dt;
    if(streak.life[a]<=0){
      const i=(frand()*NX)|0,j=(frand()*NZ)|0,c=ID2(i,j),kg=KG[c];
      streak.p[a*3]=(i+frand())/NX*60-30;
      streak.p[a*3+1]=Math.max(kH(Math.min(kg+1,NL-1)),hAtWorld((i+0.5)/NX*60-30,(j+0.5)/NZ*60-30)+0.4);
      streak.p[a*3+2]=(j+frand())/NZ*60-30;
      streak.life[a]=1+frand()*2;}
    else{
      cellWindAt(streak.p[a*3],streak.p[a*3+2],Math.round(streak.p[a*3+1]/cellZ()),_w3);
      streak.p[a*3]+=_w3[0]*cellX()*0.9*dt;
      streak.p[a*3+2]+=_w3[2]*cellX()*0.9*dt;
      if(streak.p[a*3]<-30)streak.p[a*3]+=60;if(streak.p[a*3]>30)streak.p[a*3]-=60;
      if(streak.p[a*3+2]<-30||streak.p[a*3+2]>30)streak.life[a]=0;}}
}
// lightning
function strikeAt(gi,gj,strength){
  const c=ID2(clamp(gi|0,0,NX-1),clamp(gj|0,0,NZ-1));
  Chg[c]*=0.15;
  const x0=(gi+0.5)/NX*60-30+ (frand()-0.5)*2,z0=(gj+0.5)/NZ*60-30+(frand()-0.5)*2;
  const y0=Math.min(kH(NL-1)*0.9,11),yg=Math.max(Ht[c],Sur[c]===1?WORLD.sea:0);
  const segs=[];
  let x=x0,z=z0,y=y0;
  const steps=14;
  for(let s=0;s<steps;s++){
    const ny=lerp(y0,yg,(s+1)/steps);
    const nx=x+(frand()-0.5)*1.8,nz=z+(frand()-0.5)*1.8;
    segs.push(x,y,z,nx,ny,nz);
    if(s>2&&frand()<0.35){
      let bx=nx,by=ny,bz=nz;
      for(let b=0;b<3+((frand()*3)|0);b++){const nbx=bx+(frand()-0.5)*3.2,nby=by-frand()*1.7,nbz=bz+(frand()-0.5)*3.2;
        segs.push(bx,by,bz,nbx,nby,nbz);bx=nbx;by=nby;bz=nbz;}}
    x=nx;y=ny;z=nz;}
  boltList.push({segs:new Float32Array(segs),life:0.22,t:0});
  flash.pos=[x0,(y0+yg)/2,z0];flash.i=Math.min(1.4,(strength||1));
  // thunder delay ~ 0.3s per 10 world units dist
  const d=Math.hypot(camPos[0]-x0,camPos[1]-yg,camPos[2]-z0);
  pendingThunders.push({delay:d*0.045+0.05,vol:clamp(1.6-d/90,0.1,1)});
}
function updateBolts(dt){
  for(let i=boltList.length-1;i>=0;i--){const b=boltList[i];b.t+=dt;
    if(b.t>b.life)boltList.splice(i,1);}
  flash.i*=Math.pow(0.001,dt*4);
  for(let i=pendingThunders.length-1;i>=0;i--){const t=pendingThunders[i];
    t.delay-=dt;if(t.delay<=0){thunder(t.vol);pendingThunders.splice(i,1);}}
}
