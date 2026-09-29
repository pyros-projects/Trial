"""T8: trusted touch input (CDP Input.dispatchTouchEvent) on the 390x844 phone layout:
one-finger belt drag with a corner, two-finger pinch zoom + pan, and a second finger
cancelling an in-progress build drag (no accidental placement)."""
import os, json, subprocess, time
import ab as A
from ab import ab, ev, cell, LOG

A.SESSION = "fwt"
URL = "file://" + os.path.abspath("index.html")
res = {}
ab("set", "viewport", 390, 844)
ab("open", URL); ab("wait", 1200)
ab("select", "#presetSel", "empty"); time.sleep(0.6)
ev("window._pt=[];document.querySelector('#cv').addEventListener('pointerdown',e=>_pt.push(e.pointerType),true);1")
WS = ab("get", "cdp-url").strip()

def touch(actions):
    r = subprocess.run(["node", "evidence/scripts/cdp_touch.mjs", WS, json.dumps(actions)], capture_output=True, text=True)
    LOG.append("touch " + json.dumps(actions)[:300] + " -> " + r.stdout.strip())
    return r.stdout.strip()

def free_row(y0):
    for y in range(y0, y0 + 10):
        if ev(f"(()=>{{for(let x=Math.floor(FW.cam.x)-5;x<=Math.floor(FW.cam.x)+2;x++)if(W.terrain[cidx(x,{y})]||W.dep[cidx(x,{y})]||structAt(x,{y}))return false;for(let yy={y};yy<={y}+3;yy++){{const x=Math.floor(FW.cam.x)+2;if(W.terrain[cidx(x,yy)]||structAt(x,yy))return false}}return true}})()"):
            return y
    return y0

ab("click", "#toolbar .tool[data-tool='b:belt']")
x0 = ev("Math.floor(FW.cam.x)-5"); y = free_row(ev("Math.floor(FW.cam.y)-4"))
p = [cell(x, y) for x in range(x0, x0 + 8)] + [cell(x0 + 7, y + k) for k in range(1, 4)]
acts = [{"type": "touchStart", "points": [p[0]]}] + [{"type": "touchMove", "points": [q]} for q in p[1:]] + [{"type": "touchEnd", "points": []}]
res["1_touch_drag"] = touch(acts)
time.sleep(0.3)
res["1_result"] = ev(f"({{pointerTypes:[...new Set(window._pt)],belts:FW.count('belt'),corner:structAt({x0}+7,{y})&&'ESWN'[structAt({x0}+7,{y}).dir],last:structAt({x0}+7,{y}+3)&&'ESWN'[structAt({x0}+7,{y}+3).dir]}})")
# pinch: two fingers spreading apart around the centre -> zoom in; then both moving -> pan
z0 = ev("FW.cam.z"); c0 = ev("[FW.cam.x,FW.cam.y]")
cx, cy = 195, 420
acts = [{"type": "touchStart", "points": [[cx - 40, cy], [cx + 40, cy]]}]
for k in range(1, 9):
    acts.append({"type": "touchMove", "points": [[cx - 40 - k * 12, cy], [cx + 40 + k * 12, cy]]})
for k in range(1, 7):
    acts.append({"type": "touchMove", "points": [[cx - 136 + k * 10, cy + k * 12], [cx + 136 + k * 10, cy + k * 12]]})
acts.append({"type": "touchEnd", "points": []})
before_belts = ev("FW.count('belt')")
res["2_pinch"] = touch(acts)
res["2_result"] = {"zoom_before": round(z0, 2), "zoom_after": round(ev("FW.cam.z"), 2), "cam_before": c0, "cam_after": ev("[FW.cam.x,FW.cam.y]"),
                   "belts_unchanged": ev("FW.count('belt')") == before_belts}
# second finger lands during a one-finger build drag -> drag is cancelled, nothing placed
n0 = ev("FW.count('belt')")
q = [cell(x0, y + 6), cell(x0 + 3, y + 6)]
acts = [{"type": "touchStart", "points": [q[0]]}, {"type": "touchMove", "points": [q[1]]},
        {"type": "touchStart", "points": [q[1], [q[1][0] + 60, q[1][1] + 40]]},
        {"type": "touchMove", "points": [[q[1][0] - 10, q[1][1]], [q[1][0] + 80, q[1][1] + 50]]},
        {"type": "touchEnd", "points": []}]
res["3_cancel"] = touch(acts)
res["3_result"] = {"belts_before": n0, "belts_after": ev("FW.count('belt')")}
ab("screenshot", "evidence/screenshots/t8-touch.png")
res["errors"] = ab("errors")
print(json.dumps(res, indent=1))
open("evidence/logs/t8.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
