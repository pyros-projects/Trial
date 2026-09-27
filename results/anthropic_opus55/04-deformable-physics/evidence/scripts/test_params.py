"""Parameter, visualization, transport and keyboard tests (real pointer/keyboard input)."""
import time, math
from harness import *


def set_slider(k, frac):
    """Click the range input track at a fraction of its width (real mouse input)."""
    ab('scrollintoview', f'#s-{k}')
    r = lab(f"(()=>{{const b=document.querySelector('#s-{k}').getBoundingClientRect();return [b.left,b.top,b.width,b.height]}})()")
    x = r[0] + 7 + frac * (r[2] - 14)
    y = r[1] + r[3] / 2
    batch([['mouse', 'move', round(x), round(y)], ['mouse', 'down', 'left'], ['mouse', 'up', 'left']])
    time.sleep(0.05)
    return lab(f'window.__lab.P.{k}')


def set_value(k, target):
    """Click near the target position on the track, then correct with arrow keys (real input) to the exact value."""
    a = lab(f"(()=>{{const e=document.querySelector('#s-{k}');return [+e.min,+e.max,+e.step]}})()")
    mn, mx, st = a
    v = set_slider(k, (target - mn) / (mx - mn))
    n = round((target - v) / st)
    if n:
        batch([['press', 'ArrowRight' if n > 0 else 'ArrowLeft']] * min(abs(n), 60))
    return lab(f'window.__lab.P.{k}')


def fresh(sid, wait):
    scenario(sid)
    time.sleep(wait)


def settle_cloth(label):
    """Empty sandbox + a cloth spawned with the cloth tool (top corners pinned); returns settled stats."""
    fresh('empty', 0.2)
    key('c')
    drag_world([(600, 150), (700, 250), (860, 380)])
    time.sleep(2.2)
    c = find('cloth')[-1]
    bi = body_info(c['id'])
    st = stats()
    return bi, st


# ---------------------------------------------------------------- solver iterations
it_lo = set_slider('iterations', 0.0)
bi_lo, st_lo = settle_cloth('it-lo')
shot('p01-iterations-1')
it_hi = set_slider('iterations', 1.0)
bi_hi, st_hi = settle_cloth('it-hi')
shot('p01-iterations-40')
ok = bi_lo['maxY'] > bi_hi['maxY'] + 5 and st_lo['maxErr'] > st_hi['maxErr']
record('solver iterations slider', 'pass' if ok else 'fail',
       f"iterations {it_lo}: cloth lowest point y={bi_lo['maxY']:.0f}, max error {st_lo['maxErr']:.2f} cm | iterations {it_hi}: y={bi_hi['maxY']:.0f}, max error {st_hi['maxErr']:.2f} cm",
       'evidence/screenshots/p01-iterations-1.png, p01-iterations-40.png')
set_value('iterations', 3)

# ---------------------------------------------------------------- structural stiffness
s_lo = set_slider('structural', 0.15)
bi_lo, st_lo = settle_cloth('st-lo')
shot('p02-stiffness-low')
s_hi = set_slider('structural', 1.0)
bi_hi, st_hi = settle_cloth('st-hi')
ok = bi_lo['maxY'] > bi_hi['maxY'] + 15
record('structural stiffness slider', 'pass' if ok else 'fail',
       f"stiffness {s_lo:.2f}: lowest y={bi_lo['maxY']:.0f} (strain {st_lo['maxStrain']*100:.0f}%) | stiffness {s_hi:.2f}: lowest y={bi_hi['maxY']:.0f} (strain {st_hi['maxStrain']*100:.0f}%)",
       'evidence/screenshots/p02-stiffness-low.png')
set_value('structural', 0.9)

# ---------------------------------------------------------------- bending stiffness (rope stays straighter)
def rope_sag(frac):
    b = set_slider('bending', frac)
    fresh('empty', 0.2)
    key('Space')                                                   # build while paused
    key('o'); drag_world([(500, 300), (600, 300), (760, 300)])   # rope, start pinned
    r = find('rope')[-1]
    key('p')                                                       # clamp: also pin the 2nd and 3rd points
    for i in (1, 2):
        q = lab(f"window.__lab.particle({r['p0'] + i})"); click_world(q['x'], q['y'])
    key('Space')
    time.sleep(1.5)
    mid = lab(f"window.__lab.particle({r['p0'] + 14})")
    return b, mid['x']            # horizontal reach of the rope's mid-point (clamp at x=500, rope extends to +x)
b_lo, r_lo = rope_sag(0.0)
b_hi, r_hi = rope_sag(1.0)
shot('p03-bending-high')
ok = r_hi > r_lo + 100
record('bending stiffness slider', 'pass' if ok else 'fail',
       f"rope clamped horizontally at x=500 (3 points pinned with the pin tool), 1.5 s later: mid-point reach x={r_lo:.0f} at bending {b_lo:.2f} (floppy, whips back) vs x={r_hi:.0f} at bending {b_hi:.2f} (stiff cantilever)",
       'evidence/screenshots/p03-bending-high.png')
