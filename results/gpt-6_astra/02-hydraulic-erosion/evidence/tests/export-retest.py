from importlib.machinery import SourceFileLoader
from pathlib import Path
import subprocess,json,time
m=SourceFileLoader('actions',str(Path(__file__).with_name('browser-actions.py'))).load_module()
ab,js,snap,drag,root=m.ab,m.js,m.snap,m.drag,m.root
results={}
def click(name):return ab('find','role','button','click','--name',name)
def tab(name):return ab('find','role','tab','click','--name',name)
def cdp(method,params):
 p=subprocess.run(['node',str(root/'tests/cdp.mjs'),method,json.dumps(params)],text=True,capture_output=True,check=True);return p.stdout

def wait_state(expr):ab('wait','--fn',expr)
def save(): (root/'logs/extended-results.json').write_text(json.dumps(results,indent=2))
results=json.loads((root/'logs/extended-results.json').read_text())
# State export, mutate, and import, comparing every array and full state.
click('Reset camera');click('Add water');drag([(530,425),(550,430)],.6);ab('select','#view-mode','4')
cdp('Browser.setDownloadBehavior',{'behavior':'allow','downloadPath':str(root/'downloads'),'eventsEnabled':True})
click('Single step');expected=json.loads(js('JSON.stringify(window.terra.snapshot())'));click('Export');ab('download','#export-json',root/'downloads'/('terra-'+str(expected['seed'])+'-state.json'))
jsonfile=root/'downloads'/('terra-'+str(expected['seed'])+'-state.json');assert jsonfile.exists();ondisk=json.loads(jsonfile.read_text());assert ondisk==expected;results['json_export_bytes']=jsonfile.stat().st_size;save()
click('Reset simulation');click('Export');click('Import simulation');ab('upload','#file-input',jsonfile);wait_state('document.getElementById("toast").textContent.startsWith("Simulation restored")');restored=json.loads(js('JSON.stringify(window.terra.snapshot())'));assert restored==expected;results['json_roundtrip']='Exact equality of all nine arrays, counters, parameters, generation settings, view, brush, pause and camera';save()
click('Export');ab('download','#export-png',root/'downloads'/('terra-'+str(expected['seed'])+'-heightfield.png'));pngfile=root/'downloads'/('terra-'+str(expected['seed'])+'-heightfield.png');assert pngfile.exists();results['png_export_bytes']=pngfile.stat().st_size;save()
# Corrupt import must be atomic.
bad=root/'tests/invalid-state.json';bad.write_text('{"format":"terra-hydraulic-lab","version":1,"n":999999}')
click('Export');click('Import simulation');ab('upload','#file-input',bad);wait_state('document.getElementById("toast").textContent.startsWith("Import failed:")');assert json.loads(js('JSON.stringify(window.terra.snapshot())'))==expected;results['invalid_import']=ab('get','text','#toast');snap('19-invalid-import.png');save()
# Invalid array values are rejected too.
bad_data=json.loads(jsonfile.read_text());bad_data['layers']['w'][0]=-4;bad.write_text(json.dumps(bad_data));click('Export');click('Import simulation');ab('upload','#file-input',bad);wait_state('document.getElementById("toast").textContent.includes("Out-of-range")');assert json.loads(js('JSON.stringify(window.terra.snapshot())'))==expected;results['negative_water_import']='Rejected atomically';save()
print(json.dumps({k:v for k,v in results.items() if k!='reset'},indent=2))
