/* ===== play.js ===== */
'use strict';
/* SPIELHILFEN (Fassung 22) – kleine Erleichterungen ohne Vollbild-Meldungen:
   · Werft: Doppeltippen (oder Umschalt-Klick) reiht 5 Schiffe ein, so viele Mittel, Kommandopunkte und Platz reichen;
     Tippen auf die Zahl am Schiff (oder Rechtsklick) nimmt eines heraus
   · Sammeln bei Gruppe: neue Kampfschiffe treten der zuletzt gewählten Gruppe 1–5 bei und fliegen zu ihr (Befehl 'grally',
     die Simulation entscheidet – gleich im Mehrspieler und in Wiederholungen)
   · Pause mit Befehlen (nur allein): die Simulation steht, Kamera, Auswahl und Befehle gehen weiter; Befehle tragen den
     Takt der Pause und laufen so in der Wiederholung an derselben Stelle
   · Zeitlupe bei Großgefechten (nur allein, Vorgabe aus): ab etwa 12 kämpfenden Schiffen im Bild sanft auf halbes Tempo
   · Untätig-Hinweise: Frachter und Bauschiffe ohne Auftrag, Werften mit leerer Warteschlange; Tippen wählt sie aus */
const PL = { tapK: '', tapT: 0, idleT: 0, idleSig: '', cyc: { cargo: -1, yard: -1, build: -1 }, cycT: { cargo: 0, yard: 0, build: 0 }, smT: 0, smHot: false, smCalm: 0, smLast: 0 };
const PL_SLOW = 0.5, PL_HOT = 12, PL_CALM = 8;

/* ---------------- Warteschlange ×5 ---------------- */
/* wie viele Schiffe dieses Typs passen noch (Platz, Kommandopunkte, Mittel) – höchstens want */
function plMaxTrain(b, d, want) {
  const P = UI.P, g = UI.g;
  if (trainReq(g, UI.me, d.id) || b.lv < d.yard) return 0;
  let n = Math.min(want, 5 - b.q.length);
  if (d.cp > 0) n = Math.min(n, Math.floor((P.cpMax - P.cpUse - P.queued) / d.cp));
  const c = cost(shipCost(P, d));
  let ice = P.ice, ore = P.ore, k = 0;
  while (k < n && ice >= c.ice && ore >= c.ore) { ice -= c.ice; ore -= c.ore; k++; }
  return Math.max(0, k);
}
function plTrain(b, d, e) {
  if (e && e.target && e.target.closest && e.target.closest('.q')) { if (plUnqueue(b, d)) { SND.play('click'); return; } }
  const now = performance.now(), key = b.id + ':' + d.id, dbl = PL.tapK === key && now - PL.tapT < 420;
  const many = !!(e && e.shiftKey) || dbl;
  PL.tapK = key; PL.tapT = dbl ? 0 : now;
  if (!many) { const r = issue({ t: 'train', b: b.id, id: d.id }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('click'); hudBuild(); } return; }
  /* Doppeltippen: das erste Tippen hat schon eines eingereiht */
  const n = plMaxTrain(b, d, dbl ? 4 : 5);
  if (!n) { const r = issue({ t: 'train', b: b.id, id: d.id }); if (r) { toast(L(r), 'warn'); SND.play('err'); } else { SND.play('click'); hudBuild(); } return; }
  let ok = 0;
  for (let i = 0; i < n; i++) { if (issue({ t: 'train', b: b.id, id: d.id })) break; ok++; }
  const tot = UI.g.net ? ok + (dbl ? 1 : 0) : b.q.filter(q => q.id === d.id).length;
  showInfo(L('{0} × {1} in der Warteschlange', tot, L(d.name)), 1800);
  SND.play('click'); hudBuild(true);
}
/* das letzte Schiff dieses Typs aus der Warteschlange nehmen; true, wenn eines drin war */
function plUnqueue(b, d) {
  let i = -1;
  for (let k = b.q.length - 1; k >= 0; k--) if (b.q[k].id === d.id) { i = k; break; }
  if (i < 0) return false;
  issue({ t: 'cancel', b: b.id, i });
  hudBuild(true);
  return true;
}

