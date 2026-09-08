/* =====================================================================
   Renderer: WebGL2 terrain + water renderer, with a Canvas2D fallback.

   Terrain geometry is a static grid mesh.  Heights, water depth, sediment
   concentration, erosion delta, flow vector and a CPU-computed sun-shadow
   term are streamed to the GPU as float textures each frame; surface normals
   are reconstructed in the fragment shader from the height texture so the
   lighting follows the erosion as it happens.
   ===================================================================== */

const MODES = [
  { id: 'shaded', label: 'Shaded terrain' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'water', label: 'Water depth' },
  { id: 'sediment', label: 'Sediment concentration' },
  { id: 'delta', label: 'Erosion / deposition' },
  { id: 'slope', label: 'Slope' },
  { id: 'flow', label: 'Flow direction + speed' },
];

const clampF = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ------------------------------------------------------------------ */
/*  matrix helpers (column-major, as WebGL expects)                    */
/* ------------------------------------------------------------------ */
function mat4Perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function mat4LookAt(out, ex, ey, ez, cx, cy, cz) {
  let zx = ex - cx;
  let zy = ey - cy;
  let zz = ez - cz;
  let l = Math.hypot(zx, zy, zz) || 1;
  zx /= l;
  zy /= l;
  zz /= l;
  // right = up x z, with up = (0,1,0)
  let rx = zz; // (0,1,0) x (zx,zy,zz) = (1*zz - 0*zy, 0*zx - 0*zz, 0*zy - 1*zx)
  let ry = 0;
  let rz = -zx;
  l = Math.hypot(rx, ry, rz);
  if (l < 1e-6) {
    rx = 1;
    ry = 0;
    rz = 0;
  } else {
    rx /= l;
    ry /= l;
    rz /= l;
  }
  const ux = zy * rz - zz * ry;
  const uy = zz * rx - zx * rz;
  const uz = zx * ry - zy * rx;
  out[0] = rx;
  out[1] = ux;
  out[2] = zx;
  out[3] = 0;
  out[4] = ry;
  out[5] = uy;
  out[6] = zy;
  out[7] = 0;
  out[8] = rz;
  out[9] = uz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(rx * ex + ry * ey + rz * ez);
  out[13] = -(ux * ex + uy * ey + uz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez);
  out[15] = 1;
  return out;
}

/* ------------------------------------------------------------------ */
/*  shaders                                                            */
/* ------------------------------------------------------------------ */

const TERRAIN_VS = `#version 300 es
precision highp float;
uniform sampler2D uData;
uniform vec2 uTexel;
uniform float uExag;
uniform mat4 uProj;
uniform mat4 uView;
uniform float uWaterPass;
uniform float uLineScale;
in vec2 aGrid;
out vec3 vPos;
out vec2 vUV;
out float vShade;
out float vDepth;
out float vSed;

float sampleH(vec2 uv){
  // manual bilinear so the surface stays smooth even when the data texture
  // can only be sampled with NEAREST filtering
  vec2 p = uv / uTexel - 0.5;
  vec2 f = floor(p);
  vec2 r = p - f;
  vec2 a = (f + 0.5) * uTexel;
  float h00 = texture(uData, a).x;
  float h10 = texture(uData, a + vec2(uTexel.x, 0.0)).x;
  float h01 = texture(uData, a + vec2(0.0, uTexel.y)).x;
  float h11 = texture(uData, a + uTexel).x;
  return mix(mix(h00, h10, r.x), mix(h01, h11, r.x), r.y);
}

void main(){
  vec2 uv = clamp(aGrid, 0.0, 1.0);
  vec4 d = texture(uData, uv);
  float h = d.x;
  vDepth = d.y;
  vSed = d.z;
  vShade = d.w;
  float lift = uWaterPass > 0.5 ? min(vDepth, 0.06) * 0.5 : 0.0;
  vec3 p = vec3(uv.x, (h + lift) * uExag, uv.y);
  vPos = p;
  vUV = uv;
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;

const TERRAIN_FS = `#version 300 es
precision highp float;
uniform sampler2D uData;
uniform sampler2D uFlow;
uniform vec2 uTexel;
uniform float uCell;
uniform float uExag;
uniform int uMode;
uniform float uContours;
uniform float uGrid;
uniform float uWaterPass;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uCamPos;
uniform float uFog;
uniform vec2 uMarker;
uniform float uMarkerOn;
in vec3 vPos;
in vec2 vUV;
in float vShade;
in float vDepth;
in float vSed;
out vec4 frag;

vec3 ramp5(vec3 a, vec3 b, vec3 c, vec3 d, vec3 e, float t){
  t = clamp(t, 0.0, 1.0);
  if (t < 0.25) return mix(a, b, t * 4.0);
  if (t < 0.5) return mix(b, c, (t - 0.25) * 4.0);
  if (t < 0.75) return mix(c, d, (t - 0.5) * 4.0);
  return mix(d, e, (t - 0.75) * 4.0);
}

