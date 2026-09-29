"""T12: camera (wheel zoom, right-drag pan, WASD, Home), top-bar undo/redo/reset buttons,
help dialog, autosave slot + 'Resume' after reload."""
import os, json, time
from ab import ab, ev, key, click_cell, shot, cell, move, LOG, visible_free_cell

URL = "file://" + os.path.abspath("index.html")
res = {}
CAM = "({x:+FW.cam.x.toFixed(2),y:+FW.cam.y.toFixed(2),z:+FW.cam.z.toFixed(2)})"
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 900)
ev("localStorage.clear();1")
fx, fy = visible_free_cell(4, 4)
click_cell(fx, fy)
c0 = ev(CAM)
sx, sy = cell(fx, fy); move(sx, sy)
import subprocess
WS = ab("get", "cdp-url").strip()
subprocess.run(["node", "evidence/scripts/cdp_touch.mjs", WS, json.dumps([{"type": "mouseWheel", "x": sx, "y": sy, "deltaY": -240}, {"type": "mouseWheel", "x": sx, "y": sy, "deltaY": -240}])], capture_output=True, text=True)
time.sleep(0.2)
c1 = ev(CAM)
res["1_wheel_zoom"] = {"before": c0, "after": c1, "zoomed_in": c1["z"] > c0["z"], "cell_under_cursor_before_after": [[fx, fy], ev(f"(()=>{{const [wx,wy]=screenToWorld({sx}-document.querySelector('#cv').getBoundingClientRect().left,{sy}-document.querySelector('#cv').getBoundingClientRect().top);return [Math.floor(wx),Math.floor(wy)]}})()")]}
n0 = ev("W.structs.size")
ab("mouse", "down", "right"); move(sx - 150, sy - 80); move(sx - 300, sy - 160); ab("mouse", "up", "right")
c2 = ev(CAM)
res["2_right_drag_pan"] = {"after": c2, "panned": c2["x"] != c1["x"] and c2["y"] != c1["y"], "structures_unchanged": ev("W.structs.size") == n0}
ab("keydown", "d"); time.sleep(0.5); ab("keyup", "d")
c3 = ev(CAM)
res["3_wasd_pan"] = {"after": c3, "moved_right": c3["x"] > c2["x"]}
key("Home"); c4 = ev(CAM)
res["4_home_fit"] = c4
# ---- top-bar buttons
key("8"); fx, fy = visible_free_cell(2, 2); click_cell(fx, fy); key("v")
res["5_built_chest"] = ev(f"!!structAt({fx},{fy})")
ab("click", "#btnUndo"); res["5_after_undo_button"] = ev(f"!!structAt({fx},{fy})")
ab("click", "#btnRedo"); res["5_after_redo_button"] = ev(f"!!structAt({fx},{fy})")
ab("click", "#btnReset"); time.sleep(0.3)
res["5_after_reset"] = ev(f"({{chest:!!structAt({fx},{fy}),tick:W.tick,undo:undoStack.length}})")
# ---- help dialog
ab("click", "#btnHelp"); time.sleep(0.3)
res["6_help"] = ev("({open:document.querySelector('#modal').classList.contains('on'),title:document.querySelector('#modal .mh').textContent})")
shot("t12-help")
key("Escape"); res["6_help_closed"] = ev("!document.querySelector('#modal').classList.contains('on')")
# ---- autosave (every 30 s) and resume after reload
time.sleep(31)
res["7_autosave_slot"] = ev("slotIndex().filter(s=>s.name==='autosave').map(s=>({tick:s.tick,n:s.n}))")
saved_tick = res["7_autosave_slot"][0]["tick"] if res["7_autosave_slot"] else None
ab("open", URL); ab("wait", 1200)
res["8_resume_toast"] = ev("[...document.querySelectorAll('.toast')].map(t=>t.textContent)")
ab("find", "role", "button", "click", "--name", "Resume"); time.sleep(0.4)
import re
m = re.search(r"tick (\d+)", " ".join(res["8_resume_toast"]))
toast_tick = int(m.group(1)) if m else None
now_tick = ev("W.tick")
res["8_after_resume"] = {"tick_now": now_tick, "autosave_tick_in_toast": toast_tick, "periodic_autosave_tick": saved_tick,
                         "resumed_from_autosave": toast_tick is not None and toast_tick <= now_tick <= toast_tick + 90}
res["errors"] = ab("errors")
print(json.dumps(res, indent=1))
open("evidence/logs/t12.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
