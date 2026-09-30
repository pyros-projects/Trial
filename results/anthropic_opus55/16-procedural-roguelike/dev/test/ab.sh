# helpers for agent-browser sessions (dev only)
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-emberdeep}
ev() { { echo "(() => {"; cat; echo "})()"; } | agent-browser eval --stdin; }
keys() { for k in "$@"; do agent-browser press "$k" >/dev/null; agent-browser wait 90 >/dev/null; done; }
st() { ev <<'JS'
const s = window.__emberdeep.S(); const p = s.player;
return JSON.stringify({pos:[p.x,p.y], hp:p.hp, turn:s.turn, floor:s.floorN, mode: window.__emberdeep.UI.mode, foes: s.enemies.filter(e=>e.hp>0&&s._vis[e.y*s.floor.w+e.x]).map(e=>e.k+'@'+e.x+','+e.y+':'+e.state), log: s.log.slice(-3).map(l=>l.text), prompt: document.getElementById('prompt').textContent});
JS
}
tilexy() { ev <<JS
const r = window.__emberdeep.Renderer.tileToScreen($1, $2); return Math.round(r.x + r.ts/2) + ' ' + Math.round(r.y + r.ts/2);
JS
}
clicktile() { local xy; xy=$(tilexy $1 $2 | tr -d '"'); agent-browser mouse move $xy >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse up left >/dev/null; }
# walkto X Y [maxsteps]: press real direction keys along a path; stop when a foe is visible or arrived
walkto() { local n=${3:-60}; for ((i=0;i<n;i++)); do local k; k=$(ev <<JS | tr -d '"'
const s = window.__emberdeep.S(); const p = s.player; const fl = s.floor; const W = fl.w;
if (s.over) return 'OVER';
if (s.enemies.some(e => e.hp > 0 && s._vis[e.y*W+e.x] && e.state !== 'asleep')) return 'FOE';
if (p.x === $1 && p.y === $2) return 'ARRIVED';
const sc = safeCost(fl, true); const d = dmap(fl, [[$1,$2]], (x,y) => { const c = sc(x,y); if (c < 0) return c; const t = trapAt(s,x,y); return (t && !t.hidden && t.armed) ? -1 : c; }); let best = null, bv = d[p.y*W+p.x];
for (const [dx,dy] of DIRS8) { const nx=p.x+dx, ny=p.y+dy; if (!diagOk(fl,p.x,p.y,nx,ny)) continue; if (enemyAt(s,nx,ny)) continue; const v = d[ny*W+nx]; if (v < bv) { bv = v; best = [dx,dy]; } }
if (!best) return 'STUCK';
return ({'0,-1':'k','0,1':'j','-1,0':'h','1,0':'l','-1,-1':'y','1,-1':'u','-1,1':'b','1,1':'n'})[best.join(',')];
JS
); case "$k" in FOE|ARRIVED|STUCK|OVER) echo "walkto: $k after $i steps"; return;; esac; agent-browser press "$k" >/dev/null; done; echo "walkto: maxsteps"; }
# fightkey: choose a sensible real key for the current tactical situation (test driver only)
fightkey() { ev <<'JS' | tr -d '"'
const s = window.__emberdeep.S(); const p = s.player; const fl = s.floor; const W = fl.w;
if (s.over) return 'OVER';
const P = pstats(p); const vis = (e) => e.hp > 0 && s._vis[e.y*W+e.x];
const foes = s.enemies.filter(vis); if (!foes.length) return 'NONE';
const K = ({'0,-1':'k','0,1':'j','-1,0':'h','1,0':'l','-1,-1':'y','1,-1':'u','-1,1':'b','1,1':'n'});
const danger = new Set(); for (const e of s.enemies) if (e.hp>0 && e.windup) for (const [x,y] of e.windup.tiles) danger.add(x+','+y);
if (danger.has(p.x+','+p.y)) { for (const [dx,dy] of DIRS8) { const nx=p.x+dx, ny=p.y+dy; if (!danger.has(nx+','+ny) && tWalk(gget(fl,nx,ny)) && !actorAt(s,nx,ny) && diagOk(fl,p.x,p.y,nx,ny) && !TILES[gget(fl,nx,ny)].hazard) return K[dx+','+dy]; } }
if (p.hp < P.maxHp * 0.4 && p.inv.some(i=>i.k==='heal')) return '1';
const adj = foes.filter(e => cheb(e.x,e.y,p.x,p.y)===1 && diagOk(fl,p.x,p.y,e.x,e.y)).sort((a,b)=> (a.k==='boss'?-1:0)-(b.k==='boss'?-1:0));
if (adj.length) { const e = adj[0]; if (!p.cd.bash && e.k !== 'boss' && adj.length === 1) return 'z'; return K[(e.x-p.x)+','+(e.y-p.y)]; }
const t = foes.sort((a,b)=>cheb(a.x,a.y,p.x,p.y)-cheb(b.x,b.y,p.x,p.y))[0];
const d = dmap(fl, [[t.x,t.y]], safeCost(fl,false)); let best=null, bv=d[p.y*W+p.x];
for (const [dx,dy] of DIRS8) { const nx=p.x+dx, ny=p.y+dy; if (!diagOk(fl,p.x,p.y,nx,ny) || actorAt(s,nx,ny) || danger.has(nx+','+ny)) continue; const v=d[ny*W+nx]; if (v<bv) {bv=v; best=[dx,dy];} }
return best ? K[best.join(',')] : '.';
JS
}
fight() { local n=${1:-40}; for ((i=0;i<n;i++)); do local k; k=$(fightkey); case "$k" in OVER|NONE) echo "fight: $k after $i"; return;; esac; agent-browser press "$k" >/dev/null; done; echo "fight: max"; }
