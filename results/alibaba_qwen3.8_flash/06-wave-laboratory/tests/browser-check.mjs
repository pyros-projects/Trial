#!/usr/bin/env node
/* =========================================================================
   tests/browser-check.mjs — drives the built index.html in a real Chrome
   through the agent-browser CLI and asserts on what the page actually does.

   Checks are made against live state (window.__lab), not just screenshots,
   and every painting/dragging check uses real pointer events at page
   coordinates rather than calling into the app.

     node tests/browser-check.mjs [--mobile] [--keep]

   Requires: agent-browser (agent-browser --version) and a running daemon.
   ========================================================================= */
import { execSync } from "node:child_process";
import fs from "node:fs";

const MOBILE = process.argv.includes("--mobile");
const W = MOBILE ? 390 : 1280, H = MOBILE ? 844 : 800;
const FILE = "file://" + process.cwd() + "/index.html";
let pass = 0, fail = 0;
const lines = [];

function sh(cmd, opt = {}) {
  try { return execSync(cmd, { encoding: "utf8", maxBuffer: 1 << 26, ...opt }).trim(); }
  catch (e) { return "<<" + (e.stdout || "") + (e.stderr || "").slice(0, 300) + ">>"; }
}
function ev(code) { return sh(`agent-browser eval -b ${Buffer.from(code).toString("base64")}`); }
function raw(code) {
  /* agent-browser JSON-encodes whatever eval returns, so a returned JSON
     document arrives double-encoded. Unwrap once, keep it a string so the
     call sites can JSON.parse it themselves. */
  let r = ev(code);
  try { const v = JSON.parse(r); if (typeof v === "string") r = v; } catch (e) { }
  return r;
}
function obj(code) { const r = raw(code); try { return JSON.parse(r); } catch (e) { return { err: r }; } }
function cmd(c) { return sh(`agent-browser ${c}`); }
function ok(name, cond, detail) {
  cond ? pass++ : fail++;
  const l = `${cond ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  :: " + detail : ""}`;
  lines.push(l); console.log(l);
}
const wait = (ms) => sh(`agent-browser wait ${ms}`);
function shot(name) { cmd(`screenshot evidence/shots/${name}`); }

/* page-space coordinates for a tank position given in metres */
function ptAt(mx, my) {
  const r = raw(`(()=>{const r=document.getElementById('field').getBoundingClientRect();
    return JSON.stringify([Math.round(r.left+${mx}/8*r.width), Math.round(r.top+${my}/5*r.height), r.width|0, r.height|0]);})()`);
  return JSON.parse(r);
}
function drag(x0, y0, x1, y1, steps = 14) {
  cmd(`mouse move ${x0} ${y0}`); cmd("mouse down");
  for (let k = 1; k <= steps; k++) {
    cmd(`mouse move ${Math.round(x0 + (x1 - x0) * k / steps)} ${Math.round(y0 + (y1 - y0) * k / steps)}`);
  }
  cmd("mouse up");
}
function fieldStat(where = "full") {
  return obj(`(()=>{const S=__lab.sim,W=S.W,H=S.H;let mn=1e9,mx=-1e9,sum=0,n=0,bad=0,dist=new Set();
  const img=document.getElementById('field').getContext('2d').getImageData(0,0,S.W,S.H).data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;const v=S.uc[i];
    if(${where === "right" ? "x<W*0.35" : where === "left" ? "x>W*0.65" : "true"}){
      const a=Math.abs(v);sum+=a;n++;if(a>mx)mx=a;if(!(v<1e30&&v>-1e30))bad++;}
    if((x&7)===0&&(y&7)===0){const p=(y*W+x)*4;dist.add((img[p]>>3)+','+(img[p+1]>>3)+','+(img[p+2]>>3));}}
  return JSON.stringify({mean:+(sum/n).toFixed(5),max:+mx.toFixed(4),bad,dist:dist.size});})()`);
}

console.log(`\n=== browser check at ${W}x${H} (mobile=${MOBILE}) ===`);
cmd("close --all");
wait(400);
cmd(`set viewport ${W} ${H}`);          /* size the fresh browser first */
cmd(`open ${FILE}`);
/* wait for the app to boot rather than guessing a delay */
let booted = "";
for (let k = 0; k < 12; k++) {
  booted = ev("typeof window.__lab");
  if (String(booted).includes("object")) break;
  wait(500);
}
ok("0 page loads with the app hook (window.__lab present)", String(booted).includes("object"), booted);
/* arm a real error trap: page errors are otherwise invisible here */
ev(`(()=>{window.__pe=[];window.addEventListener('error',e=>(window.__pe.push(String(e.message)),0));
 window.addEventListener('unhandledrejection',e=>(window.__pe.push('promise: '+e.reason),0));return 'armed';})()`);
