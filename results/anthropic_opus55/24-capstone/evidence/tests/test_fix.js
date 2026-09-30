const fs=require('fs');const src=fs.readFileSync(process.argv[2]||__dirname+'/core-extract.js','utf8');const X=new Function(src+';return {Geo,solveFix};')();
const Geo=X.Geo,solveFix=X.solveFix; const truth=[31.25,-62.95];
// synthetic LOPs through truth from 3 azimuths with 1 nm errors; AP 20 nm off
const mk=(Zn,err,sig)=>{const ap=[31.5,-63.2];const [x,y]=Geo.toXY(ap,truth[0],truth[1]);const u=[Math.sin(Zn*Math.PI/180),Math.cos(Zn*Math.PI/180)];return {ap,Zn,intercept:u[0]*x+u[1]*y+err,sig};};
let r=solveFix([mk(30,0),mk(150,0),mk(270,0)],[31.5,-63.2]); console.log('exact 3 LOPs err nm',Geo.gc(...r.pos,...truth).d.toFixed(3),'ellipse',r.ellipse.a.toFixed(2),r.ellipse.b.toFixed(2),'cut',r.cut.toFixed(0));
r=solveFix([mk(30,1),mk(150,-1),mk(270,0.5)],[31.5,-63.2]); console.log('noisy 3 LOPs err',Geo.gc(...r.pos,...truth).d.toFixed(2),'ellipse',r.ellipse.a.toFixed(2),r.ellipse.b.toFixed(2),'sigma',r.sigma.toFixed(2));
r=solveFix([mk(30,0),mk(45,0)],[31.5,-63.2]); console.log('poor cut 15deg: ellipse',r.ellipse.a.toFixed(1),'x',r.ellipse.b.toFixed(1),'cut',r.cut.toFixed(0));
r=solveFix([mk(30,0),mk(31,0)],[31.5,-63.2]); console.log('near-parallel ->',JSON.stringify(r));
r=solveFix([mk(96,0,Math.hypot(1,0.8*5.3)),mk(175,0,1)],[31.5,-63.2]); console.log('running fix 5.3h advance ellipse',r.ellipse.a.toFixed(1),'x',r.ellipse.b.toFixed(1));
