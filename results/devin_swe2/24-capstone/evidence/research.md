# Research — The Capstone: Build the Unexpected

Date: 2026-09-29. Tools used: `web_search` (queries below), `webfetch` (pages below).
All pages listed were actually opened and read through `webfetch`; search-result
snippets were used only as leads, never as "read" sources.

## Searches run

- `web_search`: "Physarum polycephalum network design Tero Tokyo rail slime mold optimization"
- `web_search`: "Jeff Jones Physarum agent-based simulation characteristics pattern formation"
- `web_search`: "interactive slime mold simulation web demo physarum transport network"

## Sources read

1. **Tero et al. (2010), "Rules for Biologically Inspired Adaptive Network Design", Science** — abstract
   surfaced via search (`science.org/doi/10.1126/science.1177894`), plus the full National Geographic
   write-up below. Learned: real Physarum links food sources with tubular networks whose
   **cost / transport-efficiency / fault-tolerance** trade-off is comparable to engineered
   infrastructure (Tokyo rail). This three-axis trade-off is the product hook: it's exactly what a
   network *engineering* instrument should measure. (Sourced fact.)

2. **National Geographic — "Slime mould attacks simulates Tokyo rail network" (Ed Yong, 2010)**
   `https://www.nationalgeographic.com/science/article/slime-mould-attacks-simulates-tokyo-rail-network`
   Read in full. Facts used: oat flakes at city positions around Tokyo Bay; Physarum avoids light,
   so Tero used **illuminated regions to simulate prohibitive terrain**; the mould first forms a
   dense web, then prunes to a few strong tubes; Tero's accompanying model is a lattice of tubes
   whose conductivity adapts to flux. Design influence: light = "terrain" became the repellent-paint
   tool; "grow dense then prune" is the emergent dynamic the sim must reproduce; fault tolerance as
   first-class metric.

3. **Jeff Jones — arXiv:1511.05869 "Mechanisms Inducing Parallel Computation in a Model of
   Physarum polycephalum Transport Networks"** — `https://arxiv.org/abs/1511.05869` (abstract page read;
   HTML full-text render failed, noted). Facts used: the multi-agent model is programmable via
   *intrinsic* parameters (sensor angle, rotation angle, scaling) and *environmental* mechanisms
   (stimulus location/distance/concentration, **nutrient engulfment and consumption**, simulated
   light irradiation, repellents, obstacles). Design influence: these are precisely my tool set —
   food nodes (attractant), light paint (repellent), walls (obstacles), nutrient consumption so the
   organism keeps shuttling instead of camping.

4. **ABC Tools — "Slime Mould Networks"** `https://abc.tools/sim/slime-mold/` (read in full).
   Closest-featured prior art #1: CPU/browser Jones-model toy — 3-sensor steering, trail
   deposit/diffuse/decay, parameter sliders, click to drop an attractant blob, PNG export, palettes.
   It is a *pattern toy*: there are no persistent nodes, no extracted graph, no metrics, no notion of
   a network "solving" anything. Also notes parameter balance (deposit vs decay+diffuse) governs
   whether networks form at all.

5. **Amanda Ghassaei — GPU Physarum (gpu-io example)** `https://apps.amandaghassaei.com/gpu-io/examples/physarum/`
   (read). Prior art #2: canonical GPU implementation of Jones model + Sage Jenson parameters; same
   pattern-toy scope (attractant blobs, parameter menu, video record). No analysis layer.

6. **Kody Wildfeuer — "Physarum Rediscovers the Tokyo Subway Map"** `https://kody-w.github.io/learnwithkody/examples/slime-mold/`
   (read). Prior art #3: WebGL2 transform-feedback 100k-particle demo with a Tokyo preset and
   click-to-place food; cites Jones' parameter values (sensor distance ~12, sensor angle ~22°,
   turn angle ~28°, decay ~0.955). Still a "watch it happen" demo: no graph extraction, no metrics,
   no fault injection, no editing of the result.

