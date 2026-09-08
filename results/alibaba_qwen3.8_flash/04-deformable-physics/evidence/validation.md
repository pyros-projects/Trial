# Validation record — Soft-Body, Cloth & Constraint Playground

Deliverable: `index.html` (single file, 123 KB, no build step, no network assets).
Validated on 2026-09-08 with agent-browser 0.31.1 (headless Chromium over CDP),
Node v25.8.1, Linux. Viewports: 1280×800 and 390×844.

Two independent layers of evidence:

1. **`dev/test-physics.mjs`** — 53 scripted checks that exercise the shipped
   solver out of `index.html` itself (the core is extracted from the delivered
   file, so the tests run against what users load, not against a dev copy).
2. **Real browser runs** — actual `Input.dispatchMouseEvent` pointer gestures
   and real key events against the page, plus screenshots and DOM/state probes.

---

## 1. Static containment checks

```
grep -oE "(https?:)?//[a-z.]+|src=|href=|fetch\(|import |@import|url\(" index.html
→ one hit only: the word "export/import" inside a comment.
<script> tags: 1, no src.  <link>: 0.  <img>: 0.  url(): 0.
```

* Nothing is fetched at runtime. Verified twice: `file://` load and HTTP load
  (see §4). All fonts are system stacks, all icons are text/CSS.
* Whole bundle parses as one script (`node --check` on the extracted body: OK).

## 2. Solver test suite — 53/53 pass (`node dev/test-physics.mjs index.html`)

Groups: distance-constraint convergence & substep-compensated stiffness;
polygon-area gradient verified against central differences at **all 28
components of an irregular polygon**; pressure/area response; draping,
containment and no-tunnelling through static boxes, circles and capsules;
inter-object collision and both collision switches; tearing and the
`cutSegment` primitive; the seven tool primitives; a kinematic collider
transferring momentum; performance and diagnostic accuracy; and a 5-second
run of each of the 10 shipped scenarios (bounded, nothing escapes the world
box, no divergence, and — added late, see bug #8 — **no link stretched beyond
120 % of rest length**, which is what catches bodies being pulled to ribbons).

### Real bugs this suite caught (all fixed, each with a regression check)

| # | Bug | Symptom before fix | Fix |
|---|-----|--------------------|-----|
| 1 | Restitution sign inverted at shape/wall contacts | velocity amplified every frame, peak speed reached 2.6e81 | sign corrected; peak speed now ≤ ~300 u/s in the same scene |
| 2 | Contact journal `W.cc` reset once per *frame*, not per *substep* | friction/restitution applied against stale normals from the previous substep; journal overflowed | journal cleared per substep |
| 3 | **Polygon-area gradient was wrong** (`e_prev`/`e_next` rotate-90 form) and its unit test was self-fulfilling (same expression on both sides, at a vertex where the two coincide) | pressure pushed roughly *tangentially*: shells never re-inflated and every scene slowly accumulated energy (mean speed 400–985 u/s, "Soft Body Stack" grew instead of settling) | exact `dA/dx = 0.5(y_{i+1}-y_{i-1})` gradient; test rewritten to check 28 components on an irregular shape + a direction test |
| 4 | Collision skin was a fixed 3–4.5 u, i.e. **smaller than the particle spacing (15–26 u)** | bodies slid through each other through the "weave": a heavy puck fell straight through a 4-row cloth sheet with contacts registered but nothing stopped; a rope passed between cloth nodes | contact radius now derived from each body's spacing (0.4–0.5 × spacing), skin factor 1.25 for inter-body pairs, grid cell size and correction clamp derived from it. Same puck test now: caught at y≈396 with collisions on, falls to y=953 with them off |
| 5 | `addShape` left `angle` undefined → `NaN` for any rotating collider | the spinning paddle silently had **zero** contacts for the whole run (cloth fell through it) | `angle` initialised; static vs spinning paddle now measurably different (§5) |
| 6 | `pairsTested` conflated constraint solves with collision candidates | the "broad phase culls" diagnostic was meaningless | split into `consTested` / `pairsTested` |
| 7 | Area/pressure correction was too aggressive (6 u per iteration clamp, 25 % inflation target) and the Stack scene placed jelly slabs **inside** the sliding plate's path | shells smeared into long translucent wedges; the Stack peaked at 358 % link strain in the browser while the headless test still "passed" (it only bounded mean speed) | clamp cut to 2.5 u, inflation target to 12 %, slabs moved clear of the plate and its speed halved; the scenario sweep now asserts peak link strain < 120 %, and the Stack sits at 77 % |
| 8 | `stat.maxErr` was in world units but the HUD multiplied it by 100 and printed "%" | "max constraint error 3772.91 %" | reports `21.0 u` |

After all fixes: 43 → 53 checks pass; every scenario settles instead of
accumulating energy; the 1563-particle benchmark scene solves in 2.26 ms/frame.

## 3. Interaction with real input (not page loads)

Method note: pointer→world mapping is *not* identity (view scale ≈ 0.68, plus
an offset), so each gesture was aimed by asking the page where a screen point
lands (`SOFTPLAY.screenToWorld`) or by grid-searching for the screen point over
a target. One early "grab does nothing" report was exactly this mistake — the
first drag had picked a *pinned* particle; with the aim corrected, grab works.

