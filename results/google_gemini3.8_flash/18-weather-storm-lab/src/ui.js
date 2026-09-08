// UI Controller, User Interactions, 2D Radar, Cross-Section & Sounding Graphs

class WeatherUI {
  constructor(sim, renderer, audio) {
    this.sim = sim;
    this.renderer = renderer;
    this.audio = audio;

    this.activeTool = "heat"; // active brush or probe
    this.brushRadius = 3;
    this.brushStrength = 1.0;
    this.brushLayer = 1;

    this.isDragging = false;
    this.dragMode = null; // "orbit", "pan", "paint"
    this.lastPointerX = 0;
    this.lastPointerY = 0;

    // Sub-canvases
    this.soundingCanvas = document.getElementById("soundingCanvas");
    this.ctxSounding = this.soundingCanvas.getContext("2d");

    this.timeSeriesCanvas = document.getElementById("timeSeriesCanvas");
    this.ctxTimeSeries = this.timeSeriesCanvas.getContext("2d");

    this.radarCanvas = document.getElementById("radarCanvas");
    this.ctxRadar = this.radarCanvas.getContext("2d");

    this.crossSectionCanvas = document.getElementById("crossSectionCanvas");
    this.ctxCross = this.crossSectionCanvas.getContext("2d");

    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.uiFrameThrottle = 0;

    this.bindEvents();
    this.bindToolEvents();
    this.syncControlsFromSim();

    // Hook lightning audio trigger
    this.sim.onLightningStrike = (x, y, z) => {
      this.audio.triggerThunder(x, y, z, this.sim, this.renderer);
    };

    // Initial draw
    this.redrawSubCanvases();
  }

