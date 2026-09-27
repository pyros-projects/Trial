"""Minimal agent-browser driver used for the interaction tests.

All pointer / keyboard input goes through agent-browser (CDP Input.dispatch*),
i.e. real browser input events. `ev()` only *reads* live diagnostics exposed by
the app on window.__lab to verify outcomes.
"""
import json, subprocess, time, os

SESSION = os.environ.get('LAB_SESSION', 'lab')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOTS = os.path.join(ROOT, 'evidence', 'screenshots')
AB = ['agent-browser', '--session', SESSION]
LOG = []


def ab(*args, inp=None):
    r = subprocess.run(AB + [str(a) for a in args], input=inp, capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()


def ev(js):
    """Evaluate a JS expression that returns JSON.stringify(...) and parse it."""
    out = subprocess.run(AB + ['eval', '--stdin'], input=js, capture_output=True, text=True).stdout.strip()
    try:
        v = json.loads(out)
        return json.loads(v) if isinstance(v, str) else v
    except Exception:
        return out


def batch(cmds):
    return subprocess.run(AB + ['batch', '--json'], input=json.dumps([[str(c) for c in cmd] for cmd in cmds]),
                          capture_output=True, text=True).stdout


def w2s(x, y):
    return ev(f'JSON.stringify(window.__lab.worldToScreen({x},{y}).map(v=>Math.round(v)))')


def drag_world(path, button='left', pre=None):
    """Drag along world-space points (converted to screen points)."""
    pts = [w2s(x, y) for x, y in path]
    return drag_screen(pts, button, pre)


def drag_screen(pts, button='left', pre=None):
    cmds = [['mouse', 'move', *pts[0]], ['mouse', 'down', button]]
    for p in pts[1:]:
        cmds.append(['mouse', 'move', *p])
    cmds.append(['mouse', 'up', button])
    if pre:
        cmds = pre + cmds
    return batch(cmds)


def click_world(x, y, button='left'):
    sx, sy = w2s(x, y)
    return batch([['mouse', 'move', sx, sy], ['mouse', 'down', button], ['mouse', 'up', button]])


def key(k):
    return ab('press', k)


def shot(name):
    ab('screenshot', os.path.join(SHOTS, name + '.png'))
    return f'evidence/screenshots/{name}.png'


def lab(expr):
    return ev(f'JSON.stringify({expr})')


def stats():
    return lab('(()=>{const L=window.__lab;return {t:+L.state.simTime.toFixed(3),N:L.N,alive:L.aliveCount,torn:L.torn,paused:L.state.paused,tool:L.state.tool,viz:L.state.viz,scenario:L.state.scenario,contacts:L.stats.contacts,maxErr:+L.stats.maxErr.toFixed(3),maxStrain:+L.stats.maxStrain.toFixed(3),fps:+L.stats.fps.toFixed(1)}})()')


def bodies():
    return lab('window.__lab.bodies()')


def body_info(i):
    return lab(f'window.__lab.bodyInfo({i})')


def find(kind=None, name=None):
    return [b for b in bodies() if (kind is None or b['kind'] == kind) and (name is None or b['name'] == name)]


def scenario(sid):
    ab('select', '#scenario', sid)
    time.sleep(0.3)


def record(test, status, detail, evidence=None):
    LOG.append({'test': test, 'status': status, 'detail': detail, 'evidence': evidence})
    print(f'[{status}] {test}: {detail}' + (f'  ({evidence})' if evidence else ''), flush=True)


def save_log(name):
    with open(os.path.join(ROOT, 'evidence', name), 'w') as f:
        json.dump(LOG, f, indent=1)
