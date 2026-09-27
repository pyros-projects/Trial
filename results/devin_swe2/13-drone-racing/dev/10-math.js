// ================= math =================
const V3={
 c:(x=0,y=0,z=0)=>new Float32Array([x,y,z]),
 set:(o,x,y,z)=>{o[0]=x;o[1]=y;o[2]=z;return o},
 copy:(o,a)=>{o[0]=a[0];o[1]=a[1];o[2]=a[2];return o},
 add:(o,a,b)=>{o[0]=a[0]+b[0];o[1]=a[1]+b[1];o[2]=a[2]+b[2];return o},
 sub:(o,a,b)=>{o[0]=a[0]-b[0];o[1]=a[1]-b[1];o[2]=a[2]-b[2];return o},
 scale:(o,a,s)=>{o[0]=a[0]*s;o[1]=a[1]*s;o[2]=a[2]*s;return o},
 mad:(o,a,b,s)=>{o[0]=a[0]+b[0]*s;o[1]=a[1]+b[1]*s;o[2]=a[2]+b[2]*s;return o},
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross:(o,a,b)=>{const x=a[1]*b[2]-a[2]*b[1],y=a[2]*b[0]-a[0]*b[2],z=a[0]*b[1]-a[1]*b[0];o[0]=x;o[1]=y;o[2]=z;return o},
 len:a=>Math.hypot(a[0],a[1],a[2]),
 norm:(o,a)=>{const l=Math.hypot(a[0],a[1],a[2])||1;o[0]=a[0]/l;o[1]=a[1]/l;o[2]=a[2]/l;return o},
 dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),
};
const QT={
 ident:()=>new Float32Array([0,0,0,1]),
 copy:(o,a)=>{o[0]=a[0];o[1]=a[1];o[2]=a[2];o[3]=a[3];return o},
 mul:(o,a,b)=>{const ax=a[0],ay=a[1],az=a[2],aw=a[3],bx=b[0],by=b[1],bz=b[2],bw=b[3];
  o[0]=aw*bx+ax*bw+ay*bz-az*by; o[1]=aw*by-ax*bz+ay*bw+az*bx;
  o[2]=aw*bz+ax*by-ay*bx+az*bw; o[3]=aw*bw-ax*bx-ay*by-az*bz; return o},
 conj:(o,a)=>{o[0]=-a[0];o[1]=-a[1];o[2]=-a[2];o[3]=a[3];return o},
 norm:(o,a)=>{const l=Math.hypot(a[0],a[1],a[2],a[3])||1;o[0]=a[0]/l;o[1]=a[1]/l;o[2]=a[2]/l;o[3]=a[3]/l;return o},
 axisAngle:(o,ax,ay,az,ang)=>{const s=Math.sin(ang/2);o[0]=ax*s;o[1]=ay*s;o[2]=az*s;o[3]=Math.cos(ang/2);return o},
 fromYawPitchRoll:(o,yaw,pitch,roll)=>{ // about Y, then X, then Z
  const cy=Math.cos(yaw/2),sy=Math.sin(yaw/2),cp=Math.cos(pitch/2),sp=Math.sin(pitch/2),cr=Math.cos(roll/2),sr=Math.sin(roll/2);
  o[3]=cy*cp*cr+sy*sp*sr; o[0]=cy*sp*cr+sy*cp*sr;
  o[1]=sy*cp*cr-cy*sp*sr; o[2]=cy*cp*sr-sy*sp*cr; return o},
 rot:(o,q,v)=>{ // rotate vec3 by quat
  const qx=q[0],qy=q[1],qz=q[2],qw=q[3],x=v[0],y=v[1],z=v[2];
  const tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);
  o[0]=x+qw*tx+qy*tz-qz*ty; o[1]=y+qw*ty+qz*tx-qx*tz; o[2]=z+qw*tz+qx*ty-qy*tx; return o},
 rotInv:(o,q,v)=>{const c=[-q[0],-q[1],-q[2],q[3]];return QT.rot(o,c,v)},
 integrate:(o,q,wx,wy,wz,dt)=>{ // w in body frame
  const hx=wx*dt/2,hy=wy*dt/2,hz=wz*dt/2;
  const qx=q[0],qy=q[1],qz=q[2],qw=q[3];
  o[0]=qx+hx*qw+hy*qz-hz*qy; o[1]=qy-hx*qz+hy*qw+hz*qx;
  o[2]=qz+hx*qy-hy*qx+hz*qw; o[3]=qw-hx*qx-hy*qy-hz*qz;
  return QT.norm(o,o)},
};
const M4={
 ident:o=>{o.fill(0);o[0]=o[5]=o[10]=o[15]=1;return o},
 mul:(o,a,b)=>{ // column-major o=a*b
  const r=new Float32Array(16);
  for(let c=0;c<4;c++)for(let w=0;w<4;w++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+w]*b[c*4+k];r[c*4+w]=s}
  o.set(r);return o},
 persp:(o,fovy,asp,n,f)=>{o.fill(0);const t=1/Math.tan(fovy/2);
  o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o},
 ortho:(o,l,r,b,t,n,f)=>{o.fill(0);o[0]=2/(r-l);o[5]=2/(t-b);o[10]=-2/(f-n);o[15]=1;
  o[12]=-(r+l)/(r-l);o[13]=-(t+b)/(t-b);o[14]=-(f+n)/(f-n);return o},
 lookAt:(o,eye,c,up)=>{ // view matrix
  let zx=eye[0]-c[0],zy=eye[1]-c[1],zz=eye[2]-c[2];
  let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
  let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
  l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
  const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  o[0]=xx;o[1]=yx;o[2]=zx;o[3]=0;o[4]=xy;o[5]=yy;o[6]=zy;o[7]=0;o[8]=xz;o[9]=yz;o[10]=zz;o[11]=0;
  o[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);o[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
  o[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);o[15]=1;return o},
 fromQT:(o,q,p)=>{ // model matrix from quat+pos
  const x=q[0],y=q[1],z=q[2],w=q[3],x2=x+x,y2=y+y,z2=z+z;
  const xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  o[0]=1-(yy+zz);o[1]=xy+wz;o[2]=xz-wy;o[3]=0;
  o[4]=xy-wz;o[5]=1-(xx+zz);o[6]=yz+wx;o[7]=0;
  o[8]=xz+wy;o[9]=yz-wx;o[10]=1-(xx+yy);o[11]=0;
  o[12]=p[0];o[13]=p[1];o[14]=p[2];o[15]=1;return o},
 compose:(o,p,q,sx,sy,sz)=>{ // TRS
  M4.fromQT(o,q,p);o[0]*=sx;o[1]*=sx;o[2]*=sx;o[4]*=sy;o[5]*=sy;o[6]*=sy;o[8]*=sz;o[9]*=sz;o[10]*=sz;return o},
};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const D2R=Math.PI/180, R2D=180/Math.PI;
const finite3=v=>Number.isFinite(v[0])&&Number.isFinite(v[1])&&Number.isFinite(v[2]);
// seeded RNG (mulberry32)
function RNG(seed){let a=seed>>>0||1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
 t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// seeded 2D value noise
function makeNoise(seed){
 const perm=new Uint8Array(512);const r=RNG(seed);const p=[...Array(256).keys()];
 for(let i=255;i>0;i--){const j=(r()*(i+1))|0;[p[i],p[j]]=[p[j],p[i]]}
 for(let i=0;i<512;i++)perm[i]=p[i&255];
 const h=(x,y)=>perm[(perm[x&255]+y)&255]/255;
 return(x,y)=>{
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
  const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  return lerp(lerp(h(xi,yi),h(xi+1,yi),u),lerp(h(xi,yi+1),h(xi+1,yi+1),u),v)*2-1}
}
function fbm(noise,x,y,oct){let s=0,a=1,f=1,n=0;for(let i=0;i<oct;i++){s+=noise(x*f,y*f)*a;n+=a;a*=.5;f*=2.03}return s/n}
const $=id=>document.getElementById(id);
function toast(msg,ms=2600){const t=$('toast');t.textContent=msg;t.style.display='block';
 clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',ms)}
function fmtT(t){if(!Number.isFinite(t))return'--:--.--';const m=Math.floor(t/60),s=t-m*60;
 return(m<10?'0':'')+m+':'+(s<10?'0':'')+s.toFixed(2)}
