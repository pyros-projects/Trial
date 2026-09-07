/* ================= WebGL2 renderer ================= */

const SH_COMMON = `
precision highp float; precision highp sampler2D;
vec4 bilin(sampler2D tex, vec2 uv, float uN){
  vec2 t = uv*uN - 0.5;
  vec2 f = floor(t);
  vec2 fr = clamp(t-f, 0.0, 1.0);
  vec2 b = (f+0.5)/uN;
  float px = 1.0/uN;
  vec4 a = texture(tex, b);
  vec4 c = texture(tex, b+vec2(px,0.0));
  vec4 d = texture(tex, b+vec2(0.0,px));
  vec4 e = texture(tex, b+vec2(px,px));
  return mix(mix(a,c,fr.x), mix(d,e,fr.x), fr.y);
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x),
             mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y);
}
vec3 ramp5(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4){
  t = clamp(t,0.0,1.0);
  if(t<0.25) return mix(c0,c1,t*4.0);
  if(t<0.5)  return mix(c1,c2,(t-0.25)*4.0);
  if(t<0.75) return mix(c2,c3,(t-0.5)*4.0);
  return mix(c3,c4,(t-0.75)*4.0);
}
vec3 elevRamp(float t){ return ramp5(t, vec3(.16,.27,.44), vec3(.22,.46,.30), vec3(.74,.64,.38), vec3(.55,.42,.32), vec3(.94,.94,.96)); }
vec3 magRamp(float t){ return ramp5(t, vec3(.04,.02,.15), vec3(.44,.09,.45), vec3(.85,.28,.28), vec3(.98,.62,.25), vec3(.99,.95,.76)); }
vec3 divRamp(float t){ return ramp5(t, vec3(.78,.15,.15), vec3(.96,.60,.40), vec3(.97,.97,.95), vec3(.42,.67,.86), vec3(.10,.30,.66)); }
vec3 blueRamp(float t){ return ramp5(t, vec3(.02,.05,.12), vec3(.05,.25,.55), vec3(.10,.55,.75), vec3(.35,.78,.80), vec3(.85,.97,.95)); }
vec3 goldRamp(float t){ return ramp5(t, vec3(.10,.07,.04), vec3(.35,.22,.08), vec3(.72,.48,.16), vec3(.93,.72,.30), vec3(.99,.95,.75)); }
`;

