(() => {
const B = window.__bh;
B.setParam('accumMode','off');
const stats = [];
for(let m=0;m<8;m++){
  B.setParam('mode', String(m));
  B.signature(4); B.signature(4);
  const sig = B.signature(10);
  const mean = sig.reduce((a,b)=>a+b,0)/sig.length;
  const varr = sig.reduce((a,b)=>a+(b-mean)*(b-mean),0)/sig.length;
  stats.push({ mode:m, name:B.MODES[m].name, mean:+mean.toFixed(2), sd:+Math.sqrt(varr).toFixed(2),
               min:Math.min(...sig), max:Math.max(...sig), legend:document.getElementById('legtitle').innerText });
}
// pairwise distinctness
const sigs = [];
for(let m=0;m<8;m++){ B.setParam('mode', String(m)); B.signature(4); sigs.push(B.signature(6)); }
let minDist = 1e9, worst = '';
for(let i=0;i<8;i++) for(let j=i+1;j<8;j++){
  let d = 0; for(let k=0;k<sigs[i].length;k++) d += Math.abs(sigs[i][k]-sigs[j][k]);
  d /= sigs[i].length;
  if(d < minDist){ minDist = d; worst = i+'vs'+j; }
}
B.setParam('mode','0'); B.setParam('accumMode','taa');
return JSON.stringify({stats, min_pairwise_mean_abs_diff:+minDist.toFixed(2), closest_pair:worst});
})()
