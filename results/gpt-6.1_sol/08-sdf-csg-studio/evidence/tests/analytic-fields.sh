#!/bin/bash
set -e
B=./evidence/tests/browser.sh
ROOT=/home/pyro/projects/naked/sol61/08-sdf-csg-studio
$B click '#open-import'
$B upload '#import-file' "$ROOT/evidence/tests/analytic-primitive.json"
$B wait --fn 'FieldStudio.getScene().title === "Analytic field check"'
$B click '#tab-object'
for type in sphere box roundedBox cylinder capsule torus deformed; do
 $B select '#object-type' "$type"
 $B eval 'FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)' > "evidence/logs/analytic-$type.json"
done
$B select '#object-type' plane
$B find label 'Rotation X' fill '90'
$B press Tab
$B eval 'FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)' > evidence/logs/analytic-plane.json
$B select '#object-type' sphere
$B find label 'Rotation X' fill '0'
$B find label 'Rotation Y' fill '90'
$B press Tab
$B eval 'FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)' > evidence/logs/analytic-rotation.json
$B click '#open-import'
$B upload '#import-file' "$ROOT/evidence/tests/analytic-csg.json"
$B wait --fn 'FieldStudio.getScene().title === "Analytic CSG check"'
for op in union subtract intersect smoothUnion smoothSubtract; do
 $B select '#object-operation' "$op"
 $B eval 'FieldStudio.inspectPixel(document.getElementById("viewport").clientWidth/2,document.getElementById("viewport").clientHeight/2)' > "evidence/logs/analytic-$op.json"
done
$B screenshot evidence/screenshots/23-analytic-csg.png
