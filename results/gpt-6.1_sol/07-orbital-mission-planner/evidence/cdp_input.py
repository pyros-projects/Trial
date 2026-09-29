"""Supplement agent-browser 0.31.1's wheel-at-(0,0) limitation with actual CDP input.
Uses the browser session managed by agent-browser; no application state is changed
through script evaluation. Also supports native multi-touch and DPR emulation.
"""
import json,subprocess,pathlib
from browser_helpers import ab,log
class Input:
    def __init__(self):
        url=ab('get','cdp-url').strip('"')
        self.process=subprocess.Popen(['node',str(pathlib.Path(__file__).with_name('cdp-input.cjs')),url],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
        result=json.loads(self.process.stdout.readline())
        if not result.get('ready'):raise RuntimeError(result)
    def command(self,method,params=None):
        message={'method':method,'params':params or {}}
        log.write('CDP '+json.dumps(message)+'\n')
        self.process.stdin.write(json.dumps(message)+'\n');self.process.stdin.flush()
        result=json.loads(self.process.stdout.readline())
        if 'error' in result:raise RuntimeError(result['error'])
        return result['result']
    def wheel(self,x,y,delta):self.command('Input.dispatchMouseEvent',{'type':'mouseWheel','x':x,'y':y,'deltaX':0,'deltaY':delta})
    def mobile(self):
        self.command('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':3,'mobile':True})
        self.command('Emulation.setTouchEmulationEnabled',{'enabled':True,'maxTouchPoints':5})
    def touch(self,type,points):self.command('Input.dispatchTouchEvent',{'type':type,'touchPoints':[{'id':i+1,'x':x,'y':y,'radiusX':2,'radiusY':2} for i,(x,y) in enumerate(points)]})
    def close(self):
        self.process.stdin.close();self.process.wait(timeout=5)
