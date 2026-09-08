def get_css():
    return """
:root {
  --bg-darker: #0d1117;
  --bg-dark: #161b22;
  --bg-panel: #21262d;
  --bg-card: #282e38;
  --bg-input: #1a1f28;
  --bg-hover: #30363d;
  --border: #30363d;
  --border-focus: #58a6ff;
  --text-main: #f0f6fc;
  --text-muted: #8b949e;
  --text-dim: #6e7681;
  --accent: #38bdf8;
  --accent-hover: #0284c7;
  --accent-glow: rgba(56, 189, 248, 0.25);
  --danger: #f85149;
  --warning: #d29922;
  --success: #3fb950;
  --port-float: #38bdf8;
  --port-vec2: #4ade80;
  --port-vec3: #facc15;
  --port-vec4: #f472b6;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --panel-radius: 8px;
  --shadow-popup: 0 12px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
}

[data-theme="cyberpunk"] {
  --bg-darker: #080612;
  --bg-dark: #110c22;
  --bg-panel: #1b1338;
  --bg-card: #271a52;
  --bg-input: #150e2d;
  --bg-hover: #3b2575;
  --border: #ff007f;
  --border-focus: #00f0ff;
  --text-main: #f3f0ff;
  --text-muted: #a699cc;
  --accent: #00f0ff;
  --accent-hover: #00bcd4;
  --accent-glow: rgba(0, 240, 255, 0.35);
  --port-float: #00f0ff;
  --port-vec2: #00ff66;
  --port-vec3: #ffee00;
  --port-vec4: #ff007f;
}

[data-theme="monokai"] {
  --bg-darker: #19181a;
  --bg-dark: #221f22;
  --bg-panel: #2d2a2e;
  --bg-card: #373338;
  --bg-input: #1e1c1f;
  --bg-hover: #403e41;
  --border: #4a474c;
  --border-focus: #ffd866;
  --text-main: #fcfcfa;
  --text-muted: #939293;
  --accent: #a9dc76;
  --accent-hover: #8fc75c;
  --accent-glow: rgba(169, 220, 118, 0.25);
  --port-float: #78dce8;
  --port-vec2: #a9dc76;
  --port-vec3: #ffd866;
  --port-vec4: #ff6188;
}

[data-theme="light"] {
  --bg-darker: #e8ecf2;
  --bg-dark: #f3f6f9;
  --bg-panel: #ffffff;
  --bg-card: #f8fafc;
  --bg-input: #ffffff;
  --bg-hover: #e2e8f0;
  --border: #cbd5e1;
  --border-focus: #0284c7;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --text-dim: #94a3b8;
  --accent: #0284c7;
  --accent-hover: #0369a1;
  --accent-glow: rgba(2, 132, 199, 0.15);
  --port-float: #0284c7;
  --port-vec2: #16a34a;
  --port-vec3: #ca8a04;
  --port-vec4: #db2777;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-user-select: none;
  user-select: none;
}

body, html {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-darker);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.4;
}

input, button, select, textarea {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  outline: none;
  -webkit-user-select: auto;
  user-select: auto;
}

#app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* Header */
header#top-bar {
  height: 44px;
  background: var(--bg-dark);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  z-index: 100;
  flex-shrink: 0;
  gap: 8px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-main);
  letter-spacing: -0.2px;
}

.brand-badge {
  background: linear-gradient(135deg, var(--accent), #818cf8);
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 800;
  text-transform: uppercase;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-group {
  display: flex;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.btn {
  background: var(--bg-panel);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn:hover {
  background: var(--bg-hover);
  border-color: var(--text-muted);
}

.btn:active {
  transform: translateY(1px);
}

.btn-primary {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: 600;
}

.btn-primary:hover {
  background: var(--accent-hover);
  color: #fff;
}

.btn-sm {
  padding: 3px 8px;
  font-size: 11px;
}

.btn-icon {
  padding: 5px;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  justify-content: center;
}

.btn-group .btn {
  border: none;
  border-radius: 0;
  border-right: 1px solid var(--border);
}

.btn-group .btn:last-child {
  border-right: none;
}

.btn-group .btn.active {
  background: var(--accent);
  color: #000;
  font-weight: 600;
}

select.dropdown {
  background: var(--bg-panel);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

select.dropdown:focus {
  border-color: var(--border-focus);
}

/* Main Workspace */
#workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* Left Sidebar: Node Library / Palette */
#palette-panel {
  width: 240px;
  background: var(--bg-dark);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s ease;
  z-index: 20;
}

#palette-panel.collapsed {
  width: 0;
  overflow: hidden;
  border-right: none;
}

.panel-header {
  height: 36px;
  padding: 0 10px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.search-box {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.search-box input {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 5px 8px;
  color: var(--text-main);
  font-size: 12px;
}

.search-box input:focus {
  border-color: var(--border-focus);
}

.palette-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.palette-category {
  margin-bottom: 8px;
}

.category-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim);
  text-transform: uppercase;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.category-title:hover {
  color: var(--text-muted);
}

.palette-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  margin-bottom: 2px;
  font-size: 12px;
  transition: background 0.12s;
}

.palette-item:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.palette-item .item-type {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--bg-input);
  color: var(--text-muted);
}

/* Center Graph Editor Canvas */
#editor-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--bg-darker);
  cursor: grab;
}

#editor-area:active {
  cursor: grabbing;
}

#graph-canvas-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

#editor-plane {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}

/* Wires SVG Layer */
#wires-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 10000px;
  height: 10000px;
  pointer-events: none;
  overflow: visible;
  z-index: 5;
}

.wire-path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.5;
  stroke-linecap: round;
  pointer-events: stroke;
  cursor: pointer;
  transition: stroke 0.15s, stroke-width 0.15s;
}

.wire-path:hover {
  stroke-width: 4.5;
  stroke: #fff;
  filter: drop-shadow(0 0 6px var(--accent));
}

.wire-path.selected {
  stroke: #ff5577;
  stroke-width: 4;
}

.wire-path.wire-float { stroke: var(--port-float); }
.wire-path.wire-vec2 { stroke: var(--port-vec2); }
.wire-path.wire-vec3 { stroke: var(--port-vec3); }
.wire-path.wire-vec4 { stroke: var(--port-vec4); }

.wire-preview {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.5;
  stroke-dasharray: 6 4;
  pointer-events: none;
  animation: wireDash 0.8s linear infinite;
}

@keyframes wireDash {
  to { stroke-dashoffset: -20; }
}

/* Frames / Groups */
.node-frame {
  position: absolute;
  border: 1px dashed rgba(255,255,255,0.25);
  border-radius: 8px;
  background: rgba(40, 50, 70, 0.15);
  z-index: 2;
  box-sizing: border-box;
  pointer-events: auto;
}

.node-frame.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.frame-header {
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  cursor: grab;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.05);
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
}

/* Node Cards */
.node-card {
  position: absolute;
  width: 200px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--panel-radius);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  z-index: 10;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.node-card:hover {
  border-color: var(--text-dim);
}

.node-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow), 0 8px 24px rgba(0,0,0,0.6);
  z-index: 15;
}

.node-card.dirty {
  border-left: 3px solid var(--warning);
}

.node-card.error {
  border-color: var(--danger) !important;
  box-shadow: 0 0 0 2px rgba(248, 81, 73, 0.4);
}

.node-header {
  height: 30px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  border-top-left-radius: calc(var(--panel-radius) - 1px);
  border-top-right-radius: calc(var(--panel-radius) - 1px);
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: grab;
}

.node-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.node-title {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-category-tag {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.node-controls-top {
  display: flex;
  align-items: center;
  gap: 4px;
}

.node-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  font-size: 11px;
  border-radius: 3px;
}

.node-icon-btn:hover {
  color: var(--text-main);
  background: var(--bg-hover);
}

/* Node Body & Ports */
.node-body {
  padding: 6px 0;
  display: flex;
  justify-content: space-between;
  position: relative;
}

.ports-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ports-left {
  align-items: flex-start;
  padding-left: 0;
}

.ports-right {
  align-items: flex-end;
  padding-right: 0;
  margin-left: auto;
}

.port-row {
  display: flex;
  align-items: center;
  height: 20px;
  position: relative;
}

.port-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid var(--bg-card);
  cursor: crosshair;
  transition: transform 0.15s, box-shadow 0.15s;
  z-index: 12;
  position: relative;
}

.port-dot:hover {
  transform: scale(1.4);
  box-shadow: 0 0 8px currentColor;
}

.port-dot.connected {
  border-color: #fff;
}

.ports-left .port-dot {
  margin-left: -6px;
  margin-right: 6px;
}

.ports-right .port-dot {
  margin-right: -6px;
  margin-left: 6px;
}

.port-label {
  font-size: 11px;
  color: var(--text-muted);
  pointer-events: none;
}

.port-float { background: var(--port-float); color: var(--port-float); }
.port-vec2 { background: var(--port-vec2); color: var(--port-vec2); }
.port-vec3 { background: var(--port-vec3); color: var(--port-vec3); }
.port-vec4 { background: var(--port-vec4); color: var(--port-vec4); }

/* Comment Node */
.node-card.comment-node {
  background: rgba(45, 55, 72, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
  min-height: 80px;
}

.node-card.comment-node textarea {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  color: #e2e8f0;
  padding: 8px;
  resize: both;
  font-size: 12px;
}

/* Rubberband Marquee Selection */
#marquee-box {
  position: absolute;
  border: 1px solid var(--accent);
  background: var(--accent-glow);
  pointer-events: none;
  display: none;
  z-index: 30;
}

/* Minimap */
#minimap-container {
  position: absolute;
  bottom: 12px;
  left: 12px;
  width: 180px;
  height: 120px;
  background: rgba(22, 27, 34, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: var(--shadow-popup);
  z-index: 40;
}

#minimap-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

#minimap-viewport {
  position: absolute;
  border: 1px solid var(--accent);
  background: rgba(56, 189, 248, 0.1);
  pointer-events: none;
}

/* Canvas Toolbar */
#canvas-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(22, 27, 34, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  z-index: 40;
  box-shadow: var(--shadow-popup);
}

/* Right Panel: Preview + Inspector */
#right-panel {
  width: 380px;
  background: var(--bg-dark);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 20;
}

/* Live Preview Viewport */
#preview-container {
  height: 380px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  background: #000;
  position: relative;
  overflow: hidden;
}

.preview-toolbar {
  height: 32px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  z-index: 10;
  flex-shrink: 0;
}

.preview-tools-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

#viewport-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #111;
}

#viewport-wrapper.checkerboard {
  background-image: linear-gradient(45deg, #1c1c1c 25%, transparent 25%),
                    linear-gradient(-45deg, #1c1c1c 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #1c1c1c 75%),
                    linear-gradient(-45deg, transparent 75%, #1c1c1c 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}

#preview-canvas {
  box-shadow: 0 4px 20px rgba(0,0,0,0.8);
  image-rendering: pixelated;
  cursor: crosshair;
}

/* A-B Comparison Split Line */
#ab-split-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  cursor: ew-resize;
  display: none;
  z-index: 25;
}

#ab-split-handle {
  position: absolute;
  top: 50%;
  left: -12px;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--accent);
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  box-shadow: 0 2px 6px rgba(0,0,0,0.5);
}

/* Pixel Inspector HUD */
#pixel-inspector-hud {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(15, 20, 25, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  z-index: 30;
}

.pixel-color-chip {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.3);
  display: inline-block;
}

/* Property Inspector Panel */
#inspector-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-dark);
}

#inspector-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.inspector-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.node-prop-group {
  margin-bottom: 12px;
}

.prop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.prop-label {
  font-size: 12px;
  color: var(--text-muted);
  width: 90px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.prop-keyframe-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 2px;
  font-size: 10px;
  border-radius: 3px;
}

.prop-keyframe-btn.active {
  color: var(--warning);
  text-shadow: 0 0 6px var(--warning);
}

.prop-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.range-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: var(--bg-input);
  border-radius: 2px;
  outline: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
  transition: transform 0.1s;
}

.range-slider::-webkit-slider-thumb:hover {
  transform: scale(1.3);
}

.num-input {
  width: 54px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-main);
  padding: 3px 5px;
  font-family: var(--font-mono);
  font-size: 11px;
  text-align: right;
}

.num-input:focus {
  border-color: var(--border-focus);
}

.color-swatch-input {
  width: 32px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
}

/* Color Ramp Editor */
.color-ramp-editor {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  margin-top: 6px;
}

.ramp-bar-wrap {
  position: relative;
  height: 24px;
  margin-bottom: 12px;
  cursor: pointer;
}

.ramp-gradient-bar {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.2);
}

.ramp-stop-marker {
  position: absolute;
  top: 100%;
  width: 12px;
  height: 14px;
  transform: translateX(-50%);
  cursor: ew-resize;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ramp-stop-triangle {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 6px solid #fff;
}

.ramp-stop-box {
  width: 10px;
  height: 8px;
  border: 1px solid #fff;
  border-radius: 2px;
}

.ramp-stop-marker.selected .ramp-stop-box {
  box-shadow: 0 0 6px var(--accent);
  border-color: var(--accent);
}

/* Bottom Panel: Timeline & Animation */
#timeline-panel {
  height: 140px;
  background: var(--bg-dark);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 30;
}

#timeline-panel.collapsed {
  height: 32px;
}

.timeline-toolbar {
  height: 32px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.timeline-playback {
  display: flex;
  align-items: center;
  gap: 6px;
}

.timeline-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.timeline-tracks-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.timeline-track-names {
  width: 140px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  flex-shrink: 0;
}

.timeline-track-name-row {
  height: 24px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--text-muted);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-track-lanes {
  flex: 1;
  overflow-x: auto;
  position: relative;
  background: var(--bg-darker);
}

#timeline-canvas {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
}

#timeline-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--danger);
  z-index: 10;
  pointer-events: none;
}

#timeline-playhead::after {
  content: "";
  position: absolute;
  top: 0;
  left: -4px;
  width: 10px;
  height: 10px;
  background: var(--danger);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}

/* Diagnostics & Live HUD */
#hud-overlay {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(15, 20, 25, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-main);
  box-shadow: var(--shadow-popup);
  pointer-events: none;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hud-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hud-label {
  color: var(--text-dim);
}

.hud-val {
  font-weight: 600;
  color: var(--accent);
}

/* Modals */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: none;
  align-items: center;
  justify-content: center;
}

.modal-backdrop.active {
  display: flex;
}

.modal-box {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--panel-radius);
  box-shadow: var(--shadow-popup);
  width: 540px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalPop 0.15s ease-out;
}

@keyframes modalPop {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 14px;
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

/* Command Palette */
#cmd-palette-box {
  width: 480px;
  background: var(--bg-panel);
  border: 1px solid var(--border-focus);
  box-shadow: var(--shadow-popup);
  border-radius: var(--panel-radius);
  overflow: hidden;
  position: fixed;
  top: 15%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  display: none;
}

#cmd-palette-box.active {
  display: block;
}

#cmd-palette-input {
  width: 100%;
  background: var(--bg-input);
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text-main);
}

#cmd-palette-results {
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
}

.cmd-item {
  padding: 8px 12px;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cmd-item:hover, .cmd-item.selected {
  background: var(--accent);
  color: #000;
}

.cmd-item.selected .cmd-cat {
  color: #1a1f28;
}

.cmd-cat {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-dim);
}

/* Context Menu */
#context-menu {
  position: fixed;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow-popup);
  padding: 4px;
  z-index: 1000;
  display: none;
  min-width: 150px;
}

.ctx-item {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ctx-item:hover {
  background: var(--accent);
  color: #000;
}

.ctx-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

/* Toasts */
#toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 2000;
  pointer-events: none;
}

.toast {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow-popup);
  padding: 10px 16px;
  color: var(--text-main);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: toastIn 0.2s ease-out;
  pointer-events: auto;
}

.toast.toast-error {
  border-color: var(--danger);
  border-left: 4px solid var(--danger);
}

.toast.toast-success {
  border-color: var(--success);
  border-left: 4px solid var(--success);
}

@keyframes toastIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Mobile Tab Bar (< 1024px) */
#mobile-tab-bar {
  display: none;
  height: 48px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 100;
}

.mobile-tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  gap: 2px;
  cursor: pointer;
}

.mobile-tab-btn.active {
  color: var(--accent);
}

@media (max-width: 1024px) {
  #mobile-tab-bar {
    display: flex;
  }
  
  #palette-panel {
    display: none;
  }
  
  #right-panel {
    display: none;
    width: 100%;
  }

  #timeline-panel {
    display: none;
  }

  body.mobile-view-palette #editor-area,
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
  }
}

@media (max-width: 600px) {
  header#top-bar {
    padding: 0 6px;
    gap: 4px;
  }
  .brand span:not(.brand-badge) {
    display: none;
  }
  #preset-select {
    min-width: 110px !important;
    max-width: 130px !important;
  }
  .timeline-toolbar {
    padding: 0 6px;
    gap: 4px;
    overflow-x: auto;
    white-space: nowrap;
  }
  .timeline-toolbar > * {
    flex-shrink: 0;
  }
}
"""
