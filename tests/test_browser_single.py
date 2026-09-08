"""Opt-in real Chromium integration checks; no injected API responses.
Run with RUN_BROWSER_TESTS=1 and Playwright/Chromium installed.
"""
import json
import os
import shutil
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
import re
from urllib.parse import quote, urlsplit
from pathlib import Path
from test_single_run import server, ROOT

class BrowserEnvironment(unittest.TestCase):
    def setUp(self):
        from playwright.sync_api import sync_playwright
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.results=Path(self.temp.name)/'results';self.results.mkdir()
        old=server.RESULTS_ROOT;server.RESULTS_ROOT=self.results;self.addCleanup(setattr,server,'RESULTS_ROOT',old)
        def http(handler):
            s=server.QuietThreadingHTTPServer(('127.0.0.1',0),handler)
            threading.Thread(target=s.serve_forever,daemon=True).start()
            self.addCleanup(s.server_close);self.addCleanup(s.shutdown)
            return f'http://127.0.0.1:{s.server_address[1]}'
        origin=http(server.make_artifact_handler())
        self.state=server.GalleryState(origin)
        self.base=http(server.make_gallery_handler(self.state))
        self.pw=sync_playwright().start();self.addCleanup(self.pw.stop)
        self.browser=self.pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server'])
        self.addCleanup(self.browser.close)
        self.context=self.browser.new_context(viewport={'width':1440,'height':1000})
        self.addCleanup(self.context.close)
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))

    def fixture(self):
        run=self.results/'UI fixture - not a model evaluation'/'01-fluid-simulation-001';run.mkdir(parents=True)
        (run/'index.html').write_text('''<!doctype html><html><head><meta charset="utf-8"><title>Functional browser-test counter</title></head><body><h1>Gallery integration fixture</h1><p>This is not a model benchmark result.</p><button id="increment">Count: 0</button><script>let n=0;document.querySelector('button').onclick=e=>{e.target.textContent='Count: '+(++n)};</script></body></html>''')
        (run/'metadata.json').write_text(json.dumps({'task_id':'01-fluid-simulation','score':80,'notes':'Illustrative browser integration fixture only.'}))
        (run/'report.json').write_text(json.dumps({'checks':[{'id':'UI-01','status':'pass','label':'Actual counter interaction','evidence':'Browser integration fixture, not a task evaluation.'}]}))
        project_run=self.results/'UI fixture - not a model evaluation'/'21-import-studio-001';(project_run/'project').mkdir(parents=True)
        (project_run/'project/README.md').write_text('Source download fixture, not a completed benchmark application.')
        (project_run/'project/benchmark.json').write_text(json.dumps({'task_id':'21-import-studio','name':'Source-view fixture','commands':{'start':['python','main.py']}}))
        (project_run/'metadata.json').write_text(json.dumps({'task_id':'21-import-studio','notes':'Illustrative source-view fixture. No application started.'}))

    def screenshot(self,name):
        directory=os.environ.get('GALLERY_SCREENSHOT_DIR')
        if directory:
            Path(directory).mkdir(parents=True,exist_ok=True)
            self.page.screenshot(path=str(Path(directory)/name),full_page=True)

    def navigate_direct(self):
        try:
            self.page.goto(self.base,wait_until='networkidle')
        except Exception as error:
            if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(error):
                self.skipTest('Browser navigation to loopback is administratively blocked; HTTP tests are separate.')
            raise

