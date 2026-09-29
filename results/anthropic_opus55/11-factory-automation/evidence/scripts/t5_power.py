"""T5: energy system — brownout scales machine speed, removing a pole cuts power,
fuel is burned, battery discharges, Hard difficulty trips the breaker, Easy restores."""
import os, json, time
from ab import ab, ev, key, click_cell, shot, cell, move, LOG

URL = "file://" + os.path.abspath("index.html")
res = {}
NET = "(()=>{const n=TOPO.nets[0];const g=[...W.structs.values()].find(s=>s.type==='generator');const b=[...W.structs.values()].find(s=>s.type==='battery');return {tick:W.tick,D:Math.round(n.D),cap:Math.round(n.cap),sat:+n.sat.toFixed(3),trip:n.root.trip,trips:W.trips,genOut:Math.round(g.out),genFuel:g.fuel,fuelUsed:W.fuelUsed,batt:{MJ:+(b.stored/1e6).toFixed(2),flow:Math.round(b.flow)}}})()"
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 900)
ab("select", "#presetSel", "power"); ab("wait", 800)
click_cell(30, 26)
time.sleep(3)
res["1_brownout"] = ev(NET)
res["1_statuses"] = ev("(()=>{const o={};for(const s of W.structs.values())if(isMachine(s.type)){const k=statusOf(s)[0];o[k]=(o[k]||0)+1}return o})()")
ev("OV.power=true;renderChips();1")
shot("t5-01-brownout-power-overlay")
ev("OV.power=false;renderChips();1")
# ---- measure crafting speed tick-by-tick while paused (real '.' key presses)
key("Space")
sm = ev("(()=>{const l=[...W.structs.values()].filter(s=>s.type==='smelter'&&s.craft&&s.prog<0.6&&s.cfg.rec===RC.iron_plate);return l[0]?[l[0].x,l[0].y]:null})()")
if not sm:
    for _ in range(90):
        key(".")
        sm = ev("(()=>{const l=[...W.structs.values()].filter(s=>s.type==='smelter'&&s.craft&&s.prog<0.6&&s.cfg.rec===RC.iron_plate);return l[0]?[l[0].x,l[0].y]:null})()")
        if sm: break
x, y = sm
samples = []
for _ in range(20):
    before = ev(f"(()=>{{const s=structAt({x},{y});return [s.prog]}})()")[0]
    key(".")
    after = ev(f"(()=>{{const s=structAt({x},{y});return [s.prog,s.sat]}})()")
    samples.append({"dprog": after[0] - before, "sat_this_tick": after[1], "expected": after[1] / (2.0 * 60)})
err = max(abs(s["dprog"] - s["expected"]) for s in samples)
res["2_speed_scaling"] = {"smelter": sm, "ticks": len(samples), "mean_sat": round(sum(s["sat_this_tick"] for s in samples) / len(samples), 3),
                          "mean_dprog": sum(s["dprog"] for s in samples) / len(samples), "full_power_dprog": 1 / 120, "max_abs_error": err}
# ---- cut power: delete the pole feeding the north smelters, check they stop
key("x"); click_cell(7, 7); key("v")
for _ in range(5): key(".")
res["3_pole_removed"] = ev("(()=>{const s=structAt(5,5),e=structAt(4,5);return {smelter:statusOf(s)[0],net:s.net,sat:s.sat,extractor:statusOf(e)[0]}})()")
p0 = ev("structAt(5,5).prog")
for _ in range(10): key(".")
res["3_prog_frozen"] = {"before": p0, "after_10_ticks": ev("structAt(5,5).prog")}
key("Control+z")
for _ in range(3): key(".")
res["4_pole_restored"] = ev("(()=>{const s=structAt(5,5);return {status:statusOf(s)[0],net:s.net,sat:+s.sat.toFixed(3)}})()")
key("Space")
# ---- Hard difficulty: sustained overload trips the breaker
ab("click", "#tabs button[data-tab=settings]"); time.sleep(0.3)
ab("select", "#sPow", "hard"); ev("document.activeElement.blur();1")
ab("select", "#speedSel", "4"); ev("document.activeElement.blur();1")
trip_seen = None
for _ in range(25):
    r = ev(NET)
    if r["trip"] > 0:
        trip_seen = r; break
    time.sleep(0.4)
res["5_hard_trip"] = trip_seen
if trip_seen:
    res["5_statuses_during_trip"] = ev("(()=>{const o={};for(const s of W.structs.values())if(isMachine(s.type)){const k=statusOf(s)[0];o[k]=(o[k]||0)+1}return o})()")
    shot("t5-02-breaker-tripped")
time.sleep(2)
res["5_after"] = ev(NET)
# ---- Easy difficulty: +40% generation
ab("select", "#sPow", "easy"); ev("document.activeElement.blur();1")
time.sleep(3)
res["6_easy"] = ev(NET)
ab("select", "#sPow", "normal"); ab("select", "#speedSel", "1")
res["errors"] = ab("errors")
print(json.dumps(res, indent=1))
open("evidence/logs/t5.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
