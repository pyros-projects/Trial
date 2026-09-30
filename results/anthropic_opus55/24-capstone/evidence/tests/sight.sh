#!/bin/bash
# usage: sight.sh <BodyName>   — select body via planner row click, open sextant, align with arrow keys, mark at bottom of swing
SP=$(cd "$(dirname "$0")" && pwd); AB=$SP/ab.sh
B="$1"
P=$(echo "JSON.stringify(starfix.screenOf($(node -e 'console.log(JSON.stringify(process.argv[1]))' "$B")))" | $AB eval --stdin | tr -d '"\\')
X=$(echo $P | sed -E "s/.*x:([0-9]+).*/\1/"); Y=$(echo $P | sed -E "s/.*y:([0-9]+).*/\1/")
echo "click $B at $X,$Y"
$AB mouse move $X $Y >/dev/null; $AB mouse down >/dev/null; $AB mouse up >/dev/null; $AB wait 250 >/dev/null
$AB find role button click --name "Take sight ⤵" >/dev/null || { echo "no take sight"; exit 1; }
$AB wait 300 >/dev/null
for round in 1 2 3; do
  $AB wait --fn "starfix.summary().sextant && Math.abs(starfix.summary().sextant.phi) < 0.12" --timeout 15000 >/dev/null
  OFF=$(echo 'starfix.summary().sextant.off' | $AB eval --stdin)
  N=$(uv run python -c "print(round($OFF/0.5))")
  echo "round $round off=$OFF presses=$N"
  if [ "$N" -gt 0 ]; then K=ArrowDown; else K=ArrowUp; N=$(( -N )); fi
  for i in $(seq 1 $N); do $AB press $K >/dev/null; done
  [ "$N" -le 1 ] && break
done
$AB wait --fn "starfix.summary().sextant && Math.abs(starfix.summary().sextant.phi) < 0.1" --timeout 15000 >/dev/null
echo "at mark: $(echo 'JSON.stringify(starfix.summary().sextant)' | $AB eval --stdin)"
$AB press Space >/dev/null
$AB wait 200 >/dev/null
echo "logged: $(echo 'JSON.stringify(starfix.summary().sights.slice(-1)[0])' | $AB eval --stdin)"
$AB press Escape >/dev/null
