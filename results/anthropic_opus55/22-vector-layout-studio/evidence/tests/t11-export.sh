#!/usr/bin/env bash
# Check 11: scene-derived preview and exports (downloaded files inspected on disk)
source "$(dirname "$0")/../ab.sh"
field() { $AB scrollintoview "[data-field=$1]" >/dev/null; $AB fill "[data-field=$1]" "$2" >/dev/null; $AB press Enter >/dev/null; $AB press Escape >/dev/null; }
ly() { $AB scrollintoview "#layers .lrow[data-id=$1] $2" >/dev/null; $AB click "#layers .lrow[data-id=$1] $2" >/dev/null; }
D=$PWD/evidence/downloads; PNG="node $PWD/evidence/tools/png.js"
fresh
echo "== 11a edits: sun fill, a Bézier handle, title text, hide halo, reorder birds to back"
ly sky .twist; ly sun .lname; field fill '#39c0a0'
ly far .lname; $AB scrollintoview '[data-field=pt-a-x]' >/dev/null; $AB click "button[aria-label='Next point']" >/dev/null; field pt-out-y 500
ly title .lname; $AB scrollintoview '#insText' >/dev/null; $AB click '#insText' >/dev/null; $AB press Control+a >/dev/null; $AB keyboard type 'EQUINOX' >/dev/null; $AB press Control+Enter >/dev/null
ly halo .vis
ly birds .lname; $AB click '#lyBack' >/dev/null
echo "   history: $(diag 'd.history.labels')"
echo "== 11b preview is rendered from the SVG export"
$AB click '#btnPreview' >/dev/null; $AB wait 300 >/dev/null
echo "   preview: $($AB eval '(()=>{const i=document.getElementById("previewImg");return i.naturalWidth+"x"+i.naturalHeight+" src="+i.src.slice(0,5)+" "+document.getElementById("previewInfo").textContent})()')"
$AB screenshot evidence/screens/11-preview.png >/dev/null; $AB press Escape >/dev/null
echo "== 11c SVG"
rm -f $D/t11.svg; $AB download '#btnExportSVG' $D/t11.svg >/dev/null
python3 - $D/t11.svg <<'PY'
import sys,re,xml.etree.ElementTree as ET
s=open(sys.argv[1]).read(); r=ET.fromstring(s); N='{http://www.w3.org/2000/svg}'
tags={}; [tags.__setitem__(e.tag.replace(N,''),tags.get(e.tag.replace(N,''),0)+1) for e in r.iter()]
print('   root', r.get('width'), r.get('height'), r.get('viewBox'), '| elements', tags)
print('   background rect first:', [c for c in r][1].tag.replace(N,''), [c for c in r][1].get('fill'))
print('   contains EQUINOX:', 'EQUINOX' in s, '| SOLSTICE gone:', 'SOLSTICE' not in s, '| sun fill #39c0a0:', '#39c0a0' in s)
print('   halo (stroke #ffb35c ellipse) absent:', not any(e.get('stroke')=='#ffb35c' for e in r.iter(N+'ellipse')))
d=[e.get('d') for e in r.iter(N+'path')]; print('   cubic path data (first):', d[0][:90] if d else None, '| all paths cubic:', all(' C' in x for x in d))
print('   far ridge carries edited handle y=500:', any('C330 500' in x or ' 500 ' in x for x in d))
kids=[c for c in r]; order=[ (c.tag.replace(N,''), c.get('fill')) for c in kids[2:5]]; print('   first painted items after bg:', order)
bad=[a for e in r.iter() for a in e.attrib if a.lower().startswith('on') or a in ('href','{http://www.w3.org/1999/xlink}href','data-id','data-handle','class')]
print('   forbidden (script/foreignObject/image/on*/href/data-*/class):', [t for t in tags if t in ('script','foreignObject','image','a','use')] + bad, '| url( refs:', 'url(' in s)
PY
echo "== 11d PNG 1x and 2x"
$AB select '#pngScale' 1 >/dev/null; rm -f $D/t11@1x.png; $AB download '#btnExportPNG' $D/t11@1x.png >/dev/null
echo "   1x: $($PNG $D/t11@1x.png 10,10 400,510 100,40)"
$AB select '#pngScale' 2 >/dev/null; rm -f $D/t11@2x.png; $AB download '#btnExportPNG' $D/t11@2x.png >/dev/null
echo "   2x: $($PNG $D/t11@2x.png 20,20 800,1020)"
echo "== 11e SVG rendered by the browser vs PNG export (pixel diff)"
$AB tab new "file://$D/t11.svg" >/dev/null; $AB set viewport 800 1000 >/dev/null; $AB wait 400 >/dev/null; $AB screenshot $D/t11-svg-render.png >/dev/null
$AB tab close >/dev/null; $AB tab t1 >/dev/null 2>&1; $AB set viewport 1280 800 >/dev/null
node - $D/t11-svg-render.png $D/t11@1x.png <<'JS'
const {execFileSync}=require('child_process');
// reuse png.js decoder by requiring it as a module-ish: re-implement a tiny full-image decode
const fs=require('fs'),zlib=require('zlib');
function dec(f){const b=fs.readFileSync(f);let p=8,W,H,ct,id=[];while(p<b.length){const l=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),d=b.subarray(p+8,p+8+l);if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9]}if(t==='IDAT')id.push(d);p+=12+l}const bp=ct===6?4:3,st=W*bp,raw=zlib.inflateSync(Buffer.concat(id)),px=Buffer.alloc(H*st);for(let y=0;y<H;y++){const f=raw[y*(st+1)],s=raw.subarray(y*(st+1)+1,(y+1)*(st+1)),r=px.subarray(y*st,(y+1)*st),pv=y?px.subarray((y-1)*st,y*st):null;for(let i=0;i<st;i++){const a=i>=bp?r[i-bp]:0,bb=pv?pv[i]:0,c=pv&&i>=bp?pv[i-bp]:0;let v=s[i];if(f===1)v+=a;else if(f===2)v+=bb;else if(f===3)v+=(a+bb)>>1;else if(f===4){const q=a+bb-c,pa=Math.abs(q-a),pb=Math.abs(q-bb),pc=Math.abs(q-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?bb:c}r[i]=v&255}}return{W,H,bp,px}}
const A=dec(process.argv[2]),B=dec(process.argv[3]);let sum=0,n=0,big=0;
for(let y=0;y<Math.min(A.H,B.H);y++)for(let x=0;x<Math.min(A.W,B.W);x++){let d=0;for(let k=0;k<3;k++)d+=Math.abs(A.px[y*A.W*A.bp+x*A.bp+k]-B.px[y*B.W*B.bp+x*B.bp+k]);sum+=d/3;n++;if(d/3>40)big++}
console.log(`   svg-render ${A.W}x${A.H} vs png ${B.W}x${B.H}: mean abs diff ${(sum/n).toFixed(3)} /255, pixels differing >40: ${(100*big/n).toFixed(3)}%`);
JS
echo "== 11f transparent background"
$AB scrollintoview '[data-field=transparent]' >/dev/null; $AB click '[data-field=transparent]' >/dev/null
$AB select '#pngScale' 1 >/dev/null; rm -f $D/t11-transparent.png; $AB download '#btnExportPNG' $D/t11-transparent.png >/dev/null
echo "   PNG corner: $($PNG $D/t11-transparent.png 10,10)"
rm -f $D/t11-transparent.svg; $AB download '#btnExportSVG' $D/t11-transparent.svg >/dev/null
echo "   SVG background rect present: $(grep -c 'width="800" height="1000" fill=' $D/t11-transparent.svg)"
$AB click '[data-field=transparent]' >/dev/null
echo "== 11g oversized export refused, document unchanged"
field abw 2048; field abh 2048
P0=$(diag 'd.project'); H0=$(diag 'd.history.undo')
$AB select '#pngScale' 4 >/dev/null; $AB click '#btnExportPNG' >/dev/null; $AB wait 200 >/dev/null
echo "   4x @2048: $(diag 'd.io.msg')"; [ "$P0" = "$(diag 'd.project')" ] && [ "$H0" = "$(diag 'd.history.undo')" ] && echo "   document unchanged PASS" || echo "   document CHANGED FAIL"
$AB select '#pngScale' 2 >/dev/null; rm -f $D/t11-4096.png; $AB download '#btnExportPNG' $D/t11-4096.png >/dev/null
echo "   2x @2048 (exactly 4096², the limit): $($PNG $D/t11-4096.png 0,0 | cut -c1-60)"
field abw 4000; echo "   typing artboard width 4000: $(diag 'd.project.artboard.width') ; field error: $($AB eval 'document.querySelector(".note.err")?.textContent')"
