import os

html_content = r'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Real-Time 2D Fluid Simulation</title>
  <style>
    :root {
      --bg-dark: #06080e;
      --panel-bg: rgba(13, 17, 26, 0.88);
      --panel-border: rgba(255, 255, 255, 0.12);
      --panel-border-glow: rgba(56, 189, 248, 0.35);
      --accent: #38bdf8;
      --accent-hover: #0ea5e9;
      --accent-glow: rgba(56, 189, 248, 0.3);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --danger: #f43f5e;
      --danger-hover: #e11d48;
      --success: #10b981;
      --warning: #f59e0b;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--bg-dark);
      font-family: var(--font-sans);
      color: var(--text-main);
      font-size: 13px;
    }

    #gl-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      display: block;
      touch-action: none;
      cursor: crosshair;
      z-index: 1;
    }

    /* Top Bar Header */
    .top-bar {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
      z-index: 10;
      gap: 12px;
    }

    .brand-hud {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 7px 14px;
      pointer-events: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .brand-hud .logo-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 10px var(--accent);
      animation: pulse-dot 2.5s infinite ease-in-out;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    .brand-hud h1 {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #fff;
      text-transform: uppercase;
    }

    .brand-hud span.badge {
      font-family: var(--font-mono);
      font-size: 10px;
      padding: 2px 6px;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: var(--accent);
      border-radius: 4px;
    }

    .quick-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      pointer-events: auto;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--panel-border);
      color: var(--text-main);
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      outline: none;
    }

    .btn:hover {
      background: rgba(30, 41, 59, 0.9);
      border-color: rgba(255, 255, 255, 0.25);
      transform: translateY(-1px);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn-primary {
      background: rgba(56, 189, 248, 0.18);
      border-color: rgba(56, 189, 248, 0.5);
      color: #bae6fd;
    }

    .btn-primary:hover {
      background: rgba(56, 189, 248, 0.3);
      border-color: var(--accent);
      color: #fff;
    }

    .btn-danger {
      background: rgba(244, 63, 94, 0.15);
      border-color: rgba(244, 63, 94, 0.4);
      color: #fecdd3;
    }

    .btn-danger:hover {
      background: rgba(244, 63, 94, 0.28);
      border-color: var(--danger);
      color: #fff;
    }

    .btn-active {
      background: var(--accent) !important;
      border-color: var(--accent) !important;
      color: #04131f !important;
      font-weight: 600 !important;
      box-shadow: 0 0 14px var(--accent-glow) !important;
    }

    .key-badge {
      font-family: var(--font-mono);
      font-size: 9px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 3px;
      padding: 1px 4px;
      color: var(--text-muted);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Live Performance HUD (Top Right) */
    .perf-overlay {
      position: absolute;
      top: 56px;
      right: 12px;
      width: 220px;
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 10px 12px;
      z-index: 10;
      pointer-events: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
      font-family: var(--font-mono);
      font-size: 11px;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .perf-overlay.hidden {
      opacity: 0;
      transform: translateY(-8px);
      pointer-events: none;
    }

    .perf-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .perf-row:last-child {
      border-bottom: none;
    }

    .perf-label {
      color: var(--text-muted);
    }

    .perf-val {
      color: #fff;
      font-weight: 600;
    }

    .perf-val.active-state {
      color: var(--success);
    }

    .perf-val.paused-state {
      color: var(--warning);
    }

    /* Visualization Mode Selector Ribbon */
    .mode-bar {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 6px;
      display: flex;
      gap: 6px;
      z-index: 10;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55);
      max-width: calc(100vw - 24px);
      overflow-x: auto;
      white-space: nowrap;
    }

    .mode-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .mode-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }

    .mode-btn.active {
      background: rgba(56, 189, 248, 0.2);
      border-color: rgba(56, 189, 248, 0.4);
      color: var(--accent);
      font-weight: 600;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);
    }

    /* Side Control Drawer */
    .control-drawer {
      position: absolute;
      top: 56px;
      left: 12px;
      bottom: 74px;
      width: 320px;
      background: var(--panel-bg);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      z-index: 10;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
    }

    .control-drawer.collapsed {
      transform: translateX(-340px);
      opacity: 0;
      pointer-events: none;
    }

    .drawer-header {
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--panel-border);
    }

    .drawer-header h2 {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #fff;
    }

    .drawer-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .drawer-scroll::-webkit-scrollbar {
      width: 5px;
    }

    .drawer-scroll::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-title::after {
      content: "";
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 10px;
    }

    .control-group:last-child {
      margin-bottom: 0;
    }

    .control-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .control-label {
      font-size: 12px;
      color: var(--text-main);
      font-weight: 500;
    }

    .control-val {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--accent);
      background: rgba(56, 189, 248, 0.1);
      padding: 1px 5px;
      border-radius: 4px;
    }

    .control-desc {
      font-size: 10px;
      color: var(--text-muted);
      line-height: 1.3;
    }

    input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 5px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.15);
      outline: none;
      cursor: pointer;
      margin: 4px 0;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      box-shadow: 0 0 6px var(--accent);
      transition: transform 0.1s ease;
    }

    input[type="range"]::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    select {
      width: 100%;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      color: var(--text-main);
      padding: 7px 10px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }

    select:focus {
      border-color: var(--accent);
    }

    .color-picker-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    input[type="color"] {
      -webkit-appearance: none;
      border: 1px solid var(--panel-border);
      width: 36px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      background: transparent;
      padding: 0;
    }

    input[type="color"]::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    input[type="color"]::-webkit-color-swatch {
      border: none;
      border-radius: 5px;
    }

    /* Mode Legend Overlay */
    .legend-overlay {
      position: absolute;
      bottom: 74px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--panel-bg);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 10;
      font-size: 11px;
      font-family: var(--font-mono);
      color: var(--text-muted);
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .legend-bar {
      width: 120px;
      height: 8px;
      border-radius: 4px;
    }

    /* Interactive hint badge */
    .interaction-hint {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(14, 17, 24, 0.85);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 16px 28px;
      text-align: center;
      z-index: 5;
      pointer-events: none;
      transition: opacity 0.6s ease;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.65);
    }

    .interaction-hint.fade-out {
      opacity: 0;
    }

    .interaction-hint h3 {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
    }

    .interaction-hint p {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Responsive styles for mobile (e.g. 390x844) */
    @media (max-width: 768px) {
      .top-bar {
        top: 8px;
        left: 8px;
        right: 8px;
        gap: 6px;
      }

      .brand-hud {
        padding: 5px 8px;
      }

      .brand-hud h1 {
        font-size: 11px;
      }

      .brand-hud span.badge {
        display: none;
      }

      .quick-actions {
        gap: 4px;
        flex-wrap: nowrap;
        overflow-x: auto;
      }

      .btn {
        padding: 5px 8px;
        font-size: 11px;
        gap: 4px;
        white-space: nowrap;
      }

      .perf-overlay {
        top: 46px;
        right: 8px;
        width: 155px;
        font-size: 10px;
        padding: 6px 8px;
      }

      .control-drawer {
        top: 48px;
        left: 8px;
        right: 8px;
        bottom: 60px;
        width: auto;
        z-index: 50;
      }

      .control-drawer.collapsed {
        transform: translateY(120%);
        opacity: 0;
        pointer-events: none !important;
      }

      .mode-bar {
        bottom: 8px;
        padding: 4px;
        gap: 4px;
        max-width: calc(100vw - 16px);
      }

      .mode-btn {
        padding: 5px 8px;
        font-size: 11px;
      }

      .key-badge {
        display: none;
      }

      .legend-overlay {
        bottom: 54px;
      }
    }
  </style>
</head>
<body>
  <!-- Fullscreen WebGL Canvas -->
  <canvas id="gl-canvas"></canvas>

  <!-- Top Navigation / Header HUD -->
  <div class="top-bar">
    <div class="brand-hud">
      <div class="logo-dot"></div>
      <h1>Fluid 2D</h1>
      <span class="badge" id="gpu-badge">WebGL2</span>
    </div>

    <div class="quick-actions">
      <button class="btn btn-primary" id="btn-toggle-drawer" title="Toggle Controls [H]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
        <span>Controls</span>
        <span class="key-badge">H</span>
      </button>

      <button class="btn" id="btn-pause" title="Pause / Resume [Space]">
        <svg id="pause-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        <span id="pause-text">Pause</span>
        <span class="key-badge">Space</span>
      </button>

      <button class="btn btn-danger" id="btn-clear-dye" title="Clear Dye (Preserves Velocity Currents) [C]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
        <span>Clear Dye</span>
        <span class="key-badge">C</span>
      </button>

      <button class="btn" id="btn-reset" title="Reset Simulation [R]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        <span>Reset</span>
        <span class="key-badge">R</span>
      </button>

      <button class="btn" id="btn-toggle-hud" title="Toggle HUD Overlay">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span>HUD</span>
      </button>
    </div>
  </div>

  <!-- Performance & Diagnostics HUD Overlay -->
  <div class="perf-overlay" id="perf-overlay">
    <div class="perf-row">
      <span class="perf-label">Status:</span>
      <span class="perf-val active-state" id="hud-status">RUNNING</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Frame Rate:</span>
      <span class="perf-val" id="hud-fps">60 FPS</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Frame Time:</span>
      <span class="perf-val" id="hud-frametime">16.6 ms</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Sim Grid:</span>
      <span class="perf-val" id="hud-resolution">256 × 256</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Pressure Iters:</span>
      <span class="perf-val" id="hud-iters">25</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Viscosity:</span>
      <span class="perf-val" id="hud-visc">0.0010</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Vorticity:</span>
      <span class="perf-val" id="hud-vort">25.0</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">View Mode:</span>
      <span class="perf-val" id="hud-mode">Rendered Dye</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Pointer Speed:</span>
      <span class="perf-val" id="hud-speed">0 px/s</span>
    </div>
  </div>

  <!-- Floating Settings Drawer -->
  <div class="control-drawer" id="control-drawer">
    <div class="drawer-header">
      <h2>Simulation Controls</h2>
      <button class="btn" id="btn-close-drawer" style="padding: 4px 8px; font-size: 11px;">✕</button>
    </div>

    <div class="drawer-scroll">
      <!-- Preset Selection -->
      <div>
        <div class="section-title">Scenario Presets</div>
        <div class="control-group">
          <select id="select-preset">
            <option value="cosmic">Cosmic Aurora (Luminous Jets)</option>
            <option value="turbulent">Turbulent Smoke (High Vorticity)</option>
            <option value="viscous">Viscous Slime / Honey (High Viscosity)</option>
            <option value="superfluid">Quantum Superfluid (Zero Viscosity)</option>
            <option value="ink">Ink Droplet in Water</option>
            <option value="vortex_pair">Colliding Vortex Rings</option>
          </select>
        </div>
      </div>

      <!-- Physics & Numerical Parameters -->
      <div>
        <div class="section-title">Fluid Physics</div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-resolution">Grid Resolution</label>
            <span class="control-val" id="val-resolution">256</span>
          </div>
          <select id="param-resolution">
            <option value="128">128 × 128 (Ultra Fast)</option>
            <option value="256" selected>256 × 256 (Balanced)</option>
            <option value="512">512 × 512 (High Quality)</option>
            <option value="1024">1024 × 1024 (Ultra Crisp)</option>
          </select>
          <div class="control-desc">Grid density for Eulerian Navier-Stokes solver</div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-timestep">Timestep / Speed</label>
            <span class="control-val" id="val-timestep">1.0×</span>
          </div>
          <input type="range" id="param-timestep" min="0.1" max="2.5" step="0.05" value="1.0">
          <div class="control-desc">Simulation delta-time integration rate</div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-viscosity">Kinematic Viscosity</label>
            <span class="control-val" id="val-viscosity">0.0010</span>
          </div>
          <input type="range" id="param-viscosity" min="0.0" max="0.03" step="0.0005" value="0.0010">
          <div class="control-desc">Fluid thickness and diffusion of velocity</div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-pressure">Pressure Iterations</label>
            <span class="control-val" id="val-pressure">25</span>
          </div>
          <input type="range" id="param-pressure" min="5" max="60" step="1" value="25">
          <div class="control-desc">Jacobi relaxation steps for incompressibility</div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-vorticity">Vorticity Confinement</label>
            <span class="control-val" id="val-vorticity">25</span>
          </div>
          <input type="range" id="param-vorticity" min="0" max="60" step="1" value="25">
          <div class="control-desc">Amplifies small-scale turbulent eddies and swirls</div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-vel-dissip">Velocity Dissipation</label>
            <span class="control-val" id="val-vel-dissip">0.012</span>
          </div>
          <input type="range" id="param-vel-dissip" min="0.000" max="0.08" step="0.002" value="0.012">
          <div class="control-desc">Rate at which fluid momentum slows down</div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-dye-dissip">Dye Dissipation</label>
            <span class="control-val" id="val-dye-dissip">0.006</span>
          </div>
          <input type="range" id="param-dye-dissip" min="0.000" max="0.05" step="0.001" value="0.006">
          <div class="control-desc">Rate at which colored dye fades over time</div>
        </div>
      </div>

      <!-- Interaction & Splatting -->
      <div>
        <div class="section-title">Pointer Interaction</div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-force">Interaction Force</label>
            <span class="control-val" id="val-force">1200</span>
          </div>
          <input type="range" id="param-force" min="200" max="4000" step="50" value="1200">
          <div class="control-desc">Momentum injected per cursor drag stroke</div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-radius">Interaction Radius</label>
            <span class="control-val" id="val-radius">2.0%</span>
          </div>
          <input type="range" id="param-radius" min="0.5" max="6.0" step="0.1" value="2.0">
          <div class="control-desc">Gaussian splat radius for force and dye</div>
        </div>

        <div class="control-group">
          <label class="control-label" for="select-color-mode">Dye Color Mode</label>
          <select id="select-color-mode">
            <option value="rainbow">Rainbow Cycling (Dynamic)</option>
            <option value="cyberpunk">Cyberpunk Neon (Cyan / Pink)</option>
            <option value="ocean">Electric Ocean (Teal / Blue)</option>
            <option value="fire">Solar Fire (Gold / Red)</option>
            <option value="aurora">Aurora Borealis (Green / Violet)</option>
            <option value="custom">Custom Color Picker</option>
          </select>
        </div>

        <div class="control-group" id="custom-color-row" style="display: none;">
          <div class="control-header">
            <label class="control-label" for="input-custom-color">Custom Dye Hue</label>
          </div>
          <div class="color-picker-row">
            <input type="color" id="input-custom-color" value="#38bdf8">
            <span class="control-desc">Injects pure selected color</span>
          </div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="check-auto-emit">Gentle Ambient Emitters</label>
            <input type="checkbox" id="check-auto-emit" style="cursor: pointer;">
          </div>
          <div class="control-desc">Feeds soft background swirling currents</div>
        </div>
      </div>

      <!-- Shading & Visual FX -->
      <div>
        <div class="section-title">Rendering & Shading</div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="check-specular">Liquid Gloss Sheen</label>
            <input type="checkbox" id="check-specular" checked style="cursor: pointer;">
          </div>
          <div class="control-desc">Smooth surface reflection on dense dye regions</div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label class="control-label" for="param-exposure">Dye Vibrancy Gain</label>
            <span class="control-val" id="val-exposure">1.4×</span>
          </div>
          <input type="range" id="param-exposure" min="0.5" max="2.5" step="0.05" value="1.4">
          <div class="control-desc">Dynamic range gain and color saturation</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bottom Mode Selector Ribbon -->
  <div class="mode-bar">
    <button class="mode-btn active" data-mode="0" title="Rendered Dye [1]">
      <span class="key-badge">1</span>
      <span>Dye Field</span>
    </button>
    <button class="mode-btn" data-mode="1" title="Velocity Magnitude [2]">
      <span class="key-badge">2</span>
      <span>Speed Heatmap</span>
    </button>
    <button class="mode-btn" data-mode="2" title="Velocity Direction [3]">
      <span class="key-badge">3</span>
      <span>Flow Direction</span>
    </button>
    <button class="mode-btn" data-mode="3" title="Pressure Field [4]">
      <span class="key-badge">4</span>
      <span>Pressure</span>
    </button>
    <button class="mode-btn" data-mode="4" title="Vorticity / Curl [5]">
      <span class="key-badge">5</span>
      <span>Vorticity</span>
    </button>
    <button class="mode-btn" data-mode="5" title="Divergence Diagnostic [6]">
      <span class="key-badge">6</span>
      <span>Divergence</span>
    </button>
    <button class="mode-btn" data-mode="6" title="Streamlines Flow [7]">
      <span class="key-badge">7</span>
      <span>Streamlines</span>
    </button>
  </div>

  <!-- Diagnostic Legend Overlay -->
  <div class="legend-overlay" id="legend-overlay" style="display: none;">
    <span id="legend-min">-1.0</span>
    <div class="legend-bar" id="legend-gradient"></div>
    <span id="legend-max">+1.0</span>
  </div>

  <!-- First-time User Interaction Hint -->
  <div class="interaction-hint" id="interaction-hint">
    <h3>Interactive Fluid Simulation</h3>
    <p>Click or touch and drag across the screen to inject fluid momentum &amp; vibrant dye</p>
  </div>

  <!-- Main Self-Contained JavaScript Simulation Pipeline -->
  <script>
    (function () {
      'use strict';

      // --- Simulation Parameters & Application State ---
      const state = {
        resolution: 256,
        timestep: 1.0,
        viscosity: 0.0010,
        pressureIters: 25,
        vorticity: 25.0,
        velDissipation: 0.012,
        dyeDissipation: 0.006,
        force: 1200.0,
        radius: 0.020,
        colorMode: 'rainbow',
        customColor: [0.22, 0.74, 0.97],
        autoEmit: false,
        specular: true,
        exposure: 1.4,
        mode: 0, // 0: Dye, 1: Vel Mag, 2: Vel Dir, 3: Pressure, 4: Vorticity, 5: Divergence, 6: Streamlines
        paused: false,
        fps: 60,
        frameTime: 16.6,
        pointerSpeed: 0,
        activePointers: new Map(),
        rainbowHue: 0,
        simTime: 0
      };

      const canvas = document.getElementById('gl-canvas');
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });

      if (!gl) {
        alert('WebGL 2.0 is required but not supported on this browser/device.');
        return;
      }

      // Query essential float rendering extensions
      gl.getExtension('EXT_color_buffer_float');
      const extLinear = gl.getExtension('OES_texture_float_linear');

      // Half-float type
      const halfFloatType = gl.HALF_FLOAT;

      // Fullscreen quad buffer
      const quadVAO = gl.createVertexArray();
      gl.bindVertexArray(quadVAO);
      const quadVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
      ]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      // --- GLSL Shader Compiler Utility ---
      function createShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source.trim());
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const info = gl.getShaderInfoLog(shader);
          console.error('Shader compile failed:\n' + info + '\nSource:\n' + source);
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      }

      function createProgram(vertSrc, fragSrc) {
        const vs = createShader(gl.VERTEX_SHADER, vertSrc);
        const fs = createShader(gl.FRAGMENT_SHADER, fragSrc);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          console.error('Program link failed:', gl.getProgramInfoLog(prog));
          return null;
        }
        return prog;
      }

      const commonVertexShader = `#version 300 es
        layout(location = 0) in vec2 a_position;
        out vec2 v_uv;
        void main() {
          v_uv = a_position * 0.5 + 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      // --- Shaders for Navier-Stokes Stages ---

      // 1. Clear Shader
      const clearShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        out vec4 fragColor;
        uniform vec4 u_value;
        void main() {
          fragColor = u_value;
        }
      `);

      // 2. Advection Shader (Semi-Lagrangian)
      const advectionShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;
        uniform sampler2D u_velocity;
        uniform sampler2D u_source;
        uniform vec2 u_texelSize;
        uniform float u_dt;
        uniform float u_dissipation;

        void main() {
          vec2 vel = texture(u_velocity, v_uv).xy;
          vec2 coord = v_uv - u_dt * vel * u_texelSize;
          
          // Boundary clamp to prevent wrap artifacts
          coord = clamp(coord, u_texelSize * 0.5, vec2(1.0) - u_texelSize * 0.5);
          
          vec4 result = texture(u_source, coord);
          // Unconditionally stable decay: 1 / (1 + decay * dt)
          fragColor = result / (1.0 + u_dissipation * u_dt);
        }
      `);

      // 3. Curl / Vorticity Calculation Shader
      const curlShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;
        uniform sampler2D u_velocity;
        uniform vec2 u_texelSize;

        void main() {
          float L = texture(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).y;
          float R = texture(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).y;
          float B = texture(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).x;
          float T = texture(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).x;

          float curl = 0.5 * ((R - L) - (T - B));
          fragColor = vec4(curl, 0.0, 0.0, 1.0);
        }
      `);

      // 4. Vorticity Confinement Shader (Physically scaled to prevent high-frequency noise)
      const vorticityShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;
        uniform sampler2D u_velocity;
        uniform sampler2D u_curl;
        uniform vec2 u_texelSize;
        uniform float u_dt;
        uniform float u_vorticity;

        void main() {
          float L = texture(u_curl, v_uv - vec2(u_texelSize.x, 0.0)).x;
          float R = texture(u_curl, v_uv + vec2(u_texelSize.x, 0.0)).x;
          float B = texture(u_curl, v_uv - vec2(0.0, u_texelSize.y)).x;
          float T = texture(u_curl, v_uv + vec2(0.0, u_texelSize.y)).x;
          float C = texture(u_curl, v_uv).x;

          vec2 grad = 0.5 * vec2(abs(R) - abs(L), abs(T) - abs(B));
          float mag = length(grad) + 1e-5;
          vec2 N = grad / mag;

          // Normalized perpendicular confinement force scaled smoothly
          vec2 force = (u_vorticity * 0.08) * vec2(N.y, -N.x) * C;
          vec2 vel = texture(u_velocity, v_uv).xy;
          fragColor = vec4(vel + force * u_dt, 0.0, 1.0);
        }
      `);

      // 5. Viscosity Diffusion Shader (Jacobi iteration)
      const viscosityShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;
        uniform sampler2D u_velocity_current;
        uniform sampler2D u_velocity_initial;
        uniform vec2 u_texelSize;
        uniform float u_alpha;
        uniform float u_rBeta;

        void main() {
          vec2 L = texture(u_velocity_current, v_uv - vec2(u_texelSize.x, 0.0)).xy;
          vec2 R = texture(u_velocity_current, v_uv + vec2(u_texelSize.x, 0.0)).xy;
          vec2 B = texture(u_velocity_current, v_uv - vec2(0.0, u_texelSize.y)).xy;
          vec2 T = texture(u_velocity_current, v_uv + vec2(0.0, u_texelSize.y)).xy;
          vec2 bC = texture(u_velocity_initial, v_uv).xy;

          vec2 next = (L + R + B + T + u_alpha * bC) * u_rBeta;
          fragColor = vec4(next, 0.0, 1.0);
        }
      `);

      // 6. Divergence Shader
      const divergenceShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;
        uniform sampler2D u_velocity;
        uniform vec2 u_texelSize;

        void main() {
          float L = texture(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).x;
          float R = texture(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).x;
          float B = texture(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).y;
          float T = texture(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).y;

          // Wall boundary condition: zero normal velocity through borders
          if (v_uv.x - u_texelSize.x < 0.0) L = -texture(u_velocity, v_uv).x;
          if (v_uv.x + u_texelSize.x > 1.0) R = -texture(u_velocity, v_uv).x;
          if (v_uv.y - u_texelSize.y < 0.0) B = -texture(u_velocity, v_uv).y;
          if (v_uv.y + u_texelSize.y > 1.0) T = -texture(u_velocity, v_uv).y;

          float div = 0.5 * (R - L + T - B);
          fragColor = vec4(div, 0.0, 0.0, 1.0);
        }
      `);

      // 7. Pressure Poisson Jacobi Relaxation Shader
      const pressureShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;
        uniform sampler2D u_pressure;
        uniform sampler2D u_divergence;
        uniform vec2 u_texelSize;

        void main() {
          float L = texture(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
          float R = texture(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
          float B = texture(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
          float T = texture(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
          float div = texture(u_divergence, v_uv).x;

          float p = (L + R + B + T - div) * 0.25;
          fragColor = vec4(p, 0.0, 0.0, 1.0);
        }
      `);

      // 8. Gradient Subtraction / Projection Shader
      const gradientSubtractShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;
        uniform sampler2D u_pressure;
        uniform sampler2D u_velocity;
        uniform vec2 u_texelSize;

        void main() {
          float L = texture(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
          float R = texture(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
          float B = texture(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
          float T = texture(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;

          vec2 vel = texture(u_velocity, v_uv).xy;
          vel -= 0.5 * vec2(R - L, T - B);

          // Boundary wall no-penetration
          if (v_uv.x < u_texelSize.x || v_uv.x > 1.0 - u_texelSize.x) vel.x = 0.0;
          if (v_uv.y < u_texelSize.y || v_uv.y > 1.0 - u_texelSize.y) vel.y = 0.0;

          fragColor = vec4(vel, 0.0, 1.0);
        }
      `);

      // 9. Gaussian Splat Shader (Momentum or Dye Injection)
      const splatShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;
        uniform sampler2D u_target;
        uniform vec2 u_point;
        uniform vec4 u_value;
        uniform float u_radius;
        uniform float u_aspect;

        void main() {
          vec2 d = v_uv - u_point;
          d.x *= u_aspect; // circular aspect correction
          float distSq = dot(d, d);
          float rSq = u_radius * u_radius;
          float splat = exp(-distSq / (rSq * 0.6));
          vec4 base = texture(u_target, v_uv);
          fragColor = base + u_value * splat;
        }
      `);

      // 10. Display & Visualization Shader (Full Multi-Mode)
      const displayShader = createProgram(commonVertexShader, `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 fragColor;

        uniform sampler2D u_dye;
        uniform sampler2D u_velocity;
        uniform sampler2D u_pressure;
        uniform sampler2D u_curl;
        uniform sampler2D u_divergence;
        uniform vec2 u_texelSize;
        uniform int u_mode;
        uniform bool u_specular;
        uniform float u_exposure;
        uniform float u_time;

        // Turbo colormap approximation
        vec3 turbo(float t) {
          t = clamp(t, 0.0, 1.0);
          const vec4 k0 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
          const vec4 k1 = vec4(-152.94239396, 59.28637943, 0.0, 0.0);
          const vec4 k2 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
          const vec4 k3 = vec4(4.27729857, 2.82956604, 0.0, 0.0);
          const vec4 k4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36275817);
          const vec4 k5 = vec4(-89.90310912, 27.34824973, 0.0, 0.0);

          vec4 v4 = vec4(1.0, t, t * t, t * t * t);
          vec2 v2 = v4.zw * v4.z;
          return vec3(
            dot(v4, k0) + dot(v2, k1.xy),
            dot(v4, k2) + dot(v2, k3.xy),
            dot(v4, k4) + dot(v2, k5.xy)
          );
        }

        // HSV to RGB helper
        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
          if (u_mode == 0) {
            // MODE 0: Luminous Rendered Dye with Rich Deep Blacks
            vec4 dye = texture(u_dye, v_uv);
            float density = max(max(dye.r, dye.g), dye.b);

            if (density < 0.002) {
              fragColor = vec4(0.024, 0.031, 0.047, 1.0);
              return;
            }

            vec3 color = dye.rgb * u_exposure;

            if (u_specular && density > 0.02) {
              // Surface normal from dye density gradient
              float L = texture(u_dye, v_uv - vec2(u_texelSize.x * 2.0, 0.0)).a;
              float R = texture(u_dye, v_uv + vec2(u_texelSize.x * 2.0, 0.0)).a;
              float B = texture(u_dye, v_uv - vec2(0.0, u_texelSize.y * 2.0)).a;
              float T = texture(u_dye, v_uv + vec2(0.0, u_texelSize.y * 2.0)).a;

              vec3 normal = normalize(vec3((L - R) * 2.5, (B - T) * 2.5, 1.0));
              vec3 light = normalize(vec3(0.5, 0.75, 1.0));
              float diff = max(dot(normal, light), 0.0);
              
              vec3 view = vec3(0.0, 0.0, 1.0);
              vec3 halfV = normalize(light + view);
              float spec = pow(max(dot(normal, halfV), 0.0), 32.0);
              
              float sheenMask = smoothstep(0.02, 0.25, density);
              color = color * (0.88 + 0.25 * diff) + spec * 0.4 * vec3(0.85, 0.95, 1.0) * sheenMask;
            }

            // Vibrant cinematic tone mapping
            color = color / (color + vec3(0.85));
            color = pow(color, vec3(0.92));
            fragColor = vec4(color, 1.0);

          } else if (u_mode == 1) {
            // MODE 1: Velocity Magnitude Heatmap
            vec2 vel = texture(u_velocity, v_uv).xy;
            float speed = length(vel) * 0.0018; // calibrated normalized speed
            vec3 color = turbo(speed);
            fragColor = vec4(color, 1.0);

          } else if (u_mode == 2) {
            // MODE 2: Velocity Direction (HSV Color Wheel)
            vec2 vel = texture(u_velocity, v_uv).xy;
            float speed = length(vel);
            float angle = atan(vel.y, vel.x);
            float hue = fract(angle / (2.0 * 3.14159265) + 0.5);
            float val = smoothstep(2.0, 60.0, speed);
            vec3 color = hsv2rgb(vec3(hue, 0.9, val));
            fragColor = vec4(color, 1.0);

          } else if (u_mode == 3) {
            // MODE 3: Pressure Field (Smooth Diverging Colormap with Isobar Contours)
            float p = texture(u_pressure, v_uv).x;
            float normP = clamp(tanh(p * 0.012), -1.0, 1.0);

            vec3 negColor = vec3(0.08, 0.45, 0.98); // suction / vortex core
            vec3 posColor = vec3(0.98, 0.32, 0.08); // high pressure stagnation
            vec3 zeroColor = vec3(0.04, 0.06, 0.10);

            vec3 color = normP < 0.0 ? mix(zeroColor, negColor, -normP)
                                     : mix(zeroColor, posColor, normP);
            // Subtle isobar contours
            float isobars = 0.5 + 0.5 * cos(p * 0.15);
            color += vec3(0.12) * pow(isobars, 12.0);
            fragColor = vec4(color, 1.0);

          } else if (u_mode == 4) {
            // MODE 4: Vorticity / Curl
            float curl = texture(u_curl, v_uv).x * 0.08;
            float normCurl = clamp(tanh(curl), -1.0, 1.0);

            vec3 ccwColor = vec3(0.0, 0.88, 0.98); // luminous cyan counter-clockwise
            vec3 cwColor = vec3(0.98, 0.12, 0.60);  // luminous magenta clockwise
            vec3 baseColor = vec3(0.03, 0.04, 0.07);

            vec3 color = normCurl > 0.0 ? mix(baseColor, ccwColor, normCurl)
                                        : mix(baseColor, cwColor, -normCurl);
            fragColor = vec4(color, 1.0);

          } else if (u_mode == 5) {
            // MODE 5: Divergence Diagnostic (Shows post-projection incompressibility quality)
            float div = texture(u_divergence, v_uv).x * 8.0;
            float normDiv = clamp(tanh(div), -1.0, 1.0);

            vec3 sinkColor = vec3(0.12, 0.55, 1.0);
            vec3 sourceColor = vec3(1.0, 0.38, 0.1);
            vec3 neutralColor = vec3(0.03, 0.04, 0.07);

            vec3 color = normDiv < 0.0 ? mix(neutralColor, sinkColor, -normDiv)
                                       : mix(neutralColor, sourceColor, normDiv);
            fragColor = vec4(color, 1.0);

          } else if (u_mode == 6) {
            // MODE 6: Streamlines / Flow Vector Needles
            vec2 vel = texture(u_velocity, v_uv).xy;
            float speed = length(vel);
            
            // Grid cell for vector arrows
            vec2 gridCount = vec2(48.0, 30.0);
            vec2 cellId = floor(v_uv * gridCount);
            vec2 cellUv = fract(v_uv * gridCount) - 0.5; // [-0.5, 0.5]

            // Sample center velocity of this grid cell
            vec2 centerCoord = (cellId + 0.5) / gridCount;
            vec2 cellVel = texture(u_velocity, centerCoord).xy;
            float cellSpeed = length(cellVel);
            
            float glyph = 0.0;
            if (cellSpeed > 5.0) {
              vec2 dir = cellVel / cellSpeed;
              // Project cellUv onto flow direction and perpendicular
              float along = dot(cellUv, dir);
              float perp = abs(dot(cellUv, vec2(-dir.y, dir.x)));

              float len = clamp(cellSpeed * 0.006, 0.1, 0.42);
              // Needle line
              if (abs(along) < len && perp < 0.045) {
                glyph = 1.0;
              }
              // Arrowhead
              if (along > len * 0.3 && along < len && perp < (len - along) * 0.55) {
                glyph = 1.0;
              }
            }

            // Streamline flow pulse
            vec2 flowDir = speed > 0.1 ? vel / speed : vec2(0.0);
            float stream = sin(dot(v_uv * 70.0, flowDir) - u_time * speed * 0.04);
            stream = smoothstep(0.65, 1.0, stream) * smoothstep(1.0, 15.0, speed) * 0.6;

            vec4 dye = texture(u_dye, v_uv);
            vec3 base = dye.rgb * 0.35 + vec3(0.03, 0.04, 0.07);
            vec3 arrowColor = mix(vec3(0.3, 0.75, 1.0), vec3(1.0, 0.9, 0.3), clamp(cellSpeed * 0.003, 0.0, 1.0));

            vec3 color = mix(base + stream * vec3(0.2, 0.5, 0.8), arrowColor, glyph);
            fragColor = vec4(color, 1.0);
          }
        }
      `);

      // --- Framebuffer & Ping-Pong Texture Manager ---
      function createFBO(w, h) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, halfFloatType, null);
        const filter = extLinear ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

        return {
          texture: tex,
          fbo: fb,
          width: w,
          height: h,
          attach(unit) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            return unit;
          }
        };
      }

      function createDoubleFBO(w, h) {
        let fboA = createFBO(w, h);
        let fboB = createFBO(w, h);
        return {
          get read() { return fboA; },
          get write() { return fboB; },
          swap() {
            const tmp = fboA;
            fboA = fboB;
            fboB = tmp;
          }
        };
      }

      // Simulation buffers
      let simW = 256;
      let simH = 256;
      let velocityBuffer;
      let dyeBuffer;
      let pressureBuffer;
      let divergenceBuffer;
      let curlBuffer;

      function initBuffers() {
        const w = canvas.width;
        const h = canvas.height;
        if (w >= h) {
          simW = state.resolution;
          simH = Math.max(32, Math.round(state.resolution * (h / w)));
        } else {
          simH = state.resolution;
          simW = Math.max(32, Math.round(state.resolution * (w / h)));
        }

        // Delete old textures if they exist
        if (velocityBuffer) {
          gl.deleteFramebuffer(velocityBuffer.read.fbo);
          gl.deleteFramebuffer(velocityBuffer.write.fbo);
          gl.deleteTexture(velocityBuffer.read.texture);
          gl.deleteTexture(velocityBuffer.write.texture);
        }
        if (dyeBuffer) {
          gl.deleteFramebuffer(dyeBuffer.read.fbo);
          gl.deleteFramebuffer(dyeBuffer.write.fbo);
          gl.deleteTexture(dyeBuffer.read.texture);
          gl.deleteTexture(dyeBuffer.write.texture);
        }
        if (pressureBuffer) {
          gl.deleteFramebuffer(pressureBuffer.read.fbo);
          gl.deleteFramebuffer(pressureBuffer.write.fbo);
          gl.deleteTexture(pressureBuffer.read.texture);
          gl.deleteTexture(pressureBuffer.write.texture);
        }
        if (divergenceBuffer) {
          gl.deleteFramebuffer(divergenceBuffer.fbo);
          gl.deleteTexture(divergenceBuffer.texture);
        }
        if (curlBuffer) {
          gl.deleteFramebuffer(curlBuffer.fbo);
          gl.deleteTexture(curlBuffer.texture);
        }

        velocityBuffer = createDoubleFBO(simW, simH);
        dyeBuffer = createDoubleFBO(simW, simH);
        pressureBuffer = createDoubleFBO(simW, simH);
        divergenceBuffer = createFBO(simW, simH);
        curlBuffer = createFBO(simW, simH);

        clearBuffer(velocityBuffer.read, 0, 0, 0, 0);
        clearBuffer(velocityBuffer.write, 0, 0, 0, 0);
        clearBuffer(dyeBuffer.read, 0, 0, 0, 0);
        clearBuffer(dyeBuffer.write, 0, 0, 0, 0);
        clearBuffer(pressureBuffer.read, 0, 0, 0, 0);
        clearBuffer(pressureBuffer.write, 0, 0, 0, 0);

        document.getElementById('hud-resolution').textContent = simW + ' × ' + simH;
      }

      function clearBuffer(target, r, g, b, a) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, target.width, target.height);
        gl.useProgram(clearShader);
        gl.uniform4f(gl.getUniformLocation(clearShader, 'u_value'), r, g, b, a);
        gl.bindVertexArray(quadVAO);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      function renderQuad(target) {
        if (target) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
          gl.viewport(0, 0, target.width, target.height);
        } else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        }
        gl.bindVertexArray(quadVAO);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // --- Fluid Splatting (Force & Dye) ---
      function splat(pointX, pointY, dx, dy, colorRGB, radiusFactor) {
        const aspect = canvas.width / canvas.height;
        const baseRadius = state.radius * (radiusFactor || 1.0);

        // 1. Splat velocity
        gl.useProgram(splatShader);
        gl.uniform1i(gl.getUniformLocation(splatShader, 'u_target'), velocityBuffer.read.attach(0));
        gl.uniform2f(gl.getUniformLocation(splatShader, 'u_point'), pointX, pointY);
        gl.uniform4f(gl.getUniformLocation(splatShader, 'u_value'), dx, dy, 0.0, 1.0);
        gl.uniform1f(gl.getUniformLocation(splatShader, 'u_radius'), baseRadius);
        gl.uniform1f(gl.getUniformLocation(splatShader, 'u_aspect'), aspect);
        renderQuad(velocityBuffer.write);
        velocityBuffer.swap();

        // 2. Splat dye
        gl.uniform1i(gl.getUniformLocation(splatShader, 'u_target'), dyeBuffer.read.attach(0));
        gl.uniform4f(gl.getUniformLocation(splatShader, 'u_value'), colorRGB[0] * 1.8, colorRGB[1] * 1.8, colorRGB[2] * 1.8, 1.0);
        gl.uniform1f(gl.getUniformLocation(splatShader, 'u_radius'), baseRadius * 1.1);
        renderQuad(dyeBuffer.write);
        dyeBuffer.swap();
      }

      // Color generation based on active mode
      function getCurrentDyeColor(speed) {
        if (state.colorMode === 'custom') {
          return state.customColor;
        } else if (state.colorMode === 'rainbow') {
          state.rainbowHue = (state.rainbowHue + 0.003 + (speed || 0) * 0.00004) % 1.0;
          return hsvToRgb(state.rainbowHue, 0.85, 1.0);
        } else if (state.colorMode === 'cyberpunk') {
          const t = Math.sin(state.simTime * 2.0) * 0.5 + 0.5;
          return lerpColor([0.05, 0.92, 0.98], [0.98, 0.12, 0.65], t);
        } else if (state.colorMode === 'ocean') {
          const t = Math.sin(state.simTime * 1.5) * 0.5 + 0.5;
          return lerpColor([0.05, 0.65, 0.98], [0.1, 0.98, 0.78], t);
        } else if (state.colorMode === 'fire') {
          const t = Math.sin(state.simTime * 2.2) * 0.5 + 0.5;
          return lerpColor([1.0, 0.8, 0.1], [0.98, 0.22, 0.05], t);
        } else if (state.colorMode === 'aurora') {
          const t = Math.sin(state.simTime * 1.8) * 0.5 + 0.5;
          return lerpColor([0.15, 0.98, 0.55], [0.78, 0.22, 0.98], t);
        }
        return [0.3, 0.75, 1.0];
      }

      function hsvToRgb(h, s, v) {
        let r, g, b;
        let i = Math.floor(h * 6);
        let f = h * 6 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);
        switch (i % 6) {
          case 0: r = v; g = t; b = p; break;
          case 1: r = q; g = v; b = p; break;
          case 2: r = p; g = v; b = t; break;
          case 3: r = p; g = q; b = v; break;
          case 4: r = t; g = p; b = v; break;
          case 5: r = v; g = p; b = q; break;
        }
        return [r, g, b];
      }

      function lerpColor(a, b, t) {
        return [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          a[2] + (b[2] - a[2]) * t
        ];
      }

      // Initial Scene Setup: bursts of colliding vortex rings
      function seedInitialFluid() {
        clearBuffer(velocityBuffer.read, 0, 0, 0, 0);
        clearBuffer(velocityBuffer.write, 0, 0, 0, 0);
        clearBuffer(dyeBuffer.read, 0, 0, 0, 0);
        clearBuffer(dyeBuffer.write, 0, 0, 0, 0);
        clearBuffer(pressureBuffer.read, 0, 0, 0, 0);
        clearBuffer(pressureBuffer.write, 0, 0, 0, 0);

        // Inject 4 energetic dynamic opposing jets with glowing neon dye
        splat(0.30, 0.40, 1400.0, 600.0, [0.1, 2.2, 2.5], 2.2);
        splat(0.70, 0.60, -1400.0, -600.0, [2.5, 0.2, 1.8], 2.2);
        splat(0.50, 0.75, 0.0, -1600.0, [2.5, 1.9, 0.2], 2.0);
        splat(0.50, 0.25, 0.0, 1600.0, [0.2, 2.5, 0.8], 2.0);
      }

      // --- Step Navier-Stokes Solver ---
      function stepFluid(dt) {
        const texelSizeX = 1.0 / simW;
        const texelSizeY = 1.0 / simH;
        const scaledDt = dt * state.timestep;

        // 1. Advect Velocity
        gl.useProgram(advectionShader);
        gl.uniform1i(gl.getUniformLocation(advectionShader, 'u_velocity'), velocityBuffer.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(advectionShader, 'u_source'), velocityBuffer.read.attach(1));
        gl.uniform2f(gl.getUniformLocation(advectionShader, 'u_texelSize'), texelSizeX, texelSizeY);
        gl.uniform1f(gl.getUniformLocation(advectionShader, 'u_dt'), scaledDt);
        gl.uniform1f(gl.getUniformLocation(advectionShader, 'u_dissipation'), state.velDissipation);
        renderQuad(velocityBuffer.write);
        velocityBuffer.swap();

        // 2. Viscosity Diffusion (if viscosity > 0)
        if (state.viscosity > 0.0001) {
          const alpha = (texelSizeX * texelSizeY) / (state.viscosity * scaledDt);
          const rBeta = 1.0 / (4.0 + alpha);
          gl.useProgram(viscosityShader);
          gl.uniform2f(gl.getUniformLocation(viscosityShader, 'u_texelSize'), texelSizeX, texelSizeY);
          gl.uniform1f(gl.getUniformLocation(viscosityShader, 'u_alpha'), alpha);
          gl.uniform1f(gl.getUniformLocation(viscosityShader, 'u_rBeta'), rBeta);
          gl.uniform1i(gl.getUniformLocation(viscosityShader, 'u_velocity_initial'), velocityBuffer.read.attach(1));

          // Run small Jacobi relaxation for velocity diffusion
          const viscIters = Math.min(8, Math.max(2, Math.round(state.viscosity * 250)));
          for (let i = 0; i < viscIters; i++) {
            gl.uniform1i(gl.getUniformLocation(viscosityShader, 'u_velocity_current'), velocityBuffer.read.attach(0));
            renderQuad(velocityBuffer.write);
            velocityBuffer.swap();
          }
        }

        // 3. Compute Vorticity & Curl
        gl.useProgram(curlShader);
        gl.uniform1i(gl.getUniformLocation(curlShader, 'u_velocity'), velocityBuffer.read.attach(0));
        gl.uniform2f(gl.getUniformLocation(curlShader, 'u_texelSize'), texelSizeX, texelSizeY);
        renderQuad(curlBuffer);

        // 4. Vorticity Confinement
        if (state.vorticity > 0.0) {
          gl.useProgram(vorticityShader);
          gl.uniform1i(gl.getUniformLocation(vorticityShader, 'u_velocity'), velocityBuffer.read.attach(0));
          gl.uniform1i(gl.getUniformLocation(vorticityShader, 'u_curl'), curlBuffer.attach(1));
          gl.uniform2f(gl.getUniformLocation(vorticityShader, 'u_texelSize'), texelSizeX, texelSizeY);
          gl.uniform1f(gl.getUniformLocation(vorticityShader, 'u_dt'), scaledDt);
          gl.uniform1f(gl.getUniformLocation(vorticityShader, 'u_vorticity'), state.vorticity);
          renderQuad(velocityBuffer.write);
          velocityBuffer.swap();
        }

        // 5. Compute Divergence
        gl.useProgram(divergenceShader);
        gl.uniform1i(gl.getUniformLocation(divergenceShader, 'u_velocity'), velocityBuffer.read.attach(0));
        gl.uniform2f(gl.getUniformLocation(divergenceShader, 'u_texelSize'), texelSizeX, texelSizeY);
        renderQuad(divergenceBuffer);

        // 6. Pressure Poisson Solve (Jacobi Relaxation)
        gl.useProgram(pressureShader);
        gl.uniform1i(gl.getUniformLocation(pressureShader, 'u_divergence'), divergenceBuffer.attach(1));
        gl.uniform2f(gl.getUniformLocation(pressureShader, 'u_texelSize'), texelSizeX, texelSizeY);

        for (let i = 0; i < state.pressureIters; i++) {
          gl.uniform1i(gl.getUniformLocation(pressureShader, 'u_pressure'), pressureBuffer.read.attach(0));
          renderQuad(pressureBuffer.write);
          pressureBuffer.swap();
        }

        // 7. Gradient Subtraction / Projection (Enforces incompressibility)
        gl.useProgram(gradientSubtractShader);
        gl.uniform1i(gl.getUniformLocation(gradientSubtractShader, 'u_pressure'), pressureBuffer.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(gradientSubtractShader, 'u_velocity'), velocityBuffer.read.attach(1));
        gl.uniform2f(gl.getUniformLocation(gradientSubtractShader, 'u_texelSize'), texelSizeX, texelSizeY);
        renderQuad(velocityBuffer.write);
        velocityBuffer.swap();

        // 8. Recompute Divergence post-projection for exact incompressibility diagnostic
        gl.useProgram(divergenceShader);
        gl.uniform1i(gl.getUniformLocation(divergenceShader, 'u_velocity'), velocityBuffer.read.attach(0));
        gl.uniform2f(gl.getUniformLocation(divergenceShader, 'u_texelSize'), texelSizeX, texelSizeY);
        renderQuad(divergenceBuffer);

        // 9. Advect Dye Field
        gl.useProgram(advectionShader);
        gl.uniform1i(gl.getUniformLocation(advectionShader, 'u_velocity'), velocityBuffer.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(advectionShader, 'u_source'), dyeBuffer.read.attach(1));
        gl.uniform2f(gl.getUniformLocation(advectionShader, 'u_texelSize'), texelSizeX, texelSizeY);
        gl.uniform1f(gl.getUniformLocation(advectionShader, 'u_dt'), scaledDt);
        gl.uniform1f(gl.getUniformLocation(advectionShader, 'u_dissipation'), state.dyeDissipation);
        renderQuad(dyeBuffer.write);
        dyeBuffer.swap();
      }

      // --- Screen Display Rendering ---
      function renderScreen() {
        gl.useProgram(displayShader);
        gl.uniform1i(gl.getUniformLocation(displayShader, 'u_dye'), dyeBuffer.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(displayShader, 'u_velocity'), velocityBuffer.read.attach(1));
        gl.uniform1i(gl.getUniformLocation(displayShader, 'u_pressure'), pressureBuffer.read.attach(2));
        gl.uniform1i(gl.getUniformLocation(displayShader, 'u_curl'), curlBuffer.attach(3));
        gl.uniform1i(gl.getUniformLocation(displayShader, 'u_divergence'), divergenceBuffer.attach(4));
        gl.uniform2f(gl.getUniformLocation(displayShader, 'u_texelSize'), 1.0 / simW, 1.0 / simH);
        gl.uniform1i(gl.getUniformLocation(displayShader, 'u_mode'), state.mode);
        gl.uniform1i(gl.getUniformLocation(displayShader, 'u_specular'), state.specular ? 1 : 0);
        gl.uniform1f(gl.getUniformLocation(displayShader, 'u_exposure'), state.exposure);
        gl.uniform1f(gl.getUniformLocation(displayShader, 'u_time'), state.simTime);
        renderQuad(null);
      }

      // --- Decoupled Pointer / Touch Input Queue ---
      const pendingSplats = [];

      function handlePointerMove(id, x, y) {
        const rect = canvas.getBoundingClientRect();
        const normX = (x - rect.left) / rect.width;
        const normY = 1.0 - (y - rect.top) / rect.height; // WebGL Y is flipped

        const ptr = state.activePointers.get(id);
        if (!ptr) {
          state.activePointers.set(id, { x: normX, y: normY, lastTime: performance.now() });
          return;
        }

        const dx = normX - ptr.x;
        const dy = normY - ptr.y;
        const dist = Math.hypot(dx, dy);
        const now = performance.now();
        const dtSec = Math.max(0.001, (now - ptr.lastTime) * 0.001);

        // Update live pointer speed HUD
        state.pointerSpeed = Math.round((dist * rect.width) / dtSec);
        const speedEl = document.getElementById('hud-speed');
        if (speedEl) speedEl.textContent = state.pointerSpeed + ' px/s';

        if (dist > 0.0005) {
          // Calculate momentum force vector
          const forceX = (dx / dtSec) * state.force * 0.02;
          const forceY = (dy / dtSec) * state.force * 0.02;
          const color = getCurrentDyeColor(state.pointerSpeed);

          // Sub-step interpolation: enqueue overlapping splats along fast drags
          const steps = Math.min(16, Math.max(1, Math.ceil(dist / (state.radius * 0.4))));
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            pendingSplats.push({
              x: ptr.x + dx * t,
              y: ptr.y + dy * t,
              dx: forceX,
              dy: forceY,
              color: color,
              radius: 1.0
            });
          }

          ptr.x = normX;
          ptr.y = normY;
          ptr.lastTime = now;

          // Hide interaction hint upon first interaction
          const hint = document.getElementById('interaction-hint');
          if (hint && !hint.classList.contains('fade-out')) {
            hint.classList.add('fade-out');
          }
        }
      }

      // Pointer event listeners
      let isMouseDown = false;

      canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        handlePointerMove('mouse', e.clientX, e.clientY);
      });

      window.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        handlePointerMove('mouse', e.clientX, e.clientY);
      });

      window.addEventListener('mouseup', () => {
        isMouseDown = false;
        state.activePointers.delete('mouse');
        state.pointerSpeed = 0;
        document.getElementById('hud-speed').textContent = '0 px/s';
      });

      // Multi-touch support
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          handlePointerMove(t.identifier, t.clientX, t.clientY);
        }
      }, { passive: false });

      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          handlePointerMove(t.identifier, t.clientX, t.clientY);
        }
      }, { passive: false });

      const endTouch = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          state.activePointers.delete(e.changedTouches[i].identifier);
        }
        if (state.activePointers.size === 0) {
          state.pointerSpeed = 0;
          document.getElementById('hud-speed').textContent = '0 px/s';
        }
      };
      canvas.addEventListener('touchend', endTouch);
      canvas.addEventListener('touchcancel', endTouch);

      // --- Ambient Emitters (gentle background jets if enabled) ---
      function updateAmbientJets(dt) {
        if (!state.autoEmit || state.paused) return;
        const t = state.simTime * 0.6;

        // Circular gentle emitter 1
        const x1 = 0.5 + Math.cos(t * 1.1) * 0.35;
        const y1 = 0.5 + Math.sin(t * 0.8) * 0.35;
        const vx1 = -Math.sin(t * 1.1) * 350.0;
        const vy1 = Math.cos(t * 0.8) * 350.0;
        const c1 = hsvToRgb((t * 0.08) % 1.0, 0.85, 0.85);
        splat(x1, y1, vx1, vy1, c1, 0.7);

        // Counter rotating emitter 2
        const x2 = 0.5 + Math.sin(t * 0.7 + 2.0) * 0.30;
        const y2 = 0.5 + Math.cos(t * 0.9 + 1.0) * 0.30;
        const vx2 = Math.cos(t * 0.7 + 2.0) * 300.0;
        const vy2 = -Math.sin(t * 0.9 + 1.0) * 300.0;
        const c2 = hsvToRgb((t * 0.08 + 0.5) % 1.0, 0.85, 0.85);
        splat(x2, y2, vx2, vy2, c2, 0.7);
      }

      // --- Main Render Loop with Smooth FPS & Metric Tracking ---
      let lastTime = performance.now();
      let frameCount = 0;
      let lastFpsUpdate = performance.now();

      function animate(now) {
        requestAnimationFrame(animate);

        const deltaRaw = (now - lastTime) * 0.001;
        lastTime = now;
        const dt = Math.min(0.033, Math.max(0.001, deltaRaw));

        // FPS calculation (smoothed EMA)
        frameCount++;
        if (now - lastFpsUpdate >= 400) {
          const currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
          state.fps = Math.round(state.fps * 0.6 + currentFps * 0.4);
          state.frameTime = (1000 / Math.max(1, state.fps)).toFixed(1);
          document.getElementById('hud-fps').textContent = state.fps + ' FPS';
          document.getElementById('hud-frametime').textContent = state.frameTime + ' ms';
          frameCount = 0;
          lastFpsUpdate = now;
        }

        // Process any queued pointer splats before stepping simulation
        while (pendingSplats.length > 0) {
          const p = pendingSplats.shift();
          splat(p.x, p.y, p.dx, p.dy, p.color, p.radius);
        }

        if (!state.paused) {
          state.simTime += dt * state.timestep;
          updateAmbientJets(dt);
          stepFluid(dt);
        }

        renderScreen();
      }

      // --- Window Resize Handling ---
      function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
        const width = window.innerWidth;
        const height = window.innerHeight;

        const displayWidth = Math.round(width * dpr);
        const displayHeight = Math.round(height * dpr);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
          initBuffers();
          seedInitialFluid();
        }
      }

      window.addEventListener('resize', resize);
      resize();
      seedInitialFluid();
      requestAnimationFrame(animate);

      // --- Controls & UI Bindings ---

      // Pause / Resume Action
      const pauseBtn = document.getElementById('btn-pause');
      const pauseText = document.getElementById('pause-text');
      const pauseIcon = document.getElementById('pause-icon');
      const hudStatus = document.getElementById('hud-status');

      function togglePause() {
        state.paused = !state.paused;
        if (state.paused) {
          pauseText.textContent = 'Resume';
          pauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
          hudStatus.textContent = 'PAUSED';
          hudStatus.className = 'perf-val paused-state';
          pauseBtn.classList.add('btn-active');
        } else {
          pauseText.textContent = 'Pause';
          pauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
          hudStatus.textContent = 'RUNNING';
          hudStatus.className = 'perf-val active-state';
          pauseBtn.classList.remove('btn-active');
        }
      }
      pauseBtn.addEventListener('click', togglePause);

      // Reset Action
      document.getElementById('btn-reset').addEventListener('click', () => {
        seedInitialFluid();
      });

      // Clear Dye Action (Preserves Velocity Currents!)
      document.getElementById('btn-clear-dye').addEventListener('click', () => {
        clearBuffer(dyeBuffer.read, 0, 0, 0, 0);
        clearBuffer(dyeBuffer.write, 0, 0, 0, 0);
      });

      // Drawer Toggle Action
      const drawer = document.getElementById('control-drawer');
      const toggleDrawerBtn = document.getElementById('btn-toggle-drawer');
      const closeDrawerBtn = document.getElementById('btn-close-drawer');

      // Auto-collapse on small screens
      if (window.innerWidth <= 768) {
        drawer.classList.add('collapsed');
      }

      function toggleDrawer() {
        drawer.classList.toggle('collapsed');
      }
      toggleDrawerBtn.addEventListener('click', toggleDrawer);
      closeDrawerBtn.addEventListener('click', () => drawer.classList.add('collapsed'));

      // HUD Overlay Toggle
      const hudOverlay = document.getElementById('perf-overlay');
      document.getElementById('btn-toggle-hud').addEventListener('click', () => {
        hudOverlay.classList.toggle('hidden');
      });

      // Visualization Modes
      const modeNames = [
        'Rendered Dye',
        'Velocity Heatmap',
        'Flow Direction',
        'Pressure Field',
        'Vorticity / Curl',
        'Divergence Diagnostic',
        'Streamlines Flow'
      ];
      const modeButtons = document.querySelectorAll('.mode-btn');
      const legendOverlay = document.getElementById('legend-overlay');
      const legendGradient = document.getElementById('legend-gradient');
      const legendMin = document.getElementById('legend-min');
      const legendMax = document.getElementById('legend-max');

      function setVisualizationMode(modeIndex) {
        state.mode = parseInt(modeIndex, 10);
        modeButtons.forEach((b, idx) => {
          b.classList.toggle('active', idx === state.mode);
        });
        document.getElementById('hud-mode').textContent = modeNames[state.mode];

        // Update Legend for diagnostic modes
        if (state.mode === 1) {
          legendOverlay.style.display = 'flex';
          legendMin.textContent = '0 (Stagnant)';
          legendMax.textContent = 'High Speed';
          legendGradient.style.background = 'linear-gradient(to right, #24294b, #21918c, #fde725, #e63946)';
        } else if (state.mode === 2) {
          legendOverlay.style.display = 'flex';
          legendMin.textContent = '-π';
          legendMax.textContent = '+π';
          legendGradient.style.background = 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';
        } else if (state.mode === 3) {
          legendOverlay.style.display = 'flex';
          legendMin.textContent = 'Suction (-p)';
          legendMax.textContent = 'High (+p)';
          legendGradient.style.background = 'linear-gradient(to right, #0d6efd, #0b0f19, #fd7e14)';
        } else if (state.mode === 4) {
          legendOverlay.style.display = 'flex';
          legendMin.textContent = 'CW (Clockwise)';
          legendMax.textContent = 'CCW (Counter-CW)';
          legendGradient.style.background = 'linear-gradient(to right, #fa26a0, #0a0e1a, #05d9e8)';
        } else if (state.mode === 5) {
          legendOverlay.style.display = 'flex';
          legendMin.textContent = 'Sink (-∇·u)';
          legendMax.textContent = 'Source (+∇·u)';
          legendGradient.style.background = 'linear-gradient(to right, #0d6efd, #0b0f19, #fd7e14)';
        } else {
          legendOverlay.style.display = 'none';
        }
      }

      modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          setVisualizationMode(btn.dataset.mode);
        });
      });

      // Grid Resolution Selector
      const resSelect = document.getElementById('param-resolution');
      resSelect.addEventListener('change', () => {
        state.resolution = parseInt(resSelect.value, 10);
        document.getElementById('val-resolution').textContent = state.resolution;
        initBuffers();
        seedInitialFluid();
      });

      // Slider Bindings
      function bindSlider(id, stateKey, displayId, formatFn, hudId) {
        const input = document.getElementById(id);
        const display = document.getElementById(displayId);
        input.addEventListener('input', () => {
          const val = parseFloat(input.value);
          state[stateKey] = val;
          display.textContent = formatFn ? formatFn(val) : val;
          if (hudId) {
            document.getElementById(hudId).textContent = formatFn ? formatFn(val) : val;
          }
        });
      }

      bindSlider('param-timestep', 'timestep', 'val-timestep', (v) => v.toFixed(2) + '×');
      bindSlider('param-viscosity', 'viscosity', 'val-viscosity', (v) => v.toFixed(4), 'hud-visc');
      bindSlider('param-pressure', 'pressureIters', 'val-pressure', (v) => v.toString(), 'hud-iters');
      bindSlider('param-vorticity', 'vorticity', 'val-vorticity', (v) => v.toFixed(1), 'hud-vort');
      bindSlider('param-vel-dissip', 'velDissipation', 'val-vel-dissip', (v) => v.toFixed(3));
      bindSlider('param-dye-dissip', 'dyeDissipation', 'val-dye-dissip', (v) => v.toFixed(3));
      bindSlider('param-force', 'force', 'val-force', (v) => Math.round(v).toString());
      bindSlider('param-radius', 'radius', 'val-radius', (v) => {
        state.radius = v * 0.01;
        return v.toFixed(1) + '%';
      });
      bindSlider('param-exposure', 'exposure', 'val-exposure', (v) => v.toFixed(1) + '×');

      // Color Mode Select
      const colorSelect = document.getElementById('select-color-mode');
      const customColorRow = document.getElementById('custom-color-row');
      const customColorInput = document.getElementById('input-custom-color');

      colorSelect.addEventListener('change', () => {
        state.colorMode = colorSelect.value;
        customColorRow.style.display = state.colorMode === 'custom' ? 'flex' : 'none';
      });

      customColorInput.addEventListener('input', () => {
        const hex = customColorInput.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        state.customColor = [r, g, b];
      });

      // Checkboxes
      document.getElementById('check-auto-emit').addEventListener('change', (e) => {
        state.autoEmit = e.target.checked;
      });

      document.getElementById('check-specular').addEventListener('change', (e) => {
        state.specular = e.target.checked;
      });

      // Presets
      const presetConfigs = {
        cosmic: {
          viscosity: 0.0010,
          vorticity: 25.0,
          velDissip: 0.012,
          dyeDissip: 0.006,
          colorMode: 'rainbow',
          pressure: 25
        },
        turbulent: {
          viscosity: 0.0001,
          vorticity: 50.0,
          velDissip: 0.005,
          dyeDissip: 0.004,
          colorMode: 'cyberpunk',
          pressure: 30
        },
        viscous: {
          viscosity: 0.025,
          vorticity: 4.0,
          velDissip: 0.045,
          dyeDissip: 0.020,
          colorMode: 'fire',
          pressure: 20
        },
        superfluid: {
          viscosity: 0.0000,
          vorticity: 40.0,
          velDissip: 0.000,
          dyeDissip: 0.001,
          colorMode: 'ocean',
          pressure: 35
        },
        ink: {
          viscosity: 0.003,
          vorticity: 15.0,
          velDissip: 0.02,
          dyeDissip: 0.002,
          colorMode: 'aurora',
          pressure: 20
        },
        vortex_pair: {
          viscosity: 0.0005,
          vorticity: 30.0,
          velDissip: 0.008,
          dyeDissip: 0.005,
          colorMode: 'cyberpunk',
          pressure: 25
        }
      };

      const selectPreset = document.getElementById('select-preset');
      selectPreset.addEventListener('change', () => {
        const p = presetConfigs[selectPreset.value];
        if (!p) return;

        state.viscosity = p.viscosity;
        document.getElementById('param-viscosity').value = p.viscosity;
        document.getElementById('val-viscosity').textContent = p.viscosity.toFixed(4);
        document.getElementById('hud-visc').textContent = p.viscosity.toFixed(4);

        state.vorticity = p.vorticity;
        document.getElementById('param-vorticity').value = p.vorticity;
        document.getElementById('val-vorticity').textContent = p.vorticity.toFixed(1);
        document.getElementById('hud-vort').textContent = p.vorticity.toFixed(1);

        state.velDissipation = p.velDissip;
        document.getElementById('param-vel-dissip').value = p.velDissip;
        document.getElementById('val-vel-dissip').textContent = p.velDissip.toFixed(3);

        state.dyeDissipation = p.dyeDissip;
        document.getElementById('param-dye-dissip').value = p.dyeDissip;
        document.getElementById('val-dye-dissip').textContent = p.dyeDissip.toFixed(3);

        state.pressureIters = p.pressure;
        document.getElementById('param-pressure').value = p.pressure;
        document.getElementById('val-pressure').textContent = p.pressure.toString();
        document.getElementById('hud-iters').textContent = p.pressure.toString();

        state.colorMode = p.colorMode;
        colorSelect.value = p.colorMode;
        customColorRow.style.display = 'none';

        if (selectPreset.value === 'vortex_pair') {
          clearBuffer(velocityBuffer.read, 0, 0, 0, 0);
          clearBuffer(velocityBuffer.write, 0, 0, 0, 0);
          clearBuffer(dyeBuffer.read, 0, 0, 0, 0);
          clearBuffer(dyeBuffer.write, 0, 0, 0, 0);
          // Shoot two colliding vortex pairs towards center
          splat(0.2, 0.5, 2500.0, 0.0, [0.1, 0.9, 0.95], 2.0);
          splat(0.8, 0.5, -2500.0, 0.0, [0.95, 0.15, 0.6], 2.0);
        }
      });

      // Keyboard Shortcuts
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        if (e.code === 'Space') {
          e.preventDefault();
          togglePause();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          seedInitialFluid();
        } else if (e.code === 'KeyC') {
          e.preventDefault();
          clearBuffer(dyeBuffer.read, 0, 0, 0, 0);
          clearBuffer(dyeBuffer.write, 0, 0, 0, 0);
        } else if (e.code === 'KeyH') {
          e.preventDefault();
          toggleDrawer();
        } else if (e.key >= '1' && e.key <= '7') {
          e.preventDefault();
          setVisualizationMode(parseInt(e.key, 10) - 1);
        }
      });

      // Expose diagnostic inspection hooks for test harnesses & browser evaluation
      window.captureScreenshotPNG = () => {
        return canvas.toDataURL('image/png');
      };
      window.__FLUID_SIM__ = {
        state,
        getFps: () => state.fps,
        getFrameTime: () => state.frameTime,
        getResolution: () => ({ width: simW, height: simH }),
        getMode: () => state.mode,
        isPaused: () => state.paused,
        togglePause,
        reset: seedInitialFluid,
        clearDye: () => {
          clearBuffer(dyeBuffer.read, 0, 0, 0, 0);
          clearBuffer(dyeBuffer.write, 0, 0, 0, 0);
        },
        getVelocityMagnitudeSum: () => {
          // Diagnostic function to verify velocity persistence across clearDye
          const pixels = new Float32Array(simW * simH * 4);
          gl.bindFramebuffer(gl.FRAMEBUFFER, velocityBuffer.read.fbo);
          // Read a sample region (center 32x32)
          const sampleSize = 32;
          const sx = Math.floor(simW / 2 - sampleSize / 2);
          const sy = Math.floor(simH / 2 - sampleSize / 2);
          const buf = new Uint16Array(sampleSize * sampleSize * 4);
          gl.readPixels(sx, sy, sampleSize, sampleSize, gl.RGBA, halfFloatType, buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i += 4) {
            sum += Math.abs(buf[i]) + Math.abs(buf[i+1]);
          }
          return sum;
        },
        getDyeSum: () => {
          // Sample dye buffer density
          const sampleSize = 32;
          const sx = Math.floor(simW / 2 - sampleSize / 2);
          const sy = Math.floor(simH / 2 - sampleSize / 2);
          const buf = new Uint16Array(sampleSize * sampleSize * 4);
          gl.bindFramebuffer(gl.FRAMEBUFFER, dyeBuffer.read.fbo);
          gl.readPixels(sx, sy, sampleSize, sampleSize, gl.RGBA, halfFloatType, buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i += 4) {
            sum += buf[i] + buf[i+1] + buf[i+2];
          }
          return sum;
        },
        setViscosity: (v) => {
          state.viscosity = v;
          document.getElementById('param-viscosity').value = v;
          document.getElementById('val-viscosity').textContent = v.toFixed(4);
          document.getElementById('hud-visc').textContent = v.toFixed(4);
        },
        setVorticity: (v) => {
          state.vorticity = v;
          document.getElementById('param-vorticity').value = v;
          document.getElementById('val-vorticity').textContent = v.toFixed(1);
          document.getElementById('hud-vort').textContent = v.toFixed(1);
        },
        setMode: setVisualizationMode,
        splat: (x, y, dx, dy, color, r) => splat(x, y, dx, dy, color || [0.2, 0.8, 1.0], r || 1.0)
      };

    })();
  </script>
</body>
</html>
'''

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"Regenerated index.html: {len(html_content)} bytes")
