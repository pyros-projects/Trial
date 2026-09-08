const B = window.__bh;
B.P.adaptive = false;
B.setParam('adaptive', false);
function fix(scale){ B.P.renderScale = scale; B.setParam('renderScale', scale); }
function timeIt(label, n){
  const t0 = performance.now();
  for(let i=0;i<n;i++) B.signature(2);
  return {label, ms:+( (performance.now()-t0)/n ).toFixed(1), W:B.R.W, H:B.R.H};
}
fix(0.25);
const out = [];
// warm
B.signature(2);
out.push(timeIt('baseline', 5));
const savedIn = B.P.diskIn, savedOut = B.P.diskOut;
B.P.diskIn = 200; B.P.diskOut = 201;               // disk never intersected
out.push(timeIt('no-disk', 5));
B.P.diskIn = savedIn; B.P.diskOut = savedOut;
const savedSteps = B.P.maxSteps;
B.P.maxSteps = 20;
out.push(timeIt('maxSteps=20', 5));
B.P.maxSteps = savedSteps;
const savedOct = B.P.octaves; B.P.octaves = 1;
out.push(timeIt('octaves=1', 5));
B.P.octaves = savedOct;
B.P.diskIn = 200; B.P.diskOut = 201; B.P.maxSteps = 20;
out.push(timeIt('no-disk+20steps (sky only)', 5));
B.P.diskIn = savedIn; B.P.diskOut = savedOut; B.P.maxSteps = savedSteps;
B.P.adaptive = true; B.setParam('adaptive', true);
JSON.stringify(out);
