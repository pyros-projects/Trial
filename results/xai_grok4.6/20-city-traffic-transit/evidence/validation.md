# Harbor Desk — validation record

Artifact: `/home/pyro/projects/naked/grok46/20-city-traffic-transit/index.html`  
Date: 2026-09-08  
Browser: agent-browser (Chromium/CDP) session `harbordesk`  
Local server: `python3 -m http.server 8766 --bind 127.0.0.1` (development only; not a runtime dependency)  
External network: `https://*` aborted via `agent-browser network route "https://*" --abort`. Local `127.0.0.1:8766` left reachable.

Statuses used: **pass**, **fail**, **blocked**, **not-run**.

---

## Environment and commands

```bash
python3 -m http.server 8766 --bind 127.0.0.1 --directory /home/pyro/projects/naked/grok46/20-city-traffic-transit
agent-browser --session harbordesk network route "https://*" --abort
agent-browser --session harbordesk open http://127.0.0.1:8766/index.html
agent-browser --session harbordesk set viewport 1280 800
agent-browser --session harbordesk snapshot -i
agent-browser --session harbordesk screenshot evidence/screenshots/01-desktop-default.png
# later interactions: click labeled controls, mouse down/move/up on #map, keyboard P / Enter
agent-browser --session harbordesk-file open file:///home/pyro/projects/naked/grok46/20-city-traffic-transit/index.html
```

JS syntax: extracted `<script>` and `node --check` → `SYNTAX_OK`.  
Source scan: no `fetch(`, no module `import`, no CDN URLs. The only `http://` string is an SVG `xmlns` inside a `data:` favicon, which is not fetched.

---

## Public checks (required)

| Check | Status | Evidence |
|---|---|---|
| Build/edit a connected road network | **pass** | Road tool + pointer drag on canvas. Downtown 30 nodes / 49 links → **34 / 54** after a mid-block connector that split existing streets. Repeated after 390×844 resize: again 49→54 links, 30→34 nodes. Screenshots `04-after-road-draw.png`, `19-mobile-draw-after-resize.png`. |
| Vehicles with distinct O/D route through the network | **pass** | Inspected car `#320`: origin node `1` → dest `30`, speed 27 km/h, live path drawn. `MetroSim.selfTest()` `route-exists` true. Types present: car, truck, bus. |
| Queueing + traffic-signal response | **pass** | Default downtown: 14–27 queued agents, red/green signal heads on approaches, vehicles stopped at red. HUD `QUEUE` and overlay Queue. Screenshot `02-downtown-traffic.png`, `07-overlay-queue.png`. |
| Bottleneck/closure → reroute or congestion | **pass** | Closed busy Harbor Pkwy (`id` 12, 10 vehicles). Toast: “Road closed — agents will reroute or fail”. Closed edges removed from graph (`edgesRemaining: 0`). Shortly after: **0** live paths using the closed link, **0** missing-edge paths, queue 26. Screenshot `05-road-closed.png`. |
| Add/modify bus or transit route | **pass** | Placed stops “Stop 25” and “Stop 30”, Route tool, Enter. Toast “Transit route created”. Route `Line 3` stops `[10, 9]`. Routes 2→3. Screenshot `12-new-transit-route.png`. |
| Stops, vehicles, passengers/ridership, travel-time impact | **pass** | Downtown: 8–10 stops, 4–9 buses. Bus `#3` had 2 onboard; later **ridership 8**, bus occupancy **0.6**, charts p95 TT **190s**, throughput **63.2 /min**. Ridership derives from boarding/alighting, not a cosmetic counter. |
| One-way / lane direction | **pass** | One-way tool on Cedar: `lanesBA` 1→0, edge `id:ba` removed, **0** vehicles on banned BA. `selfTest` `oneway-blocks-ba` true. |
| Signal timing | **pass** | Selected junction 7. Phase editor showed P1/P2, “No crossing-green conflicts”, “All approaches served”. Changed P1 green **42→22**, cycle **72→84**, offset **12**; policy flipped to **user**, `auto: false`. Screenshot `13-signal-editor.png`. |
| Pause and single-step | **pass** | Pause button: HUD `PAUSE`, `metrics().paused === true`. Step: sim time **+0.25 s** while remaining paused. Resume returned `RUN`. Keyboard `p` also toggled pause on the stress scenario. Screenshots `03-paused.png`. |
| Speed changes | **pass** | Speed slider filled; HUD/speed became **8.25×** (range fill is quantized). `MetroSim.setSpeed(4)` and `setSpeed(8)` also applied. Time acceleration uses 0.05 s substeps (no junction tunneling observed). |
| Preset under stress | **pass** | Loaded **Dense stress test**: 56 nodes / 97 links, then 116 live (105 car / 7 truck / 4 bus) at **60 fps**. Screenshot `16-stress-running.png`. |
| Save and reload | **pass** | `exportState()` is a frozen snapshot (mutating live links did not change the copy). `importState(JSON.stringify(before))` restored `closed` to the snapshot value. Save/CSV/PNG buttons clicked; PNG showed up as `data:image/png` in the network log. Autosave restored a previous city on reload (`Restored autosave`). |
| Invalid import fails gracefully | **pass** | `importState("nope")` and `{v:1}` without nodes kept current city name; toast `Import failed: City must include nodes and links arrays` / `Unsupported or missing format version`. `selfTest` `bad-import-throws` true. |
| Heatmap diagnostics | **pass** | Overlays Density, Queue, Transit coverage, Network validation all switched (`MetroSim.overlay` tracked). Screenshots `06`–`09`. |
| Continuous road drawing after viewport resize | **pass** | Viewport 390×844, then pointer-drag road + Enter. Topology grew 49/30 → 54/34. Screenshot `19-mobile-draw-after-resize.png`. |
| Direct `file://` open | **pass** | `file:///home/pyro/projects/naked/grok46/20-city-traffic-transit/index.html` titled Harbor Desk, `MetroSim` present, 30 nodes, 64 live vehicles. Screenshot `21-file-url.png`. |
| No external runtime fetches | **pass** | Network log: local `index.html`, local favicon (before data-URI icon), and `data:image/png` from PNG export. HTTPS aborted. No CDN/API. |

