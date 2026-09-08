from ui_helpers import *
import copy
src=json.loads((ROOT/'evidence/roundtrip.json').read_text());dir=ROOT/'evidence/hostile';dir.mkdir(exist_ok=True)
variants={}
def variant(name,fn):
 d=copy.deepcopy(src);fn(d);variants[name+'.json']=json.dumps(d)
variants['malformed.json']='{"app":"Forma", broken'
variant('duplicate-id',lambda d:d['items'].append(copy.deepcopy(d['items'][-1])))
variant('cycle',lambda d:d['items'][0].update(parent=d['items'][0]['id']))
variant('type',lambda d:d['items'][0].update(type='script'))
variant('version',lambda d:d.update(version=2))
variant('empty-parent',lambda d:d['items'][-1].update(parent=''))
variant('remote-resource',lambda d:d['items'][-1]['style'].update(fill='url(https://example.invalid/attack.svg)'))
variant('unknown-asset',lambda d:d.update(assets=['https://example.invalid/a.png']))
variant('coordinate',lambda d:d['items'][-1]['transform'].__setitem__(4,100001))
variant('singular',lambda d:d['items'][-1].update(transform=[0,0,0,0,0,0]))
variant('negative-scale',lambda d:d['items'][-1].update(transform=[-1,0,0,1,0,0]))
variant('text-limit',lambda d:next(o for o in d['items'] if o['type']=='text').update(text='x'*2001))
variant('anchor-limit',lambda d:next(o for o in d['items'] if o['type']=='path').update(nodes=[copy.deepcopy(next(o for o in d['items'] if o['type']=='path')['nodes'][0]) for _ in range(33)]))
variant('opacity-group',lambda d:next(o for o in d['items'] if o['type']=='group')['style'].update(opacity=.5))
d=copy.deepcopy(src);d['items'][-1]['transform'][4]='INFINITE';variants['nonfinite.json']=json.dumps(d).replace('"INFINITE"','1e309')
leaf=copy.deepcopy(next(o for o in src['items'] if o['type']=='ellipse'));leaf['parent']=None
many=copy.deepcopy(src);many['items']=[]
for i in range(201):o=copy.deepcopy(leaf);o['id']='many-'+str(i);many['items'].append(o)
variants['item-limit.json']=json.dumps(many)
group=copy.deepcopy(next(o for o in src['items'] if o['type']=='group'));deep=copy.deepcopy(src);deep['items']=[]
for i in range(5):o=copy.deepcopy(group);o.update(id='deep-'+str(i),parent=None if i==0 else 'deep-'+str(i-1));deep['items'].append(o)
leaf['id']='deep-leaf';leaf['parent']='deep-4';deep['items'].append(leaf);variants['depth-limit.json']=json.dumps(deep)
variants['byte-limit.json']=' '*2097153
variants['arbitrary.svg']='<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
variants['arbitrary.html']='<img src="https://example.invalid/" onerror="alert(1)">'
click('Select layer Arch');field('Selection X',diag()['bounds']['x']+7)
for name,content in variants.items():
 path=dir/name;path.write_text(content);before=diag();ab('upload','#projectFile',str(path));after=diag();assert before['document']==after['document'],name;assert before['selection']==after['selection'] and before['history']==after['history'],name;assert after['error'] and 'refused' in after['status'].lower(),(name,after['status']);readout('PASS rejected '+name+'; exact scene, selection and history preserved. '+after['status'])
# Large numeric-looking stable IDs cannot poison future IDs.
large=copy.deepcopy(src);old=large['items'][-1]['id'];large['items'][-1]['id']='item-9007199254740992'
for o in large['items']:
 if o['parent']==old:o['parent']=large['items'][-1]['id']
p=dir/'valid-large-id.json';p.write_text(json.dumps(large));ab('upload','#projectFile',str(p));before=len(diag()['document']['items']);create('Rectangle',750,550,90,60,'After import');assert len(diag()['document']['items'])==before+1;readout('PASS: valid large numeric-looking imported ID does not prevent subsequent tool creation.')
save('13-hostile-result.json')
