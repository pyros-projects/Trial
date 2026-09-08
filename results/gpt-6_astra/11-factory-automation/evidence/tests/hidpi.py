import workflow as w,re
from workflow import *
w.SESSION='forge-mobile'
ab('set','viewport',390,844,1);ab('reload');wait_for('typeof Forge!=="undefined"')
def btn(name):
    snap=ab('snapshot','-i');refs=[r for n,r in re.findall(r'- button "([^\"]+)" \[ref=(e[0-9]+)\]',snap) if n.strip()==name]
    assert refs,name;ab('click','@'+refs[0])
    wait_for("(()=>{const l=document.querySelector('#build-panel'),r=document.querySelector('#stats-panel'),a=l.getBoundingClientRect(),b=r.getBoundingClientRect();return (l.classList.contains('open')?Math.abs(a.left)<.1:a.right<.1)&&(r.classList.contains('open')?Math.abs(b.right-innerWidth)<.1:b.left>innerWidth-.1);})()")
if not diag()['paused']:btn('Pause simulation')
btn('Factory');btn('Fit factory in view');btn('Build');btn('Build Conveyor belt');assert diag()['tool']=='belt'
ab('set','viewport',390,844,2);wait_for('Forge.diagnostics().viewport.dpr===2')
size=ev("({width:document.querySelector('#world').width,css:document.querySelector('#world').clientWidth,ratio:devicePixelRatio})")
assert size['width']==size['css']*2
marker='hidpi-'+str(time.time_ns());ev('window.__forgeValidationTarget='+json.dumps(marker));url=ab('get','cdp-url')
old=len(diag()['structures'])
p=subprocess.run(['node',str(E/'tests'/'touch-input.js'),url,'draw','[[14,18]]',marker],capture_output=True,text=True,timeout=15)
assert p.returncode==0,p.stderr
assert structure(14,18) and len(diag()['structures'])==old+1
shot('42-hidpi-mobile-final.png');dump('hidpi-final.json',{'canvas':size,'diagnostics':diag()})
result('High-DPI change and real touch input',{'canvas':size,'builtCell':[14,18]})
assert not diag()['errors']
(E/'logs'/'mobile-final-errors.txt').write_text(ab('errors'))
(E/'logs'/'mobile-final-console.txt').write_text(ab('console'))
(E/'logs'/'mobile-final-network.txt').write_text(ab('network','requests'))
