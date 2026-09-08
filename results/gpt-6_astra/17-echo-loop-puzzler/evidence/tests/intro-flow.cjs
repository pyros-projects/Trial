const {connect}=require('./browser.cjs');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const b=await connect();try{
 const begin=await b.state();assert.equal(begin.world.frame,0);assert.equal(begin.audio.state,'running');
 await b.hold('ArrowRight',s=>s.world.player.x>=296);await b.frames(20);await b.press('KeyP');let s=await b.state();assert.equal(s.world.channels.A,true);assert.ok(s.world.objects.find(o=>o.id==='door-a').open);const original=s;fs.writeFileSync('evidence/logs/intro-plate.json',JSON.stringify(s,null,2));
 console.log('PASS real held ArrowRight activated A at',s.world.frame,'x',s.world.player.x);
 await b.press('KeyR');s=await b.state();assert.equal(s.echoCount,1);await b.until(s=>s.world.frame>=original.world.frame+12);await b.press('KeyP');s=await b.state();assert.equal(s.world.channels.A,true);assert.equal(s.world.player.x,96);assert.ok(Math.abs(s.world.actors[0].x-original.world.player.x)<.01);assert.equal(s.world.divergence.length,0);fs.writeFileSync('evidence/logs/intro-echo.json',JSON.stringify(s,null,2));console.log('PASS echo repeats plate action independently; divergence 0; echo x',s.world.actors[0].x);
 }finally{b.close()}})().catch(e=>{console.error(e);process.exit(1)});
