"""Viewport, resize coherence, HiDPI, rapid-pointer continuity, network isolation and performance."""
import time, math, os
from harness import *

URL = 'file://' + os.path.join(ROOT, 'index.html')

# ---------------------------------------------------------------- rapid pointer movement continuity (desktop)
ab('set', 'viewport', 1280, 800)
ab('open', URL); time.sleep(1.0)
scenario('showcase'); time.sleep(2.0)
key('x')
flag = find('cloth', 'flag')[0]
fi = body_info(flag['id'])
d0 = fi['deadC']
xm = (fi['minX'] + fi['maxX']) / 2
# one fast stroke across the whole flag with only 3 pointer samples (~450 cm apart)
drag_world([(xm - 30, fi['minY'] - 60), (xm, (fi['minY'] + fi['maxY']) / 2), (xm + 30, fi['maxY'] + 80)])
time.sleep(0.8)
fi2 = body_info(flag['id'])
shot('c01-fast-cut-flag')
rows = 14
ok = fi2['deadC'] - d0 >= rows * 2
record('rapid cut stroke (3 samples) severs a continuous line', 'pass' if ok else 'fail',
       f"flag constraints cut {fi2['deadC'] - d0} (flag has {rows} rows; a clean severing line needs >= {rows*2})", 'evidence/screenshots/c01-fast-cut-flag.png')

# fast grab-drag: 3 samples spanning ~700 cm; the target is interpolated per substep so nothing explodes
key('r'); time.sleep(1.5)
key('g')
blob = [b for b in find('soft', 'jelly blob')]
bi = min((body_info(b['id']) for b in blob), key=lambda q: abs(q['cx'] - 655) + abs(q['cy'] - 520))
before = stats()
cmds_pts = [(bi['cx'], bi['cy']), (bi['cx'] + 350, bi['cy'] - 250), (bi['cx'] + 600, bi['cy'] - 380)]
pts = [w2s(x, y) for x, y in cmds_pts]
batch([['mouse', 'move', *pts[0]], ['mouse', 'down', 'left'], ['mouse', 'move', *pts[1]], ['mouse', 'move', *pts[2]]])
time.sleep(0.6)
held = body_info(bi['id'])
st = stats()
shot('c02-fast-grab-drag')
batch([['mouse', 'up', 'left']])
nan = ev('JSON.stringify(document.querySelector("#toast").textContent)')
ok = math.hypot(held['cx'] - cmds_pts[-1][0], held['cy'] - cmds_pts[-1][1]) < 80 and 'unstable' not in (nan or '')
record('rapid grab-drag (3 samples, ~700 cm) stays smooth and stable', 'pass' if ok else 'fail',
       f"blob centre reached ({held['cx']:.0f},{held['cy']:.0f}) for target ({cmds_pts[-1][0]:.0f},{cmds_pts[-1][1]:.0f}); max solver error {st['maxErr']} cm; no NaN recovery toast", 'evidence/screenshots/c02-fast-grab-drag.png')

# ---------------------------------------------------------------- resize coherence
key('r'); time.sleep(1.0)
key('Space'); time.sleep(0.2)
probe = [0, 150, 400, 900]
w_before = [lab(f'window.__lab.particle({i})') for i in probe]
s_before = [w2s(p['x'], p['y']) for p in w_before]
ab('set', 'viewport', 900, 700); time.sleep(0.6)
w_after = [lab(f'window.__lab.particle({i})') for i in probe]
s_after = [w2s(p['x'], p['y']) for p in w_after]
drift = max(math.hypot(a['x'] - b['x'], a['y'] - b['y']) for a, b in zip(w_before, w_after))
# pointer -> world mapping still exact after resize: pin a specific free particle by clicking its new screen position
key('p')
target = lab('window.__lab.bodies().find(b => b.kind === "soft")')['p0'] + 3
tp = lab(f'window.__lab.particle({target})')
click_world(tp['x'], tp['y']); time.sleep(0.1)
pinned = lab(f'window.__lab.particle({target})')['pinned']
shot('r01-resized-900x700')
ok = drift < 1e-6 and pinned and s_before != s_after
record('resize keeps world coordinates coherent', 'pass' if ok else 'fail',
       f"paused world positions drift after 1280x800 -> 900x700: {drift:.2e} cm; screen positions rescaled {s_before[1]} -> {s_after[1]}; click at the new screen position pinned the intended particle: {pinned}",
       'evidence/screenshots/r01-resized-900x700.png')
key('Space')

# ---------------------------------------------------------------- HiDPI backing store
ab('set', 'viewport', 1280, 800, 2); time.sleep(0.8)
dims = lab('(()=>{const c=document.querySelector("#view");return {css:[c.clientWidth,c.clientHeight],px:[c.width,c.height],dpr:devicePixelRatio}})()')
shot('r02-hidpi-2x')
ok = dims['px'][0] == round(dims['css'][0] * min(2, dims['dpr']))
record('high-DPI canvas backing store', 'pass' if ok else 'fail', f"devicePixelRatio {dims['dpr']}: canvas css {dims['css']} -> backing {dims['px']}", 'evidence/screenshots/r02-hidpi-2x.png')

