def get_ui_export_js():
    return """
// UI Controller, Presets, Exports & Interactions
function initPalette() {
  const listEl = document.getElementById('palette-items');
  const searchInput = document.getElementById('palette-search');
  if (!listEl) return;

  const categories = {};
  for (const type in NODE_TYPES) {
    const def = NODE_TYPES[type];
    const cat = def.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ type, def });
  }

  const renderList = (filterText = '') => {
    listEl.innerHTML = '';
    for (const cat in categories) {
      const filtered = categories[cat].filter(item => 
        item.def.title.toLowerCase().includes(filterText.toLowerCase()) ||
        item.type.toLowerCase().includes(filterText.toLowerCase())
      );
      if (filtered.length === 0) continue;

      const catEl = document.createElement('div');
      catEl.className = 'palette-category';

      const catTitle = document.createElement('div');
      catTitle.className = 'category-title';
      catTitle.innerHTML = `<span>${cat}</span><span style="font-size: 10px;">${filtered.length}</span>`;

      const itemsWrap = document.createElement('div');
      filtered.forEach(({ type, def }) => {
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.innerHTML = `
          <span>${def.title}</span>
          <span class="item-type" style="border-left: 2px solid ${def.color || '#38bdf8'};">${type}</span>
        `;
        item.addEventListener('click', () => {
          spawnNode(type);
        });
        itemsWrap.appendChild(item);
      });

      catEl.appendChild(catTitle);
      catEl.appendChild(itemsWrap);
      listEl.appendChild(catEl);
    }
  };

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderList(e.target.value);
    });
  }

  renderList();
}

function spawnNode(type, atX = null, atY = null) {
  const def = NODE_TYPES[type];
  if (!def) return;

  state.saveSnapshot();

  let wx = atX, wy = atY;
  if (wx === null || wy === null) {
    const cRect = editor.container.getBoundingClientRect();
    const center = editor.screenToWorld(cRect.left + cRect.width / 2, cRect.top + cRect.height / 2);
    wx = center.x + (Math.random() * 40 - 20);
    wy = center.y + (Math.random() * 40 - 20);
  }

  const newId = `n_${Date.now()}_${Math.floor(Math.random()*1000)}`;
  const defaultParams = {};
  (def.inputs || []).forEach(inp => {
    defaultParams[inp.name] = inp.default;
  });

  const newNode = {
    id: newId,
    type: type,
    title: def.title,
    x: Math.round(wx),
    y: Math.round(wy),
    collapsed: false,
    params: defaultParams
  };

  state.nodes.push(newNode);
  state.selectedNodeIds.clear();
  state.selectedNodeIds.add(newId);

  editor.renderAll();
  compiler.recompile();
  inspector.update();
  showToast(`Added ${def.title}`);
}

function loadPreset(key) {
  const p = PRESETS[key];
  if (!p) return;

  state.saveSnapshot();
  state.nodes = JSON.parse(JSON.stringify(p.nodes));
  state.edges = JSON.parse(JSON.stringify(p.edges));
  state.frames = [];
  state.keyframes = {};
  state.previewTargetNodeId = null;
  state.selectedNodeIds.clear();
  state.selectedEdgeIds.clear();

  editor.fitView();
  editor.renderAll();
  compiler.recompile();
  inspector.update();
  timeline.render();
  showToast(`Loaded preset: ${p.name}`);
}

// Context Menu
let activeContextMenuTarget = null;
function showContextMenu(x, y, targetType, targetId = null) {
  const menu = document.getElementById('context-menu');
  if (!menu) return;

  activeContextMenuTarget = { type: targetType, id: targetId };
  menu.innerHTML = '';

  if (targetType === 'canvas') {
    menu.innerHTML = `
      <div class="ctx-item" onclick="openCommandPalette()"><span style="margin-right: 12px;">+ Add Node</span><span style="color:var(--text-dim);">Space</span></div>
      <div class="ctx-item" onclick="editor.fitView()">Fit Graph View (F)</div>
      <div class="ctx-separator"></div>
      <div class="ctx-item" onclick="editor.frameSelected()">Frame Selected (G)</div>
      <div class="ctx-item" onclick="editor.alignSelected('left')">Align Left</div>
      <div class="ctx-item" onclick="editor.alignSelected('top')">Align Top</div>
      <div class="ctx-separator"></div>
      <div class="ctx-item" onclick="clearGraph()">Clear Graph</div>
    `;
  } else if (targetType === 'node') {
    menu.innerHTML = `
      <div class="ctx-item" onclick="editor.duplicateSelected()">Duplicate (Ctrl+D)</div>
      <div class="ctx-item" onclick="toggleSelectedCollapse()">Toggle Collapse (C)</div>
      <div class="ctx-item" onclick="toggleIntermediatePreview('${targetId}')">Toggle Preview</div>
      <div class="ctx-separator"></div>
      <div class="ctx-item" style="color: var(--danger);" onclick="editor.deleteSelected()">Delete Node</div>
    `;
  } else if (targetType === 'wire') {
    menu.innerHTML = `
      <div class="ctx-item" style="color: var(--danger);" onclick="deleteWire('${targetId}')">Delete Connection</div>
    `;
  }

  menu.style.display = 'block';
  menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;

  const closeMenu = () => {
    menu.style.display = 'none';
    window.removeEventListener('click', closeMenu);
  };
  setTimeout(() => window.addEventListener('click', closeMenu), 50);
}

function toggleIntermediatePreview(nodeId) {
  state.previewTargetNodeId = state.previewTargetNodeId === nodeId ? null : nodeId;
  compiler.recompile();
  editor.renderNodes();
  inspector.update();
}

function toggleSelectedCollapse() {
  state.selectedNodeIds.forEach(id => {
    const node = state.nodes.find(n => n.id === id);
    if (node) node.collapsed = !node.collapsed;
  });
  editor.renderAll();
}

function deleteWire(edgeId) {
  state.saveSnapshot();
  state.edges = state.edges.filter(e => e.id !== edgeId);
  editor.renderWires();
  compiler.recompile();
  showToast('Deleted connection');
}

function clearGraph() {
  if (confirm('Clear the current node graph?')) {
    state.saveSnapshot();
    state.nodes = [];
    state.edges = [];
    state.frames = [];
    state.keyframes = {};
    editor.renderAll();
    compiler.recompile();
    inspector.update();
    timeline.render();
    showToast('Graph cleared');
  }
}

// Command Palette
let cmdResults = [];
let cmdSelectedIndex = 0;

function openCommandPalette() {
  const box = document.getElementById('cmd-palette-box');
  const input = document.getElementById('cmd-palette-input');
  if (!box || !input) return;

  box.classList.add('active');
  input.value = '';
  input.focus();
  filterCommandPalette('');
}

function closeCommandPalette() {
  const box = document.getElementById('cmd-palette-box');
  if (box) box.classList.remove('active');
}

function filterCommandPalette(query) {
  const resultsContainer = document.getElementById('cmd-palette-results');
  if (!resultsContainer) return;

  cmdResults = [];
  for (const type in NODE_TYPES) {
    const def = NODE_TYPES[type];
    if (def.title.toLowerCase().includes(query.toLowerCase()) || type.toLowerCase().includes(query.toLowerCase())) {
      cmdResults.push({ type, def });
    }
  }

  cmdSelectedIndex = 0;
  renderCommandPaletteResults();
}

function renderCommandPaletteResults() {
  const resultsContainer = document.getElementById('cmd-palette-results');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = '';
  cmdResults.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = `cmd-item ${idx === cmdSelectedIndex ? 'selected' : ''}`;
    div.innerHTML = `
      <span>${item.def.title}</span>
      <span class="cmd-cat">${item.def.category}</span>
    `;
    div.addEventListener('click', () => {
      spawnNode(item.type);
      closeCommandPalette();
    });
    resultsContainer.appendChild(div);
  });
}

// Viewport Controls & A-B Comparison & Pixel Inspector
function initViewportControls() {
  const canvas = document.getElementById('preview-canvas');
  const hud = document.getElementById('pixel-inspector-hud');

  // Pixel inspection
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const pixel = renderer.readPixel(x, y);
    if (!pixel) return;

    const u = (x / canvas.width).toFixed(3);
    const v = (1.0 - y / canvas.height).toFixed(3);
    const r = pixel[0], g = pixel[1], b = pixel[2], a = (pixel[3] / 255).toFixed(2);
    const hex = inspector.rgbToHex(r / 255, g / 255, b / 255);
    const luma = (0.2126 * (r/255) + 0.7152 * (g/255) + 0.0722 * (b/255)).toFixed(2);

    if (hud) {
      hud.innerHTML = `
        <span class="pixel-color-chip" style="background: ${hex};"></span>
        <span>UV: (${u}, ${v})</span>
        <span>RGB: (${r}, ${g}, ${b})</span>
        <span>HEX: ${hex}</span>
        <span>Luma: ${luma}</span>
      `;
    }
  });

  // Channel isolation buttons
  document.querySelectorAll('.btn-channel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-channel').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.diagnosticMode = parseInt(btn.dataset.mode) || 0;
    });
  });

  // Tiling preview toggle
  const tileBtn = document.getElementById('btn-toggle-tiling');
  if (tileBtn) {
    tileBtn.addEventListener('click', () => {
      if (state.tiling === 1.0) {
        state.tiling = 2.0;
        tileBtn.textContent = '2x2';
      } else if (state.tiling === 2.0) {
        state.tiling = 3.0;
        tileBtn.textContent = '3x3';
      } else {
        state.tiling = 1.0;
        tileBtn.textContent = '1x1';
      }
    });
  }

  // Checkerboard transparency toggle
  const checkBtn = document.getElementById('btn-toggle-checker');
  const wrapper = document.getElementById('viewport-wrapper');
  if (checkBtn && wrapper) {
    checkBtn.addEventListener('click', () => {
      state.checkerboard = !state.checkerboard;
      wrapper.classList.toggle('checkerboard', state.checkerboard);
      checkBtn.classList.toggle('active', state.checkerboard);
    });
  }

  // Freeze reference & A-B Split Compare
  const freezeBtn = document.getElementById('btn-freeze-ref');
  const abLine = document.getElementById('ab-split-line');
  if (freezeBtn) {
    freezeBtn.addEventListener('click', () => {
      // Capture current canvas frame to offscreen image
      const tempC = document.createElement('canvas');
      tempC.width = canvas.width;
      tempC.height = canvas.height;
      const ctx = tempC.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      state.frozenImageData = tempC;
      state.abActive = true;
      if (abLine) abLine.style.display = 'block';
      freezeBtn.classList.add('active');
      showToast('Reference frame frozen. Drag split line to compare A/B.');
    });
  }
}

// PNG & WebM Exporters
function exportPNG(width, height) {
  showToast(`Rendering high-res ${width}x${height} PNG...`);

  const offCanvas = document.createElement('canvas');
  offCanvas.width = width;
  offCanvas.height = height;
  const gl = offCanvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true }) ||
             offCanvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true });
  if (gl && !gl.createVertexArray) gl.getExtension('OES_standard_derivatives');
  if (!gl) {
    showToast('WebGL not supported for export size', 'error');
    return;
  }

  const vShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vShader, renderer.vertSource);
  gl.compileShader(vShader);

  const fShader = gl.createShader(gl.FRAGMENT_SHADER, compiler.lastGeneratedGLSL);
  gl.compileShader(fShader);

  const prog = gl.createProgram();
  gl.attachShader(prog, vShader);
  gl.attachShader(prog, fShader);
  gl.linkProgram(prog);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    showToast('Export shader compile failed', 'error');
    return;
  }

  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

  gl.viewport(0, 0, width, height);
  gl.useProgram(prog);

  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uFrame = gl.getUniformLocation(prog, 'u_frame');
  const uDiag = gl.getUniformLocation(prog, 'u_diagnostic_mode');
  const uTile = gl.getUniformLocation(prog, 'u_tiling');

  if (uRes) gl.uniform2f(uRes, width, height);
  if (uTime) gl.uniform1f(uTime, state.currentTime);
  if (uFrame) gl.uniform1f(uFrame, state.currentFrame);
  if (uDiag) gl.uniform1i(uDiag, 0);
  if (uTile) gl.uniform1f(uTile, 1.0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  offCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generative-art-${width}x${height}.png`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('PNG Export complete!');
  }, 'image/png');
}

function exportWebMAnimation() {
  const canvas = document.getElementById('preview-canvas');
  if (!canvas.captureStream) {
    showToast('MediaRecorder stream capture not supported in this browser', 'error');
    return;
  }

  showToast('Recording animation sequence... Please wait.');
  state.playing = false;
  timeline.seekToFrame(0);

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generative-animation.webm';
    a.click();
    URL.revokeObjectURL(url);
    showToast('WebM Animation Export complete!');
  };

  recorder.start();

  let curF = 0;
  const stepRecord = () => {
    timeline.seekToFrame(curF);
    curF++;
    if (curF <= state.totalFrames) {
      setTimeout(stepRecord, 33);
    } else {
      recorder.stop();
    }
  };

  stepRecord();
}

function exportProjectJSON() {
  const project = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    nodes: state.nodes,
    edges: state.edges,
    frames: state.frames,
    keyframes: state.keyframes,
    settings: {
      totalFrames: state.totalFrames,
      fps: state.fps
    }
  };
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'studio-project.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Project JSON exported');
}

function importProjectJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.nodes && Array.isArray(data.nodes)) {
        state.saveSnapshot();
        state.nodes = data.nodes;
        state.edges = data.edges || [];
        state.frames = data.frames || [];
        state.keyframes = data.keyframes || {};
        if (data.settings) {
          if (data.settings.totalFrames) state.totalFrames = data.settings.totalFrames;
          if (data.settings.fps) state.fps = data.settings.fps;
        }
        editor.fitView();
        editor.renderAll();
        compiler.recompile();
        inspector.update();
        timeline.render();
        showToast('Project loaded successfully!');
      } else {
        showToast('Invalid project file format', 'error');
      }
    } catch(err) {
      showToast('Failed to parse project JSON', 'error');
    }
  };
  reader.readAsText(file);
}

function openGLSLModal() {
  const modal = document.getElementById('modal-glsl');
  const codeEl = document.getElementById('glsl-export-code');
  if (modal && codeEl) {
    codeEl.value = compiler.lastGeneratedGLSL;
    modal.classList.add('active');
  }
}

// Keyboard shortcuts
function initShortcuts() {
  window.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    if (e.key === ' ' && !isInput) {
      e.preventDefault();
      state.playing = !state.playing;
      const playBtn = document.getElementById('btn-play');
      if (playBtn) playBtn.textContent = state.playing ? '⏸' : '▶';
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) state.redo();
      else state.undo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      state.redo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      editor.duplicateSelected();
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
      e.preventDefault();
      editor.deleteSelected();
      return;
    }

    if (e.key === 'f' && !isInput) {
      editor.fitView();
      return;
    }

    if (e.key === 'g' && !isInput) {
      editor.frameSelected();
      return;
    }

    if (e.key === 'c' && !isInput) {
      toggleSelectedCollapse();
      return;
    }

    if (e.key === 'h' && !isInput) {
      state.hudVisible = !state.hudVisible;
      const hud = document.getElementById('hud-overlay');
      if (hud) hud.style.display = state.hudVisible ? 'flex' : 'none';
      return;
    }

    if (e.key === '?' && !isInput) {
      const modal = document.getElementById('modal-help');
      if (modal) modal.classList.toggle('active');
      return;
    }
  });

  // Command palette navigation
  const cmdInput = document.getElementById('cmd-palette-input');
  if (cmdInput) {
    cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        cmdSelectedIndex = Math.min(cmdSelectedIndex + 1, cmdResults.length - 1);
        renderCommandPaletteResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        cmdSelectedIndex = Math.max(cmdSelectedIndex - 1, 0);
        renderCommandPaletteResults();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (cmdResults[cmdSelectedIndex]) {
          spawnNode(cmdResults[cmdSelectedIndex].type);
          closeCommandPalette();
        }
      } else if (e.key === 'Escape') {
        closeCommandPalette();
      }
    });

    cmdInput.addEventListener('input', (e) => {
      filterCommandPalette(e.target.value);
    });
  }
}

// Mobile responsive tab switcher (< 1024px)
function initMobileTabs() {
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mobile-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.dataset.tab;
      document.body.className = '';
      if (tab === 'palette') document.body.classList.add('mobile-view-palette');
      else if (tab === 'preview') document.body.classList.add('mobile-view-preview');
      else if (tab === 'inspector') document.body.classList.add('mobile-view-inspector');
      else if (tab === 'timeline') document.body.classList.add('mobile-view-timeline');
    });
  });
}

// HUD Overlay Live Updater
function updateHUD() {
  const hudFps = document.getElementById('hud-fps');
  const hudNodes = document.getElementById('hud-nodes');
  const hudEdges = document.getElementById('hud-edges');
  const hudCompile = document.getElementById('hud-compile');
  const hudStatus = document.getElementById('hud-status');
  const hudSel = document.getElementById('hud-selected');

  if (hudFps) hudFps.textContent = Math.round(state.fpsRolling);
  if (hudNodes) hudNodes.textContent = state.nodes.length;
  if (hudEdges) hudEdges.textContent = state.edges.length;
  if (hudCompile) hudCompile.textContent = `${state.compileTimeMs}ms`;
  if (hudStatus) {
    hudStatus.textContent = state.validationStatus;
    hudStatus.style.color = state.validationStatus === 'Valid' ? 'var(--success)' : 'var(--danger)';
  }
  if (hudSel) {
    const firstId = Array.from(state.selectedNodeIds)[0];
    const n = state.nodes.find(node => node.id === firstId);
    hudSel.textContent = n ? n.title : 'None';
  }
}

// Main Animation & Render Loop
let lastTime = performance.now();
let frameCounter = 0;
let fpsTimer = performance.now();

function mainLoop(now) {
  const deltaSec = (now - lastTime) / 1000.0;
  lastTime = now;

  // Rolling FPS calculation
  frameCounter++;
  if (now - fpsTimer >= 500) {
    state.fpsRolling = (frameCounter * 1000) / (now - fpsTimer);
    frameCounter = 0;
    fpsTimer = now;
    updateHUD();
  }

  // Timeline advance & keyframe evaluation
  timeline.tick(deltaSec);

  // Render WebGL frame
  renderer.renderFrame(state.currentTime, state.currentFrame);

  requestAnimationFrame(mainLoop);
}

// Studio App Bootstrap
function initStudio() {
  renderer = new WebGLRenderer();
  editor = new GraphEditor();
  inspector.container = document.getElementById('inspector-content');
  timeline = new AnimationTimeline();

  initPalette();
  initViewportControls();
  initShortcuts();
  initMobileTabs();

  // Presets select dropdown
  const presetSelect = document.getElementById('preset-select');
  if (presetSelect) {
    for (const k in PRESETS) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = PRESETS[k].name;
      presetSelect.appendChild(opt);
    }
    presetSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        loadPreset(e.target.value);
      }
    });
  }

  // Theme switch dropdown
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      document.body.setAttribute('data-theme', e.target.value);
    });
  }

  // Project Import / Export buttons
  const exportBtn = document.getElementById('btn-export-menu');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const m = document.getElementById('modal-export');
      if (m) m.classList.add('active');
    });
  }

  const fileInput = document.getElementById('project-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importProjectJSON(e.target.files[0]);
      }
    });
  }

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-backdrop').classList.remove('active');
    });
  });

  // Try loading autosave, else default to marble preset
  const loaded = state.loadFromLocalStorage();
  if (loaded) {
    editor.fitView();
    editor.renderAll();
    compiler.recompile();
    inspector.update();
    timeline.render();
    showToast('Restored last studio session');
  } else {
    loadPreset('marble');
  }

  requestAnimationFrame(mainLoop);
}

window.addEventListener('DOMContentLoaded', initStudio);
"""
