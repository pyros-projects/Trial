#!/bin/bash
set -e
B=./evidence/tests/browser.sh
$B click '[data-preset="soft"]'
$B click '#tab-object'
$B click '#delete'
$B click '#delete'
$B click '#delete'
$B click '#delete'
$B click '#add-object'
$B click '[data-primitive="sphere"]'
$B find label 'Scene name' fill 'CSG workflow'
$B find label 'Object name' fill 'CSG shell'
$B find label 'Position X' fill '-0.2'
$B find label 'Position Y' fill '0.1'
$B find label 'Position Z' fill '0'
$B find label 'Radius' fill '1.2'
$B find label 'Scale Y' fill '1.1'
$B find label 'Rotation Z' fill '18'
$B click '#add-object'
$B click '[data-primitive="box"]'
$B find label 'Object name' fill 'Box cutter'
$B find label 'Position X' fill '0.45'
$B find label 'Position Y' fill '0.1'
$B find label 'Position Z' fill '0.5'
$B find label 'Rotation Y' fill '20'
$B find label 'Scale Z' fill '1.35'
$B press Tab
$B eval 'FieldStudio.getScene()' > evidence/logs/public-union-scene.json
$B screenshot evidence/screenshots/12-public-union.png
$B select '#object-operation' subtract
$B screenshot evidence/screenshots/13-public-subtraction.png
$B eval --stdin > evidence/logs/cut-pick-target.json <<'JS'
(()=>{const rect=document.getElementById('viewport').getBoundingClientRect();for(const y of [320,300,280,240,200])for(const x of [350,390,430,470,310]){const h=FieldStudio.inspectPixel(x,y);if(h.objectId===2)return {x:rect.left+x,y:rect.top+y,hit:h};}return {error:'No visible cutter sample found'};})();
JS
$B find role button click --name 'Select CSG shell' --exact
read -r pick_x pick_y < <(python3 - <<'PY'
import json
p=json.load(open('evidence/logs/cut-pick-target.json'));assert 'error' not in p,p
print(p['x'],p['y'])
PY
)
$B mouse move "$pick_x" "$pick_y"
$B mouse down
$B mouse up
$B eval '({pass:FieldStudio.getScene().selected===2,diagnostics:FieldStudio.getDiagnostics()})' > evidence/logs/public-cut-picking.json
$B screenshot evidence/screenshots/14-picked-cut-surface.png
$B select '#object-operation' intersect
$B screenshot evidence/screenshots/15-public-intersection.png
$B click '#move-up'
$B screenshot evidence/screenshots/16-reordered-stack.png
$B eval 'FieldStudio.getScene().objects.map(o=>({id:o.id,name:o.name,operation:o.operation}))' > evidence/logs/public-reorder.json
$B click '#move-down'
$B select '#object-material-kind' metallic
$B find label 'Material hex color' fill '#856baf'
$B press Tab
$B select '#object-material-pattern' marble
$B screenshot evidence/screenshots/17-material-metal-marble.png
