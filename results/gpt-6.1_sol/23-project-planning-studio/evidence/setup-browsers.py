import runpy,json
h=runpy.run_path('evidence/browser-checks.py');run=h['run'];ROOT=h['ROOT'];g=run.__globals__
ports=json.loads((ROOT/'evidence/logs/test-servers.json').read_text())
g['SESSION']='planner';run('close');run('--allow-file-access','--download-path',str(ROOT/'evidence/downloads'),'open',(ROOT/'index.html').as_uri());run('network','route','http*://*','--abort');run('set','viewport',1280,800)
g['SESSION']='planner-opaque';run('close');run('--proxy','http://127.0.0.1:'+str(ports['proxy']),'--proxy-bypass','127.0.0.1,localhost','--init-script',str(ROOT/'evidence/deny-storage.js'),'--download-path',str(ROOT/'evidence/downloads'),'open','http://127.0.0.1:'+str(ports['app'])+'/evidence/iframe.html')
cdp=run('get','cdp-url',json_output=True)['cdpUrl'];(ROOT/'evidence/logs/opaque-current-cdp.txt').write_text(cdp);print(cdp)
