# helpers: w2s WX WY -> "sx sy" page coords ; wclick WX WY
export AGENT_BROWSER_SESSION=metroflow20
export AGENT_BROWSER_NAMESPACE=metroflow20ns
w2s() { agent-browser eval "(() => { const M = window.__metroflow; const r = document.querySelector('#map').getBoundingClientRect(); const p = M.w2s($1, $2); return Math.round(r.left + p[0]) + ' ' + Math.round(r.top + p[1]); })()" | tr -d '"'; }
wclick() { local p; p=$(w2s $1 $2); agent-browser mouse move $p >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse up left >/dev/null; }
wdrag() { local a b; a=$(w2s $1 $2); b=$(w2s $3 $4); agent-browser mouse move $a >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse move $b >/dev/null; agent-browser mouse up left >/dev/null; }
state() { agent-browser eval "(() => { const s = window.__metroflow.sim; return JSON.stringify({roads: s.city.roads.length, nodes: s.city.nodes.length, veh: s.veh.length, t: Math.round(s.t), step: s.step}); })()"; }
