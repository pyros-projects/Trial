const TAU=2*Math.PI;
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
for(let len=2;len<=n;len<<=1){const half=len>>1;for(let i=0;i<n;i+=len)for(let k=0;k<half;k++){const c=Math.cos(TAU*k/len),s=-Math.sin(TAU*k/len),a=i+k,b=a+half;const xr=re[b]*c-im[b]*s,xi=re[b]*s+im[b]*c;re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi;}}}
function est(x,Ts){const N=x.length;let mean=0;for(const v of x)mean+=v;mean/=N;const re=new Float64Array(N),im=new Float64Array(N);
for(let k=0;k<N;k++)re[k]=(x[k]-mean)*(0.5-0.5*Math.cos(TAU*k/(N-1)));fft(re,im);const mag=[];let best=1;for(let k=0;k<N/2;k++){mag[k]=Math.hypot(re[k],im[k]);if(k>=1&&mag[k]>mag[best])best=k;}
const y0=Math.log(mag[best-1]),y1=Math.log(mag[best]),y2=Math.log(mag[best+1]);const d=0.5*(y0-y2)/(y0-2*y1+y2);return (best+d)/(N*Ts);}
const Ts=0.0026;
for (const N of [512,1024,2048]) { const x=[];for(let k=0;k<N;k++)x.push(Math.sin(TAU*18*k*Ts+0.3)); console.log(N, est(x,Ts).toFixed(4)); }
// with a turn-on ramp at the start
for (const N of [512,1024]) { const x=[];for(let k=0;k<N;k++){const t=k*Ts; x.push(t<0.4?0:Math.min(1,(t-0.4)/0.1)*Math.sin(TAU*18*t));} console.log('ramp',N, est(x,Ts).toFixed(4)); }
