#!/bin/bash
set -e
B=./evidence/tests/browser.sh
$B eval 'SceneCore.serialize(FieldStudio.getScene())' > evidence/logs/before-invalid-import.json
$B find label 'Scene JSON' fill '{"objects": [}'
$B click '#import-json'
$B screenshot evidence/screenshots/22-invalid-import.png
$B eval '({error:document.getElementById("import-error").textContent,scene:FieldStudio.getScene()})' > evidence/logs/invalid-import-result.json
$B upload '#import-file' /home/pyro/projects/naked/sol61/08-sdf-csg-studio/evidence/public-scene.json
$B wait --fn '!document.getElementById("exchange-modal").classList.contains("open")'
$B eval 'SceneCore.serialize(FieldStudio.getScene())' > evidence/logs/roundtrip-scene-string.json
$B click '#open-export'
$B download '#modal-screenshot' /home/pyro/projects/naked/sol61/08-sdf-csg-studio/evidence/public-scene.png
$B click '[data-close="exchange-modal"]'
$B wait --fn 'JSON.parse(localStorage.getItem("field-studio-v1")).title === "CSG workflow"'
$B reload
$B eval 'SceneCore.serialize(FieldStudio.getScene())' > evidence/logs/persisted-scene-string.json
$B network requests --clear
$B reload
$B network requests --json > evidence/logs/clean-http-network.json
$B errors > evidence/logs/public-runtime-errors.txt
$B console > evidence/logs/public-console.txt
