// compact live-state probe (evaluated in the page via agent-browser eval --stdin)
(() => { const s = APEX.state(), f = Q.rot(s.q, [0, 0, -1]), u = Q.rot(s.q, [0, 1, 0]), r = Q.rot(s.q, [1, 0, 0]);
  const hd = Math.atan2(f[0], -f[2]) * 180 / Math.PI, bank = Math.asin(Math.max(-1, Math.min(1, -r[1]))) * 180 / Math.PI, pitch = Math.asin(Math.max(-1, Math.min(1, f[1]))) * 180 / Math.PI;
  const vf = s.v[0] * f[0] + s.v[2] * f[2], vr = s.v[0] * r[0] + s.v[2] * r[2];
  return JSON.stringify({ step: s.step, alt: +s.p[1].toFixed(2), agl: +s.agl.toFixed(2), vy: +s.v[1].toFixed(2), hdg: +hd.toFixed(1), pitch: +pitch.toFixed(1), bank: +bank.toFixed(1), vFwd: +vf.toFixed(2), vRight: +vr.toFixed(2), thr: +s.thr.toFixed(3), in: [s.input.t, s.input.y, s.input.p, s.input.r].map(v => +v.toFixed(2)), src: s.input.source, mode: s.mode, cam: s.cam, next: s.race.next, lap: s.race.lap, running: s.race.lapRunning, crashed: s.crashed, fps: +s.fps.toFixed(0) }); })()
