#!/bin/bash
cd /home/pyro/projects/naked/opus55/_trial/17-echo-loop-puzzler
source "$(dirname "$0")/ab.sh"
fresh 7   # Chorus (was level 6 before Switchback was inserted)
[ "$(st .level)" = '"Chorus"' ] || { echo "PAGE NOT LOADED: $(st .level)"; exit 1; }
cx="(EchoLoop.state().player.x+11)"
cross6() { holdUntil ArrowRight "$cx > $2-30" 5; waitFor "(L=>!L.on && (L.per-L.phaseTick) > 26)(EchoLoop.state().lasers[$1])" 5; holdUntil ArrowRight "EchoLoop.state().player.x > $2+12" 3; }
echo "loop 1 (echo 1)"
agent-browser press ArrowLeft >/dev/null; agent-browser press e >/dev/null; sleep 0.1; echo "  carrying: $(st .player.carry)"
holdUntil ArrowRight "$cx > 300" 4; sleep 0.15; agent-browser press e >/dev/null; sleep 0.3
echo "  gate plate: $(st .plates[0]) gate: $(st .doors[0])"
cross6 0 528; cross6 1 656
goto 688
agent-browser keydown w >/dev/null; sleep 0.3; agent-browser keyup w >/dev/null; waitFor "EchoLoop.state().player.grounded && EchoLoop.state().player.y < 400" 3
goto 712
agent-browser keydown ArrowRight >/dev/null; agent-browser keydown w >/dev/null; sleep 0.28; agent-browser keyup w >/dev/null; sleep 0.15; agent-browser keyup ArrowRight >/dev/null
waitFor "EchoLoop.state().player.grounded && EchoLoop.state().player.y < 340" 3
goto 752; echo "  at timer: $(st .player) tick $(st .tick)"
waitFor "EchoLoop.state().tick >= 760" 15; agent-browser press e >/dev/null; sleep 0.15; echo "  timer: $(st .timers)"
agent-browser press r >/dev/null; waitFor "!EchoLoop.state().rewinding" 3
echo "loop 2 (echo 2)"
cross6 0 528; cross6 1 656
holdUntil ArrowRight "$cx > 830" 4; waitFor "EchoLoop.state().tick >= 690" 12
holdUntil ArrowRight "$cx > 924" 3; sleep 0.2; echo "  lift plate: $(st .plates[1]) tick $(st .tick) div: $(st .divergence)"
agent-browser press r >/dev/null; waitFor "!EchoLoop.state().rewinding" 3
echo "loop 3 (player)"
cross6 0 528; cross6 1 656
holdUntil ArrowRight "$cx > 1016" 5; echo "  on lift at tick $(st .tick)"
waitFor "EchoLoop.state().lifts[0].y <= 192.5" 12; echo "  lift top at tick $(st .tick); timer $(st .timers); sky door $(st .doors[1])"
agent-browser screenshot evidence/screenshots/25-chorus-top.png | tail -1
holdUntil ArrowRight "EchoLoop.state().won || EchoLoop.state().sessionState!=='play'" 6
echo "result: won=$(st .won) state=$(st .sessionState) div=$(st .divergence) stats=$(st .stats)"
sleep 1.4; agent-browser screenshot evidence/screenshots/26-chorus-victory.png | tail -1; agent-browser errors
echo DONE
