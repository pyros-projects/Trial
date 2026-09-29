"""Tiny driver around the agent-browser CLI used for Fluxworks validation.

All interactions go through real browser input (mouse/keyboard via CDP);
`ev()` is only used to *read* live diagnostics (window.FW) or to convert
grid cells to screen coordinates.
"""
import json
import subprocess
import sys
import time

SESSION = "fw"
LOG = []


def ab(*args, check=True):
    cmd = ["agent-browser", "--session", SESSION, *map(str, args)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = (r.stdout or "") + (r.stderr or "")
    LOG.append("$ " + " ".join(cmd[3:]) + "\n" + out.strip()[:400])
    if check and r.returncode != 0:
        raise RuntimeError(out)
    return out.strip()


def ev(js):
    r = subprocess.run(["agent-browser", "--session", SESSION, "eval", "--stdin"],
                       input=js, capture_output=True, text=True)
    out = r.stdout.strip()
    try:
        return json.loads(out)
    except Exception:
        return out


def cell(x, y):
    """screen (viewport) coords of the centre of grid cell x,y"""
    p = ev(f"FW.worldToScreen({x}+.5,{y}+.5)")
    return round(p[0]), round(p[1])


def move(x, y):
    ab("mouse", "move", x, y)


def click_cell(x, y, button="left"):
    sx, sy = cell(x, y)
    move(sx, sy)
    ab("mouse", "down", button)
    ab("mouse", "up", button)


def drag_cells(points, button="left", steps=4):
    """press at first cell, glide through each waypoint cell (interpolated), release"""
    pts = [cell(x, y) for x, y in points]
    move(*pts[0])
    ab("mouse", "down", button)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        for k in range(1, steps + 1):
            move(round(ax + (bx - ax) * k / steps), round(ay + (by - ay) * k / steps))
    ab("mouse", "up", button)


def key(k):
    ab("press", k)


def shot(name):
    return ab("screenshot", f"evidence/screenshots/{name}.png")


if __name__ == "__main__":
    print(ev(sys.argv[1]))


def visible_free_cell(dx=0, dy=0):
    """a free, buildable ground cell inside the visible canvas (near the camera centre)"""
    return ev(f"""(()=>{{const [x0,y0]=screenToWorld(40,120),[x1,y1]=screenToWorld(VW-40,VH-80);const cx=Math.floor(FW.cam.x)+{dx},cy=Math.floor(FW.cam.y)+{dy};
      for(let r=0;r<30;r++)for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){{if(x<x0||x>x1-1||y<y0||y>y1-1||!inb(x,y))continue;if(!structAt(x,y)&&!W.terrain[cidx(x,y)]&&!W.dep[cidx(x,y)])return [x,y]}}return null}})()""")
