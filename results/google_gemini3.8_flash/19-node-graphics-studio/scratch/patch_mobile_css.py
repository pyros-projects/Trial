with open('scratch/gen_css.py', 'r') as f:
    css = f.read()

old_mobile_block = """  /* When tabs are active on mobile */
  body.mobile-view-palette #palette-panel {
    display: flex;
    position: absolute;
    top: 44px;
    bottom: 48px;
    left: 0;
    width: 100%;
    z-index: 50;
  }

  body.mobile-view-preview #right-panel {
    display: flex;
    position: absolute;
    top: 44px;
    bottom: 48px;
    left: 0;
    width: 100%;
    z-index: 50;
  }

  body.mobile-view-inspector #right-panel {
    display: flex;
    position: absolute;
    top: 44px;
    bottom: 48px;
    left: 0;
    width: 100%;
    z-index: 50;
  }
  body.mobile-view-inspector #preview-container {
    display: none;
  }

  body.mobile-view-timeline #timeline-panel {
    display: flex;
    position: absolute;
    top: 44px;
    bottom: 48px;
    left: 0;
    width: 100%;
    height: auto;
    z-index: 50;
  }"""

new_mobile_block = """  body.mobile-view-palette #editor-area,
  body.mobile-view-preview #editor-area,
  body.mobile-view-inspector #editor-area,
  body.mobile-view-timeline #editor-area {
    display: none !important;
  }

  body.mobile-view-palette #palette-panel {
    display: flex !important;
    position: absolute;
    top: 44px;
    bottom: 48px;
    left: 0;
    width: 100%;
    z-index: 50;
    background: var(--bg-darker);
  }

  body.mobile-view-preview #right-panel {
    display: flex !important;
    position: absolute;
    top: 44px;
    bottom: 48px;
    left: 0;
    width: 100%;
    z-index: 50;
    background: var(--bg-darker);
  }

  body.mobile-view-inspector #right-panel {
    display: flex !important;
    position: absolute;
    top: 44px;
    bottom: 48px;
    left: 0;
    width: 100%;
    z-index: 50;
    background: var(--bg-darker);
  }
  body.mobile-view-inspector #preview-container {
    display: none !important;
  }

  body.mobile-view-timeline #timeline-panel {
    display: flex !important;
    position: absolute;
    top: 44px;
    bottom: 48px;
    left: 0;
    width: 100%;
    height: calc(100vh - 92px) !important;
    z-index: 50;
    background: var(--bg-darker);
  }"""

css = css.replace(old_mobile_block, new_mobile_block)

with open('scratch/gen_css.py', 'w') as f:
    f.write(css)

print("Mobile CSS patched.")
