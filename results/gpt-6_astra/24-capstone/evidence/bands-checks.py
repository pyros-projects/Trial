"""Final-review regression: actual 12-crossing / 8-color-period rendered behavior.
Real labeled selections, clicks and keyboard actions through agent-browser;
read-only pixel sampling checks the texture, profile and float overlay.
"""
import runpy,json
from pathlib import Path
b=runpy.run_path(str(Path(__file__).with_name('browser-checks.py')))
ab,ev,click,select,settle,check,shot=[b[k] for k in ['ab','ev','click','select','settle','check','shot']]

def samples(axis='x',count=24,offset=0):
    settle()
    return ev(f"""(()=>{{const g=selvedge.diagnostics().geometry,c=document.getElementById('cloth'),q=c.getContext('2d'),d=c.width/g.w;return Array.from({{length:{count}}},(_,i)=>{{const x={'i+'+str(offset) if axis=='x' else '2'},y={'2' if axis=='x' else 'i+'+str(offset)};return Array.from(q.getImageData(Math.floor((g.ox+(x+.5)*g.c)*d),Math.floor((g.oy+(y+.5)*g.c)*d),1,1).data)}})}})()""")

def colors(pixels):return ''.join('A' if p[0]-p[1]>50 else 'B' for p in pixels)

ab('open','file://'+str(Path(__file__).resolve().parent.parent/'index.html'));ab('set','viewport',1280,800)
ab('network','route','http*','--abort');ab('set','offline','on')
click('Reset');select('Repeat','12');select('Yarn rhythm','bands');select('Starting structure','unbound')
check('12-thread crossing grid has exact 4 + 4 warp bands across three color periods',colors(samples())=='AAAABBBB'*3)
check('12-thread color/structure explanation is visible',ev("!document.getElementById('rhythmNote').classList.contains('hidden')"))
shot('12-thread-bands-front-fixed.png')
click('⇄ Invert')
check('weft yarn bands also retain 4 + 4 colors through the 12-thread seam',colors(samples('y'))=='BBBBAAAA'*3)
click('Reverse')
check('reverse mirrors the actual warp color order across the full swatch',colors(samples())=='BBBBAAAA'*3)
shot('12-thread-bands-reverse-fixed.png')
g=b['diag']()['geometry']
check('reverse outlined repeat aligns to the original yarn colors used by the inspector',(g['nx']-g['tileX']-12)%24==0 and g['tileY']%24==0)
# Read the actual rendered warp cross-section dots; they must match the outlined repeat.
profile=ev("""(()=>{const c=document.getElementById('sectionCanvas'),r=c.getBoundingClientRect(),q=c.getContext('2d'),d=c.width/r.width,step=(r.width-20)/12;return Array.from({length:12},(_,x)=>Array.from(q.getImageData(Math.floor((10+(x+.5)*step)*d),Math.floor(r.height*.47*d),1,1).data))})()""")
outline=ev("""(()=>{const g=selvedge.diagnostics().geometry,c=document.getElementById('cloth'),q=c.getContext('2d'),d=c.width/g.w;return Array.from({length:12},(_,x)=>Array.from(q.getImageData(Math.floor((g.ox+(g.tileX+x+.5)*g.c)*d),Math.floor((g.oy+(g.tileY+2.5)*g.c)*d),1,1).data))})()""")
check('rendered inspector yarn colors equal the actual outlined reverse repeat',colors(profile)==colors(outline)=='AAAABBBBAAAA')
click('Float lens')
pixels=samples()
check('reverse unbound overlay spans both halves of the 24-thread color/structure repeat',all(p[0]>p[1]>p[2] and p[1]-p[2]>30 for p in pixels))
click('Float lens');click('Front');select('Starting structure','plain')
# A nonseed edit in the second crossing repeat must propagate with its own yarn colors.
settle();g=b['diag']()['geometry'];r=ev("document.getElementById('cloth').getBoundingClientRect().toJSON()")
x=r['x']+g['ox']+14.5*g['c'];y=r['y']+g['oy']+3.5*g['c']
before=b['state']();ab('mouse','move',x,y);ab('mouse','down','left');ab('mouse','up','left')
check('pointer edit in second color phase edits its actual shared structure crossing',b['state']()['cells'][3][2]==1-before['cells'][3][2] and b['diag']()['selected']=={'x':2,'y':3})
click('Undo');check('undo restores the complete 12-thread banded project',b['state']()==before)
click('Reverse');ab('press','Tab');ab('click','#cloth');ab('press','ArrowRight');ab('press','Space')
check('reverse canvas keyboard editing remains connected after color-period change',b['diag']()['view']['back'] and b['diag']()['undo']>0)
ab('set','viewport',390,844);settle();click('Float lens');shot('12-thread-bands-mobile-fixed.png')
check('narrow banded repeat stays within viewport and contains a complete color period',ev('document.documentElement.scrollWidth')==390 and b['diag']()['geometry']['nx']%24==0)
click('Reset');check('Reset clears band phase, size, history and inspection views',b['state']()==ev('WeaveCore.initial()') and b['diag']()['undo']==0 and not b['diag']()['view']['lens'])
check('no uncaught errors after mixed-period rendering and interaction',not ab('errors').get('errors'))
print('FINAL DIAGNOSTICS',json.dumps(b['diag']()),flush=True)
