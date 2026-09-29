#!/usr/bin/env bash
# Scenario D2 (continues D's canvas): corrected placement for plant growth, gas ignition, wind, metal melting.
source "$(dirname "$0")/lib.sh"
echo "== D2b plants seeded at the water surface"
WY=$(ev '(()=>{for(let y=150;y<235;y++)if(alchemy.cell(100,y).type==="Water")return y;return -1;})()')
echo "water surface in plant bay at y=$WY"
btn "Paint tool"; btn "Plant"; for k in 1 2 3 4 5; do agent-browser press "[" >/dev/null; done
for x in 92 104 116 128 140; do click_at $x $((WY-1)); done
P0=$(ev 'alchemy.counts().Plant'); W0=$(ev '(()=>{let n=0;for(let y=150;y<235;y++)for(let x=81;x<150;x++)if(alchemy.cell(x,y).type==="Water")n++;return n;})()')
sleep 15
P1=$(ev 'alchemy.counts().Plant'); W1=$(ev '(()=>{let n=0;for(let y=150;y<235;y++)for(let x=81;x<150;x++)if(alchemy.cell(x,y).type==="Water")n++;return n;})()')
echo "plant cells $P0 -> $P1 ; water in plant bay $W0 -> $W1 (drunk by plants)"
btn "Plant"; click_at 60 100; click_at 250 60; sleep 5
echo "control: seeds placed in dry air at (60,100),(250,60) -> local plant cells $(ev '(()=>{let n=0;for(const [cx,cy] of [[60,100],[250,60]])for(let y=cy-6;y<=cy+6;y++)for(let x=cx-6;x<=cx+6;x++)if(alchemy.cell(x,y).type==="Plant")n++;return n;})()') (a dry seed only grows from its initial moisture, then stops)"
shot D2b-plant-growth
echo "== D5b ignite the gas cloud where it actually is"
GXY=$(ev '(()=>{let sx=0,sy=0,n=0;for(let y=0;y<252;y++)for(let x=200;x<313;x++)if(alchemy.cell(x,y).type==="Gas"){sx+=x;sy+=y;n++;}return Math.round(sx/n)+" "+Math.round(sy/n)+" "+n;})()' | tr -d '"')
read -r gx gy gn <<< "$GXY"; echo "gas cloud centre ($gx,$gy), $gn cells"
btn "Fire"; for k in 1 2; do agent-browser press "]" >/dev/null; done; click_at "$gx" "$gy"
sleep 1.5; echo "gas after ignition: $(ev 'alchemy.counts().Gas||0') ; fire/smoke: $(ev 'JSON.stringify([alchemy.counts().Fire||0, alchemy.counts().Smoke||0])')"; shot D5b-gas-ignited
echo "== D6b wind pushes the loose surface of a sand pile sideways"
btn "Sand"; for k in 1 2 3; do agent-browser press "]" >/dev/null; done; hold 185 200 1.2; sleep 2
SXS='(()=>{let s=0,n=0;for(let y=0;y<252;y++)for(let x=151;x<313;x++)if(alchemy.cell(x,y).type==="Sand"){s+=x;n++;}return (s/n).toFixed(2)+" n="+n;})()'
TOP=$(ev '(()=>{for(let y=100;y<235;y++)if(alchemy.cell(185,y).type==="Sand")return y;return 0;})()'); echo "pile top at y=$TOP"
SX0=$(ev "$SXS"); btn "Wind tool"
drag 150 $((TOP+2)) 170 $((TOP+2)) 190 $((TOP+2)) 210 $((TOP+2)) 230 $((TOP+2)); drag 150 $((TOP+8)) 170 $((TOP+8)) 190 $((TOP+8)) 210 $((TOP+8)) 230 $((TOP+8))
sleep 1.5; echo "sand mean x before wind $SX0 -> after $(ev "$SXS") (only the exposed surface can move)"; shot D6b-wind
echo "== D6c wind deflects a free-falling sand cloud (open air above the bays)"
btn "Paint tool"; btn "Sand"; SC='(()=>{let s=0,n=0;for(let y=0;y<252;y++)for(let x=0;x<313;x++)if(alchemy.cell(x,y).type==="Sand"){s+=x;n++;}return n?(s/n).toFixed(1)+" n="+n:"none";})()'
echo "open air at (110,30): $(ev 'alchemy.cell(110,30).type')"; N0=$(ev 'alchemy.counts().Sand'); btn "Pause"; hold 110 30 0.3
echo "sand cloud painted at x=110 (paused): sand $N0 -> $(ev 'alchemy.counts().Sand'), all-sand mean x $(ev "$SC")"
btn "Wind tool"; drag 95 30 110 30 125 30 140 30; echo "cloud vx after wind: $(ev '(()=>{let s=0,n=0;for(let y=15;y<45;y++)for(let x=95;x<160;x++){const c=alchemy.cell(x,y);if(c.type==="Sand"){s+=c.vx;n++;}}return (s/n).toFixed(2)+" over "+n+" grains";})()')"; btn "Resume"; sleep 2.5
echo "after wind + 2.5s of falling: all-sand mean x $(ev "$SC") ; "
shot D6c-wind-cloud
echo "== D3b heat tool melts metal (sampled during the hold)"
btn "Metal"; btn "Paint tool"; for k in 1 2 3 4 5 6 7 8 9 10; do agent-browser press "[" >/dev/null; done; for k in 1 2 3 4; do agent-browser press "]" >/dev/null; done
drag 230 90 260 90 230 96 260 96; echo "metal=$(ev 'alchemy.counts().Metal')"
btn "Heat tool"; for k in 1 2 3 4; do agent-browser press "]" >/dev/null; done
read -r sx sy <<< "$(scr 245 93)"; agent-browser mouse move $sx $sy >/dev/null; agent-browser mouse down left >/dev/null
for k in 1 2 3 4; do sleep 1.5; echo "  holding +$((k*15/10))s: molten=$(ev 'alchemy.counts()["Molten metal"]||0') metal=$(ev 'alchemy.counts().Metal')"; done
shot D3c-metal-melting-live; agent-browser mouse up left >/dev/null
sleep 5; echo "5s after release: molten=$(ev 'alchemy.counts()["Molten metal"]||0') metal=$(ev 'alchemy.counts().Metal') (drips solidify again)"
echo "errors: $(agent-browser errors 2>&1 | head -3)"
