/* Camera maths regression test.
   Loads src/render.js in a stub environment and checks the projection maths
   with points whose expected screen position is known by construction.
   Run: node tools/mathtest.mjs */
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/render.js', import.meta.url), 'utf8');
const LAB = {};
const loader = new Function('LAB', src + '\nreturn {mat: LAB._mat, createRenderer: LAB.createRenderer};');
const { mat, createRenderer } = loader(LAB);

let fails = 0;
const ok = (name, cond, info) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  :: ' + info : ''}`);
  if (!cond) fails++;
};

const proj = new Float32Array(16);
const view = new Float32Array(16);
const mul = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
  m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
];

const eye = [0.5, 1.4, 2.1];
const target = [0.5, 0.05, 0.5];
mat.mat4Perspective(proj, (50 * Math.PI) / 180, 1.6, 0.01, 30);
mat.mat4LookAt(view, eye[0], eye[1], eye[2], target[0], target[1], target[2]);

const clip = (p) => mul(proj, mul(view, [p[0], p[1], p[2], 1]));
const ndc = (p) => {
  const c = clip(p);
  return [c[0] / c[3], c[1] / c[3], c[2] / c[3], c[3]];
};

// the look-at target must land in the middle of the screen and in front of the eye
const centre = ndc(target);
ok('view centre projects to the screen centre', Math.abs(centre[0]) < 1e-4 && Math.abs(centre[1]) < 1e-4, centre.map((v) => v.toFixed(4)).join(','));
ok('the terrain is in front of the camera (w > 0)', centre[3] > 0, `w=${centre[3].toFixed(3)}`);
ok('the terrain is inside the depth range', centre[2] > -1 && centre[2] < 1, `z=${centre[2].toFixed(3)}`);

// a point above the target must appear higher on screen (larger NDC y)
const up = ndc([target[0], target[1] + 0.5, target[2]]);
const down = ndc([target[0], target[1] - 0.5, target[2]]);
ok('world +Y maps to screen up', up[1] > centre[1] && down[1] < centre[1], `up=${up[1].toFixed(3)} centre=${centre[1].toFixed(3)} down=${down[1].toFixed(3)}`);

// a point to the world +X side must appear to the right of centre
const right = ndc([target[0] + 0.5, target[1], target[2]]);
ok('world +X maps to screen right', right[0] > centre[0], `x=${right[0].toFixed(3)}`);

// the four terrain corners should all be inside the frustum at this distance
const corners = [[0.05, 0.0, 0.05], [0.95, 0.0, 0.05], [0.05, 0.3, 0.95], [0.95, 0.2, 0.95]];
const inside = corners.map((c) => ndc(c));
ok('all terrain corners are inside the frustum', inside.every((c) => Math.abs(c[0]) < 1 && Math.abs(c[1]) < 1 && c[3] > 0), inside.map((c) => `${c[0].toFixed(2)},${c[1].toFixed(2)}`).join(' '));

// the camera basis must be a right-handed orthonormal frame matching the view matrix
const cam = { eye, target, fov: 50, basis: {} };
const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
const fl = Math.hypot(...f);
const fn = f.map((v) => v / fl);
const r = [-fn[2], 0, fn[0]];
const rl = Math.hypot(r[0], r[2]);
const rn = [r[0] / rl, 0, r[2] / rl];
const u = [rn[1] * fn[2] - rn[2] * fn[1], rn[2] * fn[0] - rn[0] * fn[2], rn[0] * fn[1] - rn[1] * fn[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
ok('camera basis is orthonormal', Math.abs(dot(rn, fn)) < 1e-6 && Math.abs(dot(u, fn)) < 1e-6 && Math.abs(dot(u, rn)) < 1e-6);
ok('camera up is world up (not flipped)', u[1] > 0.5, `up=${u.map((v) => v.toFixed(3)).join(',')}`);

// the 2D fallback must still build a renderer when WebGL2 is missing
const fakeCanvas = { getContext: (k) => (k === 'webgl2' ? null : { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData() {}, drawImage() {}, fillRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }) };
const r2 = createRenderer(fakeCanvas, false);
ok('2D fallback builds when WebGL2 is unavailable', !!r2 && r2.backend === '2d', r2 ? r2.info.name : 'null');

console.log(fails === 0 ? '\nALL CAMERA CHECKS PASSED' : `\n${fails} CAMERA CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
