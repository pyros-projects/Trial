"""T11: settings change real simulation values — item density & belt speed set belt throughput,
machine speed scales production; deterministic seeds + grid size for seeded maps."""
import os, json, time
from ab import ab, ev, key, click_cell, shot, LOG

URL = "file://" + os.path.abspath("index.html")
res = {}
RATE = "(()=>{const r=STATS.hDelivI[IT.iron_ore];let a=0;for(let j=0;j<6;j++)a+=r.last(j);return +(a/6).toFixed(2)})()"
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 900)
ab("select", "#presetSel", "congested"); time.sleep(0.5)
# turn the saturated collector belt into a pure throughput probe: replace the splitter with a hub
key("x"); click_cell(14, 16); key("y"); click_cell(14, 16); key("v")
res["0_probe"] = ev("structAt(14,16)&&structAt(14,16).type")
ab("click", "#tabs button[data-tab=settings]"); time.sleep(0.3)
ab("select", "#speedSel", "4"); ev("document.activeElement.blur();1")

def measure(label, density, belt):
    ab("select", "#sDen", str(density)); ab("select", "#sBelt", str(belt)); ev("document.activeElement.blur();1")
    time.sleep(3.5)                       # ~14 s simulated: let the belt re-settle, then 6 s window
    res[label] = {"density": density, "beltMult": belt, "capacity_per_s": round(1.5 * belt * density, 2), "measured_per_s": ev(RATE)}

# (a) free-flowing belt fed only by side-loading extractors
measure("1_sideload_fed_density3_belt1", 3, 1)
measure("2_sideload_fed_density4_belt1", 4, 1)
measure("3_sideload_fed_density2_belt1", 2, 1)
measure("4_sideload_fed_density3_belt2", 3, 2)

# (b) raw belt capacity: let the line jam (compressed queue), then open the end into a hub and time the drain
def drain(label, density, belt):
    ab("select", "#presetSel", "congested"); time.sleep(0.3)
    ab("click", "#tabs button[data-tab=settings]"); time.sleep(0.2)
    ab("select", "#sDen", str(density)); ab("select", "#sBelt", str(belt)); ab("select", "#speedSel", "4"); ev("document.activeElement.blur();1")
    time.sleep(6)                          # ~24 s simulated: collector belt packs solid
    packed = ev("[6,7,8,9,10,11,12,13].map(x=>structAt(x,16).items.length).join(',')")
    key("x"); click_cell(14, 16); key("y"); click_cell(14, 16); key("v")
    time.sleep(2.2)                        # ~9 s simulated of draining the compressed queue
    r = ev("(()=>{const q=STATS.hDelivI[IT.iron_ore];return [q.last(0),q.last(1),q.last(2),q.last(3),q.last(4)]})()")
    res[label] = {"density": density, "beltMult": belt, "packed_items_per_tile": packed, "capacity_per_s": round(1.5 * belt * density, 2),
                  "last5s_per_s": r, "measured_per_s": round(sum(r[:4]) / 4, 2)}

drain("5_compressed_drain_density3_belt1", 3, 1)
drain("6_compressed_drain_density4_belt1", 4, 1)
drain("7_compressed_drain_density3_belt2", 3, 2)
ab("select", "#sDen", "3"); ab("select", "#sBelt", "1")
# ---- machine speed doubles the starter line output
ab("select", "#presetSel", "starter"); time.sleep(0.3)
ab("click", "#tabs button[data-tab=settings]"); time.sleep(0.2)
ab("select", "#speedSel", "4"); ev("document.activeElement.blur();1")
time.sleep(8)
g1 = ev("+(STATS.hProd[IT.gear].avg(10)*60).toFixed(1)")
ab("select", "#sMach", "2"); ev("document.activeElement.blur();1")
time.sleep(8)
g2 = ev("+(STATS.hProd[IT.gear].avg(10)*60).toFixed(1)")
res["5_machine_speed"] = {"gears_per_min_x1": g1, "gears_per_min_x2": g2, "power_kW": round(ev("FW.power().D"))}
ab("select", "#sMach", "1")
ab("select", "#speedSel", "1")
# ---- seeded maps: same seed -> identical map; other seed -> different; grid size honoured
def newmap(seed, grid):
    ab("click", "#tabs button[data-tab=settings]"); time.sleep(0.2)
    ab("fill", "#sSeed", str(seed)); ev("document.querySelector('#sSeed').dispatchEvent(new Event('change'));1")
    ab("select", "#sGrid", grid)
    ab("click", "#sNewMap"); time.sleep(0.5)
    return ev("({w:W.w,h:W.h,seed:SET.seed,mapHash:hash32(JSON.stringify([rle(W.terrain),rle(W.dep),[...W.depAmt].filter((v,i)=>W.dep[i])])).toString(16)})")
res["6_seed777_64x40_a"] = newmap(777, "64x40")
shot("t11-seeded-map")
res["6_seed777_64x40_b"] = newmap(777, "64x40")
res["6_seed778_64x40"] = newmap(778, "64x40")
res["6_seed777_32x20"] = newmap(777, "32x20")
res["6_same_seed_identical"] = res["6_seed777_64x40_a"]["mapHash"] == res["6_seed777_64x40_b"]["mapHash"]
res["6_diff_seed_differs"] = res["6_seed777_64x40_a"]["mapHash"] != res["6_seed778_64x40"]["mapHash"]
# preset determinism: rebuilding a preset twice yields the same state hash
res["7_preset_hash"] = ev("(()=>{buildWorld('sandbox','bus',SET.seed);const a=FW.stateHash();buildWorld('sandbox','bus',SET.seed);return [a,FW.stateHash()]})()")
ev("startWorld('sandbox','starter',true);1")
res["errors"] = ab("errors")
print(json.dumps(res, indent=1))
open("evidence/logs/t11.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
