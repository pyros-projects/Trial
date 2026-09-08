import workflow as w,re
from workflow import *
w.SESSION='forge-mobile'
def btn(name):
    snap=ab('snapshot','-i')
    refs=[r for n,r in re.findall(r'- button "([^\"]+)" \[ref=(e[0-9]+)\]',snap) if n.strip()==name]
    assert refs,name
    ab('click','@'+refs[0])
    wait_for("(()=>{const l=document.querySelector('#build-panel'),r=document.querySelector('#stats-panel'),a=l.getBoundingClientRect(),b=r.getBoundingClientRect();return (l.classList.contains('open')?Math.abs(a.left)<.1:a.right<.1)&&(r.classList.contains('open')?Math.abs(b.right-innerWidth)<.1:b.left>innerWidth-.1);})()")
ab('record','start',str(E/'videos'/'pinch-active-tab-fixed.webm'))
ab('set','viewport',390,844,1)
if ev("!!document.querySelector('.modal')"):btn('Close dialog')
btn('Factory');btn('Choose factory preset');btn('Load Balanced factory preset');btn('Fit factory in view')
if not diag()['paused']:btn('Pause simulation')
assert diag()['paused']
btn('Build');btn('Build Conveyor belt');assert diag()['tool']=='belt'
assert diag()['tool']=='belt'
shot('34-pinch-active-fixed-before.png');before_state=state();marker='forge-touch-'+str(time.time_ns());ev('window.__forgeValidationTarget='+json.dumps(marker));url=ab('get','cdp-url')
p=subprocess.run(['node',str(E/'tests'/'touch-input.js'),url,'pinch','',marker],capture_output=True,text=True,timeout=15)
(E/'logs'/'pinch-active-tab-fixed.json').write_text(p.stdout+p.stderr)
print(p.stdout)
shot('35-pinch-active-fixed-after.png');ab('record','stop')
m=json.loads(p.stdout);print('PLACEMENT_DELTA',m['after']['count']-m['before']['count'])

after_state=state();before_state.pop('camera');after_state.pop('camera');assert before_state==after_state,'Pinch altered factory state';assert m['after']['camera']['z']>m['before']['camera']['z'];assert m['after']['tool']=='belt';result('Pinch during construction is camera-only',m)