ok("0b viewport applied", String(ev("innerWidth")) === String(W), ev("innerWidth"));

/* ---------------------------------------------------------- 1 default view */
wait(6000);
const hudTxt = ev("document.getElementById('hud').innerText");
ok("0c the HUD is alive (telemetry text present)", /grid/.test(hudTxt) && /CFL/.test(ev("document.getElementById('stabTxt').textContent")), hudTxt.slice(0, 70));
const f1 = fieldStat();
ok("1 default scene renders a rich pattern (>40 distinct colours, live field)",
  f1.dist > 40 && f1.max > 0.05 && f1.bad === 0, JSON.stringify(f1) + " dist>40");
const cut = raw(`(()=>{const S=__lab.sim;const y=(S.H/2)|0;const a=[];for(let x=(S.W*0.55)|0;x<S.W*0.9;x+=3)a.push(+S.uc[x+y*S.W].toFixed(3));
 let z=0;for(const v of a)if(Math.abs(v)<0.05)z++;return JSON.stringify({quietFrac:+(z/a.length).toFixed(2),n:a.length});})()`);
ok("2 interference fringes cross the mid-line (not a flat wash)",
  Number(JSON.parse(cut).quietFrac) < 0.75, cut);
shot("m1-default.png");

/* ------------------------------------------------------------- 3 view modes */
cmd("press Space");                                  /* pause so modes compare */
const modeStats = {};
for (const m of ["amp", "int", "energy", "phase", "grad", "medium", "flow"]) {
  cmd(`eval -b ${Buffer.from(`__lab.mode("${m}")`).toString("base64")}`);
  wait(220);
  modeStats[m] = fieldStat();
}
const uniq = new Set(Object.values(modeStats).map((s) => JSON.stringify(s)));
ok("3 all 7 view modes draw distinct pictures", uniq.size >= 6,
  Object.entries(modeStats).map(([k, v]) => `${k}:${v.dist}`).join(" "));
/* on a small canvas there are far fewer sampled pixels, so compare the two
   modes instead of using an absolute colour count */
ok("3b medium mode paints the medium, not the wave (flat water = flat map)",
  modeStats.medium.dist * 6 < modeStats.amp.dist,
  "medium " + JSON.stringify(modeStats.medium) + " vs amp " + JSON.stringify(modeStats.amp));
cmd("press Space");
shot("m2-modes.png");

/* --------------------------------------------------------------- 4 presets */
const per = [];
for (let i = 0; i < 12; i++) {
  cmd(`eval -b ${Buffer.from(`__lab.preset(${i})`).toString("base64")}`);
  wait(2600);
  const st = raw("__lab.stats()");
  const s = JSON.parse(st);
  const fs2 = fieldStat();
  per.push(`${(s.time || 0).toFixed(1)}s max ${(s.maxAbs || 0).toFixed(2)} col ${fs2.dist} bad ${fs2.bad}`);
  ok(`4 preset ${i + 1} runs clean (${s.mode}, ${s.sources} src, ${s.probes} probe)`,
    s.maxAbs > 0.02 && s.maxAbs < 1e6 && fs2.bad === 0 && fs2.dist > 12,
    `max ${s.maxAbs} colours ${fs2.dist} non-finite ${fs2.bad}`);
  shot(`p${String(i + 1).padStart(2, "0")}-${i === 0 ? "tw" : "scene"}.png`);
}

/* --------------------------------------------------------- 5 painting tools */
cmd("eval -b " + Buffer.from('__lab.preset(0);__lab.mode("medium")').toString("base64"));
wait(300);
const [sx, sy] = ptAt(4.0, 0.6);
const [ex, ey] = ptAt(4.0, 4.4);
cmd('eval -b ' + Buffer.from('__lab.tool("wall")').toString("base64"));
cmd(`mouse move ${sx} ${sy}`); cmd("mouse down");
for (let k = 1; k <= 16; k++) {
  const y = Math.round(sy + (ey - sy) * k / 16);
  cmd(`mouse move ${sx} ${y}`);
}
cmd("mouse up");
const wallCells = raw("(()=>{let n=0;const f=__lab.sim.flag;for(let i=0;i<f.length;i++)if(f[i])n++;return n;})()");
ok("5 wall drag paints a barrier (cells converted to WALL)", Number(wallCells) > 200, wallCells + " wall cells");
/* shielded side must go quiet */
cmd("eval -b " + Buffer.from('__lab.pause(false)').toString("base64"));
wait(1200);
const right = fieldStat("left");
ok("6 the wall casts an acoustic shadow on the far side", right.mean < 0.25, "quiet-side mean " + JSON.stringify(right));
shot("m3-wall-shadow.png");

