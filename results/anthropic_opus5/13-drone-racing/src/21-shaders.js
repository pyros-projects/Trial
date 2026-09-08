/* ============================================================================
   SHADERS — GLSL ES 1.00 so one source compiles on WebGL1 and WebGL2.
   Every surface is untextured; all detail (windows, corrugation, rock
   striation, grass mottling, the sky itself) is computed procedurally.
   ========================================================================== */

const GLSL_COMMON = `
precision highp float;
float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float hash31(vec3 p){ p = fract(p*vec3(127.1,311.7,74.7)); p += dot(p,p.yzx+41.3); return fract((p.x+p.y)*p.z); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash21(i), b=hash21(i+vec2(1.0,0.0)), c=hash21(i+vec2(0.0,1.0)), d=hash21(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.11; a*=0.5;} return s; }
vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
`;

/* sky is shared: the fog blends into exactly the colour the sky would be */
const GLSL_SKY = `
uniform vec3 uSkyZenith, uSkyHorizon, uSkyGround, uSunDir, uSunCol;
uniform float uStars, uClouds, uTime;
vec3 skyBase(vec3 d){
  float h = clamp(d.y*0.5+0.5, 0.0, 1.0);
  vec3 c = mix(uSkyHorizon, uSkyZenith, pow(smoothstep(0.0,1.0,h), 0.62));
  c = mix(uSkyGround, c, smoothstep(-0.10, 0.045, d.y));
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunCol * pow(sd, 7.0) * 0.20;
  return c;
}
vec3 skyFull(vec3 d){
  vec3 c = skyBase(d);
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunCol * smoothstep(0.9985, 0.99965, sd) * 9.0;
  c += uSunCol * pow(sd, 90.0) * 0.9;
  if (uStars > 0.01 && d.y > -0.02){
    vec3 q = floor(d*260.0);
    float s = hash31(q);
    float tw = 0.6 + 0.4*sin(uTime*2.3 + s*30.0);
    c += vec3(0.85,0.9,1.0) * step(0.9975, s) * tw * uStars * smoothstep(-0.02,0.25,d.y);
  }
  if (uClouds > 0.01 && d.y > 0.012){
    vec2 uv = d.xz/max(d.y,0.02)*0.055 + vec2(uTime*0.0035, uTime*0.0018);
    float f = fbm(uv*1.6);
    f = smoothstep(0.48, 0.92, f) * uClouds * smoothstep(0.012, 0.22, d.y);
    vec3 lit = mix(uSkyHorizon*1.05, uSunCol*1.15, 0.45);
    c = mix(c, lit, f*0.72);
  }
  return c;
}
`;

const SKY_VS = `
attribute vec3 aPos;
varying vec2 vUV;
void main(){ vUV = aPos.xy; gl_Position = vec4(aPos.xy*2.0, 0.999999, 1.0); }
`;
const SKY_FS = GLSL_COMMON + GLSL_SKY + `
uniform mat4 uInvViewProj;
uniform vec2 uNear;
varying vec2 vUV;
void main(){
  vec4 p0 = uInvViewProj * vec4(vUV*2.0, -1.0, 1.0);
  vec4 p1 = uInvViewProj * vec4(vUV*2.0,  1.0, 1.0);
  vec3 dir = normalize(p1.xyz/p1.w - p0.xyz/p0.w);
  vec3 c = skyFull(dir);
  gl_FragColor = vec4(c, 1.0);
}
`;

