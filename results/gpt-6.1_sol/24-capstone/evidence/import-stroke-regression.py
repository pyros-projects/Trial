"""Reproduce the pending-import / held-pointer race with actual browser input."""
import importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('checks',ROOT/'evidence/browser-checks.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
phase=sys.argv[1] if len(sys.argv)>1 else 'retest'
b.LOG=ROOT/f'evidence/logs/import-stroke-{phase}-commands.jsonl'
observed={}
try:
    b.run('set','offline','on');b.run('set','viewport',1280,800)
    b.run('open','file://'+str(ROOT/'index.html'))
    initial=b.diag()
    b.js("window.__nativeFileText=File.prototype.text;window.__delayedReadFinished=false;File.prototype.text=function(){return window.__nativeFileText.call(this).then(v=>new Promise(resolve=>setTimeout(()=>{window.__delayedReadFinished=true;resolve(v);},1200)));};true")
    b.run('upload','#projectFile',ROOT/'evidence/afterimage-roundtrip.json')
    b.run('mouse','move',*b.surface_point(8,10));b.run('mouse','down','left')
    down=b.diag()
    b.check(down['activeStroke'] is True and down['erased']==9,'Must have a newer real held-pointer stroke before read completes')
    observed['before_completion']={k:down[k] for k in ['title','erased','activeStroke','history','revision']}
    b.run('wait','--fn','window.__delayedReadFinished === true')
    after=b.diag()
    observed['after_completion']={k:after[k] for k in ['title','erased','activeStroke','history','revision']}
    observed['notice']=b.run('get','text','#notice').strip()
    b.shot(f'import-stroke-{phase}.png')
    b.check(after['pixels']==initial['pixels'] and after['erased']==9 and after['activeStroke'] is True,'Pending import must not replace newer work while pointer is held')
    b.run('mouse','up','left');finished=b.diag()
    b.check(finished['activeStroke'] is False and finished['history']==1 and finished['erased']==9,'Surviving pointer work must remain one normal undo transaction')
    observed['status']='pass'
    print('PASS pending import during held pointer:',json.dumps(observed),flush=True)
except Exception as error:
    observed['status']='fail';observed['error']=str(error)
    print('FAIL pending import during held pointer:',json.dumps(observed),flush=True)
    raise
finally:
    (ROOT/f'evidence/logs/import-stroke-{phase}-result.json').write_text(json.dumps(observed,indent=2))
    b.run('mouse','up','left');b.js('File.prototype.text=window.__nativeFileText;true')