void main(){
  float e = 1.0001;
  float texStep = uTexel.x * e;
  float hC = texture(uData, vUV).x;
  float hL = texture(uData, vUV - vec2(texStep, 0.0)).x;
  float hR = texture(uData, vUV + vec2(texStep, 0.0)).x;
  float hU = texture(uData, vUV - vec2(0.0, texStep)).x;
  float hD = texture(uData, vUV + vec2(0.0, texStep)).x;
  float d = uCell * e;
  float dhdx = (hR - hL) * uExag / (2.0 * d);
  float dhdy = (hD - hU) * uExag / (2.0 * d);
  vec3 n = normalize(vec3(-dhdx, 1.0, -dhdy));
  float slope = clamp(length(vec2(dhdx, dhdy)), 0.0, 3.0);

  // ---- surface colour -------------------------------------------------
  float elev = clamp((hC + 0.05) / 0.45, 0.0, 1.0);
  vec3 col;
  if (uMode == 0) {
    // rock / soil palette driven by height, slope and dampness
    vec3 low = vec3(0.20, 0.31, 0.21);
    vec3 soil = vec3(0.36, 0.30, 0.19);
    vec3 rock = vec3(0.42, 0.40, 0.38);
    vec3 scree = vec3(0.55, 0.50, 0.44);
    vec3 snow = vec3(0.86, 0.88, 0.92);
    col = ramp5(low, soil, rock, scree, snow, elev);
    col = mix(col, scree * 0.85, clamp(slope * 0.75, 0.0, 0.8));
    // freshly eroded ground is bare and pale, fresh silt is bright brown
    float dl = texture(uFlow, vUV).z;
    col = mix(col, vec3(0.66, 0.58, 0.44), clamp(-dl * 90.0, 0.0, 0.75));
    col = mix(col, vec3(0.52, 0.42, 0.26), clamp(dl * 70.0, 0.0, 0.6));
    if (vDepth > 0.0008) col = mix(col, vec3(0.05, 0.11, 0.16), clamp(vDepth * 220.0, 0.0, 0.7));
  } else if (uMode == 1) {
    col = ramp5(vec3(0.03, 0.16, 0.34), vec3(0.10, 0.44, 0.62), vec3(0.87, 0.80, 0.52),
                vec3(0.44, 0.52, 0.30), vec3(0.95, 0.96, 0.98), elev);
  } else if (uMode == 2) {
    float w = clamp(vDepth * 55.0, 0.0, 1.0);
    col = mix(vec3(0.93, 0.90, 0.82), vec3(0.05, 0.22, 0.75), w);
    col = mix(col, vec3(0.85, 0.10, 0.45), clamp(vSed * 90.0, 0.0, 1.0));
  } else if (uMode == 3) {
    float s = clamp(vSed * 140.0, 0.0, 1.0);
    col = mix(vec3(0.06, 0.16, 0.20), vec3(0.98, 0.62, 0.12), s);
    if (vSed > 0.006) col = mix(col, vec3(0.92, 0.14, 0.10), clamp((vSed - 0.006) * 260.0, 0.0, 1.0));
  } else if (uMode == 4) {
    float dl = texture(uFlow, vUV).z;
    col = vec3(0.30, 0.32, 0.34);
    col = mix(col, vec3(0.90, 0.20, 0.12), clamp(-dl * 90.0, 0.0, 1.0));
    col = mix(col, vec3(0.15, 0.72, 0.35), clamp(dl * 90.0, 0.0, 1.0));
  } else if (uMode == 5) {
    // normalise by the TRUE gradient (undo vertical exaggeration) so the ramp
    // still separates gentle from steep when the view is stretched
    float sAng = atan(slope / max(0.01, uExag));
    float s = clamp(sAng / 0.44, 0.0, 1.0);
    col = mix(vec3(0.06, 0.30, 0.55), vec3(0.98, 0.82, 0.20), smoothstep(0.0, 0.45, s));
    col = mix(col, vec3(0.92, 0.18, 0.12), smoothstep(0.45, 1.0, s));
  } else {
    vec4 f = texture(uFlow, vUV);
    float sp = clamp(length(f.xy) * 26.0, 0.0, 1.0);
    float ang = atan(f.y, f.x) / 6.28318 + 0.5;
    vec3 base = vec3(0.10, 0.12, 0.15);
    vec3 dirCol = 0.55 + 0.45 * cos(vec3(0.0, 4.1, 2.4) + ang * 6.28318);
    col = mix(base, dirCol, sp);
  }

  // ---- lighting -------------------------------------------------------
  float ndl = max(dot(n, uSun), 0.0);
  float shade = clamp(vShade, 0.0, 1.0);
  vec3 sunCol = vec3(1.0, 0.94, 0.82);
  vec3 sky = vec3(0.44, 0.52, 0.62);
  vec3 bounce = vec3(0.22, 0.18, 0.14);
  vec3 light = sky * (0.66 + 0.45 * n.y) + bounce * max(0.0, -n.y) * 0.6;
  vec3 lit = col * (light + sunCol * ndl * 1.35 * shade);
  if (uMode == 4) lit = col * 1.15; // keep the diagnostic field readable

  // ---- specular sheen on wet ground -----------------------------------
  if (vDepth < 0.0004) {
    vec3 v = normalize(uCamPos - vPos);
    vec3 hv = normalize(uSun + v);
    float spec = pow(max(dot(n, hv), 0.0), 40.0) * (1.0 - clamp(slope * 1.4, 0.0, 1.0));
    lit += sunCol * spec * 0.20 * shade;
  }

  // ---- contour lines ---------------------------------------------------
  if (uContours > 0.5 && (uMode == 0 || uMode == 1)) {
    float interval = 0.02;
    float hv = hC / interval;
    float f = abs(fract(hv) - 0.5);
    float w = fwidth(hv);
    float ln1 = 1.0 - smoothstep(0.42, 0.5 + w * 0.9, f);
    float index_ = abs(fract(hv / 5.0) - 0.5);
    float thick = 1.0 - smoothstep(0.40, 0.5 + w * 0.9, index_);
    lit = mix(lit, lit * 0.45 + vec3(0.04, 0.05, 0.04), ln1 * 0.5);
    lit = mix(lit, lit * 0.2 + vec3(0.10, 0.11, 0.06), thick * 0.55);
  }

  // ---- simulation grid overlay ----------------------------------------
  if (uGrid > 0.5 && (uMode == 0 || uMode == 1)) {
    vec2 g = vUV / uTexel;
        vec2 dmin = min(g, vec2(1.0) - g);
    float ln2 = 1.0 - smoothstep(0.0, 1.6, min(dmin.x, dmin.y));
    float major = step(7.5, mod(g.x, 8.0)) + step(7.5, mod(g.y, 8.0));
    lit = mix(lit, lit * 0.45 + vec3(0.02), clamp(ln2 * (0.25 + major * 0.35), 0.0, 1.0));
  }

  // ---- water surface extras -------------------------------------------
  if (uWaterPass > 0.5) {
    float depth = clamp(vDepth * 40.0, 0.0, 1.0);
    vec3 clean = vec3(0.10, 0.30, 0.42);
    vec3 muddy = vec3(0.42, 0.28, 0.13);
    col = mix(clean, muddy, clamp(vSed * 120.0, 0.0, 1.0));
    vec3 v = normalize(uCamPos - vPos);
    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
    vec3 refl = mix(vec3(0.34, 0.42, 0.52), col, 0.35);
    vec3 wcol = mix(col, refl, 0.35 + 0.5 * fres);
    vec3 hv = normalize(uSun + v);
    float glint = pow(max(dot(n, hv), 0.0), 90.0);
    wcol += sunCol * glint * 0.9 * shade;
    float spark = pow(max(0.0, sin((vUV.x * 420.0 + uTime * 1.6) * 6.2831) *
                              sin((vUV.y * 380.0 - uTime * 1.3) * 6.2831)), 18.0);
    wcol += vec3(0.5, 0.55, 0.6) * spark * 0.35 * depth;
    lit = wcol;
  }

  // ---- probe marker ----------------------------------------------------
  if (uMarkerOn > 0.5) {
    float dd = length((vUV - uMarker) * vec2(1.0, 1.0));
    float ring = smoothstep(0.013, 0.009, abs(dd - 0.011));
    lit = mix(lit, vec3(1.0, 0.85, 0.25), ring * 0.9);
  }

  // ---- atmospheric depth cue ------------------------------------------
  float dist = length(uCamPos - vPos);
  float fog = clamp((dist - uFog * 0.55) / (uFog * 0.85), 0.0, 0.55);
  lit = mix(lit, vec3(0.50, 0.56, 0.64), fog);

  frag = vec4(pow(clamp(lit, 0.0, 1.0), vec3(0.92)), 1.0);
}`;

const WATER_FS = `#version 300 es
precision highp float;
uniform sampler2D uData;
uniform vec2 uTexel;
uniform float uCell;
uniform float uExag;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uCamPos;
uniform float uFog;
uniform float uOpacity;
in vec3 vPos;
in vec2 vUV;
in float vShade;
in float vDepth;
in float vSed;
out vec4 frag;

