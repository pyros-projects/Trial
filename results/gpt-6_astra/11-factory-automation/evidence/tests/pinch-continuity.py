import workflow as w,re
from workflow import *
w.SESSION='forge-mobile'
def btn(name):
    snap=ab('snapshot','-i')
    refs=[r for n,r in re.findall(r'- button "([^\"]+)" \[ref=(e[0-9]+)\]',snap) if n.strip()==name]
    assert refs,name
    ab('click','@'+refs[0])
    wait_for("(()=>{const l=document.querySelector('#build-panel'),r=document.querySelector('#stats-panel'),a=l.getBoundingClientRect(),b=r.getBoundingClientRect();return (l.classList.contains('open')?Math.abs(a.left)<.1:a.right<.1)&&(r.classList.contains('open')?Math.abs(b.right-innerWidth)<.1:b.left>innerWidth-.1);})()")
ab('record','start',str(E/'videos'/'pinch-building-verified.webm'))
ab('set','viewport',390,844,1)
if ev("!!document.querySelector('.modal')"):btn('Close dialog')
btn('Factory');btn('Fit factory in view')
if not diag()['paused']:btn('Pause simulation')
assert diag()['paused']
btn('Build');btn('Build Conveyor belt');assert diag()['tool']=='belt'
assert diag()['tool']=='belt'
shot('30-pinch-confirmed-before.png');url=ab('get','cdp-url')
p=subprocess.run(['node',str(E/'tests'/'touch-input.js'),url,'pinch'],capture_output=True,text=True,timeout=15)
(E/'logs'/'pinch-building-verified.json').write_text(p.stdout+p.stderr)
print(p.stdout)
shot('31-pinch-confirmed-after.png');ab('record','stop')
m=json.loads(p.stdout);print('PLACEMENT_DELTA',m['after']['count']-m['before']['count'])
