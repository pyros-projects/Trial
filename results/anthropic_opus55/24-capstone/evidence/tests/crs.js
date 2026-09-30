const src=require('fs').readFileSync(require('path').join(__dirname,'core-extract.js'),'utf8');const G=new Function(src+';return Geo;')();
const [a,b,c,d]=process.argv.slice(2).map(Number);console.log(Math.round(G.rhumbTo(a,b,c,d).crs));
