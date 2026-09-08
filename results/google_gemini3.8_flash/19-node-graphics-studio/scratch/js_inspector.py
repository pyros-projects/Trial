def get_inspector_js():
    return """
// Property Inspector Class
class PropertyInspector {
  constructor() {
    this.container = document.getElementById('inspector-content');
  }

  update() {
    if (!this.container) return;
    this.container.innerHTML = '';

    if (state.selectedNodeIds.size === 0) {
      this.container.innerHTML = `
        <div style="color: var(--text-dim); text-align: center; margin-top: 40px;">
          <p>No node selected</p>
          <p style="font-size: 11px; margin-top: 6px;">Click any node to inspect and edit its parameters</p>
        </div>
      `;
      return;
    }

    const firstId = Array.from(state.selectedNodeIds)[0];
    const node = state.nodes.find(n => n.id === firstId);
    if (!node) return;

    const def = NODE_TYPES[node.type];
    if (!def) return;

    // Node Header
    const header = document.createElement('div');
    header.className = 'inspector-node-header';

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `
      <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${node.title}</div>
      <div style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">${node.type} | ID: ${node.id}</div>
    `;

    const actionsWrap = document.createElement('div');
    actionsWrap.style.display = 'flex';
    actionsWrap.style.gap = '6px';

    if (!def.isOutput && !def.isComment) {
      const previewBtn = document.createElement('button');
      previewBtn.className = `btn btn-sm ${state.previewTargetNodeId === node.id ? 'btn-primary' : ''}`;
      previewBtn.textContent = state.previewTargetNodeId === node.id ? '★ Previewing' : '☆ Preview';
      previewBtn.title = 'Isolate intermediate output in live viewport';
      previewBtn.addEventListener('click', () => {
        state.previewTargetNodeId = state.previewTargetNodeId === node.id ? null : node.id;
        compiler.recompile();
        this.update();
        editor.renderNodes();
      });
      actionsWrap.appendChild(previewBtn);
    }

    header.appendChild(titleWrap);
    header.appendChild(actionsWrap);
    this.container.appendChild(header);

    // Comment note editor
    if (def.isComment) {
      const row = document.createElement('div');
      row.className = 'node-prop-group';
      row.innerHTML = `<label class="prop-label">Note Content</label>`;
      const ta = document.createElement('textarea');
      ta.style.width = '100%';
      ta.style.height = '100px';
      ta.style.background = 'var(--bg-input)';
      ta.style.border = '1px solid var(--border)';
      ta.style.borderRadius = '5px';
      ta.style.color = '#fff';
      ta.style.padding = '8px';
      ta.value = node.params.text || '';
      ta.addEventListener('input', (e) => {
        node.params.text = e.target.value;
        state.updateAutosaveStatus('Saving...');
        const el = document.getElementById(`node-${node.id}`);
        if (el) {
          const innerTa = el.querySelector('textarea');
          if (innerTa) innerTa.value = e.target.value;
        }
      });
      row.appendChild(ta);
      this.container.appendChild(row);
      return;
    }

    // Parameters Group
    const propGroup = document.createElement('div');
    propGroup.className = 'node-prop-group';

    // Color ramp editor if applicable
    if (node.type === 'color_ramp') {
      this.renderColorRampEditor(node, propGroup);
    }

    (def.inputs || []).forEach(inp => {
      const isConnected = state.edges.some(e => e.toNode === node.id && e.toPort === inp.name);
      const row = document.createElement('div');
      row.className = 'prop-row';

      const label = document.createElement('div');
      label.className = 'prop-label';
      label.textContent = inp.name;
      if (isConnected) {
        label.title = 'Controlled by incoming wire';
        label.innerHTML += ' <span style="font-size: 9px; color: var(--accent);">[wired]</span>';
      }

      // Keyframe button for numeric properties
      const keyframeBtn = document.createElement('button');
      keyframeBtn.className = 'prop-keyframe-btn';
      keyframeBtn.innerHTML = '◆';
      keyframeBtn.title = 'Add/Toggle Keyframe at current frame';

      const hasKf = state.keyframes[node.id] && state.keyframes[node.id][inp.name] &&
                    state.keyframes[node.id][inp.name].some(k => k.frame === state.currentFrame);
      if (hasKf) keyframeBtn.classList.add('active');

      keyframeBtn.addEventListener('click', () => {
        this.toggleKeyframe(node.id, inp.name);
        this.update();
        timeline.render();
      });

      const inputWrap = document.createElement('div');
      inputWrap.className = 'prop-input-wrap';

      const currentVal = node.params[inp.name] !== undefined ? node.params[inp.name] : inp.default;

      if (inp.type === 'bool') {
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = !!currentVal;
        chk.disabled = isConnected;
        chk.addEventListener('change', (e) => {
          node.params[inp.name] = e.target.checked;
          state.saveSnapshot();
          compiler.recompile();
        });
        inputWrap.appendChild(chk);
      } else if (inp.type === 'enum') {
        const sel = document.createElement('select');
        sel.className = 'dropdown';
        (inp.options || []).forEach(opt => {
          const optEl = document.createElement('option');
          optEl.value = opt;
          optEl.textContent = opt;
          if (opt === currentVal) optEl.selected = true;
          sel.appendChild(optEl);
        });
        sel.addEventListener('change', (e) => {
          node.params[inp.name] = e.target.value;
          state.saveSnapshot();
          compiler.recompile();
        });
        inputWrap.appendChild(sel);
      } else if (inp.type === TYPE_FLOAT || inp.type === 'int') {
        const min = inp.min !== undefined ? inp.min : 0;
        const max = inp.max !== undefined ? inp.max : 10;
        const step = inp.step !== undefined ? inp.step : (inp.type === 'int' ? 1 : 0.05);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'range-slider';
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = currentVal;
        slider.disabled = isConnected;

        const num = document.createElement('input');
        num.type = 'number';
        num.className = 'num-input';
        num.step = step;
        num.value = Number(currentVal).toFixed(inp.type === 'int' ? 0 : 2);
        num.disabled = isConnected;

        slider.addEventListener('input', (e) => {
          const val = inp.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value);
          num.value = val.toFixed(inp.type === 'int' ? 0 : 2);
          node.params[inp.name] = val;
          compiler.recompile();
          state.updateAutosaveStatus('Saving...');
        });

        num.addEventListener('change', (e) => {
          const val = inp.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value);
          slider.value = val;
          node.params[inp.name] = val;
          state.saveSnapshot();
          compiler.recompile();
        });

        inputWrap.appendChild(slider);
        inputWrap.appendChild(num);
      } else if (inp.type === TYPE_VEC2) {
        const arr = Array.isArray(currentVal) ? currentVal : [0, 0];
        ['x', 'y'].forEach((comp, idx) => {
          const num = document.createElement('input');
          num.type = 'number';
          num.className = 'num-input';
          num.style.width = '48px';
          num.step = inp.step || '0.1';
          num.value = Number(arr[idx] || 0).toFixed(2);
          num.disabled = isConnected;
          num.addEventListener('change', (e) => {
            arr[idx] = parseFloat(e.target.value) || 0;
            node.params[inp.name] = arr;
            state.saveSnapshot();
            compiler.recompile();
          });
          inputWrap.appendChild(num);
        });
      } else if (inp.type === TYPE_VEC3) {
        const arr = Array.isArray(currentVal) ? currentVal : [0, 0, 0];
        ['x', 'y', 'z'].forEach((comp, idx) => {
          const num = document.createElement('input');
          num.type = 'number';
          num.className = 'num-input';
          num.style.width = '42px';
          num.step = inp.step || '0.1';
          num.value = Number(arr[idx] || 0).toFixed(2);
          num.disabled = isConnected;
          num.addEventListener('change', (e) => {
            arr[idx] = parseFloat(e.target.value) || 0;
            node.params[inp.name] = arr;
            state.saveSnapshot();
            compiler.recompile();
          });
          inputWrap.appendChild(num);
        });
      } else if (inp.type === TYPE_VEC4) {
        const arr = Array.isArray(currentVal) ? currentVal : [1, 1, 1, 1];
        const hex = this.rgbToHex(arr[0], arr[1], arr[2]);

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'color-swatch-input';
        colorInput.value = hex;
        colorInput.disabled = isConnected;

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'num-input';
        hexInput.style.width = '64px';
        hexInput.value = hex;
        hexInput.disabled = isConnected;

        colorInput.addEventListener('input', (e) => {
          hexInput.value = e.target.value;
          const rgb = this.hexToRgb(e.target.value);
          arr[0] = rgb.r; arr[1] = rgb.g; arr[2] = rgb.b;
          node.params[inp.name] = arr;
          compiler.recompile();
          state.updateAutosaveStatus('Saving...');
        });

        hexInput.addEventListener('change', (e) => {
          colorInput.value = e.target.value;
          const rgb = this.hexToRgb(e.target.value);
          arr[0] = rgb.r; arr[1] = rgb.g; arr[2] = rgb.b;
          node.params[inp.name] = arr;
          state.saveSnapshot();
          compiler.recompile();
        });

        inputWrap.appendChild(colorInput);
        inputWrap.appendChild(hexInput);
      }

      row.appendChild(keyframeBtn);
      row.appendChild(label);
      row.appendChild(inputWrap);
      propGroup.appendChild(row);
    });

    this.container.appendChild(propGroup);
  }

  renderColorRampEditor(node, parentEl) {
    if (!node.params.stops) {
      node.params.stops = [
        { pos: 0.0, col: [0.0, 0.0, 0.0, 1.0] },
        { pos: 1.0, col: [1.0, 1.0, 1.0, 1.0] }
      ];
    }
    const stops = node.params.stops;
    let selectedStopIdx = 0;

    const wrap = document.createElement('div');
    wrap.className = 'color-ramp-editor';

    const barWrap = document.createElement('div');
    barWrap.className = 'ramp-bar-wrap';

    const gradientBar = document.createElement('div');
    gradientBar.className = 'ramp-gradient-bar';

    const updateGradientCSS = () => {
      const sorted = [...stops].sort((a,b) => a.pos - b.pos);
      const parts = sorted.map(s => {
        const r = Math.round(s.col[0] * 255);
        const g = Math.round(s.col[1] * 255);
        const b = Math.round(s.col[2] * 255);
        return `rgba(${r}, ${g}, ${b}, 1) ${(s.pos * 100).toFixed(1)}%`;
      });
      gradientBar.style.background = `linear-gradient(to right, ${parts.join(', ')})`;
    };
    updateGradientCSS();

    barWrap.appendChild(gradientBar);

    // Stop markers container
    const markersContainer = document.createElement('div');
    markersContainer.style.position = 'relative';
    markersContainer.style.height = '20px';

    const renderMarkers = () => {
      markersContainer.innerHTML = '';
      stops.forEach((s, idx) => {
        const marker = document.createElement('div');
        marker.className = `ramp-stop-marker ${idx === selectedStopIdx ? 'selected' : ''}`;
        marker.style.left = `${(s.pos * 100).toFixed(1)}%`;

        const tri = document.createElement('div');
        tri.className = 'ramp-stop-triangle';
        const box = document.createElement('div');
        box.className = 'ramp-stop-box';
        const r = Math.round(s.col[0] * 255);
        const g = Math.round(s.col[1] * 255);
        const b = Math.round(s.col[2] * 255);
        box.style.background = `rgb(${r}, ${g}, ${b})`;

        marker.appendChild(tri);
        marker.appendChild(box);

        marker.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          selectedStopIdx = idx;
          renderMarkers();
          renderStopControls();

          const onMove = (ev) => {
            const rect = barWrap.getBoundingClientRect();
            const pct = Math.min(Math.max((ev.clientX - rect.left) / rect.width, 0.0), 1.0);
            s.pos = pct;
            marker.style.left = `${(pct * 100).toFixed(1)}%`;
            updateGradientCSS();
            compiler.recompile();
          };

          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            state.saveSnapshot();
          };

          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        });

        markersContainer.appendChild(marker);
      });
    };

    barWrap.addEventListener('click', (e) => {
      if (e.target.closest('.ramp-stop-marker')) return;
      const rect = barWrap.getBoundingClientRect();
      const pos = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0.0), 1.0);

      // Interpolate color at pos
      stops.push({ pos, col: [0.8, 0.8, 0.8, 1.0] });
      selectedStopIdx = stops.length - 1;
      updateGradientCSS();
      renderMarkers();
      renderStopControls();
      state.saveSnapshot();
      compiler.recompile();
    });

    wrap.appendChild(barWrap);
    wrap.appendChild(markersContainer);

    // Selected stop controls (color picker + delete)
    const stopControls = document.createElement('div');
    stopControls.style.display = 'flex';
    stopControls.style.alignItems = 'center';
    stopControls.style.justifyContent = 'space-between';
    stopControls.style.marginTop = '8px';

    const renderStopControls = () => {
      stopControls.innerHTML = '';
      const curr = stops[selectedStopIdx];
      if (!curr) return;

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '6px';

      const hex = this.rgbToHex(curr.col[0], curr.col[1], curr.col[2]);
      const cp = document.createElement('input');
      cp.type = 'color';
      cp.className = 'color-swatch-input';
      cp.value = hex;
      cp.addEventListener('input', (e) => {
        const rgb = this.hexToRgb(e.target.value);
        curr.col[0] = rgb.r; curr.col[1] = rgb.g; curr.col[2] = rgb.b;
        updateGradientCSS();
        renderMarkers();
        compiler.recompile();
        state.updateAutosaveStatus('Saving...');
      });

      const posLabel = document.createElement('span');
      posLabel.style.fontSize = '11px';
      posLabel.style.color = 'var(--text-dim)';
      posLabel.textContent = `Pos: ${Math.round(curr.pos * 100)}%`;

      left.appendChild(cp);
      left.appendChild(posLabel);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm';
      delBtn.textContent = 'Remove Stop';
      delBtn.disabled = stops.length <= 2;
      delBtn.addEventListener('click', () => {
        if (stops.length > 2) {
          stops.splice(selectedStopIdx, 1);
          selectedStopIdx = Math.max(0, selectedStopIdx - 1);
          updateGradientCSS();
          renderMarkers();
          renderStopControls();
          state.saveSnapshot();
          compiler.recompile();
        }
      });

      stopControls.appendChild(left);
      stopControls.appendChild(delBtn);
    };

    renderMarkers();
    renderStopControls();
    wrap.appendChild(stopControls);
    parentEl.appendChild(wrap);
  }

  toggleKeyframe(nodeId, propName) {
    if (!state.keyframes[nodeId]) state.keyframes[nodeId] = {};
    if (!state.keyframes[nodeId][propName]) state.keyframes[nodeId][propName] = [];

    const list = state.keyframes[nodeId][propName];
    const idx = list.findIndex(k => k.frame === state.currentFrame);
    const node = state.nodes.find(n => n.id === nodeId);
    const val = node ? node.params[propName] : 0;

    if (idx >= 0) {
      list.splice(idx, 1);
      showToast(`Removed keyframe at frame ${state.currentFrame}`);
    } else {
      list.push({ frame: state.currentFrame, val, interp: 'smooth' });
      list.sort((a,b) => a.frame - b.frame);
      showToast(`Added keyframe at frame ${state.currentFrame}`);
    }
    state.saveSnapshot();
  }

  rgbToHex(r, g, b) {
    const toHex = x => {
      const h = Math.round(Math.min(Math.max(x, 0), 1) * 255).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255
    };
  }
}

const inspector = new PropertyInspector();
"""
