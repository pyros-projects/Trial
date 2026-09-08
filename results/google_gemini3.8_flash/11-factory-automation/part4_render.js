      // ==========================================
      // 5. FACTORY RENDERER (Canvas)
      // ==========================================
      class FactoryRenderer {
        constructor(canvas, gameState) {
          this.canvas = canvas;
          this.ctx = canvas.getContext('2d');
          this.state = gameState;
          
          this.tileSize = 32;
          this.camX = 20;
          this.camY = 20;
          this.zoom = 1.0;
          this.dpr = window.devicePixelRatio || 1;

          this.dragStart = null;
          this.dragEnd = null;
          this.activeTool = 'select';
          this.toolDir = 1;
          this.selectedStructure = null;
          this.hoverTile = { x: -1, y: -1 };
          this.animTime = 0;

          this.resize();
          window.addEventListener('resize', () => this.resize());
        }

        resize() {
          this.dpr = window.devicePixelRatio || 1;
          this.canvas.width = window.innerWidth * this.dpr;
          this.canvas.height = window.innerHeight * this.dpr;
        }

        worldToScreen(x, y) {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const effectiveTile = this.tileSize * this.zoom;
          return {
            x: (x - this.camX) * effectiveTile + w / 2,
            y: (y - this.camY) * effectiveTile + h / 2
          };
        }

        screenToWorld(sx, sy) {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const effectiveTile = this.tileSize * this.zoom;
          return {
            x: Math.floor((sx - w / 2) / effectiveTile + this.camX),
            y: Math.floor((sy - h / 2) / effectiveTile + this.camY)
          };
        }

        render() {
          this.animTime += 0.03;
          const ctx = this.ctx;
          const w = window.innerWidth;
          const h = window.innerHeight;
          const tSize = this.tileSize * this.zoom;

          ctx.save();
          ctx.scale(this.dpr, this.dpr);

          ctx.fillStyle = '#090d13';
          ctx.fillRect(0, 0, w, h);

          const minWorld = this.screenToWorld(0, 0);
          const maxWorld = this.screenToWorld(w, h);
          const startX = Math.max(0, minWorld.x);
          const endX = Math.min(this.state.width, maxWorld.x + 2);
          const startY = Math.max(0, minWorld.y);
          const endY = Math.min(this.state.height, maxWorld.y + 2);

          // 1. Grid & Ore Deposits
          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              const sPos = this.worldToScreen(x, y);
              
              ctx.strokeStyle = '#161d26';
              ctx.lineWidth = 1;
              ctx.strokeRect(sPos.x, sPos.y, tSize, tSize);

              const cell = this.state.grid[y][x];
              if (cell.resource) {
                const itemDef = ITEMS[cell.resource];
                ctx.fillStyle = itemDef.color;
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.arc(sPos.x + tSize / 2, sPos.y + tSize / 2, tSize * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;

                ctx.fillStyle = '#fff';
                ctx.fillRect(sPos.x + tSize * 0.3, sPos.y + tSize * 0.3, 2, 2);
                ctx.fillRect(sPos.x + tSize * 0.65, sPos.y + tSize * 0.55, 2, 2);
              }
            }
          }

          // 2. Structures
          this.state.structures.forEach(struct => {
            if (struct.x + struct.w < startX || struct.x > endX ||
                struct.y + struct.h < startY || struct.y > endY) {
              return;
            }
            this.drawStructure(struct, tSize);
          });

          // 3. Moving Items
          this.drawItems(tSize);

          // 4. Power Grid Overlay
          if (this.state.overlays.power) {
            this.drawPowerOverlay(tSize);
          }

          // 5. Heatmap & Congestion
          if (this.state.overlays.heatmap) {
            this.drawHeatmapOverlay(tSize);
          }
          if (this.state.overlays.congestion) {
            this.drawCongestionOverlay(tSize);
          }

          // 6. Preview & Selection
          this.drawPlacementPreview(tSize);

          // 7. Status Badges
          if (this.state.overlays.badges) {
            this.drawStatusBadges(tSize);
          }

          // 8. Hover Tile
          if (this.hoverTile.x >= 0 && this.hoverTile.x < this.state.width &&
              this.hoverTile.y >= 0 && this.hoverTile.y < this.state.height) {
            const hPos = this.worldToScreen(this.hoverTile.x, this.hoverTile.y);
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(hPos.x, hPos.y, tSize, tSize);
          }

          ctx.restore();
        }

        drawStructure(struct, tSize) {
          const ctx = this.ctx;
          const pos = this.worldToScreen(struct.x, struct.y);
          const sw = struct.w * tSize;
          const sh = struct.h * tSize;

          ctx.save();

          // Belt
          if (struct.type === 'belt' || struct.type === 'belt_mk2') {
            const isMk2 = struct.type === 'belt_mk2';
            ctx.fillStyle = isMk2 ? '#1e293b' : '#334155';
            ctx.fillRect(pos.x, pos.y, sw, sh);

            ctx.fillStyle = isMk2 ? '#0284c7' : '#64748b';
            ctx.fillRect(pos.x, pos.y, sw, 2);
            ctx.fillRect(pos.x, pos.y + sh - 2, sw, 2);

            ctx.save();
            ctx.translate(pos.x + sw / 2, pos.y + sh / 2);
            ctx.rotate((struct.dir * 90 * Math.PI) / 180);

            if (this.state.overlays.flow) {
              ctx.strokeStyle = isMk2 ? '#00e5ff' : '#cbd5e1';
              ctx.lineWidth = 2;
              ctx.beginPath();
              // In local coords, North is pointing UP (-Y). So chevron tip is at (0, -3) and wings at (-5, 3) and (5, 3)
              const chevronOffset = ((this.animTime * (isMk2 ? 40 : 20)) % 16) - 8;
              ctx.moveTo(-5, chevronOffset + 3);
              ctx.lineTo(0, chevronOffset - 3);
              ctx.lineTo(5, chevronOffset + 3);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Splitter
          else if (struct.type === 'splitter') {
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);
            
            ctx.fillStyle = '#f59e0b';
            ctx.font = `bold ${Math.floor(tSize * 0.4)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Y', pos.x + sw / 2, pos.y + sh / 2);
          }

          // Merger
          else if (struct.type === 'merger') {
            ctx.fillStyle = '#10b981';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);

            ctx.fillStyle = '#10b981';
            ctx.font = `bold ${Math.floor(tSize * 0.4)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('M', pos.x + sw / 2, pos.y + sh / 2);
          }

          // Inserter
          else if (struct.type === 'inserter') {
            ctx.fillStyle = '#1c2430';
            ctx.fillRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(pos.x + sw / 2, pos.y + sh / 2, tSize * 0.25, 0, Math.PI * 2);
            ctx.fill();

            const armAngle = (struct.dir * 90 * Math.PI) / 180 + ((struct.swingProgress || 0) - 0.5) * Math.PI;
            ctx.strokeStyle = '#fdba74';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(pos.x + sw / 2, pos.y + sh / 2);
            ctx.lineTo(pos.x + sw / 2 + Math.cos(armAngle) * (tSize * 0.4),
                       pos.y + sh / 2 + Math.sin(armAngle) * (tSize * 0.4));
            ctx.stroke();
          }

          // Underground Tunnel
          else if (struct.type === 'tunnel') {
            ctx.fillStyle = '#475569';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(pos.x + sw / 2, pos.y + sh / 2, tSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }

          // Mining Drill (2x2)
          else if (struct.type === 'miner') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2;
            ctx.strokeRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);

            ctx.save();
            ctx.translate(pos.x + sw / 2, pos.y + sh / 2);
            if (struct.status === 'ACTIVE') {
              ctx.rotate(this.animTime * 4);
            }
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(-tSize * 0.35, -tSize * 0.1, tSize * 0.7, tSize * 0.2);
            ctx.fillRect(-tSize * 0.1, -tSize * 0.35, tSize * 0.2, tSize * 0.7);
            ctx.restore();
          }

          // Electric Smelter (2x2)
          else if (struct.type === 'smelter') {
            ctx.fillStyle = '#3f2518';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.strokeStyle = '#ea580c';
            ctx.lineWidth = 2;
            ctx.strokeRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);

            if (struct.status === 'ACTIVE') {
              const glow = 0.5 + Math.sin(this.animTime * 8) * 0.3;
              ctx.fillStyle = `rgba(249, 115, 22, ${glow})`;
              ctx.beginPath();
              ctx.arc(pos.x + sw / 2, pos.y + sh / 2, tSize * 0.45, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.floor(tSize * 0.35)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔥', pos.x + sw / 2, pos.y + sh / 2);
          }

          // Assembler (2x2)
          else if (struct.type === 'assembler') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 2;
            ctx.strokeRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);

            ctx.save();
            ctx.translate(pos.x + sw / 2, pos.y + sh / 2);
            if (struct.status === 'ACTIVE') {
              ctx.rotate(this.animTime * 3);
            }
            ctx.fillStyle = '#a78bfa';
            ctx.font = `${Math.floor(tSize * 0.6)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚙️', 0, 0);
            ctx.restore();
          }

          // Power Pole (1x1)
          else if (struct.type === 'power_pole') {
            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.arc(pos.x + sw / 2, pos.y + sh / 2, tSize * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(pos.x + sw / 2, pos.y + sh / 2, 2, 0, Math.PI * 2);
            ctx.fill();
          }

          // Coal Generator (2x2)
          else if (struct.type === 'generator') {
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.strokeStyle = '#78716c';
            ctx.lineWidth = 2;
            ctx.strokeRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);

            ctx.fillStyle = '#44403c';
            ctx.fillRect(pos.x + sw * 0.2, pos.y + sh * 0.2, tSize * 0.4, tSize * 0.4);
            ctx.fillRect(pos.x + sw * 0.6, pos.y + sh * 0.2, tSize * 0.4, tSize * 0.4);

            if (struct.status === 'ACTIVE') {
              ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
              const puff = (this.animTime * 20) % (tSize * 0.8);
              ctx.beginPath();
              ctx.arc(pos.x + sw * 0.3, pos.y + sh * 0.3 - puff, 4 + puff * 0.2, 0, Math.PI * 2);
              ctx.arc(pos.x + sw * 0.7, pos.y + sh * 0.3 - puff, 4 + puff * 0.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Solar Array (2x2)
          else if (struct.type === 'solar_panel') {
            ctx.fillStyle = '#0c4a6e';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);
            ctx.strokeStyle = '#0284c7';
            ctx.strokeRect(pos.x + sw * 0.15, pos.y + sh * 0.15, sw * 0.7, sh * 0.7);
          }

          // Storage Chest (1x1)
          else if (struct.type === 'storage') {
            ctx.fillStyle = '#b45309';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);
          }

          // Delivery Hub (2x2)
          else if (struct.type === 'hub') {
            ctx.fillStyle = '#064e3b';
            ctx.fillRect(pos.x + 2, pos.y + 2, sw - 4, sh - 4);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(pos.x + 4, pos.y + 4, sw - 8, sh - 8);

            const pulse = Math.sin(this.animTime * 4) * 4;
            ctx.fillStyle = '#34d399';
            ctx.font = `${Math.floor(tSize * 0.7 + pulse)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚀', pos.x + sw / 2, pos.y + sh / 2);
          }

          if (this.selectedStructure === struct) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(pos.x - 2, pos.y - 2, sw + 4, sh + 4);
            ctx.setLineDash([]);
          }

          ctx.restore();
        }

        drawItems(tSize) {
          const ctx = this.ctx;
          this.state.items.forEach(item => {
            const struct = this.state.getStructureAt(item.tileX, item.tileY);
            if (!struct) return;

            const pos = this.worldToScreen(item.tileX, item.tileY);
            const d = DIRS[struct.dir];

            const itemX = pos.x + tSize / 2 + d.x * (item.progress - 0.5) * tSize;
            const itemY = pos.y + tSize / 2 + d.y * (item.progress - 0.5) * tSize;

            const itemDef = ITEMS[item.type];
            if (!itemDef) return;

            ctx.save();
            ctx.fillStyle = itemDef.color;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;

            const r = Math.max(3, tSize * 0.16);

            if (itemDef.shape === 'bar') {
              ctx.fillRect(itemX - r * 1.4, itemY - r * 0.7, r * 2.8, r * 1.4);
              ctx.strokeRect(itemX - r * 1.4, itemY - r * 0.7, r * 2.8, r * 1.4);
            } else if (itemDef.shape === 'chip' || itemDef.shape === 'plate') {
              ctx.fillRect(itemX - r, itemY - r, r * 2, r * 2);
              ctx.strokeRect(itemX - r, itemY - r, r * 2, r * 2);
            } else if (itemDef.shape === 'gear' || itemDef.shape === 'core') {
              ctx.beginPath();
              ctx.arc(itemX, itemY, r * 1.1, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.arc(itemX, itemY, r, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            ctx.restore();
          });
        }

        drawPowerOverlay(tSize) {
          const ctx = this.ctx;
          const poles = this.state.structures.filter(s => s.type === 'power_pole');

          ctx.save();
          poles.forEach(p => {
            const pos = this.worldToScreen(p.x + 0.5, p.y + 0.5);
            ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, STRUCTURE_DEFS.power_pole.radius * tSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });

          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 1.2;
          for (let i = 0; i < poles.length; i++) {
            for (let j = i + 1; j < poles.length; j++) {
              const p1 = poles[i];
              const p2 = poles[j];
              const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
              if (dist <= STRUCTURE_DEFS.power_pole.wireReach) {
                const s1 = this.worldToScreen(p1.x + 0.5, p1.y + 0.5);
                const s2 = this.worldToScreen(p2.x + 0.5, p2.y + 0.5);
                
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                const midX = (s1.x + s2.x) / 2;
                const midY = (s1.y + s2.y) / 2 + dist * 1.5;
                ctx.quadraticCurveTo(midX, midY, s2.x, s2.y);
                ctx.stroke();
              }
            }
          }
          ctx.restore();
        }

        drawHeatmapOverlay(tSize) {
          const ctx = this.ctx;
          ctx.save();
          this.state.structures.forEach(struct => {
            const pos = this.worldToScreen(struct.x, struct.y);
            const sw = struct.w * tSize;
            const sh = struct.h * tSize;

            let color = 'rgba(16, 185, 129, 0.4)';
            if (struct.status === 'STARVED') color = 'rgba(245, 158, 11, 0.5)';
            else if (struct.status === 'BLOCKED') color = 'rgba(239, 68, 68, 0.5)';
            else if (struct.status === 'UNPOWERED') color = 'rgba(139, 92, 246, 0.5)';

            ctx.fillStyle = color;
            ctx.fillRect(pos.x, pos.y, sw, sh);
          });
          ctx.restore();
        }

        drawCongestionOverlay(tSize) {
          const ctx = this.ctx;
          ctx.save();
          this.state.items.forEach(item => {
            if (item.blocked) {
              const pos = this.worldToScreen(item.tileX, item.tileY);
              ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
              ctx.fillRect(pos.x, pos.y, tSize, tSize);
            }
          });
          ctx.restore();
        }

        drawStatusBadges(tSize) {
          const ctx = this.ctx;
          this.state.structures.forEach(struct => {
            if (struct.status === 'ACTIVE' || struct.type === 'belt' || struct.type === 'belt_mk2') return;

            const pos = this.worldToScreen(struct.x + struct.w / 2, struct.y);
            let badge = '';

            if (struct.status === 'UNPOWERED') {
              badge = '⚡';
            } else if (struct.status === 'STARVED') {
              badge = '⏳';
            } else if (struct.status === 'BLOCKED') {
              badge = '🛑';
            }

            if (badge) {
              ctx.save();
              ctx.font = `${Math.floor(tSize * 0.45)}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(badge, pos.x, pos.y - 2);
              ctx.restore();
            }
          });
        }

        drawPlacementPreview(tSize) {
          const ctx = this.ctx;
          if (!this.dragStart || this.activeTool === 'select') return;

          const start = this.dragStart;
          const end = this.dragEnd || this.dragStart;

          if (this.activeTool === 'delete') {
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);

            const p1 = this.worldToScreen(minX, minY);
            const p2 = this.worldToScreen(maxX + 1, maxY + 1);

            ctx.save();
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
            ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
            ctx.restore();
            return;
          }

          const tiles = this.computePlacementTiles(start, end);
          tiles.forEach(tile => {
            const valid = this.state.canPlace(this.activeTool, tile.x, tile.y, tile.dir);
            const pos = this.worldToScreen(tile.x, tile.y);
            const def = STRUCTURE_DEFS[this.activeTool];
            const sw = def ? def.w * tSize : tSize;
            const sh = def ? def.h * tSize : tSize;

            ctx.save();
            ctx.fillStyle = valid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
            ctx.strokeStyle = valid ? '#10b981' : '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.fillRect(pos.x, pos.y, sw, sh);
            ctx.strokeRect(pos.x, pos.y, sw, sh);
            ctx.restore();
          });
        }

        computePlacementTiles(start, end) {
          if (this.activeTool === 'belt' || this.activeTool === 'belt_mk2') {
            const tiles = [];
            let cx = start.x;
            let cy = start.y;

            const stepX = end.x >= start.x ? 1 : -1;
            const stepY = end.y >= start.y ? 1 : -1;
            const dirX = stepX > 0 ? 1 : 3;
            const dirY = stepY > 0 ? 2 : 0;

            while (cx !== end.x) {
              tiles.push({ x: cx, y: cy, dir: dirX });
              cx += stepX;
            }
            while (cy !== end.y) {
              tiles.push({ x: cx, y: cy, dir: dirY });
              cy += stepY;
            }
            tiles.push({ x: cx, y: cy, dir: this.toolDir });
            return tiles;
          }

          return [{ x: start.x, y: start.y, dir: this.toolDir }];
        }
      }
