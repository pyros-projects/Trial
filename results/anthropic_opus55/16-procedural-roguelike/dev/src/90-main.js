// ============================================================ BOOT & LOOP
function reportError(err) {
  const msg = (err && (err.stack || err.message)) || String(err); UI.errors.push(msg.split('\n').slice(0, 2).join(' | '));
  if (UI.errors.length > 20) UI.errors.shift();
  if (!UI._errToast || performance.now() - UI._errToast > 4000) { UI._errToast = performance.now(); toast('Unexpected error (see Diagnostics): ' + (err && err.message ? err.message : err)); }
  console.error(err);
}
window.addEventListener('error', (e) => reportError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
let resizeRaf = 0;
function requestResize() { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => { Renderer.resize(); }); }
function randomSeed() { const a = ['ashen', 'hollow', 'gilded', 'sunken', 'silent', 'crimson', 'mossy', 'iron', 'pale', 'smoky', 'deep', 'bitter']; const b = ['crown', 'lantern', 'vault', 'ember', 'barrow', 'spire', 'moth', 'well', 'gate', 'thorn', 'hearth', 'bone']; const r = (n) => Math.floor(Math.random() * n); return `${a[r(a.length)]}-${b[r(b.length)]}-${r(900) + 100}`; }
function uiView() {
  return { hover: UI.mode === 'play' ? UI.hover : null, preview: UI.mode === 'play' && !UI.travel ? UI.preview : null, target: UI.mode === 'target' ? UI.target : null,
    cursor: UI.mode === 'target' || UI.mode === 'inspect' ? UI.cursor : null, diag: UI.diagOpen ? UI.diag : { any: false } };
}
let lastT = performance.now(), fpsN = 0, fpsT = performance.now();
function loop(now) {
  const dt = Math.min(100, Math.max(0, now - lastT)); lastT = now; fpsN++;
  if (now - fpsT >= 500) { UI.fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
  try {
    travelTick(now); replayTick(now);
    const s = S();
    if (s) {
      Renderer.draw(s, uiView(), now, dt);
      if (now - (UI._miniT || 0) > 150 && UI.settings.mini) { Renderer.drawMini(s); UI._miniT = now; }
      updateHud(false);
      if (UI.diagOpen && now - (UI._diagT || 0) > 400) { renderDiag(); UI._diagT = now; }
    }
  } catch (err) { reportError(err); }
  requestAnimationFrame(loop);
}
function boot() {
  loadKeys(); Renderer.init($('view'), $('minimap')); loadSettings();
  // top bar
  $('btnNew').onclick = () => openStart();
  $('btnSave').onclick = () => { saveGame(false); focusGame(); };
  $('btnLoad').onclick = () => confirmBox('Load the saved run?', 'Unsaved progress in the current run will be lost.', () => loadGame());
  $('btnDiag').onclick = () => toggleDiag();
  $('btnHelp').onclick = () => openHelp();
  $('btnSound').onclick = () => { Sfx.init(); UI.settings.mute = !UI.settings.mute; saveSettings(); applySettings(); toast(UI.settings.mute ? 'Sound muted.' : 'Sound on.', 'info'); focusGame(); };
  $('btnMenu').onclick = () => openMenu();
  $('zoomIn').onclick = () => { cmd('zoomIn'); focusGame(); }; $('zoomOut').onclick = () => { cmd('zoomOut'); focusGame(); };
  $('miniToggle').onclick = () => { cmd('minimap'); };
  for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => showTab(b.dataset.tab);
  // side panel & touch pad (event delegation)
  document.addEventListener('pointerdown', () => Sfx.init(), { capture: true });
  $('side').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ab != null) { startAbility(+b.dataset.ab); if (UI.mode === 'play') focusGame(); return; }
    if (b.dataset.cmd) { cmd(b.dataset.cmd); if (UI.mode === 'play') focusGame(); return; }
    if (b.dataset.id) { const s = S(); const id = +b.dataset.id; const it = s.player.inv.find((q) => q.id === id) || Object.values(s.player.eq).find((q) => q && q.id === id); if (it) openItemMenu(it, b); }
  });
  $('touch').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.dir) { const [dx, dy] = b.dataset.dir.split(',').map(Number); cmd(dx === 0 ? (dy < 0 ? 'moveN' : 'moveS') : dy === 0 ? (dx < 0 ? 'moveW' : 'moveE') : dy < 0 ? (dx < 0 ? 'moveNW' : 'moveNE') : (dx < 0 ? 'moveSW' : 'moveSE')); } else if (b.dataset.cmd) cmd(b.dataset.cmd); });
  document.addEventListener('pointerdown', (e) => { if (!$('itemMenu').hidden && !e.target.closest('#itemMenu') && !e.target.closest('#inv') && !e.target.closest('#eq')) closeItemMenu(); });
  // dialogs
  for (const d of document.querySelectorAll('dialog')) d.addEventListener('close', () => afterDialog());
  $('startForm').addEventListener('submit', (e) => { e.preventDefault(); const p = readStart(); closeDialog('dlgStart'); startRun(p, `New run: ${CLASSES[p.cls].name}, seed “${p.seed}”.`); afterDialog(); });
  $('stRandom').onclick = () => { $('stSeed').value = randomSeed(); $('stDaily').setAttribute('aria-pressed', 'false'); $('stNote').textContent = ''; };
  $('stDaily').onclick = () => { const on = $('stDaily').getAttribute('aria-pressed') !== 'true'; $('stDaily').setAttribute('aria-pressed', String(on)); if (on) { $('stSeed').value = 'daily-' + todayStr(); $('stStyle').value = 'mixed'; $('stNote').textContent = `Daily seed for ${todayStr()} (from your local date — no network needed). Everyone playing today gets the same dungeon.`; } else $('stNote').textContent = ''; };
  $('stPreset').onclick = () => { $('stStyle').value = 'arena'; $('stFloor').value = '4'; $('stNote').textContent = 'Preset: compact test arena starting at depth 4 with a level-appropriate kit (practice runs score ×0.5).'; };
  $('stRecords').onclick = () => { closeDialog('dlgStart'); openRecords(); };
  $('stImport').onclick = () => { closeDialog('dlgStart'); openImport(); };
  $('stContinue').onclick = () => { closeDialog('dlgStart'); loadGame(); afterDialog(); };
  $('stCancel').onclick = () => { closeDialog('dlgStart'); afterDialog(); };
  for (const b of document.querySelectorAll('#dlgMenu [data-m]')) b.onclick = () => menuAction(b.dataset.m);
  for (const b of document.querySelectorAll('#dlgEnd [data-e]')) b.onclick = () => endAction(b.dataset.e);
  $('rcClose').onclick = () => { closeDialog('dlgRecords'); afterDialog(); };
  $('rcClear').onclick = () => { LS.del(KEY_REC); openRecords(); };
  $('ioClose').onclick = () => { closeDialog('dlgIO'); afterDialog(); };
  $('ioImportBtn').onclick = () => doImport();
  $('ioPick').onclick = () => $('ioFile').click();
  $('ioFile').onchange = () => { const f = $('ioFile').files[0]; if (!f) return; f.text().then((t) => { $('ioText').value = t; $('ioErr').textContent = ''; }).catch((e) => { $('ioErr').textContent = 'Could not read file: ' + e.message; }); $('ioFile').value = ''; };
  $('ioDownload').onclick = () => { const r = UI.run; download(`emberdeep-${r.params.seed}-T${r.state.turn}.json`, $('ioText').value); };
  $('ioCopy').onclick = () => { const t = $('ioText'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject(new Error('no clipboard'))).then(() => toast('Copied to clipboard.', 'good')).catch(() => { try { document.execCommand('copy'); toast('Copied.', 'good'); } catch (e) { toast('Copy failed — select the text manually.'); } }); };
  $('keyTable').addEventListener('click', (e) => { const b = e.target.closest('button[data-rebind]'); if (b) startRebind(b.dataset.rebind, b); });
  $('keysReset').onclick = () => { LS.del(KEY_KEYS); loadKeys(); renderKeyTable(); renderHero(); toast('Key bindings reset.', 'good'); };
  $('hpClose').onclick = () => { closeDialog('dlgHelp'); afterDialog(); };
  bindSettings();
  $('rpPlay').onclick = () => toggleReplayPlay(); $('rpStep').onclick = () => { const R = UI.replay; if (R) { R.playing = false; $('rpPlay').textContent = '▶'; replayStep(); } };
  $('rpRestart').onclick = () => restartReplay(); $('rpExit').onclick = () => exitReplay();
  document.addEventListener('keydown', onKey);
  initPointer();
  window.addEventListener('resize', () => { if (!UI.settings.zoom) Renderer.setTile(autoZoom()); applySettings(); });
  if (window.ResizeObserver) new ResizeObserver(() => requestResize()).observe($('stage'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopTravel(); if (UI.run && UI.settings.autosave && !UI.replay && UI.run.sinceSave) saveGame(true); } });
  // start: continue a saved run if there is one, else drop straight into a default run
  let resumed = false;
  if (hasSave()) { try { resumed = loadGame(); } catch (e) { resumed = false; } }
  if (!resumed) startRun({ seed: DEFAULT_SEED, cls: 'warden', style: 'mixed', difficulty: 'normal' }, 'Welcome to the Emberdeep! Use “New run” to choose hero, seed and style.');
  requestAnimationFrame(loop);
  window.__emberdeep = { UI, S, doAction, cmd, startRun, stateHash, simulate, Renderer, Sfx, version: SCHEMA_VERSION, engine: ENGINE_VERSION }; // test/diagnostic hook
}
boot();
