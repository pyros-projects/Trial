# Validation — Soft-Body, Cloth, and Constraint Playground

Artifact: `/home/pyro/projects/naked/grok46/04-deformable-physics/index.html`  
Date: 2026-09-07  
Browser tool: `agent-browser` 0.31.1 (Chromium/CDP). No substitution.

Local HTTP: `python3 -m http.server 8876 --bind 127.0.0.1` from the project directory  
(port 8765 was already occupied by another app; 8876 served this artifact.)

## Commands used

```bash
python3 -m http.server 8876 --bind 127.0.0.1
node --check  # extracted <script> from index.html
agent-browser --session deform46 open "http://127.0.0.1:8876/index.html?v=…"
agent-browser --session deform46 set viewport 1280 800
agent-browser --session deform46 set viewport 390 844
agent-browser --session deform46 snapshot -i
agent-browser --session deform46 click @eN / fill / select / press
agent-browser --session deform46 mouse move|down|up
agent-browser --session deform46 eval --stdin   # window.SIM.getState()
agent-browser --session deform46 screenshot evidence/screenshots/…
agent-browser --session deform46 errors
agent-browser --session deform46 console
agent-browser --session deform46 network requests
agent-browser --session deform46 network route "https://**" --abort
agent-browser --session deform-file open file:///…/index.html
```

Diagnostics API used: `window.SIM.getState()`, `SIM.liveConstraintCount()`, `SIM.getParticles()`, `SIM.pick()`.

## Check results

| Check | Result | Evidence |
| --- | --- | --- |
| Loads, 60 FPS default flag scene, HUD populated | **pass** | 228 particles, 1099 constraints, HUD FPS 60. `01-desktop-flag.png`, `04-flag-stable.png` |
| No console errors / uncaught exceptions | **pass** | `errors` and `console` empty on load, after grab/cut/tear, after scenario switches |
| No external runtime fetches | **pass** | Single-file HTML/CSS/JS. HTTP requests: only `127.0.0.1:8876/index.html`. After data-URI favicon, no `favicon.ico`. HTTPS `**` aborted; sim still ran at 60 FPS |
| Direct `file://` open | **pass** | `file:///home/pyro/projects/naked/grok46/04-deformable-physics/index.html` → title Deformable Playground, `SIM` present, 228 particles, 60 FPS. `30-file-direct.png` |
| Grab / drag particles (real pointer) | **pass** | Paused kinematic grab moved cloth particle 43 from (464, 135) to (679, 356). Stretched flag, collision pairs 0→46, max error ~0.03→3.39. `09-grab-kinematic.png` |
| Pin / unpin | **pass** | Pin tool click raised pinned count 13→14 (particle 4) |
| Cut constraints (continuous stroke) | **pass** | Live constraints 1099→992, then regression 1099→977 with HUD `hudC` matching (`977`). `10-cut.png` |
| Tear cloth (alters constraint graph, remains) | **pass** | Tear stroke 1099→1039 while running; HUD tool `tear`. `31-tear.png` |
| Spawn rope / cloth / ball / soft / obstacle | **pass** | Ball spawn 228→245 particles, new object id 3. Later spawns 245→276. Obstacle is static (no extra particles). Early rope/cloth clicks in letterbox were rejected; spawn now clamps into world |
| Collisions and deformation, not canned motion | **pass** | Flag extends under wind (cloth x ~222–552). Drape: 352 particles, 9–11 collision pairs, 37 contacts, cloth folding over boxes/circle. Stack: 176 particles, 3 pairs, 18 contacts, blobs resting on each other. `23-drape-live.png`, `25-stack-live.png` |
| Solver iterations / stiffness / wind / tear threshold | **pass** | Native `input` events: wind 240, iterations 12, tear 1.25, struct 0.70. Lowered tear made draped cloth rip on obstacles (visible holes). Agent `fill` on `<input type=range>` was imprecise; the control handlers themselves work |
| Stress / constraint diagnostics | **pass** | Vis modes `stress`, `constraints`, `velocity`, `contacts`, `cells`, `particles`, `pins`. Particle/constraint counts unchanged (276 / 1112) across vis switches. `12-`–`16-`, `26-`, `27-` |
| Pause / resume / single-step / reset | **pass** | Pause button and Space set `paused:true` and HUD `paused`. Step keeps paused and advances. Reset / scenario reload rebuilds the world |
| Scenario switch (≥2) | **pass** | Flag, Draped Cloth (352 p), Destructive Stress (347 p, constraints dropped vs intact cloth under tear 1.25), Bridge (211 p), Soft Stack (176 p), Suspended Ropes, Balloon Chamber (123 p). `17-`–`24-`, `32-drape-keyboard.png`. Keyboard `2` selected drape |
| Gust / impulse | **pass** | Gust on drape raised max error 0.03-class → 0.706. Impulse 0.035 → 0.078 |
| Self-collision control | **pass** | After scrolling the sidebar, checkbox click: `selfCollision` true→false→true |
| Desktop 1280×800 | **pass** | Canvas ~980×733 plus 300px sidebar. `01-desktop-flag.png` |
| Narrow 390×844 | **pass** | Canvas 390×364, aside stacked below (y≈523, h≈321). FPS 60, HUD readable, tools in bottom panel. Cut count 977 persisted. `28-mobile-390.png`, `33-mobile-final.png` |
| Resize / world coordinates | **pass** | Switching 1280×800 ↔ 390×844 kept particle count and scenario; camera letterboxes the 1280×800 world |
| Error state (spawn overflow banner) | **not-run** | `#banner` exists (`role=status`). `MAX_PARTICLES` (2400) was not filled in this run, so the overflow message was not observed live |
| Audio | **not-run** | No audio in the application |