set_value('bending', 0.3)

# ---------------------------------------------------------------- wind speed
w0 = set_value('windStrength', 0)
f0, _ = settle_cloth('wind-0')
shot('p04-wind-0')
w1 = set_slider('windStrength', 0.5)
time.sleep(2.5)
f1 = body_info(find('cloth')[-1]['id'])
shot('p04-wind-max')
ok = f1['cx'] > f0['cx'] + 40
record('wind speed slider', 'pass' if ok else 'fail',
       f"corner-pinned sheet: wind {w0} cm/s -> centroid x={f0['cx']:.0f}, reach x={f0['maxX']:.0f} | wind {w1} cm/s -> centroid x={f1['cx']:.0f}, reach x={f1['maxX']:.0f}",
       'evidence/screenshots/p04-wind-0.png, p04-wind-max.png')
set_slider('windStrength', 0.0)

# ---------------------------------------------------------------- tear threshold (balloon membranes at 1.5x pressure)
def pop_count(thr):
    fresh('balloons', 0.3)
    t = set_value('tearThreshold', thr)
    set_value('pressure', 1.5)
    time.sleep(3.0)
    bs = [b for b in bodies() if b['kind'] == 'balloon']
    return t, sum(1 for b in bs if b['popped']), len(bs)
thr_hi, pop_hi, nb = pop_count(0.35)
shot('p05-tear-threshold-35')
thr_lo, pop_lo, _ = pop_count(0.15)
shot('p05-tear-threshold-15')
set_value('pressure', 1.0)
ok = pop_lo > pop_hi + 5
record('tear threshold slider', 'pass' if ok else 'fail',
       f"balloon chamber at 1.5x pressure: tear threshold +{thr_hi*100:.0f}% -> {pop_hi}/{nb} balloons popped; +{thr_lo*100:.0f}% -> {pop_lo}/{nb} popped",
       'evidence/screenshots/p05-tear-threshold-35.png, p05-tear-threshold-15.png')
set_value('tearThreshold', 0.35)

# ---------------------------------------------------------------- balloon pressure
fresh('balloons', 1.5)
p_lo = set_value('pressure', 0.5)
time.sleep(1.5)
a_lo = [b['areaRatio'] for b in bodies() if b['kind'] == 'balloon' and not b['popped']]
shot('p06-pressure-low')
p_hi = set_value('pressure', 1.5)
time.sleep(1.5)
a_hi = [b['areaRatio'] for b in bodies() if b['kind'] == 'balloon' and not b['popped']]
shot('p06-pressure-high')
m_lo, m_hi = sum(a_lo) / len(a_lo), sum(a_hi) / len(a_hi)
ok = m_hi > m_lo + 0.4
record('balloon pressure slider', 'pass' if ok else 'fail',
       f"pressure {p_lo:.2f}x: mean balloon area {m_lo*100:.0f}% of rest | pressure {p_hi:.2f}x: {m_hi*100:.0f}%", 'evidence/screenshots/p06-pressure-low.png, p06-pressure-high.png')
set_value('pressure', 1.0)

# ---------------------------------------------------------------- restitution (bounce height)
def bounce(frac):
    e = set_slider('restitution', frac)
    fresh('empty', 0.2)
    key('b'); click_world(300, 300)
    ball = find('ball')[-1]
    # a drop of ~680 cm takes ~1.18 s: wait until the ball is on its way back up, then track its apex
    t_end = time.time() + 4
    while time.time() < t_end and lab(f"window.__lab.particle({ball['p0']})")['vy'] >= 0:
        time.sleep(0.02)
    best = 1e9
    for _ in range(14):
        best = min(best, lab(f"window.__lab.particle({ball['p0']})")['y'])
        time.sleep(0.04)
    return e, best
e_lo, h_lo = bounce(0.0)
e_hi, h_hi = bounce(0.9)
ok = h_hi < h_lo - 100
record('restitution slider', 'pass' if ok else 'fail', f"ball dropped from y=300: restitution {e_lo:.2f} -> highest point after impact y={h_lo:.0f}; restitution {e_hi:.2f} -> y={h_hi:.0f}")
set_value('restitution', 0.3)

# ---------------------------------------------------------------- gravity direction
fresh('empty', 0.2)
g = set_slider('gravityAngle', 0.75)   # +90 deg -> gravity points left
key('b'); click_world(800, 500)
ball = find('ball')[-1]
time.sleep(0.6)
bp = lab(f"window.__lab.particle({ball['p0']})")
shot('p07-gravity-sideways')
ok = bp['x'] < 700
record('gravity direction slider', 'pass' if ok else 'fail', f"gravity angle {g} deg: ball spawned at x=800 moved to x={bp['x']:.0f}, y={bp['y']:.0f} (falls sideways)", 'evidence/screenshots/p07-gravity-sideways.png')
set_value('gravityAngle', 0)

