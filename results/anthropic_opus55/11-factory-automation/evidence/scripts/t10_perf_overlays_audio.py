"""T10: stress-test performance at 1x/4x/16x, every overlay toggled via its chip with screenshots,
Web Audio state after a user gesture, network requests + console errors."""
import os, json, time
from ab import ab, ev, key, click_cell, shot, cell, move, LOG, visible_free_cell

URL = "file://" + os.path.abspath("index.html")
res = {}
P = "({fps:+fps.toFixed(1),actualSpeed:+(simRate/60).toFixed(2),setSpeed:SET.speed,items:FW.items(),structs:W.structs.size,lagging,sat:+FW.power().sat.toFixed(2),delivered:[...W.delivered].reduce((a,b)=>a+b,0)})"
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 1000)
ab("network", "requests", "--clear", check=False)
# ---- audio: first user gesture unlocks the AudioContext, then a build plays sounds
res["1_audio_before_gesture"] = ev("({ctx:AU.ctx?AU.ctx.state:null,played:AU.played})")
fx, fy = visible_free_cell(6, 6)
click_cell(fx, fy)
res["1_audio_after_click"] = ev("({ctx:AU.ctx?AU.ctx.state:null,played:AU.played})")
key("8"); click_cell(fx, fy); key("v")
time.sleep(0.4)
res["1_audio_after_gesture"] = ev("({ctx:AU.ctx?AU.ctx.state:null,played:AU.played,sampleRate:AU.ctx&&AU.ctx.sampleRate,gain:AU.master&&AU.master.gain.value})")
key("Control+z")
# ---- overlays via the floating chips (real clicks)
ab("select", "#presetSel", "congested"); time.sleep(8)
res["2_overlays"] = {}
for k in ["flow", "graph", "power", "util", "jam", "blocked"]:
    ab("click", f"#chips .chip[data-ov={k}]"); time.sleep(0.5)
    res["2_overlays"][k] = ev(f"OV.{k}")
    shot(f"t10-overlay-{k}")
    ab("click", f"#chips .chip[data-ov={k}]"); time.sleep(0.2)
ab("click", "#chips .chip[data-ov=status]"); time.sleep(0.2)
res["2_status_off"] = ev("OV.status")
ab("click", "#chips .chip[data-ov=status]")
# overlays stay usable while building: belt tool + utilization overlay
ab("click", "#chips .chip[data-ov=util]")
key("1"); sx, sy = cell(*visible_free_cell(3, 3)); move(sx, sy); time.sleep(0.3); shot("t10-overlay-while-building"); key("Escape")
ab("click", "#chips .chip[data-ov=util]")
# ---- stress test performance
ab("select", "#presetSel", "stress"); time.sleep(6)
res["3_stress_1x"] = ev(P)
shot("t10-stress-1x")
ab("select", "#speedSel", "4"); ev("document.activeElement.blur();1"); time.sleep(5)
res["3_stress_4x"] = ev(P)
ab("select", "#speedSel", "16"); ev("document.activeElement.blur();1"); time.sleep(5)
res["3_stress_16x"] = ev(P)
ab("select", "#speedSel", "1")
# zoomed-out full view of all moving items
key("Home"); time.sleep(3)
res["3_stress_fit_1x"] = ev(P)
shot("t10-stress-fit")
res["4_network_requests"] = ab("network", "requests", check=False)
res["4_page_errors"] = ab("errors")
res["4_console_errors"] = ab("console", check=False)
print(json.dumps(res, indent=1))
open("evidence/logs/t10.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
