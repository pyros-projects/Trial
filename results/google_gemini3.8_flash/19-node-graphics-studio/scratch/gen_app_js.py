def get_app_js():
    return """
// Main Application State
class StudioState {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.frames = [];
    this.selectedNodeIds = new Set();
    this.selectedEdgeIds = new Set();
    this.selectedFrameIds = new Set();
    this.previewTargetNodeId = null; // null means final_output
    
    // Viewport pan & zoom
    this.pan = { x: 100, y: 100 };
    this.zoom = 1.0;
    
    // Timeline & animation
    this.playing = true;
    this.currentTime = 0.0;
    this.currentFrame = 0;
    this.totalFrames = 120;
    this.fps = 30;
    this.loopMode = 'loop'; // 'loop', 'once', 'pingpong'
    this.pingpongDir = 1;
    this.keyframes = {}; // { [nodeId]: { [prop]: [ {frame, val, interp} ] } }
    
    // Diagnostics & Viewport
    this.diagnosticMode = 0; // 0=normal, 1=R, 2=G, 3=B, 4=A, 5=Luma, 6=Normal, 7=Range, 8=NaN
    this.tiling = 1.0;
    this.checkerboard = true;
    this.abActive = false;
    this.abSplitRatio = 0.5;
    this.frozenCanvas = null;
    
    // Editor settings
    this.snapToGrid = true;
    this.gridSize = 20;
    this.theme = 'dark';
    this.hudVisible = true;
    
    // Performance metrics
    this.lastFrameTime = performance.now();
    this.fpsRolling = 60.0;
    this.compileTimeMs = 0.0;
    this.renderTimeMs = 0.0;
    this.dirtyNodeCount = 0;
    this.validationStatus = 'Valid';
    
    // Undo / Redo
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndo = 40;
    
    // Wire dragging
    this.wireDrag = null; // { fromNode, fromPort, isOutput, x, y, portType }
    
    // Marquee selection
    this.marquee = null; // { startX, startY, currentX, currentY }
  }

  saveSnapshot() {
    const snap = JSON.stringify({
      nodes: this.nodes,
      edges: this.edges,
      frames: this.frames,
      keyframes: this.keyframes,
      pan: this.pan,
      zoom: this.zoom
    });
    this.undoStack.push(snap);
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
    this.updateAutosaveStatus('Saving...');
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const current = JSON.stringify({
      nodes: this.nodes,
      edges: this.edges,
      frames: this.frames,
      keyframes: this.keyframes,
      pan: this.pan,
      zoom: this.zoom
    });
    this.redoStack.push(current);
    const snap = JSON.parse(this.undoStack.pop());
    this.restoreSnapshot(snap);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const current = JSON.stringify({
      nodes: this.nodes,
      edges: this.edges,
      frames: this.frames,
      keyframes: this.keyframes,
      pan: this.pan,
      zoom: this.zoom
    });
    this.undoStack.push(current);
    const snap = JSON.parse(this.redoStack.pop());
    this.restoreSnapshot(snap);
  }

  restoreSnapshot(snap) {
    this.nodes = snap.nodes || [];
    this.edges = snap.edges || [];
    this.frames = snap.frames || [];
    this.keyframes = snap.keyframes || {};
    if (snap.pan) this.pan = snap.pan;
    if (snap.zoom) this.zoom = snap.zoom;
    this.selectedNodeIds.clear();
    this.selectedEdgeIds.clear();
    this.selectedFrameIds.clear();
    
    editor.renderAll();
    compiler.recompile();
    inspector.update();
    timeline.render();
  }

  updateAutosaveStatus(msg) {
    const el = document.getElementById('hud-autosave');
    if (el) el.textContent = msg;
    clearTimeout(this._autosaveTimer);
    this._autosaveTimer = setTimeout(() => {
      this.persistToLocalStorage();
      if (el) el.textContent = 'Autosaved';
    }, 1500);
  }

  persistToLocalStorage() {
    try {
      const data = {
        nodes: this.nodes,
        edges: this.edges,
        frames: this.frames,
        keyframes: this.keyframes
      };
      localStorage.setItem('node_studio_autosave', JSON.stringify(data));
    } catch(e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem('node_studio_autosave');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.nodes && data.nodes.length > 0) {
          this.nodes = data.nodes;
          this.edges = data.edges || [];
          this.frames = data.frames || [];
          this.keyframes = data.keyframes || {};
          return true;
        }
      }
    } catch(e) {
      console.warn('LocalStorage load failed:', e);
    }
    return false;
  }
}

const state = new StudioState();

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// Compiler & Topological Sort
class GraphCompiler {
  constructor() {
    this.lastValidProgram = null;
    this.lastGeneratedGLSL = '';
  }

  detectCyclesAndSort() {
    const adj = new Map();
    const inDegree = new Map();
    const nodeMap = new Map();

    state.nodes.forEach(n => {
      adj.set(n.id, []);
      inDegree.set(n.id, 0);
      nodeMap.set(n.id, n);
    });

    state.edges.forEach(e => {
      if (adj.has(e.fromNode) && inDegree.has(e.toNode)) {
        adj.get(e.fromNode).push(e.toNode);
        inDegree.set(e.toNode, inDegree.get(e.toNode) + 1);
      }
    });

    // Kahn's algorithm
    const queue = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const sortedIds = [];
    while (queue.length > 0) {
      const u = queue.shift();
      sortedIds.push(u);
      for (const v of adj.get(u)) {
        inDegree.set(v, inDegree.get(v) - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    if (sortedIds.length !== state.nodes.length) {
      const cycleNodeIds = [];
      inDegree.forEach((deg, id) => {
        if (deg > 0) cycleNodeIds.push(id);
      });
      return { hasCycle: true, sortedNodes: [], cycleNodeIds };
    }

    const sortedNodes = sortedIds.map(id => nodeMap.get(id)).filter(Boolean);
    return { hasCycle: false, sortedNodes, cycleNodeIds: [] };
  }

  generateGLSL() {
    const { hasCycle, sortedNodes, cycleNodeIds } = this.detectCyclesAndSort();
    if (hasCycle) {
      state.validationStatus = 'Cycle Error';
      // Mark cycle nodes with error class
      document.querySelectorAll('.node-card').forEach(card => {
        if (cycleNodeIds.includes(card.dataset.id)) {
          card.classList.add('error');
        } else {
          card.classList.remove('error');
        }
      });
      showToast('Illegal cycle detected in graph! Cycle prevented.', 'error');
      return null;
    }

    // Clear error highlights
    document.querySelectorAll('.node-card.error').forEach(c => c.classList.remove('error'));
    state.validationStatus = 'Valid';

    let glsl = getGlslPreamble();
    glsl += '\\n// --- Compiled DAG Evaluation ---\\n';
    glsl += 'void main() {\\n';
    glsl += '  vec2 v_uv = (gl_FragCoord.xy / u_resolution.xy);\\n';
    glsl += '  if (u_tiling > 1.0) v_uv = fract(v_uv * u_tiling);\\n\\n';

    // Map output ports to GLSL variable names
    const portVarMap = new Map(); // key: `${nodeId}_${portName}`, value: varName

    for (const node of sortedNodes) {
      const def = NODE_TYPES[node.type];
      if (!def || def.isComment) continue;

      const outPrefix = `n_${node.id}`;
      const inputExprs = {};

      // Prepare inputs
      (def.inputs || []).forEach(inp => {
        const edge = state.edges.find(e => e.toNode === node.id && e.toPort === inp.name);
        if (edge) {
          const fromNode = state.nodes.find(n => n.id === edge.fromNode);
          const fromDef = fromNode ? NODE_TYPES[fromNode.type] : null;
          const fromPortDef = fromDef ? fromDef.outputs.find(p => p.name === edge.fromPort) : null;
          const sourceVar = portVarMap.get(`${edge.fromNode}_${edge.fromPort}`);
          
          if (sourceVar && fromPortDef) {
            inputExprs[inp.name] = castGlsl(fromPortDef.type, inp.type, sourceVar);
          } else {
            inputExprs[inp.name] = this.formatDefaultInput(inp, node.params[inp.name]);
          }
        } else {
          inputExprs[inp.name] = this.formatDefaultInput(inp, node.params[inp.name]);
        }
      });

      // Record output variable names
      (def.outputs || []).forEach(outp => {
        portVarMap.set(`${node.id}_${outp.name}`, `${outPrefix}_${outp.name}`);
      });

      // Compile node statement
      const nodeGlsl = def.compile(node, inputExprs, outPrefix);
      glsl += `  // Node: ${node.title} (${node.id})\\n`;
      glsl += `  ${nodeGlsl.trim()}\\n\\n`;
    }

    // Determine final target variable for rendering
    let targetVar = 'vec4(0.0, 0.0, 0.0, 1.0)';
    if (state.previewTargetNodeId) {
      const pNode = state.nodes.find(n => n.id === state.previewTargetNodeId);
      const pDef = pNode ? NODE_TYPES[pNode.type] : null;
      if (pDef && pDef.outputs && pDef.outputs.length > 0) {
        const firstOut = pDef.outputs[0];
        const vName = portVarMap.get(`${pNode.id}_${firstOut.name}`);
        if (vName) {
          targetVar = castGlsl(firstOut.type, TYPE_VEC4, vName);
        }
      }
    } else {
      const outNode = state.nodes.find(n => n.type === 'final_output');
      if (outNode) {
        targetVar = `n_${outNode.id}_out`;
      } else if (sortedNodes.length > 0) {
        // Fallback to last node's first output
        for (let i = sortedNodes.length - 1; i >= 0; i--) {
          const n = sortedNodes[i];
          const d = NODE_TYPES[n.type];
          if (d && d.outputs && d.outputs.length > 0) {
            const vName = portVarMap.get(`${n.id}_${d.outputs[0].name}`);
            if (vName) {
              targetVar = castGlsl(d.outputs[0].type, TYPE_VEC4, vName);
              break;
            }
          }
        }
      }
    }

    glsl += `  vec4 final_raw = ${targetVar};\\n`;
    glsl += `  gl_FragColor = applyDiagnostics(final_raw, v_uv);\\n`;
    glsl += '}\\n';

    this.lastGeneratedGLSL = glsl;
    return glsl;
  }

  formatDefaultInput(portDef, val) {
    const v = val !== undefined ? val : portDef.default;
    if (portDef.type === TYPE_FLOAT) {
      return Number(v || 0).toFixed(4);
    } else if (portDef.type === TYPE_VEC2) {
      const arr = Array.isArray(v) ? v : [0, 0];
      return `vec2(${Number(arr[0] || 0).toFixed(4)}, ${Number(arr[1] || 0).toFixed(4)})`;
    } else if (portDef.type === TYPE_VEC3) {
      const arr = Array.isArray(v) ? v : [0, 0, 0];
      return `vec3(${Number(arr[0] || 0).toFixed(4)}, ${Number(arr[1] || 0).toFixed(4)}, ${Number(arr[2] || 0).toFixed(4)})`;
    } else if (portDef.type === TYPE_VEC4) {
      const arr = Array.isArray(v) ? v : [0, 0, 0, 1];
      return `vec4(${Number(arr[0] || 0).toFixed(4)}, ${Number(arr[1] || 0).toFixed(4)}, ${Number(arr[2] || 0).toFixed(4)}, ${Number(arr[3] !== undefined ? arr[3] : 1).toFixed(4)})`;
    }
    return '0.0';
  }

  recompile() {
    const t0 = performance.now();
    const glsl = this.generateGLSL();
    if (!glsl) return false;

    const gl = renderer.gl;
    if (!gl) return false;

    const vertShader = renderer.createShader(gl.VERTEX_SHADER, renderer.vertSource);
    const fragShader = renderer.createShader(gl.FRAGMENT_SHADER, glsl);

    if (!vertShader || !fragShader) {
      state.validationStatus = 'Shader Compile Error';
      return false;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vertShader);
    gl.attachShader(prog, fragShader);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(prog);
      console.error('Program Link Error:', err);
      state.validationStatus = 'Link Error';
      showToast('Shader link error: ' + err.substring(0, 80), 'error');
      return false;
    }

    if (this.lastValidProgram) {
      gl.deleteProgram(this.lastValidProgram);
    }
    this.lastValidProgram = prog;
    renderer.program = prog;
    renderer.locateUniforms();

    const t1 = performance.now();
    state.compileTimeMs = (t1 - t0).toFixed(1);
    state.validationStatus = 'Valid';
    return true;
  }
}

const compiler = new GraphCompiler();

// WebGL Preview Renderer
class WebGLRenderer {
  constructor() {
    this.canvas = document.getElementById('preview-canvas');
    this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true }) ||
              this.canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
    this.program = null;
    this.uniforms = {};

    this.vertSource = `
      attribute vec2 a_pos;
      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    this.initQuad();
    this.resizeCanvas(512, 512);
  }

  initQuad() {
    const gl = this.gl;
    if (!gl) return;
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  createShader(type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(shader);
      console.error('Shader compile error:', err);
      showToast('Compile Error: ' + err.substring(0, 100), 'error');
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  resizeCanvas(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.gl) {
      this.gl.viewport(0, 0, w, h);
    }
  }

  locateUniforms() {
    const gl = this.gl;
    const p = this.program;
    if (!gl || !p) return;
    this.uniforms = {
      resolution: gl.getUniformLocation(p, 'u_resolution'),
      time: gl.getUniformLocation(p, 'u_time'),
      frame: gl.getUniformLocation(p, 'u_frame'),
      mouse: gl.getUniformLocation(p, 'u_mouse'),
      diagnosticMode: gl.getUniformLocation(p, 'u_diagnostic_mode'),
      tiling: gl.getUniformLocation(p, 'u_tiling')
    };
  }

  renderFrame(timeSec, frameNum) {
    const gl = this.gl;
    if (!gl || !this.program) return;

    const tStart = performance.now();

    gl.useProgram(this.program);

    // Bind quad buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const aPos = gl.getAttribLocation(this.program, 'a_pos');
    if (aPos >= 0) {
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }

    // Set standard uniforms
    if (this.uniforms.resolution) gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    if (this.uniforms.time) gl.uniform1f(this.uniforms.time, timeSec);
    if (this.uniforms.frame) gl.uniform1f(this.uniforms.frame, frameNum);
    if (this.uniforms.mouse) gl.uniform2f(this.uniforms.mouse, 0.5, 0.5);
    if (this.uniforms.diagnosticMode) gl.uniform1i(this.uniforms.diagnosticMode, state.diagnosticMode);
    if (this.uniforms.tiling) gl.uniform1f(this.uniforms.tiling, state.tiling);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const tEnd = performance.now();
    state.renderTimeMs = (tEnd - tStart).toFixed(2);
  }

  readPixel(x, y) {
    const gl = this.gl;
    if (!gl) return null;
    const px = Math.floor(x);
    const py = Math.floor(this.canvas.height - y - 1);
    const pixel = new Uint8Array(4);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return pixel;
  }
}

let renderer = null;
"""

