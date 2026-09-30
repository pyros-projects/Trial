// Node Studio → Shadertoy (frame 102 parameter values baked in)
in vec2 v_uv;
out vec4 fragColor;
#define u_time iTime
#define u_frame float(iFrame)
const float u_duration = 8.0; const float u_seed = 0.0; const float u_aa = 1.0;
#define u_res iResolution.xy
const vec4 u_view = vec4(0.0,0.0,1.0,1.0);
const vec4 u_P[18] = vec4[18](vec4(2.0,1.0,0.0,0.0),vec4(1.0,0.0,0.0,0.0),vec4(1.6,0.0,1.3,0.0),vec4(0.0,1.0,0.0,1.0),vec4(1.6,0.25,0.0,1.0),vec4(0.0,0.0,0.0,0.0),vec4(1.0,0.5,0.0,1.0),vec4(0.0,0.0,0.0,0.0),vec4(1.0,3.1028,0.0,0.0),vec4(1.0,0.0,0.0,0.25),vec4(2.0,0.0,0.0,0.0),vec4(0.5,0.5,0.5,1.0),vec4(0.5,0.5,0.5,1.0),vec4(1.0,1.0,1.0,1.0),vec4(0.4267783,0.0,0.0,0.0),vec4(0.0,0.1,0.2,1.0),vec4(0.0,1.25,0.0,1.15),vec4(1.0,0.0,0.0,0.0));

float sdBox(vec2 p, vec2 b){ vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
float sdEqTri(vec2 p, float r){ const float k = 1.7320508; p.x = abs(p.x) - r; p.y = p.y + r/k; if (p.x + k*p.y > 0.0) p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.0; p.x -= clamp(p.x, -2.0*r, 0.0); return -length(p)*sign(p.y); }
float sdHex(vec2 p, float r){ const vec3 k = vec3(-0.866025404,0.5,0.577350269); p = abs(p); p -= 2.0*min(dot(k.xy,p),0.0)*k.xy; p -= vec2(clamp(p.x,-k.z*r,k.z*r), r); return length(p)*sign(p.y); }
float sdStar5(vec2 p, float r, float rf){ const vec2 k1 = vec2(0.809016994375,-0.587785252292); const vec2 k2 = vec2(-k1.x,k1.y); p.x = abs(p.x); p -= 2.0*max(dot(k1,p),0.0)*k1; p -= 2.0*max(dot(k2,p),0.0)*k2; p.x = abs(p.x); p.y -= r; vec2 ba = rf*vec2(-k1.y,k1.x) - vec2(0,1); float hh = clamp(dot(p,ba)/dot(ba,ba), 0.0, r); return length(p-ba*hh)*sign(p.y*ba.x - p.x*ba.y); }
float sdCross(vec2 p, vec2 b, float r){ p = abs(p); p = (p.y > p.x) ? p.yx : p.xy; vec2 q = p - b; float k = max(q.y,q.x); vec2 w = (k > 0.0) ? q : vec2(b.y-p.x, -k); return sign(k)*length(max(w,0.0)) + r; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p-a, ba = b-a; float hh = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa - ba*hh); }
float sdHeart(vec2 p){ p.x = abs(p.x); if (p.y + p.x > 1.0) return sqrt(dot(p-vec2(0.25,0.75),p-vec2(0.25,0.75))) - 0.35355339; vec2 q = p - 0.5*max(p.x+p.y,0.0); return sqrt(min(dot(p-vec2(0.0,1.0),p-vec2(0.0,1.0)), dot(q,q)))*sign(p.x-p.y); }
vec2 rot2(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }
float shapeSDF(vec2 p, int kind, float size, float asp, float corner, float thick, float inner){
  if (kind == 0) return length(p) - size;
  if (kind == 1) return sdBox(p, vec2(size*asp, size));
  if (kind == 2) return sdBox(p, vec2(size*asp, size) - corner) - corner;
  if (kind == 3) return abs(length(p) - size) - thick;
  if (kind == 4) return sdEqTri(p, size);
  if (kind == 5) return sdHex(p, size);
  if (kind == 6) return sdStar5(p, size, inner);
  if (kind == 7) return sdCross(p, vec2(size, size*0.3*asp), corner);
  if (kind == 8) return sdSeg(p, vec2(-size*asp,0.0), vec2(size*asp,0.0)) - thick;
  return sdHeart(p/(size*1.6) + vec2(0.0,0.5))*size*1.6;
}
float aaFill(float d, float soft){ float w = max(fwidth(d)*u_aa, 1e-5) + soft; return 1.0 - smoothstep(-w, w, d); }