# ---------------------------------------------------------------- collision thickness
fresh('ropes', 0.3)
t_lo = set_slider('thickness', 0.0)
r_lo = lab('window.__lab.particle(0)')['r']
shot('p08-thickness-min')
t_hi = set_slider('thickness', 1.0)
r_hi = lab('window.__lab.particle(0)')['r']
time.sleep(0.5)
shot('p08-thickness-max')
record('collision thickness slider', 'pass' if r_hi > r_lo * 4 else 'fail', f"thickness {t_lo} -> particle radius {r_lo:.1f}; thickness {t_hi} -> radius {r_hi:.1f}", 'evidence/screenshots/p08-thickness-max.png')
set_value('thickness', 8)

# ---------------------------------------------------------------- substeps / timestep / density / damping / friction / strength / radius reflect live
changes = {}
for k, f in [('substeps', 1.0), ('dtMs', 0.0), ('density', 0.6), ('damping', 0.5), ('friction', 1.0), ('strength', 0.5), ('radius', 0.6)]:
    changes[k] = set_slider(k, f)
time.sleep(0.4)
st = stats()
hud = ev('JSON.stringify(document.querySelector("#hud").textContent)')
ok = ('16 substeps' in hud.replace('×', 'x') or '× 16' in hud or '16 substeps' in hud) and st['t'] > 0
record('other sliders apply live', 'pass' if ok else 'fail', f"values now {changes}; HUD reads: {hud[:160]}...")
for k, v in [('substeps', 8), ('dtMs', 16.7), ('density', 1.0), ('damping', 0.1), ('friction', 0.5), ('strength', 1.0), ('radius', 44)]:
    set_value(k, v)

# ---------------------------------------------------------------- visualization modes do not reset
fresh('showcase', 1.0)
modes = ['render', 'particles', 'constraints', 'velocity', 'stress', 'contacts', 'pins', 'grid']
s_prev = stats()
good = True
for i, m in enumerate(modes, 1):
    key(str(i))
    time.sleep(0.45)
    s_now = stats()
    shot(f'v{i}-{m}')
    if s_now['viz'] != m or s_now['t'] <= s_prev['t'] or s_now['N'] < s_prev['N']:
        good = False
    s_prev = s_now
record('visualization modes 1-8 (keyboard) without reset', 'pass' if good else 'fail',
       f"cycled {modes}; sim time kept increasing to {s_prev['t']:.2f}s, particles {s_prev['N']}", 'evidence/screenshots/v1-render.png ... v8-grid.png')
ab('select', '#vizMode', 'stress')
time.sleep(0.3)
record('visualization select control', 'pass' if stats()['viz'] == 'stress' else 'fail', 'select #vizMode -> stress')
key('1')

# ---------------------------------------------------------------- pause / single-step / reset
key('Space'); time.sleep(0.2)
a = stats(); time.sleep(0.6); b = stats()
key('n'); time.sleep(0.2); c = stats()
ab('click', '#btnStep'); time.sleep(0.2); d = stats()
dt = 1 / 60
ok = a['paused'] and abs(b['t'] - a['t']) < 1e-9 and abs(c['t'] - b['t'] - dt) < 1e-3 and abs(d['t'] - c['t'] - dt) < 1e-3
shot('s01-paused-stepped')
record('pause + single step (key N and Step button)', 'pass' if ok else 'fail',
       f"paused={a['paused']}; t frozen {a['t']}->{b['t']}; N -> {c['t']}; Step button -> {d['t']} (dt=16.67 ms)", 'evidence/screenshots/s01-paused-stepped.png')
ab('click', '#btnPause'); time.sleep(0.5); e = stats()
record('resume via button', 'pass' if (not e['paused'] and e['t'] > d['t']) else 'fail', f"paused={e['paused']} t={e['t']}")
time.sleep(1.0)
before = stats()
ab('click', '#btnReset'); time.sleep(0.15); after = stats()
record('reset button', 'pass' if after['t'] < 0.3 and after['torn'] <= 1 else 'fail', f"t {before['t']} -> {after['t']}, torn {before['torn']} -> {after['torn']}")
key('r'); time.sleep(0.1); r2 = stats()
record('reset key R', 'pass' if r2['t'] < 0.3 else 'fail', f"t -> {r2['t']}")

# ---------------------------------------------------------------- help dialog
key('?'); time.sleep(0.2)
hv = ev('JSON.stringify(!document.querySelector("#help").hidden)')
shot('k01-help-open')
key('Escape'); time.sleep(0.2)
hh = ev('JSON.stringify(document.querySelector("#help").hidden)')
record('help dialog (? / Esc)', 'pass' if hv and hh else 'fail', f"open={hv} closed after Esc={hh}", 'evidence/screenshots/k01-help-open.png')

save_log('interaction-params.json')
