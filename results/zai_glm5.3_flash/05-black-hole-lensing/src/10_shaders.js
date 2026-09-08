'use strict';
/* ============================================================================
 *  Shaders. All rendering is done with raw WebGL2 — no libraries.
 *  The main fragment shader integrates photon geodesics backwards from the
 *  camera:  d²x/dλ² = -(3/2)·rs·h²·x/r⁵   (Schwarzschild null geodesic in
 *  Cartesian form, h = |x×v| conserved). This reproduces the photon sphere,
 *  the shadow, Einstein-ring lensing of the star field, and higher-order
 *  images of the accretion disk.
 * ========================================================================= */

const VERT_SRC = `#version 300 es
void main(){
  vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

const RAY_FRAG_SRC = `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;

uniform vec2  uRes;        // internal render resolution (px)
uniform vec2  uJit;        // subpixel jitter (px)
uniform float uTime;       // simulation time (s)
uniform vec3  uCamPos;
uniform vec3  uCamR, uCamU, uCamF;
uniform float uFocal;      // 1/tan(fovY/2)
uniform int   uMode;       // 0 beauty, 1 steps, 2 deflection, 3 shift, 4 disk uv, 5 distance, 6 class

uniform float uRs;         // Schwarzschild radius (world units) — mass / lensing strength
uniform float uHorR;       // event-horizon capture radius (world units)
uniform float uSpin;       // dimensionless spin a/M (approximation)
uniform float uEscR;       // escape radius

uniform vec3  uDN;         // disk plane normal
uniform vec3  uDU, uDV;    // disk plane basis
uniform float uDin, uDout; // disk inner / outer radius
uniform float uDh;         // disk thickness scale
uniform float uDtemp;      // disk peak temperature at inner edge (K)
uniform float uTurb;       // turbulence amount 0..1
uniform float uDopK;       // Doppler beaming strength 0..1
uniform float uRedK;       // gravitational redshift strength 0..1

uniform float uStepMul;    // ray step size multiplier
uniform int   uMaxSteps;
uniform int   uEnc;        // 0 = float HDR buffers, 1 = compressed LDR fallback

const float PI  = 3.14159265358979;
const float TAU = 6.28318530717959;

