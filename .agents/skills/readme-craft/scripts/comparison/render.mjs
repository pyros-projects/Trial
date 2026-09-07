import { readFileSync } from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = dirname(dirname(__dirname));

function loadGitHubCSS() {
  const cssPath = join(ROOT_DIR, 'node_modules', 'github-markdown-css', 'github-markdown-light.css');
  return readFileSync(cssPath, 'utf-8');
}

/**
 * Resolve relative src/srcset paths in HTML to file:// absolute URLs.
 * This allows Playwright's setContent() to load local images.
 */
export function resolveLocalPaths(html, baseDir) {
  if (!baseDir) return html;
  return html.replace(
    /(src|srcset)="([^"]+)"/g,
    (match, attr, value) => {
      if (/^(https?:|data:|file:)/.test(value)) return match;
      if (isAbsolute(value)) return match;
      const abs = resolve(baseDir, value);
      return `${attr}="${pathToFileURL(abs).href}"`;
    }
  );
}

/**
 * Convert markdown content to HTML string via marked.
 */
export function renderMarkdown(mdContent) {
  return marked.parse(mdContent);
}

/**
 * Build a full HTML page with two panes (before/after) in GitHub style.
 */
export function buildComparisonPage(beforeHtml, afterHtml, opts = {}) {
  const {
    mode = 'side-by-side',
    cropHeight,
    contentWidth = 1012,
    labels = ['BEFORE', 'AFTER'],
  } = opts;

  const css = loadGitHubCSS();
  const isSideBySide = mode === 'side-by-side';
  const paneWidth = isSideBySide ? Math.floor(contentWidth / 2 - 20) : contentWidth;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
${css}

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #f6f8fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  padding: 24px;
}
.comparison-container {
  display: ${isSideBySide ? 'flex' : 'block'};
  gap: 16px;
  max-width: ${isSideBySide ? contentWidth + 48 : contentWidth + 48}px;
  margin: 0 auto;
}
.pane {
  ${isSideBySide ? `width: ${paneWidth}px; flex-shrink: 0;` : `width: ${paneWidth}px; margin: 0 auto;`}
  ${!isSideBySide ? 'margin-bottom: 16px;' : ''}
}
.pane-label {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.pane-label.before {
  background: #ffebe9;
  color: #82071e;
}
.pane-label.after {
  background: #dafbe1;
  color: #116329;
}
.pane-card {
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 32px;
  ${cropHeight ? `max-height: ${cropHeight}px; overflow: hidden;` : ''}
}
.markdown-body {
  font-size: 16px;
}
.markdown-body img {
  max-width: 100%;
}
</style>
</head>
<body>
<div class="comparison-container">
  <div class="pane">
    <span class="pane-label before">${labels[0]}</span>
    <div class="pane-card">
      <div class="markdown-body">${beforeHtml}</div>
    </div>
  </div>
  <div class="pane">
    <span class="pane-label after">${labels[1]}</span>
    <div class="pane-card">
      <div class="markdown-body">${afterHtml}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Build a full HTML page for a single README render.
 */
export function buildSinglePage(html, opts = {}) {
  const { contentWidth = 1012, cropHeight } = opts;
  const css = loadGitHubCSS();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
${css}

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #f6f8fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  padding: 24px;
}
.single-card {
  max-width: ${contentWidth}px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 32px;
  ${cropHeight ? `max-height: ${cropHeight}px; overflow: hidden;` : ''}
}
.markdown-body {
  font-size: 16px;
}
.markdown-body img {
  max-width: 100%;
}
</style>
</head>
<body>
<div class="single-card">
  <div class="markdown-body">${html}</div>
</div>
</body>
</html>`;
}
