import subprocess,json, pathlib,time,sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
LOG=ROOT/'evidence/browser-commands.log'
def ab(*args,check=True):
 cmd=['agent-browser','--session','forma',*map(str,args)]
 r=subprocess.run(cmd,capture_output=True,text=True,cwd=ROOT)
 with LOG.open('a') as f:f.write('$ '+subprocess.list2cmdline(cmd)+'\n'+r.stdout+r.stderr+'\n')
 if check and r.returncode: raise RuntimeError(r.stderr or r.stdout)
 return r.stdout.strip()
def ev(js):return json.loads(ab('eval',js))
def diag():return json.loads(ev('JSON.stringify(formaDiagnostics)'))
def click(label):
 sel='[aria-label='+json.dumps(label)+']'
 
 if ev('document.querySelector('+json.dumps(sel)+') !== null'):
  ab('scrollintoview',sel);ab('click',sel)
 else:ab('find','label',label,'click')
def field(label,value,enter=True):
 sel='[aria-label='+json.dumps(label)+']'
 ab('scrollintoview',sel);ab('fill',sel,str(value))
 if enter:ab('press','Enter')
def select(label,value):
 sel='[aria-label='+json.dumps(label)+']'
 ab('scrollintoview',sel);ab('select',sel,str(value))
def point(x,y):
 d=diag();r=ev('(()=>{let r=document.getElementById("workspace").getBoundingClientRect();return{x:r.x,y:r.y}})()')
 return (r['x']+d['pan']['x']+x*d['zoom'],r['y']+d['pan']['y']+y*d['zoom'])
def mouse(x,y):ab('mouse','move',round(x),round(y))
def dragdoc(start,end,steps=4,up=True):
 a=point(*start);b=point(*end);mouse(*a);ab('mouse','down','left')
 for i in range(1,steps+1):mouse(a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps)
 if up:ab('mouse','up','left')
def create(shape,x,y,w,h,name):
 click(shape+' tool');dragdoc((x,y),(x+w,y+h));field('Layer name',name)
 return diag()['selection'][0]
def bounds(id=None):
 d=diag()
 return next(i['bounds'] for i in d['items'] if i['id']==id) if id else d['bounds']
def near(a,b,tol=.05):
 assert abs(a-b)<tol,(a,b)
def save(name):
 (ROOT/'evidence'/name).write_text(json.dumps(diag(),indent=2))
def shot(name):ab('screenshot','evidence/'+name)
def newdoc():click('New blank document');ab('click','#createDocBtn')
def readout(msg):
 print(msg,flush=True)
 with LOG.open('a') as f:f.write('OBSERVED: '+msg+'\n')
def cdp(events):
 r=subprocess.run(['node','evidence/cdp-input.cjs',json.dumps(events)],capture_output=True,text=True,cwd=ROOT)
 with LOG.open('a') as f:f.write('$ node evidence/cdp-input.cjs '+json.dumps(events)+'\n'+r.stdout+r.stderr+'\n')
 if r.returncode:raise RuntimeError(r.stderr)
def addclick(label):
 sel='[aria-label='+json.dumps(label)+']';ab('scrollintoview',sel)
 b=ev('(()=>{const r=document.querySelector('+json.dumps(sel)+').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()')
 cdp([{'method':'Input.dispatchMouseEvent','params':{'type':t,'x':b['x'],'y':b['y'],'button':'left','buttons':1 if t=='mousePressed' else 0,'modifiers':8,'clickCount':1}} for t in ['mousePressed','mouseReleased']])
def origin(x=100,y=80):
 d=diag();r=ev('(()=>{let r=document.getElementById("workspace").getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()');click('Hand tool');a=(r['x']+r['w']/2,r['y']+r['h']/2);mouse(*a);ab('mouse','down','left');mouse(a[0]+x-d['pan']['x'],a[1]+y-d['pan']['y']);ab('mouse','up','left');click('Select tool')