@unittest.skipUnless(os.environ.get('RUN_BROWSER_TESTS')=='1','Set RUN_BROWSER_TESTS=1 for direct Chromium integration.')
class BrowserTests(BrowserEnvironment):
    def comparison_fixture(self):
        names = ['Astra', 'Opus', 'Grok', 'GLM', 'Gemini']
        models = [{'key': 'fixture_' + name.lower(), 'label': name + ' fixture', 'color': color}
                  for name, color in zip(names, ['#88CCAA', '#CCAADD', '#EEAA77', '#CCBB88', '#99BBFF'])]
        for model in models:
            run = self.results / model['key'] / '01-fluid-simulation-main'
            run.mkdir(parents=True)
            (run / 'index.html').write_text('''<!doctype html><title>Comparison fixture</title>
<h1 id="build-model">''' + model['key'] + '''</h1><button id="increment">Count: 0</button>
<script>let n=0;document.querySelector('button').onclick=e=>e.target.textContent='Count: '+(++n);</script>''', encoding='utf-8')
        self.model_settings(json.dumps({'models': models}))
        return [model['key'] for model in models]

    def sparse_comparison_fixture(self):
        keys = self.comparison_fixture()
        (self.results / keys[3] / '01-fluid-simulation-main/index.html').unlink()
        for model, run_id in [(keys[3], self.state.catalog[1]['id']),
                              (keys[2], '01-fluid-simulation-extra')]:
            run = self.results / model / run_id
            run.mkdir()
            (run / 'index.html').write_text('<!doctype html><title>Additional comparison fixture</title>', encoding='utf-8')
        return keys

    def public_export(self):
        from http.server import SimpleHTTPRequestHandler
        from fnmatch import fnmatch
        from tools import build_site
        root = Path(self.temp.name)
        shutil.copytree(server.STATIC_ROOT, root / 'gallery/static')
        shutil.copytree(ROOT / 'prompts', root / 'prompts')
        output = root / 'dist/site'
        build_site.build_site(root, screenshots='none')
        data = json.loads((output / 'api/data.json').read_text(encoding='utf-8'))
        self.public_requests = requests = []
        rules = []
        for line in (output / '_headers').read_text(encoding='utf-8').splitlines():
            if line.startswith('/'):
                rules.append((line, []))
            elif line.strip():
                name, value = line.strip().split(':', 1)
                rules[-1][1].append((name, value.strip()))

        class PublicHandler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(output), **kwargs)

            def do_GET(self):
                requests.append(('GET', urlsplit(self.path).path))
                if urlsplit(self.path).path == '/api/data':
                    self.path = '/api/data.json'
                super().do_GET()

            def do_POST(self):
                requests.append(('POST', urlsplit(self.path).path))
                self.send_error(405)

            def end_headers(self):
                for pattern, headers in rules:
                    if fnmatch(urlsplit(self.path).path, pattern):
                        for name, value in headers:
                            self.send_header(name, value)
                super().end_headers()

            def log_message(self, *args):
                pass

        http = server.QuietThreadingHTTPServer(('127.0.0.1', 0), PublicHandler)
        threading.Thread(target=http.serve_forever, daemon=True).start()
        self.addCleanup(http.server_close);self.addCleanup(http.shutdown)
        return f'http://127.0.0.1:{http.server_address[1]}', data

    def demo_fixture(self):
        run = self.results / 'Demo isolation fixture' / '21-import-studio'
        demo = run / 'project/gallery/index.html'
        demo.parent.mkdir(parents=True)
        (run / 'project/benchmark.json').write_text(json.dumps({'task_id': '21-import-studio'}))
        (run.parent / 'model.toml').write_text('harness = "Test harness"\nsetting = "Test setting"\n')
        demo.write_text('''<!doctype html><html><meta charset="utf-8"><title>Demo isolation fixture</title>
<h1>Integration fixture, not a model result</h1><p>Demo changes disappear on reset or reload.</p>
<output id="count">0</output><button id="increment">Add record</button>
<button id="pending">Add later</button><input type="file" id="upload" aria-label="Import JSON">
<button id="export">Export JSON</button><button id="app-reset">Reset demo</button>
<script>
let records=[];const render=()=>document.querySelector('#count').textContent=records.length;
document.querySelector('#increment').onclick=()=>{records.push({value:records.length});render()};
document.querySelector('#pending').onclick=()=>setTimeout(()=>{records.push({late:true});render()},400);
document.querySelector('#upload').onchange=async e=>{const next=JSON.parse(await e.target.files[0].text());if(Array.isArray(next)){records=next;render()}};
document.querySelector('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(records)],{type:'application/json'}));a.download='demo.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0)};
document.querySelector('#app-reset').onclick=()=>location.reload();
window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));
window.probe=async origin=>{
 const outcomes={};for(const key of ['localStorage','sessionStorage']){try{window[key].setItem('probe','x');outcomes[key]='allowed'}catch{outcomes[key]='blocked'}}
 try{await new Promise((resolve,reject)=>{const r=indexedDB.open('probe');r.onsuccess=resolve;r.onerror=reject});outcomes.indexedDB='allowed'}catch{outcomes.indexedDB='blocked'}
 try{await caches.open('probe');outcomes.cache='allowed'}catch{outcomes.cache='blocked'}
 try{await navigator.serviceWorker.register(origin+'/probe/sw.js');outcomes.serviceWorker='allowed'}catch{outcomes.serviceWorker='blocked'}
 try{parent.document.body.dataset.probe='x';outcomes.parent='allowed'}catch{outcomes.parent='blocked'}
 await fetch(origin+'/probe/fetch',{method:'POST',body:'x'}).catch(()=>{});
 navigator.sendBeacon(origin+'/probe/beacon','x');
 const image=new Image();image.src=origin+'/probe/image';document.body.append(image);
 const script=document.createElement('script');script.src=origin+'/probe/script';document.body.append(script);
 const form=document.createElement('form');form.action=origin+'/probe/form';form.method='post';document.body.append(form);form.submit();
 return outcomes;
};
</script></html>''', encoding='utf-8')
        return run

    def test_gallery_demo_isolation_reset_import_export_and_direct_response_policy(self):
        from playwright.sync_api import expect
        self.demo_fixture()
        origin, data = self.public_export()
        row = data['results'][0]
        self.assertTrue(row['artifact']['demo'])
        self.page.goto(origin + row['share_url'])
        frame = self.page.frame_locator('#artifact-frame')
        expect(frame.locator('#count')).to_have_text('0')
        self.page.locator('#artifact-frame').element_handle().content_frame().wait_for_load_state()
        expect(self.page.locator('#artifact-frame')).to_have_attribute('sandbox', 'allow-scripts allow-downloads')
        frame.locator('#increment').click()
        expect(frame.locator('#count')).to_have_text('1')
        outcomes = frame.locator('body').evaluate('(body, origin)=>window.probe(origin)', origin)
        self.assertEqual(set(outcomes.values()), {'blocked'})
        self.page.wait_for_function("document.querySelector('#artifact-frame') !== null")
        self.assertFalse([request for request in self.public_requests if request[1].startswith('/probe/')])
        frame.locator('#upload').set_input_files({'name': 'records.json', 'mimeType': 'application/json', 'buffer': b'[{"a":1},{"a":2}]'})
        expect(frame.locator('#count')).to_have_text('2')
        with self.page.expect_download() as download:
            frame.locator('#export').click()
        self.assertEqual(json.loads(Path(download.value.path()).read_text()), [{'a': 1}, {'a': 2}])
        frame.locator('#pending').click()
        self.page.locator('#reset-demo').click()
        expect(frame.locator('#count')).to_have_text('0')
        self.page.wait_for_timeout(550)
        expect(frame.locator('#count')).to_have_text('0')
        frame.locator('#increment').click()
        self.page.reload()
        expect(frame.locator('#count')).to_have_text('0')
        for width, height in [(1280, 800), (390, 844)]:
            self.page.set_viewport_size({'width': width, 'height': height})
            reset = self.page.locator('#reset-demo').bounding_box()
            self.assertGreaterEqual(reset['x'], 0)
            self.assertLessEqual(reset['x'] + reset['width'], width)
            self.assertTrue(self.page.locator('.live-bar').evaluate('(bar)=>bar.scrollWidth<=bar.clientWidth'))
            self.assertLessEqual(self.page.locator('#artifact-frame').bounding_box()['y'], 90)
        direct = self.context.new_page()
        self.addCleanup(direct.close)
        response = direct.goto(origin + row['artifact']['url'])
        self.assertIn("connect-src 'none'", response.headers['content-security-policy'])
        expect(direct.locator('#count')).to_have_text('0')
        direct.locator('#increment').click()
        expect(frame.locator('#count')).to_have_text('0')
        storage = direct.evaluate("()=>{try{localStorage.setItem('direct','x');return 'allowed'}catch{return 'blocked'}}")
        self.assertEqual(storage, 'blocked')
        direct.reload()
        expect(direct.locator('#count')).to_have_text('0')
        self.assertEqual(self.errors, [])

    def assert_comparison_range(self, group, first, last, total):
        from playwright.sync_api import expect
        indicator = group.locator('.comparison-range')
        expect(indicator).to_have_count(1)
        self.page.wait_for_function('''({indicator, expected}) => {
            const numbers=(indicator.textContent.match(/\\d+/g)||[]).map(Number);
            if(numbers.length===1)numbers.unshift(1,numbers[0]);
            if(numbers.length===2)numbers.splice(1,0,numbers[0]);
            return JSON.stringify(numbers)===JSON.stringify(expected);
        }''', arg={'indicator': indicator.element_handle(), 'expected': [first, last, total]}, timeout=5000)
        strip = group.locator('.group-builds')
        self.page.wait_for_function('''({strip, first}) => {
            const columns=strip.children;
            const step=columns.length>1?columns[1].offsetLeft-columns[0].offsetLeft:0;
            const left=Math.min((first-1)*step,strip.scrollWidth-strip.clientWidth);
            return Math.abs(strip.scrollLeft-left)<2;
        }''', arg={'strip': strip.element_handle(), 'first': first}, timeout=5000)
        previous = group.locator('[data-shift-models="-1"]')
        following = group.locator('[data-shift-models="1"]')
        (expect(previous).to_be_disabled if first == 1 else expect(previous).to_be_enabled)()
        (expect(following).to_be_disabled if last == total else expect(following).to_be_enabled)()

    def assert_comparison_grid(self, group, columns, total):
        from playwright.sync_api import expect
        expect(group.locator('.comparison-range')).to_have_text(f"{total} {'model' if total == 1 else 'models'}")
        expect(group.locator('.model-navigation')).to_be_hidden()
        geometry = group.locator('.group-builds').evaluate('''node => {
            const area=node.getBoundingClientRect();
            const cards=[...node.children].map(child=>child.getBoundingClientRect());
            const rows=[];
            for(const card of cards){
                const row=rows.find(row=>Math.abs(row.top-card.top)<2);
                if(row)row.count++;else rows.push({top:card.top,count:1});
            }
            return {rows:rows.map(row=>row.count),
                contained:cards.every(card=>card.left>=area.left-1&&card.right<=area.right+1),
                scrolling:node.scrollWidth>node.clientWidth+1, left:node.scrollLeft};
        }''')
        self.assertEqual(geometry['rows'], [min(columns, total-start) for start in range(0, total, columns)])
        self.assertTrue(geometry['contained'])
        self.assertFalse(geometry['scrolling'])
        self.assertEqual(geometry['left'], 0)

    def test_comparison_pages_five_models_one_column_at_responsive_breakpoints(self):
        from playwright.sync_api import expect
        keys = self.comparison_fixture()
        self.navigate_direct()
        group = self.page.locator('#cards .prompt-group[data-task="01-fluid-simulation"]')
        strip = group.locator('.group-builds')
        expect(group.locator('.model-column')).to_have_count(5)
        self.assertEqual(group.locator('.model-column').evaluate_all('nodes=>nodes.map(node=>node.dataset.model)'), keys)
        for width, visible in [(1440, 3), (1100, 2), (581, 2), (580, 1), (390, 1), (320, 1)]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 1000})
                strip.evaluate("node=>node.scrollTo({left:0,behavior:'instant'})")
                self.assert_comparison_range(group, 1, visible, 5)
                geometry = strip.evaluate('''node => {
                    const area=node.getBoundingClientRect();
                    const columns=[...node.children].map(child=>child.getBoundingClientRect());
                    return {visible:columns.filter(r=>r.left>=area.left-1&&r.right<=area.right+1).length,
                        sameRow:columns.every(r=>Math.abs(r.top-columns[0].top)<1),
                        scrolling:node.scrollWidth>node.clientWidth};
                }''')
                self.assertEqual(geometry['visible'], visible)
                self.assertTrue(geometry['sameRow'])
                self.assertTrue(geometry['scrolling'])
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                group.locator('[data-expand-task]').click()
                self.assert_comparison_grid(self.page.locator('#category-content .prompt-group'), visible, 5)
                self.page.locator('#close-category').click()
                for first in range(2, 7-visible):
                    group.locator('[data-shift-models="1"]').click()
                    self.assert_comparison_range(group, first, first+visible-1, 5)
                for first in range(5-visible, 0, -1):
                    group.locator('[data-shift-models="-1"]').click()
                    self.assert_comparison_range(group, first, first+visible-1, 5)
        self.assertEqual(self.errors, [])

    def test_comparison_mobile_carousel_expands_to_a_vertical_grid(self):
        from playwright.sync_api import expect
        self.comparison_fixture()
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.navigate_direct()
        group = self.page.locator('#cards .prompt-group[data-task="01-fluid-simulation"]')
        strip = group.locator('.group-builds')
        self.assert_comparison_range(group, 1, 1, 5)
        strip.focus()
        self.page.keyboard.press('End')
        self.assert_comparison_range(group, 5, 5, 5)
        self.page.keyboard.press('ArrowLeft')
        self.assert_comparison_range(group, 4, 4, 5)
        self.page.keyboard.press('Home')
        self.assert_comparison_range(group, 1, 1, 5)
        # Move the native scroll container without calling any application paging handler.
        strip.evaluate("node=>node.scrollTo({left:node.scrollWidth-node.clientWidth,behavior:'instant'})")
        self.assert_comparison_range(group, 5, 5, 5)
        strip.evaluate("node=>node.scrollTo({left:node.children[2].offsetLeft-node.children[0].offsetLeft,behavior:'instant'})")
        self.assert_comparison_range(group, 3, 3, 5)
        group.locator('[data-expand-task]').click()
        category = self.page.locator('#category-viewer')
        expect(category).to_be_visible()
        expanded = category.locator('.prompt-group')
        self.assert_comparison_grid(expanded, 1, 5)
        self.assertTrue(category.evaluate('node=>node.scrollWidth<=innerWidth'))
        expanded.locator('.group-builds').focus()
        self.page.keyboard.press('End')
        expect(expanded.locator('.model-column').last).to_be_in_viewport()
        self.assertGreater(self.page.locator('#category-content').evaluate('node=>node.scrollTop'), 0)
        self.assert_comparison_grid(expanded, 1, 5)
        self.assert_comparison_range(group, 3, 3, 5)
        self.page.locator('#close-category').click()
        expect(category).not_to_be_visible()
        self.assert_comparison_range(group, 3, 3, 5)
        self.assertEqual(self.errors, [])

    def test_comparison_expansion_keeps_main_dom_filters_scroll_and_focus(self):
        from playwright.sync_api import expect
        keys = self.comparison_fixture()
        other = self.results / keys[0] / self.state.catalog[1]['id']
        other.mkdir()
        (other / 'index.html').write_text('<!doctype html><title>Other prompt fixture</title>', encoding='utf-8')
        self.navigate_direct()
        self.page.locator('#search').fill('fixture')
        self.page.locator('#track-filter').select_option('html')
        expect(self.page.locator('#cards .prompt-group')).to_have_count(2)
        group = self.page.locator('#cards .prompt-group[data-task="01-fluid-simulation"]')
        self.assert_comparison_range(group, 1, 3, 5)
        group.locator('[data-shift-models="1"]').click()
        self.assert_comparison_range(group, 2, 4, 5)
        trigger = group.locator('[data-expand-task="01-fluid-simulation"]')
        trigger.scroll_into_view_if_needed()
        original_card = group.locator('.run-card').first.element_handle()
        position = group.locator('.group-builds').evaluate('node=>node.scrollLeft')
        page_scroll = self.page.evaluate('scrollY')
        filters = self.page.locator('#search,#track-filter,#model-filter,#task-filter,#status-filter,#sort').evaluate_all('nodes=>nodes.map(node=>[node.id,node.value])')
        trigger.click()
        category = self.page.locator('#category-viewer')
        expect(category).to_be_visible()
        self.assertTrue(category.evaluate('node=>node instanceof HTMLDialogElement&&node.matches(":modal")'))
        bounds = category.bounding_box()
        for actual, expected in zip([bounds['x'], bounds['y'], bounds['width'], bounds['height']], [0, 0, 1440, 1000]):
            self.assertAlmostEqual(actual, expected, delta=2)
        expect(self.page.locator('#category-title')).to_have_text(self.state.catalog_by_id['01-fluid-simulation']['title'])
        expect(category.locator('#category-content .prompt-group')).to_have_count(1)
        expect(self.page.locator('#cards .prompt-group')).to_have_count(2)
        self.assertTrue(original_card.evaluate('node=>node.isConnected'))
        expanded = category.locator('.prompt-group')
        self.assert_comparison_grid(expanded, 3, 5)
        expanded.locator('.model-column').last.scroll_into_view_if_needed()
        self.assertAlmostEqual(group.locator('.group-builds').evaluate('node=>node.scrollLeft'), position, delta=2)
        self.page.locator('#close-category').click()
        expect(category).not_to_be_visible()
        expect(trigger).to_be_focused()
        self.assertTrue(original_card.evaluate('node=>node.isConnected'))
        self.assertAlmostEqual(self.page.evaluate('scrollY'), page_scroll, delta=2)
        self.assertEqual(self.page.locator('#search,#track-filter,#model-filter,#task-filter,#status-filter,#sort').evaluate_all('nodes=>nodes.map(node=>[node.id,node.value])'), filters)
        self.assert_comparison_range(group, 2, 4, 5)
        self.assertEqual(self.errors, [])

    def test_comparison_nested_prompt_build_live_copy_and_escape_return_to_category(self):
        from playwright.sync_api import expect
        keys = self.comparison_fixture()
        self.navigate_direct()
        self.context.grant_permissions(['clipboard-read', 'clipboard-write'])
        trigger = self.page.locator('#cards [data-expand-task="01-fluid-simulation"]')
        expect(trigger).to_have_count(1)
        trigger.click()
        category = self.page.locator('#category-viewer')
        category.locator('[data-open-prompt]').click()
        expect(self.page.locator('#prompt-dialog')).to_be_visible()
        expect(self.page.locator('#prompt-content')).to_contain_text('from the beginning')
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#prompt-dialog')).not_to_be_visible()
        expect(category).to_be_visible()
        category.locator('.card-open').first.click()
        expect(self.page.locator('#viewer')).to_be_visible()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#viewer')).not_to_be_visible()
        expect(category).to_be_visible()
        category.locator('.card-open').last.click()
        self.page.locator('#launch-preview').click()
        frame = self.page.frame_locator('#artifact-frame')
        expect(frame.locator('#build-model')).to_have_text(keys[-1])
        frame.locator('#increment').click()
        expect(frame.locator('#increment')).to_have_text('Count: 1')
        previous_frame = self.page.locator('#artifact-frame').element_handle()
        selected = keys[1] + '/01-fluid-simulation-main'
        self.page.locator('#live-model').select_option(selected)
        expect(frame.locator('#build-model')).to_have_text(keys[1])
        self.assertFalse(previous_frame.evaluate('node=>node.isConnected'))
        expect(self.page.locator('#artifact-frame')).to_have_count(1)
        self.page.locator('.live-bar [data-copy-run]').click()
        expect(self.page.locator('#viewer #toast')).to_contain_text('Link copied')
        self.assertEqual(self.page.evaluate('navigator.clipboard.readText()'), self.base + '/#play/' + selected)
        self.page.locator('#close-live').focus()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#viewer')).not_to_be_visible()
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        expect(category).to_be_visible()
        category.locator('[data-copy-run]').first.click()
        expect(self.page.locator('#category-viewer #toast')).to_contain_text('Link copied')
        self.assertEqual(self.page.evaluate('navigator.clipboard.readText()'), self.base + '/#play/' + keys[0] + '/01-fluid-simulation-main')
        self.page.keyboard.press('Escape')
        expect(category).not_to_be_visible()
        expect(trigger).to_be_focused()
        self.assertNotIn('#play/', self.page.url)
        self.assertEqual(self.errors, [])

    def test_comparison_keeps_missing_duplicate_and_unassigned_groups_and_closes_on_route(self):
        from playwright.sync_api import expect
        keys = self.comparison_fixture()
        (self.results / keys[3] / '01-fluid-simulation-main/index.html').unlink()
        for model, run_id in [(keys[2], '01-fluid-simulation-extra'), (keys[3], self.state.catalog[1]['id']), (keys[0], 'unknown-fixture')]:
            run = self.results / model / run_id
            run.mkdir()
            (run / 'index.html').write_text('<!doctype html><title>Additional comparison fixture</title><h1>Additional comparison fixture</h1>', encoding='utf-8')
        self.navigate_direct()
        self.page.locator('#recorded-only').uncheck()
        group = self.page.locator('#cards .prompt-group[data-task="01-fluid-simulation"]')
        expect(group.locator('.model-column')).to_have_count(5)
        expect(group.locator('.missing-build')).to_have_count(1)
        expect(group.locator(f'.model-column[data-model="{keys[2]}"] .run-card')).to_have_count(2)
        self.assert_comparison_range(group, 1, 3, 5)
        group.locator('[data-expand-task]').click()
        category = self.page.locator('#category-viewer')
        expect(category.locator('.model-column')).to_have_count(5)
        expect(category.locator('.missing-build')).to_have_count(1)
        expect(category.locator(f'.model-column[data-model="{keys[2]}"] .run-card')).to_have_count(2)
        self.page.locator('#close-category').click()
        self.page.locator('#model-filter').select_option(keys[2])
        self.assert_comparison_range(group, 1, 1, 1)
        expect(group.locator('.run-card')).to_have_count(2)
        self.page.locator('#search').fill('extra')
        expect(group.locator('.run-card')).to_have_count(1)
        self.page.locator('#clear-filters').click()
        unknown = self.page.locator('#cards .prompt-group').filter(has=self.page.locator(f'[data-open-run="{keys[0]}/unknown-fixture"]'))
        expect(unknown).to_have_count(1)
        unknown.locator('[data-expand-task]').click()
        expect(category.locator('.model-column')).to_have_count(1)
        expect(category.locator('.run-card')).to_have_count(1)
        self.assert_comparison_grid(category.locator('.prompt-group'), 3, 1)
        self.page.evaluate("location.hash='why'")
        expect(category).not_to_be_visible()
        expect(self.page.locator('#view-why')).to_be_visible()
        self.page.locator('.nav-button[data-view="gallery"]').click()
        group.locator('[data-expand-task]').click()
        self.page.evaluate("hash=>location.hash=hash", '#play/' + keys[3] + '/' + self.state.catalog[1]['id'])
        expect(category).not_to_be_visible()
        expect(self.page.frame_locator('#artifact-frame').locator('h1')).to_have_text('Additional comparison fixture')
        self.assertEqual(self.errors, [])

    def test_recorded_only_defaults_for_new_and_existing_saved_settings(self):
        from playwright.sync_api import expect
        keys = self.sparse_comparison_fixture()
        self.navigate_direct()
        for previous_settings in [None, {'view': 'gallery', 'sort': 'task'}]:
            with self.subTest(previous_settings=previous_settings):
                if previous_settings is not None:
                    self.page.evaluate("settings=>localStorage.setItem('trial-by-pyro-ui-v1',JSON.stringify(settings))", previous_settings)
                    self.page.reload()
                expect(self.page.locator('#recorded-only')).to_be_checked()
                expect(self.page.locator('#recorded-only')).to_have_accessible_name('Recorded builds only')
                expect(self.page.locator('#category-recorded-only')).to_be_checked()
                group = self.page.locator('#cards .prompt-group[data-task="01-fluid-simulation"]')
                expect(group.locator('.model-column')).to_have_count(4)
                self.assertEqual(group.locator('.model-column').evaluate_all('nodes=>nodes.map(node=>node.dataset.model)'), keys[:3] + keys[4:])
                expect(group.locator('.missing-build')).to_have_count(0)
                expect(group.locator('.run-card')).to_have_count(5)
                expect(group.locator(f'.model-column[data-model="{keys[2]}"] .run-card')).to_have_count(2)
        self.assertEqual(self.errors, [])

    def test_recorded_only_toggle_search_empty_state_persistence_and_reset(self):
        from playwright.sync_api import expect
        keys = self.sparse_comparison_fixture()
        self.navigate_direct()
        checkbox = self.page.locator('#recorded-only')
        group = self.page.locator('#cards .prompt-group[data-task="01-fluid-simulation"]')
        checkbox.uncheck()
        expect(group.locator('.model-column')).to_have_count(5)
        expect(group.locator('.missing-build')).to_have_count(1)
        expect(group.locator('.run-card')).to_have_count(5)
        self.assertEqual(group.locator('.model-column').evaluate_all('nodes=>nodes.map(node=>node.dataset.model)'), keys)
        self.assertIs(self.page.evaluate("JSON.parse(localStorage.getItem('trial-by-pyro-ui-v1'))['recorded-only']"), False)
        self.page.reload()
        expect(checkbox).not_to_be_checked()
        expect(group.locator('.missing-build')).to_have_count(1)
        self.page.locator('#search').fill('extra')
        expect(group.locator('.run-card')).to_have_count(1)
        expect(group.locator('.missing-build').filter(has_text='No build recorded')).to_have_count(1)
        expect(group.locator('.missing-build').filter(has_text='No matching build')).to_have_count(3)
        checkbox.check()
        expect(group.locator('.model-column')).to_have_count(1)
        expect(group.locator('.model-column')).to_have_attribute('data-model', keys[2])
        expect(group.locator('.missing-build')).to_have_count(0)
        expect(group.locator('.run-card')).to_have_count(1)
        self.page.reload()
        expect(checkbox).to_be_checked()
        expect(self.page.locator('#search')).to_have_value('extra')
        expect(group.locator('.model-column')).to_have_count(1)
        self.page.locator('#search').fill('no recorded fixture matches this query')
        expect(self.page.locator('#cards .prompt-group')).to_have_count(0)
        expect(self.page.locator('#empty-results')).to_be_visible()
        checkbox.uncheck()
        expect(self.page.locator('#cards .model-column')).to_have_count(0)
        expect(self.page.locator('#empty-results')).to_be_visible()
        self.page.locator('#clear-filters').click()
        expect(checkbox).to_be_checked()
        expect(self.page.locator('#category-recorded-only')).to_be_checked()
        expect(self.page.locator('#search')).to_have_value('')
        expect(group.locator('.model-column')).to_have_count(4)
        expect(group.locator('.run-card')).to_have_count(5)
        expect(self.page.locator('#cards .missing-build')).to_have_count(0)
        expect(self.page.locator('#empty-results')).not_to_be_visible()
        self.assertIs(self.page.evaluate("JSON.parse(localStorage.getItem('trial-by-pyro-ui-v1'))['recorded-only']"), True)
        self.page.reload()
        expect(checkbox).to_be_checked()
        expect(group.locator('.model-column')).to_have_count(4)
        self.assertEqual(self.errors, [])

    def test_recorded_only_expanded_toggle_syncs_and_survives_close_on_mobile(self):
        from playwright.sync_api import expect
        self.sparse_comparison_fixture()
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.navigate_direct()
        group = self.page.locator('#cards .prompt-group[data-task="01-fluid-simulation"]')
        trigger = group.locator('[data-expand-task]')
        trigger.click()
        category = self.page.locator('#category-viewer')
        checkbox = self.page.locator('#category-recorded-only')
        expect(checkbox).to_be_checked()
        expect(checkbox).to_have_accessible_name('Recorded builds only')
        expect(checkbox).to_be_in_viewport()
        expect(category.locator('.model-column')).to_have_count(4)
        checkbox.uncheck()
        expect(category.locator('.model-column')).to_have_count(5)
        expect(category.locator('.run-card')).to_have_count(5)
        expect(category.locator('.missing-build')).to_have_count(1)
        expect(self.page.locator('#recorded-only')).not_to_be_checked()
        expect(group.locator('.model-column')).to_have_count(5)
        self.assertTrue(category.evaluate('node=>node.scrollWidth<=innerWidth'))
        self.page.locator('#close-category').click()
        expect(category).not_to_be_visible()
        expect(trigger).to_be_focused()
        expect(self.page.locator('#recorded-only')).not_to_be_checked()
        self.page.reload()
        expect(self.page.locator('#recorded-only')).not_to_be_checked()
        trigger.click()
        expect(checkbox).not_to_be_checked()
        expect(category.locator('.model-column')).to_have_count(5)
        checkbox.check()
        expect(category.locator('.model-column')).to_have_count(4)
        expect(category.locator('.missing-build')).to_have_count(0)
        expect(category.locator('.run-card')).to_have_count(5)
        expect(self.page.locator('#recorded-only')).to_be_checked()
        self.page.locator('#close-category').click()
        expect(trigger).to_be_focused()
        expect(group.locator('.model-column')).to_have_count(4)
        self.page.reload()
        expect(self.page.locator('#recorded-only')).to_be_checked()
        expect(group.locator('.missing-build')).to_have_count(0)
        self.assertEqual(self.errors, [])

    def test_recorded_only_public_comparison_share_honors_preference_and_ignores_filters(self):
        from playwright.sync_api import expect
        keys = self.sparse_comparison_fixture()
        task = '01-fluid-simulation'
        origin, data = self.public_export()
        share = origin + data['comparison_urls'][task]
        self.page.goto(origin)
        expect(self.page.locator('#recorded-only')).to_be_checked()
        self.page.locator('#recorded-only').uncheck()
        self.page.locator('#model-filter').select_option(keys[3])
        self.page.locator('#search').fill('no matching fixture')
        expect(self.page.locator('#cards .run-card')).to_have_count(0)
        self.page.goto(share)
        category = self.page.locator('#category-viewer')
        checkbox = self.page.locator('#category-recorded-only')
        expect(category).to_be_visible()
        expect(checkbox).not_to_be_checked()
        expect(category.locator('.model-column')).to_have_count(5)
        self.assertEqual(category.locator('.model-column').evaluate_all('nodes=>nodes.map(node=>node.dataset.model)'), keys)
        expect(category.locator('.run-card')).to_have_count(5)
        expect(category.locator('.missing-build')).to_have_count(1)
        checkbox.check()
        expect(category.locator('.model-column')).to_have_count(4)
        self.assertEqual(category.locator('.model-column').evaluate_all('nodes=>nodes.map(node=>node.dataset.model)'), keys[:3] + keys[4:])
        expect(category.locator('.run-card')).to_have_count(5)
        expect(category.locator('.missing-build')).to_have_count(0)
        self.page.reload()
        expect(category).to_be_visible()
        expect(checkbox).to_be_checked()
        expect(category.locator('.model-column')).to_have_count(4)
        expect(self.page.locator('#model-filter')).to_have_value(keys[3])
        expect(self.page.locator('#search')).to_have_value('no matching fixture')
        self.page.locator('#close-category').click()
        expect(self.page.locator('#recorded-only')).to_be_checked()
        expect(self.page.locator('#cards .run-card')).to_have_count(0)
        expect(self.page.locator('#empty-results')).to_be_visible()
        self.page.goto(share)
        expect(category).to_be_visible()
        expect(checkbox).to_be_checked()
        expect(category.locator('.model-column')).to_have_count(4)
        checkbox.uncheck()
        self.page.goto(share)
        expect(category).to_be_visible()
        expect(checkbox).not_to_be_checked()
        expect(self.page.locator('#recorded-only')).not_to_be_checked()
        expect(category.locator('.model-column')).to_have_count(5)
        expect(category.locator('.run-card')).to_have_count(5)
        expect(category.locator('.missing-build')).to_have_count(1)
        self.assertEqual(self.errors, [])

    def test_category_share_copies_normal_and_expanded_local_links(self):
        from playwright.sync_api import expect
        keys = self.comparison_fixture()
        task = '01-fluid-simulation'
        share = self.base + '/#compare/' + quote(task, safe='')
        self.navigate_direct()
        self.context.grant_permissions(['clipboard-read', 'clipboard-write'])
        group = self.page.locator(f'#cards .prompt-group[data-task="{task}"]')
        group.locator(f'[data-copy-task="{task}"]').click()
        expect(self.page.locator('#toast')).to_contain_text('Link copied')
        self.assertEqual(self.page.evaluate('navigator.clipboard.readText()'), share)
        category = self.page.locator('#category-viewer')
        expect(category).not_to_be_visible()
        group.locator('[data-expand-task]').click()
        expect(category).to_be_visible()
        expect(self.page).to_have_url(share)
        self.assertEqual(category.locator('.model-column').evaluate_all('nodes=>nodes.map(node=>node.dataset.model)'), keys)
        category.locator(f'[data-copy-task="{task}"]').click()
        expect(category.locator('#toast')).to_contain_text('Link copied')
        self.assertEqual(self.page.evaluate('navigator.clipboard.readText()'), share)
        self.page.keyboard.press('Escape')
        expect(category).not_to_be_visible()
        self.assertEqual(urlsplit(self.page.url).fragment, '')
        self.page.reload()
        expect(self.page.locator('#cards .prompt-group')).to_have_count(1)
        expect(category).not_to_be_visible()
        self.assertEqual(self.errors, [])

    def test_category_share_nested_app_returns_to_comparison_and_close_survives_reload(self):
        from playwright.sync_api import expect
        keys = self.comparison_fixture()
        task = '01-fluid-simulation'
        share = self.base + '/#compare/' + task
        self.navigate_direct()
        self.page.goto(share)
        category = self.page.locator('#category-viewer')
        expect(category).to_be_visible()
        expect(self.page.locator('#category-title')).to_have_text(self.state.catalog_by_id[task]['title'])
        category.locator('.card-open').first.click()
        self.page.locator('#launch-preview').click()
        frame = self.page.frame_locator('#artifact-frame')
        expect(frame.locator('#build-model')).to_have_text(keys[0])
        frame.locator('#increment').click()
        expect(frame.locator('#increment')).to_have_text('Count: 1')
        expect(category).to_be_visible()
        self.assertEqual(urlsplit(self.page.url).fragment, 'play/' + keys[0] + '/' + task + '-main')
        self.page.locator('#close-live').click()
        expect(self.page.locator('#viewer')).not_to_be_visible()
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        expect(category).to_be_visible()
        expect(self.page).to_have_url(share)
        self.page.reload()
        expect(category).to_be_visible()
        expect(self.page.locator('dialog[open]')).to_have_count(1)
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        self.page.locator('#close-category').click()
        expect(category).not_to_be_visible()
        self.assertEqual(urlsplit(self.page.url).fragment, '')
        self.page.reload()
        expect(self.page.locator('#cards .prompt-group')).to_have_count(1)
        expect(self.page.locator('dialog[open]')).to_have_count(0)
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        self.assertEqual(self.errors, [])

    def test_category_share_history_and_invalid_routes_clear_stacked_dialogs(self):
        from playwright.sync_api import expect
        self.comparison_fixture()
        task = '01-fluid-simulation'
        self.navigate_direct()
        self.page.locator(f'#cards [data-expand-task="{task}"]').click()
        category = self.page.locator('#category-viewer')
        expect(category).to_be_visible()
        self.page.go_back()
        expect(category).not_to_be_visible()
        self.page.go_forward()
        expect(category).to_be_visible()
        category.locator('.card-open').first.click()
        self.page.locator('#launch-preview').click()
        expect(self.page.frame_locator('#artifact-frame').locator('#increment')).to_have_text('Count: 0')
        self.page.go_back()
        expect(category).to_be_visible()
        expect(self.page.locator('#viewer')).not_to_be_visible()
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        self.assertEqual(urlsplit(self.page.url).fragment, 'compare/' + task)
        self.page.go_forward()
        expect(self.page.frame_locator('#artifact-frame').locator('#increment')).to_have_text('Count: 0')
        expect(category).to_be_visible()
        self.page.evaluate("location.hash='why'")
        expect(self.page.locator('#view-why')).to_be_visible()
        expect(self.page.locator('dialog[open]')).to_have_count(0)
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        invalid_ids = ['missing-prompt', self.state.catalog[1]['id'], '%E0%A4%A',
                       quote('<img src=x onerror=window.__comparisonInjection=1>', safe='')]
        for invalid in invalid_ids:
            with self.subTest(route=invalid):
                self.page.evaluate('hash=>location.hash=hash', '#compare/' + task)
                expect(category).to_be_visible()
                category.locator('[data-open-prompt]').click()
                expect(self.page.locator('#prompt-dialog')).to_be_visible()
                self.page.evaluate('hash=>location.hash=hash', '#compare/' + invalid)
                expect(self.page.locator('#link-error')).to_contain_text('shared comparison is unavailable')
                expect(self.page.locator('#link-error')).to_be_visible()
                expect(self.page.locator('#view-gallery')).to_be_visible()
                expect(self.page.locator('dialog[open]')).to_have_count(0)
                expect(self.page.locator('#artifact-frame')).to_have_count(0)
                expect(self.page.locator('#link-error img')).to_have_count(0)
                self.assertTrue(self.page.evaluate('window.__comparisonInjection === undefined'))
        encoded = ''.join(f'%{value:02X}' for value in task.encode('utf-8'))
        self.page.evaluate('hash=>location.hash=hash', '#compare/' + encoded)
        expect(category).to_be_visible()
        expect(self.page.locator('#link-error')).not_to_be_visible()
        expect(self.page.locator('#category-title')).to_have_text(self.state.catalog_by_id[task]['title'])
        expect(self.page.locator('dialog[open]')).to_have_count(1)
        self.assertEqual(self.errors, [])

    def test_public_category_share_ignores_saved_filters_and_copies_public_url(self):
        from playwright.sync_api import expect
        keys = self.comparison_fixture()
        task = '01-fluid-simulation'
        other_task = self.state.catalog[1]['id']
        for model, name in [(keys[2], task + '-extra'), (keys[0], other_task)]:
            run = self.results / model / name
            run.mkdir()
            (run / 'index.html').write_text('<!doctype html><title>Additional public fixture</title>', encoding='utf-8')
        origin, data = self.public_export()
        self.assertEqual(data['comparison_urls'][task], '/compare/' + quote(task, safe='') + '/')
        share = origin + data['comparison_urls'][task]
        document = self.page.request.get(share)
        self.assertEqual(document.status, 200)
        self.assertIn('property="og:title"', document.text())
        self.assertIn('location.replace(', document.text())
        self.assertNotIn('http-equiv="refresh"', document.text())
        self.page.goto(origin)
        self.context.grant_permissions(['clipboard-read', 'clipboard-write'])
        self.page.locator(f'#cards [data-copy-task="{task}"]').click()
        expect(self.page.locator('#toast')).to_contain_text('Link copied')
        self.assertEqual(self.page.evaluate('navigator.clipboard.readText()'), share)
        self.page.locator('#model-filter').select_option(keys[-1])
        self.page.locator('#task-filter').select_option(other_task)
        self.page.locator('#track-filter').select_option('real-apps')
        self.page.locator('#search').fill('no matching fixture')
        expect(self.page.locator('#cards .run-card')).to_have_count(0)
        self.page.locator('.nav-button[data-view="why"]').click()
        expect(self.page.locator('#view-why')).to_be_visible()
        self.page.goto(share)
        category = self.page.locator('#category-viewer')
        expect(category).to_be_visible()
        expect(self.page).to_have_url(origin + '/#compare/' + task)
        expect(self.page.locator('#category-title')).to_have_text(self.state.catalog_by_id[task]['title'])
        expect(category.locator('.model-column')).to_have_count(5)
        self.assertEqual(category.locator('.model-column').evaluate_all('nodes=>nodes.map(node=>node.dataset.model)'), keys)
        expect(category.locator('.run-card')).to_have_count(6)
        expect(category.locator(f'.model-column[data-model="{keys[2]}"] .run-card')).to_have_count(2)
        expect(category.locator('.missing-build')).to_have_count(0)
        bounds = category.bounding_box()
        for actual, expected in zip([bounds['x'], bounds['y'], bounds['width'], bounds['height']], [0, 0, 1440, 1000]):
            self.assertAlmostEqual(actual, expected, delta=2)
        expect(self.page.locator('#model-filter')).to_have_value(keys[-1])
        expect(self.page.locator('#task-filter')).to_have_value(other_task)
        expect(self.page.locator('#track-filter')).to_have_value('real-apps')
        expect(self.page.locator('#search')).to_have_value('no matching fixture')
        category.locator(f'[data-copy-task="{task}"]').click()
        expect(category.locator('#toast')).to_contain_text('Link copied')
        self.assertEqual(self.page.evaluate('navigator.clipboard.readText()'), share)
        self.page.go_back()
        expect(self.page).to_have_url(origin + '/#why')
        expect(self.page.locator('#view-why')).to_be_visible()
        expect(self.page.locator('dialog[open]')).to_have_count(0)
        self.page.go_forward()
        expect(category).to_be_visible()
        expect(category.locator('.run-card')).to_have_count(6)
        self.assertEqual(self.errors, [])

    def test_public_share_page_redirects_to_sandboxed_viewer_and_copies_its_url(self):
        from playwright.sync_api import expect
        self.fixture()
        (self.results / 'UI fixture - not a model evaluation' / 'model.toml').write_text(
            'harness = "Public harness fixture"\nsetting = "High Fast"\n'
            'runtime = "MTPLX (local)"\nruntime_url = "https://runtime.example/"\n'
            'quantization = "Optimized Speed (4-bit, 8-bit attention)"\nquantization_url = "https://models.example/quant"\n', encoding='utf-8')
        origin, data = self.public_export()
        row = data['results'][0]
        share = origin + row['share_url']
        document = self.page.request.get(share)
        self.assertEqual(document.status, 200)
        self.assertIn('property="og:title"', document.text())
        self.assertNotIn('http-equiv="refresh"', document.text())
        self.page.goto(share)
        frame = self.page.frame_locator('#artifact-frame')
        expect(frame.locator('#increment')).to_have_text('Count: 0')
        expect(self.page.locator('#viewer')).to_have_class(re.compile(r'\bis-live\b'))
        sandbox = self.page.locator('#artifact-frame').get_attribute('sandbox').split()
        self.assertNotIn('allow-same-origin', sandbox)
        self.page.locator('.live-setup summary').click()
        expect(self.page.locator('.live-setup-panel')).to_contain_text('Public harness fixture')
        expect(self.page.locator('.live-setup-panel')).to_contain_text('High Fast')
        expect(self.page.locator('.live-setup-panel').get_by_role('link', name='MTPLX (local)')).to_have_attribute('href', 'https://runtime.example/')
        expect(self.page.locator('.live-setup-panel').get_by_role('link', name='Optimized Speed (4-bit, 8-bit attention)')).to_have_attribute('href', 'https://models.example/quant')
        self.page.locator('#close-live-setup').click()
        self.assertEqual(urlsplit(self.page.url).fragment, 'play/' + quote(row['id'], safe='/'))
        self.context.grant_permissions(['clipboard-read', 'clipboard-write'])
        self.page.locator('.live-bar [data-copy-run]').click()
        expect(self.page.locator('#toast')).to_contain_text('Link copied')
        self.assertEqual(self.page.evaluate('navigator.clipboard.readText()'), share)
        self.page.locator('#close-live').click()
        self.page.locator('#cards [data-copy-run]').click()
        self.assertEqual(self.page.evaluate('navigator.clipboard.readText()'), share)
        self.assertEqual(self.errors, [])

    def test_viewer_switches_same_prompt_in_configured_order_and_keeps_viewport(self):
        from playwright.sync_api import expect
        self.fixture()
        original = 'UI fixture - not a model evaluation/01-fluid-simulation-001'
        for model, run_id in [('grok', '01-fluid-simulation-a'), ('grok', '01-fluid-simulation-b'), ('gemini', '01-fluid-simulation-a')]:
            run = self.results / model / run_id
            run.mkdir(parents=True)
            (run / 'index.html').write_text('<!doctype html><title>Switch fixture</title><h1>' + model + '</h1>')
        self.model_settings(json.dumps({'models': [
            {'key': original.split('/')[0], 'label': 'Astra fixture', 'color': '#8FD7AF'},
            {'key': 'grok', 'label': 'Grok fixture', 'color': '#E8AD82'},
            {'key': 'gemini', 'label': 'Gemini fixture', 'color': '#91B5FF'},
        ]}))
        self.navigate_direct()
        self.page.locator('#model-filter').select_option(original.split('/')[0])
        self.page.goto(self.base + '/#play/' + quote(original, safe='/'))
        switcher = self.page.get_by_role('combobox', name='Model for this prompt')
        expect(switcher.locator('option')).to_have_text([
            'Astra fixture', 'Grok fixture · 01-fluid-simulation-a',
            'Grok fixture · 01-fluid-simulation-b', 'Gemini fixture'])
        self.page.locator('#viewport-size').select_option('768x1024')
        previous_frame = self.page.locator('#artifact-frame').element_handle()
        selected = 'grok/01-fluid-simulation-b'
        switcher.select_option(selected)
        expect(self.page.frame_locator('#artifact-frame').locator('h1')).to_have_text('grok')
        self.assertFalse(previous_frame.evaluate('(node) => node.isConnected'))
        expect(self.page.locator('#artifact-frame')).to_have_count(1)
        expect(self.page.locator('#viewer')).to_have_class(re.compile(r'\bis-live\b'))
        expect(self.page.locator('#viewport-size')).to_have_value('768x1024')
        expect(switcher).to_be_focused()
        self.assertEqual(self.page.locator('#viewer').evaluate("node => node.style.getPropertyValue('--model-color')"), '#E8AD82')
        self.assertEqual(self.page.frame_locator('#artifact-frame').locator('body').evaluate('() => [innerWidth, innerHeight]'), [768, 1024])
        self.assertEqual(urlsplit(self.page.url).fragment, 'play/' + selected)
        self.page.go_back()
        expect(switcher).to_have_value(original)
        expect(self.page.locator('#viewport-size')).to_have_value('768x1024')
        self.page.go_forward()
        expect(switcher).to_have_value(selected)
        expect(self.page.locator('#viewport-size')).to_have_value('768x1024')
        self.page.locator('#back-to-build').click()
        expect(self.page.locator('#viewer-kicker')).to_contain_text('Grok fixture / 01-fluid-simulation-b')
        self.assertEqual(self.errors, [])

    def test_viewer_guidance_overlays_running_app_without_resize_or_restart(self):
        from playwright.sync_api import expect
        self.fixture()
        task = self.state.catalog_by_id['01-fluid-simulation']
        task['look_for'] = 'Drag <img src=x onerror=alert(1)> & watch the dye curl.'
        self.navigate_direct()
        self.page.locator('#track-filter').select_option('html')
        self.page.locator('#cards .card-open').click()
        self.page.locator('#launch-preview').click()
        frame = self.page.frame_locator('#artifact-frame')
        frame.locator('#increment').click()
        for width in (1440, 768, 390, 320):
            self.page.set_viewport_size({'width': width, 'height': 844})
            before = self.page.locator('#artifact-frame').bounding_box()
            self.page.locator('.live-guide summary').click()
            panel = self.page.locator('.live-guide-panel')
            expect(panel).to_be_visible()
            expect(panel.locator('p')).to_have_text(task['look_for'])
            expect(panel.locator('img')).to_have_count(0)
            self.assertEqual(before, self.page.locator('#artifact-frame').bounding_box())
            expect(frame.locator('#increment')).to_have_text('Count: 1')
            bounds = panel.bounding_box()
            self.assertGreaterEqual(bounds['x'], 0)
            self.assertLessEqual(bounds['x'] + bounds['width'], width)
            self.assertTrue(self.page.locator('.live-bar').evaluate('node => node.scrollWidth <= innerWidth'))
            self.page.keyboard.press('Escape')
            expect(panel).not_to_be_visible()
            expect(self.page.locator('#viewer')).to_be_visible()
        self.page.set_viewport_size({'width': 1440, 'height': 844})
        self.page.locator('.live-guide summary').click()
        frame.locator('#increment').click()
        expect(frame.locator('#increment')).to_have_text('Count: 2')
        expect(self.page.locator('.live-guide-panel')).not_to_be_visible()
        self.page.locator('#close-live').focus()
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#viewer')).not_to_be_visible()
        self.assertEqual(self.errors, [])

    def test_unassigned_viewer_has_no_unrelated_models_or_invented_guidance(self):
        from playwright.sync_api import expect
        for model in ('Model A', 'Model B'):
            run = self.results / model / 'unknown'
            run.mkdir(parents=True)
            (run / 'index.html').write_text('<!doctype html><title>Unassigned fixture</title>')
        self.navigate_direct()
        self.page.locator('#cards .card-open').first.click()
        self.page.locator('#launch-preview').click()
        expect(self.page.get_by_role('combobox', name='Model for this prompt')).to_be_disabled()
        expect(self.page.locator('#live-model option')).to_have_count(1)
        expect(self.page.locator('.live-guide')).to_have_count(0)
        self.assertEqual(self.errors, [])

    def test_prompt_guidance_is_readable_and_escaped_across_viewports(self):
        from playwright.sync_api import expect
        self.fixture()
        task = self.state.catalog_by_id['01-fluid-simulation']
        task['look_for'] = 'Drag through the dye <img src=x onerror=alert(1)> & watch it curl around obstacles.'
        self.navigate_direct()
        group = self.page.locator('.prompt-group[data-task="01-fluid-simulation"]')
        guide = group.locator('.prompt-guide')
        expect(guide.locator('dt')).to_have_text(['Look for'])
        expect(guide.locator('dd')).to_have_text([task['look_for']])
        expect(guide.locator('img')).to_have_count(0)
        for width in (1440, 1024, 768, 390):
            self.page.set_viewport_size({'width': width, 'height': 1000})
            expect(guide).to_be_visible()
            boxes = group.locator('.prompt-heading, .prompt-guide, .prompt-header-actions').evaluate_all(
                '(nodes) => nodes.map(n => {const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};})')
            for a, b in ((boxes[0], boxes[1]), (boxes[1], boxes[2])):
                self.assertTrue(a['right'] <= b['x'] or b['right'] <= a['x'] or a['bottom'] <= b['y'] or b['bottom'] <= a['y'])
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        group.locator('[data-open-prompt]').click()
        expect(self.page.locator('#prompt-dialog')).to_be_visible()
        self.assertEqual(self.errors, [])

    def test_shared_link_copies_and_opens_the_maximized_build(self):
        from playwright.sync_api import expect
        self.fixture();self.navigate_direct()
        self.context.grant_permissions(['clipboard-read','clipboard-write'])
        self.page.locator('#track-filter').select_option('html')
        self.page.goto(self.base+'/?v=temporary#gallery')
        expect(self.page.locator('#cards [data-copy-run]')).to_have_count(1)
        self.page.locator('#cards [data-copy-run]').click()
        expect(self.page.locator('#toast')).to_contain_text('Link copied')
        link=self.page.evaluate('navigator.clipboard.readText()')
        run_id='UI fixture - not a model evaluation/01-fluid-simulation-001'
        self.assertEqual(link,self.base+'/#play/'+quote(run_id,safe='/'))
        expect(self.page.locator('#viewer')).not_to_be_visible()
        self.page.evaluate("localStorage.setItem('trial-by-pyro-ui-v1', JSON.stringify({view:'why',search:'unrelated saved filter'}))")
        self.page.goto(link)
        frame=self.page.frame_locator('#artifact-frame')
        expect(frame.locator('#increment')).to_have_text('Count: 0')
        expect(self.page.locator('#viewer')).to_have_class(re.compile(r'\bis-live\b'))
        self.assertEqual(urlsplit(self.page.url).fragment,urlsplit(link).fragment)
        rectangle=self.page.locator('#artifact-frame').bounding_box()
        self.assertEqual(rectangle['width'],1440)
        self.assertGreaterEqual(rectangle['height'],920)
        self.page.locator('.live-bar [data-copy-run]').click()
        expect(self.page.locator('#viewer #toast')).to_be_visible()
        self.assertEqual(self.page.evaluate('navigator.clipboard.readText()'),link)
        frame.locator('#increment').click()
        expect(frame.locator('#increment')).to_have_text('Count: 1')
        self.page.reload()
        expect(frame.locator('#increment')).to_have_text('Count: 0')
        self.page.locator('#close-live').click()
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        self.assertNotIn('#play/',self.page.url)
        self.page.reload()
        expect(self.page.locator('#viewer')).not_to_be_visible()
        self.assertEqual(self.errors,[])

    def test_shared_link_history_and_invalid_builds(self):
        from playwright.sync_api import expect
        self.fixture();self.navigate_direct()
        self.page.locator('#track-filter').select_option('html')
        self.page.locator('#cards .card-open').click()
        self.page.locator('#launch-preview').click()
        self.assertIn('#play/',self.page.url)
        self.page.go_back()
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        self.page.go_forward()
        expect(self.page.locator('#artifact-frame')).to_have_count(1)
        self.page.evaluate("location.hash='why'")
        expect(self.page.locator('#viewer')).not_to_be_visible()
        expect(self.page.locator('#view-why')).to_be_visible()
        for fragment in ['#play/missing/build','#play/%E0%A4%A','#play/https%3A%2F%2Fexample.com']:
            self.page.evaluate("location.hash='catalog'")
            self.page.locator('#catalog-grid [data-open-prompt]').first.click()
            expect(self.page.locator('#prompt-dialog')).to_be_visible()
            self.page.goto(self.base+'/'+fragment)
            expect(self.page.locator('#prompt-dialog')).not_to_be_visible()
            expect(self.page.locator('#link-error')).to_be_visible()
            expect(self.page.locator('#artifact-frame')).to_have_count(0)
            expect(self.page.locator('#view-gallery')).to_be_visible()
        self.page.locator('#refresh').click()
        expect(self.page.locator('#link-error')).not_to_be_visible()
        self.page.goto(self.base+'/#play/missing/build')
        expect(self.page.locator('#link-error')).to_be_visible()
        self.page.goto(self.base+'/#play/'+quote('UI fixture - not a model evaluation/01-fluid-simulation-001',safe='/'))
        expect(self.page.locator('#artifact-frame')).to_have_count(1)
        self.page.locator('#close-live').click()
        expect(self.page.locator('#link-error')).not_to_be_visible()
        self.page.goto(self.base+'/#play/missing/build')
        expect(self.page.locator('#link-error')).to_be_visible()
        self.page.locator('[data-view="why"]').first.click()
        expect(self.page.locator('#view-why')).to_be_visible()
        expect(self.page.locator('#link-error')).not_to_be_visible()
        self.page.goto(self.base+'/#play/missing/build')
        expect(self.page.locator('#link-error')).to_be_visible()
        self.page.locator('#cards .card-open').click()
        expect(self.page.locator('#viewer')).to_be_visible()
        expect(self.page.locator('#link-error')).not_to_be_visible()
        self.assertEqual(self.errors,[])

    def test_shared_link_escapes_names_and_has_clipboard_fallback(self):
        from playwright.sync_api import expect
        model='Model + # Ü %';run_name='01-fluid-simulation-001'
        run=self.results/model/run_name;run.mkdir(parents=True)
        (run/'index.html').write_text('<!doctype html><title>Escaped build</title><h1>Escaped build</h1>')
        self.page.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('Clipboard denied')}}})")
        self.navigate_direct()
        links=[]
        def copy_dialog(dialog):
            links.append(dialog.default_value);dialog.dismiss()
        self.page.on('dialog',copy_dialog)
        with self.page.expect_event('dialog'):
            self.page.locator('#cards [data-copy-run]').click()
        link=self.base+'/#play/'+quote(model+'/'+run_name,safe='/')
        self.assertEqual(links,[link])
        self.page.goto(link)
        expect(self.page.frame_locator('#artifact-frame').locator('h1')).to_have_text('Escaped build')
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#viewer')).not_to_be_visible()
        self.assertNotIn('#play/',self.page.url)
        self.assertEqual(self.errors,[])

    def model_settings(self, content):
        static=Path(self.temp.name)/'static'
        if not static.exists():
            shutil.copytree(ROOT/'gallery/static',static)
            old=server.STATIC_ROOT
            self.addCleanup(setattr,server,'STATIC_ROOT',old)
            server.STATIC_ROOT=static
        (static/'appsettings.json').write_text(content,encoding='utf-8')

    def test_model_settings_control_order_color_and_refresh(self):
        from playwright.sync_api import expect
        settings={'models':[
            {'key':'gpt-6_astra','label':'Astra custom','color':'#88CCAA'},
            {'key':'xai_grok4.6','label':'Grok custom','color':'#EEAA77'},
            {'key':'google_gemini3.8_flash','label':'Gemini custom','color':'#99BBFF'},
        ]}
        keys=[m['key'] for m in settings['models']]
        for key in keys+['Unlisted model']:
            run=self.results/key/'01-fluid-simulation';run.mkdir(parents=True)
            (run/'index.html').write_text('<!doctype html><title>Presentation fixture</title>')
        self.model_settings(json.dumps(settings));self.navigate_direct()
        expect(self.page.locator('.run-card')).to_have_count(4)
        columns=self.page.locator('.model-column')
        self.assertEqual(columns.evaluate_all("els=>els.map(e=>e.dataset.model)"),keys+['Unlisted model'])
        self.assertEqual(self.page.locator('#model-filter option').evaluate_all("els=>els.slice(1).map(e=>e.value)"),keys+['Unlisted model'])
        self.assertEqual(columns.locator('.model-name').all_text_contents(),['Astra custom','Grok custom','Gemini custom','Unlisted model'])
        colors=columns.locator('.run-card').evaluate_all('els=>els.map(e=>getComputedStyle(e).borderTopColor)')
        self.assertEqual(colors[:3],['rgb(136, 204, 170)','rgb(238, 170, 119)','rgb(153, 187, 255)'])
        self.assertEqual(len(set(columns.locator('.run-card').evaluate_all('els=>els.map(e=>getComputedStyle(e).backgroundColor)'))),4)
        settings['models'].reverse();settings['models'][0]['color']='#DD99EE'
        self.model_settings(json.dumps(settings));self.page.locator('#refresh').click()
        expect(columns.first).to_have_attribute('data-model',keys[-1])
        self.assertEqual(columns.evaluate_all("els=>els.map(e=>e.dataset.model)"),list(reversed(keys))+['Unlisted model'])
        expect(self.page.locator('.model-column').first.locator('.run-card')).to_have_css('border-top-color','rgb(221, 153, 238)')
        self.assertEqual(columns.last.locator('.run-card').evaluate('e=>getComputedStyle(e).borderTopColor'),colors[-1])
        self.assertEqual(self.errors,[])

    def test_invalid_model_settings_keep_builds_available(self):
        from playwright.sync_api import expect
        self.fixture();self.model_settings('{invalid json');self.navigate_direct()
        expect(self.page.locator('.run-card')).to_have_count(2)
        expect(self.page.locator('#error-banner')).to_contain_text('Model settings')
        self.model_settings(json.dumps({'models':[]}));self.page.locator('#refresh').click()
        expect(self.page.locator('#error-banner')).not_to_be_visible()
        expect(self.page.locator('.run-card')).to_have_count(2)
        self.assertEqual(self.errors,[])

    def test_model_profiles_display_refresh_and_follow_live_model_without_restarting_app(self):
        from playwright.sync_api import expect
        self.fixture()
        model = 'UI fixture - not a model evaluation'
        profile = self.results / model / 'model.toml'
        profile.write_text('''provider = 'Provider <img src=x onerror=alert(1)>'
provider_url = 'https://example.com/provider'
harness = 'Test CLI'
harness_url = 'https://example.com/harness'
setting = 'Max'
runtime = 'MTPLX (local)'
runtime_url = 'https://runtime.example/'
quantization = 'Optimized Speed (4-bit, 8-bit attention) <img src=x onerror=alert(1)>'
quantization_url = 'https://models.example/quant'
''', encoding='utf-8')
        other = self.results / 'grok' / '01-fluid-simulation'
        other.mkdir(parents=True)
        (other / 'index.html').write_text('<!doctype html><title>Grok fixture</title><h1>Second build</h1>')
        (other.parent / 'model.toml').write_text('harness = "Cursor Desktop"\nsetting = "High Fast"\n', encoding='utf-8')
        self.navigate_direct()
        self.page.locator('#track-filter').select_option('html')
        self.page.locator('#model-filter').select_option(model)
        expect(self.page.locator('.model-setup')).to_have_text('Test CLI · Max')
        self.page.locator('#cards .card-open').click()
        self.page.locator('[data-tab="details"]').click()
        expect(self.page.locator('.model-setup-details')).to_contain_text('Shared setup for this model')
        expect(self.page.locator('.model-setup-details img')).to_have_count(0)
        expect(self.page.locator('.model-setup-details')).to_contain_text('MTPLX (local)')
        expect(self.page.locator('.model-setup-details')).to_contain_text('Optimized Speed (4-bit, 8-bit attention) <img src=x onerror=alert(1)>')
        self.page.locator('[data-tab="preview"]').click()
        self.page.locator('#launch-preview').click()
        frame = self.page.frame_locator('#artifact-frame')
        frame.locator('#increment').click()
        for width in (1440, 768, 390, 320):
            self.page.set_viewport_size({'width': width, 'height': 844})
            before = self.page.locator('#artifact-frame').bounding_box()
            self.page.locator('.live-setup summary').click()
            panel = self.page.locator('.live-setup-panel')
            expect(panel).to_contain_text('Provider <img src=x onerror=alert(1)>')
            expect(panel).to_contain_text('Test CLI')
            expect(panel).to_contain_text('Max')
            expect(panel.locator('img')).to_have_count(0)
            expect(panel.get_by_role('link', name='Test CLI')).to_have_attribute('href', 'https://example.com/harness')
            expect(panel.get_by_role('link', name='Test CLI')).to_have_attribute('rel', 'noopener noreferrer')
            expect(panel.get_by_role('link', name='MTPLX (local)')).to_have_attribute('href', 'https://runtime.example/')
            quantization = panel.get_by_role('link', name='Optimized Speed (4-bit, 8-bit attention) <img src=x onerror=alert(1)>')
            expect(quantization).to_have_attribute('href', 'https://models.example/quant')
            expect(quantization).to_have_attribute('rel', 'noopener noreferrer')
            self.assertEqual(before, self.page.locator('#artifact-frame').bounding_box())
            expect(frame.locator('#increment')).to_have_text('Count: 1')
            bounds = panel.bounding_box()
            self.assertGreaterEqual(bounds['x'], 0)
            self.assertLessEqual(bounds['x'] + bounds['width'], width)
            self.assertTrue(self.page.locator('.live-bar').evaluate('node => node.scrollWidth <= node.clientWidth'))
            self.page.keyboard.press('Escape')
            expect(panel).not_to_be_visible()
            expect(self.page.locator('#viewer')).to_be_visible()
        self.page.locator('.live-setup summary').click()
        self.page.locator('.live-guide summary').click()
        expect(self.page.locator('.live-setup-panel')).not_to_be_visible()
        self.page.locator('.live-setup summary').click()
        expect(self.page.locator('.live-guide-panel')).not_to_be_visible()
        bounds = self.page.locator('#artifact-frame').bounding_box()
        self.page.mouse.click(bounds['x'] + 10, bounds['y'] + bounds['height'] - 20)
        expect(self.page.locator('.live-setup-panel')).not_to_be_visible()
        frame.locator('#increment').click()
        expect(frame.locator('#increment')).to_have_text('Count: 2')
        self.page.locator('#live-model').select_option('grok/01-fluid-simulation')
        self.page.locator('.live-setup summary').click()
        expect(self.page.locator('.live-setup-panel')).to_contain_text('Cursor Desktop')
        expect(self.page.locator('.live-setup-panel')).to_contain_text('High Fast')
        expect(self.page.locator('.live-setup-panel')).not_to_contain_text('Test CLI')
        expect(self.page.locator('.live-setup-panel')).not_to_contain_text('MTPLX')
        self.page.locator('#close-live').click()
        profile.write_text('harness = "Test CLI"\nsetting = "Low"\n', encoding='utf-8')
        self.page.locator('#refresh').click()
        expect(self.page.locator('.model-setup')).to_have_text('Test CLI · Low')
        profile.write_text('invalid = [', encoding='utf-8')
        self.page.locator('#refresh').click()
        expect(self.page.locator('.model-setup')).to_have_count(0)
        self.page.locator('#cards .card-open').click()
        self.page.locator('#launch-preview').click()
        expect(self.page.locator('.live-setup')).to_have_count(0)
        expect(frame.locator('#increment')).to_have_text('Count: 0')
        self.assertEqual(self.errors, [])

    def test_live_preview_fills_viewport_resizes_and_cleans_up(self):
        from playwright.sync_api import expect
        self.fixture();self.navigate_direct()
        self.page.locator('#track-filter').select_option('html')
        self.page.locator('#cards .card-open').click()
        self.page.locator('#launch-preview').click()
        frame=self.page.frame_locator('#artifact-frame')
        frame.locator('#increment').click()
        expect(frame.locator('#increment')).to_have_text('Count: 1')
        for width,height in [(1440,1000),(1920,1080),(390,844)]:
            self.page.set_viewport_size({'width':width,'height':height})
            self.page.wait_for_function('''() => {
                const r=document.querySelector('#artifact-frame').getBoundingClientRect();
                return Math.abs(r.width-innerWidth)<2 && Math.abs(r.bottom-innerHeight)<2;
            }''')
            rectangle=self.page.locator('#artifact-frame').bounding_box()
            self.assertGreaterEqual(rectangle['height'],height-80)
            self.assertEqual(frame.locator('body').evaluate('() => innerWidth'),width)
            expect(frame.locator('#increment')).to_have_text('Count: 1')
        self.page.locator('#viewport-size').select_option('768x1024')
        self.page.wait_for_function("document.querySelector('#artifact-frame').getBoundingClientRect().width===768")
        self.assertEqual(frame.locator('body').evaluate('() => [innerWidth,innerHeight]'),[768,1024])
        self.page.locator('#viewport-size').select_option('fit')
        self.page.locator('#back-to-build').click()
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        expect(self.page.locator('#launch-preview')).to_be_visible()
        self.page.locator('#launch-preview').click()
        self.page.locator('#close-live').click()
        expect(self.page.locator('#viewer')).not_to_be_visible()
        expect(self.page.locator('#artifact-frame')).to_have_count(0)
        self.assertEqual(self.errors,[])

    def test_why_view_can_be_linked_and_returns_to_builds(self):
        from playwright.sync_api import expect
        self.fixture()
        self.page.goto(self.base+'/#why')
        expect(self.page.locator('#view-why')).to_be_visible()
        expect(self.page.locator('#filters')).not_to_be_visible()
        expect(self.page.locator('.stats')).not_to_be_visible()
        image=self.page.locator('#view-why img')
        expect(image).to_be_visible()
        self.page.wait_for_function("document.querySelector('#view-why img').naturalWidth===1021")
        self.page.set_viewport_size({'width':390,'height':844})
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.locator('#view-why [data-view="gallery"]').click()
        expect(self.page.locator('#view-gallery')).to_be_visible()
        expect(self.page.locator('#cards .run-card')).to_have_count(2)
        self.page.goto(self.base+'/#constructor')
        expect(self.page.locator('#view-gallery')).to_be_visible()
        self.assertEqual(self.errors,[])

    def test_unassigned_builds_are_not_compared_as_one_prompt(self):
        from playwright.sync_api import expect
        for model, name in [('Model A','unknown-one'),('Model B','unknown-two')]:
            run=self.results/model/name;run.mkdir(parents=True)
            (run/'index.html').write_text('<!doctype html><title>Unassigned fixture</title>')
        self.navigate_direct()
        expect(self.page.locator('#cards .prompt-group')).to_have_count(2)
        expect(self.page.locator('#cards .missing-build')).to_have_count(0)
        expect(self.page.locator('#group-count')).to_have_text('0')
        for group in self.page.locator('#cards .prompt-group').all():
            expect(group.locator('.run-card')).to_have_count(1)
            expect(group.locator('.model-column')).to_have_count(1)

    def test_prompt_groups_keep_models_together_and_filter_runs(self):
        from playwright.sync_api import expect
        self.fixture()
        other=self.results/'Second model'/'01-fluid-simulation-002';other.mkdir(parents=True)
        (other/'index.html').write_text('<!doctype html><title>Second model fixture</title>')
        self.navigate_direct()
        self.page.locator('#recorded-only').uncheck()
        expect(self.page.locator('#cards .prompt-group')).to_have_count(2)
        fluid=self.page.locator('.prompt-group[data-task="01-fluid-simulation"]')
        expect(fluid.locator('.run-card')).to_have_count(2)
        expect(fluid.locator('.model-column')).to_have_count(2)
        project=self.page.locator('.prompt-group[data-task="21-import-studio"]')
        expect(project.locator('.run-card')).to_have_count(1)
        expect(project.locator('.missing-build')).to_have_count(1)
        fluid.locator('[data-open-prompt]').click()
        expect(self.page.locator('#prompt-title')).to_have_text('Real-Time 2D Fluid Simulation')
        self.page.locator('#close-prompt').click()
        self.page.locator('#model-filter').select_option('Second model')
        expect(self.page.locator('#cards .prompt-group')).to_have_count(1)
        expect(self.page.locator('#cards .run-card')).to_have_count(1)
        expect(self.page.locator('#cards .model-column')).to_have_count(1)
        self.assertEqual(self.errors,[])

    def test_catalog_filters_prompt_and_live_artifact(self):
        from playwright.sync_api import expect
        self.navigate_direct()
        expect(self.page.locator('#empty-results')).to_be_visible()
        self.page.locator('[data-view="catalog"]').first.click()
        expect(self.page.locator('#catalog-grid .task-card')).to_have_count(30)
        self.page.locator('#catalog-grid .task-card button').first.click()
        expect(self.page.locator('#prompt-content')).to_contain_text('from the beginning')
        self.page.locator('#close-prompt').click()
        self.fixture()
        self.page.locator('#refresh').click()
        self.page.locator('.nav-button[data-view="gallery"]').click()
        expect(self.page.locator('#cards .run-card')).to_have_count(2)
        self.screenshot('gallery-preview.png')
        self.page.locator('#track-filter').select_option('html')
        expect(self.page.locator('#cards .run-card')).to_have_count(1)
        self.page.locator('#cards .card-open').click()
        expect(self.page.locator('#viewer')).to_be_visible()
        self.page.locator('#launch-preview').click()
        frame=self.page.frame_locator('#artifact-frame')
        frame.locator('#increment').click()
        expect(frame.locator('#increment')).to_have_text('Count: 1')
        self.page.locator('#back-to-build').click()
        self.page.locator('[data-tab="evidence"]').click()
        expect(self.page.locator('#viewer-content')).to_contain_text('Actual counter interaction')
        self.page.locator('#close-viewer').click()
        self.page.locator('#track-filter').select_option('real-apps')
        self.page.locator('#cards .card-open').click()
        self.screenshot('project-viewer-preview.png')
        expect(self.page.locator('#viewer-content')).to_contain_text('No application is launched automatically')
        self.page.locator('[data-tab="details"]').click()
        expect(self.page.locator('#viewer-content')).to_contain_text('python')
        self.page.locator('#close-viewer').click()
        self.page.locator('#track-filter').select_option('all')
        self.page.locator('[data-view="leaderboard"]').click()
        expect(self.page.locator('#leaderboard-content')).to_contain_text('80.0')
        self.assertEqual(self.errors,[])

    def test_mobile_no_page_overflow(self):
        from playwright.sync_api import expect
        self.fixture();self.page.set_viewport_size({'width':390,'height':844})
        self.navigate_direct()
        expect(self.page.locator('#cards .run-card')).to_have_count(2)
        expect(self.page.locator('.brand-title')).to_have_text('Trial - a Vibe Benchmark')
        expect(self.page.locator('.brand-descriptor')).to_have_css('font-style', 'italic')
        self.assertEqual(self.page.locator('.brand-title').evaluate('node=>getComputedStyle(node).fontSize'),
                         self.page.locator('.brand-descriptor').evaluate('node=>getComputedStyle(node).fontSize'))
        expect(self.page.locator('.brand-subtitle,.footer-byline')).to_have_text(['by Pyro', 'by Pyro'])
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.screenshot('gallery-mobile-preview.png')
        self.page.locator('[data-view="catalog"]').first.click()
        expect(self.page.locator('#catalog-grid .task-card')).to_have_count(30)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.assertEqual(self.errors,[])


