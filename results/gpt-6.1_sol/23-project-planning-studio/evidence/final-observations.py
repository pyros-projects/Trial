import runpy,json
h=runpy.run_path('evidence/browser-checks.py');globals().update({k:v for k,v in h.items() if not k.startswith('__')})
def final_inspection():
    run('tab','t1');run('set','viewport',1280,800);run('network','requests','--clear');run('reload');interval_expect(SEED,6)
    assert state()['completion']==8 and state()['undoCount']==state()['redoCount']==0
    shot('final-desktop');snap('final-desktop');run('screenshot','--full',str(ROOT/'evidence/screenshots/final-desktop-full.png'))
    assert not run('errors').strip();console=run('console');requests=run('network','requests')
    assert not any('http://' in line or 'https://' in line for line in requests.splitlines()),requests
    (ROOT/'evidence/logs/final-direct-file-console.txt').write_text(console);(ROOT/'evidence/logs/final-direct-file-requests.txt').write_text(requests)
    run('set','viewport',390,844);mobile_view('gantt');shot('final-mobile-gantt');mobile_view('details');run('scroll','up',2000);shot('final-mobile-details');assert ev('document.documentElement.scrollWidth<=innerWidth')
    run('set','viewport',1280,800)
    for filename,labelname in [('review-last-date.svg','svg-last'),('long-labels.svg','svg-long'),('current-gantt.svg','svg-complete')]:
        run('tab','new','--label',labelname,(ROOT/'evidence/downloads'/filename).as_uri())
        observed=ev("(()=>{const s=document.documentElement,w=Number(s.getAttribute('width')),h=Number(s.getAttribute('height'));return {width:w,height:h,texts:Array.from(document.querySelectorAll('text')).map(e=>{const b=e.getBBox();return {text:e.textContent,x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height}})}})()")
        assert observed['texts'] and all(t['x']>=0 and t['y']>=0 and t['right']<=observed['width'] and t['bottom']<=observed['height'] for t in observed['texts']),observed
        (ROOT/'evidence/logs'/('rendered-'+filename+'.json')).write_text(json.dumps(observed,indent=2))
        run('screenshot','--full',str(ROOT/'evidence/screenshots'/('export-'+labelname+'.png')));assert not run('errors').strip();run('tab','close',labelname)
    run('tab','t1');run('reload');interval_expect(SEED,6);assert state()['undoCount']==state()['redoCount']==0
check('FINAL-RENDERED-ARTIFACTS',final_inspection)
