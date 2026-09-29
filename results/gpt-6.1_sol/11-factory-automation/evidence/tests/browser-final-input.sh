#!/usr/bin/env bash
set -euo pipefail
ab(){ agent-browser --session ferro-import-text "$@"; }
ab set viewport 1280 800
ab press V
ab mouse move 640 330
ab mouse down
ab mouse up
ab eval 'window.qaPanBefore={camera:Ferro.camera,tick:Ferro.factory.tick,paused:Ferro.diagnostics().paused,count:Ferro.factory.cells.length};true'
node evidence/tests/native-space.cjs down
ab mouse down
ab mouse move 660 340
ab mouse move 690 355
ab mouse move 710 360
ab mouse up
node evidence/tests/native-space.cjs up
ab eval '(()=>{const d=Ferro.diagnostics(),c=Ferro.camera;if(c.x<=qaPanBefore.camera.x||c.y<=qaPanBefore.camera.y||d.paused!==qaPanBefore.paused||d.tick!==qaPanBefore.tick||Ferro.factory.cells.length!==qaPanBefore.count)throw Error("Pan conflicts with simulation or construction");return {status:"PASS: continuous Space-drag pans without toggling pause or building",before:qaPanBefore.camera,after:c};})()'
ab press Space
ab wait --fn 'Ferro.factory.tick>=qaPanBefore.tick+5'
ab press Space
ab eval '(()=>{if(!Ferro.diagnostics().paused||Ferro.factory.tick<qaPanBefore.tick+5)throw Error("Space toggle failed");window.qaStepTick=Ferro.factory.tick;return "PASS: keyboard pause and resume";})()'
ab press .
ab eval '(()=>{if(!Ferro.diagnostics().paused||Ferro.factory.tick!==qaStepTick+1)throw Error("Single-step key failed");return "PASS: single-step keyboard advances exactly one paused tick";})()'
ab find role button click --name 'Fit factory to view' --exact
ab errors
ab console
ab network requests
