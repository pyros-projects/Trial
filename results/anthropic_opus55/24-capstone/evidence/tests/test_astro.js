const fs=require('fs');
eval(fs.readFileSync(__dirname+'/data-extract.js','utf8')+fs.readFileSync(__dirname+'/core-extract.js','utf8')+';globalThis.A={Astro,Geo,reduceSight,solveFix,swingAngle,NAV_STARS};');
const {Astro,NAV_STARS}=A;
const dm=x=>{const s=x<0?'-':'';x=Math.abs(x);let d=Math.floor(x),m=(x-d)*60;if(m>=59.95){d++;m=0}return s+d+'°'+m.toFixed(1).padStart(4,'0')+"'";};
const ms=Date.UTC(2021,8,10,19,0,0);
const F=Astro.frame(ms);
const ref={aries:[275+1.7/60],sun:{gha:105+48.1/60,dec:4+38/60,hc:45+22.2/60,zn:225.7},
 stars:{Arcturus:[145+50.7/60,19+4.5/60,65+35.9/60,144.6],Vega:[80+34.9/60,38+48.5/60,30+28.1/60,62.9],Polaris:[315+2.8/60,89+21.0/60,39+22.8/60,359.6],Dubhe:[193+45.1/60,61+38.2/60,60+25.7/60,328.1],Capella:[280+25.9/60,46+1.0/60,11+20.5/60,322.1],Antares:[112+19.2/60,-(26+28.7/60),9+50.7/60,137.4],Schedar:[349+33.6/60,56+39.2/60,6+55.4/60,5.0],Spica:[158+25.4/60,-(11+16.3/60),38+43.5/60,177.4]}};
const lat=39+58/60, lon=-(75+32/60);
let worst=0;const rows=[];
const cmp=(label,mine,refv)=>{const d=(((mine-refv+540)%360)-180)*60;worst=Math.max(worst,Math.abs(d));rows.push(`${label.padEnd(22)} mine ${dm(mine).padStart(11)}  Astron ${dm(refv).padStart(11)}  diff ${d.toFixed(2)}'`);};
cmp('GHA Aries',F.gast,ref.aries[0]);
cmp('Sun GHA',F.sun.gha,ref.sun.gha); cmp('Sun Dec',F.sun.dec,ref.sun.dec);
const sa=Astro.altAz(F.sun.gha,F.sun.dec,lat,lon); cmp('Sun Hc',sa.h,ref.sun.hc); rows.push(`Sun Zn mine ${sa.az.toFixed(1)} Astron ${ref.sun.zn}`);
for(const [n,[sha,dec,hc,zn]] of Object.entries(ref.stars)){const st=NAV_STARS.find(s=>s[0]===n);const a=Astro.starApparent(F,st[2],st[3],st[4],st[5]);cmp(n+' SHA',a.sha,sha);cmp(n+' Dec',a.dec,dec);const h=Astro.altAz(a.gha,a.dec,lat,lon);cmp(n+' Hc',h.h,hc);rows.push(`${n} Zn mine ${h.az.toFixed(1)} Astron ${zn}  diff ${(h.az-zn).toFixed(2)}`);}
console.log(rows.join('\n'));
console.log('dip 3.0 m =',(Astro.dip(3)*60).toFixed(2),"' (Astron -3.1')");
console.log('Bennett refraction at Ha=49.94 =',(Astro.refrBennett(49+56.1/60)*60).toFixed(2),"' (Astron -0.8')");
console.log('SD sun',(F.sun.sd*60).toFixed(2),"' (Astron 15.9')");
console.log('WORST angular diff (arcmin):',worst.toFixed(2));
