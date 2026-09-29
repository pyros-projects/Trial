"""T3: backpressure via deleting the hub, undo/redo, belt rotation, inserter+chest,
splitter/merger distribution, area delete — all through real pointer/keyboard input."""
import os, json, time
from ab import ab, ev, key, click_cell, drag_cells, shot, cell, move, LOG

URL = "file://" + os.path.abspath("index.html")
res = {}
ST = """(()=>{const g=(x,y)=>{const s=structAt(x,y);return s?statusOf(s)[0]:'-'};
 return {tick:W.tick,hub:FW.count('hub'),asm:g(15,12),smA:g(10,10),smB:g(10,14),ex1:g(4,7),ex2:g(4,9),split:g(9,12),
 beltItems:FW.items(),gearBelt:[16,17,18,19,20].map(x=>structAt(x,12)?structAt(x,12).items.length:-1).join(','),
 powerD:Math.round(FW.power().D),delivered:[...W.delivered].reduce((a,b)=>a+b,0)}})()"""
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 1000)
click_cell(30, 25)
ab("select", "#speedSel", "4"); ev("document.activeElement.blur();1")
time.sleep(4)
res["0_baseline"] = ev(ST)
# --- delete the hub with the delete tool -> backpressure ripples upstream
key("x"); click_cell(21, 12); key("v")
res["1_hub_deleted"] = ev(ST)
time.sleep(3)
res["2a_after_12s_sim"] = ev(ST)
ab("select", "#speedSel", "8"); ev("document.activeElement.blur();1")
time.sleep(11)
res["2_after_backpressure"] = ev(ST)
ab("select", "#speedSel", "4"); ev("document.activeElement.blur();1")
res["2_issues"] = ev("STATS.issues.map(i=>i.title+' — '+i.detail)")
ev("OV.blocked=true;renderChips();1")
shot("t3-01-backpressure")
ev("OV.blocked=false;renderChips();1")
# --- undo restores the hub; flow resumes
key("Control+z")
res["3_after_undo"] = ev(ST)
time.sleep(5)
res["4_flow_resumed"] = ev(ST)
# --- redo/undo round trip
key("Control+y"); res["5_redo_hub"] = ev("FW.count('hub')")
key("Control+z"); res["5_undo_again_hub"] = ev("FW.count('hub')")
# --- rotate a belt under the cursor with R (select tool), then back with Shift+R
sx, sy = cell(18, 12); move(sx, sy); time.sleep(0.2)
d0 = ev("structAt(18,12).dir"); key("r"); time.sleep(0.2)
d1 = ev("structAt(18,12).dir")
time.sleep(2.5)
res["6_rotated"] = {"dir_before": d0, "dir_after_R": d1, "oc_marker": ev("structAt(18,12).oc"),
                    "belt_18_12_front_blocked": ev("!!structAt(18,12).blk"), "items_19_12": ev("structAt(19,12).items.length")}
shot("t3-02-rotated-belt")
move(sx, sy); key("Shift+r"); time.sleep(0.2)
res["6_rotated_back"] = ev("structAt(18,12).dir")
# --- inserter pulls gears off the belt into a chest; a new pole powers it
key("8"); click_cell(18, 14)
key("4"); key("r")                      # inserter facing South (picks from belt north of it)
res["7_inserter_dir"] = ev("BP.inserter.dir")
click_cell(18, 13)
key("0"); click_cell(19, 13)
key("v")
time.sleep(8)
res["8_inserter_chest"] = ev("""(()=>{const i=structAt(18,13),c=structAt(18,14);return {ins:i&&{dir:i.dir,net:i.net,status:statusOf(i)[0],hand:i.hand},chest:c&&{total:c.total,gears:c.inv[IT.gear]}}})()""")
# --- splitter/merger distribution
res["9_split_merge"] = ev("""(()=>{const sp=structAt(9,12),a=structAt(10,10),b=structAt(10,14),m=structAt(12,12);
  const hsum=s=>s.hist?Array.from(s.hist).slice(0,s.hn).reduce((x,y)=>x+y,0):0;
  return {splitter_items_per_s_hist_sum:hsum(sp),smelterA_util:+a.util.toFixed(2),smelterB_util:+b.util.toFixed(2),
          merger_moved_hist_sum:hsum(m),smelterA_ore_in:a.inp[IT.iron_ore],smelterB_ore_in:b.inp[IT.iron_ore]}})()""")
shot("t3-03-inserter-chest")
# --- area delete with the delete tool (drag a rectangle)
key("x"); drag_cells([(18, 13), (19, 14)]); key("v")
res["10_area_delete"] = ev("({chest:FW.count('chest'),inserter:FW.count('inserter'),poles:FW.count('pole')})")
key("Control+z")
res["11_undo_area_delete"] = ev("({chest:FW.count('chest'),inserter:FW.count('inserter'),poles:FW.count('pole'),chestItems:structAt(18,14)&&structAt(18,14).total})")
ab("select", "#speedSel", "1")
res["errors"] = ab("errors")
print(json.dumps(res, indent=1))
open("evidence/logs/t3.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
