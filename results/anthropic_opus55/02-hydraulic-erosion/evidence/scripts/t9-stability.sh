#!/usr/bin/env bash
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
ST="JSON.stringify({N:lab.S.N, t:+lab.S.time.toFixed(2), steps:lab.S.steps, water:+lab.stats.water.toFixed(0), finite:lab.stats.finite, cfl:+lab.cfl.toFixed(2), split:lab.split, dt:+lab.lastDt.toFixed(4), budget:lab.budgetLimited, stab:[...document.querySelectorAll('#hudGrid .v')][14].textContent, massRel:lab.stats.matRel.toExponential(1), waterRel:lab.stats.waterRel.toExponential(1), recoveries:lab.recoveries})"
$AB reload >/dev/null; $AB wait 1500 >/dev/null
$AB wait --fn "lab.S.time >= 15" --timeout 120000 >/dev/null
echo "== T9 resolution change while running =="
$AB eval "$ST"
for r in 192 384 128 256; do
  $AB select "#p-res" "$r" >/dev/null; $AB wait 2500 >/dev/null
  $AB eval "$ST"
done
$AB screenshot evidence/screenshots/26-after-resolution-changes.png >/dev/null
echo "== T13 extreme parameters via keyboard (End) while running =="
for s in p-speed p-substeps p-flow p-rain p-erosion p-capacity p-thermal; do $AB focus "#$s" >/dev/null; $AB press End >/dev/null; done
$AB click "#view" >/dev/null 2>&1; $AB wait 6000 >/dev/null
$AB eval "$ST"
$AB wait 6000 >/dev/null; $AB eval "$ST"
$AB screenshot evidence/screenshots/27-extreme-params.png >/dev/null
echo "== T11 stress-test preset =="
$AB click "[data-preset=stress]" >/dev/null; $AB wait 4000 >/dev/null
$AB eval "$ST"
$AB wait 15000 >/dev/null; $AB eval "$ST"
$AB eval "lab.renderScale=1; 1" >/dev/null; $AB wait 15000 >/dev/null; $AB eval "$ST"
$AB screenshot evidence/screenshots/28-stress-test.png >/dev/null
echo "== T12 injected NaN -> rollback =="
$AB eval "lab.S.d[5000]=NaN; lab.S.h[7777]=Infinity; 'injected'"
$AB wait 1500 >/dev/null
$AB eval "JSON.stringify({afterInjection:$ST, lastRecovery:lab.lastRecovery, stabilityScale:lab.stabilityScale, toast:document.querySelector('#toast').textContent})"
$AB screenshot evidence/screenshots/29-nan-recovery.png >/dev/null
$AB wait 8000 >/dev/null; $AB eval "$ST"
$AB errors
