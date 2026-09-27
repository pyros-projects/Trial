#!/usr/bin/env bash
# View controls through the real UI: contours + grid checkboxes, sun direction, vertical exaggeration, water visibility.
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
$AB open "file://$ROOT/index.html" >/dev/null; $AB set viewport 1280 800 >/dev/null
$AB wait --fn "lab.S.time > 40" --timeout 120000 >/dev/null
$AB click "#btnPause" >/dev/null; $AB eval "lab.renderScale=1; 1" >/dev/null; $AB wait 500 >/dev/null
$AB screenshot $ROOT/evidence/screenshots/70-view-default.png >/dev/null
$AB check "#v-contours" >/dev/null; $AB check "#v-grid" >/dev/null; $AB wait 500 >/dev/null
$AB eval "JSON.stringify({contours:lab.view.contours, grid:lab.view.grid})"
$AB screenshot $ROOT/evidence/screenshots/71-contours-grid.png >/dev/null
$AB focus "#v-sunEl" >/dev/null; for i in $(seq 1 24); do $AB press ArrowLeft >/dev/null; done
$AB focus "#v-sunAz" >/dev/null; for i in $(seq 1 60); do $AB press ArrowRight >/dev/null; done
$AB wait 600 >/dev/null
$AB eval "JSON.stringify({sunEl:lab.view.sunEl, sunAz:lab.view.sunAz})"
$AB screenshot $ROOT/evidence/screenshots/72-low-sun.png >/dev/null
$AB uncheck "#v-contours" >/dev/null; $AB uncheck "#v-grid" >/dev/null
$AB focus "#v-exag" >/dev/null; $AB press End >/dev/null
$AB focus "#v-waterVis" >/dev/null; $AB press Home >/dev/null
$AB wait 600 >/dev/null
$AB eval "JSON.stringify({exag:lab.view.exag, waterVis:lab.view.waterVis})"
$AB screenshot $ROOT/evidence/screenshots/73-exag4-water-hidden.png >/dev/null
$AB errors