/* ---------------------------------------------------------------- scene --- */
const SCENE_VS = `
attribute vec3 aPos;
attribute vec3 aNrm;
attribute vec4 aCol;
#ifdef INSTANCED
attribute vec4 aIPos;    /* xyz position, w material id */
attribute vec4 aIQuat;   /* orientation */
attribute vec4 aIScale;  /* xyz scale, w emissive */
attribute vec4 aICol;    /* rgb tint, w per-instance seed */
#else
uniform mat4 uModel;
uniform vec4 uMatEm;     /* x matId, y emissive, z seed, w alpha */
uniform vec3 uTint;
#endif
uniform mat4 uViewProj, uShadowMat;
varying vec3 vWorld, vNrm, vObj;
varying vec4 vCol, vShadow, vTint;   /* vTint.w = object-space face axis */
varying vec3 vMat;       /* matId, emissive, seed */
vec3 qrot2(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){
  float faceAxis = abs(aNrm.x) > 0.5 ? 0.0 : (abs(aNrm.z) > 0.5 ? 2.0 : 1.0);
#ifdef INSTANCED
  vec3 sp = aPos * aIScale.xyz;
  vec3 wp = qrot2(aIQuat, sp) + aIPos.xyz;
  vec3 wn = normalize(qrot2(aIQuat, aNrm / max(aIScale.xyz, vec3(1e-4))));
  vObj = sp;
  vTint = vec4(aICol.rgb, faceAxis);
  vMat = vec3(aIPos.w, aIScale.w, aICol.w);
#else
  vec3 wp = (uModel * vec4(aPos,1.0)).xyz;
  vec3 wn = normalize(mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * aNrm);
  vObj = aPos;
  vTint = vec4(uTint, faceAxis);
  vMat = uMatEm.xyz;
#endif
  vWorld = wp; vNrm = wn; vCol = aCol;
  vShadow = uShadowMat * vec4(wp, 1.0);
  gl_Position = uViewProj * vec4(wp, 1.0);
}
`;