# ---------------------------------------------------------------- narrow / mobile viewport 390 x 844
ab('set', 'viewport', 390, 844, 1); time.sleep(0.4)
ab('open', URL); time.sleep(1.2)
shot('m01-narrow-390x844')
lay = lab('(()=>{const d=document.documentElement;const q=s=>{const r=document.querySelector(s).getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]};return {scrollW:d.scrollWidth,clientW:d.clientWidth,scrollH:d.scrollHeight,clientH:d.clientHeight,stage:q("#stage"),rail:q("#toolrail"),top:q("#topbar"),hud:q("#hud"),railScroll:document.querySelector("#toolrail").scrollWidth}})()')
ok = lay['scrollW'] <= lay['clientW'] and lay['stage'][3] > 300 and lay['rail'][1] > lay['stage'][1]
record('narrow layout 390x844 (no horizontal page scroll)', 'pass' if ok else 'fail',
       f"page scrollWidth {lay['scrollW']} vs clientWidth {lay['clientW']}; top bar {lay['top']}, stage {lay['stage']}, tool rail {lay['rail']} (scrollable content {lay['railScroll']}px)", 'evidence/screenshots/m01-narrow-390x844.png')
# open the settings drawer, change a slider with a real click, close it
ab('click', '#btnPanel'); time.sleep(0.4)
shot('m02-narrow-settings-drawer')
op = lab('document.querySelector("#panel").classList.contains("open")')
r = lab("(()=>{const b=document.querySelector('#s-gravity').getBoundingClientRect();return [b.left,b.top,b.width,b.height]})()")
batch([['mouse', 'move', round(r[0] + 10), round(r[1] + r[3] / 2)], ['mouse', 'down', 'left'], ['mouse', 'up', 'left']])
g = lab('window.__lab.P.gravity')
ab('click', '#btnPanelClose'); time.sleep(0.4)
cl = not lab('document.querySelector("#panel").classList.contains("open")')
record('narrow settings drawer', 'pass' if (op and cl and g < 300) else 'fail', f"drawer opened={op}; gravity slider clicked near its start -> {g} cm/s^2; closed={cl}", 'evidence/screenshots/m02-narrow-settings-drawer.png')
ab('click', '#btnResetG'); time.sleep(0.1) if False else None
lab('(()=>{const e=document.querySelector("#s-gravity");e.value=980;e.dispatchEvent(new Event("input"));return 1})()')
# pick a tool from the horizontal rail and use it on the small canvas
ab('scrollintoview', '.tool[data-tool="ball"]')
ab('click', '.tool[data-tool="ball"]')
n0 = len(find('ball'))
click_world(800, 300); time.sleep(0.3)
ab('click', '.tool[data-tool="grab"]')
bl = min((body_info(b['id']) for b in find('soft')), key=lambda q: q['cy'])
drag_world([(bl['cx'], bl['cy']), (bl['cx'] - 60, bl['cy'] - 80), (bl['cx'] - 120, bl['cy'] - 160)])
time.sleep(0.3)
shot('m03-narrow-interaction')
ok = len(find('ball')) == n0 + 1 and lab('window.__lab.state.tool') == 'grab'
record('narrow: tool rail + canvas interaction', 'pass' if ok else 'fail', f"ball spawned via rail tool + click; grab drag on {bl['name']}", 'evidence/screenshots/m03-narrow-interaction.png')
ab('set', 'viewport', 1280, 800, 1); time.sleep(0.3)

# ---------------------------------------------------------------- network isolation
ab('open', URL); time.sleep(1.5)
res = lab('performance.getEntriesByType("resource").map(e => e.name)')
nav = lab('performance.getEntriesByType("navigation").map(e => e.name)')
net = ab('network', 'requests')
record('no external network requests', 'pass' if not res else 'fail', f"resource entries: {res}; navigation: {nav}; agent-browser network log: {net[:300]!r}")
csp = lab('document.querySelector("meta[http-equiv=Content-Security-Policy]").content')
record('CSP forbids external fetches', 'pass' if "default-src 'none'" in csp else 'fail', csp)

# ---------------------------------------------------------------- performance per scenario (no screenshots while measuring)
perf = []
for sid in ['showcase', 'flag', 'drape', 'bridge', 'stack', 'ropes', 'balloons', 'stress', 'empty']:
    scenario(sid); time.sleep(3.5)
    st = lab('(()=>{const L=window.__lab;return {fps:+L.stats.fps.toFixed(0),phys:+L.stats.physMs.toFixed(2),draw:+L.stats.renderMs.toFixed(2),N:L.N,C:L.aliveCount,speed:+L.stats.simSpeed.toFixed(2)}})()')
    perf.append((sid, st))
record('performance (headless Chromium, 1280x800)', 'info', '; '.join(f"{s}: {p['fps']} fps, phys {p['phys']} ms/step, draw {p['draw']} ms, {p['N']} particles, {p['C']} constraints, sim speed {p['speed']}" for s, p in perf))

errs = ab('errors')
cons = ab('console')
record('console / page errors after all runs', 'pass' if ('Error' not in cons and 'error' not in errs.lower().replace('✗', '')) else 'fail', f"errors: {errs!r}; console: {cons[:300]!r}")
save_log('interaction-viewport.json')