float waveF(float x, int k){
  if (k == 0) return 0.5 + 0.5*sin(x*6.2831853);
  if (k == 1) return 1.0 - abs(fract(x)*2.0 - 1.0);
  if (k == 2) return fract(x);
  if (k == 3) return step(0.5, fract(x));
  return smoothstep(0.0, 0.08, fract(x)) * (1.0 - smoothstep(0.12, 0.2, fract(x)));
}
vec2 waveF(vec2 x, int k){ return vec2(waveF(x.x,k), waveF(x.y,k)); }
vec3 waveF(vec3 x, int k){ return vec3(waveF(x.x,k), waveF(x.y,k), waveF(x.z,k)); }
vec4 waveF(vec4 x, int k){ return vec4(waveF(x.x,k), waveF(x.y,k), waveF(x.z,k), waveF(x.w,k)); }


vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p = mix(vec4(c.bg,K.wz), vec4(c.gb,K.xy), step(c.b,c.g)); vec4 q = mix(vec4(p.xyw,c.r), vec4(c.r,p.yzx), step(p.x,c.r)); float d = q.x - min(q.w,q.y); float e = 1.0e-10; return vec3(abs(q.z + (q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1.0,2.0/3.0,1.0/3.0))*6.0 - 3.0); return c.z*mix(vec3(1.0), clamp(p-1.0,0.0,1.0), c.y); }

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 v_uv = fragCoord/iResolution.xy; vec2 uv = v_uv;
// ── Coordinates (n1, uv)
  vec2 v_n1_uv_b = int(u_P[0].x) == 0 ? uv : int(u_P[0].x) == 1 ? uv*2.0-1.0 : int(u_P[0].x) == 2 ? (uv*2.0-1.0)*vec2(u_res.x/u_res.y,1.0) : uv*u_res;
  vec2 v_n1_uv = v_n1_uv_b*u_P[0].y + u_P[0].zw;
  float v_n1_x = v_n1_uv.x; float v_n1_y = v_n1_uv.y;
// ── Time (n2, time)
  float v_n2_t = u_time*u_P[1].x + u_P[1].y; float v_n2_frame = u_frame;
  float v_n2_phase = fract(u_time/max(u_duration,1e-4)*u_P[1].x + u_P[1].y);
  float v_n2_lsin = sin(v_n2_phase*6.2831853); float v_n2_lcos = cos(v_n2_phase*6.2831853);
// ── Twirl (n3, twirl)
  vec2 v_n3_out_d = v_n1_uv - u_P[1].zw; float v_n3_out_f = clamp(1.0 - length(v_n3_out_d)/u_P[2].x, 0.0, 1.0);
  vec2 v_n3_out = u_P[1].zw + rot2(v_n3_out_d, v_n2_lsin*v_n3_out_f*v_n3_out_f);
// ── Split (n4, split)
  vec4 v_n4_x_v = vec4(v_n3_out,0.0,1.0); float v_n4_x = v_n4_x_v.x; float v_n4_y = v_n4_x_v.y; float v_n4_z = v_n4_x_v.z; float v_n4_w = v_n4_x_v.w;
