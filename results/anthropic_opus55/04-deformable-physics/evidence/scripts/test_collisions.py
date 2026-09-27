"""Inter-body collision and self-collision checks (real pointer/keyboard input, live state read-back)."""
import time, math, os
from harness import *

URL = 'file://' + os.path.join(ROOT, 'index.html')
ab('set', 'viewport', 1280, 800, 1)
ab('open', URL); time.sleep(1.0)


def toggle(k, want):
    cur = lab(f'window.__lab.P.{k}')
    if cur != want:
        ab('scrollintoview', f'#s-{k}')
        ab('click', f'#s-{k}')
        time.sleep(0.1)
    return lab(f'window.__lab.P.{k}')


# ---------------------------------------------------------------- self-collision on/off: a long cloth strip falls and piles on the floor
def pile(on):
    v = toggle('selfCollision', on)
    scenario('empty'); time.sleep(0.2)
    key('c')
    ab('keydown', 'Shift')                                   # Shift = unpinned sheet
    drag_world([(300, 120), (700, 140), (1300, 190)])
    ab('keyup', 'Shift')
    time.sleep(4.0)
    c = find('cloth')[-1]
    bi = body_info(c['id'])
    return v, bi
on_v, on_b = pile(True)
shot('x01-selfcollision-on')
off_v, off_b = pile(False)
shot('x01-selfcollision-off')
toggle('selfCollision', True)
h_on, h_off = on_b['maxY'] - on_b['minY'], off_b['maxY'] - off_b['minY']
ok = h_on > h_off + 3
record('self-collision toggle', 'pass' if ok else 'fail',
       f"unpinned 77x6 strip crumpling on the floor: settled height with self-collision={on_v}: {h_on:.0f} cm vs {off_v}: {h_off:.0f} cm (without it the layers interpenetrate)",
       'evidence/screenshots/x01-selfcollision-on.png, x01-selfcollision-off.png')

# ---------------------------------------------------------------- loads rest on the rope bridge (particle-edge contacts between bodies)
scenario('bridge'); time.sleep(4.0)
deck = find('bridge')[0]
di = body_info(deck['id'])
loads = [b for b in bodies() if b['kind'] in ('crate', 'soft', 'ball')]
res = []
for b in loads:
    bi = body_info(b['id'])
    res.append((b['name'], round(bi['maxY']), bi['maxY'] < di['maxY'] + 5 and bi['cy'] < 980))
shot('x02-bridge-loads')
ok = all(r[2] for r in res)
record('bodies rest on a plank/rope bridge (no pass-through)', 'pass' if ok else 'fail',
       f"deck lowest point y={di['maxY']:.0f}; load bottoms: " + ', '.join(f"{n} {y}" for n, y, _ in res), 'evidence/screenshots/x02-bridge-loads.png')

# ---------------------------------------------------------------- balls dropped on a corner-pinned sheet are caught by it
scenario('empty'); time.sleep(0.2)
key('c'); drag_world([(500, 400), (650, 450), (900, 560)])
time.sleep(1.0)
sheet = body_info(find('cloth')[-1]['id'])
key('b')
for x in (620, 700, 780):
    click_world(x, 150)
time.sleep(2.5)
balls = [body_info(b['id']) for b in find('ball')]
sheet2 = body_info(find('cloth')[-1]['id'])
shot('x03-balls-on-sheet')
caught = sum(1 for b in balls if b['cy'] < sheet2['maxY'])
ok = caught == len(balls)
record('cloth catches falling balls (edge collisions, no tunnelling)', 'pass' if ok else 'fail',
       f"{caught}/{len(balls)} balls resting on the sheet (ball centres y={[round(b['cy']) for b in balls]}, sheet spans y {sheet2['minY']:.0f}-{sheet2['maxY']:.0f})", 'evidence/screenshots/x03-balls-on-sheet.png')

# ---------------------------------------------------------------- soft body lands on a rope and on another soft body
scenario('empty'); time.sleep(0.2)
key('o'); drag_world([(450, 500), (650, 520), (850, 500)])        # rope pinned at start...
r = find('rope')[-1]
key('p'); pe = lab(f"window.__lab.particle({r['p1'] - 1})"); click_world(pe['x'], pe['y'])   # ...and pin its end
key('j'); click_world(650, 250)
key('k'); click_world(1100, 900); click_world(1100, 700)
time.sleep(3.0)
blob = body_info(find('soft', 'jelly blob')[-1]['id'])
boxes = sorted((body_info(b['id']) for b in find('soft', 'soft box')), key=lambda q: q['cy'])
rope = body_info(r['id'])
shot('x04-soft-on-rope-and-stack')
ok = blob['cy'] < rope['maxY'] and boxes[0]['maxY'] <= boxes[1]['minY'] + 10
record('soft body rests on a rope; soft boxes stack', 'pass' if ok else 'fail',
       f"blob centre y={blob['cy']:.0f} above rope low point y={rope['maxY']:.0f}; upper box bottom {boxes[0]['maxY']:.0f} vs lower box top {boxes[1]['minY']:.0f}", 'evidence/screenshots/x04-soft-on-rope-and-stack.png')

save_log('interaction-collisions.json')