/* ---------------- Sammeln bei der aktiven Gruppe ---------------- */
function plGrallySync(say) {
  const g = UI.g, P = UI.P; if (!g || !P || UI.attract || UI.kind === 'replay') return;
  const want = SET.grally ? (UI.grpAct | 0) : 0;
  if ((P.grally | 0) !== want) { issue({ t: 'grally', n: want }); if (say && want) toast(L('Neue Kampfschiffe sammeln bei Gruppe {0}', want), '', 2500); }
  plGrpMark();
}
function plGrpMark() { document.querySelectorAll('.grp').forEach(el => el.classList.toggle('act', !!SET.grally && UI.grpAct === +el.dataset.g)); }
function plGrpChosen(i) {
  if (UI.grpAct === i) return;
  UI.grpAct = i;
  plGrallySync(true);
}

/* ---------------- Pause mit Befehlen ---------------- */
function plApOk() { return !!(UI.g && !UI.attract && UI.kind !== 'mp' && UI.kind !== 'replay' && SET.apause !== false && !UI.endShown); }
function plSetAP(on) {
  on = !!on && plApOk();
  if (UI.apause === on) { plQpUpdate(); return; }
  UI.apause = on;
  SND.play('click');
  plQpUpdate();
}
function plQpUpdate() {
  const ok = plApOk(), b = $('bQPause');
  if (!ok && UI.apause) UI.apause = false;
  b.hidden = !ok; b.classList.toggle('on', !!UI.apause);
  $('apBanner').hidden = !UI.apause;
  $('hud').classList.toggle('ap', !!UI.apause);
}

/* ---------------- Zeitlupe ---------------- */
function plSlowOk() { return !!(SET.slowmo && UI.g && !UI.attract && UI.kind !== 'mp' && UI.kind !== 'replay' && !UI.paused && !UI.apause); }
function plFighters() {
  const g = UI.g, t = g.time; let n = 0;
  for (const u of g.ships) {
    if (u.dead || u.derelict || u.def.role === 'fighter' || !R.inView(u.x, u.y, 0)) continue;
    if (u.owner !== UI.me && !R.visible(u)) continue;
    if (t - (u.hitT || -99) < 2.5 || u.beams) n++;
  }
  return n;
}
function plSlowFrame() {
  const now = performance.now(), dt = Math.min(0.1, (now - (PL.smLast || now)) / 1000); PL.smLast = now;
  if (!plSlowOk()) { PL.smHot = false; UI.slowmo = UI.apause || UI.paused ? (UI.slowmo || 1) : Math.min(1, (UI.slowmo || 1) + dt * 1.5); }
  else {
    if (now - PL.smT > 400) {
      PL.smT = now;
      const n = plFighters();
      if (n >= PL_HOT) { PL.smHot = true; PL.smCalm = now; }
      else if (PL.smHot && n < PL_CALM && now - PL.smCalm > 2500) PL.smHot = false;
      else if (n >= PL_CALM) PL.smCalm = now;
    }
    const tgt = PL.smHot ? PL_SLOW : 1, cur = UI.slowmo || 1;
    UI.slowmo = cur + (tgt - cur) * Math.min(1, dt * 2.2);
    if (Math.abs(UI.slowmo - tgt) < 0.01) UI.slowmo = tgt;
  }
  if (!UI.g || UI.attract) UI.slowmo = 1;
  const tag = $('slowTag'), show = (UI.slowmo || 1) < 0.97;
  if (tag.hidden === show) tag.hidden = !show;
}