// ── x + t (n5, math)
  float v_n5_out_a = v_n4_x; float v_n5_out_b = v_n2_t; float v_n5_out_r;
  if (int(u_P[2].y) == 0) v_n5_out_r = v_n5_out_a + v_n5_out_b; else if (int(u_P[2].y) == 1) v_n5_out_r = v_n5_out_a - v_n5_out_b; else if (int(u_P[2].y) == 2) v_n5_out_r = v_n5_out_a * v_n5_out_b;
  else if (int(u_P[2].y) == 3) v_n5_out_r = v_n5_out_a / v_n5_out_b; else if (int(u_P[2].y) == 4) v_n5_out_r = pow(v_n5_out_a, v_n5_out_b); else if (int(u_P[2].y) == 5) v_n5_out_r = min(v_n5_out_a, v_n5_out_b);
  else if (int(u_P[2].y) == 6) v_n5_out_r = max(v_n5_out_a, v_n5_out_b); else if (int(u_P[2].y) == 7) v_n5_out_r = mod(v_n5_out_a, v_n5_out_b); else if (int(u_P[2].y) == 8) v_n5_out_r = atan(v_n5_out_a, v_n5_out_b);
  else if (int(u_P[2].y) == 9) v_n5_out_r = step(v_n5_out_a, v_n5_out_b); else v_n5_out_r = floor(v_n5_out_a / v_n5_out_b + 0.5) * v_n5_out_b;
  float v_n5_out = v_n5_out_r;
// ── Wave X (n6, wave)
  float v_n6_out = waveF(v_n5_out*u_P[2].z + u_P[2].w, int(u_P[3].x))*u_P[3].y + u_P[3].z;
// ── y − t (n7, math)
  float v_n7_out_a = v_n4_y; float v_n7_out_b = v_n2_t; float v_n7_out_r;
  if (int(u_P[3].w) == 0) v_n7_out_r = v_n7_out_a + v_n7_out_b; else if (int(u_P[3].w) == 1) v_n7_out_r = v_n7_out_a - v_n7_out_b; else if (int(u_P[3].w) == 2) v_n7_out_r = v_n7_out_a * v_n7_out_b;
  else if (int(u_P[3].w) == 3) v_n7_out_r = v_n7_out_a / v_n7_out_b; else if (int(u_P[3].w) == 4) v_n7_out_r = pow(v_n7_out_a, v_n7_out_b); else if (int(u_P[3].w) == 5) v_n7_out_r = min(v_n7_out_a, v_n7_out_b);
  else if (int(u_P[3].w) == 6) v_n7_out_r = max(v_n7_out_a, v_n7_out_b); else if (int(u_P[3].w) == 7) v_n7_out_r = mod(v_n7_out_a, v_n7_out_b); else if (int(u_P[3].w) == 8) v_n7_out_r = atan(v_n7_out_a, v_n7_out_b);
  else if (int(u_P[3].w) == 9) v_n7_out_r = step(v_n7_out_a, v_n7_out_b); else v_n7_out_r = floor(v_n7_out_a / v_n7_out_b + 0.5) * v_n7_out_b;
  float v_n7_out = v_n7_out_r;
// ── Wave Y (n8, wave)
  float v_n8_out = waveF(v_n7_out*u_P[4].x + u_P[4].y, int(u_P[4].z))*u_P[4].w + u_P[5].x;
