# Cinderline validation

Agent-authored record of checks against the live `index.html` application. Statuses are pass / fail / blocked / not-run. No evaluator score is claimed.

- Artifact: `/home/pyro/projects/naked/grok46/11-factory-automation/index.html` (single self-contained file)
- Browser tool: `agent-browser` (core + dogfood skill loaded before use)
- HTTP inspect: `python3 -m http.server 8876 --bind 127.0.0.1` from the working directory
- Sessions: `--session factory` (HTTP), `--session filecheck` (`file:`)
- Viewports: 1280×800 and 390×844 (also 1100×700 resize mid-run)

## Environment

| Check | Status | Notes |
| --- | --- | --- |
| `agent-browser` available | pass | CLI used for navigate, snapshot, click, mouse, fill, press, eval, screenshot, console, errors, network |
| Local HTTP server | pass | `127.0.0.1:8876` |
| External network from the app | pass | Request log only shows `GET /` document loads plus browser `favicon.ico` 404 on HTTP. No CDN, fonts, images, or XHR. Artifact grep finds no `http(s)://` fetches. |
| Cached external resources | pass | Page is one HTML file; no third-party URLs to cache |
| `file:` protocol | pass | Opened `file:///home/pyro/projects/naked/grok46/11-factory-automation/index.html`; sim ran and delivered plates |

## Commands used (representative)

```bash
agent-browser skills get core
agent-browser --session factory set viewport 1280 800
agent-browser --session factory open http://127.0.0.1:8876/
agent-browser --session factory wait --fn "window.Cinderline && Cinderline.state.delivered.plate >= 1"
agent-browser --session factory snapshot -i
agent-browser --session factory screenshot evidence/screenshots/05-starter-after-fix.png
agent-browser --session factory click "#btnPause"
agent-browser --session factory click "#btnStep"
agent-browser --session factory check "#ovFlow"
agent-browser --session factory select "#presetSel" "congested"
agent-browser --session factory set viewport 390 844
agent-browser --session filecheck open file:///home/pyro/projects/naked/grok46/11-factory-automation/index.html
agent-browser --session factory console
agent-browser --session factory errors
agent-browser --session factory network requests
```

Pointer construction used labeled tool buttons plus `PointerEvent` dispatch on `#world` (and earlier `mouse move/down/up` on canvas coordinates). Simulation diagnostics used `window.Cinderline` (live factory state, not hardcoded fixtures).

## Public workflow checks

### 1. Default starter produces immediately

- **Status:** pass
- **Steps:** Open app (sandbox + starter line). Wait until `Cinderline.state.delivered.plate >= 1` / inspect HUD.
- **Observed:** Extractor → belts → smelter (`plate`) → belts → sink. Generator consuming coal. Power 150 / 58 at 100% sat. Example HUD: FPS ~60, items moving, 4 machines working / 0 stalled, plates delivered. Screenshot `05-starter-after-fix.png`.
- **file: retest:** tick 262, produced ore 7 / coal 7 / plate 2, delivered plate 1, power 150/58. Screenshot `12-file-protocol-running.png`.

### 2. Item movement, recipes, power

- **Status:** pass
- **Observed:** Discrete items on belts (letters O/C/P). Smelter recipe `plate` (1 ore → 1 plate). Balanced preset later produced wire and circuits (`plate+wire` two-input recipe) and delivered 4 circuits after 800 ticks. Power supply/demand come from generators and machine `_demand`; unpowered machines halt (`status==="unpowered"` when net sat is 0). Stress preset ran at sat ~0.54 with machines still working slower, not a cosmetic bar.

### 3. Blocking / backpressure

- **Status:** pass
- **Steps:** Click labeled **Delete tool**, canvas-click the sink at (4,12). Wait until smelter status is `blocked`.
- **Observed:** Delivery rate dropped to empty. Smelter `blocked` with `outBuf.plate=6`. Downstream belts util 1.0 / status blocked. HUD stall 1. Bottleneck list named blocked belts and the smelter. Screenshot `04-bottleneck-sink-deleted.png`.
- **Undo:** labeled **Undo** restored the sink; smelter returned to `working`; delivery rate became non-zero again.