const SCENE_FS = GLSL_COMMON + GLSL_SKY + `
uniform vec3 uCamPos, uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity, uShadowOn, uShadowTexel, uQuality, uAlpha, uGridStrength;
uniform sampler2D uShadowMap;
varying vec3 vWorld, vNrm, vObj, vMat;
varying vec4 vCol, vShadow, vTint;   /* vTint.w = object-space face axis */

float unpackDepth(vec4 c){ return dot(c, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0)); }

float shadowAt(){
  if (uShadowOn < 0.5) return 1.0;
  vec3 sc = vShadow.xyz / max(vShadow.w, 1e-4);
  sc = sc*0.5 + 0.5;
  if (sc.x < 0.005 || sc.x > 0.995 || sc.y < 0.005 || sc.y > 0.995 || sc.z > 1.0) return 1.0;
  float bias = 0.0016 + 0.004*(1.0 - abs(dot(normalize(vNrm), uSunDir)));
  float s = 0.0;
  if (uQuality > 2.5){
    for (int y=-1; y<=1; y++){
      for (int x=-1; x<=1; x++){
        float d = unpackDepth(texture2D(uShadowMap, sc.xy + vec2(float(x),float(y))*uShadowTexel));
        s += step(sc.z - bias, d);
      }
    }
    s /= 9.0;
  } else {
    s = step(sc.z - bias, unpackDepth(texture2D(uShadowMap, sc.xy)));
  }
  return mix(1.0, s, 0.86);
}

void main(){
  vec3 N = normalize(vNrm);
  vec3 Vv = uCamPos - vWorld;
  float dist = length(Vv);
  vec3 V = Vv / max(dist, 1e-4);
  float matId = vMat.x;
  float emissive = vMat.y;
  float seed = vMat.z;
  vec3 base = vCol.rgb * vTint.rgb;
  vec3 glow = vec3(0.0);

  /* ---------------- procedural materials ----------------
     Every pattern here is high frequency and there are no mipmaps to save us,
     so each one cross-fades to its own average as it recedes. That is what
     stops distant façades from boiling into static. */
  float detail = 1.0 - smoothstep(55.0, 200.0, dist);
  if (matId > 0.5 && matId < 1.5) {                       /* 1 : windowed tower */
    float ax = vTint.w;                       /* object-space face axis */
    vec2 uv = ax < 0.5 ? vObj.zy : (ax > 1.5 ? vObj.xy : vObj.xz);
    vec2 g = vec2(2.6, 3.4);
    vec2 cell = floor(uv/g);
    float r = hash21(cell + seed*13.7 + ax*37.0);
    vec2 f = fract(uv/g);
    float win = step(0.13,f.x)*step(f.x,0.83)*step(0.16,f.y)*step(f.y,0.80);
    float faceMask = ax < 0.5 || ax > 1.5 ? 1.0 : 0.0;
    float lit = step(0.58, r) * win * faceMask;
    float flick = 0.78 + 0.22*sin(uTime*0.7 + r*40.0);
    vec3 wc = mix(vec3(1.0,0.86,0.55), vec3(0.55,0.85,1.0), step(0.5, fract(r*7.3)));
    vec3 avgC = vec3(0.78,0.85,0.78) * 0.20 * faceMask;
    glow += mix(avgC, wc*lit*flick, detail) * 1.05;
    base *= mix(0.80, 0.70 + 0.34*hash21(cell*0.7+seed), detail);
  } else if (matId > 1.5 && matId < 2.5) {                /* 2 : emissive panel */
    glow += base * (1.6 + 0.4*sin(uTime*2.4 + seed*9.0));
  } else if (matId > 2.5 && matId < 3.5) {                /* 3 : banded metal/rock */
    float band = 0.82 + 0.18*sin(vObj.y*2.6 + seed*4.0);
    float grain = 0.90 + 0.10*fbm(vObj.xz*0.9 + seed);
    base *= mix(1.0, band*grain, detail);
  } else if (matId > 3.5 && matId < 4.5) {                /* 4 : corrugated container */
    float rib = 0.80 + 0.20*step(0.5, fract(dot(vObj.xz, vec2(2.2,2.2))));
    float mot = 0.92 + 0.16*hash21(floor(vObj.xy*0.6)+seed);
    base *= mix(0.94, rib*mot, detail);
  } else if (matId > 4.5 && matId < 5.5) {                /* 5 : landing deck */
    float rr = length(vObj.xz);
    float ring = smoothstep(0.02, 0.0, abs(fract(rr*1.6)-0.5)-0.42);
    float up = step(0.5, vTint.w) * step(vTint.w, 1.5);   /* deck surface only */
    base = mix(base, vec3(0.80,0.86,0.95), ring*0.55);
    float ck = mod(floor(vObj.x*1.2)+floor(vObj.z*1.2), 2.0);
    base *= mix(1.0, 0.88 + 0.24*ck, detail);
    glow += vec3(0.16,0.75,0.85) * ring * up * emissive * 0.55;
  } else if (matId > 5.5 && matId < 6.5) {                /* 6 : gate frame */
    float stripe = step(0.5, fract((vObj.x+vObj.y)*1.6 + seed));
    base = mix(base, base*0.55, stripe*0.55*detail);
    glow += base * emissive;
  } else if (matId > 6.5 && matId < 7.5) {                /* 7 : start/finish */
    float ck = mod(floor(vObj.x*1.1)+floor(vObj.y*1.1)+floor(vObj.z*3.2), 2.0);
    base = mix(mix(vec3(0.5), vTint.rgb, 0.35), mix(vec3(0.06), vec3(0.95,0.92,0.85), ck), detail);
    glow += mix(vTint.rgb*0.5, mix(vec3(0.0), vTint.rgb, ck), detail) * emissive;
  } else if (matId > 7.5 && matId < 8.5) {                /* 8 : terrain */
    vec2 w = vWorld.xz;
    float gfade = 1.0 - smoothstep(110.0, 420.0, dist);
    float n1 = fbm(w*0.055), n2 = fbm(w*0.23);
    float slope = 1.0 - clamp(N.y, 0.0, 1.0);
    base *= 0.80 + 0.34*n1 + 0.14*mix(0.5, n2, gfade);
    base = mix(base, base*vec3(1.12,1.03,0.92), smoothstep(0.22,0.62,slope));
    if (uGridStrength > 0.01){
      vec2 gg = abs(fract(w*0.1)-0.5);
      float line = 1.0 - smoothstep(0.0, 0.035, min(gg.x, gg.y));
      glow += vec3(0.10,0.45,0.60) * line * uGridStrength * 0.55 * gfade;
    }
  }
  if (matId < 0.5) glow += base * emissive;

  /* ---------------- lighting ---------------- */
  float sh = shadowAt();
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 diffuse = uSunCol * ndl * sh;
  float skyMix = N.y*0.5 + 0.5;
  vec3 ambient = uAmbient * mix(0.55, 1.25, skyMix) * vCol.a;
  vec3 col = base * (diffuse + ambient);
  vec3 H = normalize(uSunDir + V);
  col += uSunCol * pow(max(dot(N,H), 0.0), 34.0) * 0.16 * sh * vCol.a;
  col += glow;

  /* ---------------- atmosphere ---------------- */
  float fogT = 1.0 - exp(-pow(dist*uFogDensity, 2.0));
  vec3 fogC = mix(uFogColor, skyBase(-V), 0.55);
  float inscat = pow(max(dot(-V, uSunDir), 0.0), 6.0);
  fogC += uSunCol * inscat * 0.35;
  col = mix(col, fogC, clamp(fogT, 0.0, 1.0));
  gl_FragColor = vec4(col, uAlpha);
}
`;

