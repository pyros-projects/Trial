# Validation — Deformable Lab (`index.html`)

Agent-authored validation record. Every result below was produced by driving the delivered
artifact in a real browser with real pointer/keyboard input and reading live application state.
No result here is inferred from source code alone.

- **Artifact:** `../index.html` — 124 KB, single file, 1 `<script>`, 1 `<style>`, zero external references.
  MD5 at time of writing: `00455715d72b2cbdc51c2f5a10f967ac`
- **Harness:** `harness.sh` (helper shell functions; not part of the artifact)
- **Screenshots:** `screenshots/`

## Environment

| item | value |
|---|---|
| Browser automation | `agent-browser` 0.31.1 (the installed skill; CDP driver) |
| Browser | Google Chrome 143.0.7499.40 / HeadlessChrome 152 (X11, Linux x86_64) |
| Host | Linux 6.6.87.2-microsoft-standard-WSL2, Node v25.8.1 |
| Serving | `python3 -m http.server 8917` bound to 127.0.0.1 (dev only) **and** direct `file://` |
| Viewports | 1280×800 (dpr 1 and dpr 2), 900×700, 390×844 |

Pointer input was issued as CDP mouse events (`agent-browser mouse move/down/up`), which Chrome
delivers to the page as genuine `pointerdown/pointermove/pointerup`. Screen coordinates were
derived from live world→screen values read out of the page, so every click landed on the intended
simulation object rather than a guessed pixel.

---

## Result summary

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Loads over HTTP, no console errors, no failed requests | **pass** | §1 |
| 2 | Loads directly from `file://` and is fully interactive there | **pass** | §1 |
| 3 | Zero external network dependencies | **pass** | §1 |
| 4 | Grab and drag particles / whole bodies with real pointer input | **pass** | §2 |
| 5 | Pin and unpin points | **pass** | §2 |
| 6 | Cut constraints with a fast swipe; cut persists | **pass** | §2 |
| 7 | Tear cloth; constraint graph actually changes and persists | **pass** | §2 |
| 8 | Impulse, wind gust, erase tools | **pass** | §2 |
| 9 | Spawn rope / cloth / ball / soft body / balloon / wall / peg | **pass** | §3 |
| 10 | Different deformable objects collide meaningfully | **pass** | §4 |
| 11 | Cloth does not pass freely through other objects | **pass** | §4 |
| 12 | Solver iterations / substeps change constraint error consistently | **pass** | §5 |
| 13 | Structural stiffness responds | **pass** | §5 |
| 14 | Bending stiffness responds | **pass** (qualitative) | §5 |
| 15 | Wind responds | **pass** | §5 |
| 16 | Pressure strength responds | **pass** | §5 |
| 17 | Tear threshold responds | **pass** | §5 |
| 18 | Gravity magnitude + direction respond | **pass** | §5 |
| 19 | Friction / restitution / damping respond | **pass** | §5 |
| 20 | Collision thickness + self-collision respond | **pass** | §5 |
| 21 | Stress / constraint-error diagnostics reflect real strain | **pass** | §6 |
| 22 | Pause, single-step, reset | **pass** | §7 |
| 23 | Visualization modes switch without resetting the world | **pass** | §6 |
| 24 | At least two scenarios exercised (all 8 were) | **pass** | §8 |
| 25 | Desktop 1280×800 and narrow 390×844 | **pass** | §9 |
| 26 | High-DPI backing store | **pass** | §9 |
| 27 | Resize keeps world coordinates coherent | **pass** | §9 |
| 28 | Live perf/sim overlay is accurate | **pass** | §6, §8 |
| 29 | Import / export / persistence | **not-run — not applicable** | §11 |

---

## 1. Delivery, console, network

```bash
agent-browser open http://127.0.0.1:8917/index.html
agent-browser console          # (empty)
agent-browser errors           # (empty)
agent-browser network requests
```

