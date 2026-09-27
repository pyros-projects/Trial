"""Capture the stress view while a sheet is loaded close to its tear threshold (imminent-tear highlighting)."""
import time, os
from harness import *
ab('set', 'viewport', 1280, 800, 1)
ab('open', 'file://' + os.path.join(ROOT, 'index.html')); time.sleep(1.0)
scenario('empty'); time.sleep(0.2)
key('c'); drag_world([(560, 200), (700, 260), (900, 420)])      # corner-pinned sheet
time.sleep(1.5)
key('5')                                                        # stress view
key('g')
sheet = body_info(find('cloth')[-1]['id'])
mx, my = (sheet['minX'] + sheet['maxX']) / 2, sheet['maxY'] - 3
pts = [w2s(mx, my)] + [w2s(mx, my + d) for d in (15, 30, 45, 60, 72)]
batch([['mouse', 'move', *pts[0]], ['mouse', 'down', 'left']] + [['mouse', 'move', *p] for p in pts[1:]])
time.sleep(0.5)
st = stats(); near = lab('window.__lab.stats.nearTear')
shot('st01-stress-imminent-tear')
batch([['mouse', 'move', *w2s(mx, my + 200)]]); time.sleep(0.5)
st2 = stats()
shot('st02-stress-after-tear')
batch([['mouse', 'up', 'left']])
record('stress view shows imminent tearing', 'pass' if near > 0 and st2['torn'] > st['torn'] else 'fail',
       f"while pulling the bottom edge down 72 cm: {near} constraints above 80% of their tear limit (pulsing red), torn={st['torn']}; pulling further to 200 cm tore {st2['torn'] - st['torn']} constraints",
       'evidence/screenshots/st01-stress-imminent-tear.png, st02-stress-after-tear.png')
save_log('interaction-stress-view.json')
