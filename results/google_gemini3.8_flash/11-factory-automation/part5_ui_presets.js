
      // ==========================================
      // 6. PRESETS & FACTORY BLUEPRINTS
      // ==========================================

      function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => toast.classList.remove('show'), 3200);
      }

      const PRESETS = {
        starter_line: {
          id: 'starter_line',
          name: 'Starter Extraction Line',
          tag: 'Beginner',
          tagColor: 'var(--accent-cyan)',
          desc: 'Basic iron extraction, smelting, and conveyor delivery chain. Generates immediate progress on Contract Tier 1.',
          build: function(state) {
            state.width = 40; state.height = 40;
            state.initTerrain();

            // Set iron ore deposit under miner
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                state.grid[10 + dy][10 + dx] = { resource: 'iron_ore', amount: 50000 };
              }
            }

            // 1. Miner at (10, 10) East
            state.placeStructure('miner', 10, 10, 1);

            // 2. Belts leading to Smelter
            state.placeStructure('belt', 12, 10, 1);
            state.placeStructure('belt', 13, 10, 1);

            // 3. Smelter at (14, 10) East
            state.placeStructure('smelter', 14, 10, 1, { recipe: 'smelt_iron' });

            // 4. Belts leading to Hub
            state.placeStructure('belt', 16, 10, 1);
            state.placeStructure('belt', 17, 10, 1);

            // 5. Hub at (18, 10) East
            state.placeStructure('hub', 18, 10, 1);

            // 6. Clean Solar Power
            state.placeStructure('solar_panel', 14, 13, 0);
            state.placeStructure('power_pole', 13, 12, 0);

            return { camX: 15, camY: 11, zoom: 1.3 };
          }
        },

        balanced_factory: {
          id: 'balanced_factory',
          name: 'Balanced Dual-Line Factory',
          tag: 'Multi-Stage',
          tagColor: 'var(--accent-green)',
          desc: 'Parallel iron plate and copper wire production lines feeding into an electronic circuit assembly matrix.',
          build: function(state) {
            state.width = 40; state.height = 40;
            state.initTerrain();

            // Iron deposit
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                state.grid[6 + dy][6 + dx] = { resource: 'iron_ore', amount: 50000 };
              }
            }
            // Copper deposit
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                state.grid[14 + dy][6 + dx] = { resource: 'copper_ore', amount: 50000 };
              }
            }

            // --- Iron Line ---
            state.placeStructure('miner', 6, 6, 1);
            state.placeStructure('belt', 8, 6, 1);
            state.placeStructure('belt', 9, 6, 1);
            state.placeStructure('smelter', 10, 6, 1, { recipe: 'smelt_iron' });
            state.placeStructure('belt', 12, 6, 1);
            state.placeStructure('belt', 13, 6, 1);
            state.placeStructure('assembler', 14, 6, 1, { recipe: 'craft_plate' });

            // Iron Plates Route to Circuit Assembler
            state.placeStructure('belt', 16, 6, 1);
            state.placeStructure('belt', 17, 6, 2); // South
            state.placeStructure('belt', 17, 7, 2);
            state.placeStructure('belt', 17, 8, 2);
            state.placeStructure('belt', 17, 9, 1); // East
            state.placeStructure('belt', 18, 9, 1);

            // --- Copper Line ---
            state.placeStructure('miner', 6, 14, 1);
            state.placeStructure('belt', 8, 14, 1);
            state.placeStructure('belt', 9, 14, 1);
            state.placeStructure('smelter', 10, 14, 1, { recipe: 'smelt_copper' });
            state.placeStructure('belt', 12, 14, 1);
            state.placeStructure('belt', 13, 14, 1);
            state.placeStructure('assembler', 14, 14, 1, { recipe: 'craft_wire' });

            // Copper Wires Route to Circuit Assembler
            state.placeStructure('belt', 16, 14, 1);
            state.placeStructure('belt', 17, 14, 0); // North
            state.placeStructure('belt', 17, 13, 0);
            state.placeStructure('belt', 17, 12, 0);
            state.placeStructure('belt', 17, 11, 0);
            state.placeStructure('belt', 17, 10, 1); // East
            state.placeStructure('belt', 18, 10, 1);

            // --- Circuit Assembler ---
            state.placeStructure('assembler', 19, 9, 1, { recipe: 'craft_circuit' });
            state.placeStructure('belt', 21, 9, 1);
            state.placeStructure('belt', 22, 9, 1);
            state.placeStructure('hub', 23, 9, 1);

            // --- Power Network ---
            state.placeStructure('solar_panel', 10, 10, 0);
            state.placeStructure('solar_panel', 13, 10, 0);
            state.placeStructure('power_pole', 9, 8, 0);
            state.placeStructure('power_pole', 13, 8, 0);
            state.placeStructure('power_pole', 9, 12, 0);
            state.placeStructure('power_pole', 13, 12, 0);
            state.placeStructure('power_pole', 18, 11, 0);
            state.placeStructure('power_pole', 22, 11, 0);

            return { camX: 16, camY: 10, zoom: 1.1 };
          }
        },

        congested_belts: {
          id: 'congested_belts',
          name: 'Congested Belts & Bottleneck',
          tag: 'Bottleneck',
          tagColor: 'var(--accent-amber)',
          desc: 'High-volume production merging into a restricted output buffer, demonstrating backpressure, queueing, and bottleneck diagnostics.',
          build: function(state) {
            state.width = 40; state.height = 40;
            state.initTerrain();

            // 2 Iron deposits
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                state.grid[8 + dy][6 + dx] = { resource: 'iron_ore', amount: 50000 };
                state.grid[12 + dy][6 + dx] = { resource: 'iron_ore', amount: 50000 };
              }
            }

            state.placeStructure('miner', 6, 8, 1);
            state.placeStructure('miner', 6, 12, 1);

            state.placeStructure('belt', 8, 8, 1);
            state.placeStructure('belt', 9, 8, 2);
            state.placeStructure('belt', 9, 9, 2);

            state.placeStructure('belt', 8, 12, 1);
            state.placeStructure('belt', 9, 12, 0);
            state.placeStructure('belt', 9, 11, 0);

            // Merger combining both lines
            state.placeStructure('merger', 9, 10, 1);

            // Single line into Smelter
            state.placeStructure('belt', 10, 10, 1);
            state.placeStructure('belt', 11, 10, 1);
            state.placeStructure('belt', 12, 10, 1);
            state.placeStructure('belt', 13, 10, 1);
            state.placeStructure('belt', 14, 10, 1);
            state.placeStructure('belt', 15, 10, 1);

            const smelter = state.placeStructure('smelter', 16, 10, 1, {
              recipe: 'smelt_iron',
              outputBuffer: { iron_ingot: 20 },
              inputBuffer: { iron_ore: 15 }
            });
            smelter.status = 'BLOCKED';

            // Blocked output line
            state.placeStructure('belt', 18, 10, 1);
            state.placeStructure('belt', 19, 10, 1);
            state.placeStructure('storage', 20, 10, 1, {
              inputBuffer: { iron_ingot: 100 }
            });

            // Pre-seed items on belt to show immediate congestion
            for (let x = 10; x <= 15; x++) {
              state.items.push({
                id: nextItemId++,
                type: 'iron_ore',
                tileX: x,
                tileY: 10,
                progress: 0.85,
                speed: 2.0,
                blocked: true
              });
            }

            // Power
            state.placeStructure('solar_panel', 10, 13, 0);
            state.placeStructure('power_pole', 10, 11, 0);
            state.placeStructure('power_pole', 16, 12, 0);

            // Enable congestion overlay
            state.overlays.congestion = true;

            return { camX: 14, camY: 11, zoom: 1.25 };
          }
        },

        power_crisis: {
          id: 'power_crisis',
          name: 'Power Grid Under-Capacity',
          tag: 'Crisis',
          tagColor: 'var(--accent-red)',
          desc: 'Extensive industrial complex with heavy machinery exceeding electrical supply, causing brownouts, machine stutter, and warning alerts.',
          build: function(state) {
            state.width = 40; state.height = 40;
            state.initTerrain();

            // Deposits
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                state.grid[6 + dy][8 + dx] = { resource: 'iron_ore', amount: 50000 };
                state.grid[10 + dy][8 + dx] = { resource: 'iron_ore', amount: 50000 };
                state.grid[14 + dy][8 + dx] = { resource: 'copper_ore', amount: 50000 };
                state.grid[18 + dy][8 + dx] = { resource: 'copper_ore', amount: 50000 };
              }
            }

            // 4 Miners
            state.placeStructure('miner', 8, 6, 1);
            state.placeStructure('miner', 8, 10, 1);
            state.placeStructure('miner', 8, 14, 1);
            state.placeStructure('miner', 8, 18, 1);

            // 4 Smelters
            state.placeStructure('smelter', 13, 6, 1, { recipe: 'smelt_iron' });
            state.placeStructure('smelter', 13, 10, 1, { recipe: 'smelt_iron' });
            state.placeStructure('smelter', 13, 14, 1, { recipe: 'smelt_copper' });
            state.placeStructure('smelter', 13, 18, 1, { recipe: 'smelt_copper' });

            // 2 Assemblers
            state.placeStructure('assembler', 18, 8, 1, { recipe: 'craft_gear' });
            state.placeStructure('assembler', 18, 16, 1, { recipe: 'craft_wire' });

            // Belts connecting lines
            for (let y of [6, 10, 14, 18]) {
              state.placeStructure('belt', 10, y, 1);
              state.placeStructure('belt', 11, y, 1);
              state.placeStructure('belt', 12, y, 1);
              state.placeStructure('belt', 15, y, 1);
              state.placeStructure('belt', 16, y, 1);
            }

            // Power Network: ONLY 1 Solar Panel (100 kW) for ~480 kW demand!
            state.placeStructure('solar_panel', 6, 12, 0);
            state.placeStructure('power_pole', 7, 11, 0);
            state.placeStructure('power_pole', 11, 11, 0);
            state.placeStructure('power_pole', 15, 11, 0);
            state.placeStructure('power_pole', 18, 11, 0);

            // Hub
            state.placeStructure('hub', 22, 12, 1);

            return { camX: 15, camY: 13, zoom: 1.1 };
          }
        },

        multi_product: {
          id: 'multi_product',
          name: 'Main Bus Logistics System',
          tag: 'Advanced',
          tagColor: 'var(--accent-purple)',
          desc: 'High-capacity 3-lane conveyor trunk line carrying iron, copper, and stone with splitters tapping into sub-factories.',
          build: function(state) {
            state.width = 40; state.height = 40;
            state.initTerrain();

            // 3 Deposits
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                state.grid[10 + dy][4 + dx] = { resource: 'iron_ore', amount: 50000 };
                state.grid[14 + dy][4 + dx] = { resource: 'copper_ore', amount: 50000 };
                state.grid[18 + dy][4 + dx] = { resource: 'stone', amount: 50000 };
              }
            }

            state.placeStructure('miner', 4, 10, 1);
            state.placeStructure('miner', 4, 14, 1);
            state.placeStructure('miner', 4, 18, 1);

            state.placeStructure('smelter', 8, 10, 1, { recipe: 'smelt_iron' });
            state.placeStructure('smelter', 8, 14, 1, { recipe: 'smelt_copper' });
            state.placeStructure('smelter', 8, 18, 1, { recipe: 'smelt_brick' });

            // Connect miners to smelters
            for (let y of [10, 14, 18]) {
              state.placeStructure('belt', 6, y, 1);
              state.placeStructure('belt', 7, y, 1);
            }

            // Route from smelters into Main Bus at Y=13, Y=14, Y=15
            state.placeStructure('belt', 10, 10, 1);
            state.placeStructure('belt', 11, 10, 2);
            state.placeStructure('belt', 11, 11, 2);
            state.placeStructure('belt', 11, 12, 2);
            state.placeStructure('belt', 11, 13, 1); // Feeds Iron Bus

            state.placeStructure('belt', 10, 14, 1);
            state.placeStructure('belt', 11, 14, 1); // Feeds Copper Bus

            state.placeStructure('belt', 10, 18, 1);
            state.placeStructure('belt', 11, 18, 0);
            state.placeStructure('belt', 11, 17, 0);
            state.placeStructure('belt', 11, 16, 0);
            state.placeStructure('belt', 11, 15, 1); // Feeds Stone Bus

            // The Main Bus lines from X=12 to X=25
            for (let x = 12; x <= 25; x++) {
              if (x === 16) {
                // Splitter on Iron Bus
                state.placeStructure('splitter', x, 13, 1);
              } else {
                state.placeStructure('belt_mk2', x, 13, 1);
              }

              if (x === 19) {
                // Splitter on Copper Bus
                state.placeStructure('splitter', x, 14, 1);
              } else {
                state.placeStructure('belt_mk2', x, 14, 1);
              }

              state.placeStructure('belt_mk2', x, 15, 1);
            }

            // Branch Factory 1: Gear Assembler from Splitter at (16, 13)
            state.placeStructure('belt', 16, 12, 0);
            state.placeStructure('belt', 16, 11, 0);
            state.placeStructure('belt', 16, 10, 1);
            state.placeStructure('assembler', 17, 9, 1, { recipe: 'craft_gear' });

            // Branch Factory 2: Wire Assembler from Splitter at (19, 14)
            state.placeStructure('belt', 19, 16, 2);
            state.placeStructure('belt', 19, 17, 2);
            state.placeStructure('belt', 19, 18, 1);
            state.placeStructure('assembler', 20, 17, 1, { recipe: 'craft_wire' });

            // Storage Buffer
            state.placeStructure('storage', 26, 13, 1);

            // Delivery Hub at (26, 14)
            state.placeStructure('hub', 26, 14, 1);

            // Power Grid
            state.placeStructure('solar_panel', 14, 8, 0);
            state.placeStructure('solar_panel', 14, 18, 0);
            state.placeStructure('power_pole', 6, 14, 0);
            state.placeStructure('power_pole', 10, 14, 0);
            state.placeStructure('power_pole', 15, 14, 0);
            state.placeStructure('power_pole', 20, 14, 0);
            state.placeStructure('power_pole', 25, 14, 0);

            return { camX: 18, camY: 14, zoom: 1.05 };
          }
        },

        stress_test: {
          id: 'stress_test',
          name: 'High-Throughput Stress Test',
          tag: 'Benchmark',
          tagColor: 'var(--accent-amber)',
          desc: 'Dense factory matrix with 200+ active items, high-speed belts, splitters, mergers, and assemblers at locked 60 FPS.',
          build: function(state) {
            state.width = 40; state.height = 40;
            state.initTerrain();

            // Set natural deposits
            for (let dy = 0; dy < 4; dy++) {
              for (let dx = 0; dx < 4; dx++) {
                state.grid[6 + dy][4 + dx] = { resource: 'iron_ore', amount: 99999 };
                state.grid[14 + dy][4 + dx] = { resource: 'copper_ore', amount: 99999 };
                state.grid[22 + dy][4 + dx] = { resource: 'coal', amount: 99999 };
              }
            }

            // Power Matrix: 4 Solar Arrays + 2 Generators
            state.placeStructure('solar_panel', 4, 28, 0);
            state.placeStructure('solar_panel', 7, 28, 0);
            state.placeStructure('solar_panel', 10, 28, 0);
            state.placeStructure('solar_panel', 13, 28, 0);
            state.placeStructure('generator', 16, 28, 0, { fuel: 50 });
            state.placeStructure('generator', 19, 28, 0, { fuel: 50 });

            for (let px = 5; px <= 25; px += 5) {
              for (let py = 5; py <= 30; py += 6) {
                state.placeStructure('power_pole', px, py, 0);
              }
            }

            // Miners
            state.placeStructure('miner', 4, 6, 1);
            state.placeStructure('miner', 4, 8, 1);
            state.placeStructure('miner', 4, 14, 1);
            state.placeStructure('miner', 4, 16, 1);
            state.placeStructure('miner', 4, 22, 1);

            // Dual Smelting Banks
            for (let i = 0; i < 3; i++) {
              state.placeStructure('smelter', 10, 6 + i * 3, 1, { recipe: 'smelt_iron' });
              state.placeStructure('smelter', 10, 15 + i * 3, 1, { recipe: 'smelt_copper' });
            }

            // Assemblers
            for (let i = 0; i < 3; i++) {
              state.placeStructure('assembler', 16, 6 + i * 3, 1, { recipe: 'craft_plate' });
              state.placeStructure('assembler', 16, 15 + i * 3, 1, { recipe: 'craft_wire' });
              state.placeStructure('assembler', 22, 10 + i * 3, 1, { recipe: 'craft_circuit' });
            }

            // Interconnecting Mk2 Belts, Splitters, and Mergers
            for (let x = 6; x <= 9; x++) {
              state.placeStructure('belt_mk2', x, 6, 1);
              state.placeStructure('belt_mk2', x, 8, 1);
              state.placeStructure('belt_mk2', x, 14, 1);
              state.placeStructure('belt_mk2', x, 16, 1);
            }

            for (let x = 12; x <= 15; x++) {
              state.placeStructure('belt_mk2', x, 6, 1);
              state.placeStructure('belt_mk2', x, 9, 1);
              state.placeStructure('belt_mk2', x, 15, 1);
              state.placeStructure('belt_mk2', x, 18, 1);
            }

            for (let x = 18; x <= 21; x++) {
              state.placeStructure('belt_mk2', x, 10, 1);
              state.placeStructure('belt_mk2', x, 13, 1);
            }

            // Hubs
            state.placeStructure('hub', 26, 10, 1);
            state.placeStructure('hub', 26, 13, 1);

            state.placeStructure('belt_mk2', 24, 10, 1);
            state.placeStructure('belt_mk2', 25, 10, 1);
            state.placeStructure('belt_mk2', 24, 13, 1);
            state.placeStructure('belt_mk2', 25, 13, 1);

            return { camX: 16, camY: 18, zoom: 0.9 };
          }
        }
      };

      // ==========================================
      // 7. SAVE / LOAD & SERIALIZATION
      // ==========================================

      function serializeState(state) {
        return JSON.stringify({
          version: 1,
          timestamp: Date.now(),
          tick: state.tick,
          width: state.width,
          height: state.height,
          seed: state.seed,
          gameMode: state.gameMode,
          costMode: state.costMode,
          powerDifficulty: state.powerDifficulty,
          beltSpeedSetting: state.beltSpeedSetting,
          credits: state.credits,
          currentContractIndex: state.currentContractIndex,
          contractProgress: state.contractProgress,
          totalDelivered: state.totalDelivered,
          overlays: state.overlays,
          gridResources: state.grid.map(row => row.map(c => c.resource ? { r: c.resource, a: c.amount } : null)),
          structures: state.structures.map(s => ({
            id: s.id,
            type: s.type,
            x: s.x,
            y: s.y,
            dir: s.dir,
            recipe: s.recipe,
            progress: s.progress,
            status: s.status,
            inputBuffer: s.inputBuffer,
            outputBuffer: s.outputBuffer,
            fuel: s.fuel,
            filter: s.filter
          })),
          items: state.items.map(i => ({
            type: i.type,
            tileX: i.tileX,
            tileY: i.tileY,
            progress: i.progress,
            speed: i.speed,
            blocked: i.blocked
          }))
        }, null, 2);
      }

      function deserializeState(state, jsonString) {
        try {
          const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
          if (!data || !data.structures) throw new Error('Invalid save format');

          state.width = data.width || 40;
          state.height = data.height || 40;
          state.seed = data.seed || 12345;
          state.tick = data.tick || 0;
          state.gameMode = data.gameMode || 'campaign';
          state.costMode = data.costMode || 'free';
          state.powerDifficulty = data.powerDifficulty || 'normal';
          state.beltSpeedSetting = data.beltSpeedSetting || 1.0;
          state.credits = data.credits !== undefined ? data.credits : 1000;
          state.currentContractIndex = data.currentContractIndex || 0;
          state.contractProgress = data.contractProgress || {};
          state.totalDelivered = data.totalDelivered || {};
          if (data.overlays) state.overlays = Object.assign(state.overlays, data.overlays);

          state.grid = [];
          for (let y = 0; y < state.height; y++) {
            const row = [];
            for (let x = 0; x < state.width; x++) {
              row.push({ resource: null, amount: 0 });
            }
            state.grid.push(row);
          }

          if (data.gridResources) {
            for (let y = 0; y < Math.min(state.height, data.gridResources.length); y++) {
              for (let x = 0; x < Math.min(state.width, data.gridResources[y].length); x++) {
                const cell = data.gridResources[y][x];
                if (cell) {
                  state.grid[y][x] = { resource: cell.r, amount: cell.a };
                }
              }
            }
          } else {
            state.initTerrain();
          }

          state.structures = [];
          state.structureMap.clear();
          state.items = [];

          data.structures.forEach(s => {
            const def = STRUCTURE_DEFS[s.type];
            if (!def) return;
            const struct = {
              id: s.id || nextEntityId++,
              type: s.type,
              x: s.x,
              y: s.y,
              w: def.w,
              h: def.h,
              dir: s.dir || 0,
              recipe: s.recipe || def.defaultRecipe || null,
              progress: s.progress || 0,
              status: s.status || 'IDLE',
              inputBuffer: s.inputBuffer ? { ...s.inputBuffer } : {},
              outputBuffer: s.outputBuffer ? { ...s.outputBuffer } : {},
              fuel: s.fuel !== undefined ? s.fuel : 0,
              powerSupplied: 1.0,
              efficiency: 1.0,
              roundRobin: 0,
              speed: def.speed || 1.0,
              capacity: def.capacity || 20,
              filter: s.filter || null,
              swingProgress: 0,
              heldItem: null,
              createdAt: state.tick
            };

            for (let dy = 0; dy < def.h; dy++) {
              for (let dx = 0; dx < def.w; dx++) {
                state.structureMap.set(`${s.x + dx},${s.y + dy}`, struct);
              }
            }
            state.structures.push(struct);
          });

          if (data.items) {
            data.items.forEach(i => {
              state.items.push({
                id: nextItemId++,
                type: i.type,
                tileX: i.tileX,
                tileY: i.tileY,
                progress: i.progress || 0,
                speed: i.speed || 2.0,
                blocked: !!i.blocked
              });
            });
          }

          state.rebuildPowerGrids();
          state.undoStack = [];
          state.redoStack = [];
          return true;
        } catch (err) {
          console.error('Failed to load state', err);
          showToast('❌ Failed to load save file');
          return false;
        }
      }

      // ==========================================
      // 8. CONTROLLER & UI WIRING
      // ==========================================

      const canvas = document.getElementById('factory-canvas');
      const state = new GameState(40, 40, 12345);
      const sim = new SimulationEngine(state);
      const renderer = new FactoryRenderer(canvas, state);

      let activePresetKey = 'starter_line';

      function loadPreset(key) {
        const preset = PRESETS[key];
        if (!preset) return;
        activePresetKey = key;
        state.structures = [];
        state.structureMap.clear();
        state.items = [];
        state.undoStack = [];
        state.redoStack = [];
        state.currentContractIndex = 0;
        state.initContract();

        const view = preset.build(state);
        state.rebuildPowerGrids();

        if (view) {
          renderer.camX = view.camX;
          renderer.camY = view.camY;
          renderer.zoom = view.zoom;
        }

        renderer.selectedStructure = null;
        hideInspector();
        showToast(`Loaded Preset: ${preset.name}`);
        updatePresetsUI();
      }


      // --- Toolbar Setup ---
      const TOOLBAR_CONFIG = {
        logistics: [
          { id: 'belt', name: 'Belt Mk1', icon: '➡️', cost: '2⚡', key: 'B' },
          { id: 'belt_mk2', name: 'Belt Mk2', icon: '⏩', cost: '5⚡' },
          { id: 'splitter', name: 'Splitter', icon: '🔀', cost: '10⚡' },
          { id: 'merger', name: 'Merger', icon: '🔁', cost: '10⚡' },
          { id: 'inserter', name: 'Inserter', icon: '🦾', cost: '8⚡' },
          { id: 'tunnel', name: 'Tunnel', icon: '🚇', cost: '15⚡' },
          { id: 'storage', name: 'Storage', icon: '📦', cost: '15⚡' }
        ],
        processing: [
          { id: 'miner', name: 'Mining Drill', icon: '⛏️', cost: '30⚡', key: 'M' },
          { id: 'smelter', name: 'Smelter', icon: '🔥', cost: '40⚡', key: 'S' },
          { id: 'assembler', name: 'Assembler', icon: '⚙️', cost: '60⚡', key: 'A' },
          { id: 'hub', name: 'Delivery Hub', icon: '🚀', cost: '100⚡', key: 'H' }
        ],
        power: [
          { id: 'power_pole', name: 'Substation', icon: '🗼', cost: '10⚡', key: 'P' },
          { id: 'solar_panel', name: 'Solar Array', icon: '☀️', cost: '50⚡' },
          { id: 'generator', name: 'Steam Gen', icon: '🏭', cost: '75⚡', key: 'G' }
        ],
        tools: [
          { id: 'select', name: 'Select / Move', icon: '👆', key: 'Q' },
          { id: 'delete', name: 'Bulldoze', icon: '🗑️', key: 'X' }
        ]
      };

      let activeCategory = 'logistics';

      function renderToolbar() {
        const container = document.getElementById('tools-container');
        if (!container) return;
        container.innerHTML = '';

        const tools = TOOLBAR_CONFIG[activeCategory] || [];
        tools.forEach(tool => {
          const btn = document.createElement('button');
          btn.className = `tool-btn ${renderer.activeTool === tool.id ? 'active' : ''}`;
          btn.innerHTML = `
            <span class="tool-icon">${tool.icon}</span>
            <span class="tool-name">${tool.name}</span>
            ${tool.cost ? `<span class="tool-cost">${tool.cost}</span>` : ''}
            ${tool.key ? `<span class="tool-badge">${tool.key}</span>` : ''}
          `;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            audio.init();
            audio.playPop();
            renderer.activeTool = tool.id;
            renderer.selectedStructure = null;
            hideInspector();
            renderToolbar();
          });
          container.appendChild(btn);
        });
      }

      document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          audio.init();
          document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeCategory = btn.getAttribute('data-cat');
          renderToolbar();
        });
      });

      renderToolbar();

      // --- Canvas Pointer / Drag Interactions ---
      let isPanning = false;
      let panStartX = 0;
      let panStartY = 0;
      let camStartX = 0;
      let camStartY = 0;
      let isDraggingAction = false;

      canvas.addEventListener('pointerdown', (e) => {
        audio.init();
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;
        const tile = renderer.screenToWorld(clientX, clientY);

        // Pan with Right (2) or Middle (1) mouse button, or in select mode if no structure
        if (e.button === 2 || e.button === 1 || (e.button === 0 && renderer.activeTool === 'select' && !state.getStructureAt(tile.x, tile.y))) {
          isPanning = true;
          panStartX = clientX;
          panStartY = clientY;
          camStartX = renderer.camX;
          camStartY = renderer.camY;
          if (e.button === 0 && renderer.activeTool === 'select') {
            renderer.selectedStructure = null;
            hideInspector();
          }
          return;
        }

        if (e.button === 0) {
          if (renderer.activeTool === 'select') {
            const struct = state.getStructureAt(tile.x, tile.y);
            if (struct) {
              renderer.selectedStructure = struct;
              audio.playPop();
              showInspector(struct);
            } else {
              renderer.selectedStructure = null;
              hideInspector();
            }
          } else {
            isDraggingAction = true;
            renderer.dragStart = tile;
            renderer.dragEnd = tile;
          }
        }
      });

      window.addEventListener('pointermove', (e) => {
        const clientX = e.clientX;
        const clientY = e.clientY;
        const tile = renderer.screenToWorld(clientX, clientY);
        renderer.hoverTile = tile;

        if (isPanning) {
          const dx = clientX - panStartX;
          const dy = clientY - panStartY;
          const effectiveTile = renderer.tileSize * renderer.zoom;
          renderer.camX = camStartX - dx / effectiveTile;
          renderer.camY = camStartY - dy / effectiveTile;
          return;
        }

        if (isDraggingAction && renderer.dragStart) {
          renderer.dragEnd = tile;
        }
      });

      window.addEventListener('pointerup', (e) => {
        if (isPanning) {
          isPanning = false;
        }

        if (isDraggingAction && renderer.dragStart) {
          const start = renderer.dragStart;
          const end = renderer.dragEnd || start;
          const tool = renderer.activeTool;

          if (tool === 'delete') {
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);

            const toRemove = new Set();
            for (let y = minY; y <= maxY; y++) {
              for (let x = minX; x <= maxX; x++) {
                const s = state.getStructureAt(x, y);
                if (s) toRemove.add(s);
              }
            }

            if (toRemove.size > 0) {
              const removedData = [];
              toRemove.forEach(s => {
                removedData.push({
                  type: s.type, x: s.x, y: s.y, dir: s.dir,
                  recipe: s.recipe, inputBuffer: { ...s.inputBuffer },
                  outputBuffer: { ...s.outputBuffer }, fuel: s.fuel
                });
                state.removeStructure(s);
              });
              state.undoStack.push({ type: 'delete', structures: removedData });
              audio.playThud();
              showToast(`Removed ${toRemove.size} structure(s)`);
            }
          } else {
            const tiles = renderer.computePlacementTiles(start, end);
            const placed = [];

            tiles.forEach(t => {
              if (state.canPlace(tool, t.x, t.y, t.dir)) {
                const s = state.placeStructure(tool, t.x, t.y, t.dir);
                if (s) placed.push(s);
              }
            });

            if (placed.length > 0) {
              state.undoStack.push({
                type: 'place',
                structures: placed.map(s => ({
                  type: s.type, x: s.x, y: s.y, dir: s.dir, recipe: s.recipe
                }))
              });
              audio.playWhoosh();
            }
          }

          renderer.dragStart = null;
          renderer.dragEnd = null;
          isDraggingAction = false;
        }
      });

      canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Right click cancels build tool or deselects
        if (renderer.activeTool !== 'select') {
          renderer.activeTool = 'select';
          renderToolbar();
        } else if (renderer.selectedStructure) {
          renderer.selectedStructure = null;
          hideInspector();
        }
      });

      // Mouse Wheel Zoom
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.min(2.5, Math.max(0.4, renderer.zoom * zoomDelta));

        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const beforeWorld = renderer.screenToWorld(mouseX, mouseY);

        renderer.zoom = newZoom;

        const effectiveTile = renderer.tileSize * renderer.zoom;
        const afterScreenX = (beforeWorld.x - renderer.camX) * effectiveTile + window.innerWidth / 2;
        const afterScreenY = (beforeWorld.y - renderer.camY) * effectiveTile + window.innerHeight / 2;

        renderer.camX += (afterScreenX - mouseX) / effectiveTile;
        renderer.camY += (afterScreenY - mouseY) / effectiveTile;
      }, { passive: false });

      // --- Touch Support for Mobile / Tablets ---
      let touchStartDist = 0;
      let initialZoom = 1.0;

      canvas.addEventListener('touchstart', (e) => {
        audio.init();
        if (e.touches.length === 1) {
          const t = e.touches[0];
          panStartX = t.clientX;
          panStartY = t.clientY;
          camStartX = renderer.camX;
          camStartY = renderer.camY;
          isPanning = true;
        } else if (e.touches.length === 2) {
          isPanning = false;
          touchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          initialZoom = renderer.zoom;
        }
      }, { passive: true });

      canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isPanning) {
          const t = e.touches[0];
          const dx = t.clientX - panStartX;
          const dy = t.clientY - panStartY;
          const effectiveTile = renderer.tileSize * renderer.zoom;
          renderer.camX = camStartX - dx / effectiveTile;
          renderer.camY = camStartY - dy / effectiveTile;
        } else if (e.touches.length === 2 && touchStartDist > 0) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          renderer.zoom = Math.min(2.5, Math.max(0.4, initialZoom * (dist / touchStartDist)));
        }
      }, { passive: true });

      canvas.addEventListener('touchend', () => {
        isPanning = false;
        touchStartDist = 0;
      });

      // --- Undo & Redo ---
      function executeUndo() {
        if (state.undoStack.length === 0) {
          showToast('Nothing to undo');
          return;
        }
        const action = state.undoStack.pop();
        if (action.type === 'place') {
          action.structures.forEach(sData => {
            const existing = state.getStructureAt(sData.x, sData.y);
            if (existing) state.removeStructure(existing);
          });
          state.redoStack.push(action);
          showToast('Undid placement');
        } else if (action.type === 'delete') {
          action.structures.forEach(sData => {
            state.placeStructure(sData.type, sData.x, sData.y, sData.dir, sData);
          });
          state.redoStack.push(action);
          showToast('Restored deleted structure(s)');
        }
        audio.playWhoosh();
      }

      function executeRedo() {
        if (state.redoStack.length === 0) {
          showToast('Nothing to redo');
          return;
        }
        const action = state.redoStack.pop();
        if (action.type === 'place') {
          action.structures.forEach(sData => {
            state.placeStructure(sData.type, sData.x, sData.y, sData.dir, sData);
          });
          state.undoStack.push(action);
          showToast('Redid placement');
        } else if (action.type === 'delete') {
          action.structures.forEach(sData => {
            const existing = state.getStructureAt(sData.x, sData.y);
            if (existing) state.removeStructure(existing);
          });
          state.undoStack.push(action);
          showToast('Redid deletion');
        }
        audio.playWhoosh();
      }

      document.getElementById('btn-undo').addEventListener('click', executeUndo);
      document.getElementById('btn-redo').addEventListener('click', executeRedo);
      document.getElementById('btn-center-cam').addEventListener('click', () => {
        if (state.structures.length > 0) {
          let sumX = 0, sumY = 0;
          state.structures.forEach(s => { sumX += s.x + s.w / 2; sumY += s.y + s.h / 2; });
          renderer.camX = sumX / state.structures.length;
          renderer.camY = sumY / state.structures.length;
        } else {
          renderer.camX = state.width / 2;
          renderer.camY = state.height / 2;
        }
        renderer.zoom = 1.0;
        showToast('Camera Centered');
      });

      // --- Overlays Toggle ---
      document.querySelectorAll('.overlay-btn[data-overlay]').forEach(btn => {
        btn.addEventListener('click', () => {
          const overlayKey = btn.getAttribute('data-overlay');
          state.overlays[overlayKey] = !state.overlays[overlayKey];
          btn.classList.toggle('active', state.overlays[overlayKey]);
          showToast(`${overlayKey.toUpperCase()} Overlay: ${state.overlays[overlayKey] ? 'ON' : 'OFF'}`);
        });
      });

      // --- Sim Controls ---
      const pauseBtn = document.getElementById('btn-pause');
      const pauseIcon = document.getElementById('pause-icon');
      const stepBtn = document.getElementById('btn-step');

      function togglePause() {
        state.paused = !state.paused;
        pauseIcon.textContent = state.paused ? '▶️' : '⏸';
        pauseBtn.classList.toggle('btn-amber', state.paused);
        showToast(state.paused ? 'Simulation Paused' : 'Simulation Resumed');
      }

      pauseBtn.addEventListener('click', togglePause);
      stepBtn.addEventListener('click', () => {
        if (!state.paused) togglePause();
        sim.step();
        audio.playPop();
      });

      document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.speedMultiplier = parseFloat(btn.getAttribute('data-speed'));
          showToast(`Simulation Speed: ${state.speedMultiplier}x`);
        });
      });

      // --- Audio Button ---
      const audioBtn = document.getElementById('btn-audio');
      audioBtn.addEventListener('click', () => {
        audio.init();
        const enabled = audio.toggleMute();
        audioBtn.textContent = enabled ? '🔊' : '🔇';
        showToast(enabled ? 'Sound Enabled' : 'Sound Muted');
      });

      // --- Inspector Panel ---
      const inspector = document.getElementById('inspector-panel');
      const inspName = document.getElementById('insp-name');
      const inspCoord = document.getElementById('insp-coord');
      const inspStatus = document.getElementById('insp-status');
      const inspPower = document.getElementById('insp-power');
      const inspRecipeRow = document.getElementById('insp-recipe-row');
      const inspRecipeSelect = document.getElementById('insp-recipe-select');
      const inspProgressBar = document.getElementById('insp-progress-bar');
      const inspInputs = document.getElementById('insp-inputs');
      const inspOutputs = document.getElementById('insp-outputs');
      const inspRotateBtn = document.getElementById('insp-rotate-btn');
      const inspUpgradeBtn = document.getElementById('insp-upgrade-btn');
      const inspDeleteBtn = document.getElementById('insp-delete-btn');
      const inspCloseBtn = document.getElementById('insp-close');

      function showInspector(struct) {
        inspector.classList.add('open');
        updateInspector(struct);
      }

      function hideInspector() {
        inspector.classList.remove('open');
      }

      inspCloseBtn.addEventListener('click', () => {
        renderer.selectedStructure = null;
        hideInspector();
      });

      function updateInspector(struct) {
        if (!struct || !inspector.classList.contains('open')) return;
        const def = STRUCTURE_DEFS[struct.type];
        inspName.textContent = def ? def.name : struct.type;
        inspCoord.textContent = `Tile: (${struct.x}, ${struct.y}) · Dir: ${DIRS[struct.dir].name}`;

        // Status
        inspStatus.textContent = struct.status;
        if (struct.status === 'ACTIVE') inspStatus.style.color = 'var(--accent-green)';
        else if (struct.status === 'BLOCKED') inspStatus.style.color = 'var(--accent-amber)';
        else if (struct.status === 'UNPOWERED') inspStatus.style.color = 'var(--accent-red)';
        else inspStatus.style.color = 'var(--text-muted)';

        // Power
        const pct = Math.round(struct.powerSupplied * 100);
        const kw = def ? (def.power || def.powerGen || 0) : 0;
        inspPower.textContent = `${pct}% (${kw} kW)`;

        // Recipe
        if (struct.type === 'smelter' || struct.type === 'assembler') {
          inspRecipeRow.style.display = 'flex';
          const validRecipes = Object.values(RECIPES).filter(r => r.machine === struct.type);
          inspRecipeSelect.innerHTML = validRecipes.map(r => `
            <option value="${r.id}" ${struct.recipe === r.id ? 'selected' : ''}>${r.name}</option>
          `).join('');
        } else {
          inspRecipeRow.style.display = 'none';
        }

        // Progress
        const maxProg = (struct.type === 'miner' ? 1.5 : (RECIPES[struct.recipe] ? RECIPES[struct.recipe].time : 1.0));
        const progPct = Math.min(100, Math.round((struct.progress / maxProg) * 100));
        inspProgressBar.style.width = `${progPct}%`;

        // Inputs
        let inHtml = '';
        if (struct.inputBuffer) {
          for (let k in struct.inputBuffer) {
            const item = ITEMS[k];
            if (struct.inputBuffer[k] > 0) {
              inHtml += `<span class="inv-pill">${item ? item.name : k}: ${struct.inputBuffer[k]}</span>`;
            }
          }
        }
        inspInputs.innerHTML = inHtml || '<span style="color:var(--text-muted); font-size:11px;">Empty</span>';

        // Outputs
        let outHtml = '';
        if (struct.outputBuffer) {
          for (let k in struct.outputBuffer) {
            const item = ITEMS[k];
            if (struct.outputBuffer[k] > 0) {
              outHtml += `<span class="inv-pill">${item ? item.name : k}: ${struct.outputBuffer[k]}</span>`;
            }
          }
        }
        inspOutputs.innerHTML = outHtml || '<span style="color:var(--text-muted); font-size:11px;">Empty</span>';

        // Upgrade button state
        inspUpgradeBtn.style.display = (struct.type === 'belt') ? 'block' : 'none';
      }

      inspRecipeSelect.addEventListener('change', (e) => {
        if (renderer.selectedStructure) {
          renderer.selectedStructure.recipe = e.target.value;
          renderer.selectedStructure.progress = 0;
          renderer.selectedStructure.inputBuffer = {};
          showToast(`Recipe set to: ${RECIPES[e.target.value].name}`);
        }
      });

      inspRotateBtn.addEventListener('click', () => {
        if (renderer.selectedStructure) {
          renderer.selectedStructure.dir = (renderer.selectedStructure.dir + 1) % 4;
          audio.playPop();
          updateInspector(renderer.selectedStructure);
        }
      });

      inspUpgradeBtn.addEventListener('click', () => {
        if (renderer.selectedStructure && renderer.selectedStructure.type === 'belt') {
          renderer.selectedStructure.type = 'belt_mk2';
          audio.playWhoosh();
          showToast('Upgraded to Belt Mk2');
          updateInspector(renderer.selectedStructure);
        }
      });

      inspDeleteBtn.addEventListener('click', () => {
        if (renderer.selectedStructure) {
          const s = renderer.selectedStructure;
          state.undoStack.push({
            type: 'delete',
            structures: [{
              type: s.type, x: s.x, y: s.y, dir: s.dir, recipe: s.recipe,
              inputBuffer: { ...s.inputBuffer }, outputBuffer: { ...s.outputBuffer }, fuel: s.fuel
            }]
          });
          state.removeStructure(s);
          renderer.selectedStructure = null;
          hideInspector();
          audio.playThud();
          showToast('Structure deleted');
        }
      });

      // --- Modals Management ---
      function openModal(id) {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('open');
      }

      function closeAllModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
      }

      document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeAllModals));
      document.querySelectorAll('.modal-backdrop').forEach(m => {
        m.addEventListener('click', (e) => {
          if (e.target === m) closeAllModals();
        });
      });

      document.getElementById('btn-analytics').addEventListener('click', () => {
        updateAnalyticsModal();
        openModal('modal-analytics');
      });

      document.getElementById('btn-presets').addEventListener('click', () => {
        updatePresetsUI();
        openModal('modal-presets');
      });

      document.getElementById('btn-save-load').addEventListener('click', () => {
        updateSaveSlotsUI();
        openModal('modal-save-load');
      });

      document.getElementById('btn-settings').addEventListener('click', () => {
        document.getElementById('setting-mode').value = state.gameMode;
        document.getElementById('setting-cost-mode').value = state.costMode;
        document.getElementById('setting-power-diff').value = state.powerDifficulty;
        document.getElementById('setting-belt-speed').value = state.beltSpeedSetting.toString();
        document.getElementById('setting-seed').value = state.seed;
        openModal('modal-settings');
      });

      // Bottleneck Banner Click
      document.getElementById('bottleneck-banner').addEventListener('click', () => {
        updateAnalyticsModal();
        openModal('modal-analytics');
      });

      // --- Presets Modal Population ---
      function updatePresetsUI() {
        const grid = document.getElementById('presets-grid-container');
        if (!grid) return;
        grid.innerHTML = '';

        for (let key in PRESETS) {
          const p = PRESETS[key];
          const card = document.createElement('div');
          card.className = `preset-card ${key === activePresetKey ? 'active' : ''}`;
          card.innerHTML = `
            <div class="preset-header">
              <span class="preset-name">${p.name}</span>
              <span class="preset-tag" style="background:${p.tagColor}22; color:${p.tagColor};">${p.tag}</span>
            </div>
            <div class="preset-desc">${p.desc}</div>
            <button class="btn btn-sm btn-amber" style="margin-top: 10px; width: 100%;">Load Factory Preset</button>
          `;
          card.querySelector('button').addEventListener('click', () => {
            loadPreset(key);
            closeAllModals();
          });
          grid.appendChild(card);
        }
      }

      // --- Analytics Modal Population ---
      function updateAnalyticsModal() {
        let totalActive = 0;
        let totalProcessing = 0;
        const blockedList = [];

        state.structures.forEach(s => {
          if (s.type === 'miner' || s.type === 'smelter' || s.type === 'assembler') {
            totalProcessing++;
            if (s.status === 'ACTIVE') totalActive++;
            else if (s.status === 'BLOCKED') {
              blockedList.push(`• ${STRUCTURE_DEFS[s.type].name} at (${s.x}, ${s.y}): Output buffer backed up.`);
            } else if (s.status === 'STARVED') {
              blockedList.push(`• ${STRUCTURE_DEFS[s.type].name} at (${s.x}, ${s.y}): Waiting for inputs.`);
            } else if (s.status === 'UNPOWERED') {
              blockedList.push(`• ${STRUCTURE_DEFS[s.type].name} at (${s.x}, ${s.y}): Insufficient electrical supply.`);
            }
          }
        });

        const util = totalProcessing > 0 ? Math.round((totalActive / totalProcessing) * 100) : 0;
        document.getElementById('ana-utilization').textContent = `${util}%`;

        let supply = 0, demand = 0;
        state.powerGrids.forEach(g => { supply += g.totalSupply; demand += g.totalDemand; });
        document.getElementById('ana-power').textContent = `${Math.round(supply)} kW / ${Math.round(demand)} kW`;

        let deliveredSum = 0;
        for (let k in state.totalDelivered) deliveredSum += state.totalDelivered[k];
        document.getElementById('ana-deliveries').textContent = `${deliveredSum} items`;

        // Bottlenecks list
        const bListEl = document.getElementById('bottlenecks-list');
        if (blockedList.length > 0) {
          bListEl.innerHTML = blockedList.map(item => `<div style="color:var(--accent-amber); margin-bottom: 3px;">${item}</div>`).join('');
        } else {
          bListEl.innerHTML = '<div style="color:var(--accent-green);">✅ No bottlenecks detected. Factory lines flow smoothly!</div>';
        }

        // Stats Table
        const tbody = document.getElementById('stats-table-body');
        let rows = '';
        for (let itemId in ITEMS) {
          const prod = state.productionCounters[itemId] || 0;
          const cons = state.consumptionCounters[itemId] || 0;
          const deliv = state.totalDelivered[itemId] || 0;
          if (prod > 0 || cons > 0 || deliv > 0) {
            rows += `
              <tr>
                <td>${ITEMS[itemId].name}</td>
                <td>${prod}</td>
                <td>${cons}</td>
                <td>${deliv}</td>
              </tr>
            `;
          }
        }
        tbody.innerHTML = rows || '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No production data yet</td></tr>';
      }

      // --- Save / Load & Export Actions ---
      function updateSaveSlotsUI() {
        document.querySelectorAll('.slot-btn').forEach(btn => {
          const slot = btn.getAttribute('data-slot');
          const saved = localStorage.getItem(`logisticraft_slot_${slot}`);
          if (saved) {
            try {
              const d = JSON.parse(saved);
              btn.textContent = `Slot ${slot} (${d.structures ? d.structures.length : 0} items)`;
              btn.style.borderColor = 'var(--accent-cyan)';
            } catch (e) {
              btn.textContent = `Slot ${slot}`;
            }
          } else {
            btn.textContent = `Slot ${slot} (Empty)`;
            btn.style.borderColor = 'var(--border-color)';
          }
        });
      }

      document.querySelectorAll('.slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const slot = btn.getAttribute('data-slot');
          const key = `logisticraft_slot_${slot}`;
          const existing = localStorage.getItem(key);

          if (existing && confirm(`Slot ${slot} has saved data. Click OK to Load, Cancel to Overwrite with current factory.`)) {
            deserializeState(state, existing);
            showToast(`Loaded Slot ${slot}`);
            closeAllModals();
          } else {
            localStorage.setItem(key, serializeState(state));
            showToast(`Saved to Slot ${slot}`);
            updateSaveSlotsUI();
          }
        });
      });

      document.getElementById('btn-export-json').addEventListener('click', () => {
        const json = serializeState(state);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factory_save_tick${state.tick}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Save file downloaded');
      });

      document.getElementById('input-import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (deserializeState(state, evt.target.result)) {
            showToast('Factory imported from file');
            closeAllModals();
          }
        };
        reader.readAsText(file);
      });

      document.getElementById('btn-export-png').addEventListener('click', () => {
        renderer.render();
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `factory_snapshot_tick${state.tick}.png`;
        a.click();
        showToast('PNG snapshot exported');
      });

      document.getElementById('btn-copy-string').addEventListener('click', () => {
        const json = serializeState(state);
        const code = btoa(unescape(encodeURIComponent(json)));
        navigator.clipboard.writeText(code).then(() => {
          showToast('Share code copied to clipboard!');
        }).catch(() => {
          document.getElementById('import-json-area').value = code;
          showToast('Code displayed in text box below');
        });
      });

      document.getElementById('btn-load-pasted').addEventListener('click', () => {
        const val = document.getElementById('import-json-area').value.trim();
        if (!val) return;
        let jsonStr = val;
        if (!val.startsWith('{')) {
          try {
            jsonStr = decodeURIComponent(escape(atob(val)));
          } catch (e) {}
        }
        if (deserializeState(state, jsonStr)) {
          showToast('Factory loaded from text');
          closeAllModals();
        }
      });

      // --- Settings Modal Actions ---
      document.getElementById('btn-save-settings').addEventListener('click', () => {
        state.gameMode = document.getElementById('setting-mode').value;
        state.costMode = document.getElementById('setting-cost-mode').value;
        state.powerDifficulty = document.getElementById('setting-power-diff').value;
        state.beltSpeedSetting = parseFloat(document.getElementById('setting-belt-speed').value);
        document.getElementById('mode-badge').textContent = state.gameMode.toUpperCase();
        document.getElementById('objective-card').style.display = (state.gameMode === 'campaign' ? 'block' : 'none');
        showToast('Settings applied');
        closeAllModals();
      });

      document.getElementById('btn-reseed').addEventListener('click', () => {
        const newSeed = parseInt(document.getElementById('setting-seed').value, 10) || Math.floor(Math.random() * 999999);
        state.seed = newSeed;
        state.initTerrain();
        showToast(`New World Generated (Seed: ${newSeed})`);
      });

      document.getElementById('btn-clear-factory').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all structures and reset the canvas?')) {
          state.structures = [];
          state.structureMap.clear();
          state.items = [];
          state.undoStack = [];
          state.redoStack = [];
          state.rebuildPowerGrids();
          renderer.selectedStructure = null;
          hideInspector();
          showToast('Factory cleared');
          closeAllModals();
        }
      });

      // --- Keyboard Shortcuts ---
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          togglePause();
        } else if (e.key === 'n' || e.key === 'N') {
          if (!state.paused) togglePause();
          sim.step();
          audio.playPop();
        } else if (e.key === 'r' || e.key === 'R') {
          renderer.toolDir = (renderer.toolDir + 1) % 4;
          if (renderer.selectedStructure) {
            renderer.selectedStructure.dir = (renderer.selectedStructure.dir + 1) % 4;
            updateInspector(renderer.selectedStructure);
          }
          audio.playPop();
          showToast(`Rotation: ${DIRS[renderer.toolDir].name}`);
        } else if (e.key === 'q' || e.key === 'Q') {
          renderer.activeTool = 'select';
          renderToolbar();
        } else if (e.key === 'x' || e.key === 'X' || e.key === 'Delete' || e.key === 'Backspace') {
          if (renderer.selectedStructure) {
            const s = renderer.selectedStructure;
            state.removeStructure(s);
            renderer.selectedStructure = null;
            hideInspector();
            audio.playThud();
          } else {
            renderer.activeTool = 'delete';
            renderToolbar();
          }
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
          e.preventDefault();
          if (e.shiftKey) executeRedo(); else executeUndo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
          e.preventDefault();
          executeRedo();
        } else if (e.key === 'b' || e.key === 'B') {
          renderer.activeTool = 'belt';
          renderToolbar();
        } else if (e.key === 'm' || e.key === 'M') {
          renderer.activeTool = 'miner';
          renderToolbar();
        } else if (e.key === 's' || e.key === 'S') {
          renderer.activeTool = 'smelter';
          renderToolbar();
        } else if (e.key === 'a' || e.key === 'A') {
          renderer.activeTool = 'assembler';
          renderToolbar();
        } else if (e.key === 'p' || e.key === 'P') {
          renderer.activeTool = 'power_pole';
          renderToolbar();
        } else if (e.key === 'g' || e.key === 'G') {
          renderer.activeTool = 'generator';
          renderToolbar();
        } else if (e.key === 'h' || e.key === 'H') {
          renderer.activeTool = 'hub';
          renderToolbar();
        } else if (e.key === 'Escape') {
          renderer.activeTool = 'select';
          renderer.selectedStructure = null;
          hideInspector();
          closeAllModals();
          renderToolbar();
        }
      });

      // --- Auto-Save Timer (every 60s) ---
      setInterval(() => {
        try {
          localStorage.setItem('logisticraft_slot_autosave', serializeState(state));
        } catch (e) {}
      }, 60000);

      // Load initial preset
      loadPreset("starter_line");

      // --- Main RAF Game Loop & UI Updating ---
      function gameLoop(timestamp) {
        sim.update(timestamp);
        renderer.render();

        // Update HUD
        document.getElementById('fps-badge').textContent = `${sim.fps} FPS`;
        document.getElementById('tick-badge').textContent = `T: ${state.tick}`;
        document.getElementById('item-count-text').textContent = state.items.length.toString();

        let activeMach = 0, totalMach = 0;
        let blockedCount = 0;
        state.structures.forEach(s => {
          if (s.type === 'miner' || s.type === 'smelter' || s.type === 'assembler') {
            totalMach++;
            if (s.status === 'ACTIVE') activeMach++;
            else if (s.status === 'BLOCKED') blockedCount++;
          }
        });
        document.getElementById('machine-status-text').textContent = `${activeMach}/${totalMach}`;

        // Power HUD
        let supply = 0, demand = 0;
        state.powerGrids.forEach(g => { supply += g.totalSupply; demand += g.totalDemand; });
        let sat = (demand > 0) ? Math.min(1.0, supply / demand) : (supply > 0 ? 1.0 : 0.0);
        if (state.powerDifficulty === 'unlimited') sat = 1.0;
        const satPct = Math.round(sat * 100);
        const powerBar = document.getElementById('power-bar');
        const powerText = document.getElementById('power-text');
        powerBar.style.width = `${satPct}%`;
        powerText.textContent = `${satPct}%`;
        if (satPct < 50) {
          powerBar.style.background = 'var(--accent-red)';
        } else if (satPct < 90) {
          powerBar.style.background = 'var(--accent-amber)';
        } else {
          powerBar.style.background = 'var(--accent-cyan)';
        }

        // Bottleneck Banner
        const banner = document.getElementById('bottleneck-banner');
        const bannerText = document.getElementById('bottleneck-banner-text');
        if (blockedCount > 0) {
          banner.style.display = 'flex';
          bannerText.textContent = `Bottleneck Alert: ${blockedCount} machine(s) blocked by full output buffers`;
        } else if (sat < 0.8 && demand > 0 && state.powerDifficulty !== 'unlimited') {
          banner.style.display = 'flex';
          bannerText.textContent = `Electrical Brownout: Grid satisfaction at ${satPct}% (${Math.round(supply)}/${Math.round(demand)} kW)`;
        } else {
          banner.style.display = 'none';
        }

        // Objective Card
        const contract = CAMPAIGN_CONTRACTS[state.currentContractIndex];
        if (contract && state.gameMode === 'campaign') {
          document.getElementById('obj-contract-tier').textContent = `CONTRACT TIER ${contract.id}`;
          document.getElementById('obj-contract-name').textContent = contract.name;
          document.getElementById('obj-contract-desc').textContent = contract.desc;
          document.getElementById('obj-reward-badge').textContent = `+${contract.rewardTech}`;

          let totalGoals = 0, totalDone = 0;
          for (let k in contract.goals) {
            totalGoals += contract.goals[k];
            totalDone += Math.min(contract.goals[k], state.contractProgress[k] || 0);
          }
          const progPct = totalGoals > 0 ? Math.min(100, Math.round((totalDone / totalGoals) * 100)) : 100;
          document.getElementById('obj-progress-bar').style.width = `${progPct}%`;
          document.getElementById('obj-progress-text').textContent = `${totalDone} / ${totalGoals} Delivered`;

          // Delivery rate
          const now = Date.now();
          const recent = state.deliveryHistory.filter(t => now - t <= 60000).length;
          document.getElementById('obj-rate-text').textContent = `${recent.toFixed(1)}/m`;
        }

        // Keep Inspector updated
        if (renderer.selectedStructure) {
          updateInspector(renderer.selectedStructure);
        }

        requestAnimationFrame(gameLoop);
      }

      requestAnimationFrame(gameLoop);

      // --- Expose Global Test Hooks on window ---
      window.__GAME_STATE__ = state;
      window.__SIM_ENGINE__ = sim;
      window.__RENDERER__ = renderer;
      window.__PRESETS__ = PRESETS;
      window.loadPreset = loadPreset;
      window.serializeState = () => serializeState(state);
      window.deserializeState = (json) => deserializeState(state, json);
      window.stepTick = () => sim.step();
      window.showToast = showToast;

    })();
  </script>
</body>
</html>