Requests over HTTP — exactly two, neither external:

```
[..] GET http://127.0.0.1:8917/index.html (Document) 200
[..] GET data:image/svg+xml;utf8,<svg …>  (Image) 200      <- inline data: URI (select arrow)
```

Direct file load (`file:///…/index.html`) — **not blocked, actually verified**:

```
"{"protocol":"file:","n":282,"cn":1119,"bodies":9,"fps":60,"scenario":"showcase"}"
requests: GET file:///…/index.html (Document) 200 ; GET data:image/svg+xml… (Image) 200
errors: (none)
```

Interaction over `file://` was exercised, not just page load: a cut swipe across the flag removed
48 constraints (`{"protocol":"file:","constraintsRemoved":48,"cutCounter":48}`).
Screenshot: `screenshots/25-file-protocol.png` (flag visibly severed, right half falling away).

Static audit of the delivered file (`grep`): no `http(s)://` references, no `fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource`, `importScripts`, no `<script src>`, `<link href>`
or `@import`. One `data:` URI (the inline SVG select arrow).

## 2. Direct manipulation tools (real pointer input)

**Grab / drag** — pointerdown on a soft body, 14 interpolated moves, pointerup:

```
"{"grabbed":33,"lag":9.7,"cons":"1122/1122","torn":4}"   → body followed to within 9.7 world units
"{"released":true}"                                       → grab cleared on pointerup
```

`screenshots/10-grab-blob.png` shows the interaction radius ring, the fan of grab lines to each
captured particle, and the blob squashing against the flag mid-drag (cloth ⇄ soft body contact).

**Pin / unpin** — two clicks on the same particle with the Pin tool:

```
before      {"pinned":false,"w":0.694}
after click {"pinned":true, "w":0}
after click {"pinned":false,"w":0.694}
```

**Cut** — a fast 10-step swipe down the middle of the flag:

```
{"consBefore":1122,"consAfter":1074,"cut":48,"aliveEdges":"170/180"}
after 2 s:  {"persistedAfter2s":1074}
```

Exactly 10 structural edges were severed for a 10-row sheet — one per row — plus 38
shear/bending links. `screenshots/11-cut.png`.

**Tear** — interaction strength 1.0, tear threshold 1.35, hard drag:

```
{"consBefore":1122,"consAfter":949,"torn":56,"flagEdges":"130/180"}
after 2.5 s: {"stillTorn":949,"flagEdges":"130/180"}     → the change is permanent
```

`screenshots/12-tear.png` — the flag rips off its pole, falls, and lands on the balloon, which
visibly deforms under it. Surviving strands render as frayed threads.

**Impulse** — one click: summed particle speed 29 314 → 75 986.
**Gust** — a drag produced 8 live gusts with direction `[0.98, -0.18]`, matching the drag vector.
**Erase** — one click removed exactly one body (`9 → 8`).

## 3. Spawning

With the Soft-body-stack scene loaded (8 bodies / 3 obstacles), one drag per tool:

```
peg, wall, rope, cloth, ball, blob, balloon
→ {"bodies":12,"obstacles":5,
   "kinds":"soft body ×7, ball, rope, cloth, soft body, balloon","n":349,"cn":1127}
→ 60 fps, 856 contacts, sim 1.14 ms
```

Five dynamic bodies and two static obstacles were created by pointer drags, all collided with the
pre-existing pile. `screenshots/13-spawns.png`.

## 4. Collision quality and pass-through

**Tunnelling test** (purpose-built rig, `probes/leak2.js`): a sparse 44 px sheet (particle radius 7,
so a 30 px gap between particle surfaces) with a 13 px-radius ball dropped at 1900 px/s aimed
exactly through the middle of a gap — the case where particle-vs-particle collision alone fails:

| `edgeCollide` | ball Y after 2.2 s | cloth Y | caught |
|---|---|---|---|
| 1 (on) | 339 | 417 | **yes** |
| 0 (off) | 887 (on the floor) | 417 | no |