### 4. Belt rotation, deletion, copy

- **Status:** pass
- **Steps:** Canvas-click smelter (inspector showed recipe/status). Labeled **Rotate selected** changed dir 1→2. Keyboard `r` rotated back to south. **Upgrade selected** set tier 2. Delete tool removed the sink (above). Copy tool on the smelter set `copyGhost.type==="smelter"` and switched the active tool.

### 5. Splitter, merger, inserter

- **Status:** pass (splitter live; merger/inserter placed and used in presets)
- **Steps:** Labeled Belt / Splitter / Merger / Inserter tools + pointer down/move/up on the canvas.
- **Observed:** Belts appeared at (5–8,10). Splitter, merger, inserter placed. Splitter rotated 0→1. Later, replacing belt (4,10) with a splitter in the live plate line moved plates onto the west output (`westItems: [plate,plate,plate]`, splitter held a plate, status blocked when the unused east side had no belt).
- **Balanced preset:** merger + splitter in the circuit line; 4 circuits delivered. Bus preset uses inserters (wire produced).
- **Limitation:** East splitter output was empty in the ad-hoc insert until a belt existed there — expected routing, not a sim bug.

### 6. Pause, single-step, speed

- **Status:** pass
- **Steps:** Labeled **Pause** → button reads Resume, `paused===true`, tick frozen (241 stayed 241 after 400ms). Two **Step** clicks advanced tick 241→243. Speed slider changed `S.speed` (observed 2.25× after fill).
- **Deterministic:** `stepOnce` at 1× and 4× for 90 ticks produced the same plate count (2 and 2). Wall-clock speed only changes how many fixed 1/30s slices run per frame; it does not duplicate items.

### 7. Save / reload exact factory state

- **Status:** pass
- **JSON snapshot:** `snapshot()` → `applySnap()` kept tick, time, delivered counts, and building/item arrays identical.
- **Share code:** `CL1.` round-trip restored tick 1023 and plate deliveries after loading a blank yard.
- **Named slots:** While paused, `#btnSlotSave` then blank preset (`buildings:0, tick:0`) then `#btnSlotLoad` restored tick 275, delivered `{plate:1}`, produced totals, and 30 buildings (`match: true`).
- **Invalid import:** `"not-json"` and `{"v":9}` rejected without crashing (`Unsupported version` / JSON parse error).
- **Autosave:** writes `localStorage` key `cinderline-auto` every 15s (not separately click-tested).
- **PNG:** `canvas.toDataURL` present; labeled PNG button exists. File download was not captured in this headless session (download path not-run).

### 8. Curated presets after viewport resize

- **Status:** pass
- **Steps:** `loadPreset('balanced')`, wait until ore produced, screenshot, `set viewport 1100 700`, then `390 844`.
- **Observed:** After resize, power still 150/160 (94% sat), items 13–14, ore/coal production continuing, FPS ~60, 4 machines working. Mobile layout stacked tools horizontally (`tools.scrollWidth=1000`) and compacted inspector (`inspectH≈106`). Screenshots `07-balanced-preset.png`, `08-balanced-resized.png`, `09-mobile-390x844.png`.
- Preset production after hundreds of ticks (eval suite):

| Preset | Produced | Delivered | Power sat | Notes |
| --- | --- | --- | --- | --- |
| starter | ore/coal/plate | plates | 1.00 | default demo |
| balanced | ore/plate/wire/circuit | circuits | 0.94 | two-input recipe |
| congested | ore/coal/plate | plates | 1.00 | belt backup intended |
| powercrisis | ore/plate/wire | wire | 0.91 | mild brownout |
| bus | ore/plate/wire | none in 800 ticks | 0.63 | items move; circuit sink starved |
| stress | ore/coal/plate | plates | 0.54 | high demand, still running |

UI `select "#presetSel" "congested"` also started producing ore/coal (screenshot `13-congested-preset.png`).

### 9. Campaign / sandbox loop

- **Status:** pass
- **Observed:** Mode → Campaign set `budget=220`, `costMode=budget`, `spent=122`, mission 0 “First Plate”. Sandbox stays free. Missions 2–5 exist in the selector; they start from the starter plate line and expect the player to extend the factory. Completion scoring was not wait-tested to the 20-plate contract in the browser (would take ~30s+ of live time) — **not-run** for the win modal. Logic is the same delivery counter already observed.