const VS_FIELD = `#version 300 es
layout(location=0) in vec2 aUV;
layout(location=1) in float aKind;
uniform sampler2D uData;
uniform float uN, uHalf, uEx, uBase;
uniform mat4 uVP;
out vec2 vUV; out vec3 vWorld; out float vKind;
void main(){
  vUV = aUV; vKind = aKind;
  vec2 xz = (aUV - 0.5) * 2.0 * uHalf;
  float y = aKind > 0.5 ? uBase : texture(uData, aUV).x * uEx;
  vWorld = vec3(xz.x, y, xz.y);
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;

const VS_FIELD_WATER = `#version 300 es
layout(location=0) in vec2 aUV;
layout(location=1) in float aKind;
uniform sampler2D uData;
uniform float uN, uHalf, uEx, uBase;
uniform mat4 uVP;
out vec2 vUV; out vec3 vWorld; out float vKind;
void main(){
  vUV = aUV; vKind = aKind;
  vec2 xz = (aUV - 0.5) * 2.0 * uHalf;
  vec4 d = texture(uData, aUV);
  float y = aKind > 0.5 ? uBase : (d.x + d.y) * uEx;   // terrain + water depth
  vWorld = vec3(xz.x, y, xz.y);
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;

const FS_TERRAIN = `#version 300 es
` + SH_COMMON + `
in vec2 vUV; in vec3 vWorld; in float vKind;
uniform sampler2D uData, uFlow;
uniform float uN, uHalf, uEx, uBase, uTime;
uniform vec3 uEye, uSunDir, uFogCol;
uniform int uMode;
uniform bool uShadow, uContours, uGrid;
uniform float uCsp, uGenMin, uGenMax, uMaxDl, uMaxSpd;
out vec4 fragColor;

float shadowF(vec3 wp, vec3 L){
  if(!uShadow) return 1.0;
  float sh = 1.0;
  float t = (2.0*uHalf/uN)*1.7;
  vec3 p = wp + vec3(0.0, 0.06, 0.0);
  for(int k=0;k<16;k++){
    p += L*t; t *= 1.32;
    vec2 uv = p.xz/(2.0*uHalf)+0.5;
    if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) break;
    float hh = texture(uData, uv).x * uEx;
    float d = p.y - hh;
    if(d < 0.0){ sh = 0.0; break; }
    sh = min(sh, clamp(d/(t*0.9), 0.0, 1.0));
  }
  return mix(0.32, 1.0, pow(sh, 0.65));
}

void main(){
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(uEye - vWorld);
  float dist = length(uEye - vWorld);
  float fog = 1.0 - exp(-pow(dist*0.00092, 1.6));

  if(vKind > 0.5){ /* skirt walls: stratified dark rock */
    vec3 nrm = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    float li = 0.30 + 0.70*abs(dot(nrm, L));
    float strat = 0.82 + 0.18*sin(vWorld.y*2.4 + vnoise(vWorld.xz*0.2)*4.0);
    vec3 alb = vec3(0.155,0.135,0.12) * strat * (0.75+0.5*vnoise(vWorld.xz*0.6));
    vec3 col = alb * li * (0.55 + 0.45*shadowF(vWorld, L));
    fragColor = vec4(mix(col, uFogCol, fog), 1.0);
    return;
  }

  float px = 1.0/uN;
  float cell = 2.0*uHalf/uN;
  vec4 dd = bilin(uData, vUV, uN);
  float h = dd.x, w = dd.y, sd = dd.z, h0 = dd.a;
  float hl = bilin(uData, vUV-vec2(px,0.0), uN).x;
  float hr = bilin(uData, vUV+vec2(px,0.0), uN).x;
  float hd = bilin(uData, vUV-vec2(0.0,px), uN).x;
  float hu = bilin(uData, vUV+vec2(0.0,px), uN).x;
  vec3 n = normalize(vec3((hl-hr)*uEx/(2.0*cell), 1.0, (hd-hu)*uEx/(2.0*cell)));
  float slope = clamp(1.0 - n.y, 0.0, 1.0);
  float sh = shadowF(vWorld, L);
  float ndl = max(dot(n, L), 0.0);
  float dl = h - h0;
  float hRel = clamp((h-uGenMin)/(uGenMax-uGenMin), 0.0, 1.0);

  /* contour lines + grid overlay */
  float contour = 0.0;
  if(uMode==1 || (uContours && uMode==0)){
    float cw = h*uEx/uCsp;
    float fr = fract(cw);
    float dfw = fwidth(cw);
    contour = 1.0 - smoothstep(0.0, dfw*1.6, min(fr, 1.0-fr));
  }
  float gridL = 0.0;
  if(uGrid){
    vec2 gp = vWorld.xz/(cell*8.0);
    vec2 gf = abs(fract(gp)-0.5);
    vec2 gd = fwidth(gp);
    gridL = max(1.0-smoothstep(0.0, gd.x*1.7, gf.x), 1.0-smoothstep(0.0, gd.y*1.7, gf.y));
  }

  /* albedo per mode */
  vec3 alb;
  if(uMode==0){
    float nz = vnoise(vWorld.xz*0.55)*0.6 + vnoise(vWorld.xz*2.6)*0.4;
    vec3 grass = mix(vec3(0.21,0.32,0.12), vec3(0.37,0.43,0.19), nz);
    vec3 rock  = mix(vec3(0.37,0.33,0.29), vec3(0.50,0.46,0.41), nz);
    alb = mix(grass, rock, smoothstep(0.05,0.26,slope));
    alb = mix(alb, vec3(0.92,0.93,0.96), smoothstep(0.74,0.92,hRel)*(1.0-smoothstep(0.16,0.42,slope)));
    float shore = smoothstep(0.08,0.015,w)*smoothstep(0.22,0.04,slope)*smoothstep(0.62,0.2,hRel);
    alb = mix(alb, vec3(0.70,0.63,0.44), shore*0.85);
    alb *= 1.0 - 0.30*clamp(w*30.0,0.0,1.0);                               // wet darkening
    alb = mix(alb, alb*vec3(0.86,0.80,0.74), clamp(-dl*8.0,0.0,0.55));     // eroded streaks
    alb = mix(alb, mix(alb, vec3(0.63,0.56,0.41),0.5), clamp(dl*8.0,0.0,0.55)); // fresh deposits
  } else if(uMode==1){ alb = elevRamp(hRel); }
  else if(uMode==2){ alb = vec3(0.30,0.31,0.33); }
  else if(uMode==3){ alb = vec3(0.20,0.20,0.22); }
  else if(uMode==4){ alb = divRamp(clamp(dl*uEx/max(uMaxDl*2.2,1e-3)*0.5+0.5, 0.0, 1.0)); }
  else if(uMode==5){ alb = magRamp(clamp(slope*3.4, 0.0, 1.0)); }
  else {
    vec2 flow = texture(uFlow, vUV).xy;
    float spd = length(flow);
    alb = vec3(0.12,0.13,0.15);
    if(w>0.0015 && spd>0.03){
      float ang = atan(flow.y, flow.x);
      vec3 hue = 0.5 + 0.5*cos(6.28318*(ang/6.28318 + vec3(0.0,0.333,0.667)));
      float val = clamp(spd/max(uMaxSpd,0.1), 0.0, 1.0);
      alb = mix(alb, hue*(0.3+0.7*val), clamp(w*25.0,0.0,1.0));
    }
  }

  float litM = (uMode==0) ? 1.30 : 0.62;
  vec3 amb = mix(vec3(0.15,0.16,0.19), vec3(0.33,0.37,0.45), n.y*0.5+0.5) * ((uMode==0)?1.0:0.85);
  vec3 sun = vec3(1.0,0.96,0.88);
  vec3 col = alb*(amb + sun*ndl*litM*sh);
  if(uMode==0) col += sun*pow(max(dot(n, normalize(L+V)),0.0), 44.0)*0.16*sh;

  col = mix(col, col*0.52, contour*0.5);
  col = mix(col, col*0.62 + vec3(0.10,0.12,0.12), gridL*0.4);
  fragColor = vec4(mix(col, uFogCol, fog), 1.0);
}`;

const FS_WATER = `#version 300 es
` + SH_COMMON + `
in vec2 vUV; in vec3 vWorld; in float vKind;
uniform sampler2D uData, uFlow;
uniform float uN, uHalf, uEx, uTime, uWop, uMaxW, uMaxC;
uniform vec3 uEye, uSunDir;
uniform int uMode;
out vec4 fragColor;
void main(){
  if(vKind > 0.5) discard;
  vec4 dd = bilin(uData, vUV, uN);
  float h = dd.x, w = dd.y, sd = dd.z;
  if(uMode!=0 && uMode!=2 && uMode!=3) discard;
  if(w < 0.0008) discard;
  vec2 flow = texture(uFlow, vUV).xy;
  float spd = length(flow);
  float px = 1.0/uN;
  float cell = 2.0*uHalf/uN;
  float whl = bilin(uData, vUV-vec2(px,0.0), uN).x + bilin(uData, vUV-vec2(px,0.0), uN).y;
  float whr = bilin(uData, vUV+vec2(px,0.0), uN).x + bilin(uData, vUV+vec2(px,0.0), uN).y;
  float whd = bilin(uData, vUV-vec2(0.0,px), uN).x + bilin(uData, vUV-vec2(0.0,px), uN).y;
  float whu = bilin(uData, vUV+vec2(0.0,px), uN).x + bilin(uData, vUV+vec2(0.0,px), uN).y;
  vec3 n = normalize(vec3((whl-whr)*uEx/(2.0*cell), 1.0, (whd-whu)*uEx/(2.0*cell)));
  float rip1 = sin(vWorld.x*1.9 + uTime*2.2)*sin(vWorld.z*2.1 - uTime*1.6);
  float rip2 = sin(vWorld.x*4.3 - uTime*2.9 + vWorld.z*3.7);
  n = normalize(n + vec3(rip1*0.018, 0.0, rip2*0.014));
  vec3 V = normalize(uEye - vWorld);
  vec3 L = normalize(uSunDir);

  if(uMode==2){
    float t = clamp(w/max(uMaxW,1e-3), 0.0, 1.0);
    fragColor = vec4(blueRamp(pow(t,0.6)), 1.0);
    return;
  }
  if(uMode==3){
    float c = sd/max(w,1e-4);
    float t = clamp(c/max(uMaxC,1e-3), 0.0, 1.0);
    fragColor = vec4(goldRamp(pow(t,0.65)), 1.0);
    return;
  }

  float depthT = 1.0 - exp(-w*uEx*1.15);
  vec3 col = mix(vec3(0.10,0.42,0.45), vec3(0.015,0.10,0.22), depthT);
  float sed = sd/max(w,1e-4);
  float murk = 1.0 - exp(-sed*0.40);
  col = mix(col, vec3(0.38,0.27,0.14), murk*0.7);
  float foam = smoothstep(0.013,0.002,w) + smoothstep(3.0,7.0,spd)*0.35;
  col = mix(col, vec3(0.93), clamp(foam,0.0,1.0)*0.6);
  float fr = pow(1.0 - max(dot(n,V),0.0), 3.0);
  col = mix(col, vec3(0.48,0.60,0.73), fr*0.55);
  col += vec3(1.0,0.97,0.9)*pow(max(dot(n, normalize(L+V)),0.0), 140.0)*1.15;
  float film = smoothstep(0.003, 0.05, w);          // thin films barely visible
  float a = uWop * film * (0.30 + 0.70*depthT);
  a = clamp(max(a, murk*0.75*film) + foam*0.25, 0.0, 1.0);
  fragColor = vec4(col, a);
}`;

const VS_SKY = `#version 300 es
out vec2 vNdc;
void main(){
  vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
  vNdc = p*2.0-1.0;
  gl_Position = vec4(vNdc, 0.9999, 1.0);
}`;

const FS_SKY = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform vec3 uCamFwd, uCamRight, uCamUp, uSunDir, uHorizon, uZenith;
uniform float uTanF, uAspect;
out vec4 fragColor;
void main(){
  vec3 dir = normalize(uCamFwd + uCamRight*vNdc.x*uTanF*uAspect + uCamUp*vNdc.y*uTanF);
  float t = clamp(dir.y*0.5+0.5, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(t, 0.75));
  col = mix(col, uHorizon*0.55, smoothstep(0.02,-0.25,dir.y));
  float sd = max(dot(dir, normalize(uSunDir)), 0.0);
  col += vec3(1.0,0.88,0.72)*(pow(sd,700.0)*4.0 + pow(sd,9.0)*0.14);
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;
  fragColor = vec4(col, 1.0);
}`;

const VS_LINE = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
void main(){ gl_Position = uVP*vec4(aPos,1.0); }`;
const FS_LINE = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main(){ fragColor = uColor; }`;

/* ---------- gl plumbing ---------- */
let gl, g = {};
function makeShader(type, src){
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
    throw new Error('shader: '+gl.getShaderInfoLog(sh)+'\n'+src.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));
  return sh;
}
function makeProgram(vs, fs){
  const p = gl.createProgram();
  gl.attachShader(p, makeShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, makeShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: '+gl.getProgramInfoLog(p));
  return p;
}
function uniforms(prog, names){
  const o = {};
  for(const n of names) o[n] = gl.getUniformLocation(prog, n);
  return o;
}

function initGL(){
  const canvas = $('glc');
  gl = canvas.getContext('webgl2', {antialias:true, alpha:false, depth:true, powerPreference:'high-performance'});
  if(!gl){ $('nogl').style.display='flex'; return false; }
  gl.getExtension('OES_texture_float_linear');

  g.pTerrain = makeProgram(VS_FIELD, FS_TERRAIN);
  g.uT = uniforms(g.pTerrain, ['uData','uFlow','uN','uHalf','uEx','uBase','uVP','uEye','uSunDir','uFogCol','uMode','uShadow','uContours','uGrid','uCsp','uGenMin','uGenMax','uMaxDl','uMaxSpd','uTime']);
  g.pWater = makeProgram(VS_FIELD_WATER, FS_WATER);
  g.uW = uniforms(g.pWater, ['uData','uFlow','uN','uHalf','uEx','uVP','uEye','uSunDir','uMode','uWop','uMaxW','uMaxC','uTime']);
  g.pSky = makeProgram(VS_SKY, FS_SKY);
  g.uS = uniforms(g.pSky, ['uCamFwd','uCamRight','uCamUp','uSunDir','uHorizon','uZenith','uTanF','uAspect']);
  g.pLine = makeProgram(VS_LINE, FS_LINE);
  g.uL = uniforms(g.pLine, ['uVP','uColor']);

  g.texData = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, g.texData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  g.texFlow = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, g.texFlow);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  g.flowBuf = new Float32Array(0);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0.52, 0.62, 0.72, 1);
  return true;
}

function buildMesh(N){
  if(g.vao) gl.deleteVertexArray(g.vao);
  if(g.vbo) gl.deleteBuffer(g.vbo);
  if(g.ibo) gl.deleteBuffer(g.ibo);
  const verts = new Float32Array(N*N*3 + (4*N-4)*3);
  let p = 0;
  for(let j=0;j<N;j++) for(let i=0;i<N;i++){
    verts[p++]= (i+0.5)/N; verts[p++]= (j+0.5)/N; verts[p++]= 0;
  }
  // skirt ring: duplicate boundary vertices, kind=1
  const skirt=[];
  for(let i=0;i<N;i++) skirt.push([ (i+0.5)/N, 0.5/N ]);
  for(let j=1;j<N;j++) skirt.push([ (N-0.5)/N, (j+0.5)/N ]);
  for(let i=N-2;i>=0;i--) skirt.push([ (i+0.5)/N, (N-0.5)/N ]);
  for(let j=N-2;j>=1;j--) skirt.push([ 0.5/N, (j+0.5)/N ]);
  const skirtStart = N*N;
  skirt.forEach((uv,q)=>{ verts[p++]=uv[0]; verts[p++]=uv[1]; verts[p++]=1; });
  const idx = [];
  const vid = (i,j)=> j*N+i;
  for(let j=0;j<N-1;j++) for(let i=0;i<N-1;i++){
    const a=vid(i,j), b=vid(i+1,j), c=vid(i+1,j+1), d=vid(i,j+1);
    idx.push(a,b,c, a,c,d);
  }
  for(let q=0;q<skirt.length;q++){
    const q2=(q+1)%skirt.length;
    const t=skirtStart+q, b=skirtStart+q2;
    const topA = skirtIndexToVertex(N, q), topB = skirtIndexToVertex(N, q2);
    idx.push(topA, topB, b, topA, b, t);
  }
  g.vao = gl.createVertexArray();
  gl.bindVertexArray(g.vao);
  g.vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 12, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 12, 8);
  g.ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
  g.idxCount = idx.length;
  gl.bindVertexArray(null);

  // brush ring
  if(!g.ringVao){
    g.ringVao = gl.createVertexArray();
    gl.bindVertexArray(g.ringVao);
    g.ringVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g.ringVbo);
    const SEG=48;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(SEG*3), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);
    g.ringSeg = SEG;
  }
}
function skirtIndexToVertex(N, q){
  // walk matches skirt ring construction
  if(q < N) return q;                    // top edge j=0
  q -= N;
  if(q < N-1) return (q+1)*N + (N-1);    // right edge
  q -= (N-1);
  if(q < N) return (N-1)*N + (N-2-q+0);  // bottom edge (reversed) : i from N-2..0 at j=N-1
  q -= N;
  return (N-2-q)*N + 0;                  // left edge j from N-2..1
}

function allocTextures(){
  const N=S.N;
  gl.bindTexture(gl.TEXTURE_2D, g.texData);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, null);
  g.dataBuf = new Float32Array(N*N*4);
  gl.bindTexture(gl.TEXTURE_2D, g.texFlow);
  g.flowBuf = new Float32Array(N*N*2);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, N, N, 0, gl.RG, gl.FLOAT, null);
  S.dirty = true;
}

function uploadTextures(){
  const N=S.N, n2=N*N;
  const db=g.dataBuf, fb=g.flowBuf;
  const h=S.h,w=S.w,s=S.s,h0=S.h0,u=S.u,v=S.v;
  for(let k=0,o=0,f=0;k<n2;k++,o+=4,f+=2){
    db[o]=h[k]; db[o+1]=w[k]; db[o+2]=s[k]; db[o+3]=h0[k];
    fb[f]=u[k]; fb[f+1]=v[k];
  }
  gl.bindTexture(gl.TEXTURE_2D, g.texData);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RGBA, gl.FLOAT, db);
  gl.bindTexture(gl.TEXTURE_2D, g.texFlow);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RG, gl.FLOAT, fb);
  S.dirty=false;
}

/* ---------- minimal mat4 (column major) ---------- */
function m4persp(fov, asp, near, far){
  const f = 1/Math.tan(fov/2), out = new Float32Array(16);
  out[0]=f/asp; out[5]=f; out[10]=(far+near)/(near-far); out[11]=-1;
  out[14]=2*far*near/(near-far);
  return out;
}
function m4look(eye, ctr, up){
  let zx=eye[0]-ctr[0], zy=eye[1]-ctr[1], zz=eye[2]-ctr[2];
  let l=Math.hypot(zx,zy,zz)||1; zx/=l; zy/=l; zz/=l;
  let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
  l=Math.hypot(xx,xy,xz)||1; xx/=l; xy/=l; xz/=l;
  const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
  const out = new Float32Array(16);
  out[0]=xx; out[4]=xy; out[8]=xz;
  out[1]=yx; out[5]=yy; out[9]=yz;
  out[2]=zx; out[6]=zy; out[10]=zz;
  out[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
  out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
  out[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
  out[15]=1;
  return out;
}
function m4mul(a,b){
  const o = new Float32Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++){
    o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
  }
  return o;
}

/* ---------- camera ---------- */
const CAM = {
  tx:0, ty:1.5, tz:0, yaw:0.65, pitch:0.62, dist:230,
  dtx:0, dty:1.5, dtz:0, dyaw:0.65, dpitch:0.62, ddist:230,
  eye:[0,0,0], fov: 45*Math.PI/180,
};
function camUpdate(dtF){
  const k = 1-Math.exp(-dtF*9);
  CAM.tx=lerp(CAM.tx,CAM.dtx,k); CAM.ty=lerp(CAM.ty,CAM.dty,k);
  CAM.tz=lerp(CAM.tz,CAM.dtz,k);
  CAM.yaw=lerp(CAM.yaw,CAM.dyaw,k); CAM.pitch=lerp(CAM.pitch,CAM.dpitch,k);
  CAM.dist=lerp(CAM.dist,CAM.ddist,k);
}
function camVectors(){
  const cp=Math.cos(CAM.pitch), sp=Math.sin(CAM.pitch);
  const cy=Math.cos(CAM.yaw), sy=Math.sin(CAM.yaw);
  const eye=[ CAM.tx + CAM.dist*cp*sy, CAM.ty + CAM.dist*sp, CAM.tz + CAM.dist*cp*cy ];
  const fwd=[ CAM.tx-eye[0], CAM.ty-eye[1], CAM.tz-eye[2] ];
  const l=Math.hypot(...fwd); fwd[0]/=l; fwd[1]/=l; fwd[2]/=l;
  const right=[ -cy, 0, sy ];   // horizontal, perpendicular to fwd
  const up=[ right[1]*fwd[2]-right[2]*fwd[1], right[2]*fwd[0]-right[0]*fwd[2], right[0]*fwd[1]-right[1]*fwd[0] ];
  return {eye, fwd, right, up};
}

/* ---------- render one frame ---------- */
const FOG = [0.63, 0.72, 0.80];
function render(dtF){
  const canvas = $('glc');
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  const w = Math.max(2, Math.round(canvas.clientWidth*dpr));
  const hh = Math.max(2, Math.round(canvas.clientHeight*dpr));
  if(canvas.width!==w || canvas.height!==hh){ canvas.width=w; canvas.height=hh; }
  gl.viewport(0,0,w,hh);

  if(S.dirty) uploadTextures();
  camUpdate(dtF);
  const {eye,fwd,right,up} = camVectors();
  CAM.eye=eye;
  const asp = w/hh;
  const proj = m4persp(CAM.fov, asp, 0.4, 6000);
  const view = m4look(eye, [CAM.tx,CAM.ty,CAM.tz], [0,1,0]);
  const vp = m4mul(proj, view);

  const laz=P.laz*Math.PI/180, lel=P.lel*Math.PI/180;
  const sun=[Math.cos(lel)*Math.cos(laz), Math.sin(lel), Math.cos(lel)*Math.sin(laz)];

  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  // sky
  gl.depthMask(false);
  gl.useProgram(g.pSky);
  gl.uniform3fv(g.uS.uCamFwd, fwd); gl.uniform3fv(g.uS.uCamRight, right); gl.uniform3fv(g.uS.uCamUp, up);
  gl.uniform3fv(g.uS.uSunDir, sun);
  gl.uniform3f(g.uS.uHorizon, FOG[0],FOG[1],FOG[2]);
  gl.uniform3f(g.uS.uZenith, 0.30,0.46,0.68);
  gl.uniform1f(g.uS.uTanF, Math.tan(CAM.fov/2));
  gl.uniform1f(g.uS.uAspect, asp);
  gl.bindVertexArray(g.emptyVao || (g.emptyVao=gl.createVertexArray()));
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // terrain
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.useProgram(g.pTerrain);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.texData);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.texFlow);
  gl.uniform1i(g.uT.uData,0); gl.uniform1i(g.uT.uFlow,1);
  gl.uniform1f(g.uT.uN, S.N); gl.uniform1f(g.uT.uHalf, S.half);
  gl.uniform1f(g.uT.uEx, P.ex); gl.uniform1f(g.uT.uBase, S.genMin - P.amp*0.75 - 2);
  gl.uniformMatrix4fv(g.uT.uVP, false, vp);
  gl.uniform3fv(g.uT.uEye, eye); gl.uniform3fv(g.uT.uSunDir, sun);
  gl.uniform3fv(g.uT.uFogCol, FOG);
  gl.uniform1i(g.uT.uMode, P.mode);
  gl.uniform1i(g.uT.uShadow, P.shadow?1:0);
  gl.uniform1i(g.uT.uContours, P.contour?1:0);
  gl.uniform1i(g.uT.uGrid, P.grid?1:0);
  gl.uniform1f(g.uT.uCsp, P.csp);
  gl.uniform1f(g.uT.uGenMin, S.genMin); gl.uniform1f(g.uT.uGenMax, S.genMax);
  gl.uniform1f(g.uT.uMaxDl, S.maxDl); gl.uniform1f(g.uT.uMaxSpd, S.maxSpd);
  gl.uniform1f(g.uT.uTime, S.time);
  gl.bindVertexArray(g.vao);
  gl.drawElements(gl.TRIANGLES, g.idxCount, gl.UNSIGNED_INT, 0);

  // brush ring
  if(UI.ringPts){
    gl.useProgram(g.pLine);
    gl.uniformMatrix4fv(g.uL.uVP, false, vp);
    gl.uniform4fv(g.uL.uColor, UI.ringColor);
    gl.bindVertexArray(g.ringVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.ringVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, UI.ringPts);
    gl.drawArrays(gl.LINE_LOOP, 0, g.ringSeg);
  }

  // water
  const drawWater = (P.mode===0 || P.mode===2 || P.mode===3);
  if(drawWater){
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(g.pWater);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.texData);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.texFlow);
    gl.uniform1i(g.uW.uData,0); gl.uniform1i(g.uW.uFlow,1);
    gl.uniform1f(g.uW.uN, S.N); gl.uniform1f(g.uW.uHalf, S.half);
    gl.uniform1f(g.uW.uEx, P.ex);
    gl.uniformMatrix4fv(g.uW.uVP, false, vp);
    gl.uniform3fv(g.uW.uEye, eye); gl.uniform3fv(g.uW.uSunDir, sun);
    gl.uniform1i(g.uW.uMode, P.mode);
    gl.uniform1f(g.uW.uWop, P.wop);
    gl.uniform1f(g.uW.uMaxW, S.maxW); gl.uniform1f(g.uW.uMaxC, S.maxC);
    gl.uniform1f(g.uW.uTime, performance.now()*0.001);
    gl.bindVertexArray(g.vao);
    gl.drawElements(gl.TRIANGLES, g.idxCount, gl.UNSIGNED_INT, 0);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  gl.bindVertexArray(null);
}