// ── Sum 1 (n15, math)
  float v_n15_out_a = v_n6_out; float v_n15_out_b = v_n8_out; float v_n15_out_r;
  if (int(u_P[5].y) == 0) v_n15_out_r = v_n15_out_a + v_n15_out_b; else if (int(u_P[5].y) == 1) v_n15_out_r = v_n15_out_a - v_n15_out_b; else if (int(u_P[5].y) == 2) v_n15_out_r = v_n15_out_a * v_n15_out_b;
  else if (int(u_P[5].y) == 3) v_n15_out_r = v_n15_out_a / v_n15_out_b; else if (int(u_P[5].y) == 4) v_n15_out_r = pow(v_n15_out_a, v_n15_out_b); else if (int(u_P[5].y) == 5) v_n15_out_r = min(v_n15_out_a, v_n15_out_b);
  else if (int(u_P[5].y) == 6) v_n15_out_r = max(v_n15_out_a, v_n15_out_b); else if (int(u_P[5].y) == 7) v_n15_out_r = mod(v_n15_out_a, v_n15_out_b); else if (int(u_P[5].y) == 8) v_n15_out_r = atan(v_n15_out_a, v_n15_out_b);
  else if (int(u_P[5].y) == 9) v_n15_out_r = step(v_n15_out_a, v_n15_out_b); else v_n15_out_r = floor(v_n15_out_a / v_n15_out_b + 0.5) * v_n15_out_b;
  float v_n15_out = v_n15_out_r;
// ── x + y (n9, math)
  float v_n9_out_a = v_n4_x; float v_n9_out_b = v_n4_y; float v_n9_out_r;
  if (int(u_P[5].z) == 0) v_n9_out_r = v_n9_out_a + v_n9_out_b; else if (int(u_P[5].z) == 1) v_n9_out_r = v_n9_out_a - v_n9_out_b; else if (int(u_P[5].z) == 2) v_n9_out_r = v_n9_out_a * v_n9_out_b;
  else if (int(u_P[5].z) == 3) v_n9_out_r = v_n9_out_a / v_n9_out_b; else if (int(u_P[5].z) == 4) v_n9_out_r = pow(v_n9_out_a, v_n9_out_b); else if (int(u_P[5].z) == 5) v_n9_out_r = min(v_n9_out_a, v_n9_out_b);
  else if (int(u_P[5].z) == 6) v_n9_out_r = max(v_n9_out_a, v_n9_out_b); else if (int(u_P[5].z) == 7) v_n9_out_r = mod(v_n9_out_a, v_n9_out_b); else if (int(u_P[5].z) == 8) v_n9_out_r = atan(v_n9_out_a, v_n9_out_b);
  else if (int(u_P[5].z) == 9) v_n9_out_r = step(v_n9_out_a, v_n9_out_b); else v_n9_out_r = floor(v_n9_out_a / v_n9_out_b + 0.5) * v_n9_out_b;
  float v_n9_out = v_n9_out_r;
// ── + t (n10, math)
  float v_n10_out_a = v_n9_out; float v_n10_out_b = v_n2_t; float v_n10_out_r;
  if (int(u_P[5].w) == 0) v_n10_out_r = v_n10_out_a + v_n10_out_b; else if (int(u_P[5].w) == 1) v_n10_out_r = v_n10_out_a - v_n10_out_b; else if (int(u_P[5].w) == 2) v_n10_out_r = v_n10_out_a * v_n10_out_b;
  else if (int(u_P[5].w) == 3) v_n10_out_r = v_n10_out_a / v_n10_out_b; else if (int(u_P[5].w) == 4) v_n10_out_r = pow(v_n10_out_a, v_n10_out_b); else if (int(u_P[5].w) == 5) v_n10_out_r = min(v_n10_out_a, v_n10_out_b);
  else if (int(u_P[5].w) == 6) v_n10_out_r = max(v_n10_out_a, v_n10_out_b); else if (int(u_P[5].w) == 7) v_n10_out_r = mod(v_n10_out_a, v_n10_out_b); else if (int(u_P[5].w) == 8) v_n10_out_r = atan(v_n10_out_a, v_n10_out_b);
  else if (int(u_P[5].w) == 9) v_n10_out_r = step(v_n10_out_a, v_n10_out_b); else v_n10_out_r = floor(v_n10_out_a / v_n10_out_b + 0.5) * v_n10_out_b;
  float v_n10_out = v_n10_out_r;
// ── Wave diag (n11, wave)
  float v_n11_out = waveF(v_n10_out*u_P[6].x + u_P[6].y, int(u_P[6].z))*u_P[6].w + u_P[7].x;
