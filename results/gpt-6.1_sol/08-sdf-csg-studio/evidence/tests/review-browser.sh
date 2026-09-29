#!/bin/bash
set -e
B=./evidence/tests/browser.sh
ROOT=/home/pyro/projects/naked/sol61/08-sdf-csg-studio
$B eval 'window._beforeMalformed = SceneCore.serialize(FieldStudio.getScene())'
$B click '#open-import'
$B upload '#import-file' "$ROOT/evidence/tests/malformed-color.json"
$B wait --fn 'document.getElementById("import-error").textContent.includes("color")'
$B eval '({error:document.getElementById("import-error").textContent,preserved:window._beforeMalformed===SceneCore.serialize(FieldStudio.getScene()),ready:FieldStudio.getDiagnostics().ready})' > evidence/logs/malformed-color-ui.json
$B screenshot evidence/screenshots/25-malformed-color-rejected.png
$B upload '#import-file' "$ROOT/evidence/tests/nonuniform-blend.json"
$B wait --fn 'FieldStudio.getScene().title === "Non-uniform smooth blend regression"'
$B eval 'FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)' > evidence/logs/nonuniform-blend-green.json
$B click '#tab-render'
$B select '#settings-resolution' 2
$B set viewport 1920 1080
$B wait --fn 'FieldStudio.getDiagnostics().dimensions[0] === 2048'
$B eval '({css:[document.getElementById("viewport").clientWidth,document.getElementById("viewport").clientHeight],render:FieldStudio.getDiagnostics().dimensions})' > evidence/logs/capped-aspect.json
$B screenshot evidence/screenshots/26-capped-resolution.png
$B select '#settings-resolution' 0.5
$B set viewport 1280 800
$B click '#reset-camera'
$B eval 'window.__validationTag="sdf-sol61-08-validation";window._beforeWheel=FieldStudio.getScene().camera.distance'
node evidence/tests/native-cdp.cjs wheel
$B wait --fn 'FieldStudio.getScene().camera.distance !== window._beforeWheel'
$B eval '({before:window._beforeWheel,after:FieldStudio.getScene().camera.distance})' > evidence/logs/native-wheel.json
node evidence/tests/native-cdp.cjs clipboard
$B click '#open-export'
$B click '#copy-json'
$B wait --fn 'document.getElementById("toast").textContent.includes("copied")'
$B eval 'navigator.clipboard.readText().then(text=>({length:text.length,equals:text===SceneCore.serialize(FieldStudio.getScene())}))' > evidence/logs/native-clipboard.json
$B press Escape