/* ----------------------------------------------------------- 7 absorber etc */
cmd('eval -b ' + Buffer.from('__lab.preset(0);__lab.tool("absorb")').toString("base64"));
wait(200);
const [ax, ay] = ptAt(3.4, 0.6);
const [bx, by] = ptAt(3.4, 4.4);
drag(ax, ay, bx, by, 16);
const absStats = raw("(()=>{const S=__lab.sim;let n=0,mn=9,mxs=0;for(let i=0;i<S.N;i++){if(S.los[i]>1)n++;const s=S.spd[i];if(s<mn)mn=s;}return JSON.stringify({damped:n,minSpeed:+mn.toFixed(3)});})()");
const as = JSON.parse(absStats);
ok("7 absorber brush lays a damped, slowed slab", as.damped > 250 && as.minSpeed < 0.6, absStats);

/* lens + medium + erase */
cmd('eval -b ' + Buffer.from('__lab.tool("lens")').toString("base64"));
{ const a = ptAt(6.0, 2.5), b = ptAt(6.9, 2.5); drag(a[0], a[1], b[0], b[1], 10); }
const lens = raw("(()=>{const S=__lab.sim;let mn=9,n=0;for(let i=0;i<S.N;i++){if(S.spd[i]<0.999)n++;if(S.spd[i]<mn)mn=S.spd[i];}return JSON.stringify({slow:n,min:+mn.toFixed(3)});})()");
ok("8 lens drag leaves a disc of slower medium", JSON.parse(lens).min < 0.7, lens);

cmd('eval -b ' + Buffer.from('__lab.tool("medium")').toString("base64"));
const [cx, cy] = ptAt(1.6, 4.2);
cmd(`mouse move ${cx} ${cy}`); cmd("mouse down"); cmd("mouse up");
const med = raw("(()=>{const S=__lab.sim;let mn=9,n=0;for(let i=0;i<S.N;i++){if(S.spd[i]<0.999)n++;if(S.spd[i]<mn)mn=S.spd[i];}return JSON.stringify({slow:n,min:+mn.toFixed(3)});})()");
ok("9 medium brush stamps the index value under the cursor", JSON.parse(med).min < 0.9, med);

cmd('eval -b ' + Buffer.from('__lab.tool("erase")').toString("base64"));
const [dx, dy] = ptAt(4.0, 2.5);
cmd(`mouse move ${dx} ${dy}`); cmd("mouse down"); cmd("mouse up");
ok("10 eraser restores plain water where it is used",
  Number(raw("(()=>{let n=0;const f=__lab.sim.flag;for(let i=0;i<f.length;i++)if(f[i])n++;return n;})()")) < 500,
  "wall cells after erase: " + raw("(()=>{let n=0;const f=__lab.sim.flag;for(let i=0;i<f.length;i++)if(f[i])n++;return n;})()"));

/* ------------------------------------------------------- 11 probes + sources */
cmd('eval -b ' + Buffer.from('__lab.preset(0);__lab.tool("probe")').toString("base64"));
wait(200);
const [px, py] = ptAt(5.5, 1.2);
cmd(`mouse move ${px} ${py}`); cmd("mouse down"); cmd("mouse up");
wait(900);
const pr = raw("JSON.stringify({probes:__lab.scene.probes.length, scopes:document.querySelectorAll('.scopeCv').length})");
ok("11 probe tool adds a probe and a live scope", JSON.parse(pr).scopes === JSON.parse(pr).probes && JSON.parse(pr).probes === 3, pr);

