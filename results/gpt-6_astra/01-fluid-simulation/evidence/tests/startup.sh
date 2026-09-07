#!/usr/bin/env bash
set -eu
agent-browser --session flux eval --stdin <<'JS'
(() => {
  if (!window.fluidLab || !window.fluidLab.ready) throw new Error('FAIL: a running fluid solver is required');
  const s = window.fluidLab.inspect();
  if (!s.finite || s.dyeMass <= 0 || s.kineticEnergy <= 0) throw new Error('FAIL: startup must contain finite, moving dye: '+JSON.stringify(s));
  return {check:'finite moving startup', status:'pass', state:s};
})()
JS
