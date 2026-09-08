// 3D Atmospheric Fluid Dynamics & Thermodynamic Simulation Engine

class WeatherSimulation {
  constructor(nx = 48, ny = 48, nz = 14, seed = 42) {
    this.seed = seed;
    this.noise = new SimplexNoise(seed);
    this.initGrid(nx, ny, nz);
  }

  initGrid(nx, ny, nz) {
    this.nx = nx;
    this.ny = ny;
    this.nz = nz;
    this.size3D = nx * ny * nz;
    this.size2D = nx * ny;

    this.dx = 1000.0; // 1 km horizontal spacing
    this.dy = 1000.0;
    this.dz = 800.0;  // 800 m vertical spacing (total height ~11.2 km)

    // 3D Atmospheric Fields
    this.u = new Float32Array(this.size3D); // Wind X (m/s)
    this.v = new Float32Array(this.size3D); // Wind Y (m/s)
    this.w = new Float32Array(this.size3D); // Wind Z (m/s)
    this.T = new Float32Array(this.size3D); // Temperature (°C)
    this.q = new Float32Array(this.size3D); // Specific Humidity (g/kg)
    this.qc = new Float32Array(this.size3D); // Cloud Liquid Water (g/kg)
    this.qr = new Float32Array(this.size3D); // Rain / Precipitation (g/kg)
    this.p = new Float32Array(this.size3D); // Pressure perturbation / Buoyancy

    // Double buffers for advection
    this.u_prev = new Float32Array(this.size3D);
    this.v_prev = new Float32Array(this.size3D);
    this.w_prev = new Float32Array(this.size3D);
    this.T_prev = new Float32Array(this.size3D);
    this.q_prev = new Float32Array(this.size3D);
    this.qc_prev = new Float32Array(this.size3D);
    this.qr_prev = new Float32Array(this.size3D);

    // 2D Surface Fields
    this.terrain = new Float32Array(this.size2D); // Height normalized [0, 1]
    this.surfaceType = new Uint8Array(this.size2D); // 0=Plains, 1=Water, 2=Forest, 3=Desert, 4=City
    this.surfaceMoisture = new Float32Array(this.size2D); // [0, 1]
    this.surfaceTemp = new Float32Array(this.size2D); // °C
    this.rainAccum = new Float32Array(this.size2D); // mm
    this.charge = new Float32Array(this.size2D); // Column charge proxy for lightning

    // Physics Parameters
    this.dt = 2.0;
    this.substeps = 2;
    this.lapseRate = 6.5; // °C/km
    this.baseSurfaceTemp = 24.0; // °C
    this.baseHumidity = 70.0; // %
    this.evapRate = 1.0;
    this.condThresh = 0.95;
    this.precipRate = 1.2;
    this.buoyancyStrength = 1.3;
    this.windBaseSpeed = 12.0;
    this.windBaseDir = 270.0; // West
    this.windShear = 8.0;
    this.coriolisParam = 0.5;
    this.terrainInfluence = 1.5;
    this.diffusion = 0.08;

    // Severe & Lightning
    this.autoLightning = true;
    this.lightningProb = 1.0;
    this.chargeThresh = 18.0;
    this.activeLightning = null; // { x, y, z, branches: [], timer: 0 }

    // Simulation Clock & Stats
    this.simTime = 0.0;
    this.timeOfDay = 14.5; // 14:30
    this.autoTime = false;
    this.running = true;
    this.activePreset = "mountain_rain";

    // Diagnostic Stats
    this.stats = {
      fps: 60,
      frameTime: 16.6,
      cfl: 0.25,
      cloudCover: 0,
      precipTotal: 0,
      maxPrecipRate: 0,
      maxUpdraft: 0,
      maxDowndraft: 0,
      maxWindSpeed: 0
    };

    // Probe Station
    this.probe = {
      x: Math.floor(nx * 0.4),
      y: Math.floor(ny * 0.5),
      history: []
    };

    // Texture buffer for WebGL 3D texture upload (RGBA Uint8)
    this.textureData = new Uint8Array(this.size3D * 4);
    this.windTextureData = new Uint8Array(this.size3D * 4);
    this.terrainTexData = new Float32Array(this.size2D * 4); // R=height, G=type, B=moisture, A=rainAccum

    // Set default preset
    this.loadPreset("mountain_rain");
  }

  idx3D(x, y, z) {
    return x + this.nx * (y + this.ny * z);
  }

  idx2D(x, y) {
    return x + this.nx * y;
  }

  // Safe Saturation vapor pressure (Tetens Formula in hPa)
  calcSatVaporPressure(tempC) {
    const t = Math.max(-80.0, Math.min(60.0, tempC));
    return 6.112 * Math.exp((17.67 * t) / (t + 243.5));
  }

  // Safe Saturation specific humidity (g/kg)
  calcSatHumidity(tempC, z) {
    const heightM = z * this.dz;
    const pAtm = Math.max(100.0, 1013.25 * Math.pow(Math.max(0.1, 1.0 - 0.00002256 * heightM), 5.256));
    const eSat = this.calcSatVaporPressure(tempC);
    return Math.max(0.05, (622.0 * eSat) / Math.max(10.0, pAtm - eSat));
  }

