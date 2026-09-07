const { readPNG } = require('/home/pyro/projects/naked/opus5/01-fluid-simulation/evidence/tools/pngdiff.js');
const A = readPNG(process.argv[2]);
const [x0,y0,x1,y1] = [300,80,940,720];
let r=0,g=0,b=0,n=0;
for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const i=(y*A.width+x)*A.channels; r+=A.data[i]; g+=A.data[i+1]; b+=A.data[i+2]; n++; }
console.log('meanRGB = ' + [r/n,g/n,b/n].map(v=>v.toFixed(1)).join(', '));
