const assert=require('node:assert/strict');const {select,state}=require('./browser-lib.cjs');
select('Instrument polyphony','4');assert.equal(state().tracks[0].poly,4);
select('LFO destination','pitch');assert.equal(state().tracks[0].lfoRoute,'pitch');
select('Delay time','0.5');assert.equal(state().fx.delay.division,.5);
console.log('PASS: instrument and effect select changes reach project state');