/* ---------------------------------------------------------------- depth --- */
const DEPTH_VS = `
attribute vec3 aPos;
#ifdef INSTANCED
attribute vec4 aIPos; attribute vec4 aIQuat; attribute vec4 aIScale;
#else
uniform mat4 uModel;
#endif
uniform mat4 uViewProj;
varying float vDepth;
vec3 qrot3(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){
#ifdef INSTANCED
  vec3 wp = qrot3(aIQuat, aPos*aIScale.xyz) + aIPos.xyz;
#else
  vec3 wp = (uModel * vec4(aPos,1.0)).xyz;
#endif
  vec4 cp = uViewProj * vec4(wp,1.0);
  gl_Position = cp;
  vDepth = cp.z/cp.w*0.5+0.5;
}
`;
const DEPTH_FS = `
precision highp float;
varying float vDepth;
vec4 packDepth(float d){
  vec4 c = fract(d * vec4(1.0, 255.0, 65025.0, 16581375.0));
  c -= c.yzww * vec4(1.0/255.0, 1.0/255.0, 1.0/255.0, 0.0);
  return c;
}
void main(){ gl_FragColor = packDepth(clamp(vDepth, 0.0, 1.0)); }
`;

/* ----------------------------------------------------- glow / particles --- */
const GLOW_VS = `
attribute vec3 aPos;
attribute vec4 aCol;
attribute vec4 aPPos;   /* xyz world, w size */
attribute vec4 aPCol;   /* rgb colour, w alpha */
attribute vec4 aPVel;   /* xyz velocity, w stretch */
uniform mat4 uViewProj;
uniform vec3 uCamRight, uCamUp, uCamPos;
uniform float uMode;
varying vec2 vUV; varying vec4 vCol; varying float vRamp;
void main(){
  vec3 r = uCamRight, u = uCamUp;
  if (aPVel.w > 0.001){
    vec3 vd = aPVel.xyz;
    float l = length(vd);
    if (l > 0.001){
      r = normalize(vd);
      u = normalize(cross(r, normalize(uCamPos - aPPos.xyz)));
    }
  }
  float sx = aPPos.w * (1.0 + aPVel.w);
  float sy = aPPos.w;
  vec3 wp = aPPos.xyz + r*(aPos.x*sx) + u*(aPos.y*sy);
  vUV = aPos.xy*2.0;
  vCol = aPCol;
  vRamp = aCol.a;
  gl_Position = uViewProj * vec4(wp, 1.0);
}
`;
const GLOW_FS = `
precision highp float;
uniform float uMode;
varying vec2 vUV; varying vec4 vCol; varying float vRamp;
void main(){
  float a;
  if (uMode > 0.5){                       /* ring: ramp across the band */
    a = 1.0 - abs(vRamp*2.0 - 1.0);
    a = pow(clamp(a,0.0,1.0), 1.4);
  } else {
    float r = length(vUV);
    a = 1.0 - smoothstep(0.0, 1.0, r);
    a *= a;
  }
  gl_FragColor = vec4(vCol.rgb * a * vCol.a, a * vCol.a);
}
`;