@unittest.skipUnless(os.environ.get('RUN_BRIDGE_UI_TESTS')=='1','Set RUN_BRIDGE_UI_TESTS=1 for browser presentation with a local HTTP bridge.')
class BrowserPresentationTests(BrowserEnvironment):
    """Actual frontend and actual HTTP API, but transport goes through Python.

    This is NOT a direct browser-to-server/live-artifact integration check.
    It lets presentation and interaction be inspected when navigation policy
    forbids loopback in Chromium. No production files are modified.
    """
    def render_with_bridge(self):
        def request(path):
            if not isinstance(path,str) or not path.startswith('/') or path.startswith('//'):
                return {'status':400,'body':'Unsupported UI-test path'}
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            try:
                with opener.open(self.base+path,timeout=5) as response:
                    return {'status':response.status,'body':response.read().decode('utf-8')}
            except urllib.error.HTTPError as error:
                return {'status':error.code,'body':error.read().decode('utf-8','replace')}
        self.page.expose_function('__test_http_request',request)
        html=(ROOT/'gallery/static/index.html').read_text(encoding='utf-8')
        html=re.sub(r'<script defer src="/app.js"></script>','',html)
        html=re.sub(r'<link[^>]+>','',html)
        self.page.set_content(html)
        self.page.add_style_tag(content=(ROOT/'gallery/static/styles.css').read_text(encoding='utf-8'))
        self.page.add_script_tag(content="window.fetch=async path=>{const r=await window.__test_http_request(String(path));return new Response(r.body,{status:r.status});};")
        self.page.add_script_tag(content=(ROOT/'gallery/static/app.js').read_text(encoding='utf-8'))
        self.page.wait_for_function("document.querySelector('#connection-status').textContent.includes('ready')")

    def test_catalog_prompt_filters_and_project_inspection(self):
        from playwright.sync_api import expect
        self.render_with_bridge()
        expect(self.page.locator('#empty-results')).to_be_visible()
        self.page.locator('[data-view="catalog"]').first.click()
        expect(self.page.locator('#catalog-grid .task-card')).to_have_count(30)
        self.screenshot('prompt-library-preview.png')
        self.page.locator('#catalog-grid .task-card button').first.click()
        expect(self.page.locator('#prompt-content')).to_contain_text('from the beginning')
        self.page.locator('#copy-prompt').click()
        expect(self.page.locator('#copy-status')).not_to_be_empty()
        self.page.locator('#close-prompt').click()
        self.fixture();self.page.locator('#refresh').click()
        self.page.locator('.nav-button[data-view="gallery"]').first.click()
        expect(self.page.locator('#cards .run-card')).to_have_count(2)
        self.screenshot('gallery-preview.png')
        self.page.locator('#track-filter').select_option('html')
        expect(self.page.locator('#cards .run-card')).to_have_count(1)
        self.page.locator('#cards .card-open').click()
        expect(self.page.locator('#launch-preview')).to_be_visible()
        self.page.locator('[data-tab="evidence"]').click()
        expect(self.page.locator('#viewer-content')).to_contain_text('Actual counter interaction')
        self.page.locator('#close-viewer').click()
        self.page.locator('#track-filter').select_option('real-apps')
        self.page.locator('#cards .card-open').click()
        expect(self.page.locator('#viewer-content')).to_contain_text('No application is launched automatically')
        self.screenshot('project-viewer-preview.png')
        self.page.locator('[data-tab="details"]').click()
        expect(self.page.locator('#viewer-content')).to_contain_text('python')
        self.page.locator('#close-viewer').click()
        self.page.locator('#track-filter').select_option('all')
        self.page.locator('[data-view="leaderboard"]').first.click()
        expect(self.page.locator('#leaderboard-content')).to_contain_text('80.0')
        self.page.locator('.nav-button[data-view="gallery"]').first.click()
        self.page.locator('#search').fill('no such model')
        expect(self.page.locator('#cards .run-card')).to_have_count(0)
        self.page.locator('#clear-filters').click()
        expect(self.page.locator('#cards .run-card')).to_have_count(2)
        self.assertEqual(self.errors,[])

    def test_mobile_and_catalog_scrolling(self):
        from playwright.sync_api import expect
        self.fixture();self.page.set_viewport_size({'width':390,'height':844});self.render_with_bridge()
        expect(self.page.locator('#cards .run-card')).to_have_count(2)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.screenshot('gallery-mobile-preview.png')
        self.page.locator('[data-view="catalog"]').first.click()
        expect(self.page.locator('#catalog-grid .task-card')).to_have_count(30)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.locator('#track-filter').select_option('real-apps')
        expect(self.page.locator('#catalog-grid .task-card')).to_have_count(10)
        self.assertEqual(self.errors,[])

if __name__=='__main__':unittest.main()
