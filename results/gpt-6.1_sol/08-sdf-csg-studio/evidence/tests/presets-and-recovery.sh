#!/bin/bash
set -e
B=./evidence/tests/browser.sh
for key in mechanical arch glass repeat stress; do
 $B click "[data-preset=\"$key\"]"
 $B wait --fn 'FieldStudio.getDiagnostics().ready && FieldStudio.getDiagnostics().glError === 0'
 $B eval '({scene:FieldStudio.getScene(),diag:FieldStudio.getDiagnostics(),hit:FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)})' > "evidence/logs/preset-$key.json"
 $B screenshot "evidence/screenshots/preset-$key.png"
done
$B click '#tab-render'
$B focus '#settings-steps'
$B press End
$B find label 'Hit epsilon' fill '0.0005'
$B press Tab
$B eval '({scene:FieldStudio.getScene(),hit:FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)})' > evidence/logs/preset-stress-refined.json
$B screenshot evidence/screenshots/34-stress-refined.png
$B click '[data-preset="soft"]'
$B eval 'window._goodFragment=document.getElementById("fragment-shader").textContent;document.getElementById("fragment-shader").textContent="#version 300 es\nprecision highp float;\nvoid main(){this_is_an_intentional_compile_error;}";"Fault injected into live browser only"'
$B click '#retry-renderer'
$B wait --fn '!FieldStudio.getDiagnostics().ready && document.getElementById("renderer-error").classList.contains("visible")'
$B eval '({diag:FieldStudio.getDiagnostics(),error:document.getElementById("shader-error-log").textContent})' > evidence/logs/shader-fault.json
$B screenshot evidence/screenshots/35-shader-error.png
$B eval 'document.getElementById("fragment-shader").textContent=window._goodFragment;"Restored original embedded shader"'
$B click '#retry-renderer'
$B wait --fn 'FieldStudio.getDiagnostics().ready'
$B eval '({diag:FieldStudio.getDiagnostics(),footer:document.getElementById("engine-status").textContent,overlay:document.getElementById("renderer-error").classList.contains("visible"),hit:FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)})' > evidence/logs/shader-recovery-before-fix.json
