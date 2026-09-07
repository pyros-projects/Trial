const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').match(/<script id="probe-analysis">([\s\S]*?)<\/script>/);
assert.ok(s,'Windowed dominant-frequency estimator must exist');vm.runInThisContext(s[1]);
function signal(fn,end=18){let t=0,a=[];while(t<end){a.push({t,v:fn(t)});t+=.008+(.003*(a.length%5));}return a;}
for(const [name,fn,window,want,tolerance] of [
 ['single tone with uneven timesteps',t=>Math.sin(2*Math.PI*1.4*t),5,1.4,.03],
 ['dominant tone in a two-frequency signal with DC offset',t=>2+.7*Math.sin(2*Math.PI*1.25*t)+.2*Math.sin(2*Math.PI*2.8*t),5,1.25,.035],
 ['slow source with longer analysis window',t=>Math.sin(2*Math.PI*.2*t),15,.2,.008],
 ['higher harmonic must not alias into a false low frequency',t=>Math.sin(2*Math.PI*12*t),15,12,.03]
]){const a=signal(fn),got=estimateDominantFrequency(a,a.at(-1).t,window);assert.ok(Math.abs(got-want)<tolerance,`${name}: expected ${want}, measured ${got}`);console.log('PASS',name,got);}
assert.equal(estimateDominantFrequency(signal(()=>0),17,5),null);console.log('PASS silent probe has no invented frequency');
