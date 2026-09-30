from http.server import BaseHTTPRequestHandler,HTTPServer
class BlockExternal(BaseHTTPRequestHandler):
 def do_CONNECT(self):
  self.send_error(403,'External internet blocked for offline validation')
 def do_GET(self):
  self.send_error(403,'External internet blocked; Chromium bypasses proxy for loopback')
HTTPServer(('127.0.0.1',8766),BlockExternal).serve_forever()