// Node Graph Editor Class
class GraphEditor {
  constructor() {
    this.container = document.getElementById('editor-area');
    this.plane = document.getElementById('editor-plane');
    this.wiresSvg = document.getElementById('wires-svg');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapViewport = document.getElementById('minimap-viewport');
    this.bgCanvas = document.getElementById('graph-canvas-bg');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.isDraggingNode = false;
    this.draggedNodes = [];
    this.dragStartPositions = new Map();
    this.mouseWorldPos = { x: 0, y: 0 };

    this.initEvents();
    this.resizeBg();
  }

  resizeBg() {
    const rect = this.container.getBoundingClientRect();
    this.bgCanvas.width = rect.width;
    this.bgCanvas.height = rect.height;
    this.drawBackgroundGrid();
  }

  drawBackgroundGrid() {
    const ctx = this.bgCtx;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const zoom = state.zoom;
    const panX = state.pan.x;
    const panY = state.pan.y;

    const gridSize = 20 * zoom;
    if (gridSize < 5) return;

    const startX = (panX % gridSize + gridSize) % gridSize;
    const startY = (panY % gridSize + gridSize) % gridSize;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const dotSize = Math.max(1, 1.5 * zoom);

    for (let x = startX; x < w; x += gridSize) {
      for (let y = startY; y < h; y += gridSize) {
        ctx.fillRect(x, y, dotSize, dotSize);
      }
    }

    // Draw major grid lines
    const majorGridSize = gridSize * 5;
    const majorStartX = (panX % majorGridSize + majorGridSize) % majorGridSize;
    const majorStartY = (panY % majorGridSize + majorGridSize) % majorGridSize;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = majorStartX; x < w; x += majorGridSize) {
      for (let y = majorStartY; y < h; y += majorGridSize) {
        ctx.fillRect(x - 0.5, y - 0.5, dotSize + 1, dotSize + 1);
      }
    }
  }

  screenToWorld(sx, sy) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (sx - rect.left - state.pan.x) / state.zoom,
      y: (sy - rect.top - state.pan.y) / state.zoom
    };
  }

  worldToScreen(wx, wy) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: wx * state.zoom + state.pan.x + rect.left,
      y: wy * state.zoom + state.pan.y + rect.top
    };
  }

  initEvents() {
    window.addEventListener('resize', () => {
      this.resizeBg();
      this.renderMinimap();
    });

    // Panning & zooming on editor area
    this.container.addEventListener('mousedown', (e) => {
      if (e.target === this.container || e.target === this.bgCanvas || e.target === this.plane) {
        if (e.button === 1 || e.altKey || (e.button === 0 && e.spaceKey)) {
          // Middle click or Alt+click: pan
          this.isPanning = true;
          this.panStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
          e.preventDefault();
        } else if (e.button === 0) {
          // Marquee box selection
          if (!e.shiftKey) {
            state.selectedNodeIds.clear();
            state.selectedEdgeIds.clear();
            state.selectedFrameIds.clear();
            this.updateNodeSelectionClasses();
            inspector.update();
          }
          const w = this.screenToWorld(e.clientX, e.clientY);
          state.marquee = { startX: w.x, startY: w.y, currentX: w.x, currentY: w.y };
          this.updateMarquee();
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseWorldPos = this.screenToWorld(e.clientX, e.clientY);

      if (this.isPanning) {
        state.pan.x = e.clientX - this.panStart.x;
        state.pan.y = e.clientY - this.panStart.y;
        this.updatePlaneTransform();
        this.drawBackgroundGrid();
        this.renderMinimap();
        return;
      }

      if (this.isDraggingNode) {
        const dx = (e.clientX - this.dragNodeStartMouse.x) / state.zoom;
        const dy = (e.clientY - this.dragNodeStartMouse.y) / state.zoom;

        this.draggedNodes.forEach(n => {
          const orig = this.dragStartPositions.get(n.id);
          if (orig) {
            let nx = orig.x + dx;
            let ny = orig.y + dy;
            if (state.snapToGrid) {
              nx = Math.round(nx / state.gridSize) * state.gridSize;
              ny = Math.round(ny / state.gridSize) * state.gridSize;
            }
            n.x = nx;
            n.y = ny;
            const el = document.getElementById(`node-${n.id}`);
            if (el) {
              el.style.left = `${nx}px`;
              el.style.top = `${ny}px`;
            }
          }
        });

        this.renderWires();
        this.renderMinimap();
        return;
      }

      if (state.wireDrag) {
        state.wireDrag.x = this.mouseWorldPos.x;
        state.wireDrag.y = this.mouseWorldPos.y;
        this.renderWires();
        return;
      }

      if (state.marquee) {
        state.marquee.currentX = this.mouseWorldPos.x;
        state.marquee.currentY = this.mouseWorldPos.y;
        this.updateMarquee();
        this.selectNodesInMarquee();
        return;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
      }

      if (this.isDraggingNode) {
        this.isDraggingNode = false;
        state.saveSnapshot();
      }

      if (state.wireDrag) {
        this.endWireDrag(e);
      }

      if (state.marquee) {
        state.marquee = null;
        this.updateMarquee();
      }
    });

    // Wheel zoom towards cursor
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(Math.max(state.zoom * zoomFactor, 0.2), 2.5);

      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      state.pan.x = mouseX - (mouseX - state.pan.x) * (newZoom / state.zoom);
      state.pan.y = mouseY - (mouseY - state.pan.y) * (newZoom / state.zoom);
      state.zoom = newZoom;

      this.updatePlaneTransform();
      this.drawBackgroundGrid();
      this.renderMinimap();
    }, { passive: false });

    // Minimap interaction
    this.minimapCanvas.addEventListener('mousedown', (e) => {
      this.handleMinimapClick(e);
      const onMove = (ev) => this.handleMinimapClick(ev);
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    // Right-click context menu
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const nodeEl = e.target.closest('.node-card');
      const wireEl = e.target.closest('.wire-path');
      if (wireEl) {
        showContextMenu(e.clientX, e.clientY, 'wire', wireEl.dataset.id);
      } else if (nodeEl) {
        showContextMenu(e.clientX, e.clientY, 'node', nodeEl.dataset.id);
      } else {
        showContextMenu(e.clientX, e.clientY, 'canvas');
      }
    });
  }

  handleMinimapClick(e) {
    const rect = this.minimapCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    // Bounds of all nodes
    const bounds = this.getGraphBounds();
    const targetWorldX = bounds.minX + mx * (bounds.maxX - bounds.minX);
    const targetWorldY = bounds.minY + my * (bounds.maxY - bounds.minY);

    const cRect = this.container.getBoundingClientRect();
    state.pan.x = cRect.width / 2 - targetWorldX * state.zoom;
    state.pan.y = cRect.height / 2 - targetWorldY * state.zoom;

    this.updatePlaneTransform();
    this.drawBackgroundGrid();
    this.renderMinimap();
  }

  updatePlaneTransform() {
    this.plane.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
    const zoomPct = Math.round(state.zoom * 100);
    const zEl = document.getElementById('zoom-val');
    if (zEl) zEl.textContent = `${zoomPct}%`;
  }

  updateMarquee() {
    const el = document.getElementById('marquee-box');
    if (!el) return;
    if (!state.marquee) {
      el.style.display = 'none';
      return;
    }
    const x1 = Math.min(state.marquee.startX, state.marquee.currentX);
    const y1 = Math.min(state.marquee.startY, state.marquee.currentY);
    const x2 = Math.max(state.marquee.startX, state.marquee.currentX);
    const y2 = Math.max(state.marquee.startY, state.marquee.currentY);

    const s1 = this.worldToScreen(x1, y1);
    const s2 = this.worldToScreen(x2, y2);

    const cRect = this.container.getBoundingClientRect();
    el.style.display = 'block';
    el.style.left = `${s1.x - cRect.left}px`;
    el.style.top = `${s1.y - cRect.top}px`;
    el.style.width = `${s2.x - s1.x}px`;
    el.style.height = `${s2.y - s1.y}px`;
  }

  selectNodesInMarquee() {
    if (!state.marquee) return;
    const x1 = Math.min(state.marquee.startX, state.marquee.currentX);
    const y1 = Math.min(state.marquee.startY, state.marquee.currentY);
    const x2 = Math.max(state.marquee.startX, state.marquee.currentX);
    const y2 = Math.max(state.marquee.startY, state.marquee.currentY);

    state.nodes.forEach(n => {
      const nw = 200;
      const nh = n.collapsed ? 36 : 140;
      const inBox = (n.x + nw >= x1 && n.x <= x2 && n.y + nh >= y1 && n.y <= y2);
      if (inBox) state.selectedNodeIds.add(n.id);
    });

    this.updateNodeSelectionClasses();
    inspector.update();
  }

  updateNodeSelectionClasses() {
    document.querySelectorAll('.node-card').forEach(el => {
      const id = el.dataset.id;
      if (state.selectedNodeIds.has(id)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }

  fitView() {
    const bounds = this.getGraphBounds();
    const cRect = this.container.getBoundingClientRect();
    const gw = bounds.maxX - bounds.minX + 200;
    const gh = bounds.maxY - bounds.minY + 200;

    const scaleX = cRect.width / gw;
    const scaleY = cRect.height / gh;
    let targetZoom = Math.min(Math.min(scaleX, scaleY), 1.2);
    targetZoom = Math.max(0.3, targetZoom);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    state.zoom = targetZoom;
    state.pan.x = cRect.width / 2 - centerX * state.zoom;
    state.pan.y = cRect.height / 2 - centerY * state.zoom;

    this.updatePlaneTransform();
    this.drawBackgroundGrid();
    this.renderMinimap();
  }

  getGraphBounds() {
    if (state.nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 220);
      maxY = Math.max(maxY, n.y + 180);
    });
    return { minX, minY, maxX, maxY };
  }

  renderAll() {
    this.renderFrames();
    this.renderNodes();
    this.renderWires();
    this.renderMinimap();
    this.updatePlaneTransform();
    this.drawBackgroundGrid();
  }

  renderFrames() {
    const existing = this.plane.querySelectorAll('.node-frame');
    existing.forEach(e => e.remove());

    state.frames.forEach(f => {
      const el = document.createElement('div');
      el.className = `node-frame ${state.selectedFrameIds.has(f.id) ? 'selected' : ''}`;
      el.id = `frame-${f.id}`;
      el.style.left = `${f.x}px`;
      el.style.top = `${f.y}px`;
      el.style.width = `${f.width}px`;
      el.style.height = `${f.height}px`;

      const header = document.createElement('div');
      header.className = 'frame-header';
      header.textContent = f.title;

      header.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        state.selectedFrameIds.clear();
        state.selectedFrameIds.add(f.id);
        
        // Collect enclosed nodes to move together
        const enclosed = state.nodes.filter(n => 
          n.x >= f.x && n.x <= f.x + f.width &&
          n.y >= f.y && n.y <= f.y + f.height
        );
        
        this.isDraggingNode = true;
        this.draggedNodes = enclosed;
        this.dragNodeStartMouse = { x: e.clientX, y: e.clientY };
        this.dragStartPositions.clear();
        enclosed.forEach(n => this.dragStartPositions.set(n.id, { x: n.x, y: n.y }));
        this.dragStartPositions.set(f.id, { x: f.x, y: f.y });

        e.stopPropagation();
      });

      el.appendChild(header);
      this.plane.appendChild(el);
    });
  }

  renderNodes() {
    const existing = this.plane.querySelectorAll('.node-card');
    existing.forEach(e => e.remove());

    state.nodes.forEach(n => {
      const def = NODE_TYPES[n.type];
      if (!def) return;

      const card = document.createElement('div');
      card.className = `node-card ${def.isComment ? 'comment-node' : ''} ${state.selectedNodeIds.has(n.id) ? 'selected' : ''}`;
      card.id = `node-${n.id}`;
      card.dataset.id = n.id;
      card.style.left = `${n.x}px`;
      card.style.top = `${n.y}px`;

      // Header
      const header = document.createElement('div');
      header.className = 'node-header';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'node-title-group';

      const catTag = document.createElement('span');
      catTag.className = 'node-category-tag';
      catTag.style.background = def.color || '#38bdf8';

      const title = document.createElement('span');
      title.className = 'node-title';
      title.textContent = n.title;

      titleGroup.appendChild(catTag);
      titleGroup.appendChild(title);

      const controls = document.createElement('div');
      controls.className = 'node-controls-top';

      // Intermediate preview badge button
      if (!def.isOutput && !def.isComment) {
        const previewBtn = document.createElement('button');
        previewBtn.className = 'node-icon-btn';
        previewBtn.title = 'Preview this node';
        previewBtn.innerHTML = state.previewTargetNodeId === n.id ? '★' : '☆';
        if (state.previewTargetNodeId === n.id) previewBtn.style.color = 'var(--accent)';
        previewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.previewTargetNodeId = state.previewTargetNodeId === n.id ? null : n.id;
          compiler.recompile();
          this.renderNodes();
        });
        controls.appendChild(previewBtn);
      }

      // Collapse button
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'node-icon-btn';
      collapseBtn.title = 'Collapse/Expand';
      collapseBtn.textContent = n.collapsed ? '▼' : '▲';
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        n.collapsed = !n.collapsed;
        card.classList.toggle('collapsed', n.collapsed);
        collapseBtn.textContent = n.collapsed ? '▼' : '▲';
        this.renderAll();
      });
      controls.appendChild(collapseBtn);

      header.appendChild(titleGroup);
      header.appendChild(controls);

      // Node card drag & selection
      header.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (!e.shiftKey && !state.selectedNodeIds.has(n.id)) {
          state.selectedNodeIds.clear();
          state.selectedEdgeIds.clear();
        }
        state.selectedNodeIds.add(n.id);
        this.updateNodeSelectionClasses();
        inspector.update();

        this.isDraggingNode = true;
        this.dragNodeStartMouse = { x: e.clientX, y: e.clientY };
        this.draggedNodes = state.nodes.filter(node => state.selectedNodeIds.has(node.id));
        this.dragStartPositions.clear();
        this.draggedNodes.forEach(dn => {
          this.dragStartPositions.set(dn.id, { x: dn.x, y: dn.y });
        });

        e.stopPropagation();
      });

      card.appendChild(header);

      if (def.isComment) {
        const ta = document.createElement('textarea');
        ta.value = n.params.text || 'Add note...';
        ta.addEventListener('input', (e) => {
          n.params.text = e.target.value;
          state.updateAutosaveStatus('Saving...');
        });
        card.appendChild(ta);
        this.plane.appendChild(card);
        return;
      }

      if (!n.collapsed) {
        // Ports Body
        const body = document.createElement('div');
        body.className = 'node-body';

        const leftPorts = document.createElement('div');
        leftPorts.className = 'ports-col ports-left';

        (def.inputs || []).forEach(inp => {
          const row = document.createElement('div');
          row.className = 'port-row';

          const dot = document.createElement('div');
          dot.className = `port-dot port-${inp.type}`;
          dot.title = `${inp.name} (${inp.type})`;
          dot.dataset.nodeId = n.id;
          dot.dataset.portName = inp.name;
          dot.dataset.isOutput = 'false';
          dot.dataset.type = inp.type;

          const isConn = state.edges.some(e => e.toNode === n.id && e.toPort === inp.name);
          if (isConn) dot.classList.add('connected');

          dot.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
              e.stopPropagation();
              this.startWireDrag(n.id, inp.name, false, inp.type, e);
            }
          });

          const label = document.createElement('span');
          label.className = 'port-label';
          label.textContent = inp.name;

          row.appendChild(dot);
          row.appendChild(label);
          leftPorts.appendChild(row);
        });

        const rightPorts = document.createElement('div');
        rightPorts.className = 'ports-col ports-right';

        (def.outputs || []).forEach(outp => {
          const row = document.createElement('div');
          row.className = 'port-row';

          const label = document.createElement('span');
          label.className = 'port-label';
          label.textContent = outp.name;

          const dot = document.createElement('div');
          dot.className = `port-dot port-${outp.type}`;
          dot.title = `${outp.name} (${outp.type})`;
          dot.dataset.nodeId = n.id;
          dot.dataset.portName = outp.name;
          dot.dataset.isOutput = 'true';
          dot.dataset.type = outp.type;

          const isConn = state.edges.some(e => e.fromNode === n.id && e.fromPort === outp.name);
          if (isConn) dot.classList.add('connected');

          dot.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
              e.stopPropagation();
              this.startWireDrag(n.id, outp.name, true, outp.type, e);
            }
          });

          row.appendChild(label);
          row.appendChild(dot);
          rightPorts.appendChild(row);
        });

        body.appendChild(leftPorts);
        body.appendChild(rightPorts);
        card.appendChild(body);
      }

      this.plane.appendChild(card);
    });
  }

  startWireDrag(nodeId, portName, isOutput, portType, e) {
    const w = this.screenToWorld(e.clientX, e.clientY);
    state.wireDrag = {
      fromNode: nodeId,
      fromPort: portName,
      isOutput: isOutput,
      portType: portType,
      x: w.x,
      y: w.y
    };
    this.renderWires();
  }

  endWireDrag(e) {
    const wd = state.wireDrag;
    state.wireDrag = null;
    this.renderWires();

    const targetEl = document.elementFromPoint(e.clientX, e.clientY);
    const dot = targetEl ? targetEl.closest('.port-dot') : null;
    if (!dot) return;

    const targetNodeId = dot.dataset.nodeId;
    const targetPortName = dot.dataset.portName;
    const targetIsOutput = dot.dataset.isOutput === 'true';
    const targetType = dot.dataset.type;

    if (wd.isOutput === targetIsOutput) {
      showToast('Cannot connect output to output or input to input!', 'error');
      return;
    }

    if (wd.fromNode === targetNodeId) {
      showToast('Cannot connect a node to itself!', 'error');
      return;
    }

    const fromNode = wd.isOutput ? wd.fromNode : targetNodeId;
    const fromPort = wd.isOutput ? wd.fromPort : targetPortName;
    const toNode = wd.isOutput ? targetNodeId : wd.fromNode;
    const toPort = wd.isOutput ? targetPortName : wd.fromPort;

    // Check if duplicate connection
    const existing = state.edges.find(ed => ed.toNode === toNode && ed.toPort === toPort);
    if (existing) {
      // Remove old edge on that input
      state.edges = state.edges.filter(ed => ed !== existing);
    }

    // Add new edge candidate
    const newEdge = {
      id: `e_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      fromNode,
      fromPort,
      toNode,
      toPort
    };
    state.edges.push(newEdge);

    // Test cycle
    const { hasCycle } = compiler.detectCyclesAndSort();
    if (hasCycle) {
      state.edges.pop(); // Revert
      showToast('Illegal cyclic connection prevented!', 'error');
      return;
    }

    state.saveSnapshot();
    this.renderAll();
    compiler.recompile();
    showToast('Connected ports successfully');
  }

  getSocketWorldPos(nodeId, portName, isOutput) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const el = document.getElementById(`node-${nodeId}`);
    if (el) {
      const dot = el.querySelector(`.port-dot[data-port-name="${portName}"][data-is-output="${isOutput ? 'true' : 'false'}"]`);
      if (dot) {
        const dotRect = dot.getBoundingClientRect();
        return this.screenToWorld(dotRect.left + dotRect.width / 2, dotRect.top + dotRect.height / 2);
      }
    }

    // Fallback estimate
    const x = isOutput ? node.x + 200 : node.x;
    const y = node.y + 40;
    return { x, y };
  }

  renderWires() {
    let svg = '';

    // Render existing edges
    state.edges.forEach(e => {
      const p1 = this.getSocketWorldPos(e.fromNode, e.fromPort, true);
      const p2 = this.getSocketWorldPos(e.toNode, e.toPort, false);

      const dx = Math.max(40, Math.abs(p2.x - p1.x) * 0.5);
      const pathD = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;

      const fromNode = state.nodes.find(n => n.id === e.fromNode);
      const fromDef = fromNode ? NODE_TYPES[fromNode.type] : null;
      const outPortDef = fromDef ? fromDef.outputs.find(p => p.name === e.fromPort) : null;
      const typeClass = outPortDef ? `wire-${outPortDef.type}` : 'wire-float';
      const isSel = state.selectedEdgeIds.has(e.id);

      svg += `<path class="wire-path ${typeClass} ${isSel ? 'selected' : ''}" data-id="${e.id}" d="${pathD}" />`;
    });

    // Render wire currently being dragged
    if (state.wireDrag) {
      const wd = state.wireDrag;
      const p1 = this.getSocketWorldPos(wd.fromNode, wd.fromPort, wd.isOutput);
      const p2 = { x: wd.x, y: wd.y };

      const startP = wd.isOutput ? p1 : p2;
      const endP = wd.isOutput ? p2 : p1;

      const dx = Math.max(40, Math.abs(endP.x - startP.x) * 0.5);
      const pathD = `M ${startP.x} ${startP.y} C ${startP.x + dx} ${startP.y}, ${endP.x - dx} ${endP.y}, ${endP.x} ${endP.y}`;

      svg += `<path class="wire-preview" d="${pathD}" />`;
    }

    this.wiresSvg.innerHTML = svg;

    // Attach wire click handlers for deletion / selection
    this.wiresSvg.querySelectorAll('.wire-path').forEach(path => {
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = path.dataset.id;
        state.selectedEdgeIds.clear();
        state.selectedEdgeIds.add(id);
        this.renderWires();
      });
    });
  }

  renderMinimap() {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width = this.minimapCanvas.offsetWidth;
    const h = this.minimapCanvas.height = this.minimapCanvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);

    const bounds = this.getGraphBounds();
    const bw = Math.max(bounds.maxX - bounds.minX, 100);
    const bh = Math.max(bounds.maxY - bounds.minY, 100);

    const scaleX = w / bw;
    const scaleY = h / bh;
    const mmScale = Math.min(scaleX, scaleY) * 0.85;

    const offsetX = (w - bw * mmScale) / 2 - bounds.minX * mmScale;
    const offsetY = (h - bh * mmScale) / 2 - bounds.minY * mmScale;

    // Draw nodes
    state.nodes.forEach(n => {
      const nx = n.x * mmScale + offsetX;
      const ny = n.y * mmScale + offsetY;
      const nw = 200 * mmScale;
      const nh = (n.collapsed ? 30 : 120) * mmScale;

      ctx.fillStyle = state.selectedNodeIds.has(n.id) ? '#38bdf8' : 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(nx, ny, Math.max(3, nw), Math.max(2, nh));
    });

    // Draw wires
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    state.edges.forEach(e => {
      const n1 = state.nodes.find(n => n.id === e.fromNode);
      const n2 = state.nodes.find(n => n.id === e.toNode);
      if (n1 && n2) {
        ctx.beginPath();
        ctx.moveTo(n1.x * mmScale + offsetX, n1.y * mmScale + offsetY);
        ctx.lineTo(n2.x * mmScale + offsetX, n2.y * mmScale + offsetY);
        ctx.stroke();
      }
    });

    // Draw viewport box
    const cRect = this.container.getBoundingClientRect();
    const vx = (-state.pan.x / state.zoom) * mmScale + offsetX;
    const vy = (-state.pan.y / state.zoom) * mmScale + offsetY;
    const vw = (cRect.width / state.zoom) * mmScale;
    const vh = (cRect.height / state.zoom) * mmScale;

    this.minimapViewport.style.left = `${Math.max(0, vx)}px`;
    this.minimapViewport.style.top = `${Math.max(0, vy)}px`;
    this.minimapViewport.style.width = `${Math.min(w, vw)}px`;
    this.minimapViewport.style.height = `${Math.min(h, vh)}px`;
  }

  duplicateSelected() {
    if (state.selectedNodeIds.size === 0) return;
    state.saveSnapshot();

    const oldToNew = new Map();
    const newNodes = [];

    state.nodes.forEach(n => {
      if (state.selectedNodeIds.has(n.id)) {
        const newId = `n_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        oldToNew.set(n.id, newId);
        const clone = JSON.parse(JSON.stringify(n));
        clone.id = newId;
        clone.x += 40;
        clone.y += 40;
        clone.title = `${n.title} Copy`;
        newNodes.push(clone);
      }
    });

    // Duplicate internal edges
    const newEdges = [];
    state.edges.forEach(e => {
      if (oldToNew.has(e.fromNode) && oldToNew.has(e.toNode)) {
        newEdges.push({
          id: `e_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          fromNode: oldToNew.get(e.fromNode),
          fromPort: e.fromPort,
          toNode: oldToNew.get(e.toNode),
          toPort: e.toPort
        });
      }
    });

    state.nodes.push(...newNodes);
    state.edges.push(...newEdges);

    state.selectedNodeIds.clear();
    newNodes.forEach(n => state.selectedNodeIds.add(n.id));

    this.renderAll();
    compiler.recompile();
    inspector.update();
    showToast(`Duplicated ${newNodes.length} nodes`);
  }

  deleteSelected() {
    if (state.selectedNodeIds.size === 0 && state.selectedEdgeIds.size === 0 && state.selectedFrameIds.size === 0) return;
    state.saveSnapshot();

    if (state.selectedEdgeIds.size > 0) {
      state.edges = state.edges.filter(e => !state.selectedEdgeIds.has(e.id));
      state.selectedEdgeIds.clear();
    }

    if (state.selectedNodeIds.size > 0) {
      const nodeIds = state.selectedNodeIds;
      state.nodes = state.nodes.filter(n => !nodeIds.has(n.id));
      state.edges = state.edges.filter(e => !nodeIds.has(e.fromNode) && !nodeIds.has(e.toNode));
      state.selectedNodeIds.clear();
    }

    if (state.selectedFrameIds.size > 0) {
      state.frames = state.frames.filter(f => !state.selectedFrameIds.has(f.id));
      state.selectedFrameIds.clear();
    }

    this.renderAll();
    compiler.recompile();
    inspector.update();
    showToast('Deleted selected items');
  }

  frameSelected() {
    if (state.selectedNodeIds.size === 0) {
      showToast('Select nodes first to create a frame', 'info');
      return;
    }
    state.saveSnapshot();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(n => {
      if (state.selectedNodeIds.has(n.id)) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + 220);
        maxY = Math.max(maxY, n.y + 160);
      }
    });

    const frame = {
      id: `frame_${Date.now()}`,
      title: 'Group Frame',
      x: minX - 20,
      y: minY - 35,
      width: (maxX - minX) + 40,
      height: (maxY - minY) + 55
    };
    state.frames.push(frame);
    this.renderAll();
    showToast('Created group frame');
  }

  alignSelected(dir) {
    if (state.selectedNodeIds.size < 2) return;
    state.saveSnapshot();

    const selected = state.nodes.filter(n => state.selectedNodeIds.has(n.id));
    if (dir === 'left') {
      const minX = Math.min(...selected.map(n => n.x));
      selected.forEach(n => n.x = minX);
    } else if (dir === 'top') {
      const minY = Math.min(...selected.map(n => n.y));
      selected.forEach(n => n.y = minY);
    } else if (dir === 'dist_h') {
      selected.sort((a, b) => a.x - b.x);
      const minX = selected[0].x;
      const maxX = selected[selected.length - 1].x;
      const step = (maxX - minX) / (selected.length - 1);
      selected.forEach((n, i) => n.x = minX + i * step);
    } else if (dir === 'dist_v') {
      selected.sort((a, b) => a.y - b.y);
      const minY = selected[0].y;
      const maxY = selected[selected.length - 1].y;
      const step = (maxY - minY) / (selected.length - 1);
      selected.forEach((n, i) => n.y = minY + i * step);
    }

    this.renderAll();
    showToast(`Aligned nodes (${dir})`);
  }
}

let editor = null;
"""
