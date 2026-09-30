#!/usr/bin/env bash
# Check 10: project round trip + hostile inputs through the real file input
source "$(dirname "$0")/../ab.sh"
field() { $AB scrollintoview "[data-field=$1]" >/dev/null; $AB fill "[data-field=$1]" "$2" >/dev/null; $AB press Enter >/dev/null; $AB press Escape >/dev/null; }
ly() { $AB scrollintoview "#layers .lrow[data-id=$1] $2" >/dev/null; $AB click "#layers .lrow[data-id=$1] $2" >/dev/null; }
D=$PWD/evidence/downloads; M=$PWD/evidence/hostile; mkdir -p $M
fresh
echo "== 10a build a project with paths, styled text, nested transforms, hidden and locked items"
ly birds .lname; field rot 12; field scale 1.2
ly sky .twist; ly stars .twist; ly st3 .vis
ly title .lk
ly sub .lname; $AB scrollintoview '#insText' >/dev/null; $AB click '#insText' >/dev/null; $AB press Control+a >/dev/null; $AB keyboard type 'Round <trip> & "quotes"' >/dev/null; $AB press Enter >/dev/null; $AB keyboard type 'line two' >/dev/null; $AB press Control+Enter >/dev/null
rm -f $D/t10-project.vls.json; $AB download '#btnExportJSON' $D/t10-project.vls.json >/dev/null
python3 -c "
import json;p=json.load(open('$D/t10-project.vls.json'))
print('   downloaded:',p['format'],'v',p['version'],len(p['items']),'items; hidden:',[i['id'] for i in p['items'] if not i['visible']],'locked:',[i['id'] for i in p['items'] if i['locked']],'birds:',[i['transform'] for i in p['items'] if i['id']=='birds'])"
echo "== 10b change the document, then reimport the downloaded file"
ly far .lname; $AB focus '#stage' >/dev/null; $AB press Delete >/dev/null; $AB press ArrowRight >/dev/null
echo "   changed: items=$(diag 'd.items') history=$(diag 'd.history.undo')"
$AB upload '#fileImport' $D/t10-project.vls.json >/dev/null; $AB wait 300 >/dev/null
echo "   confirm dialog: $($AB eval 'document.getElementById("modalBody").textContent')"
$AB find role button click --name "Replace document" >/dev/null; $AB wait 200 >/dev/null
diag 'd.project' > /tmp/claude-1000/after.json
python3 - $D/t10-project.vls.json /tmp/claude-1000/after.json <<'PY'
import json,sys
a=json.load(open(sys.argv[1])); b=json.loads(json.loads(open(sys.argv[2]).read()))
print("   round trip identical (artboard+items incl. ids, order, parents, transforms, locks, visibility, text):", a['artboard']==b['artboard'] and a['items']==b['items'])
PY
echo "   after import: history=$(diag 'd.history.undo+"/"+d.history.redo') sel=$(diag 'd.selection') io=$(diag 'd.io.msg')"
echo "== 10c hostile inputs (each must be refused with document, selection and history intact)"
python3 - $D/t10-project.vls.json $M <<'PY'
import json,sys,copy
src=json.load(open(sys.argv[1])); M=sys.argv[2]
def w(name, obj=None, raw=None):
    open(f"{M}/{name}", 'w').write(raw if raw is not None else json.dumps(obj))
