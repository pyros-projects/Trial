# Research trail — The Capstone: Build the Unexpected

Access date for all live lookups: **2026-09-08**.
Tools used: Cursor `WebSearch` and `WebFetch` (full-page reads, not snippets alone).

## Queries and sources

### Search queries (WebSearch)

1. `graphic statics funicular form finding interactive hanging chain structures`
2. `cam follower mechanism designer interactive displacement diagram polar inversion`
3. `Penrose tiling interactive construction matching rules inflation deflation quasicrystal`
4. `cylindrical anamorphosis interactive drawing tool Hans Holbein mirror anamorphosis`
5. `computational caustic design freeform reflector interactive envelope of reflected rays`
6. `four-bar linkage coupler curve synthesis interactive mechanism design Peaucellier`
7. `Block Research Group graphic statics form and force diagram reciprocal Maxwell Cremona`
8. `Schek force density method form finding cable nets 1974`

### Pages opened and read (full content)

**1. Algebraic Graph Statics** — T. Van Mele & P. Block, *Computer-Aided Design* preprint.  
URL: https://block.arch.ethz.ch/brg/files/2014-cad-vanmele-algebraic-graph-statics-preprint_1397824709.pdf  
Domain: `block.arch.ethz.ch`  
Tool: WebSearch (full page saved).

- **Sourced facts:** Graphic statics represents a planar structure as a *form diagram* and its equilibrium as a reciprocal *force diagram* (Maxwell 1864; Cremona 1872). Corresponding lines are parallel; a closed polygon in one diagram matches concurrent edges at a vertex in the other; edge length in the force diagram is force magnitude. Algebraic Graph Statics writes that reciprocity with graph incidence matrices and shows it is equivalent to the equilibrium equations of a self-stressed bar net. A computational back-end can build a force diagram from a connected line drawing without a structure-specific geometric “recipe.”
- **Inferences:** A single-file studio can treat “draw a hanging net, read its force diagram” as one system rather than a canned animation of one truss.
- **Design influence:** Bidirectional form/force as the central interaction; closed force polygons as the live correctness check.

**2. Graphic Statics overview** — COMPAS 3gs documentation, Block Research Group.  
URL: https://blockresearchgroup.github.io/compas_3gs/latest/overview/00_graphic_statics.html  
Domain: `blockresearchgroup.github.io`  
Tool: WebFetch.

- **Sourced facts:** 2D graphic statics uses reciprocal form and force diagrams with the same number of lines; lines concurrent at a point in one diagram form a closed polygon in the other. Interactive implementations (including the BRG teaching platform eQuilibrium) let designers manipulate force geometry as a design driver, not only as a post-analysis plot. 3D extensions use polyhedral cells whose face areas are force magnitudes — out of scope for a 2D HTML file.
- **Inferences:** The distinctive teaching move is *force-driven* form, e.g. moving a pole / thrust, not only dragging a rope.
- **Design influence:** A first-class force slate with a draggable pole that changes horizontal thrust and therefore the hanging shape.

**3. PolyFrame, Efficient Computation for 3D Graphic Statics** — A. Nejur & M. Akbarzadeh, *Computer-Aided Design* 134 (2021).  
URL: https://par.nsf.gov/servlets/purl/10209861  
Domain: `par.nsf.gov`  
Tool: WebSearch (full page saved).

- **Sourced facts:** Hooke (1675) showed that a hanging chain is a tension-only funicular; inverted, the same geometry is compression-only if buckling is ignored. Gaudí used hanging-chain models for the Sagrada Família. Numerical substitutes include particle–springs, the force density method, and dynamic relaxation. Graphic statics is presented as the *geometric* alternative to those “black box” solvers: form and force stay visible and reciprocal. PolyFrame itself is a Rhino plugin for 3D polyhedral reciprocal diagrams.
- **Inferences:** The hanging-model metaphor is the most widely understood entry to funicular design; inversion is not a visual effect, it is the structural claim.
- **Design influence:** Seed a hanging chapel/chain; Invert is a primary control; disclose that this is axial-only equilibrium, not a buckling or masonry-code check.

