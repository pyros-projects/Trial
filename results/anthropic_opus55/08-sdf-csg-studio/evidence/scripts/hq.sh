#!/bin/bash
# dev helper: render a still at fixed res (adaptive off, paused) and screenshot to $1
RES=${2:-0.7}
cat <<JS | agent-browser eval --stdin >/dev/null
(() => { const s = studio.scene.settings; s.adaptive = false; s.playing = false; s.res = $RES; })();
document.querySelector('#btnPerf').click(); document.querySelector('#btnPerf').click(); 'ok'
JS
sleep ${3:-3}
agent-browser eval 'document.querySelector("#btnPerf").click(); document.querySelector("#btnPerf").click(); "ok"' >/dev/null
sleep ${4:-7}
agent-browser screenshot "$1" >/dev/null && echo "saved $1 $(agent-browser eval 'JSON.stringify(studio.state().internal)')"
