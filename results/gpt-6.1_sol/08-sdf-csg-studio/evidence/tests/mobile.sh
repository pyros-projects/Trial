#!/bin/bash
set -e
B=./evidence/tests/browser.sh
ROOT=/home/pyro/projects/naked/sol61/08-sdf-csg-studio
$B set viewport 390 844 2
$B click '#open-import'
$B upload '#import-file' "$ROOT/evidence/tests/analytic-primitive.json"
$B wait --fn 'FieldStudio.getScene().title === "Analytic field check"'
$B find role button click --name 'Open scene panel'
$B find role button click --name 'Add object' --exact
$B click '[data-primitive="box"]'
$B find role button click --name 'Close scene panel'
$B find role button click --name 'Open inspector'
$B click '#tab-object'
$B find label 'Object name' fill 'Narrow box'
$B find label 'Position X' fill '0.5'
$B find label 'Position Y' fill '0.15'
$B find label 'Rotation Y' fill '20'
$B find label 'Scale Z' fill '1.3'
$B press Tab
$B scrollintoview '#object-material-kind'
$B select '#object-material-kind' glossy
$B find label 'Material hex color' fill '#87b0a5'
$B press Tab
$B eval '({object:FieldStudio.getScene().objects.find(o=>o.id===FieldStudio.getScene().selected),diag:FieldStudio.getDiagnostics(),viewport:[innerWidth,innerHeight],dpr:devicePixelRatio})' > evidence/logs/mobile-edited.json
$B screenshot evidence/screenshots/28-mobile-inspector.png
$B click '#duplicate'
$B wait --fn 'FieldStudio.getScene().objects.length === 3'
$B eval 'FieldStudio.getScene()' > evidence/logs/mobile-duplicate.json
$B click '#close-inspector'
$B click '#toggle-scene'
$B find role button click --name 'Hide Narrow box copy' --exact
$B click '#move-up'
$B eval 'FieldStudio.getScene()' > evidence/logs/mobile-hide-reorder.json
$B find role button click --name 'Show Narrow box copy' --exact
$B click '#delete-list'
$B wait --fn 'FieldStudio.getScene().objects.length === 2'
$B screenshot evidence/screenshots/29-mobile-scene.png
$B click '#close-scene'
$B mouse move 270 350
$B mouse down left
$B mouse move 300 380
$B mouse up left
$B eval 'FieldStudio.getScene().camera' > evidence/logs/mobile-camera-orbit.json
$B select '#view-mode' 4
$B screenshot evidence/screenshots/30-mobile-raysteps.png
$B select '#view-mode' 0
$B click '#toggle-inspector'
$B click '#tab-render'
$B select '#settings-resolution' 1
$B wait --fn 'FieldStudio.getDiagnostics().dimensions[0] === 780'
$B eval '({diagnostics:FieldStudio.getDiagnostics(),css:[document.getElementById("viewport").clientWidth,document.getElementById("viewport").clientHeight],dpr:devicePixelRatio})' > evidence/logs/mobile-hidpi.json
$B select '#settings-resolution' 0.5
$B click '#close-inspector'
$B eval 'FieldStudio.getScene()' > evidence/logs/mobile-final-scene.json
$B errors > evidence/logs/mobile-runtime-errors.txt
