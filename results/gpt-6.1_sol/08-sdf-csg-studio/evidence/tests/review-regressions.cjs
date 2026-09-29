const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),ctx={};vm.createContext(ctx);vm.runInContext(html.match(/<script id="scene-core">([\s\S]*?)<\/script>/)[1],ctx);const C=ctx.SceneCore;
let failed=0;
function test(name,fn){try{fn();console.log('PASS',name)}catch(e){failed++;console.log('FAIL',name,e.message)}}
test('color array is rejected before scene replacement',()=>{const s=C.makeScene([C.makeObject('sphere',1)]);s.objects[0].material.color=['#aabbcc'];assert.throws(()=>C.parse(JSON.stringify(s)),/color/i)});
test('render cap preserves portrait and landscape aspect',()=>{const dimensions=html.match(/function dimensions\(\)\{([^\n]+)\}/)[0];for(const [width,height,dpr,res]of [[1200,700,1,2],[1200,700,2,2],[390,600,2,2],[390,600,1,1]]){const env={viewport:{getBoundingClientRect:()=>({width,height})},window:{devicePixelRatio:dpr},scene:{settings:{resolution:res}}};vm.createContext(env);vm.runInContext(dimensions,env);const [w,h]=env.dimensions();assert.ok(w<=2048&&h<=2048);assert.ok(Math.abs(w/h-width/height)<.004,`${width}x${height} became ${w}x${h}`)}});
process.exitCode=failed?1:0;