**4. Force Densities Method** — compas-FoFin theoretical background.  
URL: https://blockresearchgroup.gitbook.io/compas-fofin/theoretical-background/force-densities-method  
Domain: `blockresearchgroup.gitbook.io`  
Tool: WebFetch.

- **Sourced facts:** Schek (1974) defined force density `q = F/L`. Substituting `q` linearizes node equilibrium: `Σ q_j (x_j − x_0) = p`. With topology, fixed nodes, loads, and prescribed `q`, free coordinates solve as one linear system `A x = b` with `A = C_iᵀ Q C_i`. The method was motivated by the Munich Olympic roofs, where physical models were no longer precise enough.
- **Inferences:** For an interactive net, FDM is the right real-time solver: dense Gaussian elimination on tens of joints is enough; no iterative physics timestep is required for the hanging shape.
- **Design influence:** Implement FDM directly; map pole/thrust to `q` on a chain via `q = H / Δx`; report residual and reactions from `R = Dx − p`.

**5. An extended force density method for form finding of constrained cable nets** — G. Aboul-Nasr & S. A. Mourad, *Case Studies in Structural Engineering* 3 (2015).  
URL: https://www.sciencedirect.com/science/article/pii/S2214399815000041  
Domain: `sciencedirect.com`  
Tool: WebFetch.

- **Sourced facts:** Linear FDM needs topology, support coordinates, and `q`; it does not need the free-node geometry in advance. Distribution of force densities (more than their overall scale) governs shape. A pin-jointed cable is assumed weightless except for applied joint loads. Constraints (fixed lengths, target coordinates) make the problem nonlinear.
- **Inferences:** A first version should stay linear: user edits supports, joint plan positions, loads, and `q`/thrust — not cable rest lengths.
- **Design influence:** Pin plan-`x` of hanging joints so dragging a weight sideways is a plan edit; solve `y` (and fully free joints in both axes). Stay axial-only; do not pretend to size sections.

**6. Penrose Tiling — Quasi-Periodic Patterns** — mysimulator.uk.  
URL: https://www.mysimulator.uk/penrose-tiling/  
Domain: `mysimulator.uk`  
Tool: WebFetch.

- **Sourced facts:** Penrose P2/P3 tilings cover the plane without translational period; matching-rule arrows forbid periodicity; P3 deflation replaces thick/thin rhombi at scale `φ⁻¹`; thick:thin → `φ`. Conway worms / Ammann bars are global strip families with Fibonacci spacings.
- **Inferences:** Existing web demos are mostly *generators* (deflate a seed), not construction benches with forcing.
- **Design influence:** Kept as candidate 2, not the chosen build.

**7. Investigating the Effectiveness of Penrose Tilings as a Model of Quasicrystals** — mathematics extended essay, mrbertman.com.  
URL: http://www.mrbertman.com/EE/penrose.pdf  
Domain: `mrbertman.com`  
Tool: WebSearch (full page saved).

- **Sourced facts:** Kite/dart matching can be vertex colors or Conway arcs. Local matching does **not** guarantee an infinite legal tiling; a legal placement can still dead-end later (the empire/forcing problem). Inflation/deflation scales lengths by `φ`.
- **Design influence:** If this candidate were chosen, the product would be forcing and dead-ends, not another deflation animation.

Additional pages used for *prior-art mapping* of other candidates (read enough to characterize products, not used as implementation recipes): MechSimulator cam-follower tool (`mechsimulator.com`); MotionGen / MechSim / PMKS+ linkage apps; AnaMorph-It and Anamorph Me! anamorphosis software; High-contrast Computational Caustic Design (theialab.ca PDF).

---

## Three candidate concepts