---

## Additional exercised flows

| Check | Status | Notes |
|---|---|---|
| Default downtown shows traffic, signals, transit | **pass** | After warm start: ~68 live (58 car / 6 truck / 4 bus), 26 signals, 2 routes, 60 fps. Screenshot `02-downtown-traffic.png`. |
| Live HUD overlay fields | **pass** | FPS, sim time, speed, active, completed, avg TT, net speed, queue, ridership, tool, incidents, pause state all populated on desktop and 390×844. |
| Charts tab live analytics | **pass** | Throughput, avg/p95 TT, speed & queue, transit wait/occupancy, emissions. Screenshot `11-charts.png`. |
| Vehicle inspect + next-route path | **pass** | Inspector listed type, speed, O/D, age. |
| Car-only compare toggle | **pass** | Button On, `S.carOnly === true`. |
| Demand / weather / frequency sliders | **pass** | Demand 1.5, transit freq 1.5, weather 0.75 via labeled sliders. Screenshot `14-demand-controls.png`. |
| Incident placement | **pass** | HUD incidents **1** after clicking Harbor Pkwy with Incident tool. Screenshot `22-incident.png`. |
| Reset keeps network, clears trips | **pass** | After reset: completed/failed/ridership 0, time ~2.8 s, nodes/links kept (34/54 including drawn roads). Toast confirmed seed. Screenshot `23-after-reset.png`. |
| Help overlay | **pass** | Opened/closed. Screenshot `17-help.png`. |
| Narrow viewport 390×844 | **pass** | Usable map 332×696, tools remain, Panel button shown, inspector drawer opened. Screenshots `18`, `20`. |
| Desktop 1280×800 | **pass** | Primary layout. Screenshot `01`, `02`. |
| High-DPI backing store | **pass** (code) | `canvas.width = css * devicePixelRatio`. This harness reported `devicePixelRatio === 1`, so bitmap equaled CSS pixels. Not a functional fail. |
| Web Audio after gesture | **pass** (state only) | After map click, `MetroSim.audioState()` → `"running"`. **Audio quality was not heard**; only AudioContext state was inspected. |
| Bridge closure scenario | **pass** | Loaded: 50 links, 50 live, 1 route. Screenshot `24-bridge.png`. North Bridge is closed in the current artifact (fix applied after this screenshot). |
| BRT corridor scenario | **pass** | 8 bus-only links, 1 route, 2 buses. Screenshot `25-brt.png`. |
| Undo/redo buttons | **not-run** | Present; not clicked in this pass (road draw used an undo snapshot internally). |
| Named scenario prompt | **not-run** | Uses `window.prompt`; not filled by the agent. |
| CSV file contents | **not-run** | Export button clicked; the downloaded CSV was not opened. |
| Remaining curated scenarios (crossroads, avenue, bottleneck, stadium, strike, induced) | **not-run** | Implemented and selectable; only downtown, stress, bridge, and BRT were loaded in-browser. |
| Touch pinch-zoom | **not-run** | Pointer path used; two-finger pinch not exercised. |
| Sandbox budget / paid build | **not-run** | Sandbox stayed On. |

---

## Failures observed and fixes

1. **Thin default traffic** — first load had only ~5 cars and no buses.  
   **Fix:** spawn rate `0.018` → `0.11`, launch buses both directions at scenario load, `spawnCarry += 36`, ~19 s warm sim.  
   **Retest:** 68 live including 4 buses / 6 trucks (`02-downtown-traffic.png`). **pass**

2. **`exportState()` held live object references** — mutating a link also mutated a previously captured export. File save was already safe (`JSON.stringify` at click).  
   **Fix:** `serialize()` returns `JSON.parse(JSON.stringify(data))`.  
   **Retest:** `stillFrozen` stayed true while live `closed` flipped; import restored snapshot. **pass**

3. **Bridge scenario did not close a span** (name vs state).  
   **Fix:** North Bridge `closed = true` on load (after screenshot `24-bridge.png`).  
   **Retest of the closed-on-load default:** **not-run** after the last HTML edit (closure behavior itself was proven on Harbor Pkwy).

4. **Inspector stole focus every 250 ms** while editing phases.  
   **Fix:** skip `inspectorHTML()` rebuild when focus is inside the inspector.

5. **Automatic signal split ran every tick** (`city.time % 8 > dt`).  
   **Fix:** edge-trigger on 8 s boundaries.

No uncaught page errors in `agent-browser errors` / `console` during the interaction pass.

---

## Remaining limitations

- Audio is a low-gain procedural hum after a user gesture; **no listening evaluation** was done.
- Transit transfers are at most one transfer; there is no walking access model beyond nearest-stop snap.
- Roundabouts are yield-at-entry circles, not geometrically circulating lanes.
- Agents are individual vehicles with a population cap (~900 medium / ~1600 large), not flow packets.
- Named-scenario UI depends on `prompt()`.
- Six curated scenarios were not opened in this browser pass (they are implemented).
- After the late North-Bridge-closed default, that specific load was not re-screenshoted.

---

## Self-test (`window.MetroSim.selfTest()`)

| Name | Result |
|---|---|
| segment-cross | pass |
| route-exists | pass |
| oneway-blocks-ba | pass |
| bad-import-throws | pass |
