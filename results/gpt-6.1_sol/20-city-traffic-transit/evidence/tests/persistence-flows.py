import importlib.util,pathlib
spec=importlib.util.spec_from_file_location('browser_flows',pathlib.Path(__file__).with_name('browser-flows.py'))
flow=importlib.util.module_from_spec(spec);spec.loader.exec_module(flow)
for name in ['ROOT','cmd','snap','shot','state','js']:globals()[name]=getattr(flow,name)
import csv,hashlib,json

def checksum():return js('JSON.stringify({city:Flowstate.snapshot().city,sim:Flowstate.snapshot().sim,paused:Flowstate.paused})')
def main():
    assert js('Flowstate.paused')
    cmd('find','role','button','click','--name','Save city','--exact');snap('save-city')
    cmd('fill','#citySaveName','Validation city');cmd('find','role','button','click','--name','Save snapshot')
    cmd('download','#downloadJson',str(ROOT/'evidence/exports/live-city.json'))
    data=json.loads((ROOT/'evidence/exports/live-city.json').read_text());assert data['version']==1 and len(data['sim']['vehicles'])>10
    saved=checksum();savedTime=js('Flowstate.sim.time');savedCounts=js('({roads:Flowstate.city.roads.length,vehicles:Flowstate.sim.vehicles.length,passengers:Flowstate.sim.passengers.length})')
    shot('named-save')
    cmd('click','[data-close="saveDialog"]');cmd('click','#stepButton');assert js('Flowstate.sim.time')>savedTime
    cmd('click','#saveButton');cmd('click','[data-load-save="0"]')
    assert checksum()==saved,'named snapshot must restore exact network and live simulation state'
    print('PASS named save and exact live-state load')
    # Both syntax and structural errors must preserve the entire running city.
    invalid=ROOT/'evidence/exports/invalid-city.json';bad=json.loads(json.dumps(data));bad['city']['roads'][0]['b']=999999;invalid.write_text(json.dumps(bad))
    malformed=ROOT/'evidence/exports/malformed-city.json';malformed.write_text('{"city": }')
    cmd('click','#saveButton')
    for file in [invalid,malformed]:
        current=checksum();cmd('upload','#importFile',str(file));cmd('wait','--fn','!document.querySelector("#importError").classList.contains("hidden")');assert checksum()==current
        assert 'Import rejected' in cmd('get','text','#importError')
        shot('invalid-import-'+file.stem)
    cmd('upload','#importFile',str(ROOT/'evidence/exports/live-city.json'))
    cmd('wait','--fn','!document.querySelector("#saveDialog").open')
    assert checksum()==saved,'JSON snapshot must restore exact state'
    print('PASS JSON download/import and graceful invalid syntax / reference rejection with city preserved')
    cmd('reload');cmd('wait','--fn','Flowstate.city && Flowstate.sim')
    assert checksum()==saved,'autosave must restore state after actual reload'
    print('PASS local autosave restores exact state after direct-file reload')
    cmd('click','#exportButton');cmd('download','#exportCsv',str(ROOT/'evidence/exports/metrics.csv'))
    rows=list(csv.DictReader((ROOT/'evidence/exports/metrics.csv').open()));assert len(rows)==len(data['sim']['history'])
    assert 'mean_travel_seconds' in rows[0]
    cmd('download','#exportPng',str(ROOT/'evidence/exports/map.png'))
    assert (ROOT/'evidence/exports/map.png').stat().st_size>10000
    cmd('click','[data-close="exportDialog"]')
    print('PASS actual CSV and PNG downloads')
    cmd('click','#soundButton');cmd('wait','--fn','Flowstate.diagnostics.audioState==="running"')
    assert js('Flowstate.diagnostics.audioEnabled')
    state('audio-enabled');cmd('click','#soundButton');assert not js('Flowstate.diagnostics.audioEnabled')
    print('PASS audio enabled by a genuine button gesture and mute; sound quality was not heard')
    cmd('set','offline','on');cmd('reload');cmd('wait','--fn','Flowstate.city && Flowstate.sim.vehicles.length>0')
    assert checksum()==saved
    cmd('network','requests');shot('file-offline');state('offline-file')
    cmd('set','offline','off')
    print('PASS direct-file offline reload with both http and https routes blocked')

if __name__=='__main__':main()
