// Browser-side checks used during validation (paste into agent-browser eval, or rely on LogicLab).
// Not a runtime dependency of index.html.
(function simChecks(L) {
  const out = {};
  L.loadPreset("half");
  out.half11 = { sum: L.portValue("ledS", "d"), cry: L.portValue("ledC", "d") };
  L.toggleSwitch("swA");
  out.half01 = { sum: L.portValue("ledS", "d"), cry: L.portValue("ledC", "d") };
  L.undo();
  out.undoA = L.S.comps.find((c) => c.id === "swA").props.value;
  L.redo();
  out.redoA = L.S.comps.find((c) => c.id === "swA").props.value;
  L.loadPreset("counter");
  L.resetSim(false);
  L.clockEdge();
  L.clockEdge();
  L.clockEdge();
  out.counter = L.portValue("ct", "q");
  L.loadPreset("cpu");
  for (let i = 0; i < 5; i++) L.clockEdge();
  out.cpu = { tick: L.S.sim.tick, out: L.portValue("out", "q"), pc: L.portValue("pc", "q") };
  return out;
})(window.LogicLab);