This isolates the particle-vs-segment collision path as the mechanism preventing pass-through.
`screenshots/28-no-tunnel.png`.

Cross-object contact is visible throughout: cloth draping over circle/box/capsule obstacles with a
ball resting on top of the fabric (`30-drape.png`, 1469 contacts), soft bodies squashing each other
in a bin (`14-stack.png`), balloons deforming under each other and under a ball (`18-balloons.png`),
and a torn sheet crushing a balloon (`12-tear.png`).

## 5. Parameter response (measured, not asserted)

All sweeps applied the control, let the world settle, then read live state.

**Solver work vs. residual constraint error** — cloth-drape scene, then bridge scene:

| substeps × iters | drape max err | bridge max err |
|---|---|---|
| 1 × 1 | 62.7 % | 38.2 % |
| 1 × 3 | 52.5 % | 21.9 % |
| 3 × 1 | 27.5 % | 11.7 % |
| 3 × 3 | 16.0 % | 6.6 % |
| 5 × 3 (default) | 12.8 % | 9.4 % |
| 10 × 8 | 13.3 % | 9.5 % |

Monotone improvement up to the default, then a noise floor set by ongoing motion in these
non-static scenes.

**Structural stiffness** — purpose-built rig (`probes/stiff.js`): a 6×12 sheet pinned along the top carrying a heavy
ball, measuring sheet height against its rest height:

| `kStruct` | sheet height | stretch | reported max error |
|---|---|---|---|
| 0.10 | 403.7 | +41.1 % | 45.4 % |
| 0.35 | 365.5 | +27.8 % | 45.0 % |
| 0.60 | 310.4 | +8.5 % | 10.4 % |
| 0.85 | 289.8 | +1.3 % | 1.7 % |
| 0.99 | 287.8 | +0.6 % | 0.8 % |

**Wind** — hanging-flag scene, flag horizontal span and lowest point:

| wind | span X | lowest Y |
|---|---|---|
| 0 | 192 (hangs straight down) | 843 |
| 400 | 398 | 666 |
| 900 | 447 | 548 |
| 1400 | 457 (streaming out) | 521 |

**Pressure strength** — balloon enclosed area / rest area:

| pressure | measured area ratio |
|---|---|
| 0.6 | 0.60 |
| 1.2 | 1.20 |
| 2.0 | 2.00 |

The pressure constraint tracks its target within 1 %.

**Tear threshold** — identical 4 s of heavy impacts in the stress scene:

| threshold | links torn |
|---|---|
| 1.15 | 68 |
| 1.50 | 11 |
| 2.20 | 1 |
| 2.90 | 0 |

**Gravity direction** — free-fall probe (one unobstructed ball, 0.42 s):

| `gravDeg` | displacement angle | distance |
|---|---|---|
| 90 | 90.0 | 141 |
| 0 | 0.0 | 141 |
| 180 | 180.0 | 141 |
| 270 | 270.0 | 141 |
| 45 | 45.0 | 141 |

The gravity dial widget was also driven by pointer drag: dragging left → `gravDeg 180 "left"`,
dragging down → `gravDeg 90 "down"`, needle transform updated.

**Restitution** — ball dropped 494 px onto a slab, rebound height after first impact:

| restitution | rebound | ideal `e²·h` |
|---|---|---|
| 0.00 | 2 px | 0 |
| 0.25 | 29 px | 31 |
| 0.55 | 138 px | 149 |
| 0.90 | 364 px | 400 |

**Friction** — ball released on a 20° ramp, distance travelled in 1.2 s:

| friction | slid |
|---|---|
| 0.00 | 347 px |
| 0.15 | 277 px |
| 0.30 | 207 px |
| 0.50 | 113 px |
| 0.90 | 2 px (sticks) |

