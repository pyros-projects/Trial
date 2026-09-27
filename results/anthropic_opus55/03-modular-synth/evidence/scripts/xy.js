window.__xy = (s, p, frac = 0.5) => { const r = PG.app.ui.roll, b = r.cv.getBoundingClientRect(); return [Math.round(b.left + r.gut + (s + frac) * r.cellW), Math.round(b.top + (r.hi - p + 0.5) * r.rowH)]; };
window.__notes = () => JSON.stringify(PG.app.ui.roll.t.notes.filter(n => n.p === 81 || n.p === 83 || n.p === 84).map(n => [n.s, n.p, n.l, n.v]));
// scroll roll so pitch 81 (A5) is centred
const r = PG.app.ui.roll; r.scroll.scrollTop = (r.hi - 81) * r.rowH - r.scroll.clientHeight / 2;
JSON.stringify({sel: PG.app.project.tracks[PG.app.sel].name, a5_step4: __xy(4, 81), a5_step7: __xy(7, 81, 0.5), notesA5: __notes()});
