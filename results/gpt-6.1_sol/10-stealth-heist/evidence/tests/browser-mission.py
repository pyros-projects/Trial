import subprocess,json,time,pathlib,os
root=pathlib.Path(__file__).resolve().parents[2]
SESSION=os.environ.get('BROWSER_SESSION','nightjar')
PREFIX=['agent-browser','--session',SESSION,'--allow-file-access']
if os.environ.get('BROWSER_PROFILE'):PREFIX+=['--profile',os.environ['BROWSER_PROFILE']]
log=open(root/('evidence/logs/playthrough-'+SESSION+'.txt'),'a',buffering=1)
def run(*args):
    p=subprocess.run(PREFIX+list(map(str,args)),capture_output=True,text=True,timeout=40)
    log.write('COMMAND '+ ' '.join(map(str,args))+'\n'+p.stdout+p.stderr)
    if p.returncode: raise RuntimeError(p.stderr or p.stdout)
    return p.stdout
def read(js):
    p=subprocess.run(PREFIX+['--json','eval',js],capture_output=True,text=True,timeout=30)
    if p.returncode:raise RuntimeError(p.stderr)
    return json.loads(p.stdout)['data']['result']
def snap(label):
    s=read('Nightjar.diagnostics()');log.write(label+' '+json.dumps(s)+'\n');return s
def clickworld(x,y):
    q=read(f'Nightjar.project({x},{y})');run('mouse','move',round(q['x']),round(q['y']));run('mouse','down');run('mouse','up')
def walk(x,y,label):
    clickworld(x,y)
    run('wait','--fn',f"(()=>{{const d=Nightjar.diagnostics();return Math.hypot(d.player.x-{x},d.player.y-{y})<8||d.phase!=='active';}})()")
    s=snap(label)
    if s['phase']!='active' or ((s['player']['x']-x)**2+(s['player']['y']-y)**2)**.5>8:raise RuntimeError(label+' did not reach destination; '+json.dumps(s))
    print(label,round(s['elapsed'],1),s['states'])
if __name__=='__main__':
    initial_history=read('Nightjar.diagnostics().historyCount')
    walk(144,432,'approach loading door');run('press','e');run('wait','--fn','Nightjar.diagnostics().doors.some(d=>d.tx===4&&d.ty===12&&d.open>.8)')
    walk(144,336,'enter service corridor')
    walk(688,336,'cross corridor to vault')
    walk(688,304,'approach secured vault door');run('press','e');run('wait','--fn','Nightjar.diagnostics().doors.some(d=>d.tx===21&&d.ty===8&&d.open>.8)')
    run('press','3');run('press','q');snap('EMP disables nearby cameras')
    walk(688,208,'enter vault');walk(688,144,'approach dossier');run('press','e');run('wait','--fn','Nightjar.diagnostics().player.objective')
    run('screenshot',str(root/'evidence/screenshots/05-objective-secured.png'))
    walk(688,336,'leave vault')
    walk(144,336,'return through corridor')
    walk(144,464,'return to loading bay');walk(80,528,'reach extraction');run('press','e');run('wait','--fn',"Nightjar.diagnostics().phase==='escaped'&&document.getElementById('resultDialog').open")
    s=snap('mission escaped');assert s['summary']['result']=='escaped';assert s['historyCount']==min(20,initial_history+1),'Completion must persist exactly one run';run('screenshot',str(root/'evidence/screenshots/06-victory.png'))
    (root/'evidence/logs/completed-run.json').write_text(read('JSON.stringify(Nightjar.record())'))
    print('COMPLETE',s['summary'])
