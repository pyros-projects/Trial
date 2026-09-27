"""Tool interaction tests driven by real pointer/keyboard input (agent-browser CDP input)."""
import time, math, sys
from harness import *


def press_path(path_world, button='left'):
    pts = [w2s(x, y) for x, y in path_world]
    cmds = [['mouse', 'move', *pts[0]], ['mouse', 'down', button]] + [['mouse', 'move', *p] for p in pts[1:]]
    batch(cmds)


def release(button='left'):
    batch([['mouse', 'up', button]])


def nearest_body(cands, x, y):
    best = None
    for b in cands:
        bi = body_info(b['id'])
        d = math.hypot(bi['cx'] - x, bi['cy'] - y)
        if best is None or d < best[0]:
            best = (d, bi)
    return best[1]


# ------------------------------------------------------------------ showcase tools
scenario('showcase')
time.sleep(2.2)
shot('t00-showcase-start')

def fresh(wait=1.5):
    key('r'); time.sleep(wait)

# T1 grab & drag the upper soft box (bottom right) up into free space
key('g')
blob = nearest_body(find('soft', 'soft box'), 1510, 864)
x0, y0 = blob['cx'], blob['cy']
path = [(x0, y0)] + [(x0 - 6 * k, y0 - 28 * k) for k in range(1, 13)]
press_path(path)
time.sleep(0.6)
held = body_info(blob['id'])
shot('t01-grab-drag-held')
release()
time.sleep(0.9)
after = body_info(blob['id'])
target = path[-1]
ok = math.hypot(held['cx'] - target[0], held['cy'] - target[1]) < 70 and after['cy'] > held['cy'] + 40
record('grab-drag soft body', 'pass' if ok else 'fail',
       f"soft box centre {x0:.0f},{y0:.0f} -> held {held['cx']:.0f},{held['cy']:.0f} (target {target[0]:.0f},{target[1]:.0f}); after release cy={after['cy']:.0f} (fell back)", 'evidence/screenshots/t01-grab-drag-held.png')

# T2 tear the target screen by yanking one of its particles
fresh(2.0)
scr = find('cloth', 'screen')[0]
si = body_info(scr['id'])
s0 = stats()
mx, my = (si['minX'] + si['maxX']) / 2, (si['minY'] + si['maxY']) / 2
press_path([(mx, my), (mx - 60, my + 40), (mx - 160, my + 110), (mx - 260, my + 180), (mx - 330, my + 260)])
time.sleep(0.5)
shot('t02-tear-drag-held')
release()
time.sleep(1.0)
s1 = stats()
si2 = body_info(scr['id'])
shot('t02-tear-after-release')
ok = s1['torn'] > s0['torn'] + 5 and si2['deadC'] > si['deadC']
record('tear cloth by dragging', 'pass' if ok else 'fail',
       f"torn {s0['torn']} -> {s1['torn']}; screen dead constraints {si['deadC']} -> {si2['deadC']} (persists after release)", 'evidence/screenshots/t02-tear-after-release.png')

# T3 pin / unpin the free end of the swinging ceiling rope
fresh()
key('p')
rope = [b for b in find('rope') if lab(f"window.__lab.particle({b['p0']})")['pinned'] and lab(f"window.__lab.particle({b['p0']})")['x'] > 1300][0]
end = rope['p1'] - 1
pe = lab(f'window.__lab.particle({end})')
click_world(pe['x'], pe['y'])
time.sleep(0.15)
pin1 = lab(f'window.__lab.particle({end})')
time.sleep(1.0)
pin2 = lab(f'window.__lab.particle({end})')
shot('t03-pinned-rope-end')
click_world(pin2['x'], pin2['y'])
time.sleep(0.8)
pin3 = lab(f'window.__lab.particle({end})')
ok = pin1['pinned'] and pin2['pinned'] and abs(pin2['x'] - pin1['x']) < 0.5 and abs(pin2['y'] - pin1['y']) < 0.5 and not pin3['pinned'] and math.hypot(pin3['x'] - pin2['x'], pin3['y'] - pin2['y']) > 3
record('pin and unpin a point', 'pass' if ok else 'fail',
       f"pinned={pin1['pinned']} held at ({pin1['x']:.1f},{pin1['y']:.1f})->({pin2['x']:.1f},{pin2['y']:.1f}); unpinned={not pin3['pinned']} then moved to ({pin3['x']:.1f},{pin3['y']:.1f})", 'evidence/screenshots/t03-pinned-rope-end.png')

