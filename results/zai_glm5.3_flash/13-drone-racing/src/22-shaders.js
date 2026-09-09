'use strict';
/* ============================= GLSL (ES 1.00, works on WebGL1+2) ============================= */
const SHADERS = {};

SHADERS.litVS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol; attribute vec4 aData;
uniform mat4 uProj, uView, uModel; uniform mat4 uNrmMat;
varying vec3 vN; varying vec3 vW; varying vec3 vC; varying vec4 vD;
void main(){
  vec4 wp = uModel * vec4(aPos,1.0);
  vW = wp.xyz;
  vN = normalize((uNrmMat * vec4(aNrm,0.0)).xyz);
  vC = aCol; vD = aData;
  gl_Position = uProj * uView * wp;
}`;

SHADERS.litFS = `
precision mediump float;
varying vec3 vN; varying vec3 vW; varying vec3 vC; varying vec4 vD;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol, uCamPos, uFogCol, uTint, uEmis;
uniform float uFogDen, uNight, uTime, uSpec, uShin, uMatOverride, uAlpha;
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
void main(){
  vec3 N = normalize(vN);
  float matId = vD.x;
  if (uMatOverride >= 0.0) matId = uMatOverride;
  vec3 albedo = vC * uTint;
  vec3 emissive = vec3(0.0);
  float spec = uSpec;
  if (matId > 0.5 && matId < 1.5) { // building windows
    vec2 fc = abs(N.x) > abs(N.z) ? vW.zy : vW.xy;
    vec2 cell = floor(fc / vec2(2.6, 3.4));
    float on = step(0.62, hash21(cell + vD.yy * 37.0));
    vec2 f = fract(fc / vec2(2.6, 3.4));
    float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8);
    float tint = hash21(cell * 1.7 + vD.yy);
    vec3 wc = mix(vec3(1.0,0.75,0.4), vec3(0.5,0.85,1.0), step(0.75, tint));
    float nightAmt = clamp(uNight, 0.12, 1.0);
    emissive += wc * on * win * nightAmt * (0.55 + 0.45 * hash21(cell + vec2(uTime * 0.05, vD.y)));
    albedo *= 0.35;
    spec = 0.25;
  } else if (matId > 1.5 && matId < 2.5) { // hazard stripes
    float s = step(0.5, fract((vW.y + vW.x * 0.35) * 0.9));
    albedo = mix(vec3(0.9), vec3(0.05), s) * uTint;
    emissive += vec3(1.0, 0.6, 0.1) * (1.0 - s) * 0.18;
  } else if (matId > 2.5 && matId < 3.5) { // emissive (gates: uEmis*white; neon signs: uEmis*vC)
    albedo *= 0.06;
    emissive += uEmis * vC;
    spec = 0.0;
  } else if (matId > 3.5) { // blinking beacon
    albedo *= 0.1;
    float bl = 0.35 + 0.65 * step(0.5, fract(uTime * 0.7 + vD.y));
    emissive += vC * bl * 2.0;
    spec = 0.0;
  }
  float ndl = max(dot(N, uSunDir), 0.0);
  float hemi = N.y * 0.5 + 0.5;
  vec3 hemiL = mix(uGndCol, uSkyCol, hemi) * 0.85;
  vec3 V = normalize(uCamPos - vW);
  vec3 Hv = normalize(uSunDir + V);
  float sp = pow(max(dot(N, Hv), 0.0), uShin) * spec * step(0.01, ndl);
  vec3 col = albedo * (uSunCol * ndl + hemiL) + uSunCol * sp + emissive;
  float d = length(uCamPos - vW);
  float fog = 1.0 - exp(-d * d * uFogDen * uFogDen);
  col = mix(col, uFogCol, clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(col, uAlpha);
}`;

SHADERS.skyVS = `
attribute vec2 aPos;
uniform mat4 uInvVP;
varying vec4 vWorld;
void main(){
  gl_Position = vec4(aPos, 0.99999, 1.0);
  vWorld = uInvVP * vec4(aPos, 1.0, 1.0); // far-plane point, perspective-correct
}`;

SHADERS.skyFS = `
precision mediump float;
varying vec4 vWorld;
uniform vec3 uCamPos;
uniform vec3 uSunDir, uTop, uHorizon, uGround, uSunCol;
uniform float uNight, uTime;
float hash31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
void main(){
  vec3 d = normalize(vWorld.xyz / vWorld.w - uCamPos);
  float t = clamp(d.y, -1.0, 1.0);
  vec3 col;
  if (t >= 0.0) col = mix(uHorizon, uTop, pow(t, 0.55));
  else col = mix(uHorizon, uGround, pow(-t, 0.5));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 1400.0) * 3.2 + pow(sd, 24.0) * 0.30 + pow(sd, 3.0) * 0.12);
  if (uNight > 0.5) {
    vec3 g = floor(d * 230.0);
    float st = step(0.9985, hash31(g));
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash31(g + 7.0) * 40.0);
    col += vec3(st * tw) * smoothstep(0.05, 0.35, d.y);
  }
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (dither - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}`;

SHADERS.postVS = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

SHADERS.postFS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uVig, uDistort, uAberr, uExpo, uSat, uTime, uNoise;
float hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  vec2 duv = uv + c * r2 * uDistort;         // barrel distortion
  float ab = uAberr * (0.002 + r2 * 0.012);  // chromatic aberration
  vec3 col;
  col.r = texture2D(uTex, duv + c * ab).r;
  col.g = texture2D(uTex, duv).g;
  col.b = texture2D(uTex, duv - c * ab).b;
  col *= uExpo;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, uSat);
  float vig = 1.0 - uVig * smoothstep(0.15, 0.85, r2 * 1.6);
  col *= vig;
  col += (hash12(vUv * uRes + fract(uTime) * 61.0) - 0.5) * uNoise;
  gl_FragColor = vec4(col, 1.0);
}`;