// ── Sum 2 (n16, math)
  float v_n16_out_a = v_n15_out; float v_n16_out_b = v_n11_out; float v_n16_out_r;
  if (int(u_P[7].y) == 0) v_n16_out_r = v_n16_out_a + v_n16_out_b; else if (int(u_P[7].y) == 1) v_n16_out_r = v_n16_out_a - v_n16_out_b; else if (int(u_P[7].y) == 2) v_n16_out_r = v_n16_out_a * v_n16_out_b;
  else if (int(u_P[7].y) == 3) v_n16_out_r = v_n16_out_a / v_n16_out_b; else if (int(u_P[7].y) == 4) v_n16_out_r = pow(v_n16_out_a, v_n16_out_b); else if (int(u_P[7].y) == 5) v_n16_out_r = min(v_n16_out_a, v_n16_out_b);
  else if (int(u_P[7].y) == 6) v_n16_out_r = max(v_n16_out_a, v_n16_out_b); else if (int(u_P[7].y) == 7) v_n16_out_r = mod(v_n16_out_a, v_n16_out_b); else if (int(u_P[7].y) == 8) v_n16_out_r = atan(v_n16_out_a, v_n16_out_b);
  else if (int(u_P[7].y) == 9) v_n16_out_r = step(v_n16_out_a, v_n16_out_b); else v_n16_out_r = floor(v_n16_out_a / v_n16_out_b + 0.5) * v_n16_out_b;
  float v_n16_out = v_n16_out_r;
// ── Length (n12, vecmath)
  float v_n12_out = int(u_P[7].z) == 0 ? length(v_n3_out) : int(u_P[7].z) == 1 ? distance(v_n3_out, vec2(u_P[7].w)) : dot(v_n3_out, vec2(u_P[7].w));
// ── r − t (n13, math)
  float v_n13_out_a = v_n12_out; float v_n13_out_b = v_n2_t; float v_n13_out_r;
  if (int(u_P[8].x) == 0) v_n13_out_r = v_n13_out_a + v_n13_out_b; else if (int(u_P[8].x) == 1) v_n13_out_r = v_n13_out_a - v_n13_out_b; else if (int(u_P[8].x) == 2) v_n13_out_r = v_n13_out_a * v_n13_out_b;
  else if (int(u_P[8].x) == 3) v_n13_out_r = v_n13_out_a / v_n13_out_b; else if (int(u_P[8].x) == 4) v_n13_out_r = pow(v_n13_out_a, v_n13_out_b); else if (int(u_P[8].x) == 5) v_n13_out_r = min(v_n13_out_a, v_n13_out_b);
  else if (int(u_P[8].x) == 6) v_n13_out_r = max(v_n13_out_a, v_n13_out_b); else if (int(u_P[8].x) == 7) v_n13_out_r = mod(v_n13_out_a, v_n13_out_b); else if (int(u_P[8].x) == 8) v_n13_out_r = atan(v_n13_out_a, v_n13_out_b);
  else if (int(u_P[8].x) == 9) v_n13_out_r = step(v_n13_out_a, v_n13_out_b); else v_n13_out_r = floor(v_n13_out_a / v_n13_out_b + 0.5) * v_n13_out_b;
  float v_n13_out = v_n13_out_r;
// ── Wave radial (n14, wave)
  float v_n14_out = waveF(v_n13_out*u_P[8].y + u_P[8].z, int(u_P[8].w))*u_P[9].x + u_P[9].y;