txt=open(sys.argv[1]).read()
w('malformed.json', raw=txt[:len(txt)//2])
p=copy.deepcopy(src); p['items'][5]['id']=p['items'][4]['id']; w('duplicate-id.json', p)
p=copy.deepcopy(src); g=[i for i in p['items'] if i['type']=='group']; g[0]['parent']=g[1]['id']; w('cycle.json', p)
w('nonfinite.json', raw=txt.replace('"width": 800','"width": 1e309',1).replace('"x": 250','"x": 1e309',1))
p=copy.deepcopy(src); p['items'][3]['type']='image'; w('unsupported-type.json', p)
p=copy.deepcopy(src); base=[i for i in p['items'] if i['type']=='rect'][0]
for k in range(480): q=copy.deepcopy(base); q['id']=f'x{k}'; q['parent']=None; p['items'].append(q)
w('too-many-items.json', p)
p=copy.deepcopy(src); t=[i for i in p['items'] if i['type']=='text'][0]; t['text']='A'*2001; w('text-too-long.json', p)
p=copy.deepcopy(src); pa=[i for i in p['items'] if i['type']=='path'][0]; pa['anchors']=pa['anchors']*6; w('too-many-anchors.json', p)
p=copy.deepcopy(src); prev=None
for k in range(9): p['items'].append({'id':f'deep{k}','type':'group','parent':prev,'name':'g','visible':True,'locked':False,'transform':{'x':0,'y':0,'rotation':0,'scale':1},'opacity':1}); prev=f'deep{k}'
q=copy.deepcopy(base); q['id']='deepleaf'; q['parent']=prev; p['items'].append(q); w('too-deep.json', p)
p=copy.deepcopy(src); [i for i in p['items'] if i['type']=='rect'][0]['fill']='url(https://example.com/x.png)'; w('remote-fill-url.json', p)
p=copy.deepcopy(src); p['items'][2]['href']='https://example.com/x.svg'; w('unknown-href-field.json', p)
p=copy.deepcopy(src); p['version']=2; w('version-2.json', p)
p=copy.deepcopy(src); p['items'][2]['parent']='missing-group'; w('missing-parent.json', p)
p=copy.deepcopy(src); [i for i in p['items'] if i['type']=='rect'][0]['transform']['scale']=0; w('zero-scale.json', p)
w('oversize.json', raw=txt[:-2] + ' '*(5*1024*1024+10) + '}\n')
w('drawing.svg', raw='<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><image href="https://example.com/a.png"/></svg>')
w('page.html', raw='<html><body><img src=x onerror=alert(1)></body></html>')
w('svg-renamed.json', raw='<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>')
print("   wrote", len(__import__('os').listdir(M)), "hostile files")
PY
ly sun .lname 2>/dev/null; ly sky .lname; $AB focus '#stage' >/dev/null; $AB press ArrowLeft >/dev/null
P0=$(diag 'd.project'); S0=$(diag 'd.selection'); H0=$(diag 'd.history.undo+"/"+d.history.redo')
echo "   baseline: sel=$S0 history=$H0"
$AB network requests --clear >/dev/null 2>&1
for f in malformed duplicate-id cycle nonfinite unsupported-type too-many-items text-too-long too-many-anchors too-deep remote-fill-url unknown-href-field version-2 missing-parent zero-scale oversize; do
  $AB upload '#fileImport' $M/$f.json >/dev/null; $AB wait 250 >/dev/null
  modal=$($AB eval '!document.getElementById("modal").hidden')
  ok=$([ "$P0" = "$(diag 'd.project')" ] && [ "$S0" = "$(diag 'd.selection')" ] && [ "$H0" = "$(diag 'd.history.undo+"/"+d.history.redo')" ] && [ "$modal" = "false" ] && echo PASS || echo FAIL)
  echo "   [$ok] $f: $(diag 'd.io.msg' | cut -c1-170)"
done
for f in drawing.svg page.html svg-renamed.json; do
  $AB upload '#fileImport' $M/$f >/dev/null; $AB wait 250 >/dev/null
  ok=$([ "$P0" = "$(diag 'd.project')" ] && [ "$S0" = "$(diag 'd.selection')" ] && [ "$H0" = "$(diag 'd.history.undo+"/"+d.history.redo')" ] && echo PASS || echo FAIL)
  echo "   [$ok] $f: $(diag 'd.io.msg' | cut -c1-170)"
done
echo "   img/script/foreignObject injected into page: $($AB eval 'document.querySelectorAll("#scene *:not(g):not(rect):not(ellipse):not(line):not(path):not(text):not(tspan)").length + document.querySelectorAll("img:not(#previewImg)").length')"
echo "   network requests to non-local hosts: $($AB network requests 2>&1 | grep -ci 'example.com')"
echo "   dialogs: $($AB dialog status 2>&1 | head -1)"
