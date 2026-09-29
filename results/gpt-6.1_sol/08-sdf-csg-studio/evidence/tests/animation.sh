#!/bin/bash
set -e
B=./evidence/tests/browser.sh
ROOT=/home/pyro/projects/naked/sol61/08-sdf-csg-studio
$B set viewport 1280 800 1
$B click '#open-import'
$B upload '#import-file' "$ROOT/evidence/tests/analytic-primitive.json"
$B wait --fn 'FieldStudio.getScene().title === "Analytic field check"'
$B click '#tab-object'
$B click '#inspector-content details:last-of-type summary'
$B scrollintoview '#object-animation'
$B select '#object-animation' float
$B eval '({time:FieldStudio.getScene().animation.time,hit:FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)})' > evidence/logs/animation-before.json
$B find role button click --name 'Play animation' --exact
$B wait --fn 'FieldStudio.getScene().animation.time > 1.2'
$B eval '({live:FieldStudio.getScene().animation,stored:JSON.parse(localStorage.getItem("field-studio-v1")).animation,hit:FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2),gpuPosition:(()=>{const gl=document.getElementById("viewport-canvas").getContext("webgl2"),p=gl.getParameter(gl.CURRENT_PROGRAM);return Array.from(gl.getUniform(p,gl.getUniformLocation(p,"uPosType[0]")))})()})' > evidence/logs/animation-playing.json
$B find role button click --name 'Pause animation' --exact
$B wait --fn '!FieldStudio.getScene().animation.playing && JSON.parse(localStorage.getItem("field-studio-v1")).animation.time === FieldStudio.getScene().animation.time'
$B eval 'FieldStudio.getScene().animation' > evidence/logs/animation-paused.json
$B reload
$B wait --fn '!FieldStudio.getScene().animation.playing && FieldStudio.getScene().animation.time > 1.2'
$B eval 'FieldStudio.getScene().animation' > evidence/logs/animation-restored.json
$B find role button click --name 'Reset animation time' --exact
$B wait --fn 'FieldStudio.getScene().animation.time === 0'
$B focus '#animation-time'
$B press Home
$B press ArrowRight
$B press ArrowRight
$B press ArrowRight
$B press Tab
$B eval 'FieldStudio.getScene().animation' > evidence/logs/animation-time-input.json
$B screenshot evidence/screenshots/33-animation-controls.png
$B click '#tab-render'
$B focus '#settings-steps'
$B press Home
$B press ArrowRight
$B press ArrowRight
$B focus '#settings-fov'
$B press Home
$B press ArrowRight
$B press ArrowRight
$B focus '#settings-exposure'
$B press End
$B press ArrowLeft
$B press Tab
$B eval 'FieldStudio.getScene().settings' > evidence/logs/keyboard-quality-settings.json
$B errors > evidence/logs/animation-errors.txt