  // Generate Base Topography
  initTerrain(type = "mountains") {
    const nx = this.nx, ny = this.ny;
    for (let j = 0; j < ny; j++) {
      const yNorm = j / (ny - 1);
      for (let i = 0; i < nx; i++) {
        const xNorm = i / (nx - 1);
        const idx = this.idx2D(i, j);
        let h = 0;
        let sType = 0; // Plains

        if (type === "mountains") {
          const ridgeDist = Math.abs(xNorm - 0.45);
          const ridge = Math.max(0, 1.0 - ridgeDist * 3.5);
          const noise = this.noise.fbm2D(xNorm * 4.0, yNorm * 4.0, 4, 2.0, 0.5);
          h = Math.pow(ridge, 1.4) * 0.52 + noise * 0.12;
          if (xNorm < 0.15) {
            sType = 1; // Ocean on west
            h = Math.max(0, h - 0.05);
          } else if (h > 0.35) {
            sType = 0;
          } else if (xNorm > 0.6) {
            sType = 2; // Forest in east valley
          }
        } else if (type === "coastal") {
          if (xNorm < 0.42) {
            h = 0.0;
            sType = 1; // Ocean
          } else {
            const coastDist = (xNorm - 0.42) / 0.58;
            h = coastDist * 0.25 + this.noise.fbm2D(xNorm * 3.0, yNorm * 3.0, 3) * 0.1;
            sType = coastDist > 0.4 ? 2 : 0;
          }
        } else if (type === "plains") {
          h = this.noise.fbm2D(xNorm * 2.5, yNorm * 2.5, 3) * 0.12;
          sType = 0;
        } else if (type === "city") {
          h = this.noise.fbm2D(xNorm * 2.0, yNorm * 2.0, 3) * 0.08;
          const distToCenter = Math.hypot(xNorm - 0.5, yNorm - 0.5);
          if (distToCenter < 0.22) {
            sType = 4; // Urban heat island
          } else if (distToCenter < 0.38) {
            sType = 0;
          } else {
            sType = 2;
          }
        } else if (type === "lake") {
          const distToCenter = Math.hypot(xNorm - 0.45, yNorm - 0.5);
          if (distToCenter < 0.26) {
            h = 0.0;
            sType = 1;
          } else {
            h = 0.1 + this.noise.fbm2D(xNorm * 3.0, yNorm * 3.0, 3) * 0.15;
            sType = 2;
          }
        } else if (type === "island") {
          const dist = Math.hypot(xNorm - 0.5, yNorm - 0.5);
          if (dist > 0.25) {
            h = 0.0;
            sType = 1;
          } else {
            h = Math.max(0, (0.25 - dist) * 1.5);
            sType = 2;
          }
        }

        this.terrain[idx] = Math.max(0.0, Math.min(0.85, h));
        this.surfaceType[idx] = sType;
        this.surfaceMoisture[idx] = sType === 1 ? 1.0 : (sType === 3 ? 0.05 : (sType === 4 ? 0.15 : 0.6));
        this.surfaceTemp[idx] = this.baseSurfaceTemp;
        this.rainAccum[idx] = 0.0;
        this.charge[idx] = 0.0;
      }
    }
  }

  // Trilinear interpolation for Semi-Lagrangian Advection
  sampleField(field, x, y, z) {
    const nx = this.nx, ny = this.ny, nz = this.nz;
    const x0 = Math.max(0, Math.min(nx - 1, Math.floor(x)));
    const y0 = Math.max(0, Math.min(ny - 1, Math.floor(y)));
    const z0 = Math.max(0, Math.min(nz - 1, Math.floor(z)));
    const x1 = Math.min(nx - 1, x0 + 1);
    const y1 = Math.min(ny - 1, y0 + 1);
    const z1 = Math.min(nz - 1, z0 + 1);

    const fx = x - x0;
    const fy = y - y0;
    const fz = z - z0;

    const v000 = field[this.idx3D(x0, y0, z0)] || 0;
    const v100 = field[this.idx3D(x1, y0, z0)] || 0;
    const v010 = field[this.idx3D(x0, y1, z0)] || 0;
    const v110 = field[this.idx3D(x1, y1, z0)] || 0;
    const v001 = field[this.idx3D(x0, y0, z1)] || 0;
    const v101 = field[this.idx3D(x1, y0, z1)] || 0;
    const v011 = field[this.idx3D(x0, y1, z1)] || 0;
    const v111 = field[this.idx3D(x1, y1, z1)] || 0;

    const c00 = v000 * (1 - fx) + v100 * fx;
    const c10 = v010 * (1 - fx) + v110 * fx;
    const c01 = v001 * (1 - fx) + v101 * fx;
    const c11 = v011 * (1 - fx) + v111 * fx;

    const c0 = c00 * (1 - fy) + c10 * fy;
    const c1 = c01 * (1 - fy) + c11 * fy;

    return c0 * (1 - fz) + c1 * fz;
  }

