const assert=require('node:assert/strict');const {evaluate}=require('./browser-lib.cjs');
const p=evaluate('({state:phase.getState(), velocity:+document.getElementById("step-velocity").value,lfo:+document.getElementById("inst-lfoRate").value})');
assert.equal(p.velocity,p.state.tracks[0].steps[0].velocity,'Selected velocity slider must represent the actual preset velocity');
assert.equal(p.lfo,p.state.tracks[0].lfoRate,'LFO slider must represent the actual preset rate');
console.log('PASS: preset values are represented exactly by their controls');
