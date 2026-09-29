#!/bin/bash
set -e
B=./evidence/tests/browser.sh
$B eval 'window._loseExt=document.getElementById("viewport-canvas").getContext("webgl2").getExtension("WEBGL_lose_context");window._loseExt.loseContext();"Injected actual context loss"'
$B wait --fn '!FieldStudio.getDiagnostics().ready && document.getElementById("renderer-error").classList.contains("visible")'
$B eval 'FieldStudio.getDiagnostics()' > evidence/logs/context-lost.json
$B eval 'window._loseExt.restoreContext();"Requested actual context restoration with intentionally invalid shader"'
$B wait --fn '!FieldStudio.getDiagnostics().ready && document.getElementById("shader-error-log").textContent.includes("this_is_an_intentional_compile_error")'
$B eval '({diag:FieldStudio.getDiagnostics(),error:document.getElementById("shader-error-log").textContent})' > evidence/logs/shader-fault.json
$B screenshot evidence/screenshots/35-shader-error.png
$B eval 'document.getElementById("fragment-shader").textContent=window._goodFragment;"Restored original embedded shader"'
$B find role button click --name 'Retry renderer' --exact
$B wait --fn 'FieldStudio.getDiagnostics().ready'
$B eval '({diag:FieldStudio.getDiagnostics(),footer:document.getElementById("engine-status").textContent,overlay:document.getElementById("renderer-error").classList.contains("visible"),hit:FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)})' > evidence/logs/shader-recovery-before-fix.json