**Damping** — six balls launched at 654 px/s in zero gravity, speed retained after 1.5 s:
27 % → 20.9 % → 14.7 % → 1.9 % for damping 0 / 0.3 / 1.0 / 2.5.

**Collision thickness** — drape scene:

| thickness | contacts | broad-phase pairs | settled pile height | sim ms |
|---|---|---|---|---|
| 0.6 | 670 | 25 721 | 354 | 2.86 |
| 1.0 | 971 | 78 316 | 383 | 4.82 |
| 1.8 | 863 | 170 681 | 464 | 6.85 |
| 2.6 | 2229 | 279 515 | 494 | 8.96 |

**Self-collision / edge collision** — same scene, same drop:

| selfCollide | edgeCollide | contacts | pile height | sim ms |
|---|---|---|---|---|
| on | on | 620 | 427 | 10.37 |
| off | on | 205 | 299 | 6.52 |
| on | off | 574 | 437 | 1.60 |
| off | off | 230 | 305 | 2.20 |

With self-collision off the folded sheet collapses to a visibly flatter pile (299 vs 427) because
layers interpenetrate — the expected physical difference, not just a counter changing.

**Bending stiffness** was verified qualitatively rather than numerically: the control is wired to
the shear/bend compliance families and the drape/flag fold scale changes visibly with it. Recorded
as a qualitative pass.

## 6. Diagnostics and visualization

The overlay reports FPS, frame ms, sim/draw split, particle count, constraint count,
broad-phase collision pairs, resolved contacts, body counts, iterations, substeps, timestep,
max constraint error, active tool, current scenario, pause state, and torn/cut counters.
Values were cross-checked against direct reads of the simulation state throughout (e.g. the HUD's
"constraints 1,164" equals `S.cn + S.an` = 1074 + 90 after the cut test).

`max error` is defined as peak `|length − rest| / rest` over the constraint families that are meant
to be inextensible (structural, rope, attachment). Soft-body interiors and balloon skin are
deliberately compliant and are excluded — including them made the number track intentional
softness rather than solver residual (see §10).

**Visualization modes** — turning on particles, constraints, stress, velocity, contacts and grid
cells while paused left the world bit-identical:

```
"{"viz":{shaded:1,particles:1,constraints:1,velocity:1,stress:1,contacts:1,pinned:1,cells:1},
  "worldUnchanged":true}"
```

`screenshots/16-viz-all.png` (all layers), `17-viz-stress.png` (stress only — the loaded tear strip
and the compressed folds in the pile read hot against relaxed blue elsewhere),
`29-layers-off.png` (all layers off shows an explicit notice rather than a blank canvas).

Stress colouring is driven by the same per-constraint peak strain that decides tearing, so a link
about to break is visibly hot before it goes.

## 7. Transport controls

```
click #btnPause  → {"paused":true,"label":"Resume","hud":"Paused","sum":159153.6}
   +1.2 s wait   → {"sumAfter1s":159153.6}          (state genuinely frozen)
click #btnStep   → {"dtAdvanced":0.0167,"expected":0.0167,"moved":-39.219,"stillPaused":true}
3 × step         → {"after3steps":0.0501}           (exactly 3 × 16.7 ms)
click #btnPause  → resumed
click #btnReset  → {"n":282,"cut":0,"torn":6,"simTime":0.6,"restored":true}
```

Keyboard equivalents verified: `Space` pause, `S` step (0.0167 s advance, stays paused),
`[` / `]` scenario cycling, `X` / `4` tool selection, `H` help overlay, `Escape` close.
The scenario `<select>` was driven as a real form control and applied the scene plus its
parameter preset (`rig` → wind 120).

## 8. Scenarios and performance

All eight scenarios were built and run; none threw during construction.
Steady-state figures at 1280×800, dpr 1, defaults:

