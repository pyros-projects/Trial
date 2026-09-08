def get_timeline_js():
    return """
// Timeline & Keyframe Animation Class
class AnimationTimeline {
  constructor() {
    this.canvas = document.getElementById('timeline-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.playhead = document.getElementById('timeline-playhead');
    this.trackNamesEl = document.getElementById('timeline-track-names');
    this.trackLanesEl = document.getElementById('timeline-track-lanes');

    this.frameWidth = 10; // px per frame
    this.trackHeight = 24; // px per track row
    this.draggingPlayhead = false;
    this.draggedKeyframe = null; // { nodeId, prop, index }

    this.initEvents();
    this.resizeCanvas();
  }

  resizeCanvas() {
    const totalW = Math.max(state.totalFrames * this.frameWidth + 100, this.trackLanesEl.offsetWidth);
    this.canvas.width = totalW;
    const trackCount = this.getAnimatedTracks().length;
    this.canvas.height = Math.max((trackCount + 1) * this.trackHeight, 100);
    this.render();
  }

  getAnimatedTracks() {
    const list = [];
    for (const nodeId in state.keyframes) {
      const node = state.nodes.find(n => n.id === nodeId);
      const title = node ? node.title : nodeId;
      for (const prop in state.keyframes[nodeId]) {
        const kfs = state.keyframes[nodeId][prop];
        if (kfs && kfs.length > 0) {
          list.push({ nodeId, prop, title, keyframes: kfs });
        }
      }
    }
    return list;
  }

  initEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Timeline playback controls
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        state.playing = !state.playing;
        playBtn.textContent = state.playing ? '⏸' : '▶';
      });
    }

    const rewindBtn = document.getElementById('btn-rewind');
    if (rewindBtn) {
      rewindBtn.addEventListener('click', () => {
        this.seekToFrame(0);
      });
    }

    const stepPrevBtn = document.getElementById('btn-step-prev');
    if (stepPrevBtn) {
      stepPrevBtn.addEventListener('click', () => {
        this.seekToFrame(Math.max(0, state.currentFrame - 1));
      });
    }

    const stepNextBtn = document.getElementById('btn-step-next');
    if (stepNextBtn) {
      stepNextBtn.addEventListener('click', () => {
        this.seekToFrame(Math.min(state.totalFrames, state.currentFrame + 1));
      });
    }

    const loopBtn = document.getElementById('btn-loop');
    if (loopBtn) {
      loopBtn.addEventListener('click', () => {
        if (state.loopMode === 'loop') {
          state.loopMode = 'pingpong';
          loopBtn.textContent = '⇄ Ping-Pong';
        } else if (state.loopMode === 'pingpong') {
          state.loopMode = 'once';
          loopBtn.textContent = '→ Once';
        } else {
          state.loopMode = 'loop';
          loopBtn.textContent = '↻ Loop';
        }
      });
    }

    const fpsSelect = document.getElementById('fps-select');
    if (fpsSelect) {
      fpsSelect.addEventListener('change', (e) => {
        state.fps = parseInt(e.target.value) || 30;
      });
    }

    // Scrubber dragging
    this.trackLanesEl.addEventListener('mousedown', (e) => {
      const rect = this.trackLanesEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left + this.trackLanesEl.scrollLeft;
      const clickY = e.clientY - rect.top;

      // Check if clicking a keyframe diamond
      const trackIdx = Math.floor(clickY / this.trackHeight) - 1;
      const tracks = this.getAnimatedTracks();
      if (trackIdx >= 0 && trackIdx < tracks.length) {
        const tr = tracks[trackIdx];
        for (let i = 0; i < tr.keyframes.length; i++) {
          const kx = tr.keyframes[i].frame * this.frameWidth + 10;
          if (Math.abs(clickX - kx) < 8) {
            this.draggedKeyframe = { nodeId: tr.nodeId, prop: tr.prop, index: i };
            break;
          }
        }
      }

      if (!this.draggedKeyframe) {
        this.draggingPlayhead = true;
        const targetFrame = Math.round((clickX - 10) / this.frameWidth);
        this.seekToFrame(Math.max(0, Math.min(state.totalFrames, targetFrame)));
      }

      const onMove = (ev) => {
        const cx = ev.clientX - rect.left + this.trackLanesEl.scrollLeft;
        if (this.draggingPlayhead) {
          const tf = Math.round((cx - 10) / this.frameWidth);
          this.seekToFrame(Math.max(0, Math.min(state.totalFrames, tf)));
        } else if (this.draggedKeyframe) {
          const tf = Math.max(0, Math.min(state.totalFrames, Math.round((cx - 10) / this.frameWidth)));
          const kf = state.keyframes[this.draggedKeyframe.nodeId][this.draggedKeyframe.prop][this.draggedKeyframe.index];
          if (kf) {
            kf.frame = tf;
            state.keyframes[this.draggedKeyframe.nodeId][this.draggedKeyframe.prop].sort((a,b) => a.frame - b.frame);
            this.render();
          }
        }
      };

      const onUp = () => {
        this.draggingPlayhead = false;
        this.draggedKeyframe = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        state.saveSnapshot();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  seekToFrame(frame) {
    state.currentFrame = frame;
    state.currentTime = frame / state.fps;
    this.evaluateKeyframes();
    this.updatePlayheadUI();
    if (renderer) renderer.renderFrame(state.currentTime, state.currentFrame);
  }

  evaluateKeyframes() {
    for (const nodeId in state.keyframes) {
      const node = state.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      for (const prop in state.keyframes[nodeId]) {
        const kfs = state.keyframes[nodeId][prop];
        if (!kfs || kfs.length === 0) continue;

        const currentF = state.currentFrame;
        let evaluatedVal = kfs[0].val;

        if (currentF <= kfs[0].frame) {
          evaluatedVal = kfs[0].val;
        } else if (currentF >= kfs[kfs.length - 1].frame) {
          evaluatedVal = kfs[kfs.length - 1].val;
        } else {
          for (let i = 0; i < kfs.length - 1; i++) {
            const k0 = kfs[i];
            const k1 = kfs[i + 1];
            if (currentF >= k0.frame && currentF <= k1.frame) {
              const span = k1.frame - k0.frame;
              let t = span > 0 ? (currentF - k0.frame) / span : 0;
              const interp = k0.interp || 'smooth';
              if (interp === 'smooth') {
                t = t * t * (3.0 - 2.0 * t); // smoothstep
              } else if (interp === 'step') {
                t = 0;
              }

              if (typeof k0.val === 'number' && typeof k1.val === 'number') {
                evaluatedVal = k0.val + (k1.val - k0.val) * t;
              } else if (Array.isArray(k0.val) && Array.isArray(k1.val)) {
                evaluatedVal = k0.val.map((v, idx) => v + ((k1.val[idx] || 0) - v) * t);
              }
              break;
            }
          }
        }

        node.params[prop] = evaluatedVal;
      }
    }
  }

  tick(deltaSec) {
    if (!state.playing) return;

    if (state.loopMode === 'pingpong') {
      state.currentTime += deltaSec * state.pingpongDir;
      state.currentFrame = Math.round(state.currentTime * state.fps);

      if (state.currentFrame >= state.totalFrames) {
        state.pingpongDir = -1;
        state.currentFrame = state.totalFrames;
        state.currentTime = state.totalFrames / state.fps;
      } else if (state.currentFrame <= 0) {
        state.pingpongDir = 1;
        state.currentFrame = 0;
        state.currentTime = 0;
      }
    } else {
      state.currentTime += deltaSec;
      state.currentFrame = Math.round(state.currentTime * state.fps);

      if (state.currentFrame > state.totalFrames) {
        if (state.loopMode === 'once') {
          state.playing = false;
          const playBtn = document.getElementById('btn-play');
          if (playBtn) playBtn.textContent = '▶';
          state.currentFrame = state.totalFrames;
        } else {
          // Loop
          state.currentFrame = 0;
          state.currentTime = 0;
        }
      }
    }

    this.evaluateKeyframes();
    this.updatePlayheadUI();
  }

  updatePlayheadUI() {
    const x = state.currentFrame * this.frameWidth + 10;
    if (this.playhead) {
      this.playhead.style.left = `${x}px`;
    }

    const timeInfo = document.getElementById('timeline-time-info');
    if (timeInfo) {
      timeInfo.textContent = `${state.currentFrame} / ${state.totalFrames} (${state.currentTime.toFixed(2)}s)`;
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const tracks = this.getAnimatedTracks();

    // Render Track Names column
    if (this.trackNamesEl) {
      this.trackNamesEl.innerHTML = '<div class="timeline-track-name-row" style="font-weight: bold; background: rgba(0,0,0,0.2);">Timeline Ruler</div>';
      tracks.forEach(tr => {
        const row = document.createElement('div');
        row.className = 'timeline-track-name-row';
        row.title = `${tr.title}.${tr.prop}`;
        row.textContent = `${tr.title} : ${tr.prop}`;
        this.trackNamesEl.appendChild(row);
      });
    }

    // Draw frame ruler on top row
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, w, this.trackHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillStyle = 'var(--text-dim)';
    ctx.font = '9px monospace';
    ctx.lineWidth = 1;

    for (let f = 0; f <= state.totalFrames; f += 5) {
      const x = f * this.frameWidth + 10;
      const isMajor = f % 10 === 0;
      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 6 : 14);
      ctx.lineTo(x, this.trackHeight);
      ctx.stroke();

      if (isMajor) {
        ctx.fillText(`${f}`, x - 4, 10);
      }
    }

    // Draw track lane rows & keyframe diamonds
    tracks.forEach((tr, tIdx) => {
      const y = (tIdx + 1) * this.trackHeight;
      
      // Lane background
      ctx.fillStyle = tIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, y, w, this.trackHeight);

      // Lane separator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(0, y + this.trackHeight);
      ctx.lineTo(w, y + this.trackHeight);
      ctx.stroke();

      // Draw Keyframe Diamonds
      tr.keyframes.forEach(kf => {
        const kx = kf.frame * this.frameWidth + 10;
        const ky = y + this.trackHeight / 2;

        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(kx, ky - 5);
        ctx.lineTo(kx + 5, ky);
        ctx.lineTo(kx, ky + 5);
        ctx.lineTo(kx - 5, ky);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    });

    this.updatePlayheadUI();
  }
}

let timeline = null;
"""
