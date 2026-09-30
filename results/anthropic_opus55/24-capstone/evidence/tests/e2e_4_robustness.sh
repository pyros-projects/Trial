#!/bin/bash
# E9 export/import round trip; E10 invalid imports keep state; E11 reset; E12 reset invalidates a pending import;
# E13 sound gesture; E14 pointercancel + blur; E15 frame time
source "$(dirname "$0")/lib.sh"; FX=$T/fixtures
$AB set viewport 1280 800 >/dev/null; fresh
for b in Antares Arcturus; do $T/face.sh $b; $T/sight.sh $b | grep -c logged >/dev/null; done
adopt "Adopt fix as new DR"
B=$(summary '(s=>({t:s.t,truePos:s.truePos,dr:s.dr,n:s.sights.length,Hs:s.sights.map(x=>x.Hs),fixes:s.fixes.length}))'); echo "E9 before export: $B"
$AB download "#btnExport" $FX/voyage-export.json >/dev/null && echo "   exported $(wc -c < $FX/voyage-export.json) bytes: $(node -e "const d=require('$FX/voyage-export.json');console.log(d.app,d.version,d.voyage.id,'sights',d.state.sights.length)")"
tab "Helm & time"; clickSel '[data-skip="21600000"]'; echo "   changed state: t=$(summary '(s=>s.t)')"
$AB upload "#fileImport" $FX/voyage-export.json >/dev/null; $AB wait 400 >/dev/null
A=$(summary '(s=>({t:s.t,truePos:s.truePos,dr:s.dr,n:s.sights.length,Hs:s.sights.map(x=>x.Hs),fixes:s.fixes.length}))'); echo "   after import: $A  running=$(summary '(s=>s.running)')"
echo "this is not json {" > $FX/garbage.json; echo '{"app":"notstarfix","version":1}' > $FX/wrong-app.json
node -e "const f='$FX/voyage-export.json',fs=require('fs');let d=JSON.parse(fs.readFileSync(f));d.state.sights[0].Hs=400;fs.writeFileSync('$FX/bad-sight.json',JSON.stringify(d));d=JSON.parse(fs.readFileSync(f));d.voyage.start=Date.UTC(1900,0,1);d.state.t=d.voyage.start;fs.writeFileSync('$FX/bad-date.json',JSON.stringify(d));d=JSON.parse(fs.readFileSync(f));d.state.legs[0].spd=99;fs.writeFileSync('$FX/bad-speed.json',JSON.stringify(d));"
R=$(summary '(s=>({t:s.t,n:s.sights.length}))'); echo "E10 reference state: $R"
for f in garbage wrong-app bad-sight bad-date bad-speed; do $AB upload "#fileImport" $FX/$f.json >/dev/null; $AB wait 300 >/dev/null; echo "   $f -> $(q '[...document.querySelectorAll("#toasts .toast")].map(t=>t.textContent).slice(-1)[0]') | state $(summary '(s=>({t:s.t,n:s.sights.length}))')"; done
shot 17-invalid-import-toast.png
echo "E11 reset after dirtying (practice on, rough sea, sound on, labels off)"
tab "Helm & time"; $AB scrollintoview "#inReveal" >/dev/null; $AB check "#inReveal" >/dev/null; $AB select "#inSea" rough >/dev/null; $AB click "#btnSound" >/dev/null; $AB click "#btnLabels" >/dev/null
echo "   dirty: $(summary '(s=>({voyage:s.voyage,t:s.t,n:s.sights.length,audio:s.audio}))')"
$AB click "#btnReset" >/dev/null; $AB wait 300 >/dev/null
echo "   after reset: $(summary '(s=>({voyage:s.voyage,t:s.t,n:s.sights.length,fixes:s.fixes.length,running:s.running,truePos:s.truePos,dr:s.dr,legs:s.legs,audio:s.audio}))')"
echo "   ui: labels=$(q 'document.getElementById("btnLabels").getAttribute("aria-pressed")') guide=$(q '!document.getElementById("coach").hidden') sea=$(q 'document.getElementById("inSea").value') practice=$(q 'document.getElementById("inReveal").checked') sound=$(q 'document.getElementById("btnSound").textContent')"
echo "E12 reset while an import is pending (FileReader in flight)"
node -e "const txt=require('fs').readFileSync('$FX/voyage-export.json','utf8');process.stdout.write('(async () => { const txt = '+JSON.stringify(txt)+'; const inp = document.getElementById(\"fileImport\"); const dt = new DataTransfer(); dt.items.add(new File([txt], \"voyage.json\", {type:\"application/json\"})); inp.files = dt.files; inp.dispatchEvent(new Event(\"change\", {bubbles:true})); document.getElementById(\"btnReset\").click(); await new Promise(r => setTimeout(r, 600)); const s = starfix.summary(); return JSON.stringify({t: s.t, sights: s.sights.length, fixes: s.fixes.length, toasts: [...document.querySelectorAll(\"#toasts .toast\")].map(t => t.textContent)}); })()')" > $T/fixtures/pending.js
echo "   $($AB eval --stdin < $T/fixtures/pending.js)"
echo "E13 sound: before=$(summary '(s=>s.audio)')"; $AB click "#btnSound" >/dev/null; $AB wait 300 >/dev/null; echo "   after click (user gesture)=$(summary '(s=>s.audio)')"; $AB click "#btnSound" >/dev/null; echo "   after second click=$(summary '(s=>s.audio)')"
echo "E14 pointer cancel on deck drag, blur during eyepiece drag"
$AB mouse move 300 400 >/dev/null; $AB mouse down >/dev/null; $AB mouse move 360 400 >/dev/null; echo "   deck drag: $(summary '(s=>s.dragging)')"
q 'document.getElementById("deckCanvas").dispatchEvent(new PointerEvent("pointercancel",{pointerId:1,bubbles:true})); 1' >/dev/null; $AB mouse up >/dev/null; echo "   after pointercancel: $(summary '(s=>s.dragging)') bodyCardShown=$(q '!document.getElementById("bodyCard").hidden')"
P=$(q 'JSON.stringify(starfix.screenOf("Antares"))'); X=$(echo $P | sed -E "s/.*x:([0-9]+).*/\1/"); Y=$(echo $P | sed -E "s/.*y:([0-9]+).*/\1/"); $AB mouse move $X $Y >/dev/null; $AB mouse down >/dev/null; $AB mouse up >/dev/null; $AB press Enter >/dev/null; $AB wait 300 >/dev/null
R0=$(q 'starfix.summary().sextant.R'); $AB mouse move 300 300 >/dev/null; $AB mouse down >/dev/null; $AB mouse move 300 320 >/dev/null; R1=$(q 'starfix.summary().sextant.R'); q 'window.dispatchEvent(new Event("blur")); 1' >/dev/null; $AB mouse move 300 420 >/dev/null; R2=$(q 'starfix.summary().sextant.R'); $AB mouse up >/dev/null
echo "   keyboard Enter opened sextant on $(summary '(s=>s.sextant.body)'); arc: start $R0, while dragging $R1, after blur+further move $R2"
echo "E15 frame time (eyepiece then deck)"; echo "   eyepiece $($AB eval --stdin < $T/fps.js)"; $AB press Escape >/dev/null; echo "   deck $($AB eval --stdin < $T/fps.js)"
echo "   console errors: [$($AB errors | tr '\n' ' ')]"