# T4 cut the chain hammock -> blob drops
fresh()
key('x')
chains = [b for b in find('chain') if body_info(b['id'])['minX'] < 470]
ch = body_info(chains[0]['id'])
blob2 = nearest_body(find('soft', 'jelly blob'), 655, 520)
s0 = stats()
cx = (ch['minX'] + ch['maxX']) / 2 - 60
drag_world([(cx, ch['minY'] - 40), (cx + 5, (ch['minY'] + ch['maxY']) / 2), (cx + 10, ch['maxY'] + 40)])
time.sleep(0.2)
ch2 = body_info(ch['id'])
b0 = body_info(blob2['id'])
time.sleep(1.0)
b1 = body_info(blob2['id'])
shot('t04-cut-chain')
s1 = stats()
ok = ch2['deadC'] > ch['deadC'] and s1['torn'] > s0['torn']
record('cut constraints (chain)', 'pass' if ok else 'fail',
       f"chain dead links {ch['deadC']} -> {ch2['deadC']}; torn {s0['torn']} -> {s1['torn']}; nearby blob cy {b0['cy']:.0f} -> {b1['cy']:.0f}", 'evidence/screenshots/t04-cut-chain.png')

# T5 cut the balloon string -> helium balloon rises
fresh(2.5)
st = find('string')[0]
sti = body_info(st['id'])
bal = find('balloon')[0]
bi0 = body_info(bal['id'])
my = (sti['minY'] + sti['maxY']) / 2
drag_world([(sti['minX'] - 50, my), (sti['maxX'] + 50, my + 4)])
time.sleep(1.2)
bi1 = body_info(bal['id'])
shot('t05-cut-balloon-string')
ok = bi1['cy'] < bi0['cy'] - 30
record('cut balloon string (helium rises)', 'pass' if ok else 'fail', f"balloon cy {bi0['cy']:.0f} -> {bi1['cy']:.0f}", 'evidence/screenshots/t05-cut-balloon-string.png')

# T6 impulse blast on the soft boxes (bottom right)
fresh()
key('i')
boxes = [b for b in find('soft', 'soft box') if body_info(b['id'])['cx'] > 1400]
v0 = max(body_info(b['id'])['vmax'] for b in boxes)
c0 = [(body_info(b['id'])['cx'], body_info(b['id'])['cy']) for b in boxes]
click_world(1450, 960)
time.sleep(0.08)
v1 = max(body_info(b['id'])['vmax'] for b in boxes)
time.sleep(0.5)
c1 = [(body_info(b['id'])['cx'], body_info(b['id'])['cy']) for b in boxes]
shot('t06-impulse')
moved = max(math.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(c0, c1))
ok = v1 > v0 + 150 and moved > 20
record('impulse blast', 'pass' if ok else 'fail', f"soft-box max speed {v0:.0f} -> {v1:.0f} cm/s; displacement {moved:.0f} cm", 'evidence/screenshots/t06-impulse.png')

# T7 wind swipe across the flag
fresh()
key('w')
flag = find('cloth', 'flag')[0]
f0 = body_info(flag['id'])
press_path([(140, 330)] + [(140 + 40 * k, 320 - 6 * k) for k in range(1, 9)])
time.sleep(0.25)
f1 = body_info(flag['id'])
release()
shot('t07-wind-swipe')
ok = f1['vmax'] > f0['vmax'] + 50
record('wind swipe tool', 'pass' if ok else 'fail', f"flag max speed {f0['vmax']:.0f} -> {f1['vmax']:.0f} cm/s during swipe", 'evidence/screenshots/t07-wind-swipe.png')

# T8 global gust button
fresh(2.0)
g0 = body_info(flag['id'])
ab('click', '#btnGust')
time.sleep(0.45)
g1 = body_info(flag['id'])
shot('t08-gust')
ok = g1['maxX'] > g0['maxX'] + 5 or g1['vmax'] > g0['vmax'] + 60
record('global wind gust button', 'pass' if ok else 'fail', f"flag extent maxX {g0['maxX']:.0f} -> {g1['maxX']:.0f}, max speed {g0['vmax']:.0f} -> {g1['vmax']:.0f}", 'evidence/screenshots/t08-gust.png')