  showToast(msg, isError = false) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    if (isError) toast.style.borderColor = "var(--accent-rose)";
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  }

  redrawSubCanvases() {
    this.drawSounding();
    this.drawTimeSeries();
    this.drawRadar();
    this.drawCrossSection();
  }

  bindEvents() {
    const sim = this.sim;
    const renderer = this.renderer;
    const audio = this.audio;

    // Header Controls
    const selPreset = document.getElementById("selPreset");
    selPreset.addEventListener("change", (e) => {
      sim.loadPreset(e.target.value);
      this.syncControlsFromSim();
      this.redrawSubCanvases();
      this.showToast("Loaded preset: " + e.target.options[e.target.selectedIndex].text);
    });

    const btnPlayPause = document.getElementById("btnPlayPause");
    const badgeStatus = document.getElementById("badgeStatus");
    const togglePlay = () => {
      sim.running = !sim.running;
      btnPlayPause.textContent = sim.running ? "⏸️" : "▶️";
      badgeStatus.textContent = sim.running ? "RUNNING" : "PAUSED";
      badgeStatus.style.color = sim.running ? "var(--accent-blue)" : "var(--accent-amber)";
    };
    btnPlayPause.addEventListener("click", togglePlay);

    document.getElementById("btnStep").addEventListener("click", () => {
      sim.step(true);
      btnPlayPause.textContent = "▶️";
      badgeStatus.textContent = "PAUSED";
      this.redrawSubCanvases();
      this.showToast("Single simulation step executed");
    });

    document.getElementById("btnReset").addEventListener("click", () => {
      sim.loadPreset(sim.activePreset);
      this.syncControlsFromSim();
      this.redrawSubCanvases();
      this.showToast("Simulation reset to initial preset state");
    });

    // Vis Mode
    document.getElementById("selVisMode").addEventListener("change", (e) => {
      const modes = {
        cinematic: 0, temp: 1, humidity: 2, cloud_water: 3, precip_rate: 4,
        buoyancy: 5, horiz_wind: 6, vertical_motion: 7, vorticity: 8, terrain_moisture: 9
      };
      renderer.visMode = modes[e.target.value] ?? 0;
    });

    // Camera Preset
    document.getElementById("selCamera").addEventListener("change", (e) => {
      renderer.setCameraPreset(e.target.value);
    });

    // Audio Toggle
    const btnAudio = document.getElementById("btnAudio");
    const btnStartAudioPrompt = document.getElementById("btnStartAudioPrompt");
    const onAudioToggle = () => {
      const state = audio.toggleAudio();
      btnAudio.textContent = state ? "🔊" : "🔇";
      btnAudio.title = state ? "Audio Active (Click to Mute)" : "Audio Muted (Click to Unmute)";
      btnStartAudioPrompt.textContent = state ? "🔇 Mute Audio Engine" : "🔊 Enable Audio Engine";
      this.showToast(state ? "Web Audio Synthesizer Active" : "Audio Muted");
    };
    btnAudio.addEventListener("click", onAudioToggle);
    btnStartAudioPrompt.addEventListener("click", onAudioToggle);

    // Lightning Trigger
    const triggerStrike = () => {
      sim.triggerLightning();
      this.showToast("⚡ Lightning Strike Triggered!");
    };
    document.getElementById("btnLightning").addEventListener("click", triggerStrike);
    document.getElementById("btnManualStrike").addEventListener("click", triggerStrike);

    // Snapshot PNG
    document.getElementById("btnSnapshot").addEventListener("click", () => {
      renderer.render();
      const dataUrl = renderer.canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `weather_lab_${Date.now()}.png`;
      a.click();
      this.showToast("Captured PNG Screenshot!");
    });

    // Export JSON
    document.getElementById("btnExportJSON").addEventListener("click", () => {
      const jsonStr = sim.exportStateJSON();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weather_sim_state_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast("Exported simulation state JSON");
    });

    // Import JSON
    const fileImport = document.getElementById("fileImportJSON");
    document.getElementById("btnImportJSON").addEventListener("click", () => fileImport.click());
    fileImport.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = sim.importStateJSON(ev.target.result);
        if (res.success) {
          this.syncControlsFromSim();
          this.redrawSubCanvases();
          this.showToast("Loaded simulation state successfully!");
        } else {
          this.showToast("Failed to load JSON: " + res.error, true);
        }
      };
      reader.readAsText(file);
      fileImport.value = "";
    });

    // Export CSV
    document.getElementById("btnExportCSV").addEventListener("click", () => {
      const sounding = sim.getSounding();
      let csv = "Height_m,Pressure_hPa,Temp_C,DewPoint_C,RH_pct,CloudWater_gkg,RainWater_gkg,WindSpd_kmh,WindDir_deg,W_ms\n";
      sounding.layers.forEach(l => {
        csv += `${l.heightM},${l.pressureHpa.toFixed(1)},${l.tempC.toFixed(2)},${l.dewPointC.toFixed(2)},${l.rh.toFixed(1)},${l.cloudWater.toFixed(3)},${l.rainWater.toFixed(3)},${l.windSpdKm.toFixed(1)},${l.windDirDeg.toFixed(1)},${l.w.toFixed(2)}\n`;
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `probe_sounding_${sounding.coords.x}_${sounding.coords.y}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast("Exported probe sounding CSV");
    });

    // Sidebar Toggles
    const leftSidebar = document.getElementById("leftSidebar");
    const rightSidebar = document.getElementById("rightSidebar");
    document.getElementById("btnToggleLeft").addEventListener("click", () => {
      leftSidebar.classList.toggle("collapsed-left");
    });
    document.getElementById("btnToggleRight").addEventListener("click", () => {
      rightSidebar.classList.toggle("collapsed-right");
    });

    // Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === ".") {
        document.getElementById("btnStep").click();
      } else if (e.key === "r" || e.key === "R") {
        document.getElementById("btnReset").click();
      }
    });

    // Tab Navigation
    document.querySelectorAll(".sidebar").forEach(sidebar => {
      sidebar.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          sidebar.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
          sidebar.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
          btn.classList.add("active");
          const paneId = btn.getAttribute("data-tab");
          const pane = sidebar.querySelector("#" + paneId);
          if (pane) pane.classList.add("active");
          this.redrawSubCanvases();
        });
      });
    });

    // Canvas Pointer Events
    this.bindCanvasPointers();

    // Radar Click to Place Probe
    this.radarCanvas.addEventListener("pointerdown", (e) => {
      const rect = this.radarCanvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / rect.width;
      const clickY = (e.clientY - rect.top) / rect.height;
      sim.probe.x = Math.max(0, Math.min(sim.nx - 1, Math.floor(clickX * sim.nx)));
      sim.probe.y = Math.max(0, Math.min(sim.ny - 1, Math.floor(clickY * sim.ny)));
      this.redrawSubCanvases();
      this.showToast(`Probe placed at (${sim.probe.x}, ${sim.probe.y})`);
    });
  }

  bindToolEvents() {
    const sim = this.sim;
    const renderer = this.renderer;

    // Tool Buttons
    document.querySelectorAll(".tool-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeTool = btn.getAttribute("data-tool");
        this.showToast(`Selected tool: ${btn.textContent}`);
      });
    });

    // Sliders & Controls Binding
    const bindRange = (id, targetObj, prop, formatFn, callback) => {
      const rng = document.getElementById(id);
      const valEl = document.getElementById("val" + id.substring(3));
      if (!rng) return;
      rng.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        targetObj[prop] = val;
        if (valEl && formatFn) valEl.textContent = formatFn(val);
        if (callback) callback(val);
      });
    };

    // Physics
    bindRange("rngDt", sim, "dt", v => v.toFixed(2) + "s");
    bindRange("rngSubsteps", sim, "substeps", v => Math.floor(v).toString());
    bindRange("rngLapseRate", sim, "lapseRate", v => v.toFixed(1) + "°C/km");
    bindRange("rngHumidity", sim, "baseHumidity", v => Math.floor(v) + "%");
    bindRange("rngEvap", sim, "evapRate", v => v.toFixed(1) + "x");
    bindRange("rngCondThresh", sim, "condThresh", v => v.toFixed(2));
    bindRange("rngPrecipRate", sim, "precipRate", v => v.toFixed(1) + "x");
    bindRange("rngBuoyancy", sim, "buoyancyStrength", v => v.toFixed(1) + "x");
    bindRange("rngWindSpeed", sim, "windBaseSpeed", v => Math.floor(v) + " m/s");
    bindRange("rngWindDir", sim, "windBaseDir", v => Math.floor(v) + "°");
    bindRange("rngWindShear", sim, "windShear", v => Math.floor(v) + " m/s");
    bindRange("rngCoriolis", sim, "coriolisParam", v => v.toFixed(1) + "x");
    bindRange("rngTerrainInfluence", sim, "terrainInfluence", v => v.toFixed(1) + "x");
    bindRange("rngDiffusion", sim, "diffusion", v => v.toFixed(2));

    // Tools
    bindRange("rngBrushRadius", this, "brushRadius", v => Math.floor(v) + " cells");
    bindRange("rngBrushStrength", this, "brushStrength", v => v.toFixed(1) + "x");
    bindRange("rngBrushLayer", this, "brushLayer", v => "Layer " + Math.floor(v));

    // Rendering
    document.getElementById("selGridRes").addEventListener("change", (e) => {
      const res = parseInt(e.target.value);
      const layers = res === 32 ? 10 : (res === 48 ? 14 : 16);
      sim.initGrid(res, res, layers);
      renderer.initTextures();
      this.redrawSubCanvases();
      this.showToast(`Grid resized to ${res}×${res}×${layers}`);
    });

    document.getElementById("selRenderScale").addEventListener("change", (e) => {
      renderer.renderScale = parseFloat(e.target.value);
    });

    document.getElementById("selCloudQuality").addEventListener("change", (e) => {
      renderer.cloudQuality = parseInt(e.target.value);
    });

    bindRange("rngCloudDensity", renderer, "cloudDensity", v => v.toFixed(1) + "x");
    bindRange("rngPrecipDensity", renderer, "precipDensity", v => Math.floor(v).toLocaleString());
    bindRange("rngTimeOfDay", sim, "timeOfDay", v => {
      const hrs = Math.floor(v);
      const mins = Math.floor((v - hrs) * 60);
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    });
    bindRange("rngExposure", renderer, "exposure", v => v.toFixed(1) + "x");

    document.getElementById("chkAutoTime").addEventListener("change", (e) => {
      sim.autoTime = e.target.checked;
    });
    document.getElementById("chkStreamlines").addEventListener("change", (e) => {
      renderer.showStreamlines = e.target.checked;
    });
    document.getElementById("chkSlicePlane").addEventListener("change", (e) => {
      renderer.showSlicePlane = e.target.checked;
    });
    document.getElementById("selSliceAxis").addEventListener("change", (e) => {
      renderer.sliceAxis = e.target.value === "X" ? 0 : (e.target.value === "Y" ? 1 : 2);
    });
    bindRange("rngSlicePos", renderer, "slicePos", v => Math.floor(v * 100) + "%");

    // Severe & Audio
    document.getElementById("chkAutoLightning").addEventListener("change", (e) => {
      sim.autoLightning = e.target.checked;
    });
    bindRange("rngLightningProb", sim, "lightningProb", v => v.toFixed(1) + "x");
    bindRange("rngChargeThresh", sim, "chargeThresh", v => v.toFixed(1));

    bindRange("rngMasterVol", this.audio, "masterVol", v => Math.floor(v * 100) + "%", v => this.audio.setMasterVolume(v));
    bindRange("rngThunderVol", this.audio, "thunderVol", v => Math.floor(v * 100) + "%", v => this.audio.setThunderVolume(v));
    bindRange("rngWindRainVol", this.audio, "windRainVol", v => Math.floor(v * 100) + "%", v => this.audio.setWindRainVolume(v));
  }

  syncControlsFromSim() {
    const sim = this.sim;
    const setVal = (id, val, textVal) => {
      const el = document.getElementById(id);
      const valEl = document.getElementById("val" + id.substring(3));
      if (el) el.value = val;
      if (valEl) valEl.textContent = textVal;
    };

    setVal("rngDt", sim.dt, sim.dt.toFixed(2) + "s");
    setVal("rngSubsteps", sim.substeps, sim.substeps.toString());
    setVal("rngLapseRate", sim.lapseRate, sim.lapseRate.toFixed(1) + "°C/km");
    setVal("rngHumidity", sim.baseHumidity, Math.floor(sim.baseHumidity) + "%");
    setVal("rngEvap", sim.evapRate, sim.evapRate.toFixed(1) + "x");
    setVal("rngCondThresh", sim.condThresh, sim.condThresh.toFixed(2));
    setVal("rngPrecipRate", sim.precipRate, sim.precipRate.toFixed(1) + "x");
    setVal("rngBuoyancy", sim.buoyancyStrength, sim.buoyancyStrength.toFixed(1) + "x");
    setVal("rngWindSpeed", sim.windBaseSpeed, Math.floor(sim.windBaseSpeed) + " m/s");
    setVal("rngWindDir", sim.windBaseDir, Math.floor(sim.windBaseDir) + "°");
    setVal("rngWindShear", sim.windShear, Math.floor(sim.windShear) + " m/s");
    setVal("rngCoriolis", sim.coriolisParam, sim.coriolisParam.toFixed(1) + "x");
    setVal("rngTerrainInfluence", sim.terrainInfluence, sim.terrainInfluence.toFixed(1) + "x");
    setVal("rngDiffusion", sim.diffusion, sim.diffusion.toFixed(2));
    document.getElementById("selPreset").value = sim.activePreset;
  }

  bindCanvasPointers() {
    const canvas = this.renderer.canvas;
    const renderer = this.renderer;
    const sim = this.sim;

    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      if (e.button === 2 || e.shiftKey) {
        this.dragMode = "pan";
      } else if (this.activeTool !== "none" && !e.altKey && !e.ctrlKey) {
        this.dragMode = "paint";
        this.handlePointerPaint(e.clientX, e.clientY);
      } else {
        this.dragMode = "orbit";
      }
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      if (this.dragMode === "paint") {
        this.handlePointerPaint(e.clientX, e.clientY);
      } else if (this.dragMode === "orbit") {
        renderer.camera.theta -= dx * 0.008;
        renderer.camera.phi = Math.max(0.05, Math.min(1.5, renderer.camera.phi + dy * 0.008));
      } else if (this.dragMode === "pan") {
        const cam = renderer.camera;
        const forward = Vec3.create(-Math.sin(cam.theta), -Math.cos(cam.theta), 0);
        const right = Vec3.create(Math.cos(cam.theta), -Math.sin(cam.theta), 0);
        Vec3.scale(right, right, -dx * 0.04);
        Vec3.scale(forward, forward, dy * 0.04);
        Vec3.add(cam.target, cam.target, right);
        Vec3.add(cam.target, cam.target, forward);
      }
    });

    const onPointerUp = (e) => {
      this.isDragging = false;
      this.dragMode = null;
    };
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      renderer.camera.distance = Math.max(5.0, Math.min(100.0, renderer.camera.distance + e.deltaY * 0.05));
    }, { passive: false });

    canvas.addEventListener("contextmenu", e => e.preventDefault());
  }

  handlePointerPaint(screenX, screenY) {
    const rect = this.renderer.canvas.getBoundingClientRect();
    const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((screenY - rect.top) / rect.height) * 2 - 1);

    const invVP = this.renderer.matInvViewProj;
    const nearPoint = Vec3.transformMat4(Vec3.create(), Vec3.create(ndcX, ndcY, -1), invVP);
    const farPoint = Vec3.transformMat4(Vec3.create(), Vec3.create(ndcX, ndcY, 1), invVP);
    const rayDir = Vec3.sub(Vec3.create(), farPoint, nearPoint);
    Vec3.normalize(rayDir, rayDir);

    const t = (2.0 - nearPoint[2]) / (rayDir[2] || 0.0001);
    if (t > 0) {
      const hitX = nearPoint[0] + rayDir[0] * t;
      const hitY = nearPoint[1] + rayDir[1] * t;

      const gx = Math.floor(((hitX / 48.0) + 0.5) * this.sim.nx);
      const gy = Math.floor(((hitY / 48.0) + 0.5) * this.sim.ny);

      if (gx >= 0 && gx < this.sim.nx && gy >= 0 && gy < this.sim.ny) {
        if (this.activeTool === "probe") {
          this.sim.probe.x = gx;
          this.sim.probe.y = gy;
          this.redrawSubCanvases();
          this.showToast(`Probe moved to (${gx}, ${gy})`);
        } else {
          this.sim.applyBrush(this.activeTool, gx, gy, this.brushRadius, this.brushStrength, this.brushLayer);
        }
      }
    }
  }

  updateHUD() {
    const sim = this.sim;
    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFpsTime >= 400) {
      sim.stats.fps = (this.frameCount * 1000) / (now - this.lastFpsTime);
      sim.stats.frameTime = (now - this.lastFpsTime) / this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;

      document.getElementById("hudFPS").textContent = `${sim.stats.fps.toFixed(1)} fps (${sim.stats.frameTime.toFixed(1)}ms)`;
      document.getElementById("hudGrid").textContent = `${sim.nx} × ${sim.ny} × ${sim.nz} (${Math.floor(sim.size3D / 1000)}k)`;

      const hrs = Math.floor(sim.simTime / 3600);
      const mins = Math.floor((sim.simTime % 3600) / 60);
      const secs = Math.floor(sim.simTime % 60);
      document.getElementById("hudTime").textContent = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} (${sim.dt.toFixed(1)}s)`;

      const cflEl = document.getElementById("hudCFL");
      const cfl = sim.stats.cfl;
      cflEl.textContent = `${cfl.toFixed(2)} [${cfl < 0.8 ? "STABLE" : (cfl < 1.5 ? "CAUTION" : "CLAMPED")}]`;
      cflEl.className = "hud-val " + (cfl < 0.8 ? "good" : (cfl < 1.5 ? "warn" : "alert"));

      document.getElementById("hudCloudCover").textContent = sim.stats.cloudCover.toFixed(1) + " %";
      document.getElementById("hudPrecip").textContent = `${sim.stats.precipTotal.toFixed(1)} mm (${sim.stats.maxPrecipRate.toFixed(1)} mm/h)`;
      document.getElementById("hudWindVert").textContent = `${sim.stats.maxUpdraft > 0 ? "+" : ""}${sim.stats.maxUpdraft.toFixed(1)} / ${sim.stats.maxDowndraft.toFixed(1)} m/s`;
      document.getElementById("hudWindHoriz").textContent = `${sim.stats.maxWindSpeed.toFixed(0)} km/h`;
    }
  }

  drawSounding() {
    const ctx = this.ctxSounding;
    const w = this.soundingCanvas.width;
    const h = this.soundingCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const sounding = this.sim.getSounding();
    const layers = sounding.layers;
    if (!layers || layers.length === 0) return;

    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1;
    for (let k = 0; k <= 12; k += 3) {
      const y = h - (k / 12.0) * (h - 20) - 10;
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(w - 30, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = "9px monospace";
      ctx.fillText(`${k}km`, 6, y + 3);
    }

    const mapX = (t) => 35 + ((t + 40) / 75) * (w - 70);
    const mapY = (z) => h - (z / 11200) * (h - 20) - 10;

    // Temperature (Red)
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    layers.forEach((l, idx) => {
      const x = mapX(l.tempC);
      const y = mapY(l.heightM);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dew point (Cyan)
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    layers.forEach((l, idx) => {
      const x = mapX(l.dewPointC);
      const y = mapY(l.heightM);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Saturated shading
    ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
    ctx.beginPath();
    layers.forEach((l, idx) => {
      const x = mapX(l.tempC);
      const y = mapY(l.heightM);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    for (let idx = layers.length - 1; idx >= 0; idx--) {
      const l = layers[idx];
      const x = mapX(l.dewPointC);
      const y = mapY(l.heightM);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Wind Barbs
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1.2;
    layers.forEach((l, idx) => {
      if (idx % 2 === 0) {
        const y = mapY(l.heightM);
        const bx = w - 18;
        const angle = (l.windDirDeg * Math.PI) / 180;
        const len = Math.min(14, 4 + l.windSpdKm * 0.15);
        ctx.beginPath();
        ctx.moveTo(bx, y);
        ctx.lineTo(bx - Math.sin(angle) * len, y + Math.cos(angle) * len);
        ctx.stroke();
      }
    });

    // Update Probe Text Metrics
    document.getElementById("txtProbeCoords").textContent = `X: ${sounding.coords.x}, Y: ${sounding.coords.y} (Elev: ${sounding.coords.elevationM}m)`;
    document.getElementById("mSfcTemp").textContent = sounding.surface.tempC.toFixed(1) + " °C";
    document.getElementById("mDewPoint").textContent = sounding.surface.dewPointC.toFixed(1) + " °C";
    document.getElementById("mRH").textContent = sounding.surface.rh.toFixed(0) + " %";
    document.getElementById("mPressure").textContent = sounding.surface.pressureHpa.toFixed(0) + " hPa";
    document.getElementById("mSfcWind").textContent = sounding.surface.windSpdKm.toFixed(0) + " km/h";
    document.getElementById("mRainRate").textContent = sounding.surface.rainRateMmH.toFixed(1) + " mm/h";
    document.getElementById("mLCL").textContent = sounding.surface.lclM.toLocaleString() + " m";
    document.getElementById("mCAPE").textContent = `${sounding.surface.capeJkg} / -${sounding.surface.cinJkg} J/kg`;
  }

  drawTimeSeries() {
    const ctx = this.ctxTimeSeries;
    const w = this.timeSeriesCanvas.width;
    const h = this.timeSeriesCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const hist = this.sim.probe.history;
    if (hist.length < 2) return;

    ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    const drawCurve = (prop, color, minV, maxV) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      hist.forEach((pt, idx) => {
        const x = (idx / (hist.length - 1)) * (w - 10) + 5;
        const yNorm = (pt[prop] - minV) / (maxV - minV || 1);
        const y = h - Math.max(5, Math.min(h - 5, yNorm * (h - 10) + 5));
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    drawCurve("temp", "#f43f5e", 0, 40);
    drawCurve("dewPoint", "#06b6d4", 0, 40);
    drawCurve("rainRate", "#10b981", 0, 60);
    drawCurve("updraft", "#a855f7", -15, 25);
  }

  drawRadar() {
    const ctx = this.ctxRadar;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const sim = this.sim;
    const nx = sim.nx, ny = sim.ny, nz = sim.nz;

    ctx.clearRect(0, 0, w, h);

    const cellW = w / nx;
    const cellH = h / ny;

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let maxQr = 0;
        for (let k = 0; k < nz; k++) {
          const qr = sim.qr[sim.idx3D(i, j, k)];
          if (qr > maxQr) maxQr = qr;
        }

        const dbz = (maxQr > 0.01) ? (10.0 * Math.log10(maxQr * 2000.0) + 15.0) : 0;

        if (dbz > 15) {
          if (dbz < 30) ctx.fillStyle = "#22c55e";
          else if (dbz < 45) ctx.fillStyle = "#eab308";
          else if (dbz < 60) ctx.fillStyle = "#ef4444";
          else ctx.fillStyle = "#d946ef";
          ctx.fillRect(i * cellW, j * cellH, cellW + 0.5, cellH + 0.5);
        } else {
          const elev = sim.terrain[sim.idx2D(i, j)];
          const sType = sim.surfaceType[sim.idx2D(i, j)];
          if (sType === 1) ctx.fillStyle = "#0c1e33";
          else ctx.fillStyle = `rgb(${Math.floor(18 + elev * 40)}, ${Math.floor(25 + elev * 50)}, ${Math.floor(35 + elev * 45)})`;
          ctx.fillRect(i * cellW, j * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    }

    // Wind vector arrows
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1;
    const step = Math.max(3, Math.floor(nx / 10));
    for (let j = 2; j < ny; j += step) {
      for (let i = 2; i < nx; i += step) {
        const u = sim.u[sim.idx3D(i, j, 2)];
        const v = sim.v[sim.idx3D(i, j, 2)];
        const cx = (i + 0.5) * cellW;
        const cy = (j + 0.5) * cellH;
        const len = Math.min(12, Math.hypot(u, v) * 0.6);
        const angle = Math.atan2(v, u);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke();
      }
    }

    // Probe marker reticle
    const px = (sim.probe.x + 0.5) * cellW;
    const py = (sim.probe.y + 0.5) * cellH;

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px - 10, py); ctx.lineTo(px + 10, py);
    ctx.moveTo(px, py - 10); ctx.lineTo(px, py + 10);
    ctx.stroke();
  }

  drawCrossSection() {
    const ctx = this.ctxCross;
    const w = this.crossSectionCanvas.width;
    const h = this.crossSectionCanvas.height;
    const sim = this.sim;
    const nx = sim.nx, nz = sim.nz;
    const py = sim.probe.y;

    ctx.clearRect(0, 0, w, h);

    const cellW = w / nx;
    const cellH = h / nz;

    for (let k = 0; k < nz; k++) {
      for (let i = 0; i < nx; i++) {
        const idx = sim.idx3D(i, py, k);
        const qc = sim.qc[idx];
        const qr = sim.qr[idx];
        const wVal = sim.w[idx];

        const cx = i * cellW;
        const cy = h - (k + 1) * cellH;

        if (qc > 0.05) {
          const alpha = Math.min(0.85, qc * 0.4);
          ctx.fillStyle = `rgba(224, 242, 254, ${alpha})`;
          ctx.fillRect(cx, cy, cellW + 0.5, cellH + 0.5);
        }

        if (qr > 0.05) {
          const alpha = Math.min(0.8, qr * 0.35);
          ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.fillRect(cx, cy, cellW + 0.5, cellH + 0.5);
        }

        if (Math.abs(wVal) > 3.0 && (i % 2 === 0)) {
          ctx.strokeStyle = wVal > 0 ? "#f43f5e" : "#38bdf8";
          ctx.lineWidth = 1.2;
          const arrowLen = Math.min(cellH * 1.5, Math.abs(wVal) * 0.8);
          ctx.beginPath();
          ctx.moveTo(cx + cellW * 0.5, cy + cellH * 0.5);
          ctx.lineTo(cx + cellW * 0.5, cy + cellH * 0.5 - Math.sign(wVal) * arrowLen);
          ctx.stroke();
        }
      }
    }

    // Terrain silhouette
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < nx; i++) {
      const elev = sim.terrain[sim.idx2D(i, py)];
      const ty = h - elev * h;
      ctx.lineTo(i * cellW, ty);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Probe vertical sounding line
    const probeX = (sim.probe.x + 0.5) * cellW;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(probeX, 0);
    ctx.lineTo(probeX, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  update() {
    this.updateHUD();
    this.uiFrameThrottle++;
    if (this.uiFrameThrottle % 4 === 0) {
      this.drawSounding();
      this.drawTimeSeries();
      this.drawRadar();
      this.drawCrossSection();
    }
  }
}
