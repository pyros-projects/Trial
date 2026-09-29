#!/bin/bash
set -e
B=./evidence/tests/browser.sh
$B eval '({position:FieldStudio.getScene().objects[1].position,camera:FieldStudio.getScene().camera})' > evidence/logs/drag-before.json
$B eval --stdin > evidence/logs/axis-target.json <<'JS'
(()=>{const h=document.querySelector('#gizmo .handle[data-axis="0"]'),r=document.getElementById('viewport').getBoundingClientRect();return {x:r.left+Number(h.getAttribute('cx')),y:r.top+Number(h.getAttribute('cy'))};})();
JS
read -r axis_x axis_y < <(python3 - <<'PY'
import json
p=json.load(open('evidence/logs/axis-target.json'));print(round(p['x']),round(p['y']))
PY
)
axis_end=$(python3 -c 'import sys;print(int(sys.argv[1])+30)' "$axis_x")
$B mouse move "$axis_x" "$axis_y"
$B mouse down
$B mouse move "$axis_end" "$axis_y"
$B mouse up
$B eval '({position:FieldStudio.getScene().objects[1].position,camera:FieldStudio.getScene().camera})' > evidence/logs/drag-after.json
$B screenshot evidence/screenshots/18-axis-translation.png
$B press Control+z
$B eval 'FieldStudio.getScene().objects[1].position' > evidence/logs/drag-undo.json
$B press Control+Shift+z
$B eval 'FieldStudio.getScene().objects[1].position' > evidence/logs/drag-redo.json
$B press Control+z
$B mouse move 800 200
$B mouse down
$B mouse move 880 230
$B mouse up
$B eval 'FieldStudio.getScene().camera' > evidence/logs/camera-orbit.json
$B mouse move 800 250
$B mouse down right
$B mouse move 835 275
$B mouse up right
$B mouse wheel -120
$B eval 'FieldStudio.getScene().camera' > evidence/logs/camera-pan-zoom.json
$B press f
$B eval 'FieldStudio.getScene().camera' > evidence/logs/camera-focus.json
$B press r
$B eval 'FieldStudio.getScene().camera' > evidence/logs/camera-reset.json
for mode in 0 1 2 3 4 5 6 7; do
 $B select '#view-mode' "$mode"
 $B screenshot "evidence/screenshots/mode-$mode.png"
 $B eval 'FieldStudio.getDiagnostics()' > "evidence/logs/mode-$mode.json"
done
$B click '#tab-render'
$B snapshot -i > evidence/logs/render-controls-snapshot.txt
$B select '#settings-sliceAxis' z
$B find label 'Slice range' fill '3'
$B screenshot evidence/screenshots/19-sdf-slice.png
$B select '#view-mode' 0
$B select '#settings-resolution' 0.5
$B find label 'Hit epsilon' fill '0.001'
$B find label 'Max distance' fill '80'
$B select '#settings-shadows' 48
$B select '#settings-ao' 6
$B select '#settings-reflections' 2
$B select '#settings-background' slate
$B click '#toggle-grid'
$B eval '({settings:FieldStudio.getScene().settings,diagnostics:FieldStudio.getDiagnostics()})' > evidence/logs/quality-half.json
$B select '#settings-resolution' 1
$B screenshot evidence/screenshots/20-native-quality.png
$B eval '({settings:FieldStudio.getScene().settings,diagnostics:FieldStudio.getDiagnostics()})' > evidence/logs/quality-native.json
$B select '#settings-resolution' 0.5