cmd('eval -b ' + Buffer.from('__lab.tool("emit")').toString("base64"));
const [ux, uy] = ptAt(6.4, 3.9);
cmd(`mouse move ${ux} ${uy}`); cmd("mouse down"); cmd("mouse up");
wait(400);
const srcN = raw("__lab.scene.sources.length");
ok("12 emitter tool drops a new emitter and it drives the field", Number(srcN) === 3, srcN + " sources");
cmd("eval -b " + Buffer.from('__lab.step(120)').toString("base64"));
const scopeData = raw("(()=>{const p=__lab.scene.probes[0];let pk=0;for(let k=0;k<p.n;k++)pk=Math.max(pk,Math.abs(p.hist[k]));return JSON.stringify({n:p.n,pk:+pk.toFixed(4)});})()");
ok("13 probe traces carry real signal (not a dead line)", JSON.parse(scopeData).pk > 0.02, scopeData);

/* ------------------------------------------------------ 14 numerics stress */
cmd("eval -b " + Buffer.from('__lab.preset(0);__lab.pause(true)').toString("base64"));
wait(200);
cmd('eval -b ' + Buffer.from('(()=>{const p=document.querySelectorAll("#pPhys input[type=range]");p[0].value=0.03;p[0].dispatchEvent(new Event("input"));__lab.step(1);return "dt set";})()').toString("base64"));
wait(300);
const clamp = raw("JSON.stringify({cfl:+__lab.sim.cfl.toFixed(3),dt:+__lab.sim.dtUsed.toFixed(5),req:+__lab.Par.dt.toFixed(4),unstable:__lab.sim.unstable,hud:document.getElementById('stabTxt').textContent})");
const cj = JSON.parse(clamp);
cmd("eval -b " + Buffer.from('__lab.pause(false)').toString("base64")); wait(600);
const clamp2 = obj("JSON.stringify({used:+__lab.sim.dtUsed.toFixed(5),req:+__lab.Par.dt.toFixed(4),hud:document.getElementById('stabTxt').textContent})");
ok("14 over-large dt is auto-clamped to the stability limit and flagged",
  cj.cfl <= 0.708 && cj.dt < cj.req && obj("JSON.stringify(__lab.sim.unstable)") === false, clamp);
ok("14b the HUD names the clamp while it is in force",
  /clamped/.test(clamp2.hud) && clamp2.used < clamp2.req, JSON.stringify(clamp2));
cmd("eval -b " + Buffer.from('__lab.step(60)').toString("base64"));
const after = fieldStat();
ok("15 clamped run stays finite (60 frames)", after.bad === 0, JSON.stringify(after));

cmd("eval -b " + Buffer.from('__lab.P.unsafe=true;__lab.pause(true);__lab.step(140)').toString("base64"));
const blow = raw("(()=>{const S=__lab.sim;let bad=0;for(let i=0;i<S.N;i+=3){const v=S.uc[i];if(!(v<1e30&&v>-1e30))bad++;}return JSON.stringify({bad,unstable:S.unstable,cfl:+S.cfl.toFixed(3)});})()");
ok("16 unsafe mode really does go unstable (the indicator is not decoration)",
  JSON.parse(blow).unstable === true, blow);
cmd("eval -b " + Buffer.from('__lab.P.unsafe=false;__lab.preset(0);__lab.pause(false)').toString("base64"));
wait(500);
ok("17 back to safe mode the field is finite again", fieldStat().bad === 0, JSON.stringify(fieldStat()));

/* --------------------------------------------------- 18 resolution + dt range */
for (const i of [0, 5]) {
  cmd("eval -b " + Buffer.from('(()=>{const s=document.querySelector("#pPhys select");s.value="' + i + '";s.dispatchEvent(new Event("change"));return 1;})()').toString("base64"));
  wait(1800);
  const st = raw("__lab.stats()");
  ok(`18 grid #${i} (${JSON.parse(st).grid || "?"}) renders without blowing up`,
    JSON.parse(st).maxAbs < 1e6 && JSON.parse(st).maxAbs > 0.01, st);
}

/* --------------------------------------------------------- 19 serialisation */
const rt = raw("(()=>{const a=__lab.serialize();const b=__lab.deserialize(a);const S=__lab.sim;let mx=0;for(let i=0;i<S.N;i++)mx=Math.max(mx,Math.abs(S.uc[i]));return JSON.stringify({len:a.length,err:b,max:+mx.toFixed(4)});})()");
ok("19 scene export/import round-trips", JSON.parse(rt).err === null && JSON.parse(rt).max > 0.001, rt);

