// replicate solver: Dirichlet box (inner Lx,Ly) on grid dx=1/340, impulse at centre, record at antinode, FFT peaks
const ny=340, dx=1/ny, c=1, dt=1.3e-3, C2=(c*dt/dx)**2;
const Lx=0.81, Ly=0.55;
// build grid just around box: cells with centre inside box are free
const ix=Math.round(Lx/dx)+4, iy=Math.round(Ly/dx)+4;
const NX=ix+2, NY=iy+2;
const cx=NX*dx/2, cy=NY*dx/2;
const free=new Uint8Array(NX*NY);
for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const x=(i+0.5)*dx,y=(j+0.5)*dx; if(Math.abs(x-cx)<Lx/2&&Math.abs(y-cy)<Ly/2) free[j*NX+i]=1;}
let u=new Float32Array(NX*NY), up=new Float32Array(NX*NY);
const si=Math.floor(cx/dx), sj=Math.floor(cy/dx);
// count interior cells
let l=si,r=si; while(free[sj*NX+l])l--; while(free[sj*NX+r])r++;
let t=sj,b=sj; while(free[t*NX+si])t--; while(free[b*NX+si])b++;
console.log('scan', r-l, b-t, 'Leff', (r-l)*dx, (b-t)*dx);
const pi=Math.round((cx-Lx/2+Lx*5/14)/dx), pj=Math.round((cy-Ly/2+Ly*5/14)/dx);
const T=12, nsteps=Math.round(T/dt), rec=new Float64Array(nsteps);
for(let n=0;n<nsteps;n++){
  for(let j=1;j<NY-1;j++)for(let i=1;i<NX-1;i++){const k=j*NX+i; if(!free[k]){up[k]=0;continue;} const v=u[k]; up[k]=2*v-up[k]+C2*(u[k-1]+u[k+1]+u[k-NX]+u[k+NX]-4*v);}
  const tt=n*dt; const s=Math.exp(-0.5*((tt-0.03)/0.008)**2); up[sj*NX+si]+=C2*12*s;
  const tmp=u;u=up;up=tmp; rec[n]=u[pj*NX+pi];
}
// DFT around 6-9 Hz
const out=[];
for(let f=6.0; f<=9.0; f+=0.005){let re=0,im=0; for(let n=0;n<nsteps;n++){const w=0.5-0.5*Math.cos(2*Math.PI*n/(nsteps-1)); re+=rec[n]*w*Math.cos(2*Math.PI*f*n*dt); im+=rec[n]*w*Math.sin(2*Math.PI*f*n*dt);} out.push([f,Math.hypot(re,im)]);}
// local maxima
const pk=[]; for(let k=1;k<out.length-1;k++) if(out[k][1]>out[k-1][1]&&out[k][1]>out[k+1][1]) pk.push(out[k]);
pk.sort((a,b)=>b[1]-a[1]); console.log(pk.slice(0,12).map(p=>p[0].toFixed(3)+':'+p[1].toFixed(3)).join('  '));
// analytic discrete (7,7)
const Lxe=(r-l)*dx, Lye=(b-t)*dx; const kx=7*Math.PI/Lxe, ky=7*Math.PI/Lye; const Cc=c*dt/dx;
console.log('pred (7,7)', (2/dt)*Math.asin(Cc*Math.sqrt(Math.sin(kx*dx/2)**2+Math.sin(ky*dx/2)**2))/(2*Math.PI));
