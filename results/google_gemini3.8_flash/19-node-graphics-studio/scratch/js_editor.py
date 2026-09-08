def get_editor_js():
    return """
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
    if (gridSize < 6) return;

    const startX = (panX % gridSize + gridSize) % gridSize;
    const startY = (panY % gridSize + gridSize) % gridSize;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    const dotSize = Math.max(1, 1.5 * zoom);

    for (let x = startX; x < w; x += gridSize) {
      for (let y = startY; y < h; y += gridSize) {
        ctx.fillRect(x, y, dotSize, dotSize);
      }
    }

    const majorGridSize = gridSize * 5;
    const majorStartX = (panX % majorGridSize + majorGridSize) % majorGridSize;
    const majorStartY = (panY % majorGridSize + majorGridSize) % majorGridSize;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
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

    this.container.addEventListener('mousedown', (e) => {
      if (e.target === this.container || e.target === this.bgCanvas || e.target === this.plane) {
        if (e.button === 1 || e.altKey || (e.button === 0 && e.spaceKey)) {
          this.isPanning = true;
          this.panStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
          e.preventDefault();
        } else if (e.button === 0) {
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
    const gw = bounds.maxX - bounds.minX + 240;
    const gh = bounds.maxY - bounds.minY + 240;

    const scaleX = (cRect.width - 60) / gw;
    const scaleY = (cRect.height - 60) / gh;
    let targetZoom = Math.min(Math.min(scaleX, scaleY), 0.95);
    targetZoom = Math.max(0.55, Math.min(1.0, targetZoom));

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

      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'node-icon-btn';
      collapseBtn.title = 'Collapse/Expand';
      collapseBtn.textContent = n.collapsed ? '▼' : '▲';
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        n.collapsed = !n.collapsed;
        collapseBtn.textContent = n.collapsed ? '▼' : '▲';
        this.renderAll();
      });
      controls.appendChild(collapseBtn);

      header.appendChild(titleGroup);
      header.appendChild(controls);

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

    const existing = state.edges.find(ed => ed.toNode === toNode && ed.toPort === toPort);
    if (existing) {
      state.edges = state.edges.filter(ed => ed !== existing);
    }

    const newEdge = {
      id: `e_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      fromNode,
      fromPort,
      toNode,
      toPort
    };
    state.edges.push(newEdge);

    const { hasCycle } = compiler.detectCyclesAndSort();
    if (hasCycle) {
      state.edges.pop();
      showToast('Illegal cyclic connection prevented!', 'error');
      return;
    }

    state.saveSnapshot();
    this.renderAll();
    compiler.recompile();
    showToast('Ports connected');
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

    const x = isOutput ? node.x + 200 : node.x;
    const y = node.y + 40;
    return { x, y };
  }

  renderWires() {
    let svg = '';

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

    state.nodes.forEach(n => {
      const nx = n.x * mmScale + offsetX;
      const ny = n.y * mmScale + offsetY;
      const nw = 200 * mmScale;
      const nh = (n.collapsed ? 30 : 120) * mmScale;

      ctx.fillStyle = state.selectedNodeIds.has(n.id) ? '#38bdf8' : 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(nx, ny, Math.max(3, nw), Math.max(2, nh));
    });

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
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
    showToast('Deleted selected');
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
