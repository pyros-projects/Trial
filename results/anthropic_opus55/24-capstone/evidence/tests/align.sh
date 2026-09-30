#!/bin/bash
SP=$(cd "$(dirname "$0")" && pwd); AB=$SP/ab.sh
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