### A. Ut Pendet — hanging funicular workshop *(chosen)*
**Purpose:** Let someone hang weights on a pin-jointed net, watch the unique funicular form appear, read forces from a reciprocal diagram, and invert the hanging model into a compression vault.  
**Central interaction:** Edit supports, hanging joints, loads, and a force-diagram pole (horizontal thrust); the solver recomputes equilibrium and both diagrams together.

### B. The Empire Table — Penrose matching-rule bench
**Purpose:** Let someone place kite/dart (or rhomb) tiles under matching rules and discover forced neighbors, dead-ends, and inflation.  
**Central interaction:** Click a legal ghost tile; the system fills the empire of forced placements or reports a vertex that cannot be completed.

### C. Rise & Dwell — disk-cam atelier
**Purpose:** Let someone author a 360° motion program (dwell/rise/return + motion law) and obtain a cam profile, SVAJ plots, pressure-angle warnings, and a live follower animation.  
**Central interaction:** Edit motion segments and follower geometry; the profile is synthesized by kinematic inversion.

---

## Choice

Chose **A. Ut Pendet**.

- **Interest:** Hooke’s line and Gaudí’s attic models are famous as photographs and almost never offered as a thing you can *re-hang* with a live force diagram.
- **Distance from Trial:** Not a cloth/rope playground, not a CAD shape editor, not a scheduler. The product is structural form-finding with reciprocal diagrams.
- **Substance:** Linear force-density equilibrium plus a Cremona-style force diagram that must close.
- **Feasibility:** Dense linear solve on a small net; SVG; no network; fits one HTML file.

Rejected B because nearby web work already *shows* Penrose tilings, and the forcing/empire solver is easy to get subtly wrong. Rejected C because browser cam/linkage ateliers (MechSimulator, MotionGen, PMKS+) already occupy that product shape.

### Closest Trial brief

**#4 Deformable Physics** (cloth, rope, balloon, grabbing, cutting, tearing).

Difference: that brief is a *soft-body playground*. Ut Pendet does not simulate collisions, cutting, or material strain. Joints are pins; members carry axial force only; the hanging shape is the solution of Schek’s linear system; the second canvas is a reciprocal force diagram whose edge lengths *are* the forces. Inverting is a structural operation (tension funicular ↔ compression funicular), not a visual filter.

### Closest related work found

- **eQuilibrium / interactive AGS** (Block Research Group) and **compas-FoFin** (force density in CAD).
- **PolyFrame** (Rhino, 3D polyhedral GS).
- **PushMePullMe 3D** (Expedition Workshed): real-time beam/cable physics, including hanging-chain tutorials.

Difference: those are CAD plugins, physics engines, or teaching platforms for many structure types. This file is a *hanging-model workshop*: brass weights, invert-to-vault, pole-as-thrust, project import/export, no Rhino/Grasshopper. It is a distinctive contribution to *this* Trial collection, not a claim of a world first.

---

## Behavioral commitments (recorded before implementation)

1. **User does:** Change a support, a hanging joint’s plan position, a load, or the force-diagram pole, including on a net that is not the built-in example.
2. **System must:** Recompute pin-jointed equilibrium with the force-density method, update member forces and support reactions, and redraw a force diagram in which corresponding segments are parallel to form members and lengths scale with |F|. Node force polygons close within a small residual when the solve succeeds.
3. **How we tell it worked:** A heavier weight deepens sag (or a closer pole / larger thrust shallows it); invert turns the same geometry into a compression vault with forces preserved; a custom extra joint+cable still solves rather than replaying a preset morph.

### Scope notes (filled during/after build)

- Original commitments remain in force and were all met in the delivered `index.html`.
- Approximation (disclosed in-app): linear FDM with `q = F/L`, axial-only, no buckling, no masonry friction, no section design. Uniform `q` on a chain with vertical loads produces a *polygonal funicular* (parabola-like for equal loads), not a true continuous catenary of uniform self-weight.
- No commitments were dropped.