/* ----------------------------------------------------------------- line --- */
const LINE_VS = `
attribute vec3 aPos;
attribute vec4 aCol;
uniform mat4 uViewProj, uModel;
varying vec4 vCol;
void main(){ vCol = aCol; gl_Position = uViewProj * (uModel * vec4(aPos,1.0)); }
`;
const LINE_FS = `
precision highp float;
varying vec4 vCol;
uniform float uAlpha;
void main(){ gl_FragColor = vec4(vCol.rgb, vCol.a*uAlpha); }
`;

/* ----------------------------------------------------------------- post --- */
const POST_VS = `
attribute vec3 aPos;
varying vec2 vUV;
void main(){ vUV = aPos.xy + 0.5; gl_Position = vec4(aPos.xy*2.0, 0.0, 1.0); }
`;
const POST_FS = `
precision highp float;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes;
uniform float uTime, uVignette, uBarrel, uChroma, uBloomAmt, uGrain, uExposure, uFpv, uShake, uDamage;
varying vec2 vUV;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
vec3 aces(vec3 x){
  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
void main(){
  vec2 uv = vUV;
  vec2 c = uv - 0.5;
  float r2 = dot(c,c);
  /* lens: barrel distortion, stronger in the FPV camera */
  vec2 duv = uv + c * (uBarrel * r2 * (1.0 + 0.65*r2));
  duv += vec2(sin(uTime*37.0), cos(uTime*29.0)) * uShake * 0.004;
  vec3 col;
  if (uChroma > 0.0005){
    float k = uChroma * (0.35 + r2*2.4);
    col.r = texture2D(uScene, duv + c*k).r;
    col.g = texture2D(uScene, duv).g;
    col.b = texture2D(uScene, duv - c*k).b;
  } else col = texture2D(uScene, duv).rgb;
  if (duv.x < 0.0 || duv.x > 1.0 || duv.y < 0.0 || duv.y > 1.0) col = vec3(0.0);

  if (uBloomAmt > 0.001) col += texture2D(uBloom, duv).rgb * uBloomAmt;

  col *= uExposure;
  col = aces(col);

  /* vignette + a little scan texture only in the FPV feed */
  float vig = 1.0 - uVignette * smoothstep(0.18, 0.88, r2*1.55);
  col *= vig;
  if (uFpv > 0.5){
    float scan = 0.985 + 0.015*sin(uv.y*uRes.y*1.9 + uTime*8.0);
    col *= scan;
    col *= 1.0 - 0.10*smoothstep(0.55, 1.0, r2*1.8);
  }
  if (uDamage > 0.001){
    float band = smoothstep(0.4, 1.0, h21(vec2(floor(uv.y*90.0), floor(uTime*24.0))));
    col = mix(col, vec3(0.9,0.15,0.2)*col.r + col*0.4, band*uDamage*0.55);
  }
  if (uGrain > 0.001){
    float g = h21(uv*uRes + fract(uTime)*137.0) - 0.5;
    col += g * uGrain;
  }
  col = pow(max(col, 0.0), vec3(1.0/2.2));
  gl_FragColor = vec4(col, 1.0);
}
`;

const BRIGHT_FS = `
precision highp float;
uniform sampler2D uScene; uniform vec2 uTexel; uniform float uThreshold;
varying vec2 vUV;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(uScene, vUV + uTexel*vec2(-1.0,-1.0)).rgb;
  c += texture2D(uScene, vUV + uTexel*vec2( 1.0,-1.0)).rgb;
  c += texture2D(uScene, vUV + uTexel*vec2(-1.0, 1.0)).rgb;
  c += texture2D(uScene, vUV + uTexel*vec2( 1.0, 1.0)).rgb;
  c *= 0.25;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  gl_FragColor = vec4(c*k, 1.0);
}
`;
const BLUR_FS = `
precision highp float;
uniform sampler2D uScene; uniform vec2 uDir;
varying vec2 vUV;
void main(){
  vec3 c = texture2D(uScene, vUV).rgb * 0.2270270270;
  c += texture2D(uScene, vUV + uDir*1.3846153846).rgb * 0.3162162162;
  c += texture2D(uScene, vUV - uDir*1.3846153846).rgb * 0.3162162162;
  c += texture2D(uScene, vUV + uDir*3.2307692308).rgb * 0.0702702703;
  c += texture2D(uScene, vUV - uDir*3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;