SHADERS.particleVS = `
attribute vec3 aPos; attribute vec4 aCol; attribute float aSize;
uniform mat4 uProj, uView;
uniform float uPointScale;
varying vec4 vCol;
void main(){
  vec4 mv = uView * vec4(aPos, 1.0);
  gl_Position = uProj * mv;
  gl_PointSize = clamp(aSize * uPointScale / max(-mv.z, 0.4), 1.0, 90.0);
  vCol = aCol;
}`;

SHADERS.particleFS = `
precision mediump float;
varying vec4 vCol;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  float a = smoothstep(1.0, 0.15, r);
  gl_FragColor = vec4(vCol.rgb, vCol.a * a);
}`;

SHADERS.lineVS = `
attribute vec3 aPos; attribute vec4 aCol;
uniform mat4 uProj, uView;
varying vec4 vCol;
void main(){ vCol = aCol; gl_Position = uProj * uView * vec4(aPos, 1.0); }`;

SHADERS.lineFS = `
precision mediump float;
varying vec4 vCol;
void main(){ gl_FragColor = vCol; }`;

SHADERS.propVS = `
attribute vec2 aPos;
uniform mat4 uProj, uView, uModel;
varying vec2 vUv;
void main(){
  vUv = aPos;
  vec4 wp = uModel * vec4(aPos, 0.0, 1.0);
  gl_Position = uProj * uView * wp;
}`;

SHADERS.propFS = `
precision mediump float;
varying vec2 vUv;
uniform float uSpin, uAlpha, uTime;
uniform vec3 uCol;
void main(){
  float r = length(vUv);
  if (r > 1.0) discard;
  float ang = atan(vUv.y, vUv.x);
  float streak = 0.55 + 0.45 * sin(ang * 7.0 + uSpin * 34.0 + r * 9.0);
  float blade = 0.5 + 0.5 * sin(ang * 2.0 + uSpin * 34.0);
  float a = pow(1.0 - r, 1.4) * (0.22 + 0.5 * streak * blade);
  gl_FragColor = vec4(uCol * (0.6 + 0.6 * streak), a * uAlpha);
}`;

SHADERS.blobVS = `
attribute vec2 aPos;
uniform mat4 uProj, uView, uModel;
varying vec2 vUv;
void main(){ vUv = aPos; gl_Position = uProj * uView * (uModel * vec4(aPos, 0.0, 1.0)); }`;

SHADERS.blobFS = `
precision mediump float;
varying vec2 vUv;
uniform float uAlpha;
void main(){
  float r = length(vUv);
  float a = (1.0 - smoothstep(0.1, 1.0, r)) * uAlpha;
  gl_FragColor = vec4(0.02, 0.02, 0.03, a);
}`;
