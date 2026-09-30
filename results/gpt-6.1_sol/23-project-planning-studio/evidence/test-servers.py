from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler,BaseHTTPRequestHandler
from pathlib import Path
from threading import Thread,Event
import json
ROOT=Path(__file__).resolve().parent.parent
class App(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
    def log_message(self,fmt,*args):
        with (ROOT/'evidence/logs/http-server.log').open('a') as f:f.write(fmt%args+'\n')
class DenyProxy(BaseHTTPRequestHandler):
    def blocked(self):
        with (ROOT/'evidence/logs/blocked-external.log').open('a') as f:f.write(self.command+' '+self.path+' -> 403 blocked\n')
        self.send_response(403);self.end_headers();self.wfile.write(b'External internet blocked for planner validation.')
    do_GET=blocked;do_POST=blocked;do_CONNECT=blocked
    def log_message(self,*a):pass
app=ThreadingHTTPServer(('127.0.0.1',0),App);proxy=ThreadingHTTPServer(('127.0.0.1',0),DenyProxy)
ports={'app':app.server_port,'proxy':proxy.server_port};(ROOT/'evidence/logs/test-servers.json').write_text(json.dumps(ports));print(json.dumps(ports),flush=True)
Thread(target=app.serve_forever,daemon=True).start();Thread(target=proxy.serve_forever,daemon=True).start();Event().wait()