# ------------------------------------------------------------------ spawning in the empty sandbox
scenario('empty')
time.sleep(0.3)
def count(kind):
    return len(find(kind))
spawn_checks = []
key('b'); n0 = count('ball'); click_world(300, 200); time.sleep(0.2); spawn_checks.append(('ball click', count('ball') == n0 + 1))
drag_world([(300, 420), (360, 400), (460, 360)]); time.sleep(0.05)
thrown = body_info(find('ball')[-1]['id']); spawn_checks.append(('ball drag-throw (vx>0)', thrown['vmax'] > 100))
key('j'); n0 = count('soft'); click_world(520, 150); time.sleep(0.2); spawn_checks.append(('jelly blob', count('soft') == n0 + 1))
key('k'); n0 = count('soft'); click_world(700, 150); time.sleep(0.2); spawn_checks.append(('soft box', count('soft') == n0 + 1))
key('l'); n0 = count('balloon'); click_world(900, 500); time.sleep(0.2); spawn_checks.append(('balloon (+string)', count('balloon') == n0 + 1 and count('string') >= 1))
key('t'); n0 = count('crate'); click_world(1100, 150); time.sleep(0.2); spawn_checks.append(('crate', count('crate') == n0 + 1))
key('o'); n0 = count('rope'); drag_world([(150, 60), (200, 150), (260, 260)]); time.sleep(0.2); spawn_checks.append(('rope (drag, pinned start)', count('rope') == n0 + 1 and body_info(find('rope')[-1]['id'])['pins'] >= 1))
key('h'); n0 = count('chain'); drag_world([(1250, 60), (1350, 90), (1450, 60)]); time.sleep(0.2); spawn_checks.append(('chain (drag)', count('chain') == n0 + 1))
key('c'); n0 = count('cloth'); drag_world([(620, 330), (700, 400), (880, 520)]); time.sleep(0.2); spawn_checks.append(('cloth sheet (drag rect)', count('cloth') == n0 + 1 and body_info(find('cloth')[-1]['id'])['pins'] == 2))
key('e'); o0 = len(lab('window.__lab.obstacles()')); drag_world([(1000, 700), (1150, 720), (1300, 740)]); time.sleep(0.1); spawn_checks.append(('static box (drag)', len(lab('window.__lab.obstacles()')) == o0 + 1))
key('y'); o0 = len(lab('window.__lab.obstacles()')); drag_world([(250, 700), (280, 700), (310, 700)]); time.sleep(0.1); spawn_checks.append(('static circle (drag)', len(lab('window.__lab.obstacles()')) == o0 + 1))
time.sleep(2.5)
shot('t09-spawned-objects')
# rope attached to a ball: pause, drop a ball in mid-air, drag a rope from empty space onto it, resume
if not stats()['paused']: key('Space')
time.sleep(0.2)
paused_ok = stats()['paused']
key('b'); click_world(1450, 420); time.sleep(0.2)
ballb = find('ball')[-1]; bp = lab(f"window.__lab.particle({ballb['p0']})")
key('o'); n0 = count('rope')
drag_world([(1450, 150), (1450, 300), (bp['x'], bp['y'])])
time.sleep(0.2)
newrope = find('rope')[-1]
endp = lab(f"window.__lab.particle({newrope['p1'] - 1})")
attached = count('rope') == n0 + 1 and endp['attachedTo'] == ballb['id']
spawn_checks.append(('rope end attached to ball', attached))
key('Space')
time.sleep(2.5)
shot('t09b-rope-holds-ball')
bad = [n for n, ok in spawn_checks if not ok]
record('spawn every object type', 'pass' if not bad else 'fail', ', '.join(f"{n}={'ok' if ok else 'FAIL'}" for n, ok in spawn_checks), 'evidence/screenshots/t09-spawned-objects.png')
bb = body_info(ballb['id'])
record('rope attachment holds ball', 'pass' if attached and bb['cy'] < 520 else 'fail', f"(paused while building: {paused_ok}) ball hung from a 270 cm rope pinned at y=150: centre y after 2.5 s = {bb['cy']:.0f} (floor is 1000)", 'evidence/screenshots/t09b-rope-holds-ball.png')

save_log('interaction-tools.json')