## Fixes made after failed observations

1. **Grab did nothing useful** — grabbed particles kept inverse mass, so the solver yanked them back. Grab now sets kinematic `w=0` and restores mass on release. Paused dragging also runs constraint projection.
2. **Balloon exploded / teleported** — pressure was applied every solver iteration. Pressure is now once per substep with clamped corrections; balloons also have a center particle for picking and volume.
3. **Pinned flag points jittered against the pole** — static collision moved `w=0` particles. Pinned particles skip static collision.
4. **Contact velocity injected energy** — friction/restitution ran every iteration. Velocity response is last-iteration only and softer.
5. **HUD constraint count stale after cutting while paused** — `updateHud` now recounts live constraints every frame. Retest: 1099→977 on both `liveConstraintCount()` and `#hudC`.
6. **Spawn clicks in the letterbox were rejected** — `spawnAt` now clamps into the world instead of bailing on y&lt;40.
7. **`favicon.ico` 404** — inline SVG data-URI icon. Network log after that showed only the document GET.

## Remaining limitations

- Floor-contact balloons can still drift along the ground toward nearby poles instead of sitting still in open space.
- Heavy scenes (draped cloth, 12 solver iterations, lots of torn fragments) dropped to ~20 FPS; the default flag scene holds ~60 FPS.
- Self-collision is approximate (spatial hash, skip structural neighbors). Fast tunneling of tiny fragments can still happen.
- On 390×844 the canvas is short and letterboxed; the hanging flag is small compared with desktop. Controls below the canvas require scrolling to reach density/tear/interaction sliders.
- Overflow-particle error banner was not driven to the 2400-particle cap in this session.

## Screenshot index

All under `evidence/screenshots/`:

- `01-desktop-flag.png` — default hanging flag, desktop
- `04-flag-stable.png` / `05-flag-separated.png` — balloon on the floor after pressure fix
- `09-grab-kinematic.png` — cloth grabbed and stretched
- `10-cut.png` — cut tool on stretched cloth
- `11-spawns.png` — extra spawned objects
- `12-vis-stress.png` … `16-vis-cells.png` — visualization modes
- `17-drape.png` … `22-balloons.png` — scenarios (some captured while still paused)
- `23-drape-live.png` — live drape + lowered tear threshold (cloth ripping)
- `24-stress-live.png` — destructive stress, running
- `25-stack-live.png` — stacked soft bodies colliding
- `26-vis-particles.png`, `27-vis-pins.png`
- `28-mobile-390.png`, `33-mobile-final.png` — 390×844
- `29-file-url.png` — aborted first file:// attempt (blank after session churn)
- `30-file-direct.png` — successful `file://` load
- `31-tear.png` — tear stroke, constraints 1039
- `32-drape-keyboard.png` — keyboard scenario `2`
