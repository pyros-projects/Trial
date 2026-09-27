// ================= GL setup =================
const canvas=$('gl');
const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
if(!gl){$('fallback').style.display='grid';throw new Error('no webgl2')}
const FBO_W=()=>Math.max(2,Math.round(canvas.clientWidth*devicePixelRatio*S.resScale));
const FBO_H=()=>Math.max(2,Math.round(canvas.clientHeight*devicePixelRatio*S.resScale));

function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)+'\n'+src);return s}
function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));
 gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
 const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
 for(let i=0;i<n;i++){const inf=gl.getActiveUniform(p,i);u[inf.name.replace(/\[0\]$/,'')]=gl.getUniformLocation(p,inf.name)}
 return{p,u}}

const VSH_MESH=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm;
layout(location=2) in mat4 iM; layout(location=6) in vec4 iCol; layout(location=7) in float iEmit;
uniform mat4 uVP; uniform mat4 uLVP;
out vec3 vW; out vec3 vN; out vec4 vC; out float vE; out vec4 vSh;
void main(){vec4 w=iM*vec4(aPos,1.); vW=w.xyz;
 vN=normalize(transpose(inverse(mat3(iM)))*aNrm);
 vC=iCol; vE=iEmit; vSh=uLVP*w; gl_Position=uVP*w;}`;
const FSH_MESH=`#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec4 vC; in float vE; in vec4 vSh;
uniform vec3 uSunDir,uSunCol,uSky,uGnd,uCam,uFog; uniform float uFogD,uShOn;
uniform sampler2D uShadow;
out vec4 O;
float sh(vec4 sc){vec3 p=sc.xyz/sc.w*0.5+0.5; if(p.z>1.||p.x<0.||p.x>1.||p.y<0.||p.y>1.)return 1.;
 float b=max(0.0015,0.004*(1.-abs(vN.y))); float s=0.;
 for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
  vec2 o=vec2(float(i),float(j))/2048.;
  s+=step(p.z-b,texture(uShadow,p.xy+o).r);} return s/9.;}
void main(){vec3 N=normalize(vN);
 float sd=max(dot(N,uSunDir),0.);
 float shf=uShOn>0.5?sh(vSh):1.;
 vec3 amb=mix(uGnd,uSky,N.y*0.5+0.5);
 vec3 col=vC.rgb*(amb+uSunCol*sd*shf)+vC.rgb*vE;
 // rim/fresnel sparkle for emissive gates
 vec3 V=normalize(uCam-vW);
 col+=vC.rgb*vE*pow(1.-abs(dot(N,V)),2.)*0.7;
 float d=distance(uCam,vW);
 float f=1.-exp(-d*d*uFogD*uFogD);
 col=mix(col,uFog,clamp(f,0.,1.));
 O=vec4(col,vC.a);}`;

const VSH_SHADOW=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=2) in mat4 iM;
uniform mat4 uLVP; void main(){gl_Position=uLVP*iM*vec4(aPos,1.);}`;
const FSH_SHADOW=`#version 300 es
precision mediump float; void main(){}`;

const VSH_SKY=`#version 300 es
precision highp float;
out vec3 vDir; uniform vec3 uR,uU,uF; uniform float uTan,uAsp;
void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);
 vDir=uF+uR*p.x*uTan*uAsp+uU*p.y*uTan; gl_Position=vec4(p,0.999,1.);}`;
const FSH_SKY=`#version 300 es
precision highp float;
in vec3 vDir; uniform vec3 uHor,uTop,uSunDir,uSunCol,uFog; uniform float uTime;
out vec4 O;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
void main(){vec3 d=normalize(vDir);
 float h=max(d.y,0.);
 vec3 col=mix(uHor,uTop,pow(h,0.55));
 float sd=max(dot(d,uSunDir),0.);
 col+=uSunCol*pow(sd,600.)*4.+uSunCol*pow(sd,8.)*0.18;
 // procedural cloud band
 float cl=n2(d.xz/(abs(d.y)+0.25)*2.2+uTime*0.004)*n2(d.xz/(abs(d.y)+0.25)*5.7-uTime*0.006);
 cl=smoothstep(0.32,0.75,cl)*smoothstep(0.02,0.25,d.y)*0.35;
 col=mix(col,mix(uHor,uTop,0.4)*1.25,cl);
 if(d.y<0.)col=mix(uFog,uFog*0.8,clamp(-d.y*3.,0.,1.));
 O=vec4(col,1.);}`;

const VSH_POST=`#version 300 es
precision highp float; out vec2 vUv;
void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);
 vUv=p*0.5+0.5; gl_Position=vec4(p,0.,1.);}`;