/* ---------------- hashing & noise ---------------- */
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y)*p3.z);
}
float hash13(vec3 p3){
  p3 = fract(p3*0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y)*p3.z);
}
float vnoise2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i),               hash12(i+vec2(1,0)), u.x),
             mix(hash12(i+vec2(0,1)),     hash12(i+vec2(1,1)), u.x), u.y);
}
float fbm2(vec2 p){
  float a = 0.5, s = 0.0;
  for(int i=0;i<4;i++){ s += a*vnoise2(p); p = p*2.03 + vec2(17.1,9.2); a *= 0.5; }
  return s;
}
float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i),               hash13(i+vec3(1,0,0)), u.x),
                 mix(hash13(i+vec3(0,1,0)),   hash13(i+vec3(1,1,0)), u.x), u.y),
             mix(mix(hash13(i+vec3(0,0,1)),   hash13(i+vec3(1,0,1)), u.x),
                 mix(hash13(i+vec3(0,1,1)),   hash13(i+vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm3(vec3 p){
  float a = 0.5, s = 0.0;
  for(int i=0;i<3;i++){ s += a*vnoise3(p); p = p*2.07 + vec3(11.7,5.3,9.1); a *= 0.5; }
  return s;
}

/* ---------------- procedural deep sky ---------------- */
vec3 starLayer(vec3 d, float cells, float sizeK, float bright){
  vec3 a = abs(d);
  vec2 uv; float face;
  if(a.x >= a.y && a.x >= a.z){ uv = d.yz/d.x; face = d.x > 0.0 ? 0.0 : 1.0; }
  else if(a.y >= a.z)        { uv = d.xz/d.y; face = d.y > 0.0 ? 2.0 : 3.0; }
  else                       { uv = d.xy/d.z; face = d.z > 0.0 ? 4.0 : 5.0; }
  vec2 g  = uv*cells;
  vec2 id = floor(g), f = fract(g);
  vec2 sp = vec2(hash12(id + face*97.13 + 13.7), hash12(id + face*97.13 + 57.1));
  float dist = length(f - sp);
  float m    = hash12(id*1.71 + face*31.7 + 5.0);
  float star = 1.0 - smoothstep(0.0, sizeK, dist);
  star = star*star*star;
  float on = step(0.72, m);
  float tint = hash12(id + face*11.1 + 7.7);
  vec3 col = mix(vec3(1.0,0.72,0.5), vec3(0.62,0.76,1.0), tint);
  return star*on*bright*mix(vec3(1.0), col, 0.85)*(0.4 + 0.6*m);
}
vec3 background(vec3 d){
  vec3 c = vec3(0.0);
  c += starLayer(d, 22.0, 0.10, 2.6);
  c += starLayer(d, 45.0, 0.08, 1.2);
  c += starLayer(d, 88.0, 0.07, 0.55);
  vec3 bn = normalize(vec3(0.38, 1.0, 0.22));            // galactic band normal
  float band = exp(-abs(dot(d, bn))*4.0);
  float n1 = fbm3(d*3.1);
  float n2 = vnoise3(d*7.3 + 3.7);
  vec3 dust = mix(vec3(0.10,0.13,0.30), vec3(0.38,0.18,0.24), n2);
  c += band*dust*(0.5*n1*n1 + 0.06*n2);
  c += vec3(0.012,0.015,0.026)*fbm3(d*1.9 + 7.0);        // faint nebulosity everywhere
  return c;
}

/* ---------------- thermal emission ---------------- */
vec3 blackbody(float T){
  float t = clamp(T, 1000.0, 40000.0)*0.01;
  float r = t <= 66.0 ? 1.0 : clamp(1.29293*pow(t-60.0, -0.1332047), 0.0, 1.0);
  float g = t <= 66.0 ? clamp(0.3900819*log(t) - 0.6318414, 0.0, 1.0)
                      : clamp(1.1298909*pow(t-60.0, -0.0755148), 0.0, 1.0);
  float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068*log(t-10.0) - 1.1962541, 0.0, 1.0));
  return vec3(r,g,b);
}

/* ---------------- accretion disk sample ---------------- */
struct DiskSample {
  vec3  emit;
  float density;
  float dop;
  float g;
  float temp;
  float rad;
  float phi;
};

DiskSample sampleDisk(vec3 p, vec3 vn){
  DiskSample s;
  s.emit = vec3(0.0); s.density = 0.0; s.dop = 1.0; s.g = 1.0; s.temp = 0.0; s.rad = 0.0; s.phi = 0.0;
  float hgt = dot(p, uDN);
  vec3  pf  = p - hgt*uDN;
  float r   = length(pf);
  if(r < uDin || r > uDout) return s;

  float H  = uDh*(0.3 + 0.7*smoothstep(uDin, uDout*0.85, r));  // flared thickness
  float vz = exp(-0.5*pow(abs(hgt)/H, 1.7));   // crisp vertical profile
  if(vz < 0.003) return s;

  float phi   = atan(dot(pf,uDV), dot(pf,uDU));
  float omega = 1.5*inversesqrt(r*r*r);                 // Keplerian dphi/dt
  float phiR  = mod(phi - uTime*omega, TAU);            // differentially rotated coords
  float prof  = smoothstep(uDin, uDin*1.07, r)*(1.0 - smoothstep(uDout*0.6, uDout, r));
  if(prof*vz < 0.004) return s;                         // skip noise where disk is invisible
  vec2 q    = vec2(log(r)*4.0, phiR*(14.0/TAU));
  float n1 = fbm2(q);
  float n2 = vnoise2(q*vec2(2.2,2.9) + vec2(4.7,1.3));
  float m  = clamp(0.62*n1 + 0.50*n2, 0.0, 1.2);
  float dens = mix(1.0, smoothstep(0.10, 1.0, m), uTurb);
  dens *= prof*vz;
  if(dens < 0.004) return s;

  /* relativistic factors */
  float g    = sqrt(max(1.0 - uRs/max(r, uRs*1.02), 0.02));       // gravitational redshift
  float beta = min(sqrt(uRs/(2.0*max(r,uRs*0.55))), 0.72)*(uSpin >= 0.0 ? 1.0 : -1.0);
  vec3  tg   = normalize(cross(uDN, pf));
  float gam  = inversesqrt(max(1.0 - beta*beta, 1e-4));
  float dop  = 1.0/(gam*(1.0 + dot(tg*beta, vn)));     // relativistic Doppler factor

  float temp    = uDtemp*pow(uDin/r, 0.75);            // Shakura–Sunyaev T(r)
  float tempObs = temp*mix(1.0, g, uRedK)*pow(dop, 0.6*uDopK);
  float em      = 0.50*pow(max(temp,1000.0)/6500.0, 1.6);        // emission measure vs radius
  float bright  = pow(mix(1.0, g, uRedK), 2.0)*pow(dop, 3.0*uDopK); // beaming + redshift dimming
  s.emit = blackbody(tempObs)*em*bright;
  s.density = dens;
  s.dop = dop; s.g = g; s.temp = tempObs; s.rad = r; s.phi = phi;
  return s;
}

/* ---------------- colormaps for diagnostic modes ---------------- */
vec3 turbo(float x){
  x = clamp(x, 0.0, 1.0);
  return clamp(vec3(
    0.13572138 + x*( 4.61539260 + x*(-42.66032258 + x*( 132.13108234 + x*(-152.94239396 + x*59.28637943)))),
    0.09140261 + x*( 2.19418839 + x*(  4.84296658 + x*( -14.18503333 + x*(   4.27729857 + x* 2.82956604)))),
    0.10667330 + x*(12.64194608 + x*(-60.58204836 + x*( 110.36276771 + x*( -89.90310912 + x*27.34824973))))
  ), 0.0, 1.0);
}
vec3 shiftColor(float s){
  float l = clamp(log2(max(s, 0.03))/2.0, -1.0, 1.0);
  float m = clamp(abs(l), 0.0, 1.0);
  vec3 c = l < 0.0 ? vec3(1.0,0.28,0.10) : vec3(0.25,0.55,1.0);
  return vec3(0.05,0.06,0.09) + c*m + vec3(1.0)*exp(-m*m*20.0)*0.5;
}

/* ---------------- geodesic integration ---------------- */
struct Hit {
  vec3  col;
  float steps;
  int   state;     // 0 escaped, 1 captured, 2 step-limit, 3 absorbed by disk
  float minR;
  float defl;
  float endDist;
  float hR, hPhi, hDop, hG, hDens, hTemp, hValid;
  vec3  endDir;
};

Hit trace(vec3 ro, vec3 rd){
  Hit h;
  h.col = vec3(0.0); h.steps = 0.0; h.state = 2; h.minR = 1e9; h.defl = 0.0;
  h.endDist = 0.0; h.hR = 0.0; h.hPhi = 0.0; h.hDop = 1.0; h.hG = 1.0;
  h.hDens = 0.0; h.hTemp = 0.0; h.hValid = 0.0; h.endDir = rd;

  vec3 p = ro;
  vec3 v = rd;
  vec3 amom = cross(p, v);
  float h2 = dot(amom, amom);                 // conserved: h = impact parameter

  vec3  col   = vec3(0.0);
  float trans = 1.0;
  float slabDt = max(0.45*uDh, 0.02*uRs);
  int   slabN  = 0;   // slab sample budget: keeps grazing rays making progress

  for(int i=0; i<uMaxSteps; i++){
    h.steps = float(i);
    float r2 = dot(p,p);
    float r  = sqrt(r2);
    h.minR = min(h.minR, r);
    if(r < uHorR){ h.state = 1; break; }                        // crossed the horizon
    if(r > uEscR && dot(p,v) > 0.0){ h.state = 0; break; }      // escaped to infinity

    /* adaptive step: fine near the hole & inside the disk slab */
    float dt = uStepMul*uRs*clamp(0.09*(r/uRs - 0.85), 0.018, 1.4);
    float sah = abs(dot(p, uDN));
    vec3  sp0 = p - dot(p,uDN)*uDN;
    float rr0 = length(sp0);
    bool inSlab = rr0 > uDin*0.98 && rr0 < uDout*1.02 && sah < uDh*2.2 + 0.02;
    if(inSlab && slabN < 48) dt = min(dt, slabDt);

    /* leapfrog step of the geodesic */
    vec3 acc = (-1.5*uRs*h2/(r2*r2*r))*p;
    v += acc*dt;
    vec3 pn = p + v*dt;
    vec3 pm = 0.5*(p + pn);

    /* volumetric disk emission (midpoint) */
    vec3  spp = pm - dot(pm,uDN)*uDN;
    float rr  = length(spp);
    if(rr > uDin*0.98 && rr < uDout*1.02 && slabN < 64){
      DiskSample ds = sampleDisk(pm, normalize(v));
      if(ds.density > 0.0){
        slabN++;
        float dts = min(dt, slabDt);                 // effective path in slab
        col   += trans*ds.emit*ds.density*dts*1.7;
        trans *= exp(-ds.density*3.0*dts);
        if(h.hValid < 0.5 && ds.density > 0.04){
          h.hValid = 1.0; h.hR = ds.rad; h.hPhi = ds.phi;
          h.hDop = ds.dop; h.hG = ds.g; h.hDens = ds.density; h.hTemp = ds.temp;
        }
        if(trans < 0.02){ h.state = 3; p = pn; break; }        // optically absorbed
      }
    }
    p = pn;
  }
  if(h.state == 2) h.steps = float(uMaxSteps);

  if(h.state == 0){
    vec3 ed = normalize(v);
    h.endDir = ed;
    h.defl = acos(clamp(dot(rd, ed), -1.0, 1.0));
    if(uMode == 0) col += trans*background(ed);
  } else if(h.state == 1){
    h.defl = PI;
    h.endDir = normalize(v);
  } else {
    h.defl = acos(clamp(dot(rd, normalize(v)), -1.0, 1.0));
    h.endDir = normalize(v);
  }
  h.endDist = distance(p, ro);
  h.col = col;
  return h;
}

void main(){
  vec2 pix = gl_FragCoord.xy + uJit;
  vec2 uv  = (2.0*pix - uRes)/uRes.y;
  vec3 rd  = normalize(uCamF*uFocal + uv.x*uCamR + uv.y*uCamU);
  Hit h = trace(uCamPos, rd);

  vec3 c;
  if(uMode == 0){
    c = h.col;
  } else if(uMode == 1){
    c = turbo(h.steps/float(max(uMaxSteps,1)));
  } else if(uMode == 2){
    float d = clamp(h.defl, 0.0, PI);
    c = turbo(d/PI);
    if(h.state == 1) c = mix(c, vec3(1.0,0.12,0.08), 0.6);
    if(h.state == 2) c = mix(c, vec3(0.95,0.85,0.15), 0.6);
    if(h.state == 3) c *= 0.55;
  } else if(uMode == 3){
    c = h.hValid > 0.5 ? shiftColor(h.hG*h.hDop) : vec3(0.03,0.035,0.05);
  } else if(uMode == 4){
    if(h.hValid > 0.5){
      float rn = h.hR/uDout, ph = fract(h.hPhi/TAU);
      vec3 cc = vec3(rn, ph, h.hDens);
      vec2 g2 = abs(fract(vec2(rn*8.0, ph*8.0)) - 0.5);
      float gl = smoothstep(0.44, 0.5, max(g2.x, g2.y));
      c = mix(cc, vec3(0.85), gl*0.4);
    } else c = vec3(0.03,0.035,0.05);
  } else if(uMode == 5){
    c = turbo(clamp(log2(max(h.endDist, 1e-3)/uRs + 1.0)/5.6, 0.0, 1.0));
  } else {
    if(h.state == 0)      c = mix(vec3(0.05,0.8,0.3), vec3(0.2,0.5,0.95), clamp(h.endDir.y*0.5+0.5, 0.0, 1.0));
    else if(h.state == 1) c = vec3(0.92,0.10,0.08);
    else if(h.state == 2) c = vec3(0.95,0.82,0.12);
    else                  c = vec3(0.6,0.25,0.95);
  }
  if(uEnc == 1 && uMode == 0) c = c/(1.0 + c);   // compress HDR into LDR fallback buffer
  outColor = vec4(c, 1.0);
}`;

const BLEND_FRAG_SRC = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uHist, uCur;
uniform vec2 uRes;
uniform float uAlpha;
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  o = mix(texture(uHist, uv), texture(uCur, uv), uAlpha);
  o.a = 1.0;
}`;

const BLOOM_FRAG_SRC = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uRes;      // target resolution
uniform vec2 uTexel;    // source texel
uniform float uThresh;
uniform int uPass;      // 0 bright/downsample, 1 blur H, 2 blur V
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec3 c;
  if(uPass == 0){
    c = 0.25*( texture(uTex, uv + uTexel*vec2(-0.5,-0.5)).rgb
             + texture(uTex, uv + uTexel*vec2( 0.5,-0.5)).rgb
             + texture(uTex, uv + uTexel*vec2(-0.5, 0.5)).rgb
             + texture(uTex, uv + uTexel*vec2( 0.5, 0.5)).rgb );
    float l = max(c.r, max(c.g, c.b));
    c *= smoothstep(uThresh, uThresh*2.5, l);
  } else {
    vec2 dir = uPass == 1 ? vec2(uTexel.x, 0.0) : vec2(0.0, uTexel.y);
    float w0 = 0.227027, w1 = 0.194595, w2 = 0.121622, w3 = 0.054054, w4 = 0.016216;
    c = texture(uTex, uv).rgb*w0
      + (texture(uTex, uv + dir).rgb + texture(uTex, uv - dir).rgb)*w1
      + (texture(uTex, uv + dir*2.0).rgb + texture(uTex, uv - dir*2.0).rgb)*w2
      + (texture(uTex, uv + dir*3.0).rgb + texture(uTex, uv - dir*3.0).rgb)*w3
      + (texture(uTex, uv + dir*4.0).rgb + texture(uTex, uv - dir*4.0).rgb)*w4;
  }
  o = vec4(c, 1.0);
}`;

const COMP_FRAG_SRC = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uTex, uBloom;
uniform vec2  uRes;
uniform float uExposure, uContrast, uBloomStr;
uniform int   uBeauty, uEnc, uBloomOn;
vec3 aces(vec3 x){ return clamp(x*(2.51*x + 0.03)/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec3 c = texture(uTex, uv).rgb;
  if(uBeauty == 1){
    if(uEnc == 1) c = c/max(1.0 - c, 1e-3);
    if(uBloomOn == 1) c += texture(uBloom, uv).rgb*uBloomStr;
    c = aces(c*uExposure);
    c = pow(c, vec3(1.0/2.2));
    c = clamp((c - 0.5)*uContrast + 0.5, 0.0, 1.0);
    vec2 q = uv*2.0 - 1.0;
    c *= 1.0 - 0.16*pow(dot(q,q)*0.42, 1.4);
  }
  o = vec4(c, 1.0);
}`;
