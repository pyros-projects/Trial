const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),ctx={};vm.createContext(ctx);vm.runInContext(html.match(/<script id="scene-core">([\s\S]*?)<\/script>/)[1],ctx);
assert.equal(typeof ctx.SceneCore.srgbToLinear,'function','sRGB colors must be converted before linear-light shading');
const gray=ctx.SceneCore.srgbToLinear('#808080');for(const c of gray)assert.ok(Math.abs(c-.2158605)<1e-6);
const coral=ctx.SceneCore.srgbToLinear('#cd805f');assert.ok(Math.abs(coral[0]-.6104956)<1e-6);assert.ok(Math.abs(coral[2]-.1144354)<1e-6);
console.log('PASS: material input colors use the sRGB transfer function');
