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
