import { CDP, sleep } from './cdp.mjs';
const c = await CDP.attach(process.argv[2], 'index.html');
const J = async (e) => JSON.parse(await c.evalJS('JSON.stringify((()=>{const P=window.__pulse;' + e + '})())'));
// snapshot the full simulation state at exactly tick 600 of every run
await c.evalJS(`(()=>{const P=window.__pulse;
  if(!P.sim.__probe){const so=P.sim.step.bind(P.sim);
    P.sim.step=function(m,x,y){so(m,x,y);
      if(P.sim.tick===600){let bs=0,n=0;
        for(let i=0;i<2600;i++){const b=P.sim.bullets[i];if(b&&b.alive){n++;bs+=b.x*3+b.y*5+b.vx+b.vy;}}
        window.__snap={tick:600,checksum:P.sim.checksum>>>0,bullets:n,fieldSum:+bs.toFixed(4),
          bossX:+P.sim.boss.x.toFixed(6),bossY:+P.sim.boss.y.toFixed(6),
          bossHp:+P.sim.boss.hp.toFixed(3),rng:P.sim.rngCalls,
          px:+P.sim.player.x.toFixed(6),py:+P.sim.player.y.toFixed(6),
          score:P.game.score,graze:P.game.graze,lives:P.game.lives};}};
    P.sim.__probe=1;}
  return 1})()`);
const run = async (seed, diff) => {
  await c.evalJS(`(()=>{const P=window.__pulse;window.__snap=null;P.S.seed="${seed}";P.S.seedLock=true;
    P.S.difficulty="${diff}";P.S.adaptive=false;P.S.lives=9;P.S.pointer=false;P.S.autofire=false;
    P.startRun("run");return 1})()`);
  let s = null, g = 0;
  while (!s && g++ < 60) { await sleep(200); s = await c.evalJS('window.__snap ? JSON.stringify(window.__snap) : null'); }
  return JSON.parse(s);
};
const a1 = await run('12345', 'normal');
const a2 = await run('12345', 'normal');
const b1 = await run('99999', 'normal');
const c1 = await run('12345', 'lunatic');
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
console.log(JSON.stringify({
  seed12345_run1: a1, seed12345_run2: a2, seed99999: b1, seed12345_lunatic: c1,
  verdict: {
    sameSeedByteIdenticalAtTick600: eq(a1, a2),
    differentSeedProducesDifferentField: a1.fieldSum !== b1.fieldSum && a1.checksum !== b1.checksum,
    difficultyChangesDensity: c1.bullets !== a1.bullets,
  }
}, null, 1));
c.close();
