#!/usr/bin/env bash
set -euo pipefail
ab(){ agent-browser --session ferro-offline "$@"; }
ab set viewport 1280 800 2
ab network route 'http://**/*' --abort
ab network route 'https://**/*' --abort
ab set offline on
ab open file:///home/pyro/projects/naked/sol61/11-factory-automation/index.html
ab wait --fn 'Ferro.diagnostics().delivered.ironPlate>=1&&Ferro.diagnostics().delivered.wire>=1'
ab find role button click --name 'Pause simulation' --exact
ab eval '(()=>{const d=Ferro.diagnostics();if(!d.paused||d.power.draw<=0||d.delivered.ironPlate<1||d.delivered.wire<1)throw Error("Offline production did not operate");if(devicePixelRatio!==2||document.getElementById("factoryCanvas").width!==Math.round(document.getElementById("factoryCanvas").getBoundingClientRect().width*2))throw Error("High DPI canvas mismatch");return {status:"PASS",navigatorOnline:navigator.onLine,devicePixelRatio,diagnostics:d};})()'
ab screenshot evidence/screenshots/final-offline-desktop.png
ab errors
ab console
ab network requests
ab close
