#!/bin/bash
set -e
B=./evidence/tests/direct-file-browser.sh
$B open about:blank
$B set viewport 1280 800
$B set offline on
$B network requests --clear
$B open file:///home/pyro/projects/naked/sol61/08-sdf-csg-studio/index.html
$B wait --fn 'window.FieldStudio && FieldStudio.getDiagnostics().ready'
$B reload
$B wait --fn 'FieldStudio.getDiagnostics().ready'
$B screenshot evidence/screenshots/32-direct-file-offline.png
$B eval '({url:location.protocol,scene:FieldStudio.getScene().title,diag:FieldStudio.getDiagnostics(),resources:performance.getEntriesByType("resource").map(r=>r.name)})' > evidence/logs/direct-file-offline.json
$B click '#add-object'
$B click '[data-primitive="sphere"]'
$B find label 'Object name' fill 'Offline sphere'
$B find label 'Position X' fill '1.2'
$B press Tab
$B eval 'FieldStudio.getScene().objects.find(o=>o.id===FieldStudio.getScene().selected)' > evidence/logs/direct-file-edited.json
$B wait --fn 'JSON.parse(localStorage.getItem("field-studio-v1")).objects.length === 5'
$B reload
$B wait --fn 'FieldStudio.getScene().objects.some(o=>o.name === "Offline sphere" && o.position[0] === 1.2)'
$B eval 'FieldStudio.getDiagnostics()' > evidence/logs/direct-file-restored.json
$B errors > evidence/logs/direct-file-errors.txt
$B console > evidence/logs/direct-file-console.txt
$B network requests --json > evidence/logs/direct-file-network.json
$B close