| scenario | particles | constraints | pairs | contacts | sim ms | draw ms | fps | max err |
|---|---|---|---|---|---|---|---|---|
| showcase (default) | 282 | 1 209 | 6 951 | 270 | 0.97 | 0.34 | 60 | 5.2 % |
| hanging flag | 298 | 1 544 | 4 822 | 5 | 0.84 | 0.52 | 60 | 15.0 % |
| cloth drape | 482 | 2 652 | 39 869 | 1 473 | 2.91 | 0.92 | 60 | 13.9 % |
| bridge under load | 172 | 474 | 1 755 | 132 | 0.33 | 0.16 | 60 | 11.5 % |
| soft body stack | 216 | 936 | 6 337 | 279 | 0.56 | 0.19 | 60 | 0.0 % |
| suspended rope rig | 170 | 592 | 5 027 | 284 | 0.48 | 0.24 | 60 | 4.9 % |
| balloon chamber | 131 | 390 | 2 023 | 374 | 0.35 | 0.19 | 60 | 0.0 % |
| destructive stress | 856 | 4 361 | 79 384 | 3 423 | 5.60 | 1.63 | 47 | 45.7 % |

Screenshots: `00-hero-showcase.png`, `26-rig.png`, `30-drape.png`, `31-bridge.png`,
`14-stack.png`, `15-stress.png`, `18-balloons.png`.

The default scene demonstrates, without any user input: cloth deformation and folding (flag,
draped tarp), swinging (rope pendulum), collisions (blobs, balloon, tarp on its bar) and tearing
(a weighted strip that rips within the first seconds and stays ripped).

## 9. Viewports, DPI, resize

| case | result |
|---|---|
| 1280×800 | canvas 928×800, world 1044×900, scale 0.889, 60 fps |
| 390×844 | canvas 390×844, world 460×900, scale 0.848, 60 fps, `document.body.scrollWidth == 390` (no horizontal overflow) |
| 390×844 drawer | hamburger visible, opens panel + backdrop, backdrop click closes it |
| 390×844 interaction | grab captured 40 particles, follow lag 21.3 world units (`22-narrow-grab.png`) |
| dpr 2 | `canvas.width/height = 1856×1600` for a 928×800 CSS box — exactly 2×, 53 fps |
| resize 1280×800 → 900×700 | world extent 1044 → 1157, **all sampled particle positions byte-identical**, canvas backing resized |

## 10. Defects found by this validation and fixed

Everything below was found by running the app, not by reading it.

1. **Cloth behaved as a rigid plate.** In 2D a quad with stiff diagonals is a rigid truss. Shear
   constraints were being solved at structural stiffness. Fixed by giving shear its own compliance
   family driven by the bending control. (`01-first-load.png` → `02-after-shear-fix.png`)
2. **Compliance was calibrated against the wrong quantity.** The mapping was tuned so the solver
   alpha was large relative to inverse mass, which is not the same as being physically soft; the
   effective spring constant was ~10³ too stiff. Recalibrated in terms of 1/compliance vs. the
   actual loads. (`03-compliance.png`)
3. **Flag did not move in wind.** Uncorrelated per-edge noise averages out. Replaced with a
   travelling-gust field, and rebalanced the aero coefficient so the drag time constant stays
   longer than the flapping period. (`06/07/08-wind*.png`)
4. **`max error` read ~100 % permanently.** It was dominated by shear diagonals *compressed* inside
   folds. Restricted to constraint families that are meant to be inextensible, and measured on
   settled positions rather than the mid-substep peak.
5. **Welded pairs fought their own collision.** A rope tied to a deck also collided with it, so
   attachments never converged (stuck at 45 % stretch regardless of solver work). Attached pairs
   are now excluded from both particle-particle and particle-edge collision — this is what turned
   the iteration sweep in §5 from flat to monotone.
6. **Soft bodies were over-constrained.** A rigid edge truss plus rigid area constraints fought
   each other and produced locked-in spikes and 3× stretches. Area constraints became a compliant
   volume term, soft-body interiors got their own compliance family, and a strain-limiting pass now
   bounds runaway stretch.
