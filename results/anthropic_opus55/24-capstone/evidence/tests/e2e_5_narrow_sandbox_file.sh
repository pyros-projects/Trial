#!/bin/bash
# E16 narrow 390x844 workflow; E17 opaque-origin sandbox iframe (allow-scripts allow-downloads); E18 file:// with network offline
source "$(dirname "$0")/lib.sh"; FX=$T/fixtures; export AGENT_BROWSER_NAMESPACE=starfix
$AB set viewport 390 844 >/dev/null; fresh
echo "E16 narrow: overflow sw=$(q 'document.documentElement.scrollWidth') cw=$(q 'document.documentElement.clientWidth')"; shot 18-narrow-deck.png
P=$(q 'JSON.stringify(starfix.screenOf("Antares"))'); X=$(echo $P | sed -E "s/.*x:([0-9]+).*/\1/"); Y=$(echo $P | sed -E "s/.*y:([0-9]+).*/\1/")
$AB mouse move $X $Y >/dev/null; $AB mouse down >/dev/null; $AB mouse up >/dev/null; $AB wait 300 >/dev/null; shot 19-narrow-body-card.png
$AB find role button click --name "Take sight ⤵" >/dev/null; $AB wait 400 >/dev/null
R0=$(q 'starfix.summary().sextant.R*60'); $AB mouse move 195 150 >/dev/null; $AB mouse down >/dev/null; $AB mouse move 195 175 >/dev/null; $AB mouse move 195 200 >/dev/null; $AB mouse up >/dev/null; R1=$(q 'starfix.summary().sextant.R*60')
echo "   drag on eyepiece 50 px down: arc $R0' -> $R1'"; shot 20-narrow-sextant.png
for r in 1 2; do $AB wait --fn "Math.abs(starfix.summary().sextant.phi) < 0.12" >/dev/null; OFF=$(q 'starfix.summary().sextant.off'); N=$(uv run python -c "print(round($OFF/0.2))"); B="+0.2′"; [ "$N" -lt 0 ] && { B="−0.2′"; N=$((-N)); }; [ $N -gt 60 ] && N=60; for i in $(seq 1 $N); do $AB find role button click --name "$B" >/dev/null; done; done
$AB wait --fn "Math.abs(starfix.summary().sextant.phi) < 0.1" >/dev/null; $AB find role button click --name "MARK (Space)" >/dev/null; $AB wait 200 >/dev/null
echo "   tapped +0.2'/−0.2' buttons then MARK: $(summary '(s=>s.sights.map(x=>({body:x.body,errArc:+x.errArc.toFixed(2),lopErr:+x.lopErr.toFixed(2)})))')"
$AB find role button click --name "Done (Esc)" >/dev/null; $AB click '#mtabs [data-view=chart]' >/dev/null; $AB wait 400 >/dev/null; shot 21-narrow-chart.png
$AB click '#mtabs [data-view=sights]' >/dev/null; $AB wait 200 >/dev/null; shot 22-narrow-sights.png
$AB click '#mtabs [data-view=helm]' >/dev/null; $AB wait 200 >/dev/null; shot 23-narrow-helm.png
$AB click '#mtabs [data-view=planner]' >/dev/null; $AB wait 200 >/dev/null; shot 24-narrow-planner.png
echo "   overflow after navigation sw=$(q 'document.documentElement.scrollWidth')  console errors: [$($AB errors | tr '\n' ' ')]"
echo "E17 sandbox iframe (external https requests aborted)"; $AB network route "https://**" --abort >/dev/null
$AB set viewport 1280 800 >/dev/null; $AB open "http://127.0.0.1:${PORT:-51257}/evidence/tests/sandbox-harness.html?e2e=$RANDOM" >/dev/null; $AB wait 1000 >/dev/null
$AB mouse move 430 331 >/dev/null; $AB mouse down >/dev/null; $AB mouse up >/dev/null; $AB wait 300 >/dev/null
REF=$($AB snapshot -i | grep "Take sight" | sed -E 's/.*ref=(e[0-9]+).*/\1/'); $AB click @$REF >/dev/null; $AB wait 400 >/dev/null
for i in 1 2 3 4 5 6; do $AB press ArrowDown >/dev/null; done; $AB press Space >/dev/null; $AB wait 300 >/dev/null; $AB press Escape >/dev/null
echo "   toast inside sandbox: $($AB snapshot | grep -oE 'Sight #1: [^"]+' | head -1)"; shot 25-sandbox-iframe.png
$AB frame @e1 >/dev/null 2>&1; $AB upload "#fileImport" $FX/voyage-export.json >/dev/null; $AB wait 400 >/dev/null; $AB frame main >/dev/null 2>&1
echo "   import inside sandbox: $($AB snapshot | grep -oE 'Voyage log imported[^"]+' | head -1)"
rm -rf $FX/sandbox-dl; mkdir -p $FX/sandbox-dl; S2="agent-browser --session sfdl-$RANDOM --download-path $FX/sandbox-dl"; $S2 set viewport 1280 800 >/dev/null; $S2 open "http://127.0.0.1:${PORT:-51257}/evidence/tests/sandbox-harness.html?e2e=$RANDOM" >/dev/null; $S2 wait 900 >/dev/null
REF=$($S2 snapshot -i | grep 'button "Export log"' | sed -E 's/.*ref=(e[0-9]+).*/\1/'); $S2 click @$REF >/dev/null; sleep 2; echo "   export from sandbox (browser download dir): $(ls $FX/sandbox-dl)"; $S2 close >/dev/null 2>&1
echo "E18 file:// with network offline"
S3="agent-browser --session sffile"; $S3 set viewport 1280 800 >/dev/null; $S3 set offline on >/dev/null; $S3 open "file://$(cd $E/.. && pwd)/index.html" >/dev/null; $S3 wait 900 >/dev/null
echo "   $(echo 'JSON.stringify({protocol: location.protocol, resourcesFetched: performance.getEntriesByType("resource").length, voyage: starfix.summary().voyage, storage: (()=>{try{return typeof localStorage}catch(e){return "blocked"}})()})' | $S3 eval --stdin)"
P=$(echo 'JSON.stringify(starfix.screenOf("Antares"))' | $S3 eval --stdin | tr -d '"\\'); X=$(echo $P | sed -E "s/.*x:([0-9]+).*/\1/"); Y=$(echo $P | sed -E "s/.*y:([0-9]+).*/\1/")
$S3 mouse move $X $Y >/dev/null; $S3 mouse down >/dev/null; $S3 mouse up >/dev/null; $S3 wait 200 >/dev/null; $S3 press Enter >/dev/null; $S3 wait 300 >/dev/null; $S3 press Space >/dev/null; $S3 wait 200 >/dev/null
echo "   sight from file://: $(echo 'JSON.stringify(starfix.summary().sights.map(s=>s.body+" Hs="+s.Hs.toFixed(3)))' | $S3 eval --stdin)   errors: [$($S3 errors | tr '\n' ' ')]"
$S3 screenshot $SHOTS/26-file-protocol.png >/dev/null; $S3 set offline off >/dev/null; $S3 close >/dev/null 2>&1
echo "   network requests seen by the main session:"; $AB network requests 2>&1 | grep -vE "^\\s*$" | sed "s/^/     /" | tail -6; $AB network unroute >/dev/null 2>&1
