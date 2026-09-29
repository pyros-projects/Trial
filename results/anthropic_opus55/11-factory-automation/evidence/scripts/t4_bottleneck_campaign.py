"""T4: deliberate bottleneck in Contract 1 (2 extractors = 1 ore/s into ONE smelter = 0.5/s),
observe analytics, fix it with the upgrade tool, then complete the contract and score it."""
import os, json, time
from ab import ab, ev, key, click_cell, shot, cell, move, LOG
from c1build import build_c1_chain

URL = "file://" + os.path.abspath("index.html")
res = {}
M = """(()=>{const sm=structAt(15,12),ex=[structAt(7,7),structAt(7,8)];return {tick:W.tick,
 smelter:{tier:TIER_NAME[sm.tier],util:+sm.util.toFixed(2),status:statusOf(sm)[0],kW:+sm.req.toFixed(0)},
 extractorsBlocked:ex.map(e=>+e.fB.toFixed(2)),beltItems:FW.items(),delivRatePerMin:+(STATS.hDeliv.avg(10)*60).toFixed(1),
 plateProdPerMin:+(STATS.hProd[IT.iron_plate].avg(10)*60).toFixed(1),got:W.camp.got,credits:Math.floor(W.credits),
 issues:STATS.issues.map(i=>i.title+' — '+i.detail)}})()"""
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 900)
ab("select", "#modeSel", "campaign"); ab("wait", 300)
ab("find", "role", "button", "click", "--name", "Start contract"); ab("wait", 200)
cx, cy = cell(20, 22); move(cx, cy); ab("mouse", "down", "left"); ab("mouse", "up", "left")
build_c1_chain(res)
ab("select", "#speedSel", "4"); ev("document.activeElement.blur();1")
time.sleep(9)                                    # ~36 s of simulated time
res["1_bottleneck"] = ev(M)
ab("click", "#tabs button[data-tab=stats]"); time.sleep(1.2)
shot("t4-01-analytics-bottleneck")
# ---- fix: upgrade the smelter with the Upgrade tool (U, click)
key("u"); click_cell(15, 12); key("v")
res["2_upgraded"] = ev("({tier:TIER_NAME[structAt(15,12).tier],credits:Math.floor(W.credits),undo:undoStack[undoStack.length-1].label})")
time.sleep(6)
res["3_after_fix"] = ev(M)
shot("t4-02-analytics-after-upgrade")
# click the first issue row (if any) -> camera focuses + inspector opens
n_issues = ev("document.querySelectorAll('#stIssues .issue').length")
if n_issues:
    ab("click", "#stIssues .issue"); time.sleep(0.5)
    res["4_issue_click"] = ev("({tab:curTab,selected:[...FW.selection].map(id=>W.structs.get(id)?.type)})")
# ---- run to completion
for i in range(40):
    if ev("W.camp.done"): break
    time.sleep(2)
time.sleep(1.0)
res["5_complete"] = ev("""(()=>{const sc=campaignScore();return {done:W.camp.done,got:W.camp.got,need:W.camp.need,doneTick:W.camp.doneTick,
  modal:document.querySelector('#modal').classList.contains('on'),title:document.querySelector('#modal .mh').textContent,
  score:{time:sc.timeS,budget:sc.budS,power:sc.powS,footprint:sc.footS,total:sc.total,stars:sc.stars}}})()""")
shot("t4-03-contract-complete")
ab("find", "role", "button", "click", "--name", "Next contract →"); time.sleep(0.6)
res["6_next"] = ev("({level:W.levelId,credits:W.credits,modal:document.querySelector('#modal .mh').textContent})")
ab("find", "role", "button", "click", "--name", "Start contract")
ab("select", "#speedSel", "1")
res["errors"] = ab("errors")
print(json.dumps(res, indent=1))
open("evidence/logs/t4.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