void main(){
  if (vDepth < 0.0008) discard;   // thin films stay transparent so channels read clearly
  float e = 1.0001;
  float texStep = uTexel.x * e;
  // normal of the water surface (terrain + film), with a light chop
  float hs = texture(uData, vUV).y;
  float hL = texture(uData, vUV - vec2(texStep, 0.0)).y;
  float hR = texture(uData, vUV + vec2(texStep, 0.0)).y;
  float hU = texture(uData, vUV - vec2(0.0, texStep)).y;
  float hD = texture(uData, vUV + vec2(0.0, texStep)).y;
  float d = uCell * e;
  float ripple = 0.00035 * (sin((vUV.x * 260.0 + uTime * 1.4) * 6.2831) + sin((vUV.y * 233.0 - uTime * 1.1) * 6.2831));
  float dhdx = (hR - hL) * uExag / (2.0 * d) + ripple * 40.0;
  float dhdy = (hD - hU) * uExag / (2.0 * d) + ripple * 34.0;
  vec3 n = normalize(vec3(-dhdx, 1.0, -dhdy));

  float depth = clamp(vDepth * 26.0, 0.0, 1.0);
  vec3 clean = vec3(0.09, 0.34, 0.46);
  vec3 muddy = vec3(0.45, 0.30, 0.14);
  vec3 col = mix(clean, muddy, clamp(vSed * 110.0, 0.0, 1.0));
  col = mix(col * 0.55, col, depth);

  vec3 v = normalize(uCamPos - vPos);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.2);
  vec3 skyRef = vec3(0.40, 0.49, 0.60);
  col = mix(col, skyRef, 0.22 + 0.55 * fres);
  vec3 hv = normalize(uSun + v);
  float glint = pow(max(dot(n, hv), 0.0), 120.0);
  col += vec3(1.0, 0.95, 0.85) * glint * 0.85 * clamp(vShade, 0.0, 1.0);

  // shoreline brightening so thin water reads clearly
  col += vec3(0.16, 0.13, 0.06) * (1.0 - depth) * 0.7;

  float dist = length(uCamPos - vPos);
  float fog = clamp((dist - uFog * 0.55) / (uFog * 0.85), 0.0, 0.45);
  col = mix(col, vec3(0.50, 0.56, 0.64), fog);

  float alpha = clamp(uOpacity * (0.35 + 0.65 * depth) * (0.6 + 0.6 * fres), 0.05, 0.97);
  frag = vec4(pow(clamp(col, 0.0, 1.0), vec3(0.92)), alpha);
}`;

const SKY_VS = `#version 300 es
precision highp float;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform vec2 uTan;
out vec3 vRay;
void main(){
  vec2 p = (gl_VertexID == 1) ? vec2(3.0, -1.0) : (gl_VertexID == 2) ? vec2(-1.0, 3.0) : vec2(-1.0, -1.0);
  vRay = normalize(uFwd + uRight * (p.x * uTan.x) + uUp * (p.y * uTan.y));
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
uniform vec3 uSun;
in vec3 vRay;
out vec4 frag;
void main(){
  vec3 d = normalize(vRay);
  float t = clamp(0.5 - d.y * 0.55, 0.0, 1.0);
  vec3 top = vec3(0.16, 0.26, 0.40);
  vec3 horizon = vec3(0.62, 0.68, 0.74);
  vec3 col = mix(horizon, top, t);
  float sun = pow(max(dot(d, normalize(uSun)), 0.0), 220.0);
  col += vec3(1.0, 0.9, 0.7) * sun * 1.6;
  float halo = pow(max(dot(d, normalize(uSun)), 0.0), 6.0);
  col += vec3(0.35, 0.30, 0.22) * halo * 0.35;
  frag = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------------ */
/*  WebGL2 renderer                                                     */
/* ------------------------------------------------------------------ */

function createGLRenderer(canvas, opts) {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    depth: true,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;
  const info = { name: 'WebGL2', backend: 'gl' };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  if (dbg) info.gpu = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');

  const floatLinear = !!gl.getExtension('OES_texture_float_linear');
  const useFloatLinear = floatLinear;
  info.floatLinear = floatLinear;

  let progTerrain = null;
  let progWater = null;
  let progSky = null;
  let meshBuf = null;
  let idxBuf = null;
  let idxCount = 0;
  let meshRes = 0;
  let dataTex = null;
  let flowTex = null;
  let texSize = 0;
  let dataBuf = null;
  let flowBuf = null;
  let shadowBuf = null;

  const uni = {};
  function uniforms(prog) {
    const cache = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const u = gl.getActiveUniform(prog, i);
      cache[u.name] = gl.getUniformLocation(prog, u.name);
    }
    return cache;
  }

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('shader compile failed: ' + log);
    }
    return sh;
  }

  function link(vsSrc, fsSrc) {
    const p = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aGrid');
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link failed: ' + gl.getProgramInfoLog(p));
    return p;
  }

  function buildResources() {
    try {
      progTerrain = link(TERRAIN_VS, TERRAIN_FS);
      progWater = link(TERRAIN_VS, WATER_FS);
      progSky = link(SKY_VS, SKY_FS);
    } catch (err) {
      console.warn('[lab] ' + err.message + ' — falling back to the 2D relief renderer');
      return false;
    }
    uni.terrain = uniforms(progTerrain);
    uni.water = uniforms(progWater);
    uni.sky = uniforms(progSky);

    const skyVao = gl.createVertexArray();
    gl.bindVertexArray(skyVao);
    uni.skyVao = skyVao;

    uni.vao = gl.createVertexArray();
    gl.bindVertexArray(uni.vao);
    uni.meshBuf = gl.createBuffer();
    uni.idxBuf = gl.createBuffer();
    gl.bindVertexArray(null);

    dataTex = gl.createTexture();
    flowTex = gl.createTexture();
    return true;
  }

  let ok = false;
  try {
    ok = buildResources();
  } catch (err) {
    console.warn('[lab] renderer init failed: ' + err.message);
    ok = false;
  }
  if (!ok) return null;

  /* mesh at the requested subdivision */
  function buildMesh(res) {
    if (res === meshRes) return;
    meshRes = res;
    const verts = new Float32Array((res + 1) * (res + 1) * 2);
    let k = 0;
    for (let y = 0; y <= res; y++) {
      for (let x = 0; x <= res; x++) {
        verts[k++] = x / res;
        verts[k++] = y / res;
      }
    }
    const idx = new Uint32Array(res * res * 6);
    let p = 0;
    const row = res + 1;
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const a = y * row + x;
        /* winding chosen so the triangle normal points up (+Y) and the
           surface stays visible with back-face culling enabled */
        idx[p++] = a;
        idx[p++] = a + row;
        idx[p++] = a + 1;
        idx[p++] = a + 1;
        idx[p++] = a + row;
        idx[p++] = a + row + 1;
      }
    }
    idxCount = p;
    gl.bindVertexArray(uni.vao);
    const loc = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, uni.meshBuf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, uni.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    console.log(`[lab] terrain mesh rebuilt: ${res}\u00b2 quads, ${verts.length / 2} vertices`);
  }

  function ensureTextures(n) {
    if (n === texSize) return;
    texSize = n;
    dataBuf = new Float32Array(n * n * 4);
    flowBuf = new Float32Array(n * n * 4);
    shadowBuf = new Float32Array(n * n);
    gl.bindTexture(gl.TEXTURE_2D, dataTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, n, n, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, useFloatLinear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, useFloatLinear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, flowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, n, n, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /* -------- CPU sun shadow (horizon march toward the light) -------- */
  function computeShadows(sim, azimuthDeg, elevationDeg, steps) {
    const n = sim.n;
    const h = sim.h;
    const out = shadowBuf;
    if (!(steps > 0)) {
      out.fill(1);
      return;
    }
    const el = (clampF(elevationDeg, 3, 88) * Math.PI) / 180;
    const az = (azimuthDeg * Math.PI) / 180;
    // direction toward the light, in grid space (x right, y down-grid)
    const dx = Math.sin(az) * Math.cos(el);
    const dy = Math.cos(az) * Math.cos(el);
    const tanEl = Math.tan(el);
    const stride = Math.max(1, Math.round(1 / Math.max(0.35, Math.hypot(dx, dy))));
    const sx = Math.round(dx / Math.max(1e-4, Math.hypot(dx, dy)) * stride);
    const sy = Math.round(dy / Math.max(1e-4, Math.hypot(dx, dy)) * stride);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const h0 = h[i];
        let shade = 1;
        for (let k = 1; k <= steps; k++) {
          const px = x + sx * k;
          const py = y + sy * k;
          if (px < 0 || py < 0 || px >= n || py >= n) break;
          const idx = py * n + px;
          const hs = h[idx];
          if (hs > h0 + k * stride * tanEl * 1.02) {
            const block = (hs - h0 - k * stride * tanEl) / Math.max(1e-4, h0 + k * stride * tanEl);
            const soft = 1 - clampF(1 - block * 6 - k * 0.02, 0, 1) * 0.9;
            if (soft < shade) shade = 0.12 + 0.88 * clampF(soft, 0, 1);
            break;
          }
        }
        out[i] = shade;
      }
    }
  }

  /* -------- stream the fields -------- */
  function uploadFields(sim) {
    const n = sim.n;
    const N = n * n;
    const d = dataBuf;
    const f = flowBuf;
    const h = sim.h;
    const w = sim.w;
    const s = sim.sed;
    const sh = shadowBuf;
    const fx = sim.fx;
    const fy = sim.fy;
    const dl = sim.delta;
    const sp = sim.spd;
    for (let i = 0, q = 0; i < N; i++, q += 4) {
      d[q] = h[i];
      d[q + 1] = w[i];
      d[q + 2] = s[i];
      d[q + 3] = sh[i];
      f[q] = fx[i];
      f[q + 1] = fy[i];
      f[q + 2] = dl[i];
      f[q + 3] = sp[i];
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dataTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, n, gl.RGBA, gl.FLOAT, d);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, flowTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, n, gl.RGBA, gl.FLOAT, f);
  }

  /* -------- frame -------- */
  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  let lastMode = -1;

  function render(sim, cam, settings) {
    const n = sim.n;
    const targetRes = Math.min(384, Math.max(64, Math.round(n * (settings.subdivision || 2))));
    buildMesh(targetRes);
    ensureTextures(n);
    computeShadows(sim, settings.sunAzimuth, settings.sunElevation, settings.shadowSteps);
    uploadFields(sim);

    const W = canvas.width;
    const H = canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.5, 0.55, 0.62, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = W / Math.max(1, H);
    mat4Perspective(proj, (settings.fov || 50) * Math.PI / 180, aspect, 0.01, 30);
    const eye = cam.eye;
    mat4LookAt(view, eye[0], eye[1], eye[2], cam.target[0], cam.target[1], cam.target[2]);
    const cell = 1 / n;
    const time = performance.now() * 0.001;
    const sunLen = 1;
    const el = (clampF(settings.sunElevation, 3, 88) * Math.PI) / 180;
    const az = (settings.sunAzimuth * Math.PI) / 180;
    const sun = [Math.sin(az) * Math.cos(el) * sunLen, Math.sin(el) * sunLen, Math.cos(az) * Math.cos(el) * sunLen];

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(progSky);
    gl.bindVertexArray(uni.skyVao);
    const tanH = Math.tan((settings.fov || 50) * Math.PI / 180 / 2);
    gl.uniform3fv(uni.sky.uRight, cam.basis.right);
    gl.uniform3fv(uni.sky.uUp, cam.basis.up);
    gl.uniform3fv(uni.sky.uFwd, cam.basis.fwd);
    gl.uniform2f(uni.sky.uTan, tanH * aspect, tanH);
    gl.uniform3fv(uni.sky.uSun, sun);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    /* Culling stays off on purpose: the heightfield is a one-sided sheet, and
       with culling on the camera can see straight through steep slopes. */
    gl.disable(gl.CULL_FACE);

    gl.useProgram(progTerrain);
    gl.bindVertexArray(uni.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dataTex);
    gl.uniform1i(uni.terrain.uData, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, flowTex);
    gl.uniform1i(uni.terrain.uFlow, 1);
    gl.uniform2f(uni.terrain.uTexel, 1 / n, 1 / n);
    gl.uniform1i(uni.terrain.uMode, settings.modeIndex | 0);
    gl.uniform1f(uni.terrain.uCell, cell);
    gl.uniform1f(uni.terrain.uExag, settings.exaggeration);
    gl.uniform1f(uni.terrain.uWaterPass, 0);
    gl.uniformMatrix4fv(uni.terrain.uProj, false, proj);
    gl.uniformMatrix4fv(uni.terrain.uView, false, view);
    gl.uniform3fv(uni.terrain.uSun, sun);
    gl.uniform3fv(uni.terrain.uCamPos, eye);
    gl.uniform1f(uni.terrain.uFog, cam.distance * 1.4);
    gl.uniform1f(uni.terrain.uTime, time);
    gl.uniform1f(uni.terrain.uContours, settings.contours ? 1 : 0);
    gl.uniform1f(uni.terrain.uGrid, settings.grid ? 1 : 0);
    if (settings.marker && settings.markerOn) gl.uniform2f(uni.terrain.uMarker, settings.marker[0], settings.marker[1]);
    gl.uniform1f(uni.terrain.uMarkerOn, settings.markerOn ? 1 : 0);
    gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_INT, 0);

    if (settings.waterOpacity > 0.01) {
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(progWater);
      gl.bindVertexArray(uni.vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dataTex);
      gl.uniform1i(uni.water.uData, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, flowTex);
      gl.uniform2f(uni.water.uTexel, 1 / n, 1 / n);
      gl.uniform1f(uni.water.uWaterPass, 1);
      gl.uniform1f(uni.water.uCell, cell);
      gl.uniform1f(uni.water.uExag, settings.exaggeration);
      gl.uniform1f(uni.water.uTime, time);
      gl.uniform3fv(uni.water.uSun, sun);
      gl.uniform3fv(uni.water.uCamPos, eye);
      gl.uniform1f(uni.water.uFog, cam.distance * 1.4);
      gl.uniform1f(uni.water.uOpacity, settings.waterOpacity);
      gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_INT, 0);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
    gl.bindVertexArray(null);
    const err = gl.getError();
    if (err !== 0) return 'gl error 0x' + err.toString(16);
    return null;
  }

  /* heightfield ray cast used by the pointer probe */
  function pick(sim, origin, dir, maxDist) {
    const n = sim.n;
    const exag = pick.exag || 1;
    let t = 0;
    const step = 0.0025;
    let px = origin[0] + dir[0] * 0.001;
    let py = origin[1] + dir[1] * 0.001;
    let pz = origin[2] + dir[2] * 0.001;
    for (let k = 0; k < 4000; k++) {
      t += step;
      px += dir[0] * step;
      py += dir[1] * step;
      pz += dir[2] * step;
      if (t > maxDist) return null;
      if (px < -0.02 || pz < -0.02 || px > 1.02 || pz > 1.02) continue;
      const gx = Math.round(px * (n - 1));
      const gy = Math.round(pz * (n - 1));
      if (gx < 0 || gy < 0 || gx >= n || gy >= n) continue;
      const i = gy * n + gx;
      const surf = sim.h[i] + Math.min(sim.w[i], 0.25) * 0.85;
      if (py <= surf * exag && py > surf * exag - 0.06) return { x: gx, y: gy, u: gx / (n - 1), v: gy / (n - 1), dist: t };
    }
    return null;
  }
  pick.exag = 1;

  function screenRay(cam, w, h, ndcX, ndcY) {
    const aspect = w / Math.max(1, h);
    const tan = Math.tan(((cam.fov || 50) * Math.PI) / 180 / 2);
    const eye = cam.eye;
    /* The app keeps one authoritative camera frame (world-space right / up /
       forward). Use it so picking, the sky dome and the view matrix agree. */
    let f = cam.basis && cam.basis.fwd;
    let r = cam.basis && cam.basis.right;
    let u = cam.basis && cam.basis.up;
    if (!f || !r || !u) {
      const t = cam.target;
      let fx = t[0] - eye[0];
      let fy = t[1] - eye[1];
      let fz = t[2] - eye[2];
      const fl = Math.hypot(fx, fy, fz) || 1;
      fx /= fl;
      fy /= fl;
      fz /= fl;
      r = [-fz, 0, fx];
      const rl = Math.hypot(r[0], r[2]) || 1;
      r = [r[0] / rl, 0, r[2] / rl];
      u = [r[1] * fz - r[2] * fy, r[2] * fx - r[0] * fz, r[0] * fy - r[1] * fx];
      f = [fx, fy, fz];
    }
    const dx = f[0] + r[0] * ndcX * tan * aspect + u[0] * ndcY * tan;
    const dy = f[1] + r[1] * ndcX * tan * aspect + u[1] * ndcY * tan;
    const dz = f[2] + r[2] * ndcX * tan * aspect + u[2] * ndcY * tan;
    const dl = Math.hypot(dx, dy, dz) || 1;
    return { origin: eye.slice(), dir: [dx / dl, dy / dl, dz / dl] };
  }

  /* framebuffer readback for the screenshot export (called right after a draw) */
  let shotBuf = null;
  function capture() {
    const W = canvas.width;
    const H = canvas.height;
    if (!shotBuf || shotBuf.length !== W * H * 4) shotBuf = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, shotBuf);
    return { w: W, h: H, data: shotBuf, bottomUp: true };
  }

  return {
    info,
    backend: 'gl',
    gl,
    render,
    pick,
    capture,
    screenRay,
    setExag(v) {
      pick.exag = v;
    },
    lostContext() {
      return gl.isContextLost();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Canvas2D fallback: shaded relief map (no 3D, but fully readable)  */
/* ------------------------------------------------------------------ */

function create2DRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  console.warn('[lab] WebGL2 unavailable \u2014 using the 2D shaded-relief fallback');
  const info = { name: 'Canvas2D relief (degraded)', backend: '2d' };
  let off = null;
  let offCtx = null;
  let imgData = null;
  let res = 0;
  let buf = null;

  function render(sim, cam, settings) {
    const W = canvas.width;
    const H = canvas.height;
    const res = Math.min(256, Math.max(64, sim.n));
    if (!off || off.width !== res) {
      off = document.createElement('canvas');
      off.width = res;
      off.height = res;
      offCtx = off.getContext('2d');
      imgData = offCtx.createImageData(res, res);
      buf = new Float32Array(res * res);
    }
    const n = sim.n;
    const data = imgData.data;
    const exag = settings.exaggeration;
    // hillshade from the resampled heightfield
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const sx = Math.min(n - 1, Math.round((x / (res - 1)) * (n - 1)));
        const sy = Math.min(n - 1, Math.round((y / (res - 1)) * (n - 1)));
        buf[y * res + x] = sim.h[sy * n + sx] + Math.min(sim.w[sy * n + sx], 0.2) * 0.8;
      }
    }
    const el = (clampF(settings.sunElevation, 3, 88) * Math.PI) / 180;
    const az = (settings.sunAzimuth * Math.PI) / 180;
    const lx = -Math.sin(az) * Math.cos(el);
    const ly = -Math.cos(az) * Math.cos(el);
    const lz = Math.sin(el);
    const mode = settings.mode;
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const i = y * res + x;
        const si = Math.min(n - 1, Math.round((x / (res - 1)) * (n - 1))) + Math.min(n - 1, Math.round((y / (res - 1)) * (n - 1))) * n;
        const hL = buf[y * res + Math.max(0, x - 1)];
        const hR = buf[y * res + Math.min(res - 1, x + 1)];
        const hU = buf[Math.max(0, y - 1) * res + x];
        const hD = buf[Math.min(res - 1, y + 1) * res + x];
        const sc = 1 / n;
        let nx = (-(hR - hL) * exag) / (2 * sc);
        let ny = (-(hD - hU) * exag) / (2 * sc);
        let l = Math.hypot(nx, ny, 1);
        const shade = Math.max(0.05, (nx / l) * lx + (ny / l) * ly + (1 / l) * lz);
        let r;
        let g;
        let b;
        const hC = buf[i];
        const w = sim.w[si];
        const s = sim.sed[si];
        const dl = sim.delta[si];
        const e01 = clampF((hC + 0.05) / 0.45, 0, 1);
        if (mode === 'elevation') {
          r = 240 - e01 * 60;
          g = 210 - e01 * 30;
          b = 140 + e01 * 120;
        } else if (mode === 'water') {
          const t = clampF(w * 55, 0, 1);
          r = 240 - t * 230;
          g = 230 - t * 180;
          b = 200 + t * 60;
        } else if (mode === 'sediment') {
          const t = clampF(s * 140, 0, 1);
          r = 20 + t * 230;
          g = 60 + t * 120;
          b = 70 - t * 50;
        } else if (mode === 'delta') {
          const t = clampF(dl * 90, -1, 1);
          r = 90 + (t < 0 ? -t * 190 : 0);
          g = 95 + (t > 0 ? t * 130 : 0);
          b = 100;
        } else if (mode === 'slope') {
          const t = clampF(Math.atan(Math.hypot((hR - hL) / (2 * sc), (hD - hU) / (2 * sc)) / Math.max(0.01, exag)) / 0.44, 0, 1);
          r = 30 + t * 210;
          g = 90 + t * 120;
          b = 150 - t * 130;
        } else if (mode === 'flow') {
          const fx = sim.fx[si];
          const fy = sim.fy[si];
          const sp = Math.hypot(fx, fy);
          const ang = (Math.atan2(fy, fx) / (Math.PI * 2) + 0.5) * 6.2831;
          const t = clampF(sp * 26, 0, 1);
          r = 25 + t * (0.55 + 0.45 * Math.cos(ang)) * 200;
          g = 30 + t * (0.55 + 0.45 * Math.cos(ang + 4.1)) * 200;
          b = 35 + t * (0.55 + 0.45 * Math.cos(ang + 2.4)) * 200;
        } else {
          // 'shaded' (and any unknown mode) keeps a readable relief palette
          const t = e01;
          r = 52 + t * 168;
          g = 74 + t * 132;
          b = 58 + t * 120;
          if (w > 0.0004) {
            r = 44 + 60 * clampF(s * 90, 0, 1);
            g = 92 + 30 * clampF(s * 60, 0, 1);
            b = 150 - 30 * clampF(w * 20, 0, 1);
          }
        }
        const k = i * 4;
        const m = 0.35 + 0.75 * shade;
        data[k] = clampF(r * m, 0, 255);
        data[k + 1] = clampF(g * m, 0, 255);
        data[k + 2] = clampF(b * m, 0, 255);
        data[k + 3] = 255;
      }
    }
    offCtx.putImageData(imgData, 0, 0);
    ctx.fillStyle = '#5b6570';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, res, res, 0, 0, W, H);
    return null;
  }

  function pick(sim, cam, w, h, px, py) {
    const u = px / w;
    const v = py / h;
    const n = sim.n;
    return { x: Math.round(u * (n - 1)), y: Math.round(v * (n - 1)), u, v, dist: 1, flat2d: true };
  }

  return {
    info,
    backend: '2d',
    render,
    pick,
    capture() {
      const buf = new Uint8Array(canvas.width * canvas.height * 4);
      buf.set(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
      return { w: canvas.width, h: canvas.height, data: buf, bottomUp: false };
    },
    screenRay: null,
    setExag() {},
    lostContext() {
      return false;
    },
  };
}

LAB.createRenderer = function (canvas, force2d) {
  if (!force2d) {
    let r = null;
    try {
      r = createGLRenderer(canvas, {});
    } catch (err) {
      console.warn('[lab] WebGL2 renderer threw: ' + err.message);
      r = null;
    }
    if (r) return r;
  }
  const r2 = create2DRenderer(canvas);
  if (r2) return r2;
  return null;
};

LAB.MODES = MODES;
LAB._mat = { mat4Perspective, mat4LookAt };