/* ---------------- Untätig-Hinweise ---------------- */
function plIdleLists() {
  const g = UI.g, me = UI.me, out = { cargo: [], yard: [], build: [] };
  for (const u of g.ships) {
    if (u.dead || u.derelict || u.owner !== me) continue;
    if (u.o.t !== 'idle') continue;
    if (u.def.cargo) out.cargo.push(u); else if (u.def.build) out.build.push(u);
  }
  for (const b of g.bldgs) if (!b.dead && b.owner === me && b.role === 'yard' && b.done && !b.q.length && !b.off) out.yard.push(b);
  return out;
}
const PL_IDLE_TXT = { cargo: ['1 Frachter', '{0} Frachter'], yard: ['1 Werft', '{0} Werften'], build: ['1 Bauschiff', '{0} Bauschiffe'] };
function plIdle(force) {
  const box = $('idle'), g = UI.g;
  const off = !g || UI.attract || UI.kind === 'replay' || !UI.P || !UI.P.alive || UI.endShown || HP.teamOpen;
  if (off) { box.hidden = true; PL.idleSig = ''; return; }
  const now = performance.now();
  if (!force && now - PL.idleT < 1000) return;
  PL.idleT = now;
  const ls = plIdleLists(), keys = ['cargo', 'yard', 'build'].filter(k => ls[k].length);
  PL.idle = ls;
  const sig = I18N.lang + '|' + keys.map(k => k + ls[k].length).join('|');
  if (sig === PL.idleSig) return;
  PL.idleSig = sig;
  box.hidden = !keys.length;
  while (box.children.length > 1) box.lastChild.remove();
  setText(box.firstChild, L('Untätig') + ':');
  for (const k of keys) {
    const n = ls[k].length, b = document.createElement('button');
    b.className = 'idC'; b.dataset.k = k;
    b.textContent = n === 1 ? L(PL_IDLE_TXT[k][0]) : L(PL_IDLE_TXT[k][1], n);
    b.addEventListener('click', () => plIdleTap(k));
    box.appendChild(b);
  }
}
function plIdleTap(k) {
  const ls = plIdleLists()[k]; if (!ls.length) { plIdle(true); return; }
  const now = performance.now(), again = now - PL.cycT[k] < 4000 && PL.cyc[k] >= 0;
  PL.cycT[k] = now;
  if (k === 'yard') {
    const i = again ? (PL.cyc[k] + 1) % ls.length : 0; PL.cyc[k] = i;
    const b = ls[i]; selBldg(b); R.center(b.x, b.y); SND.play('click'); hudBuild(true); return;
  }
  /* Schiffe: erst alle untätigen dieser Art, danach jedes einzeln der Reihe nach */
  if (!again) { PL.cyc[k] = 0; setSel(ls); R.center(ls[0].x, ls[0].y); SND.play('click'); return; }
  const i = (PL.cyc[k] + 1) % ls.length; PL.cyc[k] = i;
  setSel([ls[i]]); R.center(ls[i].x, ls[i].y); SND.play('click');
}

/* ---------------- Einbindung ---------------- */
function plInit() {
  $('bQPause').addEventListener('click', e => { e.stopPropagation(); plSetAP(!UI.apause); });
  $('apBanner').addEventListener('click', () => plSetAP(false));
  addEventListener('keydown', e => {
    if (!UI.g || UI.attract || UI.paused || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest('input,textarea')) return;
    if (e.code === 'Pause' || e.code === 'KeyQ') { if (plApOk()) { plSetAP(!UI.apause); e.preventDefault(); } }
  });
  /* Gruppenwahl merkt sich die aktive Gruppe */
  const gs = grpSelect; grpSelect = function (i) { const r = gs.apply(this, arguments); if (UI.g && UI.g.ships.some(u => !u.dead && u.owner === UI.me && u.grp === i)) plGrpChosen(i); return r; };
  const ga = grpAssign; grpAssign = function (i) { const had = UI.sel.size; const r = ga.apply(this, arguments); if (had) plGrpChosen(i); return r; };
  const rs = resetUi; resetUi = function () { const r = rs.apply(this, arguments); UI.apause = false; UI.slowmo = 1; UI.grpAct = 0; PL.smHot = false; PL.idleSig = ''; PL.cyc = { cargo: -1, yard: -1, build: -1 }; plGrpMark(); plQpUpdate(); $('idle').hidden = true; return r; };
  const hu = hudUpdate; hudUpdate = function () { hu.apply(this, arguments); plHud(); };
  const fr = R.frame; R.frame = function () { plSlowFrame(); return fr.apply(this, arguments); };
  /* Spielende und Menüpause: aktive Pause aufheben bzw. Knopf neu zeigen */
  const se = showEnd; showEnd = function () { const r = se.apply(this, arguments); if (UI.endShown) plSetAP(false); return r; };
  const lr = langRefresh; langRefresh = function () { const r = lr.apply(this, arguments); PL.idleSig = ''; plIdle(true); return r; };
}
function plHud() {
  if (UI.kind === 'replay' || UI.attract) { plIdle(); return; }
  /* nach dem Laden eines Spielstands: aktive Gruppe aus der Simulation übernehmen */
  if (UI.P && UI.P.grally && !UI.grpAct) { UI.grpAct = UI.P.grally; plGrpMark(); }
  plQpUpdate();
  plIdle();
}
