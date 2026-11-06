/* ===== main.js ===== */
'use strict';
/* =====================================================================
   ABLAUF – Spielstart, Hauptschleife mit festem Takt, Pause, Hintergrundgefecht im Menü, Vollbild
   ===================================================================== */
let _last = 0, _acc = 0, _hudT = 0, _miniT = 0, _fAcc = 0, _fN = 0;
const AUTOSAVE_MS = 60000;
function layout() {
  UI.rect = null;
  const vh = window.innerHeight;
  if (!$('hud').hidden) { const b = $('bottom').getBoundingClientRect(); R.padB = Math.min(vh * 0.4, b.height + 6); R.padT = $('top').getBoundingClientRect().height; }
  else { R.padB = 0; R.padT = 0; }
  R.resize();
}
function keepAwake() { try { if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) { /* nicht erlaubt */ } }
function resetUi() {
  hpReset(); UI.sel.clear(); UI.selB = 0; UI.mode = 'normal'; UI.place = null; UI.box = null; UI.boxMode = false; UI.paused = false; UI.endShown = false; UI.hasSel = false; UI.mark = null; UI.alertT = -99; UI.alertPos = null; UI.saveAt = performance.now(); UI.askSell = 0; UI.subAim = ''; UI.superTgt = null; UI.slow = false; UI.docPick = null; UI.selS = 0; UI.etechMode = false;
  $('doctrine').hidden = true; $('eMenu').hidden = false; $('ask').hidden = true; $('misBox').hidden = true; $('misTitle').hidden = true; UI.askOpen = false; $('mpWait').hidden = true; $('mpLost').hidden = true; $('eAgain').hidden = false; $('pRestart').hidden = false;
  $('mpRoster').hidden = true; $('mpSig').hidden = true; $('mpSigBox').hidden = true; /* Mehrspieler-Leiste (net.js mpHudRender) */
  $('end').hidden = true; $('pause').hidden = true; $('help').hidden = true; $('settings').hidden = true; $('toasts').textContent = ''; $('info').hidden = true; $('tip').hidden = true;
  $('bRange').classList.toggle('on', UI.showRange);
  inputReset();
}
/* saved: { g, ui } aus einem Spielstand, sonst entsteht eine neue Partie */
/* seat: eigener Sitz im Mehrspieler (sonst der menschliche Spieler der Partie) */
function beginGame(opts, kind, saved, seat) {
  UI.hintQ = []; UI.hintCur = ''; { const hc = document.getElementById('hintCard'); if (hc) hc.hidden = true; }
  const g = saved ? saved.g : createGame(opts), me = seat !== undefined && seat >= 0 ? seat : g.human;
  resetUi();
  UI.g = g; UI.me = me; UI.P = g.players[me]; UI.attract = false; UI.kind = kind; UI.opts = opts; UI.speed = kind === 'mp' ? 1 : SET.speed; UI.tab = 'eco';
  if (kind === 'mp') { mpGameStart(g); $('pRestart').hidden = true; }
  $('menu').hidden = true;
  R.setGame(g, me);
  appOrient(true);
  $('hud').hidden = false;
  hudSel(); layout();
  R.cam.z = clamp(Math.min(R.cssW, R.cssH) / 380, 0.85, 1.3);
  const hq = anyBldg(g, me);
  if (hq) R.center(hq.x, hq.y);
  _acc = 0;
  if (saved) {
    const s = saved.ui || {};
    if (Array.isArray(s.cam) && s.cam.length === 3 && s.cam.every(Number.isFinite)) { R.cam.z = s.cam[2]; R.center(s.cam[0], s.cam[1]); }
    toast(L('Gefecht fortgesetzt, Spielzeit {0}', clock(g.time)), 'good');
  } else {
    clearSave();
    if (kind === 'mp') toast(L('Mehrspieler: Befehle wirken auf allen Geräten zugleich, mit einem Hauch Verzögerung.'), 'good', 5000);
    else if (!opts.sandbox && !opts.mode && !opts.mis) toast(L('Baue Werft und Reaktor. Frachter sammeln schon Eis und Erz.'), '', 5000);
    if (!opts.mis) setTimeout(() => { if (UI.g === g && !g.over) toast(L('Lange auf eine Taste drücken zeigt die Erklärung'), '', 4000); }, 6000);
  }
  if (R.cssH > R.cssW * 1.1) setTimeout(() => toast(L('Im Querformat siehst du mehr vom Kessel')), 3000);
  SND.init();
  MUS.start(UI.P.faction, true);
  keepAwake();
  misUiStart(g, !!saved);
  hudUpdate(); hudGroups();
}
function startWaves() {
  const players = [{ faction: MENU.faction, human: true, team: 0 }];
  if (MENU.mode === 'quarantine') { const others = PLAYABLE.filter(f => f !== MENU.faction); for (let i = 0; i < MENU.allies; i++) players.push({ faction: others[i % others.length], ai: MENU.allyLvl, team: 0 }); }
  beginGame({ map: 'quarantine', seed: 1 + ((Math.random() * 1e6) | 0), players, mode: MENU.mode, pace: MENU.pace || 'tactical' }, 'waves');
  toast(L(MENU.mode === 'quarantine' ? 'Quarantine Line: Baue auf, bevor die erste Welle durch die Risse kommt. Das Siegel in der Mitte darf nicht fallen.' : 'Rift Survival: Baue auf, bevor die erste Welle kommt. Wie lange hältst du durch?'), 'good', 6000);
}
function startSkirmish() {
  if (MENU.mode === 'survival' || MENU.mode === 'quarantine') return startWaves();
  slotsFix();
  const list = slotPlayers(), np = list.length, map = mapFor(MENU.map, np);
  /* Zufallsfraktionen ziehen (bevorzugt solche, die noch niemand hat); Teams: 0 = für sich allein (eigene Teamnummer) */
  const players = list.map((q, i) => {
    let f = q.faction;
    if (f === 'random') { const used = list.map(x => x.faction), free = PLAYABLE.filter(x => used.indexOf(x) < 0); f = (free.length ? free : PLAYABLE)[(Math.random() * (free.length ? free : PLAYABLE).length) | 0]; q.faction = f; }
    return { faction: f, human: !!q.human, ai: q.ai || 0, team: q.team ? q.team : 10 + i, color: q.color || null };
  });
  /* Startplätze: dein Platz frei wählbar (MENU.myStart, −1 = Zufall), die KI belegt die übrigen der Reihe nach */
  const order = startOrder(np);
  players.forEach((q, i) => { q.start = order[i]; });
  const res = MENU.res === 'low' ? { ice: 700, ore: 300 } : MENU.res === 'rich' ? { ice: 2500, ore: 1400 } : undefined;
  /* KARTENEDITOR: eigene Karte – das Layout reist in opts mit (Spielstand) */
  /* Fassung 22: Zufallskarte (mseed) und wandernde Gefahren reisen in opts mit (Spielstand, Wiederholung) */
  beginGame({ map, size: MENU.size || 'normal', seed: 1 + ((Math.random() * 1e6) | 0), players, res, pace: MENU.pace || 'tactical', custom: edLayoutOf(map), mseed: map === 'random' ? randSeedMenu() : undefined, hazards: hazOn(map, MENU.haz) }, 'skirmish');
}
/* Übungsplatz: Testkarte, alles freigeschaltet, reiche Mittel, Zielscheiben des Gegners ohne eigene KI */
function startSandbox() {
  const others = PLAYABLE.filter(f => f !== MENU.faction);
  slotsFix();
  const sf = MENU.slots[0].f, players = [{ faction: MENU.faction, human: true }, { faction: sf !== 'random' && sf !== 'off' && sf !== MENU.faction ? sf : others[(Math.random() * others.length) | 0], ai: 0 }];
  beginGame({ map: 'test', seed: 1 + ((Math.random() * 1e6) | 0), players, res: { ice: 30000, ore: 20000 }, sandbox: true, pace: MENU.pace || 'tactical' }, 'sandbox');
  toast(L('Übungsplatz: alles erforscht, Werft III, Zielscheiben in der Mitte. Doktrin über die Kommandobasis.'), 'good', 6000);
}
function continueGame(slot) {
  const d = slot ? readSlot(slot) : readSave();
  let g = null;
  try { g = d && d.game ? loadGame(d.game) : null; } catch (e) { g = null; }
  if (!g || g.human < 0 || !g.players[g.human].alive) { if (slot) clearSlot(slot); else clearSave(); $('loadWin').hidden = true; menuRender(); const n = $('mNote'); n.textContent = L('Der Spielstand passt nicht mehr zu dieser Fassung und wurde entfernt.'); n.hidden = false; return; }
  beginGame(d.game.opts, d.ui && (d.ui.kind === 'sandbox' || d.ui.kind === 'waves' || d.ui.kind === 'mis' || d.ui.kind === 'cq') ? d.ui.kind : 'skirmish', { g, ui: d.ui });
}
function startAttract() {
  const g = createGame({ map: MAP_ORDER[(Math.random() * MAP_ORDER.length) | 0], seed: 1 + ((Math.random() * 1e6) | 0), players: [{ faction: PLAYABLE[(Math.random() * 4) | 0], ai: 2 }, { faction: PLAYABLE[(Math.random() * 4) | 0], ai: 2 }] });
  resetUi();
  UI.g = g; UI.me = -1; UI.P = null; UI.attract = true; UI.kind = 'attract';
  R.setGame(g, -1);
  $('hud').hidden = true;
  layout();
  R.cam.z = clamp(Math.min(R.cssW, R.cssH) / 600, 0.5, 1);
  const s = g.players[0].start;
  R.center(s.x, s.y);
  _acc = 0;
  MUS.start('menu');
}
function launch(fn) {
  const el = $('loading'); if (!el.hidden) return; el.hidden = false; loadBar(0);
  setTimeout(() => {
    let wait = false;
    try {
      fn();
      /* Fassung 24: Ladebildschirm – Modelle und Shader der Partie vorab vorbereiten, dann erst starten (nicht im Mehrspieler) */
      if (R.mode3d && typeof RA3D !== 'undefined' && RA3D.preload && UI.g && UI.kind !== 'mp' && !window.__RA_TEST) {
        wait = true; UI.loading = true;
        RA3D.preload(loadBar).then(() => { UI.loading = false; _acc = 0; _last = 0; el.hidden = true; });
      }
    } finally { if (!wait) el.hidden = true; }
  }, 50);
}
function loadBar(k) { const b = $('loadBar'); if (b) b.style.width = Math.round(Math.max(0, Math.min(1, k)) * 100) + '%'; const t = $('loadPct'); if (t) t.textContent = Math.round(k * 100) + ' %'; }
function toMenu() {
  $('menu').hidden = false; UI.mPage = 'home';
  appOrient(false);
  menuRender();
  startAttract();
}
/* Mehrspieler: Runden rechnen, sobald die Befehle beider Geräte da sind. Wer zurückliegt, holt mit Extrarunden auf. */
function mpFrame(g, dt) {
  _acc += dt;
  const t0 = performance.now();
  let n = 0, starved = false;
  while (n < 8 && !g.over) {
    if (_acc < STEP && (mpBehind(g) < 2 || performance.now() - t0 > 8)) break;
    if (!mpReady(g)) { starved = true; if (_acc > STEP) _acc = STEP; break; }
    mpStep(g); n++;
    _acc = Math.max(0, _acc - STEP);
    if (UI.g !== g) break;
    if (g.ev.length) { UI.consume(g.ev); R.consume(g.ev); g.ev.length = 0; }
  }
  if (_acc > STEP * 3) _acc = STEP * 3;
  mpStallTick(starved, dt);
}
const PERF = { acc: 0, n: 0, slow: 0, done: false };
/* Leistungswächter: läuft 3D im Gefecht dauerhaft unter etwa 22 Bildern je Sekunde, einmalig auf 2D umschalten */
function perfWatch(dt) {
  if (PERF.done || !UI.g || UI.attract || UI.paused || !R.mode3d || SET.gfxUser || dt > 0.5 || document.hidden) return;
  PERF.acc += dt; PERF.n++;
  if (PERF.acc < 8) return;
  const avg = PERF.acc / PERF.n; PERF.acc = 0; PERF.n = 0;
  PERF.slow = avg > 1 / 40 ? PERF.slow + 1 : 0;
  if (PERF.slow >= 2) { PERF.done = true; perfHint(Math.round(1 / avg)); }
}
/* Fassung 23: unter 40 Bildern je Sekunde in 3D einen Wechsel auf 2D anbieten (nicht selbst umstellen) */
function perfHint(fps) {
  const el = document.createElement('div'); el.id = 'perfHint'; el.className = 'win';
  el.innerHTML = '<div>' + esc(L('3D läuft hier mit nur {0} Bildern je Sekunde. 2D ist auf diesem Gerät flüssiger.', fps)) + '</div><div class="row"><button class="key" id="phYes">' + esc(L('Auf 2D wechseln')) + '</button><button class="key" id="phNo">' + esc(L('3D behalten')) + '</button></div>';
  document.body.appendChild(el);
  const close = () => { el.remove(); SET.gfxUser = true; savePrefs(); };
  el.querySelector('#phYes').addEventListener('click', () => { SET.gfx = '2d'; applySet(); close(); toast(L('Auf 2D umgestellt (Einstellungen → Grafik).'), 'good', 3500); });
  el.querySelector('#phNo').addEventListener('click', close);
  setTimeout(() => { if (el.isConnected) el.remove(); }, 20000);
}
/* Fassung 24: Bildratenanzeige (Einstellung »Bildrate anzeigen«) und Rückfall von Ultra auf Hoch bei Dauereinbruch */
let _fpsT = 0, _fpsN = 0, _ultraLow = 0, _gpu = null, _gpuWarn = false;
function fpsMeter(t) {
  _fpsN++; if (!_fpsT) { _fpsT = t; return; }
  const span = t - _fpsT; if (span < 1000) return;
  const fps = Math.round(_fpsN * 1000 / span); _fpsT = t; _fpsN = 0;
  const box = document.getElementById('fpsBox');
  if (box && box.hidden === !!SET.fps) box.hidden = !SET.fps;
  if (box && SET.fps) {
    let q = SET.qual === 'ultra' ? 'Ultra' : SET.qual === 'low' ? L('Sparsam') : L('Hoch');
    if (R.mode3d && typeof RA3D !== 'undefined' && RA3D.quality) { try { const k = RA3D.quality(); q += ' · 3D ×' + k.scale.toFixed(2) + (k.bloom ? ' · Bloom' : ''); } catch (e) { /* nichts */ } } else q += ' · 2D';
    if (!_gpu && R.mode3d && RA3D.gpu) _gpu = RA3D.gpu();
    const gn = _gpu && _gpu.name ? _gpu.name.replace(/^ANGLE \(|\)$/g, '').replace(/Direct3D11.*|vs_\d.*|\(0x[0-9A-F]+\)/gi, '').slice(0, 60) : '';
    box.textContent = fps + ' FPS · ' + q + (gn ? ' · ' + gn : ''); box.className = fps < 25 ? 'bad' : fps < 40 ? 'slow' : '';
  }
  /* Ohne Hardwarebeschleunigung (Software-Rasterung) einmal deutlich darauf hinweisen */
  if (!_gpuWarn && R.mode3d && RA3D.gpu && UI.g && !UI.attract) { _gpuWarn = true; const gi = _gpu || RA3D.gpu(); if (gi && gi.soft) toast(L('Der Browser rechnet die 3D-Grafik ohne Grafikkarte. Bitte in den Browser-Einstellungen die Hardwarebeschleunigung einschalten – oder 2D wählen.'), 'bad', 9000); }
  /* Ultra: fünf Sekunden in Folge unter 40 Bildern im laufenden Spiel → zurück auf Hoch (Ultra soll nur flüssig laufen) */
  const live = UI.g && !UI.g.over && !UI.paused && !UI.attract && SET.pwr !== 'save';
  if (SET.qual === 'ultra' && live && !window.__RA_TEST && !SET.hold) { _ultraLow = fps < 40 ? _ultraLow + 1 : 0; if (_ultraLow >= 5) { _ultraLow = 0; SET.qual = 'auto'; applySet(); savePrefs(); toast(L('Ultra ist für dieses Gerät zu viel – Qualität auf Hoch gestellt. Wer Ultra trotzdem will: Einstellungen → Qualität bei niedriger Bildrate → Halten.'), '', 6000); } } else _ultraLow = 0;
}
function frame(t) {
  requestAnimationFrame(frame);
  /* Stromsparen: höchstens etwa 30 Bilder je Sekunde */
  if (SET.pwr === 'save' && t - _last < 31) return;
  let dt = (t - _last) / 1000;
  _last = t;
  perfWatch(dt); fpsMeter(t);
  if (!(dt > 0)) dt = 0.016;
  if (dt > 0.1) dt = 0.1;
  if (UI.cqOpen) { cqFrame(dt); MUS.tick(); return; }
  if (UI.loading) return;   /* Fassung 24: Ladebildschirm */
  const g = UI.g;
  if (!g) return;
  /* Fassung 22: aktive Pause (UI.apause, play.js) hält nur die Simulation an – Kamera und Bedienung bleiben */
  const live = !UI.paused && !UI.askOpen, run = live && !UI.apause, mp = UI.kind === 'mp' && NET.live;
  if (run && mp) mpFrame(g, dt);
  else if (run) {
    const speed = UI.attract ? (g.time < 200 ? 6 : 1.5) : (UI.speed || 1) * (UI.slow ? 0.15 : 1) * (UI.slowmo || 1);   /* Fassung 22: Zeitlupe (play.js) */
    _acc += dt * speed;
    let n = 0;
    const maxN = UI.attract ? 8 : 4;
    while (_acc >= STEP && n < maxN) {
      stepGame(g); n++; _acc -= STEP;
      if (g.ev.length) { if (!UI.attract) UI.consume(g.ev); R.consume(g.ev); g.ev.length = 0; }
    }
    if (_acc > STEP * 2) _acc = 0;
  }
  if (live) {
    if (UI.attract) {
      if (g.over || g.time > 1500) { startAttract(); return; }
      const cam = R.cam, vw = R.cssW / cam.z, vh = R.cssH / cam.z;
      let tx, ty;
      if (R.lastAct && R.time - R.lastAct.t < 7) { tx = R.lastAct.x; ty = R.lastAct.y; }
      else { const p = g.players[Math.floor(R.time / 12) % g.players.length].start; tx = p.x; ty = p.y; }
      const k = Math.min(1, dt * 0.5);
      cam.x += (tx - vw / 2 - cam.x) * k; cam.y += (ty - vh / 2 - cam.y) * k;
      R.clampCam();
    } else {
      pinchApply();
      const ks = UI.keys, sp = 620 * dt / R.cam.z;
      let mx = 0, my = 0;
      if (ks.KeyA || ks.ArrowLeft) mx -= 1; if (ks.KeyD || ks.ArrowRight) mx += 1;
      if (ks.KeyW || ks.ArrowUp) my -= 1; if (ks.KeyS || ks.ArrowDown) my += 1;
      if (mx || my) { R.cam.x += mx * sp; R.cam.y += my * sp; R.clampCam(); }
    }
  }
  R.frame(run ? dt : 0.0001, run ? dt : 0);
  misUiFrame(dt, run && !UI.attract);
  MUS.tick();
  if (!UI.attract) {
    if (t - _miniT > 150) { _miniT = t; R.drawMini(); }
    if (t - _hudT > 130) { _hudT = t; hudUpdate(); }
    if (run && t - UI.saveAt > AUTOSAVE_MS) { UI.saveAt = t; saveNow(); }
    /* Bildzeiten: läuft das Spiel zu langsam, Zierrat sparen, dann die Auflösung senken (nur 2D; der 3D-Renderer regelt selbst) */
    if (run) { _fAcc += dt; _fN++; }
    if (_fN >= 90 || (_fN >= 12 && _fAcc > 1.5)) {
      const avg = _fAcc / _fN; _fAcc = 0; _fN = 0;
      if (!window.__RA_TEST && SET.qual === 'auto' && !R.mode3d && avg > 0.026) { if (R.detail > 1) { R.detail = 1; if (R.mode3d) RA3D.setDetail(1); } else if (R.qScale > 0.55) { R.qScale = Math.max(0.5, R.qScale - 0.17); R.resize(); } }
    }
  }
}
(function boot() {
  R.init($('view'), $('mini'), $('view3d'));
  loadPrefs();
  setLang(SET.lang);
  initInput();
  initHudStatic();
  initSettings();
  initMp();
  initCampaign();
  initConquest();
  appInit(); fbInit(); hpInit(); rpInit(); progInit();
  plInit();       /* Fassung 22: Spielhilfen (play.js) */
  initEditor();   /* KARTENEDITOR (editor.js): eigene Karten eintragen, Knopf im Hauptmenü */
  applySet();
  $('mSkirm').addEventListener('click', () => { SND.init(); SND.play('click'); if (MENU.mode !== 'skirmish') { MENU.mode = 'skirmish'; } menuPage('setup'); });
  $('mWaves').addEventListener('click', () => { SND.init(); SND.play('click'); if (MENU.mode === 'skirmish') MENU.mode = 'quarantine'; menuPage('setup'); });
  $('mBack').addEventListener('click', () => { SND.play('click'); menuPage('home'); });
  $('mStart').addEventListener('click', () => { SND.init(); launch(startSkirmish); });
  $('mCont').addEventListener('click', () => { SND.init(); launch(() => continueGame()); });
  $('mLoad').addEventListener('click', () => { SND.init(); SND.play('click'); openLoad(); });
  $('loadClose').addEventListener('click', () => { $('loadWin').hidden = true; SND.play('click'); });
  for (const n of [1, 2, 3]) $('pSave' + n).addEventListener('click', () => { const ok = saveSlot(n); toast(ok ? L('Gespeichert in Platz {0}.', n) : L('Hier kann nicht gespeichert werden.'), ok ? 'good' : 'warn', 2500); SND.play(ok ? 'click' : 'err'); pauseSlots(); });
  $('mSandbox').addEventListener('click', () => { SND.init(); launch(startSandbox); });
  $('pRestart').addEventListener('click', () => launch(() => beginGame(UI.opts, UI.kind)));
  $('pQuit').addEventListener('click', () => { if (UI.kind === 'mp' && NET.live) mpLeave(); if (UI.kind === 'mis') { toCampaign(); return; } if (UI.kind === 'cq') { cqRetreat(); return; } toMenu(); });
  $('eAgain').addEventListener('click', () => { if (UI.kind === 'mp') { mpToLobby(); return; } launch(() => beginGame(UI.opts, UI.kind)); });
  $('eMenu').addEventListener('click', () => { if (UI.kind === 'mp' && NET.open) mpLeave(); if (UI.kind === 'mis') { toCampaign(); return; } toMenu(); });
  const fsOk = !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  const enterFs = quiet => {
    try {
      const pr = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (pr && pr.then) pr.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => { if (!quiet) toast(L('Vollbild ist hier nicht verfügbar'), 'warn'); });
    } catch (e) { /* nicht verfügbar */ }
  };
  const toggleFs = () => { if (document.fullscreenElement) { UI.fsOff = true; try { document.exitFullscreen().catch(() => {}); } catch (e) { /* egal */ } } else { UI.fsOff = false; UI.fsPause = false; enterFs(false); } };
  for (const id of ['mFull', 'pFull']) { $(id).hidden = !fsOk; $(id).addEventListener('click', e => { e.stopPropagation(); toggleFs(); }); }
  let fsWas = false;
  document.addEventListener('click', e => {
    if (e.pointerType ? e.pointerType === 'mouse' : UI.mouse) return;
    if (e.target && e.target.closest && e.target.closest('#mStart,#mCont,#eAgain,#pRestart')) UI.fsPause = false;
    if (fsOk && !UI.fsOff && !UI.fsPause && !document.fullscreenElement) enterFs(true);
  }, true);
  if (fsOk) document.addEventListener('fullscreenchange', () => { const on = !!document.fullscreenElement; if (fsWas && !on && !UI.fsOff) UI.fsPause = true; fsWas = on; setTimeout(layout, 120); });
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 250));
  if (window.ResizeObserver) new ResizeObserver(() => { if (!$('hud').hidden) layout(); }).observe($('bottom'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (UI.g && !UI.attract && !UI.endShown && UI.kind !== 'mp') { setPaused(true); try { saveNow(); } catch (e) { /* Speichern optional */ } } SND.sleep(); } else { SND.wake(); if (UI.g && !UI.attract) keepAwake(); } });
  window.addEventListener('pagehide', () => { if (!UI.paused) saveNow(); });
  document.addEventListener('gesturestart', e => e.preventDefault());
  window.RA = { I18N, setLang, langRefresh, L, T, UI, R, MENU, SET, NET, MPL, MPU, CAMP, RADIO, CQS, cqOpen, cqLoad, cqSave, cqClose, cqLeave, mpPack, mpUnpack, mpOpen, beginGame, startSkirmish, saveNow, clearSave, continueGame, issue, toMenu, misStart, openBrief, campRender, menuPage, step(n) { const g = UI.g; for (let i = 0; i < n && !g.over; i++) { stepGame(g); if (g.ev.length) { if (!UI.attract) UI.consume(g.ev); R.consume(g.ev); g.ev.length = 0; } } } };
  menuRender();
  startAttract();
  requestAnimationFrame(frame);
})();