| Gesture (real events) | Result |
|---|---|
| key `2` → Pin tool, real click on cloth | pins 11 → 13 |
| second real click on the same spot | pins 13 → 11 (unpin) |
| key `3` → Cut tool, real 7-step drag across cloth | constraints 1959 → 1915 (44 links severed by one drag) |
| real 5-step grab drag over the sheet (tool `1`) | 12 particles held; tracked particle moved (247.8,254) → (364.4,265) toward the cursor; state probe mid-drag showed `W.grab = {n:12, tx,ty}` tracking the pointer |
| key `4` → Impulse, real drag | total kinetic energy +14 % (sum of speeds 52 810 → 60 432) |
| key `5` → Wind gust, real drag | gust created during drag, cleared on release |
| key `6` → Spawn, real drag (140,350)→(285,470) | new body created: particles 477 → 587, constraints 1786 → 2343, bodies 12 → 13 |
| key `7` → Erase, real click inside a body | whole body removed: particles 587 → 307, bodies 13 → 12 |
| Space / `N` / `V` / `R` | pause and resume, single step, viz mode cycles render→particles→constraints→…, reset |
| real drag on the Gravity slider | 900 → 0 g; overlay label updated; mean speed rose 32 → 55 (scene responds) |
| uncheck *Self-collision*, then *Object↔object* | candidate pairs 1170 → 976 → **0**, contacts 215 → 208 → **0** (machinery genuinely bypassed, not just hidden) |
| scenario `<select>` → Cloth Drape / Balloon Chamber | 1141 particles / 1143 contacts, and 317 particles / maxErr 4.4; both ran clean |

## 4. Loads, viewports, performance

* `file://` load: **1 network request** (the document), 0 console messages,
  0 page errors.
* `http://127.0.0.1:8731/index.html` (temporary local server, since stopped):
  2 requests — the document and Chromium's automatic `/favicon.ico` probe
  (404, not referenced by the file). Same behaviour: 60 fps, 477 particles,
  0 page errors.
* 1280×800: 60 fps with 349–1141 particles; solver 0.4–2.2 ms, draw 0.3–0.5 ms.
* 390×844: no horizontal overflow (`scrollWidth == innerWidth`), no errors,
  canvas 390×648, panel stacks below the stage. Because the 1600×1000 world is
  *fitted* rather than cropped, a portrait window letterboxes it — the whole
  world stays visible but a large part of the canvas is empty (known limit K2).

## 5. Behaviour checks that changed my mind

* **Kinematic paddle.** Comparing mean activity over 7 s with the same paddle
  static vs spinning at 2.2 rad/s: 52 vs 225 mean u/s, and the cloth never
  settles over the spinning one. This only became possible after bug #5.
* **Crush resistance.** The original test assumed high pressure resists a
  crush better than low pressure. Measured: at 2 %/frame sustained squeeze both
  hold their area (101 % vs 125 % of rest). The area constraint holds shape at
  *any* pressure; the Pressure knob sets how far **above** rest area the shell
  wants to sit. The test now asserts that, not the assumption.
* **Thin rope vs cloth.** With collisions on, no rope node ever ends up buried
  in the cloth (0 vs 27 with collisions off), but a 1-D rope can still thread
  between cloth nodes and come out the other side. Documented as K3.

## 6. Known limits (unfixed, honestly stated)

* **K1 — free-hanging cloth.** A sheet pinned only along its top edge and
  released in flight unravels into a long snaking ribbon, which reads as a
  smear in the translucent fill view. Shortening the sheet and holding it
  along its top edge (the shipped default now) removes the worst of it, but
  cloth is still most legible where geometry supports it: *Cloth Drape* and
  *Hanging Flag* are the two scenarios to judge cloth by.
* **K2 — portrait letterboxing** (see §4). Fitting rather than cropping was a
  deliberate choice; a narrow window pays for it with empty canvas.
* **K3 — thin bodies vs thin bodies.** Rope-on-cloth contact is correct but
  not impenetrable at high relative speed.
* **K4 — 2-D self-collision is a fold heuristic.** Neighbour skips are
  topological (±2 in each grid direction), so very tight folds can still
  interpenetrate locally.
* **K5 — `W.t`** (sim clock) reads high after long runs / unpausing; it is a
  display value only, nothing in the solver depends on it.
* **K6 — the pressure knob sets an inflation target, not a force.** Measured
  under a sustained 2 %/frame crush: low and high pressure both hold their
  area (101 % vs 112 % of rest). Shape retention comes from the area
  constraint being stiff at any setting; Pressure chooses how far *above*
  rest area a shell wants to sit. My first version of that test assumed a
  force-like response and was rewritten once measurement contradicted it.
* The `evidence/*.png` shots at 2 s and 10 s show the *same* scene at
  different moments; the mid-run shots of the default scene are the ones
  affected by K1.

## 7. How to reproduce

```bash
node dev/build.mjs                     # assembles index.html from dev/js/*
node dev/test-physics.mjs index.html    # the 53 checks above
# browser pass (agent-browser): open the file, drive real pointer/key input,
# screenshots land in evidence/
```

`window.SOFTPLAY` is exposed (`stats`, `drag`, `spawn`, `setTool/setMode/
setScenario/setSetting`, `screenToWorld`, `errors`) purely so that a harness
can verify state after real input; it is ~40 lines and nothing depends on it.
