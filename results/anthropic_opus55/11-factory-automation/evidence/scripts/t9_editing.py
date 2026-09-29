"""T9: area selection, copy/paste, move (drag + G), eyedropper, rotate selection, area upgrade,
invalid placement feedback, recipe / tier / module configuration through the inspector."""
import os, json, time
from ab import ab, ev, key, click_cell, drag_cells, shot, cell, move, LOG

URL = "file://" + os.path.abspath("index.html")
res = {}
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 1000)
click_cell(30, 25)
# ---- marquee select + copy + paste
drag_cells([(9, 9), (13, 15)])
res["1_marquee"] = ev("({selected:FW.selection.size,types:[...FW.selection].map(i=>W.structs.get(i).type).sort().join(',')})")
key("Control+c")
res["2_copy"] = ev("({tool:FW.tool,clip:clipboard&&clipboard.items.length})")
n0 = ev("W.structs.size")
# find a free 4x5 area inside the visible canvas for the paste
ax, ay = ev("""(()=>{const [x0,y0]=screenToWorld(0,0),[x1,y1]=screenToWorld(VW,VH);for(let y=Math.ceil(y0)+4;y<y1-6;y++)for(let x=Math.ceil(x0)+1;x<x1-5;x++){let ok=true;for(let j=0;j<5&&ok;j++)for(let i=0;i<4&&ok;i++){if(!inb(x+i,y+j)||structAt(x+i,y+j)||W.terrain[cidx(x+i,y+j)])ok=false}if(ok)return [x+2,y+2]}return [0,0]})()""")
res["3_paste_at"] = [ax, ay]
sx, sy = cell(ax, ay); move(sx, sy); time.sleep(0.3)
shot("t9-01-paste-ghost")
ab("mouse", "down", "left"); ab("mouse", "up", "left")
res["3_paste"] = ev(f"({{before:{n0},after:W.structs.size,smelterRecipe:(()=>{{const s=[...W.structs.values()].filter(s=>s.type==='smelter'&&(s.x!==10));return s.map(q=>RECIPES[q.cfg.rec].id)}})()}})")
key("Escape"); key("Control+z")
res["3_undo_paste"] = ev("W.structs.size")
# ---- move by dragging a selected structure
click_cell(9, 17)                                           # select the solar panel
drag_cells([(9, 17), (11, 17)])
res["4_drag_move"] = ev("({old:structAt(9,17)&&structAt(9,17).type,new:structAt(11,17)&&structAt(11,17).type})")
key("Control+z")
res["4_undo_move"] = ev("({back:structAt(9,17)&&structAt(9,17).type})")
# ---- move with G (keyboard) — hub one tile to the right
click_cell(21, 12); key("g"); click_cell(22, 13)
res["5_g_move"] = ev("({old:!!structAt(21,12),hub:structAt(22,13)&&structAt(22,13).type,tool:FW.tool})")
key("Control+z")
# ---- eyedropper
key("q"); click_cell(15, 12)
res["6_eyedrop"] = ev("({tool:FW.tool,recipe:RECIPES[BP.assembler.cfg.rec].id,dir:BP.assembler.dir})")
key("Escape")
# ---- rotate a selected splitter with R, back with Shift+R
click_cell(9, 12); key("r")
r1 = ev("structAt(9,12).dir"); key("Shift+r")
res["7_rotate_selection"] = {"after_R": r1, "after_shiftR": ev("structAt(9,12).dir")}
key("Escape")
# ---- area upgrade
key("u"); drag_cells([(16, 12), (20, 12)]); key("v")
res["8_area_upgrade"] = ev("[16,17,18,19,20].map(x=>TIER_NAME[structAt(x,12).tier]).join(',')")
key("Control+z")
res["8_undo"] = ev("[16,17,18,19,20].map(x=>TIER_NAME[structAt(x,12).tier]).join(',')")
# ---- invalid placement feedback: extractor off-deposit, smelter on occupied cell
key("5"); sx, sy = cell(14, 18); move(sx, sy); time.sleep(0.4)
shot("t9-02-invalid-extractor")
n1 = ev("W.structs.size"); ab("mouse", "down", "left"); ab("mouse", "up", "left"); time.sleep(0.2)
res["9_invalid_extractor"] = {"placed": ev("W.structs.size") - n1, "toast": ev("[...document.querySelectorAll('.toast')].slice(-1)[0]?.textContent")}
key("6"); sx, sy = cell(15, 12); move(sx, sy); time.sleep(0.3)
res["9_occupied_plan"] = ev("planBuild('smelter',[{x:15,y:12,d:0}]).cells[0].reason")
shot("t9-03-occupied")
key("v")
# ---- recipe change through the inspector: smelter switched to copper rejects iron ore
click_cell(10, 10); time.sleep(0.4)
ab("select", "#tab-inspect [data-cfg=rec]", str(ev("RC.copper_plate"))); time.sleep(0.3)
ev("document.activeElement.blur();1")
ab("select", "#speedSel", "4"); ev("document.activeElement.blur();1"); time.sleep(4)
res["10_wrong_recipe"] = ev("(()=>{const s=structAt(10,10),b=structAt(9,10);return {recipe:RECIPES[s.cfg.rec].id,status:statusOf(s)[0],feedBelt:statusOf(b)[0],feedItems:b.items.length,frontItem:b.items[0]?itemName(b.items[0].t):null}})()")
key("Control+z"); time.sleep(0.2)
res["10_undo_recipe"] = ev("RECIPES[structAt(10,10).cfg.rec].id")
# ---- tier requirement: Motor needs Assembler Mk2
click_cell(15, 12); time.sleep(0.3)
ab("select", "#tab-inspect [data-cfg=rec]", str(ev("RC.motor"))); ev("document.activeElement.blur();1"); time.sleep(0.5)
res["11_motor_mk1"] = ev("statusOf(structAt(15,12))[0]")
ab("click", "#tab-inspect [data-a=up]"); time.sleep(0.8)
res["11_motor_mk2"] = ev("({tier:TIER_NAME[structAt(15,12).tier],status:statusOf(structAt(15,12))[0]})")
key("Control+z"); key("Control+z")
# ---- module: speed module raises speed & power
click_cell(15, 12); time.sleep(0.3)
p0 = ev("basePower(structAt(15,12))")
ab("select", "#tab-inspect [data-cfg=mod]", "1"); ev("document.activeElement.blur();1"); time.sleep(0.3)
res["12_speed_module"] = {"kW_before": p0, "kW_after": ev("basePower(structAt(15,12))"), "speedMult": ev("MODS[structAt(15,12).cfg.mod].spd")}
shot("t9-04-inspector")
ab("select", "#speedSel", "1")
res["errors"] = ab("errors")
print(json.dumps(res, indent=1))
open("evidence/logs/t9.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