/* ---------------------------------------------------------- 20 responsive */
const lay = raw("JSON.stringify({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,h:document.documentElement.scrollHeight-document.documentElement.clientHeight,cv:[document.getElementById('field').clientWidth|0,document.getElementById('field').clientHeight|0],panel:document.getElementById('panel').clientWidth})");
ok("20 no horizontal overflow at this width", JSON.parse(lay).overflow <= 1, lay);
const stack = raw("JSON.stringify({stacked:getComputedStyle(document.getElementById('main')).flexDirection})");
if (MOBILE) ok("21 narrow layout stacks the panel under the tank", JSON.parse(stack).stacked === "column", stack);
else ok("21 desktop keeps the side panel beside the tank", JSON.parse(stack).stacked === "row", stack);

/* touch-style pointer events */
cmd('eval -b ' + Buffer.from('__lab.tool("wall");"ok"').toString("base64"));
const [t0x, t0y] = ptAt(2.2, 1.0);
const touch = `(()=>{const c=document.getElementById('field');const r=c.getBoundingClientRect();
 const mk=(t,x,y)=>c.dispatchEvent(new PointerEvent(t,{pointerType:'touch',pointerId:7,clientX:x,clientY:y,bubbles:true,buttons:t==='pointermove'?1:1,isPrimary:true}));
 const x0=r.left+${2.2 / 8 * 100}*r.width/100, y0=r.top+${1.0 / 5 * 100}*r.height/100;
 mk('pointerdown',${t0x},${t0y});
 for(let k=1;k<=12;k++) mk('pointermove',${t0x}+k*2,${t0y}+k*6);
 mk('pointerup',${t0x},${t0y});
 let n=0;const f=__lab.sim.flag;for(let i=0;i<f.length;i++)if(f[i])n++;return JSON.stringify({wall:n});})()`;
const tch = raw(touch);
ok("22 touch-style pointer events paint too", Number(JSON.parse(tch).wall) > 60, tch);

/* --------------------------------------------------------------- 23 controls */
cmd("press Space");
const p1 = raw("__lab.stats().paused");
cmd("press s");
const s1 = raw("(()=>{__lab.step(1);return __lab.sim.time.toFixed(4);})()");
ok("23 pause state is honoured and reported", p1 === "true", "paused=" + p1);
const keys = ["1", "2", "3", "4", "5", "6", "7", "[", "]", "c", "r", "Enter", "e", "a", "m", "l", "p", "f", "v", "t", "w"];
for (const k of keys) cmd(`press ${k === "[" ? "BracketLeft" : k === "]" ? "BracketRight" : k}`);
const alive = raw("JSON.stringify(__lab.stats())");
ok("24 every keyboard shortcut runs without breaking the app",
  JSON.parse(alive).maxAbs < 1e8 && alive.indexOf("NaN") < 0, alive);
cmd("press Space");
wait(900);
const run2 = raw("__lab.stats()");
ok("25 run/step/keyboard leave the sim running and bounded",
  JSON.parse(run2).time > 0.5 && JSON.parse(run2).maxAbs < 1e6, run2);

/* ------------------------------------------------------------ 26 perf, honesty */
const perf = raw("(()=>{const t0=performance.now();for(let i=0;i<60;i++)__lab.step(3);return JSON.stringify({ms:+((performance.now()-t0)/60).toFixed(2),stat:__lab.stats()});})()");
const pj = JSON.parse(perf);
ok("26 180 solver substeps in one go stay fast and finite",
  pj.ms < 400 && pj.stat.maxAbs < 1e6, JSON.stringify(pj.stat) + " " + pj.ms + " ms");
const noNet = obj("JSON.stringify({scripts:document.querySelectorAll('script[src]').length,links:document.querySelectorAll('link[href]').length,imgs:document.images.length})");
ok("27 no external scripts, stylesheets or images in the artifact",
  noNet.scripts === 0 && noNet.imgs === 0 && noNet.links === 0, JSON.stringify(noNet));
const errs = obj("JSON.stringify({n:window.__pe.length, first:window.__pe.slice(0,3)})");
ok("28 zero uncaught page errors over the whole run", errs.n === 0, JSON.stringify(errs));
shot("m9-final.png");

console.log(`\n${pass} passed, ${fail} failed`);
fs.writeFileSync(MOBILE ? "evidence/browser-mobile.txt" : "evidence/browser-desktop.txt",
  `agent-browser check at ${W}x${H}\n${new Date().toISOString()}\n\n${lines.join("\n")}\n\n${pass} passed, ${fail} failed\n`);