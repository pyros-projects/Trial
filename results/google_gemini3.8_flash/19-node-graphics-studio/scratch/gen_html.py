def get_html_body():
    return """
<div id="app-container">
  <!-- Top Navigation Bar -->
  <header id="top-bar">
    <div class="brand">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
        <circle cx="6" cy="6" r="3"></circle>
        <circle cx="18" cy="6" r="3"></circle>
        <circle cx="12" cy="18" r="3"></circle>
        <line x1="8.5" y1="7.5" x2="15.5" y2="7.5"></line>
        <line x1="7.5" y1="8.5" x2="10.5" y2="15.5"></line>
        <line x1="16.5" y1="8.5" x2="13.5" y2="15.5"></line>
      </svg>
      <span>NODE STUDIO</span>
      <span class="brand-badge">WEBGL</span>
    </div>

    <div class="header-controls">
      <!-- Preset Dropdown -->
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="font-size: 11px; color: var(--text-dim); text-transform: uppercase;">Preset:</span>
        <select id="preset-select" class="dropdown" style="min-width: 170px;">
          <option value="" disabled selected>Choose a Preset...</option>
        </select>
      </div>

      <div class="btn-group">
        <button class="btn btn-sm" onclick="openCommandPalette()" title="Open Command Palette (Space or Ctrl+K)">+ Add Node</button>
        <button class="btn btn-sm" onclick="editor.frameSelected()" title="Group Selected into Frame (G)">Frame</button>
      </div>

      <div class="btn-group">
        <button class="btn btn-sm" onclick="editor.alignSelected('left')" title="Align Left">Align L</button>
        <button class="btn btn-sm" onclick="editor.alignSelected('top')" title="Align Top">Align T</button>
      </div>

      <div class="btn-group">
        <button class="btn btn-sm" onclick="state.undo()" title="Undo (Ctrl+Z)">↶</button>
        <button class="btn btn-sm" onclick="state.redo()" title="Redo (Ctrl+Y)">↷</button>
      </div>

      <div class="btn-group">
        <button class="btn btn-sm" id="btn-export-menu">Export ▾</button>
        <button class="btn btn-sm" onclick="document.getElementById('project-file-input').click()">Load JSON</button>
      </div>

      <select id="theme-select" class="dropdown">
        <option value="dark">Dark Studio</option>
        <option value="cyberpunk">Cyberpunk Neon</option>
        <option value="monokai">Monokai Pro</option>
        <option value="light">Clean Light</option>
      </select>

      <button class="btn btn-icon" onclick="document.getElementById('modal-help').classList.add('active')" title="Keyboard Shortcuts (?)">?</button>
    </div>
  </header>

  <!-- Main Workspace (3 columns) -->
  <div id="workspace">
    <!-- Left Panel: Node Palette -->
    <aside id="palette-panel">
      <div class="panel-header">
        <span>Node Library</span>
        <span style="font-size: 10px; color: var(--text-dim);">Space / Drag</span>
      </div>
      <div class="search-box">
        <input type="text" id="palette-search" placeholder="Search 35+ nodes...">
      </div>
      <div id="palette-items" class="palette-list"></div>
    </aside>

    <!-- Center Panel: Graph Canvas -->
    <section id="editor-area">
      <canvas id="graph-canvas-bg"></canvas>
      <div id="editor-plane">
        <svg id="wires-svg"></svg>
      </div>
      <div id="marquee-box"></div>

      <!-- Canvas Toolbar -->
      <div id="canvas-toolbar">
        <button class="btn btn-sm" onclick="editor.fitView()" title="Fit Graph (F)">Fit</button>
        <button class="btn btn-sm" onclick="state.zoom = Math.min(state.zoom * 1.2, 2.5); editor.updatePlaneTransform(); editor.drawBackgroundGrid(); editor.renderMinimap();">+</button>
        <button class="btn btn-sm" onclick="state.zoom = Math.max(state.zoom / 1.2, 0.2); editor.updatePlaneTransform(); editor.drawBackgroundGrid(); editor.renderMinimap();">-</button>
        <span id="zoom-val" style="font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); padding: 0 4px;">100%</span>
        <div style="height: 14px; width: 1px; background: var(--border); margin: 0 2px;"></div>
        <button class="btn btn-sm" id="btn-snap-grid" onclick="state.snapToGrid = !state.snapToGrid; this.classList.toggle('active', state.snapToGrid); showToast(state.snapToGrid ? 'Snap: On' : 'Snap: Off')" class="active" title="Toggle Grid Snap">Snap</button>
        <button class="btn btn-sm" onclick="editor.duplicateSelected()" title="Duplicate Selected (Ctrl+D)">Duplicate</button>
        <button class="btn btn-sm" style="color: var(--danger);" onclick="editor.deleteSelected()" title="Delete Selected (Del)">Del</button>
      </div>

      <!-- Minimap -->
      <div id="minimap-container">
        <canvas id="minimap-canvas"></canvas>
        <div id="minimap-viewport"></div>
      </div>

      <!-- Live HUD Overlay -->
      <div id="hud-overlay">
        <div class="hud-item"><span class="hud-label">FPS</span><span id="hud-fps" class="hud-val">60</span></div>
        <div class="hud-item"><span class="hud-label">Nodes / Wires</span><span class="hud-val"><span id="hud-nodes">0</span> / <span id="hud-edges">0</span></span></div>
        <div class="hud-item"><span class="hud-label">Compile</span><span id="hud-compile" class="hud-val">0.0ms</span></div>
        <div class="hud-item"><span class="hud-label">Status</span><span id="hud-status" class="hud-val">Valid</span></div>
        <div class="hud-item"><span class="hud-label">Selected</span><span id="hud-selected" class="hud-val">None</span></div>
        <div class="hud-item"><span class="hud-label">Sync</span><span id="hud-autosave" class="hud-val">Autosaved</span></div>
      </div>
    </section>

    <!-- Right Panel: Preview + Inspector -->
    <aside id="right-panel">
      <!-- Live Preview Viewport -->
      <div id="preview-container">
        <div class="preview-toolbar">
          <div class="preview-tools-group">
            <span style="font-weight: 700; color: var(--text-muted); font-size: 10px; text-transform: uppercase;">Preview</span>
            <div class="btn-group">
              <button class="btn btn-sm btn-channel active" data-mode="0" title="Full RGB">RGB</button>
              <button class="btn btn-sm btn-channel" data-mode="1" title="Red Channel">R</button>
              <button class="btn btn-sm btn-channel" data-mode="2" title="Green Channel">G</button>
              <button class="btn btn-sm btn-channel" data-mode="3" title="Blue Channel">B</button>
              <button class="btn btn-sm btn-channel" data-mode="4" title="Alpha Channel">A</button>
              <button class="btn btn-sm btn-channel" data-mode="5" title="Luminance">Lum</button>
              <button class="btn btn-sm btn-channel" data-mode="6" title="Normal Vector Visualizer">Norm</button>
              <button class="btn btn-sm btn-channel" data-mode="7" title="Value Range / Clipping Zebra">Zebra</button>
              <button class="btn btn-sm btn-channel" data-mode="8" title="NaN / Inf Detector">NaN</button>
            </div>
          </div>

          <div class="preview-tools-group">
            <button class="btn btn-sm" id="btn-toggle-tiling" title="Tiling Preview: 1x1, 2x2, 3x3">1x1</button>
            <button class="btn btn-sm active" id="btn-toggle-checker" title="Toggle Transparency Checkerboard">🏁</button>
            <button class="btn btn-sm" id="btn-freeze-ref" title="Freeze current frame for A-B wipe comparison">Freeze A/B</button>
          </div>
        </div>

        <div id="viewport-wrapper" class="checkerboard">
          <canvas id="preview-canvas" width="512" height="512"></canvas>
          <div id="ab-split-line">
            <div id="ab-split-handle">↔</div>
          </div>
          <div id="pixel-inspector-hud">
            <span>Hover preview to inspect pixel color and UV</span>
          </div>
        </div>
      </div>

      <!-- Property Inspector -->
      <div id="inspector-container">
        <div class="panel-header">
          <span>Property Inspector</span>
          <span style="font-size: 10px; color: var(--text-dim);">Live Parameters</span>
        </div>
        <div id="inspector-content"></div>
      </div>
    </aside>
  </div>

  <!-- Bottom Panel: Timeline & Animation -->
  <footer id="timeline-panel">
    <div class="timeline-toolbar">
      <div class="timeline-playback">
        <button class="btn btn-sm btn-icon" id="btn-rewind" title="Rewind to Frame 0">|◀</button>
        <button class="btn btn-sm btn-icon" id="btn-step-prev" title="Step Back 1 Frame">◀</button>
        <button class="btn btn-sm btn-icon btn-primary" id="btn-play" title="Play/Pause (Space)">⏸</button>
        <button class="btn btn-sm btn-icon" id="btn-step-next" title="Step Forward 1 Frame">▶</button>
        <button class="btn btn-sm" id="btn-loop" title="Loop Mode">↻ Loop</button>
      </div>

      <div class="timeline-info">
        <span style="color: var(--text-dim);">Frame:</span>
        <span id="timeline-time-info" style="color: var(--accent); font-weight: bold;">0 / 120 (0.00s)</span>
        
        <span style="color: var(--text-dim); margin-left: 8px;">FPS:</span>
        <select id="fps-select" class="dropdown" style="padding: 2px 6px; font-size: 11px;">
          <option value="24">24</option>
          <option value="30" selected>30</option>
          <option value="60">60</option>
        </select>
      </div>

      <div style="font-size: 11px; color: var(--text-dim);">
        <span>Keyframing: Click ◆ on inspector property to add keyframe</span>
      </div>
    </div>

    <div class="timeline-tracks-container">
      <div id="timeline-track-names" class="timeline-track-names"></div>
      <div id="timeline-track-lanes" class="timeline-track-lanes">
        <canvas id="timeline-canvas"></canvas>
        <div id="timeline-playhead"></div>
      </div>
    </div>
  </footer>

  <!-- Mobile Tab Bar (< 1024px) -->
  <nav id="mobile-tab-bar">
    <button class="mobile-tab-btn active" data-tab="graph">
      <span>🗂</span>
      <span>Graph</span>
    </button>
    <button class="mobile-tab-btn" data-tab="preview">
      <span>👁</span>
      <span>Preview</span>
    </button>
    <button class="mobile-tab-btn" data-tab="inspector">
      <span>⚙</span>
      <span>Inspector</span>
    </button>
    <button class="mobile-tab-btn" data-tab="timeline">
      <span>⏱</span>
      <span>Timeline</span>
    </button>
    <button class="mobile-tab-btn" data-tab="palette">
      <span>+</span>
      <span>Library</span>
    </button>
  </nav>

  <!-- Command Palette Modal -->
  <div id="cmd-palette-box">
    <input type="text" id="cmd-palette-input" placeholder="Type node name (e.g. noise, voronoi, math, sdf, blur)...">
    <div id="cmd-palette-results"></div>
  </div>

  <!-- Context Menu -->
  <div id="context-menu"></div>

  <!-- Export Dialog Modal -->
  <div class="modal-backdrop" id="modal-export">
    <div class="modal-box">
      <div class="modal-header">
        <span>Studio Export Hub</span>
        <button class="btn btn-icon modal-close">✕</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <h4 style="margin-bottom: 6px; color: var(--accent);">Export High-Res Image (PNG)</h4>
          <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">Renders the full procedural graph using GPU offscreen framebuffer.</p>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm" onclick="exportPNG(512, 512)">512 × 512</button>
            <button class="btn btn-sm btn-primary" onclick="exportPNG(1024, 1024)">1024 × 1024 (HD)</button>
            <button class="btn btn-sm" onclick="exportPNG(2048, 2048)">2048 × 2048 (2K)</button>
            <button class="btn btn-sm" onclick="exportPNG(4096, 4096)">4096 × 4096 (4K)</button>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border); padding-top: 12px;">
          <h4 style="margin-bottom: 6px; color: var(--accent);">Export Animation (WebM Video)</h4>
          <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">Captures timeline animation at 30 FPS into a downloadable WebM video file.</p>
          <button class="btn btn-sm btn-primary" onclick="exportWebMAnimation()">Record Timeline to WebM</button>
        </div>

        <div style="border-top: 1px solid var(--border); padding-top: 12px;">
          <h4 style="margin-bottom: 6px; color: var(--accent);">Project File & Code Export</h4>
          <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">Save complete project or export compiled standalone GLSL shader source.</p>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm" onclick="exportProjectJSON()">Download Project JSON</button>
            <button class="btn btn-sm" onclick="openGLSLModal()">View Compiled GLSL</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn modal-close">Close</button>
      </div>
    </div>
  </div>

  <!-- GLSL Export Modal -->
  <div class="modal-backdrop" id="modal-glsl">
    <div class="modal-box" style="width: 680px;">
      <div class="modal-header">
        <span>Compiled Standalone GLSL Shader</span>
        <button class="btn btn-icon modal-close">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">Directly compiled from your graph's topological DAG order.</p>
        <textarea id="glsl-export-code" style="width: 100%; height: 320px; font-family: var(--font-mono); font-size: 11px; background: var(--bg-input); color: #86efac; border: 1px solid var(--border); border-radius: 4px; padding: 8px; resize: vertical;"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('glsl-export-code').value); showToast('Copied GLSL to clipboard!')">Copy Code</button>
        <button class="btn btn-primary" onclick="const b = new Blob([document.getElementById('glsl-export-code').value], {type:'text/plain'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download='compiled_shader.frag'; a.click();">Download .frag</button>
        <button class="btn modal-close">Done</button>
      </div>
    </div>
  </div>

  <!-- Keyboard Shortcuts Modal -->
  <div class="modal-backdrop" id="modal-help">
    <div class="modal-box">
      <div class="modal-header">
        <span>Keyboard Shortcuts & Workflow</span>
        <button class="btn btn-icon modal-close">✕</button>
      </div>
      <div class="modal-body">
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">Space</td><td style="padding: 6px;">Play / Pause Timeline (or Open Command Palette on canvas)</td></tr>
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">Ctrl + K</td><td style="padding: 6px;">Open Node Command Palette</td></tr>
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">Ctrl + Z / Y</td><td style="padding: 6px;">Undo / Redo graph modifications</td></tr>
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">Ctrl + D</td><td style="padding: 6px;">Duplicate selected nodes</td></tr>
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">Del / Backspace</td><td style="padding: 6px;">Delete selected nodes / edges / frames</td></tr>
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">F</td><td style="padding: 6px;">Fit all nodes to viewport</td></tr>
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">G</td><td style="padding: 6px;">Group selected nodes into Frame</td></tr>
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">C</td><td style="padding: 6px;">Collapse / Expand selected node cards</td></tr>
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">H</td><td style="padding: 6px;">Toggle Live HUD diagnostics overlay</td></tr>
          <tr style="border-bottom: 1px solid var(--border);"><td style="padding: 6px; font-weight: bold; color: var(--accent);">Middle Drag / Alt+Drag</td><td style="padding: 6px;">Pan canvas workspace</td></tr>
          <tr><td style="padding: 6px; font-weight: bold; color: var(--accent);">Mouse Wheel</td><td style="padding: 6px;">Zoom in / out towards mouse pointer</td></tr>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn modal-close">Got it</button>
      </div>
    </div>
  </div>

  <!-- Hidden File Input for JSON Load -->
  <input type="file" id="project-file-input" style="display:none;" accept=".json">

  <!-- Toast Container -->
  <div id="toast-container"></div>
</div>
"""