// ── Sum 3 (n17, math)
  float v_n17_out_a = v_n16_out; float v_n17_out_b = v_n14_out; float v_n17_out_r;
  if (int(u_P[9].z) == 0) v_n17_out_r = v_n17_out_a + v_n17_out_b; else if (int(u_P[9].z) == 1) v_n17_out_r = v_n17_out_a - v_n17_out_b; else if (int(u_P[9].z) == 2) v_n17_out_r = v_n17_out_a * v_n17_out_b;
  else if (int(u_P[9].z) == 3) v_n17_out_r = v_n17_out_a / v_n17_out_b; else if (int(u_P[9].z) == 4) v_n17_out_r = pow(v_n17_out_a, v_n17_out_b); else if (int(u_P[9].z) == 5) v_n17_out_r = min(v_n17_out_a, v_n17_out_b);
  else if (int(u_P[9].z) == 6) v_n17_out_r = max(v_n17_out_a, v_n17_out_b); else if (int(u_P[9].z) == 7) v_n17_out_r = mod(v_n17_out_a, v_n17_out_b); else if (int(u_P[9].z) == 8) v_n17_out_r = atan(v_n17_out_a, v_n17_out_b);
  else if (int(u_P[9].z) == 9) v_n17_out_r = step(v_n17_out_a, v_n17_out_b); else v_n17_out_r = floor(v_n17_out_a / v_n17_out_b + 0.5) * v_n17_out_b;
  float v_n17_out = v_n17_out_r;
// ── Average (n18, math)
  float v_n18_out_a = v_n17_out; float v_n18_out_b = u_P[9].w; float v_n18_out_r;
  if (int(u_P[10].x) == 0) v_n18_out_r = v_n18_out_a + v_n18_out_b; else if (int(u_P[10].x) == 1) v_n18_out_r = v_n18_out_a - v_n18_out_b; else if (int(u_P[10].x) == 2) v_n18_out_r = v_n18_out_a * v_n18_out_b;
  else if (int(u_P[10].x) == 3) v_n18_out_r = v_n18_out_a / v_n18_out_b; else if (int(u_P[10].x) == 4) v_n18_out_r = pow(v_n18_out_a, v_n18_out_b); else if (int(u_P[10].x) == 5) v_n18_out_r = min(v_n18_out_a, v_n18_out_b);
  else if (int(u_P[10].x) == 6) v_n18_out_r = max(v_n18_out_a, v_n18_out_b); else if (int(u_P[10].x) == 7) v_n18_out_r = mod(v_n18_out_a, v_n18_out_b); else if (int(u_P[10].x) == 8) v_n18_out_r = atan(v_n18_out_a, v_n18_out_b);
  else if (int(u_P[10].x) == 9) v_n18_out_r = step(v_n18_out_a, v_n18_out_b); else v_n18_out_r = floor(v_n18_out_a / v_n18_out_b + 0.5) * v_n18_out_b;
  float v_n18_out = v_n18_out_r;
// ── Cosine Palette (n19, palette)
  vec4 v_n19_out = vec4(u_P[11].rgb + u_P[12].rgb*cos(6.2831853*(u_P[13].rgb*(v_n18_out + u_P[14].x) + u_P[15].rgb)), 1.0);
// ── Color Adjust (n20, adjust)
  vec4 v_n20_out_c = v_n19_out; vec3 v_n20_out_h = rgb2hsv(max(v_n20_out_c.rgb, 0.0)); v_n20_out_h.x = fract(v_n20_out_h.x + u_P[16].x/360.0); v_n20_out_h.y *= u_P[16].y;
  vec3 v_n20_out_r = hsv2rgb(v_n20_out_h) + u_P[16].z; v_n20_out_r = (v_n20_out_r - 0.5)*u_P[16].w + 0.5; v_n20_out_r = pow(max(v_n20_out_r, 0.0), vec3(1.0/u_P[17].x));
  if (int(u_P[17].y) > 1){ float n = float(int(u_P[17].y)) - 1.0; v_n20_out_r = floor(clamp(v_n20_out_r,0.0,1.0)*n + 0.5)/n; }
  if (int(u_P[17].z) == 1) v_n20_out_r = 1.0 - v_n20_out_r;
  vec4 v_n20_out = vec4(v_n20_out_r, v_n20_out_c.a);
// ── Output (n21, output)
  vec4 v_n21_res = v_n20_out;
  fragColor = v_n21_res;
}