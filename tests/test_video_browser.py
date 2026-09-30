"""Opt-in video-gallery integration; external players and media never load."""
import json
import os
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from test_browser_single import BrowserEnvironment, server


@unittest.skipUnless(
    os.environ.get('RUN_BROWSER_TESTS') == '1',
    'Set RUN_BROWSER_TESTS=1 for direct Chromium integration.',
)
class VideoBrowserTests(BrowserEnvironment):
    def setUp(self):
        super().setUp()
        self.fixture()
        self.video_ids = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']
        self.video_titles = ['First video fixture', 'Second video fixture', 'Third video fixture']
        self.prompt_text = '# Video prompt fixture\n\nCreate a short, original animated film.\n'
        self.private_source = r'\\wsl.localhost\Ubuntu-D\home\pyro\private-video-source'
        videos_root = Path(self.temp.name) / 'videos'
        (videos_root / 'accelerate').mkdir(parents=True)
        (videos_root / 'accelerate/prompt.md').write_text(self.prompt_text, encoding='utf-8')
        catalog = [{
            'id': 'accelerate',
            'title': 'Video experiment fixture',
            'description': 'Three recorded films for browser integration.',
            'look_for': 'Watch the motion and the sequence of ideas.',
            'format': 'Recorded video',
            'source_path': self.private_source,
            'videos': [
                {'youtube_id': video_id, 'model_key': model, 'title': title,
                 'setting': 'Max', 'duration': '1:00'}
                for video_id, model, title in zip(
                    self.video_ids,
                    ['gpt-6_astra', 'anthropic_opus55', 'gpt-6.1_sol'],
                    self.video_titles,
                )
            ],
        }]
        (videos_root / 'catalog.json').write_text(json.dumps(catalog), encoding='utf-8')
        old_root = getattr(server, 'VIDEOS_ROOT', None)
        server.VIDEOS_ROOT = videos_root
        self.addCleanup(setattr, server, 'VIDEOS_ROOT', old_root)
        self.external_requests = []
        self.context.route('**/*', self.route_request)
        self.context.grant_permissions(['clipboard-read', 'clipboard-write'])

    def route_request(self, route):
        request = route.request
        if urlsplit(request.url).netloc != urlsplit(self.base).netloc:
            self.external_requests.append({
                'url': request.url,
                'referer': request.header_value('referer'),
            })
            route.abort()
        elif request.is_navigation_request() and request.frame == self.page.main_frame:
            # Keep the real document and production's restrictive default policy.
            response = route.fetch()
            headers = dict(response.headers)
            headers['referrer-policy'] = 'no-referrer'
            route.fulfill(response=response, headers=headers)
        else:
            route.continue_()

    def embed_requests(self):
        return [request for request in self.external_requests
                if '/embed/' in urlsplit(request['url']).path]

    def assert_video_link(self, url, video_id=None):
        parsed = urlsplit(url)
        self.assertEqual(f'{parsed.scheme}://{parsed.netloc}', self.base)
        route = f'watch/accelerate/{video_id}' if video_id else 'videos/accelerate'
        public_path = f'/videos/accelerate/{video_id}/' if video_id else '/videos/accelerate/'
        self.assertTrue(parsed.fragment == route or parsed.path == public_path, url)
        self.assertNotIn(self.private_source, url)

    def assert_player(self, video_id, title):
        from playwright.sync_api import expect
        viewer = self.page.locator('#video-viewer')
        frame = self.page.locator('#video-frame')
        expect(viewer).to_be_visible()
        expect(self.page.locator('#video-title')).to_have_text(title)
        expect(frame).to_have_count(1)
        parsed = urlsplit(frame.get_attribute('src'))
        self.assertEqual((parsed.scheme, parsed.hostname, parsed.path),
                         ('https', 'www.youtube-nocookie.com', f'/embed/{video_id}'))
        self.assertEqual(parse_qs(parsed.query).get('autoplay'), ['1'])
        self.assertEqual(parse_qs(parsed.query).get('rel'), ['0'])
        expect(frame).to_have_attribute('referrerpolicy', 'strict-origin-when-cross-origin')
        self.assertIsNone(frame.get_attribute('sandbox'))
        return frame.element_handle()

    def copy_video_link(self, button, video_id=None):
        self.page.evaluate("navigator.clipboard.writeText('')")
        button.click()
        self.page.wait_for_function("async () => (await navigator.clipboard.readText()).length > 0")
        copied = self.page.evaluate('navigator.clipboard.readText()')
        self.assert_video_link(copied, video_id)
        return copied

    def test_video_collection_navigation_sharing_prompt_and_responsive_cards(self):
        from playwright.sync_api import expect
        self.navigate_direct()
        html_count = self.page.locator('#nav-count').inner_text()
        self.page.locator('.nav-button[data-view="videos"]').click()
        collection = self.page.locator('#view-videos')
        cards = self.page.locator('#video-experiments .video-card')
        expect(collection).to_be_visible()
        expect(cards).to_have_count(3)
        expect(self.page.locator('#filters')).not_to_be_visible()
        expect(self.page.locator('.stats')).not_to_be_visible()
        expect(self.page.locator('.workspace-tools')).not_to_be_visible()
        expect(self.page.locator('.hero-note')).not_to_be_visible()
        expect(self.page.locator('#nav-count')).to_have_text(html_count)
        expect(self.page.locator('#video-frame')).to_have_count(0)
        self.assertEqual(self.embed_requests(), [])
        self.assertNotIn(self.private_source, self.page.content())
        self.assertNotIn(self.temp.name, self.page.content())

        for width, columns in [(1440, 3), (900, 2), (390, 1)]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 1000})
                self.page.wait_for_function('''({cards, columns}) => {
                    const xs = [...document.querySelectorAll(cards)].map(card =>
                        Math.round(card.getBoundingClientRect().x));
                    return new Set(xs).size === columns;
                }''', arg={'cards': '#video-experiments .video-card', 'columns': columns})
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                self.screenshot(f'video-collection-{width}.png')

        self.page.set_viewport_size({'width': 1440, 'height': 1000})
        collection.locator('[data-video-prompt="accelerate"]').click()
        expect(self.page.locator('#prompt-content')).to_have_text(self.prompt_text)
        self.page.locator('#close-prompt').click()
        copied = self.copy_video_link(collection.locator('[data-copy-video="accelerate"]'))
        self.page.goto(copied)
        expect(collection).to_be_visible()
        expect(cards).to_have_count(3)
        self.page.goto(self.base + '/#videos/accelerate')
        self.page.reload()
        expect(collection).to_be_visible()
        expect(self.page.locator('#video-frame')).to_have_count(0)
        self.assertEqual(self.embed_requests(), [])

        self.copy_video_link(
            collection.locator(f'[data-copy-video="accelerate/{self.video_ids[0]}"]'), self.video_ids[0],
        )
        self.page.locator('.nav-button[data-view="gallery"]').click()
        expect(self.page.locator('#filters')).to_be_visible()
        expect(self.page.locator('.stats')).to_be_visible()
        self.assertEqual(self.errors, [])

    def test_video_player_routes_referrer_switch_and_cleanup(self):
        from playwright.sync_api import expect
        first, second, third = self.video_ids
        self.page.goto(self.base + '/#videos/accelerate')
        expect(self.page.locator('#video-frame')).to_have_count(0)
        self.assertEqual(self.embed_requests(), [])
        with self.page.expect_request(f'https://www.youtube-nocookie.com/embed/{first}*') as embed:
            self.page.locator(f'[data-watch-video="accelerate/{first}"]').first.click()
        old_frame = self.assert_player(first, self.video_titles[0])
        self.assertEqual(embed.value.header_value('referer'), self.base + '/')
        self.assertIn('/#watch/accelerate/' + first, self.page.url)

        self.page.locator('#video-model').select_option('accelerate/' + second)
        self.assert_player(second, self.video_titles[1])
        self.assertFalse(old_frame.evaluate('frame => frame.isConnected'))
        self.copy_video_link(self.page.locator('#copy-video-link'), second)
        for width in [1440, 390]:
            self.page.set_viewport_size({'width': width, 'height': 1000})
            bounds = self.page.locator('#video-frame').bounding_box()
            self.assertGreaterEqual(bounds['width'], 200)
            self.assertGreaterEqual(bounds['height'], 200)
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            self.screenshot(f'video-player-{width}.png')
        self.page.locator('#close-video').click()
        expect(self.page.locator('#video-viewer')).not_to_be_visible()
        expect(self.page.locator('#video-frame')).to_have_count(0)

        self.page.goto(self.base + f'/#watch/accelerate/{third}')
        self.assert_player(third, self.video_titles[2])
        self.page.reload()
        self.assert_player(third, self.video_titles[2])
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#video-viewer')).not_to_be_visible()
        expect(self.page.locator('#video-frame')).to_have_count(0)
        self.page.goto(self.base + f'/#watch/accelerate/{first}')
        playing_frame = self.assert_player(first, self.video_titles[0])
        self.page.evaluate("location.hash = '#why'")
        expect(self.page.locator('#view-why')).to_be_visible()
        expect(self.page.locator('#video-viewer')).not_to_be_visible()
        expect(self.page.locator('#video-frame')).to_have_count(0)
        self.assertFalse(playing_frame.evaluate('frame => frame.isConnected'))
        self.assertEqual(self.errors, [])
