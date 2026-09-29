#!/usr/bin/env bash
# Scenario H: regression checks for issues fixed during development (lake ice, fireworks chain, steam loop).
source "$(dirname "$0")/lib.sh"
fresh_open 1280 800 1
echo "== H1 frozen lake keeps its ice (latent heat, only open air exchanges with ambient)"
btn "Frozen Lake"; sleep 1; echo "t=1s ice $(ev 'alchemy.counts().Ice') water $(ev 'alchemy.counts().Water')"
sleep 30; echo "t=31s ice $(ev 'alchemy.counts().Ice') water $(ev 'alchemy.counts().Water') salt water $(ev 'alchemy.counts()["Salt water"]||0')"; shot H1-lake-31s
echo "== H2 fireworks chain timing"
btn "Fireworks Chain"
for k in 1 2 3 4 5 6; do sleep 2; echo "t=$((k*2))s rockets(unlaunched cells) $(ev '(()=>{let n=0;const g=alchemy.grid;for(let y=0;y<g.H;y++)for(let x=0;x<g.W;x++){const c=alchemy.cell(x,y);if(c.type==="Firework"&&!(c.flags&4))n++;}return n;})()') powder $(ev 'alchemy.counts().Gunpowder||0') embers $(ev 'alchemy.counts().Ember||0') explosive $(ev 'alchemy.counts().Explosive||0') blasts $(ev 'alchemy.stats().explosionsTotal')"; [ $k = 2 ] && shot H2-fireworks-4s; done
echo "== H3 steam engine loop"
btn "Steam Engine"; sleep 20
cat > /tmp/claude-1000/steam.js <<'JS'
(() => { const g = alchemy.grid, X = f => Math.round(f * (g.W - 1)), Y = f => Math.round(f * (g.H - 1));
  const count = (x0, x1, y0, y1, t) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (alchemy.cell(x, y).type === t) n++; return n; };
  const rA = X(0.15), tA = X(0.34);
  return JSON.stringify({ steamInRiser: count(rA, rA + 3, Y(0.4) + 1, Y(0.6) - 1, 'Steam'), steamInCondenser: count(X(0.07) + 1, X(0.43) - 1, Y(0.12) + 1, Y(0.4) - 1, 'Steam'),
    waterInCondenser: count(X(0.07) + 1, X(0.43) - 1, Y(0.12) + 1, Y(0.4) - 1, 'Water'), waterInReturn: count(tA, tA + 1, Y(0.4) + 1, Y(0.6) - 1, 'Water'),
    boilerWaterMeanT: +alchemy.sumWhere('Water', 'temp').mean.toFixed(1) }); })()
JS
for k in 1 2 3; do echo "t=$((20+k*3))s $(agent-browser eval --stdin < /tmp/claude-1000/steam.js | tail -1)"; sleep 3; done
agent-browser select "#viewMode" temp >/dev/null; sleep 0.3; shot H3-steam-engine-temp-view; agent-browser select "#viewMode" normal >/dev/null; shot H3-steam-engine
echo "errors: $(agent-browser errors 2>&1 | head -3)"
