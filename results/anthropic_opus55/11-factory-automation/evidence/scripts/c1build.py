"""Reusable: build the contract-1 chain with real input (same steps as T1)."""
from ab import ab, ev, key, click_cell, drag_cells, cell, move

def build_c1_chain(res):
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

