// WebGL2 Atmospheric 3D Renderer & Volumetric Raymarcher

class WeatherRenderer {
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.sim = sim;
    this.gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });

    if (!this.gl) {
      document.getElementById("webglFallback").classList.add("open");
      throw new Error("WebGL2 not supported");
    }

    const gl = this.gl;
    this.extFloat = gl.getExtension("EXT_color_buffer_float");
    this.extLinear = gl.getExtension("OES_texture_float_linear");

    this.camera = {
      target: Vec3.create(0, 0, 3.5),
      distance: 38.0,
      theta: 0.8,
      phi: 0.45,
      fov: 55 * Math.PI / 180,
      near: 0.5,
      far: 150.0,
      mode: "overview",
      orbitSpeed: 0.003
    };

    this.visMode = 0;
    this.renderScale = 1.0;
    this.cloudQuality = 32;
    this.cloudDensity = 1.2;
    this.precipDensity = 8000;
    this.exposure = 1.1;
    this.showStreamlines = true;
    this.showSlicePlane = false;
    this.sliceAxis = 1;
    this.slicePos = 0.5;

    this.matView = Mat4.create();
    this.matProj = Mat4.create();
    this.matViewProj = Mat4.create();
    this.matInvViewProj = Mat4.create();
    this.camPos = Vec3.create();

    this.texCloud3D = null;
    this.texWind3D = null;
    this.texTerrain2D = null;

    this.initShaders();
    this.initTextures();
    this.initMeshes();
    this.initParticles();
  }

  createShader(type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      console.error("Shader compile error:", err);
      throw new Error("Shader compile error: " + err);
    }
    return shader;
  }

  createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const vs = this.createShader(gl.VERTEX_SHADER, vsSrc);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      console.error("Program link error:", err);
      throw new Error("Program link error: " + err);
    }
    return prog;
  }

  initShaders() {
    const gl = this.gl;

    // 1. Sky Shader
    const vsSky = `#version 300 es
      in vec2 a_position;
      out vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.9999, 1.0);
      }
    `;

    const fsSky = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 fragColor;

      uniform mat4 u_invViewProj;
      uniform vec3 u_camPos;
      uniform vec3 u_sunDir;
      uniform float u_timeOfDay;
      uniform float u_exposure;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec4 ndc = vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
        vec4 worldFar = u_invViewProj * ndc;
        worldFar /= worldFar.w;
        vec3 rayDir = normalize(worldFar.xyz - u_camPos);

        float sunElev = u_sunDir.z;
        float dayFactor = clamp(sunElev * 3.0 + 0.1, 0.0, 1.0);

        vec3 zenithDay = vec3(0.18, 0.42, 0.85);
        vec3 horizonDay = vec3(0.65, 0.78, 0.92);
        vec3 sunsetColor = vec3(0.95, 0.45, 0.18);
        vec3 nightSky = vec3(0.015, 0.02, 0.045);

        float horizonGrad = pow(1.0 - max(0.0, rayDir.z), 3.0);
        vec3 skyDay = mix(zenithDay, horizonDay, horizonGrad);
        float sunsetBlend = exp(-sunElev * sunElev * 18.0) * horizonGrad;
        skyDay = mix(skyDay, sunsetColor, sunsetBlend);

        float stars = 0.0;
        if (dayFactor < 0.3 && rayDir.z > 0.05) {
          vec2 starCoord = rayDir.xy / (rayDir.z + 0.3) * 120.0;
          float h = hash(floor(starCoord));
          if (h > 0.985) {
            stars = pow(hash(floor(starCoord) + 0.5), 15.0) * (1.0 - dayFactor * 3.0);
          }
        }

        vec3 skyColor = mix(nightSky + vec3(stars), skyDay, dayFactor);

        float cosTheta = dot(rayDir, u_sunDir);
        if (cosTheta > 0.0) {
          float sunDisc = smoothstep(0.9992, 0.9998, cosTheta);
          float sunHalo = pow(cosTheta, 32.0) * 0.4;
          vec3 sunLightColor = mix(vec3(1.0, 0.5, 0.2), vec3(1.0, 0.98, 0.9), clamp(sunElev * 2.0, 0.0, 1.0));
          skyColor += (sunDisc * 3.5 + sunHalo) * sunLightColor * dayFactor;
        }

        vec3 moonDir = -u_sunDir;
        float cosMoon = dot(rayDir, moonDir);
        if (cosMoon > 0.0 && dayFactor < 0.4) {
          float moonDisc = smoothstep(0.9985, 0.9995, cosMoon);
          skyColor += moonDisc * vec3(0.85, 0.9, 1.0) * (1.0 - dayFactor * 2.5);
        }

        fragColor = vec4(skyColor * u_exposure, 1.0);
      }
    `;
    this.progSky = this.createProgram(vsSky, fsSky);

    // 2. Terrain Shader
    const vsTerrain = `#version 300 es
      in vec2 a_gridPos;
      out vec3 v_worldPos;
      out vec3 v_normal;
      out vec2 v_uv;
      out float v_biome;
      out float v_wetness;

      uniform mat4 u_viewProj;
      uniform sampler2D u_terrainTex;
      uniform vec2 u_domainSize;
      uniform float u_maxElevation;

      void main() {
        vec2 uv = a_gridPos / u_domainSize + 0.5;
        v_uv = uv;

        vec4 data = texture(u_terrainTex, uv);
        float h = data.r * u_maxElevation;
        v_biome = data.g;
        v_wetness = data.a;

        float eps = 1.0 / 128.0;
        float hR = texture(u_terrainTex, uv + vec2(eps, 0.0)).r * u_maxElevation;
        float hL = texture(u_terrainTex, uv - vec2(eps, 0.0)).r * u_maxElevation;
        float hT = texture(u_terrainTex, uv + vec2(0.0, eps)).r * u_maxElevation;
        float hB = texture(u_terrainTex, uv - vec2(0.0, eps)).r * u_maxElevation;

        vec3 normal = normalize(vec3((hL - hR) / (2.0 * eps * u_domainSize.x),
                                     (hB - hT) / (2.0 * eps * u_domainSize.y),
                                     1.0));
        v_normal = normal;
        v_worldPos = vec3(a_gridPos.x, a_gridPos.y, h);

        gl_Position = u_viewProj * vec4(v_worldPos, 1.0);
      }
    `;

    const fsTerrain = `#version 300 es
      precision highp float;
      in vec3 v_worldPos;
      in vec3 v_normal;
      in vec2 v_uv;
      in float v_biome;
      in float v_wetness;
      out vec4 fragColor;

      uniform vec3 u_camPos;
      uniform vec3 u_sunDir;
      uniform float u_timeOfDay;
      uniform float u_exposure;
      uniform float u_lightningFlash;
      uniform int u_visMode;

      vec3 turboColormap(float t) {
        t = clamp(t, 0.0, 1.0);
        return clamp(vec3(
          0.1357 + t * (4.6153 - t * (42.660 + t * (-132.13 + t * (158.4 - t * 65.6)))),
          0.0914 + t * (2.1941 + t * (4.8429 - t * (14.185 + t * (4.277 - t * 2.82)))),
          0.1066 + t * (12.559 - t * (86.195 + t * (235.34 - t * (282.8 - t * 123.6))))
        ), 0.0, 1.0);
      }

      void main() {
        vec3 N = normalize(v_normal);
        vec3 V = normalize(u_camPos - v_worldPos);
        vec3 L = normalize(u_sunDir);

        float sunElev = max(0.0, L.z);
        float NdotL = max(0.0, dot(N, L));
        float ambient = 0.25 + 0.35 * max(0.0, L.z);

        vec3 colPlains = vec3(0.24, 0.44, 0.18);
        vec3 colForest = vec3(0.12, 0.28, 0.12);
        vec3 colDesert = vec3(0.72, 0.58, 0.38);
        vec3 colWater  = vec3(0.08, 0.25, 0.45);
        vec3 colCity   = vec3(0.32, 0.34, 0.36);
        vec3 colRock   = vec3(0.38, 0.35, 0.32);
        vec3 colSnow   = vec3(0.92, 0.94, 0.98);

        int bType = int(v_biome + 0.5);
        vec3 baseCol = colPlains;
        if (bType == 1) baseCol = colWater;
        else if (bType == 2) baseCol = colForest;
        else if (bType == 3) baseCol = colDesert;
        else if (bType == 4) baseCol = colCity;

        float slope = 1.0 - N.z;
        if (bType != 1) {
          baseCol = mix(baseCol, colRock, smoothstep(0.25, 0.55, slope));
        }

        float snowLine = 6.2;
        if (bType != 1 && v_worldPos.z > snowLine) {
          baseCol = mix(baseCol, colSnow, smoothstep(snowLine, snowLine + 1.5, v_worldPos.z));
        }

        float wet = clamp(v_wetness * 0.15, 0.0, 1.0);
        baseCol *= (1.0 - wet * 0.35);

        vec3 H = normalize(L + V);
        float NdotH = max(0.0, dot(N, H));
        float spec = 0.0;
        if (bType == 1) {
          spec = pow(NdotH, 64.0) * 0.8 * sunElev;
        } else if (wet > 0.1) {
          spec = pow(NdotH, 32.0) * wet * 0.4 * sunElev;
        }

        float flash = u_lightningFlash * 2.0;
        vec3 litColor = baseCol * (ambient + NdotL * 0.85 * sunElev + flash) + vec3(spec);

        if (u_visMode == 9) {
          litColor = turboColormap(v_worldPos.z / 9.0) * (0.6 + 0.4 * NdotL);
        }

        float dist = length(u_camPos - v_worldPos);
        float fog = 1.0 - exp(-dist * 0.015);
        vec3 fogColor = vec3(0.65, 0.75, 0.88) * (0.2 + 0.8 * sunElev);
        litColor = mix(litColor, fogColor, fog);

        fragColor = vec4(litColor * u_exposure, 1.0);
      }
    `;
    this.progTerrain = this.createProgram(vsTerrain, fsTerrain);

    // 3. Volumetric Raymarcher Shader
    const vsCloud = `#version 300 es
      in vec2 a_position;
      out vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsCloud = `#version 300 es
      precision highp float;
      precision highp sampler3D;
      in vec2 v_uv;
      out vec4 fragColor;

      uniform mat4 u_invViewProj;
      uniform vec3 u_camPos;
      uniform vec3 u_sunDir;
      uniform float u_exposure;
      uniform float u_lightningFlash;
      uniform int u_visMode;
      uniform int u_numSteps;
      uniform float u_densityMult;
      uniform sampler3D u_cloudVolume; // R=qc, G=q, B=T, A=qr
      uniform sampler3D u_windVolume;  // R=u, G=v, B=w, A=p

      uniform vec3 u_boxMin;
      uniform vec3 u_boxMax;

      uniform int u_showSlice;
      uniform int u_sliceAxis;
      uniform float u_slicePos;

      bool intersectBox(vec3 ro, vec3 rd, vec3 bMin, vec3 bMax, out float tNear, out float tFar) {
        vec3 invR = 1.0 / rd;
        vec3 t0 = (bMin - ro) * invR;
        vec3 t1 = (bMax - ro) * invR;
        vec3 tmin = min(t0, t1);
        vec3 tmax = max(t0, t1);
        tNear = max(max(tmin.x, tmin.y), tmin.z);
        tFar = min(min(tmax.x, tmax.y), tmax.z);
        return tNear < tFar && tFar > 0.0;
      }

      vec3 radarColormap(float dbz) {
        if (dbz < 15.0) return vec3(0.0);
        if (dbz < 28.0) return mix(vec3(0.1, 0.6, 0.1), vec3(0.2, 0.85, 0.2), (dbz - 15.0) / 13.0);
        if (dbz < 40.0) return mix(vec3(0.2, 0.85, 0.2), vec3(0.95, 0.9, 0.1), (dbz - 28.0) / 12.0);
        if (dbz < 52.0) return mix(vec3(0.95, 0.9, 0.1), vec3(0.95, 0.15, 0.1), (dbz - 40.0) / 12.0);
        if (dbz < 65.0) return mix(vec3(0.95, 0.15, 0.1), vec3(0.85, 0.1, 0.85), (dbz - 52.0) / 13.0);
        return vec3(0.98, 0.95, 1.0);
      }

      vec3 turboColormap(float t) {
        t = clamp(t, 0.0, 1.0);
        return clamp(vec3(
          0.1357 + t * (4.6153 - t * (42.660 + t * (-132.13 + t * (158.4 - t * 65.6)))),
          0.0914 + t * (2.1941 + t * (4.8429 - t * (14.185 + t * (4.277 - t * 2.82)))),
          0.1066 + t * (12.559 - t * (86.195 + t * (235.34 - t * (282.8 - t * 123.6))))
        ), 0.0, 1.0);
      }

      vec3 bipolarColormap(float val) {
        if (val > 0.0) return mix(vec3(0.35), vec3(0.95, 0.2, 0.1), clamp(val, 0.0, 1.0));
        return mix(vec3(0.35), vec3(0.1, 0.45, 0.95), clamp(-val, 0.0, 1.0));
      }

      void main() {
        vec4 ndc = vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
        vec4 worldFar = u_invViewProj * ndc;
        worldFar /= worldFar.w;
        vec3 rayDir = normalize(worldFar.xyz - u_camPos);

        float tNear, tFar;
        if (!intersectBox(u_camPos, rayDir, u_boxMin, u_boxMax, tNear, tFar)) {
          discard;
        }

        tNear = max(0.0, tNear);
        float rayLen = tFar - tNear;
        if (rayLen <= 0.0) discard;

        int steps = u_numSteps;
        float stepSize = rayLen / float(steps);

        // Jitter to eliminate banding
        float jitter = fract(sin(dot(v_uv, vec2(12.9898, 78.233))) * 43758.5453) * 0.5;
        float t = tNear + stepSize * jitter;
        vec3 accumColor = vec3(0.0);
        float transmittance = 1.0;

        vec3 L = normalize(u_sunDir);
        float sunElev = max(0.0, L.z);
        vec3 sunColor = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.98, 0.92), clamp(sunElev * 2.5, 0.0, 1.0));
        vec3 ambientSky = vec3(0.25, 0.35, 0.5) * (0.3 + 0.7 * sunElev);

        float cosTheta = dot(rayDir, L);
        float g = 0.55;
        float phaseHG = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5) / 12.56;

        for (int i = 0; i < 64; i++) {
          if (i >= steps || transmittance < 0.02) break;

          vec3 pos = u_camPos + rayDir * t;
          vec3 uv3 = (pos - u_boxMin) / (u_boxMax - u_boxMin);

          if (u_showSlice == 1) {
            float sliceCoord = u_sliceAxis == 0 ? uv3.x : (u_sliceAxis == 1 ? uv3.y : uv3.z);
            if (abs(sliceCoord - u_slicePos) > 0.015) {
              t += stepSize;
              continue;
            }
          }

          vec4 data = texture(u_cloudVolume, uv3);
          float qc = data.r * 3.0;
          float q  = data.g * 18.0;
          float T  = data.b * 80.0 - 40.0;
          float qr = data.a * 4.0;

          vec4 wData = texture(u_windVolume, uv3);
          float u = wData.r * 100.0 - 50.0;
          float v = wData.g * 100.0 - 50.0;
          float w = wData.b * 50.0 - 25.0;
          float p = wData.a * 10.0 - 5.0;
          float horizSpd = length(vec2(u, v));

          float density = qc * u_densityMult;

          if (u_visMode == 0) { // Cinematic Cloud Mode
            float billow = sin(pos.x * 1.5) * cos(pos.y * 1.5) * sin(pos.z * 2.5) * 0.15;
            float effDensity = max(0.0, density + (density > 0.04 ? billow : 0.0));

            if (effDensity > 0.02) {
              vec3 shadowPos = pos + L * 0.45;
              vec3 sUv = (shadowPos - u_boxMin) / (u_boxMax - u_boxMin);
              float shadowDensity = texture(u_cloudVolume, sUv).r * 3.0;
              float sunShadow = exp(-shadowDensity * 2.2);

              float flashLight = u_lightningFlash * 3.5;
              vec3 cloudLighting = (sunColor * sunShadow * (0.35 + phaseHG * 1.8) * sunElev + ambientSky + vec3(flashLight)) * 1.4;

              float extinction = effDensity * 0.65;
              float stepTransmittance = exp(-extinction * stepSize);
              accumColor += (cloudLighting * (1.0 - stepTransmittance)) * transmittance;
              transmittance *= stepTransmittance;
            }
          } else { // Diagnostic Modes
            vec3 diagCol = vec3(0.0);
            float diagAlpha = 0.0;

            if (u_visMode == 1) { // Temp
              float tNorm = clamp((T + 40.0) / 70.0, 0.0, 1.0);
              diagCol = turboColormap(tNorm);
              diagAlpha = clamp(0.08 + qc * 0.4, 0.0, 0.85) * stepSize;
            } else if (u_visMode == 2) { // Humidity
              float qNorm = clamp(q / 16.0, 0.0, 1.0);
              diagCol = mix(vec3(0.05, 0.1, 0.3), vec3(0.2, 0.85, 0.95), qNorm);
              diagAlpha = clamp(qNorm * 0.2 + qc * 0.3, 0.0, 0.85) * stepSize;
            } else if (u_visMode == 3) { // Cloud Water
              if (qc > 0.02) {
                diagCol = mix(vec3(0.3, 0.6, 0.9), vec3(1.0, 1.0, 1.0), clamp(qc / 2.0, 0.0, 1.0));
                diagAlpha = clamp(qc * 0.8, 0.0, 0.9) * stepSize;
              }
            } else if (u_visMode == 4) { // Precipitation Radar dBZ
              float dbz = (qr > 0.005) ? (10.0 * log(qr * 2000.0) / log(10.0) + 15.0) : 0.0;
              if (dbz > 14.0) {
                diagCol = radarColormap(dbz);
                diagAlpha = clamp((dbz - 10.0) / 45.0, 0.1, 0.9) * stepSize;
              }
            } else if (u_visMode == 5) { // Buoyancy
              diagCol = bipolarColormap(clamp(p / 3.0, -1.0, 1.0));
              diagAlpha = clamp(abs(p) / 3.0 * 0.35 + 0.05, 0.0, 0.85) * stepSize;
            } else if (u_visMode == 6) { // Horiz Wind Speed
              diagCol = turboColormap(clamp(horizSpd / 30.0, 0.0, 1.0));
              diagAlpha = clamp(horizSpd / 40.0 * 0.25 + 0.05, 0.0, 0.8) * stepSize;
            } else if (u_visMode == 7) { // Vertical Motion
              diagCol = bipolarColormap(clamp(w / 15.0, -1.0, 1.0));
              diagAlpha = clamp(abs(w) / 15.0 * 0.45 + 0.05, 0.0, 0.85) * stepSize;
            } else if (u_visMode == 8) { // Vorticity / Rotation
              float curl = (u - v) * 0.05;
              diagCol = bipolarColormap(clamp(curl, -1.0, 1.0));
              diagAlpha = clamp(abs(curl) * 0.4 + 0.05, 0.0, 0.85) * stepSize;
            }

            if (diagAlpha > 0.005) {
              accumColor += diagCol * diagAlpha * transmittance;
              transmittance *= (1.0 - diagAlpha);
            }
          }

          t += stepSize;
        }

        fragColor = vec4(accumColor * u_exposure, 1.0 - transmittance);
      }
    `;
    this.progCloud = this.createProgram(vsCloud, fsCloud);

    // 4. Precipitation Particle Shader
    const vsParticle = `#version 300 es
      in vec3 a_position;
      in vec3 a_velocity;
      out float v_speed;
      out vec3 v_pos;

      uniform mat4 u_viewProj;
      uniform vec3 u_camPos;
      uniform float u_time;
      uniform vec3 u_domainMin;
      uniform vec3 u_domainMax;
      uniform float u_pointSize;

      void main() {
        vec3 box = u_domainMax - u_domainMin;
        vec3 p = a_position + a_velocity * u_time;
        p = mod(p - u_domainMin, box) + u_domainMin;
        v_pos = p;
        v_speed = length(a_velocity);

        gl_Position = u_viewProj * vec4(p, 1.0);
        gl_PointSize = clamp(u_pointSize / gl_Position.w * 35.0, 1.5, 8.0);
      }
    `;

    const fsParticle = `#version 300 es
      precision highp float;
      in float v_speed;
      in vec3 v_pos;
      out vec4 fragColor;

      uniform float u_lightningFlash;
      uniform int u_isSnow;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        if (dot(coord, coord) > 0.25) discard;

        vec3 col = (u_isSnow == 1) ? vec3(0.95, 0.95, 1.0) : vec3(0.65, 0.8, 0.95);
        col += vec3(u_lightningFlash * 1.5);
        fragColor = vec4(col, 0.65);
      }
    `;
    this.progParticle = this.createProgram(vsParticle, fsParticle);

    // 5. Lightning Bolt Shader
    const vsLightning = `#version 300 es
      in vec3 a_position;
      uniform mat4 u_viewProj;

      void main() {
        gl_Position = u_viewProj * vec4(a_position, 1.0);
      }
    `;
    const fsLightning = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform float u_flash;

      void main() {
        fragColor = vec4(0.85, 0.95, 1.0, u_flash);
      }
    `;
    this.progLightning = this.createProgram(vsLightning, fsLightning);
  }

  initTextures() {
    const gl = this.gl;
    const sim = this.sim;

    this.texCloud3D = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.texCloud3D);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, sim.nx, sim.ny, sim.nz, 0, gl.RGBA, gl.UNSIGNED_BYTE, sim.textureData);

    this.texWind3D = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.texWind3D);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, sim.nx, sim.ny, sim.nz, 0, gl.RGBA, gl.UNSIGNED_BYTE, sim.windTextureData);

    this.texTerrain2D = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texTerrain2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, sim.nx, sim.ny, 0, gl.RGBA, gl.FLOAT, sim.terrainTexData);
  }

  initMeshes() {
    const gl = this.gl;

    const quadVerts = new Float32Array([
      -1, -1,   1, -1,  -1,  1,
      -1,  1,   1, -1,   1,  1
    ]);
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    const quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const tGridSize = 128;
    const terrainVerts = [];
    const terrainIndices = [];

    const domainW = 48.0;
    const domainH = 48.0;

    for (let j = 0; j <= tGridSize; j++) {
      const y = (j / tGridSize - 0.5) * domainH;
      for (let i = 0; i <= tGridSize; i++) {
        const x = (i / tGridSize - 0.5) * domainW;
        terrainVerts.push(x, y);
      }
    }

    for (let j = 0; j < tGridSize; j++) {
      for (let i = 0; i < tGridSize; i++) {
        const row1 = j * (tGridSize + 1);
        const row2 = (j + 1) * (tGridSize + 1);
        terrainIndices.push(row1 + i, row2 + i, row1 + i + 1);
        terrainIndices.push(row1 + i + 1, row2 + i, row2 + i + 1);
      }
    }

    this.terrainVAO = gl.createVertexArray();
    gl.bindVertexArray(this.terrainVAO);

    const terrainVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, terrainVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(terrainVerts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const terrainIBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, terrainIBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(terrainIndices), gl.STATIC_DRAW);

    this.terrainIndexCount = terrainIndices.length;

    this.lightningVAO = gl.createVertexArray();
    gl.bindVertexArray(this.lightningVAO);
    this.lightningVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lightningVBO);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  }

  initParticles() {
    const gl = this.gl;
    const count = 15000;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 48.0;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 48.0;
      pos[i * 3 + 2] = Math.random() * 11.2;

      vel[i * 3 + 0] = (Math.random() - 0.5) * 6.0;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 6.0;
      vel[i * 3 + 2] = -8.0 - Math.random() * 4.0;
    }

    this.particleVAO = gl.createVertexArray();
    gl.bindVertexArray(this.particleVAO);

    const pVboPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pVboPos);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const pVboVel = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pVboVel);
    gl.bufferData(gl.ARRAY_BUFFER, vel, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    this.particleCount = count;
  }

  updateCamera(aspect) {
    if (this.camera.mode === "cinematic_orbit") {
      this.camera.theta += this.camera.orbitSpeed;
    }

    const cam = this.camera;
    const eyeX = cam.target[0] + cam.distance * Math.cos(cam.phi) * Math.sin(cam.theta);
    const eyeY = cam.target[1] + cam.distance * Math.cos(cam.phi) * Math.cos(cam.theta);
    const eyeZ = cam.target[2] + cam.distance * Math.sin(cam.phi);
    Vec3.set(this.camPos, eyeX, eyeY, eyeZ);

    Mat4.perspective(this.matProj, cam.fov, aspect, cam.near, cam.far);
    Mat4.lookAt(this.matView, this.camPos, cam.target, Vec3.create(0, 0, 1));
    Mat4.multiply(this.matViewProj, this.matProj, this.matView);
    Mat4.invert(this.matInvViewProj, this.matViewProj);

    const sunAngle = (this.sim.timeOfDay / 24.0) * Math.PI * 2.0 - Math.PI / 2.0;
    this.sunDir = Vec3.create(
      Math.cos(sunAngle) * 0.7,
      0.3,
      Math.sin(sunAngle)
    );
    Vec3.normalize(this.sunDir, this.sunDir);
  }

  setCameraPreset(preset) {
    this.camera.mode = preset;
    switch (preset) {
      case "overview":
        Vec3.set(this.camera.target, 0, 0, 3.5);
        this.camera.distance = 38.0;
        this.camera.theta = 0.8;
        this.camera.phi = 0.45;
        this.camera.fov = 55 * Math.PI / 180;
        break;
      case "chaser":
        Vec3.set(this.camera.target, 2, 4, 2.5);
        this.camera.distance = 18.0;
        this.camera.theta = 2.8;
        this.camera.phi = 0.12;
        this.camera.fov = 65 * Math.PI / 180;
        break;
      case "cloud_top":
        Vec3.set(this.camera.target, 0, 0, 7.5);
        this.camera.distance = 28.0;
        this.camera.theta = 1.2;
        this.camera.phi = 0.65;
        this.camera.fov = 50 * Math.PI / 180;
        break;
      case "valley":
        Vec3.set(this.camera.target, -2, -4, 2.0);
        this.camera.distance = 14.0;
        this.camera.theta = 3.5;
        this.camera.phi = 0.18;
        this.camera.fov = 60 * Math.PI / 180;
        break;
      case "cinematic_orbit":
        Vec3.set(this.camera.target, 0, 0, 3.5);
        this.camera.distance = 34.0;
        this.camera.phi = 0.38;
        break;
    }
  }

  render() {
    const gl = this.gl;
    const sim = this.sim;

    const width = Math.floor(this.canvas.clientWidth * this.renderScale);
    const height = Math.floor(this.canvas.clientHeight * this.renderScale);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);

    this.updateCamera(width / height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this.texCloud3D);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, sim.nx, sim.ny, sim.nz, gl.RGBA, gl.UNSIGNED_BYTE, sim.textureData);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texTerrain2D);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, sim.nx, sim.ny, gl.RGBA, gl.FLOAT, sim.terrainTexData);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_3D, this.texWind3D);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, sim.nx, sim.ny, sim.nz, gl.RGBA, gl.UNSIGNED_BYTE, sim.windTextureData);

    gl.clearColor(0.05, 0.08, 0.14, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const lightningFlash = sim.activeLightning ? (sim.activeLightning.timer / 0.25) : 0.0;

    // 1. Sky Dome
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.progSky);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.progSky, "u_invViewProj"), false, this.matInvViewProj);
    gl.uniform3fv(gl.getUniformLocation(this.progSky, "u_camPos"), this.camPos);
    gl.uniform3fv(gl.getUniformLocation(this.progSky, "u_sunDir"), this.sunDir);
    gl.uniform1f(gl.getUniformLocation(this.progSky, "u_timeOfDay"), sim.timeOfDay);
    gl.uniform1f(gl.getUniformLocation(this.progSky, "u_exposure"), this.exposure);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 2. Terrain Surface
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.useProgram(this.progTerrain);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.progTerrain, "u_viewProj"), false, this.matViewProj);
    gl.uniform1i(gl.getUniformLocation(this.progTerrain, "u_terrainTex"), 1);
    gl.uniform2f(gl.getUniformLocation(this.progTerrain, "u_domainSize"), 48.0, 48.0);
    gl.uniform1f(gl.getUniformLocation(this.progTerrain, "u_maxElevation"), 11.2);
    gl.uniform3fv(gl.getUniformLocation(this.progTerrain, "u_camPos"), this.camPos);
    gl.uniform3fv(gl.getUniformLocation(this.progTerrain, "u_sunDir"), this.sunDir);
    gl.uniform1f(gl.getUniformLocation(this.progTerrain, "u_timeOfDay"), sim.timeOfDay);
    gl.uniform1f(gl.getUniformLocation(this.progTerrain, "u_exposure"), this.exposure);
    gl.uniform1f(gl.getUniformLocation(this.progTerrain, "u_lightningFlash"), lightningFlash);
    gl.uniform1i(gl.getUniformLocation(this.progTerrain, "u_visMode"), this.visMode);

    gl.bindVertexArray(this.terrainVAO);
    gl.drawElements(gl.TRIANGLES, this.terrainIndexCount, gl.UNSIGNED_INT, 0);

    // 3. Volumetric Clouds & Atmospheric Raymarching
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.progCloud);

    gl.uniformMatrix4fv(gl.getUniformLocation(this.progCloud, "u_invViewProj"), false, this.matInvViewProj);
    gl.uniform3fv(gl.getUniformLocation(this.progCloud, "u_camPos"), this.camPos);
    gl.uniform3fv(gl.getUniformLocation(this.progCloud, "u_sunDir"), this.sunDir);
    gl.uniform1f(gl.getUniformLocation(this.progCloud, "u_exposure"), this.exposure);
    gl.uniform1f(gl.getUniformLocation(this.progCloud, "u_lightningFlash"), lightningFlash);
    gl.uniform1i(gl.getUniformLocation(this.progCloud, "u_visMode"), this.visMode);
    gl.uniform1i(gl.getUniformLocation(this.progCloud, "u_numSteps"), this.cloudQuality);
    gl.uniform1f(gl.getUniformLocation(this.progCloud, "u_densityMult"), this.cloudDensity);
    gl.uniform1i(gl.getUniformLocation(this.progCloud, "u_cloudVolume"), 0);
    gl.uniform1i(gl.getUniformLocation(this.progCloud, "u_windVolume"), 2);

    gl.uniform3f(gl.getUniformLocation(this.progCloud, "u_boxMin"), -24.0, -24.0, 0.0);
    gl.uniform3f(gl.getUniformLocation(this.progCloud, "u_boxMax"),  24.0,  24.0, 11.2);

    gl.uniform1i(gl.getUniformLocation(this.progCloud, "u_showSlice"), this.showSlicePlane ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(this.progCloud, "u_sliceAxis"), this.sliceAxis);
    gl.uniform1f(gl.getUniformLocation(this.progCloud, "u_slicePos"), this.slicePos);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 4. Falling Precipitation Particles
    if (this.precipDensity > 0 && sim.stats.cloudCover > 2) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(this.progParticle);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.progParticle, "u_viewProj"), false, this.matViewProj);
      gl.uniform3fv(gl.getUniformLocation(this.progParticle, "u_camPos"), this.camPos);
      gl.uniform1f(gl.getUniformLocation(this.progParticle, "u_time"), sim.simTime * 2.0);
      gl.uniform3f(gl.getUniformLocation(this.progParticle, "u_domainMin"), -24.0, -24.0, 0.0);
      gl.uniform3f(gl.getUniformLocation(this.progParticle, "u_domainMax"),  24.0,  24.0, 11.2);
      gl.uniform1f(gl.getUniformLocation(this.progParticle, "u_pointSize"), 4.0);
      gl.uniform1f(gl.getUniformLocation(this.progParticle, "u_lightningFlash"), lightningFlash);
      gl.uniform1i(gl.getUniformLocation(this.progParticle, "u_isSnow"), sim.activePreset === "snow_band" ? 1 : 0);

      gl.bindVertexArray(this.particleVAO);
      gl.drawArrays(gl.POINTS, 0, Math.min(this.particleCount, this.precipDensity));
    }

    // 5. Procedural Branching Lightning Bolt
    if (sim.activeLightning && sim.activeLightning.segments.length > 0) {
      const segs = sim.activeLightning.segments;
      const boltVerts = [];
      const nx = sim.nx, ny = sim.ny, nz = sim.nz;

      for (let s = 0; s < segs.length; s++) {
        const seg = segs[s];
        boltVerts.push(
          (seg[0] / (nx - 1) - 0.5) * 48.0,
          (seg[1] / (ny - 1) - 0.5) * 48.0,
          (seg[2] / (nz - 1)) * 11.2,
          (seg[3] / (nx - 1) - 0.5) * 48.0,
          (seg[4] / (ny - 1) - 0.5) * 48.0,
          (seg[5] / (nz - 1)) * 11.2
        );
      }

      gl.useProgram(this.progLightning);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.progLightning, "u_viewProj"), false, this.matViewProj);
      gl.uniform1f(gl.getUniformLocation(this.progLightning, "u_flash"), lightningFlash);

      gl.bindVertexArray(this.lightningVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lightningVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boltVerts), gl.DYNAMIC_DRAW);

      gl.lineWidth(2.5);
      gl.drawArrays(gl.LINES, 0, boltVerts.length / 3);
    }

    gl.disable(gl.BLEND);
  }
}
