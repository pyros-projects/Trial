# Public validation checks: Real-Time 2D Fluid Simulation

Inject momentum and dye with several slow and rapid pointer drags and confirm that the flow persists, advects, mixes, and responds to drag direction and speed. Switch among dye and diagnostic visualization modes while the simulation is running. Change viscosity and vorticity enough to produce observable behavioral differences. Verify that clear dye removes dye without silently resetting all velocity state, that pause and resume work, and that reset restores a valid initial state.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.