### 10. Overlays, analytics, HUD, inspector

- **Status:** pass
- **Observed:** Flow / Power / Congestion checkboxes set `S.overlay` flags. Inspector populated on smelter select (recipe dropdown, rotate/upgrade/delete). Sparklines render. Rates box showed `+/−` per item and bottleneck text. HUD includes FPS, tick, speed, items, operating/stalled machines, power supply/demand, delivery rate, tool, objective.

### 11. Console / uncaught errors

- **Status:** pass
- `agent-browser console` and `errors` were empty on the HTTP session (`evidence/logs/console-http.txt`, `errors-http.txt`). Reload after later edits still produced plates with no new error channel output.

### 12. Audio

- **Status:** pass (enablement only)
- First canvas pointer gesture set `Cinderline.state.audioOn===true` (Web Audio context). Sounds were not listened to; quality is **not claimed**.

### 13. Desktop and narrow viewports

- **Status:** pass
- 1280×800: full chrome, factory visible, labeled controls usable. 390×844: tools wrap to a horizontal scroller, inspector shrinks, sim keeps ticking. Continuous belt drawing vs pan: pan tool / Shift / middle-button / two-finger path implemented; two-finger touch pinch was **not-run** on a physical touch device.

## Fixes during validation

1. **Preset power islands** — random rocks and short pole range left extractors on a net with no generator (`net:true` but sat 0 → `unpowered`). Fix: `P()` clears obstacles; `stitchPower()` walks poles from consumers to generators. Retest: no unpowered machines on any curated preset; balanced delivered circuits.
2. **Balanced circuit routing** — first layout sent gear+wire into a circuit assembler (wrong recipe inputs). Fix: splitter fans plates to a wire assembler and a plate belt, both feeding the circuit machine.
3. **`setPointerCapture` on synthetic events** — threw and aborted `onDown`. Wrapped in try/catch so tests and some browsers keep working.
4. **Slot buttons covered by the footer** on 1280×800 (`#btnSlotSave` click intercepted). Fix: inspect column `overflow:hidden` + scrolling pad. Retest: paused slot save/load `match: true`.
5. **Pointer construction after session drops** — long `wait` timeouts sometimes recycled the browser. Retried by reopening the URL; not an app defect.

## Remaining limitations

- Multi-product bus produces plates/wire but did not deliver circuits in an 800-tick sample (inserter/bus tap is weak). Still a live factory, not a static picture.
- Campaign win modal / score screen not exercised to completion in the browser.
- PNG and JSON file downloads exist as labeled buttons; the harness did not capture the saved files.
- Touch pinch-zoom and two-finger pan were not tested on real hardware.
- `stitchPower()` adds extra poles; the yard looks denser than a hand-authored bus.
- Browser still requests `/favicon.ico` on HTTP (404). The file embeds a data-URI icon; this is not an app runtime dependency.
- Audio quality was not heard.

## Screenshot index

| File | What it shows |
| --- | --- |
| `screenshots/01-starter-desktop.png` | Early starter desktop (session later recycled) |
| `screenshots/02-smelter-selected.png` | Inspector after canvas-selecting the smelter |
| `screenshots/03-rotate-upgrade.png` | After rotate + T2 upgrade |
| `screenshots/04-bottleneck-sink-deleted.png` | Backpressure after sink deletion |
| `screenshots/05-starter-after-fix.png` | Working starter, 1280×800 |
| `screenshots/06-overlays-paused-step.png` | Overlays + pause/step |
| `screenshots/07-balanced-preset.png` | Balanced two-input factory |
| `screenshots/08-balanced-resized.png` | Same factory after viewport resize |
| `screenshots/09-mobile-390x844.png` | Narrow viewport, sim still live |
| `screenshots/10-help-modal.png` | Help dialog |
| `screenshots/11-file-protocol.png` | `file:` load |
| `screenshots/12-file-protocol-running.png` | `file:` delivering plates |
| `screenshots/13-congested-preset.png` | Congested belts preset from the UI |
