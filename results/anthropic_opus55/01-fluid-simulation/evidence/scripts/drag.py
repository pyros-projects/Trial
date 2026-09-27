# usage: drag.py x0 y0 x1 y1 steps waitms  -> prints JSON batch for agent-browser (real CDP mouse input)
import sys, json, math
x0, y0, x1, y1, n, w = map(float, sys.argv[1:7]); n = int(n)
cmds = [["mouse", "move", str(round(x0)), str(round(y0))], ["mouse", "down", "left"]]
for i in range(1, n + 1):
    t = i / n
    cmds.append(["mouse", "move", str(round(x0 + (x1 - x0) * t)), str(round(y0 + (y1 - y0) * t))])
    if w > 0: cmds.append(["wait", str(int(w))])
cmds.append(["mouse", "up", "left"])
print(json.dumps(cmds))