7. **xHayden/physarum** `https://hayden.gg/physarum/` (read). Prior art #4: CPU fork of Nicolas
   Barradeau's implementation; documents parameter names (SA, RA, SO, SS) and food-source attraction
   over a geographic map. Closest to "food-driven network", but geography-mapped and read-only —
   again no network science.

## Three candidate concepts

1. **Slime-mould network foundry (chosen).** Purpose: let the user *design transport networks by
   programming an organism* — place food "cities", terrain and light, grow the network, then
   interrogate it like an engineer (extracted graph, cost/efficiency/fault metrics, cut lines and
   watch self-repair). Central interaction: place/configure the dish → grow → analyse → wound →
   observe healing, in a loop.
2. **Mechanical clockwork / escapement lab.** Purpose: design a running watch — gear trains,
   escapement geometry, beat rate, isochronism error. Central interaction: assemble tooth counts and
   pallet geometry, run, read timing diagnostics. Rejected: correct escapement contact simulation is
   high-risk in one file and one budget; failure mode is a broken physics toy.
3. **Handweaving draft simulator.** Purpose: author threading/tie-up/treadling drafts and watch the
   woven cloth emerge. Central interaction: edit a draft matrix, weave. Rejected: honest and pretty,
   but deterministic-draft rendering is thinner technically, and several mature web tools already
   occupy it.

**Choice rationale:** candidate 1 wins on surprise (you design a problem, a single cell designs the
solution), technical substance (agent-based stigmergic field + graph extraction + network metrics +
fault injection), and distance from the 23 covered briefs. Feasibility: the Jones model is a
well-characterised ~30-line agent update; the analysis layer is ordinary graph algorithms.

## Difference from covered tasks and prior art

- **Closest Trial task:** #20 *City Traffic and Transit* — there the user *draws* roads/transit and
  the system measures flow on the drawn network. Here the user never draws a link: the network is
  *grown* by a simulated organism responding to attractants/terrain, and the instrument measures the
  emergent result (length, detour, redundancy, self-repair). Different primary interaction
  (programming a growth substrate vs. laying infrastructure) and different system (field
  computation vs. traffic simulation). Second-closest: #14 *Evolutionary Ecosystem* — no sensing
  agents with heritable traits, reproduction, or lineage exist here; the agents are a reusable
  computing medium, not a population under selection.
- **Closest researched work:** the Ghassaei / ABC Tools / Wildfeuer / Barradeau-family Physarum
  demos. All share the same loop — drop attractant, tune parameters, admire emergent pattern. None
  extract a graph from the living field, none quantify the cost/efficiency/fault-tolerance
  trade-off that is the actual scientific point of Tero et al., and none treat damage/repair as an
  experiment. My contribution is the *instrumentation and experiment loop* on top of the standard
  model — a network-engineering workbench, not a pattern toy. I claim a distinctive contribution to
  this collection and its nearby literature, not a world first.

## Behavioural commitments (pre-implementation)

1. **Grow-and-connect.** With ≥3 food nodes placed (or a preset loaded) and the simulation running,
   a persistent vein network forms and, within a reasonable time, the analysis panel reports all
   reachable food nodes connected (e.g. "7/7 connected"). Verify via screenshot of the field plus
   the connectivity readout and extracted-graph overlay.
2. **Measure what grew.** An analysis step computes real metrics from the *current* trail field —
   skeletonised network length, mean path detour vs straight-line distance, redundancy (non-bridge
   edge share), and comparison against the Euclidean minimum spanning tree of the food nodes.
   Numbers must change when nodes are added/moved or the network changes — no canned values.
3. **Wound and self-repair.** A cut stroke (trail erasure + transient repellent) or a new wall
   measurably disconnects the network (connectivity count drops), and with the simulation left
   running the organism re-routes so connectivity recovers — visible in the field and the readout.

Supporting requirements honoured in design: authored edits (nodes/walls/light) are undoable;
presets are editable like user input; JSON import/export (validated) + PNG export; whole-session
Reset; pause/step; agent-count quality control; pointer + keyboard; usable at 390px width; no
storage, no network, no audio.

## Scope changes during implementation

(none yet — will be appended honestly if the commitments are narrowed)
