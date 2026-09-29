"""T2: pause / single-step / simulation speed, plus proof that running at 1x or 8x
real-time yields exactly the same simulation state as pure tick stepping."""
import os, json, time
from ab import ab, ev, key, click_cell, shot, LOG

URL = "file://" + os.path.abspath("index.html")
res = {}
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 1200)
click_cell(30, 25)                                    # focus canvas (empty ground)
key("Space")
t0 = ev("W.tick"); time.sleep(1.0); t1 = ev("W.tick")
res["pause"] = {"tick_before": t0, "tick_after_1s": t1, "paused": ev("FW.paused"),
                "pausedTag": ev("getComputedStyle(document.querySelector('#pausedTag')).display")}
shot("t2-01-paused")
key(".")
t2 = ev("W.tick")
ab("click", "#btnStep")
t3 = ev("W.tick")
res["step"] = {"after_dot_key": t2, "after_step_button": t3, "delta_key": t2 - t1, "delta_button": t3 - t2}
# snapshot S0 (read-only diagnostic copy) for the determinism comparison
ev("window._S0=JSON.stringify(FW.serialize(true));window._T0=W.tick;1")

def run_realtime(speed, secs):
    ab("select", "#speedSel", str(speed))
    ev("document.activeElement.blur();1")
    key("Space")                                         # resume
    time.sleep(secs)
    key("Space")                                         # pause
    return ev("({tick:W.tick,hash:FW.stateHash(),deliv:[...W.delivered].reduce((a,b)=>a+b,0)})")

def replay(target_tick):
    return ev(f"""(()=>{{loadData(JSON.parse(window._S0));const n={target_tick}-W.tick;for(let i=0;i<n;i++)simTick();return {{tick:W.tick,hash:FW.stateHash(),deliv:[...W.delivered].reduce((a,b)=>a+b,0),ticks:n}}}})()""")

r1 = run_realtime(1, 3.0)
p1 = replay(r1["tick"])
res["speed_1x"] = {"realtime": r1, "pure_ticks": p1, "identical": r1["hash"] == p1["hash"],
                   "ticks_per_s": round((r1["tick"] - ev("window._T0")) / 3.0, 1)}
ev("loadData(JSON.parse(window._S0));1")
r8 = run_realtime(8, 2.0)
p8 = replay(r8["tick"])
res["speed_8x"] = {"realtime": r8, "pure_ticks": p8, "identical": r8["hash"] == p8["hash"],
                   "ticks_per_s": round((r8["tick"] - ev("window._T0")) / 2.0, 1)}
ab("select", "#speedSel", "1")
res["errors"] = ab("errors")
print(json.dumps(res, indent=1))
open("evidence/logs/t2.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