  // Advection Step (Semi-Lagrangian) with strict bounding
  advect(dt) {
    const nx = this.nx, ny = this.ny, nz = this.nz;
    const invDx = 1.0 / this.dx;
    const invDy = 1.0 / this.dy;
    const invDz = 1.0 / this.dz;
    const rainFallSpeed = 6.5; // m/s terminal velocity

    this.u_prev.set(this.u);
    this.v_prev.set(this.v);
    this.w_prev.set(this.w);
    this.T_prev.set(this.T);
    this.q_prev.set(this.q);
    this.qc_prev.set(this.qc);
    this.qr_prev.set(this.qr);

    let maxVel = 0.0;

    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const idx = this.idx3D(i, j, k);
          const uCur = this.u_prev[idx];
          const vCur = this.v_prev[idx];
          const wCur = this.w_prev[idx];

          const vel = Math.hypot(uCur, vCur, wCur);
          if (vel > maxVel) maxVel = vel;

          const srcX = i - uCur * dt * invDx;
          const srcY = j - vCur * dt * invDy;
          const srcZ = k - wCur * dt * invDz;

          this.u[idx] = Math.max(-50, Math.min(50, this.sampleField(this.u_prev, srcX, srcY, srcZ)));
          this.v[idx] = Math.max(-50, Math.min(50, this.sampleField(this.v_prev, srcX, srcY, srcZ)));
          this.w[idx] = Math.max(-25, Math.min(30, this.sampleField(this.w_prev, srcX, srcY, srcZ)));
          this.T[idx] = Math.max(-60, Math.min(50, this.sampleField(this.T_prev, srcX, srcY, srcZ)));
          this.q[idx] = Math.max(0.01, Math.min(35, this.sampleField(this.q_prev, srcX, srcY, srcZ)));
          this.qc[idx] = Math.max(0, Math.min(10, this.sampleField(this.qc_prev, srcX, srcY, srcZ)));

          const srcZRain = k - (wCur - rainFallSpeed) * dt * invDz;
          this.qr[idx] = Math.max(0, Math.min(15, this.sampleField(this.qr_prev, srcX, srcY, srcZRain)));
        }
      }
    }

    this.stats.cfl = (maxVel * dt) / this.dx;
  }

  // Surface boundary fluxes
  applySurfaceFluxes(dt) {
    const nx = this.nx, ny = this.ny;
    const solarZenith = Math.max(0.0, Math.sin((this.timeOfDay / 24.0) * Math.PI * 2.0 - Math.PI / 2.0));
    const solarFlux = solarZenith * 30.0;

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx2 = this.idx2D(i, j);
        const sType = this.surfaceType[idx2];
        const hNorm = this.terrain[idx2];
        const kGround = Math.min(this.nz - 1, Math.floor(hNorm * this.nz));
        const idx3 = this.idx3D(i, j, kGround);

        let albedo = 0.2;
        let heatCapacity = 1.0;
        let extraHeat = 0.0;

        if (sType === 1) { // Water
          albedo = 0.08;
          heatCapacity = 3.5;
        } else if (sType === 2) { // Forest
          albedo = 0.14;
          heatCapacity = 1.4;
        } else if (sType === 3) { // Desert
          albedo = 0.38;
          heatCapacity = 0.6;
        } else if (sType === 4) { // City
          albedo = 0.18;
          heatCapacity = 1.2;
          extraHeat = 4.0;
        }

        const netSolar = (solarFlux * (1.0 - albedo) + extraHeat) / heatCapacity;
        const cooling = (this.surfaceTemp[idx2] - this.baseSurfaceTemp) * 0.05;
        this.surfaceTemp[idx2] += (netSolar - cooling) * dt * 0.04;

        const qSatSurf = this.calcSatHumidity(this.surfaceTemp[idx2], kGround);
        const windSpeed = Math.hypot(this.u[idx3], this.v[idx3]);
        const moistureFactor = this.surfaceMoisture[idx2];
        const evapFlux = Math.max(0, qSatSurf - this.q[idx3]) * 0.06 * (1.0 + windSpeed * 0.05) * moistureFactor * this.evapRate;

        this.q[idx3] += evapFlux * dt;
        const sensibleHeat = (this.surfaceTemp[idx2] - this.T[idx3]) * 0.05;
        this.T[idx3] += sensibleHeat * dt;
      }
    }
  }

  // Microphysics, Condensation, Precipitation & Latent Heat
  applyThermodynamics(dt) {
    const nx = this.nx, ny = this.ny, nz = this.nz;
    let totalCloudWater = 0;
    let maxPrecip = 0;

    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const idx = this.idx3D(i, j, k);
          const idx2 = this.idx2D(i, j);
          const kGround = Math.min(nz - 1, Math.floor(this.terrain[idx2] * nz));

          if (k < kGround) {
            this.qc[idx] = 0;
            this.qr[idx] = 0;
            continue;
          }

          let temp = this.T[idx];
          let q = this.q[idx];
          let qc = this.qc[idx];
          let qr = this.qr[idx];

          const qSat = this.calcSatHumidity(temp, k);

          // Condensation
          const satDeficit = q - qSat * this.condThresh;
          if (satDeficit > 0) {
            const condAmount = Math.min(satDeficit, satDeficit * 0.35 * dt);
            q -= condAmount;
            qc += condAmount;
            temp += condAmount * 2.2; // Latent heating warms parcel
          } else if (q < qSat && qc > 0) {
            // Cloud Evaporation
            const evapAmount = Math.min(qc, (qSat - q) * 0.25 * dt);
            qc -= evapAmount;
            q += evapAmount;
            temp -= evapAmount * 2.2;
          }

          // Autoconversion to Rain
          const autoThresh = 0.70;
          if (qc > autoThresh) {
            const rainGen = (qc - autoThresh) * 0.16 * dt * this.precipRate;
            qc -= rainGen;
            qr += rainGen;
          }

          // Sub-cloud Rain Evaporation & Cold Pool
          if (qr > 0 && q < qSat) {
            const rainEvap = Math.min(qr, Math.max(0, 1.0 - q / qSat) * 0.06 * dt);
            qr -= rainEvap;
            q += rainEvap;
            temp -= rainEvap * 1.5;
          }

          // Rain reaching surface
          if (k === kGround && qr > 0) {
            const rainDep = qr * dt * 0.15;
            this.rainAccum[idx2] += rainDep;
            this.surfaceMoisture[idx2] = Math.min(1.0, this.surfaceMoisture[idx2] + rainDep * 0.05);
            if (rainDep > maxPrecip) maxPrecip = rainDep;
            qr = 0;
          }

          this.T[idx] = Math.max(-60, Math.min(50, temp));
          this.q[idx] = Math.max(0.01, Math.min(35, q));
          this.qc[idx] = Math.max(0, Math.min(10, qc));
          this.qr[idx] = Math.max(0, Math.min(15, qr));

          totalCloudWater += this.qc[idx];
        }
      }
    }

    this.stats.cloudCover = Math.min(100, (totalCloudWater / (nx * ny * 3.5)) * 100);
    this.stats.maxPrecipRate = maxPrecip * (3600 / dt);
  }

  // Buoyancy, Continuity & Momentum Coupling
  applyDynamics(dt) {
    const nx = this.nx, ny = this.ny, nz = this.nz;
    const inv2Dx = 0.5 / this.dx;
    const inv2Dy = 0.5 / this.dy;
    const fCoriolis = this.coriolisParam * 0.0001;

    let maxW = -999, minW = 999, maxWind = 0;

    for (let k = 0; k < nz; k++) {
      const heightKm = (k * this.dz) / 1000.0;
      const refT = this.baseSurfaceTemp - this.lapseRate * heightKm;

      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const idx = this.idx3D(i, j, k);
          const idx2 = this.idx2D(i, j);
          const kGround = Math.min(nz - 1, Math.floor(this.terrain[idx2] * nz));

          if (k <= kGround) {
            this.w[idx] = 0;
            continue;
          }

          // Virtual Temperature Buoyancy
          const T = this.T[idx];
          const q = this.q[idx];
          const qc = this.qc[idx];
          const qr = this.qr[idx];

          const Tv = (T + 273.15) * (1.0 + 0.61 * (q / 1000.0)) - ((qc + qr) / 1000.0) * (T + 273.15);
          const Tref = refT + 273.15;
          const buoyancy = 9.81 * ((Tv - Tref) / Tref);
          this.p[idx] = buoyancy;

          // Vertical acceleration with damping
          const targetW = this.w[idx] + (buoyancy * this.buoyancyStrength - this.w[idx] * 0.12) * dt;
          this.w[idx] = Math.max(-20.0, Math.min(25.0, targetW));

          // Orographic uplift at lower layers
          if (k <= kGround + 3) {
            const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1);
            const j0 = Math.max(0, j - 1), j1 = Math.min(ny - 1, j + 1);
            const dhdx = (this.terrain[this.idx2D(i1, j)] - this.terrain[this.idx2D(i0, j)]) * inv2Dx * (nz * this.dz);
            const dhdy = (this.terrain[this.idx2D(i, j1)] - this.terrain[this.idx2D(i, j0)]) * inv2Dy * (nz * this.dz);
            const wOro = Math.max(-10, Math.min(15, (this.u[idx] * dhdx + this.v[idx] * dhdy) * this.terrainInfluence));
            const blend = (1.0 - (k - kGround) / 3.0);
            this.w[idx] = Math.max(-20, Math.min(25, this.w[idx] + wOro * blend * 0.15 * dt));
          }

          // Horizontal Inflow / Outflow Continuity
          const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1);
          const j0 = Math.max(0, j - 1), j1 = Math.min(ny - 1, j + 1);
          const dwdx = (this.w[this.idx3D(i1, j, k)] - this.w[this.idx3D(i0, j, k)]) * inv2Dx;
          const dwdy = (this.w[this.idx3D(i, j1, k)] - this.w[this.idx3D(i, j0, k)]) * inv2Dy;

          const levelFactor = (k / (nz - 1)) - 0.4;
          this.u[idx] = Math.max(-45, Math.min(45, this.u[idx] + levelFactor * dwdx * dt * 25.0));
          this.v[idx] = Math.max(-45, Math.min(45, this.v[idx] + levelFactor * dwdy * dt * 25.0));

          // Coriolis Rotation
          const uOld = this.u[idx];
          const vOld = this.v[idx];
          this.u[idx] += fCoriolis * vOld * dt * 15.0;
          this.v[idx] -= fCoriolis * uOld * dt * 15.0;

          if (this.w[idx] > maxW) maxW = this.w[idx];
          if (this.w[idx] < minW) minW = this.w[idx];
          const spd = Math.hypot(this.u[idx], this.v[idx]);
          if (spd > maxWind) maxWind = spd;
        }
      }
    }

    this.stats.maxUpdraft = maxW === -999 ? 0 : maxW;
    this.stats.maxDowndraft = minW === 999 ? 0 : minW;
    this.stats.maxWindSpeed = maxWind * 3.6; // km/h
  }

  // Electrification & Lightning Trigger
  updateElectrification(dt) {
    const nx = this.nx, ny = this.ny, nz = this.nz;
    let highestCharge = 0;
    let strikeX = -1, strikeY = -1;

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx2 = this.idx2D(i, j);
        let colCharge = 0;

        for (let k = 0; k < nz; k++) {
          const idx = this.idx3D(i, j, k);
          const w = Math.max(0, this.w[idx]);
          const qc = this.qc[idx];
          const T = this.T[idx];
          const mixedPhase = (T < 0 && T > -25) ? 1.5 : 0.2;
          colCharge += w * qc * mixedPhase;
        }

        this.charge[idx2] = colCharge;
        if (colCharge > highestCharge) {
          highestCharge = colCharge;
          strikeX = i;
          strikeY = j;
        }
      }
    }

    if (this.autoLightning && highestCharge > this.chargeThresh) {
      if (Math.random() < 0.08 * this.lightningProb) {
        this.triggerLightning(strikeX, strikeY);
      }
    }

    if (this.activeLightning) {
      this.activeLightning.timer -= dt;
      if (this.activeLightning.timer <= 0) {
        this.activeLightning = null;
      }
    }
  }

  triggerLightning(x = null, y = null) {
    const nx = this.nx, ny = this.ny, nz = this.nz;
    if (x === null || y === null) {
      x = Math.floor(Math.random() * nx);
      y = Math.floor(Math.random() * ny);
    }
    const idx2 = this.idx2D(x, y);
    const kGround = Math.min(nz - 1, Math.floor(this.terrain[idx2] * nz));
    const kCloud = Math.min(nz - 2, kGround + 6);

    const segments = [];
    const buildBranch = (x0, y0, z0, x1, y1, z1, depth) => {
      if (depth === 0) {
        segments.push([x0, y0, z0, x1, y1, z1]);
        return;
      }
      const midX = (x0 + x1) * 0.5 + (Math.random() - 0.5) * 1.5;
      const midY = (y0 + y1) * 0.5 + (Math.random() - 0.5) * 1.5;
      const midZ = (z0 + z1) * 0.5 + (Math.random() - 0.5) * 0.5;

      buildBranch(x0, y0, z0, midX, midY, midZ, depth - 1);
      buildBranch(midX, midY, midZ, x1, y1, z1, depth - 1);

      if (Math.random() < 0.6 && depth >= 2) {
        const forkX = midX + (Math.random() - 0.5) * 2.5;
        const forkY = midY + (Math.random() - 0.5) * 2.5;
        const forkZ = midZ - (Math.random() * 1.2);
        buildBranch(midX, midY, midZ, forkX, forkY, forkZ, depth - 2);
      }
    };

    buildBranch(x, y, kCloud, x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2, kGround, 4);

    this.activeLightning = {
      x, y, z: kCloud,
      segments,
      timer: 0.25
    };

    if (this.onLightningStrike) {
      this.onLightningStrike(x, y, kCloud);
    }
  }

  // Interactive Brush Application
  applyBrush(tool, gridX, gridY, radius = 3, strength = 1.0, layer = 1) {
    const nx = this.nx, ny = this.ny, nz = this.nz;
    const r2 = radius * radius;

    for (let j = Math.max(0, gridY - radius); j <= Math.min(ny - 1, gridY + radius); j++) {
      for (let i = Math.max(0, gridX - radius); i <= Math.min(nx - 1, gridX + radius); i++) {
        const d2 = (i - gridX) * (i - gridX) + (j - gridY) * (j - gridY);
        if (d2 > r2) continue;

        const falloff = (1.0 - Math.sqrt(d2) / radius) * strength;
        const idx2 = this.idx2D(i, j);
        const kGround = Math.min(nz - 1, Math.floor(this.terrain[idx2] * nz));
        const kTarget = Math.max(0, Math.min(nz - 1, kGround + layer));
        const idx3 = this.idx3D(i, j, kTarget);

        switch (tool) {
          case "heat":
            this.T[idx3] = Math.min(50, this.T[idx3] + 8.0 * falloff);
            this.surfaceTemp[idx2] = Math.min(50, this.surfaceTemp[idx2] + 6.0 * falloff);
            break;
          case "cold":
            this.T[idx3] = Math.max(-50, this.T[idx3] - 8.0 * falloff);
            this.surfaceTemp[idx2] = Math.max(-50, this.surfaceTemp[idx2] - 6.0 * falloff);
            break;
          case "moisture":
            this.q[idx3] = Math.min(30, this.q[idx3] + 8.0 * falloff);
            this.surfaceMoisture[idx2] = Math.min(1.0, this.surfaceMoisture[idx2] + 0.3 * falloff);
            break;
          case "dry":
            this.q[idx3] = Math.max(0.1, this.q[idx3] - 8.0 * falloff);
            this.qc[idx3] = Math.max(0, this.qc[idx3] - 2.0 * falloff);
            this.w[idx3] = Math.max(-20, this.w[idx3] - 5.0 * falloff);
            break;
          case "wind":
            this.u[idx3] = Math.min(45, this.u[idx3] + 15.0 * falloff);
            break;
          case "pressure":
            this.w[idx3] = Math.min(25, this.w[idx3] + 10.0 * falloff);
            this.T[idx3] = Math.min(50, this.T[idx3] + 4.0 * falloff);
            break;
          case "seed":
            if (this.q[idx3] > 2.0) {
              const cond = this.q[idx3] * 0.5 * falloff;
              this.q[idx3] -= cond;
              this.qc[idx3] = Math.min(10, this.qc[idx3] + cond);
              this.T[idx3] += cond * 2.0;
            }
            break;
          case "raise_terrain":
            this.terrain[idx2] = Math.min(0.85, this.terrain[idx2] + 0.08 * falloff);
            break;
          case "lower_terrain":
            this.terrain[idx2] = Math.max(0.0, this.terrain[idx2] - 0.08 * falloff);
            break;
          case "biome_water":
            this.surfaceType[idx2] = 1;
            this.surfaceMoisture[idx2] = 1.0;
            break;
          case "biome_forest":
            this.surfaceType[idx2] = 2;
            this.surfaceMoisture[idx2] = 0.7;
            break;
          case "biome_plains":
            this.surfaceType[idx2] = 0;
            this.surfaceMoisture[idx2] = 0.5;
            break;
          case "biome_desert":
            this.surfaceType[idx2] = 3;
            this.surfaceMoisture[idx2] = 0.05;
            break;
          case "biome_city":
            this.surfaceType[idx2] = 4;
            this.surfaceMoisture[idx2] = 0.15;
            break;
        }
      }
    }
  }

  step(force = false) {
    if (!this.running && !force) return;

    const subDt = this.dt / this.substeps;
    for (let s = 0; s < this.substeps; s++) {
      this.applySurfaceFluxes(subDt);
      this.advect(subDt);
      this.applyThermodynamics(subDt);
      this.applyDynamics(subDt);
      this.updateElectrification(subDt);
      this.simTime += subDt;

      if (this.autoTime) {
        this.timeOfDay = (this.timeOfDay + (subDt / 3600.0) * 12.0) % 24.0;
      }
    }

    this.recordProbe();
    this.updateTextureBuffers();
  }

  updateTextureBuffers() {
    const size3D = this.size3D;
    const tex = this.textureData;
    const wTex = this.windTextureData;

    for (let i = 0; i < size3D; i++) {
      const p4 = i * 4;
      tex[p4 + 0] = Math.min(255, Math.floor((this.qc[i] / 3.0) * 255));
      tex[p4 + 1] = Math.min(255, Math.floor((this.q[i] / 18.0) * 255));
      tex[p4 + 2] = Math.min(255, Math.max(0, Math.floor(((this.T[i] + 40.0) / 80.0) * 255)));
      tex[p4 + 3] = Math.min(255, Math.floor((this.qr[i] / 4.0) * 255));

      wTex[p4 + 0] = Math.min(255, Math.max(0, Math.floor(((this.u[i] + 50.0) / 100.0) * 255)));
      wTex[p4 + 1] = Math.min(255, Math.max(0, Math.floor(((this.v[i] + 50.0) / 100.0) * 255)));
      wTex[p4 + 2] = Math.min(255, Math.max(0, Math.floor(((this.w[i] + 25.0) / 50.0) * 255)));
      wTex[p4 + 3] = Math.min(255, Math.max(0, Math.floor(((this.p[i] + 5.0) / 10.0) * 255)));
    }

    const size2D = this.size2D;
    const tTex = this.terrainTexData;
    for (let i = 0; i < size2D; i++) {
      const p4 = i * 4;
      tTex[p4 + 0] = this.terrain[i];
      tTex[p4 + 1] = this.surfaceType[i];
      tTex[p4 + 2] = this.surfaceMoisture[i];
      tTex[p4 + 3] = this.rainAccum[i];
    }
  }

  // Probe Sounding Profile Data
  getSounding(px = this.probe.x, py = this.probe.y) {
    const nz = this.nz;
    const sounding = [];
    const idx2 = this.idx2D(px, py);
    const hNorm = this.terrain[idx2];
    const kGround = Math.min(nz - 1, Math.floor(hNorm * nz));
    const elevM = Math.floor(hNorm * (nz * this.dz));

    let cape = 0, cin = 0;
    const sfcT = this.T[this.idx3D(px, py, kGround)] || this.baseSurfaceTemp;
    const sfcQ = this.q[this.idx3D(px, py, kGround)] || 8.0;
    const qSatSfc = this.calcSatHumidity(sfcT, kGround);
    const sfcRH = Math.max(5, Math.min(100, (sfcQ / qSatSfc) * 100));
    const sfcTd = sfcT - ((100 - sfcRH) / 5.0);
    const lclM = Math.max(200, Math.floor(125 * Math.max(0, sfcT - sfcTd)));

    let parcelT = sfcT;

    for (let k = 0; k < nz; k++) {
      const idx = this.idx3D(px, py, k);
      const zM = k * this.dz;
      const tEnv = this.T[idx];
      const qVal = this.q[idx];
      const qSatVal = this.calcSatHumidity(tEnv, k);
      const rh = Math.min(100, Math.max(5, (qVal / qSatVal) * 100));
      const td = tEnv - ((100 - rh) / 5.0);
      const qcVal = this.qc[idx];
      const qrVal = this.qr[idx];
      const uVal = this.u[idx];
      const vVal = this.v[idx];
      const wVal = this.w[idx];
      const pVal = 1013.25 * Math.pow(Math.max(0.1, 1.0 - 0.00002256 * zM), 5.256);

      if (k >= kGround) {
        if (zM < lclM) {
          parcelT -= (9.8 / 1000.0) * this.dz;
        } else {
          parcelT -= (6.0 / 1000.0) * this.dz;
        }
        const bParcel = 9.81 * ((parcelT - tEnv) / (tEnv + 273.15));
        if (bParcel > 0) cape += bParcel * this.dz;
        else cin += Math.abs(bParcel) * this.dz;
      }

      sounding.push({
        layer: k,
        heightM: zM,
        pressureHpa: pVal,
        tempC: tEnv,
        dewPointC: td,
        rh: rh,
        cloudWater: qcVal,
        rainWater: qrVal,
        u: uVal,
        v: vVal,
        w: wVal,
        windSpdKm: Math.hypot(uVal, vVal) * 3.6,
        windDirDeg: (Math.atan2(-uVal, -vVal) * 180 / Math.PI + 360) % 360
      });
    }

    return {
      coords: { x: px, y: py, elevationM: elevM },
      surface: {
        tempC: sfcT,
        dewPointC: sfcTd,
        rh: sfcRH,
        pressureHpa: 1013.25 * Math.pow(Math.max(0.1, 1.0 - 0.00002256 * elevM), 5.256),
        windSpdKm: Math.hypot(this.u[this.idx3D(px, py, kGround)], this.v[this.idx3D(px, py, kGround)]) * 3.6,
        rainRateMmH: this.qr[this.idx3D(px, py, kGround)] * 36.0,
        rainAccumMm: this.rainAccum[idx2],
        lclM: lclM,
        capeJkg: Math.floor(cape),
        cinJkg: Math.floor(cin)
      },
      layers: sounding
    };
  }

  recordProbe() {
    const s = this.getSounding(this.probe.x, this.probe.y);
    this.probe.history.push({
      time: this.simTime,
      temp: s.surface.tempC,
      dewPoint: s.surface.dewPointC,
      rainRate: s.surface.rainRateMmH,
      updraft: this.w[this.idx3D(this.probe.x, this.probe.y, Math.min(this.nz - 1, 4))]
    });
    if (this.probe.history.length > 60) {
      this.probe.history.shift();
    }
  }

  loadPreset(presetName) {
    this.activePreset = presetName;
    const nx = this.nx, ny = this.ny, nz = this.nz;

    this.u.fill(0); this.v.fill(0); this.w.fill(0);
    this.qc.fill(0); this.qr.fill(0); this.p.fill(0);

    switch (presetName) {
      case "fair_weather_cumulus":
        this.initTerrain("plains");
        this.baseSurfaceTemp = 26.0;
        this.lapseRate = 6.0;
        this.baseHumidity = 65.0;
        this.windBaseSpeed = 4.0;
        this.windBaseDir = 260.0;
        this.windShear = 3.0;
        this.buoyancyStrength = 1.0;
        this.timeOfDay = 13.5;

        for (let k = 0; k < nz; k++) {
          const zNorm = k / (nz - 1);
          const envT = this.baseSurfaceTemp - this.lapseRate * (k * this.dz / 1000.0);
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              this.u[idx] = 4.0 + zNorm * 2.0;
              this.v[idx] = 0.5;
              this.T[idx] = envT + (this.noise.noise2D(i * 0.3, j * 0.3) * 0.8);
              this.q[idx] = this.calcSatHumidity(envT, k) * (0.65 - zNorm * 0.25);
              if (k === 2 && this.noise.noise2D(i * 0.4, j * 0.4) > 0.35) {
                this.qc[idx] = 0.8;
              }
            }
          }
        }
        break;

      case "sea_breeze":
        this.initTerrain("coastal");
        this.baseSurfaceTemp = 28.0;
        this.lapseRate = 6.5;
        this.baseHumidity = 75.0;
        this.windBaseSpeed = 3.0;
        this.windBaseDir = 270.0;
        this.windShear = 5.0;
        this.timeOfDay = 14.0;

        for (let k = 0; k < nz; k++) {
          const zNorm = k / (nz - 1);
          const envT = this.baseSurfaceTemp - this.lapseRate * (k * this.dz / 1000.0);
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              const xNorm = i / (nx - 1);
              const uSea = (xNorm < 0.55) ? 8.0 * (1.0 - zNorm) : -2.0;
              this.u[idx] = uSea;
              this.T[idx] = envT + (xNorm > 0.42 ? 3.0 : -1.0) * (1.0 - zNorm);
              this.q[idx] = this.calcSatHumidity(envT, k) * (xNorm < 0.5 ? 0.85 : 0.65);
              if (Math.abs(xNorm - 0.58) < 0.08 && k >= 2 && k <= 5) {
                this.qc[idx] = 1.4;
                this.w[idx] = 4.5;
              }
            }
          }
        }
        break;

      case "mountain_rain":
        this.initTerrain("mountains");
        this.baseSurfaceTemp = 22.0;
        this.lapseRate = 6.8;
        this.baseHumidity = 80.0;
        this.windBaseSpeed = 16.0;
        this.windBaseDir = 270.0;
        this.windShear = 8.0;
        this.terrainInfluence = 1.6;
        this.timeOfDay = 11.0;

        for (let k = 0; k < nz; k++) {
          const zNorm = k / (nz - 1);
          const envT = this.baseSurfaceTemp - this.lapseRate * (k * this.dz / 1000.0);
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              const xNorm = i / (nx - 1);
              this.u[idx] = 16.0 + zNorm * 6.0;
              this.v[idx] = 1.0;
              this.T[idx] = envT;
              this.q[idx] = this.calcSatHumidity(envT, k) * (xNorm < 0.5 ? 0.88 : 0.50);

              if (xNorm > 0.28 && xNorm < 0.48 && k >= 2 && k <= 7) {
                this.qc[idx] = 2.0;
                this.qr[idx] = 1.4;
                this.w[idx] = 5.5;
              }
            }
          }
        }
        break;

      case "squall_line":
        this.initTerrain("plains");
        this.baseSurfaceTemp = 29.0;
        this.lapseRate = 7.5;
        this.baseHumidity = 85.0;
        this.windBaseSpeed = 14.0;
        this.windBaseDir = 280.0;
        this.windShear = 16.0;
        this.buoyancyStrength = 1.6;
        this.timeOfDay = 16.5;

        for (let k = 0; k < nz; k++) {
          const zNorm = k / (nz - 1);
          const envT = this.baseSurfaceTemp - this.lapseRate * (k * this.dz / 1000.0);
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              const xNorm = i / (nx - 1);
              const frontDist = xNorm - 0.45;
              const isBehindFront = frontDist < 0;

              this.u[idx] = isBehindFront ? 22.0 : 6.0;
              this.v[idx] = isBehindFront ? -4.0 : 10.0;
              this.T[idx] = envT + (isBehindFront ? -6.0 : 2.0);
              this.q[idx] = this.calcSatHumidity(envT, k) * (isBehindFront ? 0.5 : 0.88);

              if (Math.abs(frontDist) < 0.08 && k >= 1 && k <= 9) {
                this.qc[idx] = 2.5;
                this.qr[idx] = 2.8;
                this.w[idx] = 16.0 * Math.sin((k / 9.0) * Math.PI);
              }
            }
          }
        }
        break;

      case "rotating_supercell":
        this.initTerrain("plains");
        this.baseSurfaceTemp = 31.0;
        this.lapseRate = 8.2;
        this.baseHumidity = 88.0;
        this.windBaseSpeed = 12.0;
        this.windBaseDir = 240.0;
        this.windShear = 20.0;
        this.coriolisParam = 1.2;
        this.buoyancyStrength = 1.8;
        this.timeOfDay = 17.5;

        for (let k = 0; k < nz; k++) {
          const zNorm = k / (nz - 1);
          const envT = this.baseSurfaceTemp - this.lapseRate * (k * this.dz / 1000.0);
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              const dx = (i - nx * 0.5) / nx;
              const dy = (j - ny * 0.5) / ny;
              const dist = Math.hypot(dx, dy);

              const shearAngle = zNorm * 1.4;
              this.u[idx] = Math.cos(shearAngle) * (8.0 + zNorm * 18.0) - dy * 35.0 * Math.exp(-dist * 8.0);
              this.v[idx] = Math.sin(shearAngle) * (8.0 + zNorm * 18.0) + dx * 35.0 * Math.exp(-dist * 8.0);
              this.T[idx] = envT + (dist < 0.15 ? 4.0 : 0.0);
              this.q[idx] = this.calcSatHumidity(envT, k) * (dist < 0.2 ? 0.92 : 0.70);

              if (dist < 0.18 && k >= 1 && k <= 11) {
                this.qc[idx] = 2.8;
                this.qr[idx] = 3.5;
                this.w[idx] = 22.0 * (1.0 - dist / 0.18) * Math.sin(zNorm * Math.PI);
              }
            }
          }
        }
        break;

      case "tropical_cyclone":
        this.initTerrain("island");
        this.baseSurfaceTemp = 30.0;
        this.lapseRate = 6.2;
        this.baseHumidity = 92.0;
        this.windBaseSpeed = 0.0;
        this.coriolisParam = 2.2;
        this.buoyancyStrength = 1.5;
        this.timeOfDay = 12.0;

        for (let k = 0; k < nz; k++) {
          const zNorm = k / (nz - 1);
          const envT = this.baseSurfaceTemp - this.lapseRate * (k * this.dz / 1000.0);
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              const dx = (i - nx * 0.5) / nx;
              const dy = (j - ny * 0.5) / ny;
              const dist = Math.hypot(dx, dy);
              const angle = Math.atan2(dy, dx);

              const vTheta = 28.0 * (dist / (dist * dist + 0.03)) * (1.0 - zNorm * 0.5);
              this.u[idx] = -Math.sin(angle) * vTheta;
              this.v[idx] = Math.cos(angle) * vTheta;
              this.T[idx] = envT + (dist < 0.08 ? 3.5 : 0.0);
              this.q[idx] = this.calcSatHumidity(envT, k) * 0.90;

              const spiral = Math.sin(angle * 2.0 - Math.log(dist + 0.01) * 3.5);
              if ((dist > 0.07 && dist < 0.16) || (dist > 0.2 && spiral > 0.3)) {
                if (k >= 1 && k <= 10) {
                  this.qc[idx] = 2.5;
                  this.qr[idx] = 3.0;
                  this.w[idx] = 12.0;
                }
              }
            }
          }
        }
        break;

      case "cold_front":
        this.initTerrain("plains");
        this.baseSurfaceTemp = 25.0;
        this.lapseRate = 6.5;
        this.baseHumidity = 78.0;
        this.windBaseSpeed = 10.0;
        this.windBaseDir = 300.0;
        this.timeOfDay = 15.0;

        for (let k = 0; k < nz; k++) {
          const zNorm = k / (nz - 1);
          const envT = this.baseSurfaceTemp - this.lapseRate * (k * this.dz / 1000.0);
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              const xNorm = i / (nx - 1);
              const frontSlope = xNorm - zNorm * 0.3 - 0.45;
              const isColdAir = frontSlope < 0;

              this.u[idx] = isColdAir ? 18.0 : 6.0;
              this.v[idx] = isColdAir ? -6.0 : 8.0;
              this.T[idx] = envT + (isColdAir ? -8.0 : 2.0);
              this.q[idx] = this.calcSatHumidity(envT, k) * (isColdAir ? 0.5 : 0.85);

              if (Math.abs(frontSlope) < 0.07 && k >= 2 && k <= 7) {
                this.qc[idx] = 2.0;
                this.qr[idx] = 1.8;
                this.w[idx] = 9.0;
              }
            }
          }
        }
        break;

      case "heat_island_thunderstorm":
        this.initTerrain("city");
        this.baseSurfaceTemp = 32.0;
        this.lapseRate = 7.8;
        this.baseHumidity = 80.0;
        this.windBaseSpeed = 2.0;
        this.buoyancyStrength = 1.8;
        this.timeOfDay = 15.5;

        for (let k = 0; k < nz; k++) {
          const zNorm = k / (nz - 1);
          const envT = this.baseSurfaceTemp - this.lapseRate * (k * this.dz / 1000.0);
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              const dx = (i - nx * 0.5) / nx;
              const dy = (j - ny * 0.5) / ny;
              const dist = Math.hypot(dx, dy);

              this.u[idx] = (Math.random() - 0.5) * 2.0;
              this.v[idx] = (Math.random() - 0.5) * 2.0;
              this.T[idx] = envT + (dist < 0.22 ? 5.5 : 0.0) * (1.0 - zNorm);
              this.q[idx] = this.calcSatHumidity(envT, k) * 0.82;

              if (dist < 0.2 && k >= 1 && k <= 8) {
                this.qc[idx] = 2.2;
                this.qr[idx] = 2.0;
                this.w[idx] = 15.0 * (1.0 - dist / 0.2);
              }
            }
          }
        }
        break;

      case "snow_band":
        this.initTerrain("lake");
        this.baseSurfaceTemp = -4.0;
        this.lapseRate = 7.0;
        this.baseHumidity = 85.0;
        this.windBaseSpeed = 16.0;
        this.windBaseDir = 270.0;
        this.timeOfDay = 10.0;

        for (let k = 0; k < nz; k++) {
          const zNorm = k / (nz - 1);
          const envT = this.baseSurfaceTemp - this.lapseRate * (k * this.dz / 1000.0);
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              const xNorm = i / (nx - 1);
              const yNorm = j / (ny - 1);

              this.u[idx] = 16.0;
              this.v[idx] = 0.0;
              this.T[idx] = envT;
              this.q[idx] = this.calcSatHumidity(envT, k) * 0.88;

              const band = Math.sin(yNorm * 18.0);
              if (xNorm > 0.45 && band > 0.2 && k >= 1 && k <= 5) {
                this.qc[idx] = 1.6;
                this.qr[idx] = 1.8;
                this.w[idx] = 6.0;
              }
            }
          }
        }
        break;

      case "numerical_stress_test":
        this.initTerrain("mountains");
        this.baseSurfaceTemp = 25.0;
        this.lapseRate = 9.5;
        this.baseHumidity = 95.0;
        this.windBaseSpeed = 35.0;
        this.windShear = 25.0;
        this.buoyancyStrength = 2.5;

        for (let k = 0; k < nz; k++) {
          for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
              const idx = this.idx3D(i, j, k);
              const checker = ((i ^ j) & 1) ? 1.0 : -1.0;
              this.u[idx] = ((j % 4) - 2) * 20.0;
              this.v[idx] = ((i % 4) - 2) * 20.0;
              this.w[idx] = checker * 15.0;
              this.T[idx] = 20.0 + checker * 15.0;
              this.q[idx] = Math.max(0.1, 10.0 + checker * 8.0);
              this.qc[idx] = Math.max(0, checker * 3.0);
              this.qr[idx] = Math.max(0, -checker * 3.0);
            }
          }
        }
        break;
    }

    this.simTime = 0.0;
    this.probe.history = [];
    this.updateTextureBuffers();
  }

  exportStateJSON() {
    return JSON.stringify({
      version: "2.0",
      nx: this.nx,
      ny: this.ny,
      nz: this.nz,
      simTime: this.simTime,
      activePreset: this.activePreset,
      params: {
        dt: this.dt,
        substeps: this.substeps,
        lapseRate: this.lapseRate,
        baseSurfaceTemp: this.baseSurfaceTemp,
        baseHumidity: this.baseHumidity,
        evapRate: this.evapRate,
        condThresh: this.condThresh,
        precipRate: this.precipRate,
        buoyancyStrength: this.buoyancyStrength,
        windBaseSpeed: this.windBaseSpeed,
        windBaseDir: this.windBaseDir,
        windShear: this.windShear,
        coriolisParam: this.coriolisParam,
        terrainInfluence: this.terrainInfluence,
        diffusion: this.diffusion,
        timeOfDay: this.timeOfDay
      },
      terrain: Array.from(this.terrain),
      surfaceType: Array.from(this.surfaceType),
      u: Array.from(this.u),
      v: Array.from(this.v),
      w: Array.from(this.w),
      T: Array.from(this.T),
      q: Array.from(this.q),
      qc: Array.from(this.qc),
      qr: Array.from(this.qr)
    });
  }

  importStateJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || !data.nx || !data.ny || !data.nz || !data.params) {
        throw new Error("Invalid state format: Missing grid or parameters");
      }
      this.initGrid(data.nx, data.ny, data.nz);
      Object.assign(this, data.params);
      this.simTime = data.simTime || 0;
      this.activePreset = data.activePreset || "custom";

      if (data.terrain) this.terrain.set(data.terrain);
      if (data.surfaceType) this.surfaceType.set(data.surfaceType);
      if (data.u) this.u.set(data.u);
      if (data.v) this.v.set(data.v);
      if (data.w) this.w.set(data.w);
      if (data.T) this.T.set(data.T);
      if (data.q) this.q.set(data.q);
      if (data.qc) this.qc.set(data.qc);
      if (data.qr) this.qr.set(data.qr);

      this.updateTextureBuffers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}
