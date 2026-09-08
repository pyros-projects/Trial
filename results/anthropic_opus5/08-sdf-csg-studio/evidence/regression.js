/* Compact regression harness for the Isosurface SDF/CSG studio.
   Run with:  agent-browser --session <s> eval --stdin < evidence/regression.js
   Exercises the field, CSG ops, picking, every view mode, JSON round-trip and
   the narrow-layout geometry, and asserts no NaN pixels and no page errors.   */
(function () {
  const R = [], ok = (n, c, d) => R.push({ check: n, pass: !!c, detail: d === undefined ? "" : String(d) });
  const gl = ISO.GL.gl, canv = gl.canvas;

  const frameHash = () => {
    ISO.frame();
    const p = ISO.pixels(0, 0, canv.width, canv.height);
    let h = 2166136261, nan = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i] === 255 && p[i + 1] === 0 && p[i + 2] === 255) nan++;
      h ^= p[i] + p[i + 1] * 3 + p[i + 2] * 7; h = Math.imul(h, 16777619) >>> 0;
    }
    return { h, nan };
  };

  ISO.applyPreset("bloom", true);
  ISO.state.render.resScale = 0.35;
  ISO.state.time.playing = false; ISO.state.time.t = 0;

  ok("shader compiled", ISO.GL.info.shaderStatus === "OK", ISO.GL.info.shaderStatus);
  ok("default scene loaded", ISO.state.objects.length === 8, ISO.state.objects.length + " objects");

  const base = frameHash();
  ok("baseline frame has no NaN pixels", base.nan === 0, base.nan + " magenta pixels");

  // --- CSG: add a primitive and cycle its operation
  const box = ISO.addObject("box");
  box.pos = [0.85, 1.35, 0.35]; box.params = [0.62, 0.62, 0.62, 0];
  ok("primitive added", ISO.state.objects.length === 9, ISO.state.objects.length);
  const hUnion = frameHash();
  box.op = "subtract";  const hSub = frameHash();
  box.op = "intersect"; const hInt = frameHash();
  box.op = "ssubtract"; const hSSub = frameHash();
  ok("subtraction changes the field", hSub.h !== hUnion.h, hUnion.h + " -> " + hSub.h);
  ok("intersection changes the field", hInt.h !== hSub.h && hInt.h !== hUnion.h, hInt.h);
  ok("smooth subtraction differs from hard", hSSub.h !== hSub.h, hSSub.h);
  ok("no NaN after CSG changes", hSub.nan + hInt.nan + hSSub.nan === 0);

  // --- ordering must matter: "Glow core" unioned after "Cutaway" is visible in the
  //     crater; moved above the cutaway it is carved away with the shell.
  ISO.selectObject(box.id); ISO.deleteSelected();
  ok("delete restores object count", ISO.state.objects.length === 8, ISO.state.objects.length);
  const gi = ISO.state.objects.findIndex(o => o.name === "Glow core");
  const ci = ISO.state.objects.findIndex(o => o.name === "Cutaway");
  const noSel = () => { ISO.state.selected = null; return frameHash(); };  // exclude the selection rim
  const before = noSel();
  ISO.moveObject(gi, ci);
  const after = noSel();
  ok("reordering changes the field", before.h !== after.h,
     "core below cut " + before.h + " -> core above cut " + after.h);
  ISO.moveObject(ci, gi);
  const restored = noSel();
  ok("reordering is reversible", restored.h === before.h, restored.h + " vs " + before.h);
  ok("stack order restored",
     ISO.state.objects.map(o => o.name).join(">") === "Ground>Body>Ring>Arm>Bud>Wave shell>Cutaway>Glow core",
     ISO.state.objects.map(o => o.name).join(">"));

  // --- picking: the surface under the cursor must resolve to a real object,
  //     and hiding that object must change what is picked there.
  const r = canv.getBoundingClientRect();
  const cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.52;
  const p1 = ISO.pickAt(cx, cy);
  ok("centre pixel hits geometry", p1.hit && p1.owner >= 0, JSON.stringify(p1));
  if (p1.hit) {
    const owner = ISO.state.objects[p1.owner];
    ok("pick owner is a real object", !!owner, owner && owner.name);
    owner.visible = false;
    const p2 = ISO.pickAt(cx, cy);
    ok("hiding the picked object changes the pick", p2.owner !== p1.owner || !p2.hit,
       (owner ? owner.name : "?") + " -> " + (p2.hit ? ISO.state.objects[p2.owner].name : "miss"));
    owner.visible = true;
  }
  const sky = ISO.pickAt(r.left + 12, r.top + 12);
  ok("empty sky reports a miss", !sky.hit, JSON.stringify(sky));

  // --- every visualization mode must render, be distinct and be NaN-free
  const seen = {}, dup = [];
  let nanTotal = 0;
  ISO.VIEWS.forEach(v => {
    ISO.setView(v.k);
    const f = frameHash();
    nanTotal += f.nan;
    if (seen[f.h] !== undefined) dup.push(seen[f.h] + "==" + v.k);
    seen[f.h] = v.k;
  });
  ISO.setView("final");
  ok("all " + ISO.VIEWS.length + " view modes render distinct output", dup.length === 0, dup.join(","));
  ok("no NaN pixels in any view mode", nanTotal === 0, nanTotal);

  // --- JSON round trip and deterministic identity
  const digest = s => s.match(/fnv1a=([0-9a-f]+)/)[1];
  const d0 = digest(ISO.deterministicScene());
  const json = ISO.serializeScene();
  ISO.applyPreset("manifold", true);
  ISO.applySceneData(JSON.parse(json), true);
  const d1 = digest(ISO.deterministicScene());
  ok("export/import round trip is identity-preserving", d0 === d1, d0 + " vs " + d1);
  ISO.state.time.t += 9.1;
  ok("animation phase excluded from scene identity", digest(ISO.deterministicScene()) === d1);

  // --- localStorage persistence
  let lsOK = false;
  try { localStorage.setItem("isosurface.scene.v3", json); lsOK = localStorage.getItem("isosurface.scene.v3").length === json.length; } catch (e) { }
  ok("scene persists to localStorage", lsOK);

  // --- layout geometry
  const vp = document.getElementById("viewport").getBoundingClientRect();
  ok("viewport has non-zero area", vp.width > 50 && vp.height > 50, vp.width + "x" + vp.height);
  ok("canvas backing store matches dpr x render scale",
     Math.abs(canv.width - Math.round(vp.width * Math.min(devicePixelRatio, 2) * ISO.state.render.resScale)) <= 2,
     canv.width + " for css " + Math.round(vp.width));

  ok("no uncaught page errors", ISO.stats().errors === 0, ISO.stats().errors);

  ISO.state.render.resScale = 1;
  const failed = R.filter(x => !x.pass);
  return JSON.stringify({ total: R.length, failed: failed.length, results: R }, null, 1);
})()
