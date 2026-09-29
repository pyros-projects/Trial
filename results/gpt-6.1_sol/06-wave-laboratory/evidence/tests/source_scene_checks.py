from browser_checks import *
import struct,sys,browser_checks
if len(sys.argv)>1:browser_checks.S=sys.argv[1]
ab('set','viewport',1280,800,1);ab('scroll','up',10000);ab('open','file://'+str(ROOT/'index.html'));pause();click('Inspect source 1');slider('#edit-frequency','End');assert diag()['sources'][0]['frequency']==4
slider('#edit-amplitude','Home');assert diag()['sources'][0]['amplitude']==0;slider('#edit-amplitude','End');assert diag()['sources'][0]['amplitude']==5
slider('#edit-phase','End');assert diag()['sources'][0]['phase']==180
ab('uncheck','#inspector input[data-key="active"]');assert not diag()['sources'][0]['active'];ab('check','#inspector input[data-key="active"]');assert diag()['sources'][0]['active']
ab('select','#edit-mode','pulse');assert diag()['sources'][0]['mode']=='pulse';slider('#edit-duration','End');assert diag()['sources'][0]['duration']==4
for wave in ['triangle','square','chirp','sine']:
 ab('select','#edit-waveform',wave);assert diag()['sources'][0]['waveform']==wave;click('Fire pulse');resume();wait_sim(.4);pause();assert diag()['maxAmplitude']<100
ab('select','#edit-mode','continuous');assert diag()['sources'][0]['mode']=='continuous';state('source-controls');shot('source-controls')
slider('#speed','Home');assert 'UNDER-RESOLVED' in ab('get','text','#wavelength');shot('under-resolved-warning');click('Reset scene');pause()
ab('select','#palette','violet');shot('palette-violet');ab('select','#palette','gold');shot('palette-gold');ab('select','#palette','mint')
ab('select','#boundary','periodic');ab('select','#substeps','2');slider('#exposure','End');slider('#persistence','End');slider('#damping','End');ab('uncheck','#showGrid');ab('uncheck','#showObjects');shot('display-controls');ab('check','#showGrid');ab('check','#showObjects')
# Create an editable scene entirely through native pointer tools.
ab('select','#preset','blank');pause();click('Point source');tap(2.2,3);click('Line source');draw((1.2,1),(1.2,6.8));click('Pulsed source');tap(3,6);assert diag()['sources'][-1]['mode']=='pulse';click('Phased array');draw((3.2,1.3),(4.1,2.8));assert diag()['sourceCount']>=6
click('Slit barrier');draw((6.2,.08),(6.2,7.92));walls=diag()['wallCells'];ab('select','#edit-count','1');assert diag()['wallCells']>walls;ab('select','#edit-count','2')
click('Absorbing barrier');draw((10,1),(10,7));assert diag()['absorberCells']>250
ab('select','#drawIndex','0.65');click('Refractive region');slider('#brush','End');draw((8,.8),(8,7.2));fast=state('faster-medium-cfl');assert fast['mediumCells']>1000 and fast['clamped'] and fast['cfl']<=.921
click('Place probe');tap(9.2,4);resume();wait_sim(8);pause();p=diag()['probes'][0];assert p['samples']>100 and p['stats']['amp']>0
# Advance to a sampled timestep, then compare the last probe value to the live field.
for _ in range(5):
 d=diag();p=d['probes'][0]
 if abs(p['last']['t']-d['time'])<1e-8:break
 click('Single step')
d=state('probe-field-consistency');p=d['probes'][0];assert abs(p['last']['t']-d['time'])<1e-8 and abs(p['last']['v']-p['sample'])<1e-8
shot('custom-scene-all-tools');click('Save scene');assert 'saved locally' in ab('get','text','#toast')
ab('click','#sceneMenuBtn');ab('download','#exportScene',str(E/'exported-scene.json'));exported=json.loads((E/'exported-scene.json').read_text());assert len(exported['sources'])==d['sourceCount'] and len(exported['structures'])==d['structureCount'] and exported['config']['drawIndex']==.65
ab('click','#sceneMenuBtn');ab('download','#downloadImage',str(E/'exported-field.png'));image=(E/'exported-field.png').read_bytes();assert image[:8]==b'\x89PNG\r\n\x1a\n';report('exported PNG size',struct.unpack('>II',image[16:24]))
(E/'tests'/'invalid-json.json').write_text('{broken');bad={**exported,'sources':[dict(s) for s in exported['sources']]};bad['sources'][0]['frequency']=0;(E/'tests'/'invalid-scene.json').write_text(json.dumps(bad))
for fixture in ['invalid-json.json','invalid-scene.json']:
 before=diag();ab('upload','#sceneFile',str(E/'tests'/fixture));assert 'Invalid' in ab('get','text','#toast');after=diag();assert before['sourceCount']==after['sourceCount'] and before['wallCells']==after['wallCells'] and before['time']==after['time'];shot('error-'+fixture.replace('.json',''))
click('Reset scene');pause();assert diag()['sourceCount']==0
ab('upload','#sceneFile',str(E/'exported-scene.json'));pause();restored=state('json-import-restored');assert restored['sourceCount']==d['sourceCount'] and restored['wallCells']==d['wallCells'] and restored['mediumCells']==d['mediumCells'];shot('imported-scene')
ab('reload');pause();assert diag()['sourceCount']==2;ab('click','#sceneMenuBtn');click('Restore saved scene');pause();saved=state('saved-scene-restored-after-reload');assert saved['sourceCount']==d['sourceCount'] and saved['wallCells']==d['wallCells'] and saved['mediumCells']==d['mediumCells'];shot('saved-scene-restored')
# Resize without clearing or advancing the field.
a=diag();ab('set','viewport',390,844,2);b=diag();assert a['fieldSquaredSum']==b['fieldSquaredSum'] and a['time']==b['time'];ab('set','viewport',1280,800,1)
# Final preset, with no scene edits left on screen.
ab('select','#preset','interference');pause();shot('desktop-final');state('desktop-final');ab('errors');ab('console');ab('network','requests');report('source controls, tools, probe consistency, import/export and save/restore','PASS')