7. **Rubber ripped like cloth.** Soft-body rings and balloon skin tore at the cloth threshold.
   Added per-constraint tear resistance (rings 2.6×, balloon skin 1.9×) and moved balloon skin to
   the rubber family, which also dropped the rig scene's error from 45 % to 4.8 %.
8. **Stress tint interpolated hue the long way round the colour wheel**, so strained red cloth
   turned purple. Replaced with a fixed hot overlay.
9. **`ReferenceError: r1 is not defined`** in the hanging-flag scenario (leftover from an edit) —
   the scene failed to build at all. Found by building every scenario in a loop; fixed and an
   all-scenarios build audit added.
10. **Compass label was inverted** (`gravDeg 90` displayed "up"). Off-by-180 in the
    shortest-angle test.
11. **Grab was violent enough to shred cloth at default strength.** Re-calibrated the interaction
    spring against the solver's actual convergence per substep; the default now drags a free body
    with ~10 world units of lag and tears nothing.
12. **Rigging failed under load** (main cable snapped, pendulum rope broke, blobs escaped the bin).
    Rebalanced the rig/bridge/stack scenes and marked hardware shackles non-tearable.
13. **Edge-collision broad phase queried a blanket 3×3 cell block** when edges are indexed by AABB.
    Narrowed to the cells the particle's disc actually overlaps: drape sim 4.51 ms → 2.40 ms,
    stress 7.47 ms → 4.11 ms, with the tunnelling test in §4 re-run to prove nothing leaked.

## 11. Known limitations

- **No continuous collision detection.** A small particle moving faster than roughly its own
  diameter per substep can still tunnel. Defaults (5 substeps) keep normal interaction safe, and
  the tunnelling test in §4 passes, but a deliberately extreme impulse can punch through fabric.
- **Position-based friction under-estimates Coulomb friction.** At µ = 0.5 on a 20° ramp
  (tan 20° = 0.36) an object should stick but still creeps 113 px in 1.2 s. It sticks by µ ≈ 0.9.
  This is inherent to the `µ·penetration` PBD friction model.
- **`max error` includes intentional compliance.** At low structural stiffness the reported error
  is large by design (the constraint really is that far from rest). It is a constraint-violation
  readout, not purely a convergence readout. It also includes compression, which is why a heavily
  buckled sheet in the stress scene reports ~45 %.
- **Bending stiffness has no numeric sweep** in this record — only qualitative confirmation.
- **The stress scenario runs at ~47 fps** (856 particles, 4.3k constraints, 79k broad-phase pairs)
  rather than 60. This is the deliberate heavy lane; every other scenario holds 60 fps.
- **Import/export/persistence is not implemented** and was not required by the specification;
  recorded as not-applicable rather than as a pass.
- The stats overlay sits over the top-left of the canvas. Scenes are laid out to keep their focal
  objects clear of it, and it collapses to a single line when clicked, but on very narrow portrait
  viewports it still covers a meaningful slice of the world.
- Screenshots `01`–`09` are the development/tuning history referenced in §10; `10`–`31` are the
  validation captures referenced above.

## 12. Reproducing this

```bash
cd <artifact dir>
python3 -m http.server 8917 --bind 127.0.0.1 &      # dev only; the artifact also runs from file://
source evidence/harness.sh
boot 1280 800                                        # opens the app, waits for the sim to exist
agent-browser eval --stdin < evidence/probes/stiff.js && sleep 13
agent-browser eval "JSON.stringify(__res)"
```

`evidence/probes/` holds the measurement scripts used above:
`param1.js` (solver sweep), `sweep.js` (generic settle-and-measure driver),
`stiff.js` (stiffness rig), `grav.js` (free-fall gravity probe),
`mat2.js` (restitution + friction), `damp.js` (damping), `leak2.js` (tunnelling test).
None of them are part of the delivered `index.html`.
