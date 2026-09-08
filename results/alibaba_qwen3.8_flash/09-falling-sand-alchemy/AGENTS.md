# Notes for agents working on this project

## The one hard rule

`index.html` at the repo root is the product, and it must stay a single file
that works offline. Do not hand-edit it: it is generated. Edit `src/*` and run
`python3 evidence/build.py`.

```
src/shell.html   markup; contains /*__STYLE__*/ and /*__SIM__*/ markers
src/style.css
src/sim.js       engine — must stay free of any DOM reference
src/ui1.js       rendering and view modes
src/ui2.js       presets + main loop
src/ui3.js       input wiring, persistence
evidence/build.py
```

`build.py` swaps `/*__STYLE__*/` for style.css and the `/*__SIM__*/
/*__UI__*/` pair for sim.js + ui1–ui3, all inside one `<script>` tag. The
whole thing is one global scope, so a name added in `sim.js` is visible in the
UI files. Add new globals to only one file.

## Verifying a change

```
./evidence/run-node-tests.sh   # 32 engine assertions, no browser, ~5 s
./evidence/browser-check.sh    # real Chrome, both viewports, ~5 min
python3 evidence/build.py && git diff --stat index.html
```

Commit `index.html` only after rebuilding, so the artefact and `src/` never
drift apart.

### Testing the engine without a browser

`evidence/run-node-tests.sh` concatenates `src/sim.js` and
`evidence/test-sim.js` and runs the result under Node. This works because the
engine never touches the DOM. If you add a feature to `sim.js`, add a test:
the harness has `allocWorld/w/srand/putRaw/rect/discFill/run/count/ok/head`
helpers, and everything is seeded, so a failing test is reproducible.

### Testing behaviour in the page

`window.FSA` (end of `src/ui3.js`) is the automation handle. Useful bits:
`stats`, `cell(x,y)`, `region(x0,y0,x1,y1)`, `paint`, `drag`, `mode`,
`set(tool, material)`, `hash()` (a hash of the canvas pixels), `step(n)`,
`pause(v)`, `preset(name)`, `encode`/`load`.

`browser-check.sh` compares `hash()` before and after an action to prove the
picture actually changed. Two gotchas learned the hard way:

- Rendering happens in `requestAnimationFrame`. `FSA.step()` is synchronous, so
  take the "before" hash, step, wait for at least one frame, then take the
  "after" hash — otherwise you compare two identical frames.
- The script checks that `window.FSA` still exists before and after the long
  load soak. That is how it catches the page dying quietly.

## Things that will bite you

- **Chunk bookkeeping.** Only cells in "active" 16×16 chunks are simulated.
  Any code that moves a cell must wake both the source and the destination
  chunk, and only once per cell per tick. Getting this wrong freezes whole
  regions with no error.
- **Two kinds of fire.** `isSmould(i)` (bit 1 of `flags`) means a cell is
  burning from the inside; a `FIRE` cell is a free flame. Fuel that is fully
  surrounded still has to burn, so flames may exist at zero surrounding air —
  do not "fix" that back.
- **Heat is double buffered.** `passHeat` writes into `temp2` and swaps.
  Physics reads post-diffusion temperature. Do not reorder the passes without
  re-running the tests.
- **Fire propagation uses a generation stamp** (`stamp`/`gen`) so a single
  step's ignition cascade cannot re-burn a cell later in the same tick.
- **Typed arrays are sized to the grid.** The Resolution slider reallocates
  them; anything cached from an old buffer is then stale.
- **`P` is shared with the panel.** Slider ranges are in `shell.html`, names
  and formatting in `PARAM_MAP` in ui3.js, defaults in `sim.js`. Change all
  three or the UI lies.
- The headless test browser has no GPU and `deviceScaleFactor` 1. The measured
  budget is a 319×251 grid at 60 fps. Check `window.FSA.stats` after a 45 s
  soak before claiming something is fast enough.

## Style

Plain functions, `const`/`let`, semicolons, no modules, no `import`, no
framework. Comments explain *why*, especially where a number is a tuning
constant. Keep the engine header comment in `src/sim.js` honest when the model
changes — it is the documentation for the simulation.

## Machine limits (from the user's global instructions)

Do not start heavy CPU/GPU work, or anything expected to use more than 23 GB
of VRAM or pin CPUs near 100 % for more than 10 minutes, without asking first.
