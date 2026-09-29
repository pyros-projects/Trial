"""T6: save/load exact state through the Saves tab, JSON export (download) + import (file input),
malformed imports, share code round trip, PNG export (download), autosave slot."""
import os, json, time, struct
from ab import ab, ev, key, click_cell, shot, LOG

URL = "file://" + os.path.abspath("index.html")
OUT = os.path.abspath("evidence/downloads")
os.makedirs(OUT, exist_ok=True)
res = {}
ab("set", "viewport", 1280, 800)
ab("open", URL); ab("wait", 900)
ev("localStorage.clear();1")
ab("select", "#presetSel", "balanced"); ab("wait", 400)
click_cell(40, 26)
time.sleep(4)
key("Space")                                          # pause to freeze an exact state
s0 = ev("({tick:W.tick,hash:FW.stateHash(),items:FW.items(),structs:W.structs.size})")
res["1_state_before_save"] = s0
ab("click", "#tabs button[data-tab=saves]"); time.sleep(0.3)
ab("fill", "#svName", "validation-slot")
ab("click", "#svSave"); time.sleep(0.3)
res["2_slots_after_save"] = ev("slotIndex().map(s=>s.name+'@'+s.tick)")
key("Space"); time.sleep(3); key("Space")             # mutate: run 3 more seconds
res["3_state_mutated"] = ev("({tick:W.tick,hash:FW.stateHash()})")
ab("click", "#tab-saves [data-load='validation-slot']"); time.sleep(0.5)
s1 = ev("({tick:W.tick,hash:FW.stateHash(),items:FW.items(),structs:W.structs.size})")
res["4_state_after_load"] = s1
res["4_exact_match"] = s0 == s1
shot("t6-01-saves-tab")
# ---- JSON export through a real download
ab("download", "#svExport", f"{OUT}/export.json")
exp = json.load(open(f"{OUT}/export.json"))
res["5_export_json"] = {"bytes": os.path.getsize(f"{OUT}/export.json"), "format": exp.get("format"), "tick": exp.get("tick"), "structs": len(exp.get("structs", []))}
# ---- change the world, then import the exported file through the file input
ab("select", "#presetSel", "starter"); time.sleep(0.4)
ab("upload", "#fileIn", f"{OUT}/export.json"); time.sleep(0.8)
res["6_import_file"] = ev("({tick:W.tick,hash:FW.stateHash(),structs:W.structs.size,preset:W.presetId})")
res["6_import_matches_saved"] = res["6_import_file"]["hash"] == s0["hash"]
# ---- malformed imports must not crash
bad = {"garbage.json": "this is not json {", "wrong-format.json": json.dumps({"format": "other", "w": 10}),
       "bad-values.json": json.dumps({"format": "fluxworks", "w": 40, "h": 30, "terrain": [0, 1200], "dep": [0, 1200],
                                       "structs": [{"t": "belt", "x": 5, "y": 5, "d": 9, "i": [[99, "x"], [1, 0.5]]},
                                                   {"t": "nuke", "x": 1, "y": 1}, {"t": "smelter", "x": -5, "y": 3},
                                                   {"t": "assembler", "x": 10, "y": 10, "c": {"rec": 999, "mod": -3}}]})}
res["7_malformed"] = {}
for name, body in bad.items():
    open(f"{OUT}/{name}", "w").write(body)
    before = ev("W.structs.size")
    ab("upload", "#fileIn", f"{OUT}/{name}"); time.sleep(0.6)
    res["7_malformed"][name] = ev("({toast:[...document.querySelectorAll('.toast')].slice(-1)[0]?.textContent||'',structs:W.structs.size,tick:W.tick})")
    res["7_malformed"][name]["structs_before"] = before
res["7_page_errors"] = ab("errors")
res["7_bad_values_loaded"] = ev("[...W.structs.values()].map(s=>s.type+'@'+s.x+','+s.y+' d'+s.dir+(s.items?' items:'+s.items.length:'')+(s.cfg.rec!==undefined?' rec:'+s.cfg.rec+' mod:'+s.cfg.mod:''))")
# ---- share code round trip (UI buttons)
ab("select", "#presetSel", "bus"); time.sleep(0.5)
ab("click", "#tabs button[data-tab=saves]"); time.sleep(0.2)
bus_sig = ev("[...W.structs.values()].map(s=>s.type+s.x+','+s.y+s.dir).join('|').length")
ab("click", "#svMakeCode"); time.sleep(0.8)
code = ev("document.querySelector('#svText').value")
res["8_share_code"] = {"prefix": code[:4], "length": len(code), "json_bytes": ev("JSON.stringify(serialize(false)).length")}
ab("select", "#presetSel", "starter"); time.sleep(0.4)
ab("click", "#tabs button[data-tab=saves]"); time.sleep(0.2)
ab("fill", "#svText", code)
ab("click", "#svLoadText"); time.sleep(0.8)
res["8_share_loaded"] = ev("({structs:W.structs.size,tick:W.tick,sig:[...W.structs.values()].map(s=>s.type+s.x+','+s.y+s.dir).join('|').length})")
res["8_share_matches"] = res["8_share_loaded"]["sig"] == bus_sig
# ---- PNG export via the top-bar button (real download)
ab("download", "#btnPng", f"{OUT}/factory.png")
with open(f"{OUT}/factory.png", "rb") as f:
    head = f.read(24)
w, h = struct.unpack(">II", head[16:24])
res["9_png"] = {"bytes": os.path.getsize(f"{OUT}/factory.png"), "signature_ok": head[:8] == b"\x89PNG\r\n\x1a\n", "width": w, "height": h}
# ---- quick save (Ctrl+S) and autosave presence
click_cell(50, 30); key("Control+s"); time.sleep(0.3)
res["10_slots"] = ev("slotIndex().map(s=>s.name)")
print(json.dumps(res, indent=1))
open("evidence/logs/t6.log", "w").write("\n".join(LOG) + "\n\nRESULT\n" + json.dumps(res, indent=1))
