"""Contract tests for one artifact per independently evaluated agentic run."""
from __future__ import annotations
import hashlib
import importlib.util
import io
import json
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'gallery'))
spec = importlib.util.spec_from_file_location('single_gallery', ROOT / 'gallery/server.py')
server = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = server
spec.loader.exec_module(server)

class PackageTests(unittest.TestCase):
    def test_twenty_four_singular_html_prompts(self):
        catalog = json.loads((ROOT / 'prompts/catalog.json').read_text(encoding='utf-8'))
        self.assertEqual(len(catalog), 24)
        self.assertEqual(len(list((ROOT/'prompts').glob('*/prompt.md'))), 24)
        self.assertEqual([task['id'] for task in catalog[20:]], [
            '21-spreadsheet-chart-studio', '22-vector-layout-studio',
            '23-project-planning-studio', '24-capstone',
        ])
        for task in catalog:
            self.assertEqual((task['track'], task['artifact_type'], task['rubric']),
                             ('html', 'single-html', 'html-v1'))
            folder = ROOT / 'prompts' / task['id']
            text = (folder/'prompt.md').read_text(encoding='utf-8')
            self.assertIn('agent-browser', text)
            self.assertIn('from the beginning', text)
            self.assertIn('## Validation', text)
            self.assertFalse((folder/'task.md').exists())
            self.assertNotIn('Stage ' + 'A', text)
            self.assertNotIn('Stage ' + 'B', text)
            self.assertNotIn('`a.html`', text)
            self.assertNotIn('`b/`', text)
            self.assertNotIn('Return only the complete', text)
            self.assertIn('evidence/', text)
        self.assertFalse(list((ROOT/'prompts').rglob('*'+'blind'+'*')))
        self.assertFalse(list((ROOT/'prompts').rglob('*'+'recovery'+'*')))

    def test_schemas_use_one_result(self):
        meta = json.loads((ROOT/'schema/example.metadata.json').read_text(encoding='utf-8'))
        self.assertIn('score', meta)
        self.assertNotIn('scores', meta)
        report = json.loads((ROOT/'schema/report.schema.json').read_text(encoding='utf-8'))
        self.assertEqual(report['title'], 'Evaluator-supplied run report')

    def test_original_twenty_domain_requirements_preserved(self):
        expected=json.loads((ROOT/'tests/domain_requirements.sha256.json').read_text(encoding='utf-8'))
        self.assertEqual(len(expected), 20)
        self.assertEqual([task_id[:2] for task_id in expected], [f'{number:02d}' for number in range(1, 21)])
        for task_id,digest in expected.items():
            text=(ROOT/'prompts'/task_id/'prompt.md').read_text(encoding='utf-8')
            domain=text.split('## Application requirements\n',1)[1].split('\n\n---\n\n',1)[0].strip()
            self.assertEqual(hashlib.sha256(domain.encode()).hexdigest(),digest,task_id)

    def test_rubric_totals_and_example_score(self):
        rubrics = json.loads((ROOT / 'evaluator/rubrics.json').read_text(encoding='utf-8'))
        for rubric in rubrics.values():
            self.assertEqual(sum(value for key, value in rubric.items() if key != 'track'), 100)
        sample = json.loads((ROOT / 'schema/example.metadata.json').read_text(encoding='utf-8'))
        score = sample['score']
        self.assertAlmostEqual(sum(value for key, value in score.items() if key != 'total'), score['total'])
        for dimension, maximum in rubrics['html-v1'].items():
            if dimension != 'track':
                self.assertLessEqual(score[dimension], maximum, dimension)

    def test_all_packaged_json_is_valid(self):
        for path in ROOT.rglob('*.json'):
            if not set(path.relative_to(ROOT).parts)&{'results','node_modules','.agents','.netlify','.git','dist','.playwright-mcp'}:
                with self.subTest(file=str(path.relative_to(ROOT))):
                    json.loads(path.read_text(encoding='utf-8'))

class GalleryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.results = Path(self.temp.name)/'results'; self.results.mkdir()
        previous = server.RESULTS_ROOT; server.RESULTS_ROOT = self.results
        self.addCleanup(setattr, server, 'RESULTS_ROOT', previous)
        self.run = self.results/'Model One'/'21-spreadsheet-chart-studio-001'; self.run.mkdir(parents=True)
        self.state = server.GalleryState('http://127.0.0.1:8766')

    def html(self):
        p=self.run/'index.html'
        p.write_text('<!doctype html><title>Fixture</title><button>Actual HTML</button>')
        return p

    def project(self):
        p=self.run/'project'; p.mkdir()
        (p/'main.py').write_text('print("source snapshot")\n')
        (p/'benchmark.json').write_text(json.dumps({'schema_version':1,'task_id':'21-spreadsheet-chart-studio','name':'Fixture','commands':{'start':['python','main.py']}}))
        return p

    def metadata(self, **fields):
        (self.run/'metadata.json').write_text(json.dumps({'task_id':'21-spreadsheet-chart-studio',**fields}))

    def start_http(self, handler):
        http=server.QuietThreadingHTTPServer(('127.0.0.1',0),handler)
        threading.Thread(target=http.serve_forever,daemon=True).start()
        self.addCleanup(http.server_close); self.addCleanup(http.shutdown)
        return f'http://127.0.0.1:{http.server_address[1]}'

    def get(self, url):
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url,timeout=5) as response:
            return response.status,response.read(),dict(response.headers)

    def test_html_discovery_and_exact_hash(self):
        p=self.html(); rows=self.state.scan()
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['artifact']['kind'],'html')
        self.assertEqual(rows[0]['artifact']['sha256'],hashlib.sha256(p.read_bytes()).hexdigest())
        self.assertIn('Model%20One',rows[0]['artifact']['url'])
        self.assertIsNone(rows[0]['score'])
        self.assertEqual(rows[0]['model'],'Model One')
        self.assertNotIn('a',rows[0]); self.assertNotIn('b',rows[0])
        self.assertEqual(set(rows[0]['prompts']),{'prompt','acceptance'})

    def test_report_score_and_checks(self):
        self.html()
        (self.run/'report.json').write_text(json.dumps({'total':83,'checks':[{'id':'C1','status':'pass'},{'id':'C2','status':'blocked'}]}))
        row=self.state.scan()[0]
        self.assertEqual(row['score'],83)
        self.assertEqual(row['checks']['pass'],1)
        self.assertEqual(row['checks']['blocked'],1)
        self.assertEqual(row['artifact']['checks'][0]['id'],'C1')

    def test_metadata_score_and_zero_are_preserved(self):
        self.html(); self.metadata(score=0)
        self.assertEqual(self.state.scan()[0]['score'],0)
        self.metadata(score=101)
        self.assertIsNone(self.state.scan()[0]['score'])

    def test_manifest_inference_and_local_preview(self):
        self.project()
        (self.run/'metadata.json').write_text(json.dumps({'preview_url':'http://127.0.0.1:8811/'}))
        row=self.state.scan()[0]
        self.assertEqual(row['artifact']['kind'],'project')
        self.assertEqual(row['artifact']['url'],'http://127.0.0.1:8811/')
        self.assertEqual(row['artifact']['manifest']['name'],'Fixture')
        self.assertEqual(row['artifact']['file_count'],2)
        self.assertEqual(row['task_id'],'21-spreadsheet-chart-studio')

    def test_archive_no_extraction(self):
        with zipfile.ZipFile(self.run/'project.zip','w') as z:z.writestr('../escape.txt','untrusted')
        row=self.state.scan()[0]
        self.assertEqual(row['artifact']['kind'],'archive')
        self.assertIsNone(row['artifact']['url'])
        self.assertFalse((self.results/'escape.txt').exists())

    def test_preview_rejects_remote(self):
        self.project();self.metadata(preview_url='https://example.com:443/')
        row=self.state.scan()[0]
        self.assertIsNone(row['artifact']['url'])
        self.assertTrue(row['artifact']['warning'])

    def test_metadata_only_entry(self):
        self.metadata(notes='Execution blocked by harness')
        row=self.state.scan()[0]
        self.assertFalse(row['artifact']['exists'])
        self.assertEqual(row['notes'],'Execution blocked by harness')

    def test_ambiguous_artifacts_are_reported(self):
        self.html();self.project()
        row=self.state.scan()[0]
        self.assertIn('Multiple',row['artifact']['warning'])

    def test_api_prompt_csv_source_and_security(self):
        self.project();self.metadata(model='=FORMULA()',score=81)
        (self.run/'project'/'.env').write_text('PRIVATE=yes')
        base=self.start_http(server.make_gallery_handler(self.state))
        status,body,headers=self.get(base+'/api/data')
        self.assertEqual(status,200)
        payload=json.loads(body)
        self.assertEqual(payload['summary']['runs'],1)
        self.assertEqual(payload['summary']['average_score'],81)
        self.assertNotIn('average_gain',payload['summary'])
        self.assertEqual(len(payload['catalog']),24)
        _,prompt,_=self.get(base+'/prompts/21-spreadsheet-chart-studio/prompt.md')
        self.assertIn(b'agent-browser',prompt)
        _,csv,_=self.get(base+'/api/export.csv')
        self.assertIn(b"'=FORMULA()",csv)
        self.assertNotIn(b'score_a',csv)
        _,source,_=self.get(base+payload['results'][0]['artifact']['source_url'])
        with zipfile.ZipFile(io.BytesIO(source)) as z:
            self.assertIn('main.py',z.namelist());self.assertNotIn('.env',z.namelist())
        for path in ('/prompts/../../README.md','/api/source.zip?run=../..'):
            with self.assertRaises(urllib.error.HTTPError):self.get(base+path)

    def test_artifact_server_does_not_serve_source_secrets(self):
        self.html();self.project()
        (self.run/'project'/'.env').write_text('SECRET=yes')
        base=self.start_http(server.make_artifact_handler())
        _,html,_=self.get(base+'/Model%20One/21-spreadsheet-chart-studio-001/index.html')
        self.assertIn(b'Actual HTML',html)
        for tail in ('project/.env','project/main.py','../../../README.md'):
            with self.assertRaises(urllib.error.HTTPError):self.get(base+'/Model%20One/21-spreadsheet-chart-studio-001/'+tail)

    def test_symlink_cannot_escape(self):
        outside=Path(self.temp.name)/'outside.html';outside.write_text('SECRET')
        try:(self.run/'index.html').symlink_to(outside)
        except OSError:self.skipTest('Symlinks unavailable')
        self.assertEqual(self.state.scan(),[])
        base=self.start_http(server.make_artifact_handler())
        with self.assertRaises(urllib.error.HTTPError):self.get(base+'/Model%20One/21-spreadsheet-chart-studio-001/index.html')

    def test_importer_html_and_project(self):
        html=Path(self.temp.name)/'input.html';html.write_text('<!doctype html><title>Imported</title>')
        cmd=[sys.executable,str(ROOT/'tools/new_run.py'),'--results-dir',str(self.results),'--model','Exact Model','--run','001','--task','01-fluid-simulation','--html',str(html),'--score','77']
        result=subprocess.run(cmd,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        dest=self.results/'Exact_Model'/'001'
        self.assertEqual((dest/'index.html').read_bytes(),html.read_bytes())
        self.assertEqual(json.loads((dest/'metadata.json').read_text(encoding='utf-8'))['score'],77)
        again=subprocess.run(cmd,capture_output=True,text=True)
        self.assertNotEqual(again.returncode,0)
        project=Path(self.temp.name)/'source';project.mkdir();(project/'main.py').write_text('print(42)')
        cmd=[sys.executable,str(ROOT/'tools/new_run.py'),'--results-dir',str(self.results),'--model','Exact Model','--run','002','--task','21-spreadsheet-chart-studio','--project',str(project),'--url','http://127.0.0.1:8811/']
        result=subprocess.run(cmd,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertTrue((self.results/'Exact_Model'/'002'/'project'/'main.py').exists())

    def test_changed_source_invalidates_bound_report_score(self):
        path=self.html()
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        (self.run/'report.json').write_text(json.dumps({'total':92,'artifact_sha256':digest}))
        first=self.state.scan()[0]
        self.assertEqual(first['score'],92);self.assertEqual(first['report_binding'],'match')
        path.write_text('<!doctype html><title>Different source</title>')
        second=self.state.scan()[0]
        self.assertIsNone(second['score']);self.assertEqual(second['report_binding'],'stale')
        self.assertEqual(self.state.summary([second])['scored_runs'],0)

    def test_force_replacement_clears_old_evaluation(self):
        src=Path(self.temp.name)/'new.html';src.write_text('<!doctype html><title>New</title>')
        command=[sys.executable,str(ROOT/'tools/new_run.py'),'--results-dir',str(self.results),'--model','Force Model','--run','001','--task','01-fluid-simulation','--html',str(src),'--score','80']
        first=subprocess.run(command,capture_output=True,text=True);self.assertEqual(first.returncode,0,first.stderr)
        dest=self.results/'Force_Model'/'001'
        (dest/'report.json').write_text('{"total":80}')
        (dest/'screenshot.png').write_bytes(b'screenshot sentinel')
        (dest/'evidence').mkdir();(dest/'evidence/validation.md').write_text('Old source evidence')
        src.write_text('<!doctype html><title>Newer</title>')
        second=subprocess.run(command[:-2]+['--force'],capture_output=True,text=True)
        self.assertEqual(second.returncode,0,second.stderr)
        self.assertNotIn('score',json.loads((dest/'metadata.json').read_text(encoding='utf-8')))
        for name in ('report.json','screenshot.png','evidence'):self.assertFalse((dest/name).exists())
        self.assertEqual((dest/'index.html').read_bytes(),src.read_bytes())

    def test_invalid_report_import_does_not_mutate_destination(self):
        src=self.html();self.metadata(score=75)
        original=src.read_bytes();meta=(self.run/'metadata.json').read_bytes()
        report=Path(self.temp.name)/'bad.json';report.write_text('{not json')
        result=subprocess.run([sys.executable,str(ROOT/'tools/new_run.py'),'--results-dir',str(self.results),'--model','Model One','--model-folder','Model_One','--run','other','--task','21-spreadsheet-chart-studio','--report',str(report)],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(src.read_bytes(),original);self.assertEqual((self.run/'metadata.json').read_bytes(),meta)
        self.assertFalse((self.results/'Model_One'/'other').exists())

if __name__=='__main__':unittest.main()
