    (function () {
      'use strict';

      // ==========================================
      // 1. PROCEDURAL SOUND SYNTHESIZER (Web Audio)
      // ==========================================
      class SoundEngine {
        constructor() {
          this.ctx = null;
          this.enabled = true;
          this.masterGain = null;
        }

        init() {
          if (this.ctx) return;
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
          } catch (e) {
            console.warn('Web Audio not supported', e);
          }
        }

        toggleMute() {
          this.enabled = !this.enabled;
          if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.enabled ? 0.3 : 0.0, this.ctx.currentTime);
          }
          return this.enabled;
        }

        playPop() {
          if (!this.enabled || !this.ctx) return;
          try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.05);
          } catch (e) {}
        }

        playThud() {
          if (!this.enabled || !this.ctx) return;
          try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.12);
          } catch (e) {}
        }

        playWhoosh() {
          if (!this.enabled || !this.ctx) return;
          try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.1);
          } catch (e) {}
        }

        playChime() {
          if (!this.enabled || !this.ctx) return;
          try {
            const now = this.ctx.currentTime;
            const freqs = [523.25, 659.25, 783.99, 1046.50];
            freqs.forEach((f, idx) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              const start = now + idx * 0.06;
              osc.type = 'sine';
              osc.frequency.setValueAtTime(f, start);
              gain.gain.setValueAtTime(0.2, start);
              gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
              osc.connect(gain);
              gain.connect(this.masterGain);
              osc.start(start);
              osc.stop(start + 0.35);
            });
          } catch (e) {}
        }

        playBuzz() {
          if (!this.enabled || !this.ctx) return;
          try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(90, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.15);
          } catch (e) {}
        }
      }

      const audio = new SoundEngine();

      // ==========================================
      // 2. CONSTANTS, DEFINITIONS & RECIPES
      // ==========================================
      const DIRS = [
        { x: 0, y: -1, name: 'North', rot: 0 },
        { x: 1, y: 0, name: 'East', rot: 90 },
        { x: 0, y: 1, name: 'South', rot: 180 },
        { x: -1, y: 0, name: 'West', rot: 270 }
      ];

      const ITEMS = {
        iron_ore: { id: 'iron_ore', name: 'Iron Ore', color: '#94a3b8', shape: 'rock' },
        copper_ore: { id: 'copper_ore', name: 'Copper Ore', color: '#ea580c', shape: 'rock' },
        coal: { id: 'coal', name: 'Coal', color: '#334155', shape: 'rock' },
        stone: { id: 'stone', name: 'Stone', color: '#cbd5e1', shape: 'rock' },
        iron_ingot: { id: 'iron_ingot', name: 'Iron Ingot', color: '#e2e8f0', shape: 'bar' },
        copper_ingot: { id: 'copper_ingot', name: 'Copper Ingot', color: '#f97316', shape: 'bar' },
        stone_brick: { id: 'stone_brick', name: 'Stone Brick', color: '#94a3b8', shape: 'cube' },
        iron_plate: { id: 'iron_plate', name: 'Iron Plate', color: '#64748b', shape: 'plate' },
        copper_wire: { id: 'copper_wire', name: 'Copper Wire', color: '#fdba74', shape: 'wire' },
        iron_gear: { id: 'iron_gear', name: 'Iron Gear', color: '#475569', shape: 'gear' },
        circuit: { id: 'circuit', name: 'Electronic Circuit', color: '#10b981', shape: 'chip' },
        automation_core: { id: 'automation_core', name: 'Automation Core', color: '#8b5cf6', shape: 'core' },
        quantum_proc: { id: 'quantum_proc', name: 'Quantum Processor', color: '#06b6d4', shape: 'lattice' }
      };

      const RECIPES = {
        smelt_iron: {
          id: 'smelt_iron',
          machine: 'smelter',
          name: 'Smelt Iron Ingot',
          inputs: { iron_ore: 1 },
          outputs: { iron_ingot: 1 },
          time: 1.5,
          power: 40
        },
        smelt_copper: {
          id: 'smelt_copper',
          machine: 'smelter',
          name: 'Smelt Copper Ingot',
          inputs: { copper_ore: 1 },
          outputs: { copper_ingot: 1 },
          time: 1.5,
          power: 40
        },
        smelt_brick: {
          id: 'smelt_brick',
          machine: 'smelter',
          name: 'Bake Stone Brick',
          inputs: { stone: 1 },
          outputs: { stone_brick: 1 },
          time: 2.0,
          power: 40
        },
        craft_gear: {
          id: 'craft_gear',
          machine: 'assembler',
          name: 'Craft Iron Gear',
          inputs: { iron_ingot: 1 },
          outputs: { iron_gear: 1 },
          time: 1.0,
          power: 60
        },
        craft_plate: {
          id: 'craft_plate',
          machine: 'assembler',
          name: 'Craft Iron Plate',
          inputs: { iron_ingot: 1 },
          outputs: { iron_plate: 1 },
          time: 1.0,
          power: 60
        },
        craft_wire: {
          id: 'craft_wire',
          machine: 'assembler',
          name: 'Craft Copper Wire',
          inputs: { copper_ingot: 1 },
          outputs: { copper_wire: 2 },
          time: 1.0,
          power: 60
        },
        craft_circuit: {
          id: 'craft_circuit',
          machine: 'assembler',
          name: 'Assemble Circuit',
          inputs: { iron_plate: 1, copper_wire: 2 },
          outputs: { circuit: 1 },
          time: 2.0,
          power: 80
        },
        craft_core: {
          id: 'craft_core',
          machine: 'assembler',
          name: 'Automation Core',
          inputs: { iron_gear: 1, circuit: 1 },
          outputs: { automation_core: 1 },
          time: 3.0,
          power: 100
        },
        craft_proc: {
          id: 'craft_proc',
          machine: 'assembler',
          name: 'Quantum Processor',
          inputs: { automation_core: 1, circuit: 2 },
          outputs: { quantum_proc: 1 },
          time: 4.0,
          power: 120
        }
      };

      const STRUCTURE_DEFS = {
        belt: {
          id: 'belt',
          name: 'Conveyor Belt (Mk1)',
          category: 'logistics',
          w: 1, h: 1,
          cost: 2,
          speed: 2.0,
          icon: '➡️',
          desc: 'Transports items continuously with queuing and backpressure.'
        },
        belt_mk2: {
          id: 'belt_mk2',
          name: 'High-Speed Belt (Mk2)',
          category: 'logistics',
          w: 1, h: 1,
          cost: 5,
          speed: 4.0,
          icon: '⏩',
          desc: 'Twice as fast as standard conveyor belt.'
        },
        splitter: {
          id: 'splitter',
          name: 'Splitter',
          category: 'logistics',
          w: 1, h: 1,
          cost: 10,
          icon: '🔀',
          desc: 'Splits incoming item stream evenly across left/right output directions.'
        },
        merger: {
          id: 'merger',
          name: 'Merger',
          category: 'logistics',
          w: 1, h: 1,
          cost: 10,
          icon: '🔁',
          desc: 'Merges items from multiple incoming belts onto a single outgoing line.'
        },
        inserter: {
          id: 'inserter',
          name: 'Robotic Inserter',
          category: 'logistics',
          w: 1, h: 1,
          cost: 8,
          power: 15,
          icon: '🦾',
          desc: 'Picks up items from behind and swings 180° to deposit ahead.'
        },
        tunnel: {
          id: 'tunnel',
          name: 'Underground Belt',
          category: 'logistics',
          w: 1, h: 1,
          cost: 15,
          icon: '🚇',
          desc: 'Sends items underground up to 4 tiles across existing belt lines.'
        },
        storage: {
          id: 'storage',
          name: 'Storage Container',
          category: 'logistics',
          w: 1, h: 1,
          cost: 15,
          capacity: 100,
          icon: '📦',
          desc: 'Buffers up to 100 items with automatic belt input and output.'
        },
        miner: {
          id: 'miner',
          name: 'Mining Drill',
          category: 'processing',
          w: 2, h: 2,
          cost: 30,
          power: 40,
          icon: '⛏️',
          desc: 'Extracts ores from underlying natural resource deposits.'
        },
        smelter: {
          id: 'smelter',
          name: 'Electric Smelter',
          category: 'processing',
          w: 2, h: 2,
          cost: 40,
          power: 40,
          defaultRecipe: 'smelt_iron',
          icon: '🔥',
          desc: 'Smelts raw ores into refined metallic ingots.'
        },
        assembler: {
          id: 'assembler',
          name: 'Assembler',
          category: 'processing',
          w: 2, h: 2,
          cost: 60,
          power: 60,
          defaultRecipe: 'craft_plate',
          icon: '⚙️',
          desc: 'Combines parts and materials into advanced components.'
        },
        power_pole: {
          id: 'power_pole',
          name: 'Power Substation',
          category: 'power',
          w: 1, h: 1,
          cost: 10,
          radius: 4.5,
          wireReach: 7.0,
          icon: '🗼',
          desc: 'Distributes electricity in a 4.5 tile radius, wires link up to 7 tiles.'
        },
        generator: {
          id: 'generator',
          name: 'Coal Steam Generator',
          category: 'power',
          w: 2, h: 2,
          cost: 75,
          powerGen: 300,
          fuelItem: 'coal',
          icon: '🏭',
          desc: 'Consumes Coal to generate 300 kW of steady electrical power.'
        },
        solar_panel: {
          id: 'solar_panel',
          name: 'Solar Array',
          category: 'power',
          w: 2, h: 2,
          cost: 50,
          powerGen: 100,
          icon: '☀️',
          desc: 'Generates 100 kW of clean renewable electrical energy.'
        },
        hub: {
          id: 'hub',
          name: 'Delivery Hub',
          category: 'processing',
          w: 2, h: 2,
          cost: 100,
          icon: '🚀',
          desc: 'Accepts finished products to fulfill contracts or earn credits.'
        }
      };

      const CAMPAIGN_CONTRACTS = [
        {
          id: 1,
          name: 'Smelting Fundamentals',
          desc: 'Deliver 30 Iron Ingots and 20 Copper Ingots to establish primary production.',
          goals: { iron_ingot: 30, copper_ingot: 20 },
          rewardTech: 'Solar Panels & Mk2 Belts'
        },
        {
          id: 2,
          name: 'Component Machining',
          desc: 'Deliver 40 Iron Gears and 60 Copper Wires to the Delivery Hub.',
          goals: { iron_gear: 40, copper_wire: 60 },
          rewardTech: 'Electronic Circuitry'
        },
        {
          id: 3,
          name: 'Silicon Synthesis',
          desc: 'Deliver 40 Electronic Circuits by combining Iron Plates and Copper Wires.',
          goals: { circuit: 40 },
          rewardTech: 'Automation Core Tech'
        },
        {
          id: 4,
          name: 'Autonomous Cores',
          desc: 'Deliver 30 Automation Cores assembled from Iron Gears and Circuits.',
          goals: { automation_core: 30 },
          rewardTech: 'Quantum Lattice Blueprint'
        },
        {
          id: 5,
          name: 'Apex Singularity',
          desc: 'Deliver 25 Quantum Processors to complete factory automation certification!',
          goals: { quantum_proc: 25 },
          rewardTech: 'Victory Master Badge'
        }
      ];

      // ==========================================
      // 3. GAME STATE & WORLD
      // ==========================================
      let nextEntityId = 1;
      let nextItemId = 1;

      class GameState {
        constructor(width = 40, height = 40, seed = 12345) {
          this.width = width;
          this.height = height;
          this.seed = seed;
          this.grid = [];
          this.structures = [];
          this.items = [];
          this.structureMap = new Map();
          this.powerGrids = [];
          
          this.tick = 0;
          this.paused = false;
          this.speedMultiplier = 1.0;
          this.gameMode = 'campaign';
          this.costMode = 'free';
          this.powerDifficulty = 'normal';
          this.beltSpeedSetting = 1.0;

          this.credits = 1000;
          this.currentContractIndex = 0;
          this.contractProgress = {};
          this.totalDelivered = {};
          this.deliveryHistory = [];
          this.productionCounters = {};
          this.consumptionCounters = {};

          this.overlays = {
            flow: true,
            power: true,
            heatmap: false,
            congestion: false,
            badges: true
          };

          this.undoStack = [];
          this.redoStack = [];

          this.initTerrain();
          this.initContract();
        }

        initTerrain() {
          this.grid = [];
          for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
              row.push({ resource: null, amount: 0 });
            }
            this.grid.push(row);
          }

          let s = this.seed;
          const rng = () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
          };

          const spawnCluster = (res, count, size) => {
            for (let c = 0; c < count; c++) {
              const cx = Math.floor(rng() * (this.width - 12)) + 6;
              const cy = Math.floor(rng() * (this.height - 12)) + 6;
              for (let i = 0; i < size; i++) {
                const ox = cx + Math.floor(rng() * 5) - 2;
                const oy = cy + Math.floor(rng() * 5) - 2;
                if (ox >= 0 && ox < this.width && oy >= 0 && oy < this.height) {
                  this.grid[oy][ox] = { resource: res, amount: 50000 };
                }
              }
            }
          };

          spawnCluster('iron_ore', 4, 18);
          spawnCluster('copper_ore', 4, 16);
          spawnCluster('coal', 3, 14);
          spawnCluster('stone', 2, 12);
        }

        initContract() {
          this.contractProgress = {};
          const contract = CAMPAIGN_CONTRACTS[this.currentContractIndex];
          if (contract) {
            for (let k in contract.goals) {
              this.contractProgress[k] = 0;
            }
          }
        }

        recordDelivery(itemType) {
          this.totalDelivered[itemType] = (this.totalDelivered[itemType] || 0) + 1;
          this.deliveryHistory.push(Date.now());
          if (this.deliveryHistory.length > 50) this.deliveryHistory.shift();

          const contract = CAMPAIGN_CONTRACTS[this.currentContractIndex];
          if (contract && contract.goals[itemType] !== undefined) {
            this.contractProgress[itemType] = (this.contractProgress[itemType] || 0) + 1;
            this.checkContractCompletion();
          }
        }

        checkContractCompletion() {
          const contract = CAMPAIGN_CONTRACTS[this.currentContractIndex];
          if (!contract) return;

          let done = true;
          for (let k in contract.goals) {
            if ((this.contractProgress[k] || 0) < contract.goals[k]) {
              done = false;
              break;
            }
          }

          if (done) {
            audio.playChime();
            showToast(`🎉 Contract Completed: ${contract.name}!`);
            this.currentContractIndex++;
            if (this.currentContractIndex < CAMPAIGN_CONTRACTS.length) {
              this.initContract();
            }
          }
        }

        canPlace(type, x, y, dir = 0) {
          const def = STRUCTURE_DEFS[type];
          if (!def) return false;
          if (x < 0 || y < 0 || x + def.w > this.width || y + def.h > this.height) return false;

          for (let dy = 0; dy < def.h; dy++) {
            for (let dx = 0; dx < def.w; dx++) {
              const key = `${x + dx},${y + dy}`;
              if (this.structureMap.has(key)) return false;
            }
          }

          if (type === 'miner') {
            let hasDeposit = false;
            for (let dy = 0; dy < def.h; dy++) {
              for (let dx = 0; dx < def.w; dx++) {
                if (this.grid[y + dy][x + dx].resource) {
                  hasDeposit = true;
                  break;
                }
              }
            }
            if (!hasDeposit) return false;
          }

          return true;
        }

        placeStructure(type, x, y, dir = 0, options = {}) {
          if (!this.canPlace(type, x, y, dir)) return null;

          const def = STRUCTURE_DEFS[type];
          const struct = {
            id: nextEntityId++,
            type: type,
            x: x,
            y: y,
            w: def.w,
            h: def.h,
            dir: dir,
            recipe: options.recipe || def.defaultRecipe || null,
            progress: 0,
            status: 'IDLE',
            inputBuffer: options.inputBuffer ? { ...options.inputBuffer } : {},
            outputBuffer: options.outputBuffer ? { ...options.outputBuffer } : {},
            fuel: options.fuel !== undefined ? options.fuel : (type === 'generator' ? 20 : 0),
            powerSupplied: 1.0,
            efficiency: 1.0,
            roundRobin: 0,
            speed: def.speed || 1.0,
            capacity: def.capacity || 20,
            filter: options.filter || null,
            swingProgress: 0,
            heldItem: null,
            createdAt: this.tick
          };

          for (let dy = 0; dy < def.h; dy++) {
            for (let dx = 0; dx < def.w; dx++) {
              this.structureMap.set(`${x + dx},${y + dy}`, struct);
            }
          }

          this.structures.push(struct);
          this.rebuildPowerGrids();
          return struct;
        }

        removeStructure(struct) {
          if (!struct) return;
          for (let dy = 0; dy < struct.h; dy++) {
            for (let dx = 0; dx < struct.w; dx++) {
              this.structureMap.delete(`${struct.x + dx},${struct.y + dy}`);
            }
          }

          this.items = this.items.filter(item => {
            return !(item.tileX >= struct.x && item.tileX < struct.x + struct.w &&
                     item.tileY >= struct.y && item.tileY < struct.y + struct.h);
          });

          const idx = this.structures.indexOf(struct);
          if (idx !== -1) this.structures.splice(idx, 1);

          this.rebuildPowerGrids();
        }

        getStructureAt(x, y) {
          return this.structureMap.get(`${x},${y}`) || null;
        }

        rebuildPowerGrids() {
          const poles = this.structures.filter(s => s.type === 'power_pole');
          const visited = new Set();
          this.powerGrids = [];

          poles.forEach(pole => {
            if (visited.has(pole.id)) return;
            const component = [];
            const queue = [pole];
            visited.add(pole.id);

            while (queue.length > 0) {
              const curr = queue.shift();
              component.push(curr);

              poles.forEach(other => {
                if (visited.has(other.id)) return;
                const dist = Math.hypot(curr.x - other.x, curr.y - other.y);
                if (dist <= STRUCTURE_DEFS.power_pole.wireReach) {
                  visited.add(other.id);
                  queue.push(other);
                }
              });
            }

            const grid = {
              poles: component,
              generators: [],
              consumers: [],
              totalSupply: 0,
              totalDemand: 0,
              satisfaction: 1.0
            };

            this.structures.forEach(s => {
              if (s.type === 'power_pole') return;
              const def = STRUCTURE_DEFS[s.type];
              const connected = component.some(p => {
                const cx = s.x + s.w / 2;
                const cy = s.y + s.h / 2;
                return Math.hypot(p.x + 0.5 - cx, p.y + 0.5 - cy) <= STRUCTURE_DEFS.power_pole.radius;
              });

              if (connected) {
                if (def.powerGen) grid.generators.push(s);
                if (def.power) grid.consumers.push(s);
              }
            });

            this.powerGrids.push(grid);
          });
        }
      }

      // ==========================================
      // 4. SIMULATION ENGINE
      // ==========================================
      class SimulationEngine {
        constructor(gameState) {
          this.state = gameState;
          this.fixedDelta = 0.05;
          this.accumulator = 0;
          this.lastFrameTime = performance.now();
          this.fps = 60;
          this.frameCount = 0;
          this.fpsTimer = performance.now();
        }

        update(timestamp) {
          const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.2);
          this.lastFrameTime = timestamp;

          this.frameCount++;
          if (timestamp - this.fpsTimer >= 500) {
            this.fps = Math.round((this.frameCount * 1000) / (timestamp - this.fpsTimer));
            this.frameCount = 0;
            this.fpsTimer = timestamp;
          }

          if (!this.state.paused) {
            this.accumulator += dt * this.state.speedMultiplier;
            while (this.accumulator >= this.fixedDelta) {
              this.tick();
              this.accumulator -= this.fixedDelta;
            }
          }
        }

        step() {
          this.tick();
        }

        tick() {
          this.state.tick++;
          this.updatePower();
          this.updateMachines();
          this.updateInserters();
          this.updateBelts();
        }

        updatePower() {
          if (this.state.powerDifficulty === 'unlimited') {
            this.state.structures.forEach(s => s.powerSupplied = 1.0);
            return;
          }

          this.state.structures.forEach(s => s.powerSupplied = 0.0);

          this.state.powerGrids.forEach(grid => {
            let supply = 0;
            let demand = 0;

            grid.generators.forEach(gen => {
              const def = STRUCTURE_DEFS[gen.type];
              if (gen.type === 'solar_panel') {
                supply += def.powerGen;
              } else if (gen.type === 'generator') {
                if (gen.fuel > 0) {
                  supply += def.powerGen;
                  gen.fuel -= 0.005;
                  if (gen.fuel < 0) gen.fuel = 0;
                }
              }
            });

            grid.consumers.forEach(consumer => {
              const def = STRUCTURE_DEFS[consumer.type];
              if (consumer.status !== 'IDLE' && consumer.status !== 'UNPOWERED') {
                demand += def.power || 0;
              } else {
                demand += (def.power || 0) * 0.1;
              }
            });

            grid.totalSupply = supply;
            grid.totalDemand = demand;

            let satisfaction = 1.0;
            if (demand > 0) {
              satisfaction = Math.min(1.0, supply / demand);
            } else if (supply > 0) {
              satisfaction = 1.0;
            } else {
              satisfaction = 0.0;
            }

            if (this.state.powerDifficulty === 'harsh' && satisfaction < 0.8) {
              satisfaction = 0.0;
            }

            grid.satisfaction = satisfaction;

            grid.generators.forEach(s => s.powerSupplied = 1.0);
            grid.consumers.forEach(s => s.powerSupplied = satisfaction);
          });
        }

        updateMachines() {
          const dt = this.fixedDelta;

          this.state.structures.forEach(struct => {
            const def = STRUCTURE_DEFS[struct.type];

            // 1. MINER
            if (struct.type === 'miner') {
              if (struct.powerSupplied <= 0) {
                struct.status = 'UNPOWERED';
                return;
              }

              let resType = null;
              for (let dy = 0; dy < struct.h; dy++) {
                for (let dx = 0; dx < struct.w; dx++) {
                  const tileRes = this.state.grid[struct.y + dy][struct.x + dx].resource;
                  if (tileRes) {
                    resType = tileRes;
                    break;
                  }
                }
                if (resType) break;
              }

              if (!resType) {
                struct.status = 'IDLE';
                return;
              }

              const outCount = struct.outputBuffer[resType] || 0;
              if (outCount >= 10) {
                struct.status = 'BLOCKED';
              } else {
                struct.status = 'ACTIVE';
                struct.progress += dt * struct.powerSupplied;
                if (struct.progress >= 1.5) {
                  struct.progress = 0;
                  struct.outputBuffer[resType] = outCount + 1;
                  this.state.productionCounters[resType] = (this.state.productionCounters[resType] || 0) + 1;
                }
              }

              this.ejectOutputsToBelts(struct);
            }

            // 2. SMELTER & ASSEMBLER
            else if (struct.type === 'smelter' || struct.type === 'assembler') {
              const recipe = RECIPES[struct.recipe];
              if (!recipe) {
                struct.status = 'IDLE';
                return;
              }

              if (struct.powerSupplied <= 0) {
                struct.status = 'UNPOWERED';
                return;
              }

              let outFull = false;
              for (let outItem in recipe.outputs) {
                if ((struct.outputBuffer[outItem] || 0) >= 10) {
                  outFull = true;
                  break;
                }
              }

              if (outFull) {
                struct.status = 'BLOCKED';
              } else {
                let hasInputs = true;
                for (let inItem in recipe.inputs) {
                  if ((struct.inputBuffer[inItem] || 0) < recipe.inputs[inItem]) {
                    hasInputs = false;
                    break;
                  }
                }

                if (!hasInputs) {
                  struct.status = 'STARVED';
                } else {
                  struct.status = 'ACTIVE';
                  struct.progress += dt * struct.powerSupplied;
                  if (struct.progress >= recipe.time) {
                    struct.progress = 0;
                    for (let inItem in recipe.inputs) {
                      struct.inputBuffer[inItem] -= recipe.inputs[inItem];
                      this.state.consumptionCounters[inItem] = (this.state.consumptionCounters[inItem] || 0) + recipe.inputs[inItem];
                    }
                    for (let outItem in recipe.outputs) {
                      struct.outputBuffer[outItem] = (struct.outputBuffer[outItem] || 0) + recipe.outputs[outItem];
                      this.state.productionCounters[outItem] = (this.state.productionCounters[outItem] || 0) + recipe.outputs[outItem];
                    }
                  }
                }
              }

              this.ejectOutputsToBelts(struct);
            }

            // 3. GENERATOR
            else if (struct.type === 'generator') {
              if (struct.inputBuffer['coal'] > 0 && struct.fuel < 20) {
                struct.inputBuffer['coal']--;
                struct.fuel += 10;
              }
              struct.status = struct.fuel > 0 ? 'ACTIVE' : 'STARVED';
            }

            // 4. STORAGE
            else if (struct.type === 'storage') {
              struct.status = 'ACTIVE';
              this.ejectOutputsToBelts(struct);
            }

            // 5. HUB
            else if (struct.type === 'hub') {
              struct.status = 'ACTIVE';
            }
          });
        }

        ejectOutputsToBelts(struct) {
          const outgoingBelts = [];
          const perimeter = this.getPerimeterTiles(struct);

          perimeter.forEach(p => {
            const neighbor = this.state.getStructureAt(p.x, p.y);
            if (neighbor && (neighbor.type === 'belt' || neighbor.type === 'belt_mk2' || neighbor.type === 'merger')) {
              const d = DIRS[neighbor.dir];
              const targetX = p.x + d.x;
              const targetY = p.y + d.y;
              // Belt must lead OUTSIDE this machine
              const leadsAway = !(targetX >= struct.x && targetX < struct.x + struct.w &&
                                  targetY >= struct.y && targetY < struct.y + struct.h);
              if (leadsAway) {
                outgoingBelts.push(neighbor);
              }
            }
          });

          if (outgoingBelts.length === 0) return;

          for (let itemType in struct.outputBuffer) {
            if (struct.outputBuffer[itemType] > 0) {
              for (let belt of outgoingBelts) {
                if (this.canAddItemToBelt(belt.x, belt.y, 0.0)) {
                  this.addItemToBelt(itemType, belt.x, belt.y, 0.0);
                  struct.outputBuffer[itemType]--;
                  return;
                }
              }
            }
          }
        }

        getPerimeterTiles(struct) {
          const tiles = [];
          for (let x = struct.x; x < struct.x + struct.w; x++) {
            tiles.push({ x: x, y: struct.y - 1 });
            tiles.push({ x: x, y: struct.y + struct.h });
          }
          for (let y = struct.y; y < struct.y + struct.h; y++) {
            tiles.push({ x: struct.x - 1, y: y });
            tiles.push({ x: struct.x + struct.w, y: y });
          }
          return tiles.filter(p => p.x >= 0 && p.x < this.state.width && p.y >= 0 && p.y < this.state.height);
        }

        canAddItemToBelt(tileX, tileY, atProgress = 0.0) {
          const itemsOnTile = this.state.items.filter(i => i.tileX === tileX && i.tileY === tileY);
          if (itemsOnTile.length >= 2) return false;
          return itemsOnTile.every(i => Math.abs(i.progress - atProgress) >= 0.4);
        }

        addItemToBelt(type, tileX, tileY, progress = 0.0) {
          const struct = this.state.getStructureAt(tileX, tileY);
          const baseSpeed = (struct && struct.type === 'belt_mk2') ? 4.0 : 2.0;
          this.state.items.push({
            id: nextItemId++,
            type: type,
            tileX: tileX,
            tileY: tileY,
            progress: progress,
            speed: baseSpeed * this.state.beltSpeedSetting,
            blocked: false
          });
        }

        updateInserters() {
          const dt = this.fixedDelta;
          this.state.structures.filter(s => s.type === 'inserter').forEach(ins => {
            if (ins.powerSupplied <= 0) {
              ins.status = 'UNPOWERED';
              return;
            }

            const backDir = DIRS[(ins.dir + 2) % 4];
            const frontDir = DIRS[ins.dir];
            const pickupX = ins.x + backDir.x;
            const pickupY = ins.y + backDir.y;
            const dropX = ins.x + frontDir.x;
            const dropY = ins.y + frontDir.y;

            ins.status = 'ACTIVE';

            if (!ins.heldItem) {
              const pickupStruct = this.state.getStructureAt(pickupX, pickupY);
              const itemsBehind = this.state.items.filter(i => i.tileX === pickupX && i.tileY === pickupY && i.progress >= 0.3);

              if (itemsBehind.length > 0) {
                const item = itemsBehind[0];
                if (!ins.filter || ins.filter === item.type) {
                  ins.heldItem = item.type;
                  const idx = this.state.items.indexOf(item);
                  if (idx !== -1) this.state.items.splice(idx, 1);
                  ins.swingProgress = 0;
                }
              } else if (pickupStruct && pickupStruct.outputBuffer) {
                for (let k in pickupStruct.outputBuffer) {
                  if (pickupStruct.outputBuffer[k] > 0 && (!ins.filter || ins.filter === k)) {
                    ins.heldItem = k;
                    pickupStruct.outputBuffer[k]--;
                    ins.swingProgress = 0;
                    break;
                  }
                }
              }
            } else {
              ins.swingProgress = (ins.swingProgress || 0) + dt * 2.0;
              if (ins.swingProgress >= 1.0) {
                const dropStruct = this.state.getStructureAt(dropX, dropY);
                if (dropStruct) {
                  if (dropStruct.type === 'hub') {
                    this.state.recordDelivery(ins.heldItem);
                    audio.playPop();
                    ins.heldItem = null;
                    ins.swingProgress = 0;
                  } else if (dropStruct.type === 'belt' || dropStruct.type === 'belt_mk2') {
                    if (this.canAddItemToBelt(dropX, dropY, 0.0)) {
                      this.addItemToBelt(ins.heldItem, dropX, dropY, 0.0);
                      ins.heldItem = null;
                      ins.swingProgress = 0;
                    }
                  } else if (dropStruct.inputBuffer) {
                    dropStruct.inputBuffer[ins.heldItem] = (dropStruct.inputBuffer[ins.heldItem] || 0) + 1;
                    ins.heldItem = null;
                    ins.swingProgress = 0;
                  }
                }
              }
            }
          });
        }

        updateBelts() {
          const dt = this.fixedDelta;
          const itemsToRemove = [];

          this.state.items.sort((a, b) => b.progress - a.progress);

          for (let i = 0; i < this.state.items.length; i++) {
            const item = this.state.items[i];
            const struct = this.state.getStructureAt(item.tileX, item.tileY);

            if (!struct) {
              itemsToRemove.push(item);
              continue;
            }

            const moveStep = item.speed * dt;
            const nextProgress = item.progress + moveStep;

            const aheadItem = this.state.items.find(other => 
              other !== item && other.tileX === item.tileX && other.tileY === item.tileY &&
              other.progress > item.progress && (other.progress - item.progress) < 0.45
            );

            if (aheadItem) {
              item.blocked = true;
              item.progress = Math.max(item.progress, aheadItem.progress - 0.45);
              continue;
            }

            if (nextProgress < 1.0) {
              item.progress = nextProgress;
              item.blocked = false;
              continue;
            }

            // Determine target tile
            let targetX = item.tileX;
            let targetY = item.tileY;

            if (struct.type === 'splitter') {
              const leftDir = DIRS[(struct.dir + 3) % 4];
              const rightDir = DIRS[(struct.dir + 1) % 4];
              let pick;
              if (struct.filter) {
                pick = (item.type === struct.filter) ? leftDir : rightDir;
              } else {
                struct.roundRobin = (struct.roundRobin || 0) + 1;
                pick = struct.roundRobin % 2 === 0 ? rightDir : leftDir;
              }
              
              // Check if primary pick can accept, otherwise check alt pick
              const altPick = (pick === leftDir) ? rightDir : leftDir;
              const primaryTarget = { x: item.tileX + pick.x, y: item.tileY + pick.y };
              const altTarget = { x: item.tileX + altPick.x, y: item.tileY + altPick.y };

              if (this.canAddItemToBelt(primaryTarget.x, primaryTarget.y, 0.0)) {
                targetX = primaryTarget.x;
                targetY = primaryTarget.y;
              } else if (!struct.filter && this.canAddItemToBelt(altTarget.x, altTarget.y, 0.0)) {
                targetX = altTarget.x;
                targetY = altTarget.y;
              } else {
                targetX = primaryTarget.x;
                targetY = primaryTarget.y;
              }
            } else {
              const d = DIRS[struct.dir];
              targetX += d.x;
              targetY += d.y;
            }

            const nextStruct = this.state.getStructureAt(targetX, targetY);

            if (!nextStruct) {
              item.progress = 0.95;
              item.blocked = true;
              continue;
            }

            // 1. Delivery Hub
            if (nextStruct.type === 'hub') {
              this.state.recordDelivery(item.type);
              audio.playPop();
              itemsToRemove.push(item);
            }

            // 2. Another Belt / Splitter / Merger
            else if (nextStruct.type === 'belt' || nextStruct.type === 'belt_mk2' || nextStruct.type === 'splitter' || nextStruct.type === 'merger') {
              if (this.canAddItemToBelt(targetX, targetY, 0.0)) {
                item.tileX = targetX;
                item.tileY = targetY;
                item.progress = 0.0;
                item.speed = (nextStruct.type === 'belt_mk2' ? 4.0 : 2.0) * this.state.beltSpeedSetting;
                item.blocked = false;
              } else {
                item.progress = 0.95;
                item.blocked = true;
              }
            }

            // 3. Machine Input (Smelter, Assembler, Generator, Storage)
            else if (nextStruct.type === 'smelter' || nextStruct.type === 'assembler' || nextStruct.type === 'generator' || nextStruct.type === 'storage') {
              let acceptsItem = false;
              if (nextStruct.type === 'generator') {
                acceptsItem = (item.type === 'coal');
              } else if (nextStruct.type === 'storage') {
                acceptsItem = true;
              } else if (nextStruct.recipe) {
                const r = RECIPES[nextStruct.recipe];
                acceptsItem = r && (r.inputs[item.type] !== undefined);
              }

              const currCount = nextStruct.inputBuffer[item.type] || 0;
              if (acceptsItem && currCount < 15) {
                nextStruct.inputBuffer[item.type] = currCount + 1;
                itemsToRemove.push(item);
              } else {
                item.progress = 0.95;
                item.blocked = true;
              }
            }

            // 4. Underground Tunnel
            else if (nextStruct.type === 'tunnel') {
              const d = DIRS[nextStruct.dir];
              let foundExit = null;
              for (let step = 1; step <= 4; step++) {
                const ex = targetX + d.x * step;
                const ey = targetY + d.y * step;
                const cand = this.state.getStructureAt(ex, ey);
                if (cand && cand.type === 'tunnel' && cand.dir === nextStruct.dir) {
                  foundExit = cand;
                  break;
                }
              }

              if (foundExit && this.canAddItemToBelt(foundExit.x, foundExit.y, 0.0)) {
                item.tileX = foundExit.x;
                item.tileY = foundExit.y;
                item.progress = 0.0;
                item.blocked = false;
              } else {
                item.progress = 0.95;
                item.blocked = true;
              }
            }

            else {
              item.progress = 0.95;
              item.blocked = true;
            }
          }

          if (itemsToRemove.length > 0) {
            this.state.items = this.state.items.filter(i => !itemsToRemove.includes(i));
          }
        }
      }
