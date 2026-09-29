"""T1: build a complete extraction -> transport -> processing -> delivery chain in
Contract 1 using only real pointer + keyboard input, then observe the result."""
import os, time, json
from ab import ab, ev, key, click_cell, drag_cells, shot, cell, move, LOG

URL = "file://" + os.path.abspath("index.html")
res = {}
ab("set", "viewport", 1280, 800)
ab("open", URL)
ab("wait", 900)
ab("select", "#modeSel", "campaign")
ab("wait", 400)
ab("find", "role", "button", "click", "--name", "Start contract")
ab("wait", 300)
res["start"] = ev("({lvl:W.levelId,credits:W.credits,structs:W.structs.size,tick:W.tick})")
cx, cy = cell(20, 22)          # focus canvas with a harmless click on empty ground
move(cx, cy); ab("mouse", "down", "left"); ab("mouse", "up", "left")

key("5")                      # extractor tool
click_cell(7, 7); click_cell(7, 8)
res["after_extractors"] = ev("({n:FW.count('extractor'),tool:FW.tool,credits:W.credits})")
key("1")                      # belt tool: one drag with an automatic corner
drag_cells([(8, 7), (8, 12), (14, 12)])
res["after_belt1"] = ev("({belts:FW.count('belt'),dirs:[...FW.W.structs.values()].filter(s=>s.type==='belt').map(s=>s.x+','+s.y+':'+'ESWN'[s.dir]).join(' ')})")
key("6")                      # smelter
click_cell(15, 12)
key("1")
drag_cells([(16, 12), (27, 12)])
key("0")                      # power pole line: drag places poles every 6 tiles
drag_cells([(10, 10), (16, 10)])
key("5"); click_cell(6, 18)   # coal extractor feeding the generator
key("1"); drag_cells([(7, 18), (8, 18)])
key("v")
res["built"] = ev("""({structs:[...W.structs.values()].map(s=>s.type[0]+s.x+','+s.y).join(' '),credits:W.credits,spent:W.spent,
  undo:undoStack.length,unpowered:TOPO.consumers.filter(c=>c.net<0).length,nets:TOPO.nets.length})""")
shot("t1-01-built")
t0 = ev("W.tick")
ab("wait", 12000)
res["after_12s"] = ev("""(()=>{const sm=[...W.structs.values()].find(s=>s.type==='smelter');const ex=[...W.structs.values()].filter(s=>s.type==='extractor');
 return {tick:W.tick,itemsOnBelts:FW.items(),delivered:W.camp.got,smelter:{st:ST_INFO[sm.st][0],inp:sm.inp[IT.iron_ore],prog:+sm.prog.toFixed(2),req_kW:+sm.req.toFixed(1),sat:sm.sat},
 extractors:ex.map(e=>ST_INFO[e.st][0]+' buf'+e.buf),power:FW.power(),gen:(()=>{const g=[...W.structs.values()].find(s=>s.type==='generator');return {out:g.out,fuel:g.fuel}})(),
 credits:W.credits}})()""")
shot("t1-02-running")
print(json.dumps(res, indent=1))
open("evidence/logs/t1.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
