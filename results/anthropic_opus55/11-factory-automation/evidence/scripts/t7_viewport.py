"""T7: a curated preset keeps producing across viewport resizes (desktop -> phone -> desktop),
mobile layout is usable (panel toggle, bottom toolbar), HiDPI backing store."""
import os, json, time
from ab import ab, ev, key, click_cell, shot, cell, move, LOG

URL = "file://" + os.path.abspath("index.html")
res = {}
D = "({tick:W.tick,delivered:[...W.delivered].reduce((a,b)=>a+b,0),items:FW.items(),vw:innerWidth,vh:innerHeight,canvas:[document.querySelector('#cv').width,document.querySelector('#cv').height],css:[VW,VH],dpr:DPR,zoom:+FW.cam.z.toFixed(1)})"
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 900)
ab("select", "#presetSel", "balanced"); time.sleep(6)
res["1_desktop"] = ev(D)
ab("set", "viewport", 390, 844); time.sleep(6)
res["2_phone"] = ev(D)
res["2_layout"] = ev("""(()=>{const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]};
 return {toolbar:r('#toolbar'),stage:r('#stage'),hud:r('#hud'),panelTransform:getComputedStyle(document.querySelector('#panel')).transform,
 horizScroll:document.documentElement.scrollWidth>innerWidth,chipsDisplay:getComputedStyle(document.querySelector('#chips')).display}})()""")
shot("t7-01-phone")
ab("click", "#btnPanel"); time.sleep(0.5)
ab("click", "#tabs button[data-tab=stats]"); time.sleep(1.2)
res["3_panel_open"] = ev("({open:document.querySelector('#panel').classList.contains('open'),tab:curTab,panelRect:(()=>{const b=document.querySelector('#panel').getBoundingClientRect();return [Math.round(b.y),Math.round(b.height)]})()})")
shot("t7-02-phone-panel")
ab("click", "#btnPanelClose"); time.sleep(0.4)
# tap a toolbar tool on the phone layout, then place a belt on the map with the pointer
ab("click", "#toolbar .tool[data-tool='b:belt']")
bx, by = ev("[Math.floor(FW.cam.x)+2,Math.floor(FW.cam.y)+4]")
while ev(f"!!structAt({bx},{by})||W.terrain[cidx({bx},{by})]>0"): bx += 1
click_cell(bx, by)
res["4_phone_build"] = ev(f"({{cell:[{bx},{by}],tool:FW.tool,belt:!!structAt({bx},{by})&&structAt({bx},{by}).type}})")
key("Escape")
ab("set", "viewport", 1280, 800); time.sleep(5)
res["5_back_desktop"] = ev(D)
res["5_still_producing"] = res["5_back_desktop"]["delivered"] > res["2_phone"]["delivered"] > res["1_desktop"]["delivered"]
# HiDPI: device scale factor 2 -> canvas backing store doubles
ab("set", "viewport", 1280, 800, 2); time.sleep(1.5)
res["6_hidpi"] = ev(D)
shot("t7-03-hidpi")
ab("set", "viewport", 1280, 800, 1); time.sleep(0.5)
res["errors"] = ab("errors")
print(json.dumps(res, indent=1))
open("evidence/logs/t7.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
