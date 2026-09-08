def get_state_compiler_js():
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
    this.frozenImageData = null;
    
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
    
    if (editor) editor.renderAll();
    if (compiler) compiler.recompile();
    if (inspector) inspector.update();
    if (timeline) timeline.render();
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
  }, 3200);
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
      document.querySelectorAll('.node-card').forEach(card => {
        if (cycleNodeIds.includes(card.dataset.id)) {
          card.classList.add('error');
        } else {
          card.classList.remove('error');
        }
      });
      showToast('Illegal cycle detected! Previous frame preserved.', 'error');
      return null;
    }

    document.querySelectorAll('.node-card.error').forEach(c => c.classList.remove('error'));
    state.validationStatus = 'Valid';

    let glsl = getGlslPreamble();
    glsl += '\\n// --- Compiled DAG Evaluation ---\\n';
    glsl += 'void main() {\\n';
    glsl += '  vec2 v_uv = (gl_FragCoord.xy / u_resolution.xy);\\n';
    glsl += '  if (u_tiling > 1.0) v_uv = fract(v_uv * u_tiling);\\n\\n';

    const portVarMap = new Map();

    for (const node of sortedNodes) {
      const def = NODE_TYPES[node.type];
      if (!def || def.isComment) continue;

      const outPrefix = `n_${node.id}`;
      const inputExprs = {};

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

      (def.outputs || []).forEach(outp => {
        portVarMap.set(`${node.id}_${outp.name}`, `${outPrefix}_${outp.name}`);
      });

      const nodeGlsl = def.compile(node, inputExprs, outPrefix);
      glsl += `  // Node: ${node.title} (${node.id})\\n`;
      glsl += `  ${nodeGlsl.trim()}\\n\\n`;
    }

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

    const gl = renderer ? renderer.gl : null;
    if (!gl) return false;

    const vertShader = renderer.createShader(gl.VERTEX_SHADER, renderer.vertSource);
    const fragShader = renderer.createShader(gl.FRAGMENT_SHADER, glsl);

    if (!vertShader || !fragShader) {
      state.validationStatus = 'Compile Error';
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
      showToast('Shader Link Error: ' + err.substring(0, 80), 'error');
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
      showToast('Shader Compile Error: ' + err.substring(0, 100), 'error');
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

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const aPos = gl.getAttribLocation(this.program, 'a_pos');
    if (aPos >= 0) {
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }

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
    if (px < 0 || px >= this.canvas.width || py < 0 || py >= this.canvas.height) return null;
    const pixel = new Uint8Array(4);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return pixel;
  }
}

let renderer = null;
"""
