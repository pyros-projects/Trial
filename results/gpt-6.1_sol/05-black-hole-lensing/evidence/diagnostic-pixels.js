(()=>{
const S=Lensing.getState(),P=Physics;
if(S.pendingRender)throw new Error('Wait for the requested frame first');
if(S.accumulation)throw new Error('Use unjittered pixels for a numerical comparison');
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const heat=t=>t<.33?mix([.06,.12,.3],[.08,.67,.72],t*3.03):t<.66?mix([.08,.67,.72],[.98,.78,.29],(t-.33)*3.03):mix([.98,.78,.29],[.95,.19,.11],(t-.66)*2.94);
const samples=[[.7,.4],[.28,.32],[.5,.5]].map(([x,y])=>{
const [w,h]=S.dimensions,ix=Math.floor(x*w),iy=Math.floor((1-y)*h),u=(ix+.5)/w,v=1-(iy+.5)/h;
const r=Lensing.tracePixel(u,v);let expected;
if(S.mode===1)expected=heat(r.steps/S.settings.steps);
if(S.mode===2)expected=heat(Math.min(r.deflection/Math.PI,1));
if(S.mode===5)expected=heat(1-Math.min(r.closest/(S.settings.horizon*12),1));
if(S.mode===3){const g=r.hit?.total;expected=g===undefined?[.012,.023,.03]:g<1?mix([.94,.26,.13],[.65,.68,.68],Math.min(g,1)):mix([.65,.68,.68],[.12,.7,1],Math.min((g-1)*2,1));}
expected=expected.map(z=>Math.round(Math.pow(z,.8)*255));const observed=Lensing.getPixel(x,y).slice(0,3),error=Math.max(...observed.map((z,i)=>Math.abs(z-expected[i])));
return {pixel:[ix,iy],uv:[u,v],steps:r.steps,deflection:r.deflection,closest:r.closest,g:r.hit?.total,expected,observed,maxChannelError:error,pass:error<=10};
});return {mode:S.mode,glError:S.glError,samples,pass:samples.every(x=>x.pass)};
})();