const FSH_POST=`#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uT; uniform float uVig,uDist,uSpd,uTime,uAsp;
out vec4 O;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 uv=vUv;
 vec2 c=uv-0.5; c.x*=uAsp;
 float r2=dot(c,c);
 uv=0.5+(uv-0.5)*(1.+uDist*r2);
 vec3 col;
 if(uDist>0.001){ // chromatic fringe only when distorting
  col.r=texture(uT,0.5+(uv-0.5)*1.006).r;
  col.g=texture(uT,uv).g;
  col.b=texture(uT,0.5+(uv-0.5)*0.994).b;
 } else col=texture(uT,uv).rgb;
 // speed lines: radial streaks at edge, scaled by speed
 float ang=atan(c.y,c.x);
 float sl=smoothstep(0.75,0.98,h21(vec2(floor(ang*40.),floor(uTime*30.)))) * smoothstep(0.06,0.28,r2);
 col+=vec3(0.7,0.9,1.)*sl*uSpd*0.5;
 col*=1.-uVig*r2*1.6;
 col=col/(1.+col*0.12); // soft tonemap
 O=vec4(col,1.);}`;

const VSH_LINE=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol;
uniform mat4 uVP; out vec4 vC; void main(){vC=aCol; gl_Position=uVP*vec4(aPos,1.);}`;
const FSH_LINE=`#version 300 es
precision mediump float; in vec4 vC; out vec4 O; void main(){O=vC;}`;

const VSH_PART=`#version 300 es
precision highp float;
layout(location=0) in vec2 aC; layout(location=1) in vec3 iP;
layout(location=2) in vec4 iC; layout(location=3) in float iS;
uniform mat4 uVP; uniform vec3 uR,uU; uniform vec3 uCam; uniform vec3 uFog; uniform float uFogD;
out vec4 vC; out vec2 vQ; out float vF;
void main(){vec3 w=iP+(uR*aC.x+uU*aC.y)*iS; vC=iC; vQ=aC;
 float d=distance(uCam,w); vF=1.-exp(-d*d*uFogD*uFogD);
 gl_Position=uVP*vec4(w,1.);}`;
const FSH_PART=`#version 300 es
precision mediump float; in vec4 vC; in vec2 vQ; in float vF; uniform vec3 uFog;
out vec4 O; void main(){float a=smoothstep(1.,0.3,length(vQ)); vec3 c=mix(vC.rgb,uFog,vF);
 O=vec4(c,vC.a*a);}`;

let PMESH,PSHADOW,PSKY,PPOST,PLINE,PPART;
try{
 PMESH=prog(VSH_MESH,FSH_MESH); PSHADOW=prog(VSH_SHADOW,FSH_SHADOW);
 PSKY=prog(VSH_SKY,FSH_SKY); PPOST=prog(VSH_POST,FSH_POST);
 PLINE=prog(VSH_LINE,FSH_LINE); PPART=prog(VSH_PART,FSH_PART);
}catch(e){$('fallback').style.display='grid';$('fallback').querySelector('p').textContent='Shader error: '+e.message;throw e}

// ---------------- mesh helpers ----------------
// geometry = {pos:[],nrm:[],idx:[]}
function geoBox(g,cx,cy,cz,sx,sy,sz){
 const P=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
 const F=[[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[4,5,1,0],[3,2,6,7]];
 const N=[[0,0,-1],[0,0,1],[-1,0,0],[1,0,0],[0,-1,0],[0,1,0]];
 for(let f=0;f<6;f++){const b=g.pos.length/3;
  for(const vi of F[f]){const p=P[vi];
   g.pos.push(cx+p[0]*sx/2,cy+p[1]*sy/2,cz+p[2]*sz/2);g.nrm.push(...N[f])}
  g.idx.push(b,b+1,b+2,b,b+2,b+3)} return g}
function geoCyl(g,cx,cy,cz,r,h,seg=10,capTop=true,capBot=true){
 const b0=g.pos.length/3;
 for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  g.pos.push(cx+c*r,cy-h/2,cz+s*r, cx+c*r,cy+h/2,cz+s*r); g.nrm.push(c,0,s, c,0,s)}
 for(let i=0;i<seg;i++){const b=b0+i*2;g.idx.push(b,b+2,b+1,b+1,b+2,b+3)}
 if(capTop||capBot){const cb=g.pos.length/3;
  g.pos.push(cx,cy+h/2,cz, cx,cy-h/2,cz);g.nrm.push(0,1,0, 0,-1,0);
  for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,c=Math.cos(a),s=Math.sin(a),b=g.pos.length/3;
   g.pos.push(cx+c*r,cy+h/2,cz, cx+c*r,cy-h/2,cz);g.nrm.push(0,1,0, 0,-1,0);
   if(capTop)g.idx.push(cb,b,b+2); if(capBot)g.idx.push(cb+1,b+3,b+1)}} return g}
function geoSphere(g,cx,cy,cz,r,seg=8){
 const b0=g.pos.length/3;
 for(let y=0;y<=seg;y++)for(let x=0;x<=seg;x++){const u=x/seg,v=y/seg;
  const th=u*Math.PI*2,ph=v*Math.PI;
  const nx=Math.sin(ph)*Math.cos(th),ny=Math.cos(ph),nz=Math.sin(ph)*Math.sin(th);
  g.pos.push(cx+nx*r,cy+ny*r,cz+nz*r);g.nrm.push(nx,ny,nz)}
 for(let y=0;y<seg;y++)for(let x=0;x<seg;x++){const b=b0+y*(seg+1)+x;
  g.idx.push(b,b+seg+1,b+1,b+1,b+seg+1,b+seg+2)} return g}
function geoMerge(a,b){const off=a.pos.length/3;a.pos.push(...b.pos);a.nrm.push(...b.nrm);
 for(const i of b.idx)a.idx.push(i+off);return a}

class Mesh{
 constructor(geo,maxInst=1,dynamic=false){
  this.maxInst=maxInst;this.n=0;this.inst=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,this.inst);
  gl.bufferData(gl.ARRAY_BUFFER,maxInst*84,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
  const mk=(withColor)=>{const vao=gl.createVertexArray();gl.bindVertexArray(vao);
   const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);
   const verts=new Float32Array(geo.pos.length/3*6);
   for(let i=0;i<geo.pos.length/3;i++){verts.set(geo.pos.slice(i*3,i*3+3),i*6);verts.set(geo.nrm.slice(i*3,i*3+3),i*6+3)}
   gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
   gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
   gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
   const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
   gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(geo.idx),gl.STATIC_DRAW);
   gl.bindBuffer(gl.ARRAY_BUFFER,this.inst);
   for(let i=0;i<4;i++){gl.enableVertexAttribArray(2+i);gl.vertexAttribPointer(2+i,4,gl.FLOAT,false,84,i*16);gl.vertexAttribDivisor(2+i,1)}
   if(withColor){gl.enableVertexAttribArray(6);gl.vertexAttribPointer(6,4,gl.FLOAT,false,84,64);gl.vertexAttribDivisor(6,1);
    gl.enableVertexAttribArray(7);gl.vertexAttribPointer(7,1,gl.FLOAT,false,84,80);gl.vertexAttribDivisor(7,1)}
   gl.bindVertexArray(null);return vao};
  this.vao=mk(true);this.svaos=mk(false);
  this.count=geo.idx.length;this.data=new Float32Array(maxInst*21)}
 set(i,m4,r,g,b,a=1,emit=0){const o=i*21;this.data.set(m4,o);this.data[o+16]=r;this.data[o+17]=g;this.data[o+18]=b;this.data[o+19]=a;this.data[o+20]=emit}
 commit(n){this.n=n;
  gl.bindBuffer(gl.ARRAY_BUFFER,this.inst);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,n*21))}
}
// instance record helper: compose matrix + color
const _im=new Float32Array(16),_iq=QT.ident();
function instTRS(m,i,x,y,z,q,sx,sy,sz,r,g,b,a=1,emit=0){
 M4.compose(_im,V3.c(x,y,z),q,sx,sy,sz);m.set(i,_im,r,g,b,a,emit)}

// ---------------- FBOs ----------------
let sceneFBO=null,sceneTex=null,sceneMS=null,sceneDepthMS=null,shadowFBO=null,shadowTex=null;
let SHADOW_SZ={off:0,low:1024,high:2048}[S?S.shadowQ:'low']||1024;
function buildFBOs(){
 if(sceneFBO){gl.deleteFramebuffer(sceneFBO);gl.deleteTexture(sceneTex);gl.deleteFramebuffer(sceneMS);
  gl.deleteRenderbuffer(sceneDepthMS);gl.deleteTexture(shadowTex);gl.deleteFramebuffer(shadowFBO)}
 const w=FBO_W(),h=FBO_H();
 sceneTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,sceneTex);
 gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,w,h);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 sceneFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFBO);
 gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sceneTex,0);
 // multisampled scene RB
 const samples=Math.min(4,gl.getParameter(gl.MAX_SAMPLES));
 sceneMS=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,sceneMS);
 const cRB=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,cRB);
 gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.RGBA8,w,h);
 gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,cRB);
 sceneDepthMS=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,sceneDepthMS);
 gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.DEPTH_COMPONENT24,w,h);
 gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,sceneDepthMS);
 // shadow map
 shadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTex);
 gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT24,SHADOW_SZ,SHADOW_SZ);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 shadowFBO=gl.createFramebuffer();gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,shadowFBO);
 gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTex,0);
 gl.drawBuffers([gl.NONE]);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}
