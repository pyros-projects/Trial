from importlib.machinery import SourceFileLoader
import json
v=SourceFileLoader('v','evidence/browser-validation.py').load_module()
scene=json.loads((v.ROOT/'exported-scene.json').read_text())
s=dict(scene['sources'][0]);s.update(x=.28,y=.5,type='point',frequency=4,amplitude=1.53,phase=0,waveform='square',active=True)
scene.update(preset='interference',resolution=160,settings={'speed':8,'dt':.018,'damping':.025,'boundary':'absorbing','persistence':.45},sources=[s,{**s,'amplitude':1,'phase':180,'waveform':'sine'},{**s,'x':.8,'frequency':.2,'amplitude':0,'phase':0,'waveform':'sine'}],structures=[],probes=[{'x':.42,'y':.5}]);scene['display']['substeps']=8
fixture=v.ROOT/'harmonic-test-scene.json';fixture.write_text(json.dumps(scene))
v.ab('reload');v.pause();v.ab('find','text','Your workspace','click');v.click('Import scene');v.ab('upload','#importFile',str(fixture));v.ab('wait','--text','Scene restored and paused');v.resume();v.waitsim(25);v.pause();d=v.state();assert abs(d['probes'][0]['frequency']-12)<.08;v.report('higher harmonic measured from actual simulation without aliasing',d);v.fieldvisible();v.shot('harmonic-probe-12hz.png');v.ab('errors');v.ab('console')
