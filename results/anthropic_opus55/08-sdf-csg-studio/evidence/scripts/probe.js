(() => { const nm = id => id ? studio.scene.objects.find(o=>o.id===id).name : 'miss';
  const pts = {tubeTop:[1.7,1.17,0.1], core:[-0.3,2.0,0.4], boxSide:[1.7,0.6,1.5]};
  const out = {op: studio.scene.objects.find(o=>o.name==='Torus 3').op};
  for (const k in pts) { const s = studio.project(pts[k]); const r = studio.pick(s.x, s.y); out[k] = nm(r.id) + ' @t=' + r.t.toFixed(3); }
  return JSON.stringify(out); })()
