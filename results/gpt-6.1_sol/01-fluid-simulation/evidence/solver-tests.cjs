// Real numerical tests: removing projection, advection, diffusion, confinement,
// or making clearDye reset velocity must break the corresponding assertion.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const path = require('node:path');
const file = path.join(__dirname, '..', 'index.html');
const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const source = html.match(/<script id="fluid-cpu">([\s\S]*?)<\/script>/)?.[1];
test('standalone artifact contains the usable fallback fluid engine', () => {
  assert.ok(source, 'FluidCPU numerical engine is not implemented');
});
if (source) {
  const scope = {};
  vm.createContext(scope);
  vm.runInContext(source + '\nthis.Engine = FluidCPU;', scope);
  const Engine = scope.Engine;
  const defaults = {viscosity:0, pressureIterations:50, vorticity:0, velocityDecay:0, dyeDecay:0};
  const energy = f => Array.from(f.u).reduce((s,v,i)=>s+v*v+f.v[i]*f.v[i],0);
  test('pressure projection reduces divergence of an injected jet', () => {
    const f = new Engine(48,36);
    f.splat(.42,.55,80,-25,[1,.2,.1],.08);
    const before = f.stats().divergenceRMS;
    f.project(60);
    assert.ok(f.stats().divergenceRMS < before*.8, 'projection must reduce RMS divergence by at least 20%');
  });
  test('clear dye preserves every velocity value', () => {
    const f = new Engine(32,24);
    f.splat(.4,.5,45,20,[1,.3,.2],.1);
    const u = Array.from(f.u), v = Array.from(f.v);
    f.clearDye();
    assert.deepEqual(Array.from(f.u),u);
    assert.deepEqual(Array.from(f.v),v);
    assert.equal(f.stats().dyeMass,0);
    assert.ok(f.stats().kineticEnergy>0);
  });
  test('transported dye follows positive horizontal fluid velocity', () => {
    const f = new Engine(48,32);
    f.splat(.3,.5,0,0,[1,0,0],.06);
    f.u.fill(8);
    const centroid = () => {
      let sum=0, weighted=0;
      f.r.forEach((v,i)=>{sum+=v;weighted+=v*(i%f.w);});
      return weighted/sum;
    };
    const start=centroid();
    f.advectDye(.25,0);
    assert.ok(centroid()>start+1.7,'8 cells/s for 0.25 s should move dye about two cells');
  });
  test('viscosity dissipates high-frequency momentum', () => {
    const f = new Engine(40,32);
    f.u.forEach((_,i)=>f.u[i]=i%2 ? 10:-10);
    const before=energy(f);
    f.diffuseVelocity(.1,.003);
    assert.ok(energy(f)<before*.6,'viscosity must reduce alternating-velocity energy');
  });
  test('vorticity confinement changes a non-uniform swirling field', () => {
    const f = new Engine(48,36);
    f.splat(.4,.4,90,35,[.3,1,.5],.07);
    f.splat(.55,.62,-40,-90,[1,.1,.4],.1);
    const start=Array.from(f.u);
    f.applyVorticity(.016,30);
    assert.ok(start.some((v,i)=>Math.abs(v-f.u[i])>.01),'curl force must affect velocity');
  });
  test('boundary splats and high settings stay finite through repeated steps', () => {
    const f = new Engine(40,28);
    f.splat(0,0,500,-500,[1,1,1],.01);
    f.splat(1,1,-500,500,[.1,1,.5],.15);
    for(let i=0;i<100;i++)f.step(.033,{...defaults,viscosity:.003,vorticity:50,velocityDecay:.1,dyeDecay:.02});
    assert.equal(f.stats().finite,true);
    assert.ok(f.stats().dyeMass>=0);
  });
}
