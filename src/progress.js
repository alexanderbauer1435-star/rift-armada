/* ===== progress.js ===== */
'use strict';
/* FORTSCHRITT – Abzeichen, Erfahrung und Rang, Statistik je Fraktion, Tagesaufgabe, Flottenfarben.
   Alles lokal (ra.prog), nichts davon ändert die Simulation: ausgewertet wird am Ende einer Partie (Gefecht, Wellen,
   Mehrspieler) aus dem Spielstand und aus Ereignissen, die die Bedienung mitzählt. Meldungen nur als kleine Hinweise. */
const PROG = { d: null, track: null };
const BADGES = [
  { id: 'first', name: 'Erster Sieg', desc: 'Gewinne ein Gefecht.' },
  { id: 'f_alliance', name: 'Admiral der Allianz', desc: 'Gewinne mit The Alliance.' },
  { id: 'f_mars', name: 'Roter Marschall', desc: 'Gewinne mit Martian Republic.' },
  { id: 'f_legion', name: 'Goldene Lanze', desc: 'Gewinne mit Golden Legion.' },
  { id: 'f_nexus', name: 'Einheit des Nexus', desc: 'Gewinne mit The Nexus.' },
  { id: 'f_brood', name: 'Mutter der Brut', desc: 'Gewinne mit The Brood.' },
  { id: 'hard', name: 'Gegen die Besten', desc: 'Besiege eine KI auf Schwer.' },
  { id: 'odds', name: 'Gegen die Übermacht', desc: 'Gewinne gegen drei oder mehr Gegner.' },
  { id: 'blitz', name: 'Blitzsieg', desc: 'Gewinne in unter 15 Minuten.' },
  { id: 'fortress', name: 'Unberührt', desc: 'Gewinne, ohne eine Station zu verlieren.' },
  { id: 'ace', name: 'Flottenschreck', desc: '50 Abschüsse in einer Partie.' },
  { id: 'flank', name: 'Heckschütze', desc: '25 Treffer von hinten in einer Partie.' },
  { id: 'salvage', name: 'Schrottsammler', desc: 'Berge 1000 Erz aus Wracks in einer Partie.' },
  { id: 'super', name: 'Letztes Wort', desc: 'Setze eine Superwaffe ein.' },
  { id: 'keep', name: 'Piratenschreck', desc: 'Erobere oder zerstöre die Piratenfestung.' },
  { id: 'team', name: 'Waffenbrüder', desc: 'Gewinne mit einem Verbündeten im Team.' },
  { id: 'waves20', name: 'Das Siegel hält', desc: 'Überlebe 20 Wellen.' },
  { id: 'daily', name: 'Tagwerk', desc: 'Schließe eine Tagesaufgabe ab.' },
  { id: 'daily7', name: 'Dienstplan', desc: 'Schließe sieben Tagesaufgaben ab.' },
  { id: 'all5', name: 'Herr des Kessels', desc: 'Gewinne mit allen fünf Fraktionen.' }
];
/* Flottenfarben: freigeschaltet über den Rang */
const PROG_COLS = [['', 1, 'Fraktion'], ['#4fe3e3', 2, 'Türkis'], ['#ff7bd1', 3, 'Magenta'], ['#f2c14e', 4, 'Gold'], ['#5ddc8a', 5, 'Smaragd'], ['#c9a0ff', 6, 'Flieder'], ['#ff6a3d', 8, 'Glut'], ['#f4f1e6', 10, 'Elfenbein']];
function progLoad() {
  if (PROG.d) return PROG.d;
  let d = null; try { d = JSON.parse(localStorage.getItem('ra.prog') || 'null'); } catch (e) { d = null; }
  if (!d || typeof d !== 'object') d = {};
  d.xp = d.xp || 0; d.badges = d.badges || {}; d.fs = d.fs || {}; d.daily = d.daily || {}; d.dailyN = d.dailyN || 0; d.col = d.col || '';
  PROG.d = d; return d;
}
function progSave() { try { localStorage.setItem('ra.prog', JSON.stringify(PROG.d)); } catch (e) { /* Speicher gesperrt */ } }
function progLevel(xp) { return Math.floor(Math.sqrt(xp / 120)) + 1; }
function progLvXp(lv) { return (lv - 1) * (lv - 1) * 120; }
/* Tagesaufgabe: aus dem Datum abgeleitet (für alle gleich), Saat fest → dieselbe Karte für jeden */
function progDay() { const t = new Date(); return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate(); }
function progDaily() {
  const day = progDay(); let h = day * 2654435761 >>> 0; const r = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const maps = ['expanse', 'bastions', 'keep', 'haven', 'twingates', 'crown', 'narrows', 'arena', 'maelstrom', 'pinwheel', 'archipelago'].filter(m => MAPS[m]);
  const f = PLAYABLE[(r() * PLAYABLE.length) | 0], foes = PLAYABLE.filter(x => x !== f), n = 1 + ((r() * 3) | 0), lvl = n === 1 ? 3 : 2;
  const opp = []; for (let i = 0; i < n; i++) opp.push(foes.splice((r() * foes.length) | 0, 1)[0]);
  const map = maps[(r() * maps.length) | 0], twist = ['', 'blitz', 'fortress'][(r() * 3) | 0];
  return { day, f, opp, lvl, map, seed: 1 + (day % 999983), twist };
}
function progDailyText(q) {
  const tw = q.twist === 'blitz' ? ' ' + L('in unter 20 Minuten') : q.twist === 'fortress' ? ' ' + L('ohne eine Station zu verlieren') : '';
  return L('Gewinne mit {0} auf {1} gegen {2}{3}', L(FACTIONS[q.f].name), L(MAPS[q.map].name), q.opp.map(f => L(FACTIONS[f].name)).join(', ') + ' (' + L(AI_LEVELS[q.lvl].name) + ')', tw);
}
function progStartDaily() {
  const q = progDaily(), np = 1 + q.opp.length, map = typeof mapFor === 'function' ? mapFor(q.map, np) : q.map;
  const players = [{ faction: q.f, human: true, team: 0 }].concat(q.opp.map((f, i) => ({ faction: f, ai: q.lvl, team: 1 + i, color: null })));
  const facs = players.map(p => p.faction); if (facs.some((f, i) => facs.indexOf(f) !== i)) players.forEach((p, i) => { p.color = SLOT_COLS[i]; });
  $('profWin').hidden = true;
  launch(() => beginGame({ map, seed: q.seed, players, pace: 'tactical', daily: q.day }, 'skirmish'));
}
/* ---------------- Mitzählen während der Partie ---------------- */
function progTrack(evs) {
  const T = PROG.track, g = UI.g; if (!T || T.g !== g || UI.kind === 'replay') return;
  for (const e of evs) {
    if (e.t === 'flank' && e.owner === UI.me) T.flank++;
    else if (e.t === 'superfire' && e.owner === UI.me) T.super = 1;
    else if (e.t === 'deliver' && e.owner === UI.me && e.sal) T.sal += e.amt || 0;
  }
}
/* ---------------- Auswertung am Ende ---------------- */
function progEnd() {
  const g = UI.g, P = UI.P; if (!g || !P || g.mis || g.cq || UI.kind === 'replay' || UI.kind === 'sandbox') return null;
  const d = progLoad(), T = PROG.track && PROG.track.g === g ? PROG.track : { flank: 0, super: 0, sal: 0 };
  const won = g.winTeam === P.team, min = g.time / 60, foes = g.players.filter(q => !q.neutral && !q.pirate && !q.threat && q.team !== P.team), allies = g.players.filter(q => q !== P && !q.neutral && !q.threat && q.team === P.team);
  const got = [], give = id => { if (!d.badges[id]) { d.badges[id] = Date.now(); got.push(id); } };
  const fs = d.fs[P.faction] || (d.fs[P.faction] = { n: 0, won: 0, t: 0, kills: 0 }); fs.n++; fs.t += Math.round(g.time); fs.kills += P.stats.kills || 0; if (won) fs.won++;
  if (won && !g.wave) {
    give('first'); give('f_' + P.faction);
    if (foes.some(q => q.ai && q.ai.lvl >= 3)) give('hard');
    if (foes.length >= 3) give('odds');
    if (min < 15) give('blitz');
    if (!P.stats.bLost) give('fortress');
    if (allies.length) give('team');
    if (PLAYABLE.every(f => d.badges['f_' + f])) give('all5');
  }
  if ((P.stats.kills || 0) >= 50) give('ace');
  if (T.flank >= 25) give('flank');
  if (T.sal >= 1000) give('salvage');
  if (T.super) give('super');
  if (g.fort && g.fort.by === UI.me) give('keep');
  if (g.wave && g.wave.cleared >= 20) give('waves20');
  /* Tagesaufgabe */
  let daily = false; const q = progDaily();
  if (won && g.opts && g.opts.daily === q.day && d.daily.done !== q.day && (q.twist !== 'blitz' || min < 20) && (q.twist !== 'fortress' || !P.stats.bLost)) { d.daily.done = q.day; d.dailyN++; daily = true; give('daily'); if (d.dailyN >= 7) give('daily7'); }
  const lv0 = progLevel(d.xp), xp = Math.round(40 + (won ? 120 : 0) + Math.min(200, (P.stats.kills || 0) * 2) + Math.min(30, min) * 4 + got.length * 60 + (daily ? 250 : 0));
  d.xp += xp; progSave();
  const lv1 = progLevel(d.xp);
  return { xp, lv0, lv1, got, daily };
}
function progEndUi(r) {
  const box = $('endProg'); if (!box) return; box.hidden = !r; if (!r) return;
  const d = progLoad(), lv = r.lv1, a = progLvXp(lv), b = progLvXp(lv + 1);
  let h = '<div class="pgRow"><b>' + L('Rang {0}', lv) + '</b><span>+' + r.xp + ' ' + L('Erfahrung') + '</span></div>' + '<div class="pgBar"><i></i></div>';
  if (r.got.length) h += '<div class="pgBadges">' + r.got.map(id => { const B = BADGES.find(x => x.id === id); return '<span class="pgB on">★ ' + esc(L(B.name)) + '</span>'; }).join('') + '</div>';
  if (r.lv1 > r.lv0) { const c = PROG_COLS.find(x => x[1] === r.lv1); h += '<p class="fine">' + L('Neuer Rang!') + (c ? ' ' + L('Flottenfarbe freigeschaltet: {0}', L(c[2])) : '') + '</p>'; }
  if (r.daily) h += '<p class="fine good">' + L('Tagesaufgabe geschafft!') + '</p>';
  box.innerHTML = h; box.querySelector('.pgBar i').style.width = Math.round(100 * (d.xp - a) / (b - a)) + '%';
}
/* ---------------- Profilfenster ---------------- */
function progRender() {
  const d = progLoad(), lv = progLevel(d.xp), a = progLvXp(lv), b = progLvXp(lv + 1);
  $('pgHead').innerHTML = '<div class="pgRow"><b>' + L('Rang {0}', lv) + '</b><span>' + fmt(d.xp) + ' / ' + fmt(b) + ' ' + L('Erfahrung') + '</span></div>' + '<div class="pgBar"><i></i></div>';
  $('pgHead').querySelector('.pgBar i').style.width = Math.round(100 * (d.xp - a) / (b - a)) + '%';
  const q = progDaily(), done = d.daily.done === q.day;
  $('pgDaily').textContent = progDailyText(q) + (done ? ' ✓' : '');
  $('pgDailyGo').textContent = L(done ? 'Nochmal spielen' : 'Starten');
  const n = Object.keys(d.badges).length;
  $('pgBadgeN').textContent = n + ' / ' + BADGES.length;
  $('pgBadges').innerHTML = BADGES.map(B => (d.badges[B.id] ? '<div class="pgB on"><b>★ ' : '<div class="pgB"><b>☆ ') + esc(L(B.name)) + '</b><span>' + esc(L(B.desc)) + '</span></div>').join('');
  let t = '<span></span><b>' + L('Partien') + '</b><b>' + L('Siege') + '</b><b>' + L('Abschüsse') + '</b><b>' + L('Spielzeit') + '</b>';
  for (const f of PLAYABLE) { const s = d.fs[f] || { n: 0, won: 0, t: 0, kills: 0 }; t += '<span style="color:' + FACTIONS[f].team + '">' + esc(L(FACTIONS[f].name)) + '</span><span>' + s.n + '</span><span>' + s.won + (s.n ? ' (' + Math.round(100 * s.won / s.n) + ' %)' : '') + '</span><span>' + s.kills + '</span><span>' + clock(s.t) + '</span>'; }
  $('pgStats').innerHTML = t;
  const cb = $('pgCols'); cb.innerHTML = '';
  for (const [c, need, nm] of PROG_COLS) {
    const el = document.createElement('button'); el.className = 'pgC' + (d.col === c ? ' on' : ''); el.title = L(nm) + (lv < need ? ' · ' + L('ab Rang {0}', need) : '');
    if (c) el.style.background = c; else el.classList.add('fac'); el.disabled = lv < need; if (lv < need) el.textContent = need;
    el.addEventListener('click', () => { d.col = c; progSave(); progRender(); });
    cb.appendChild(el);
  }
}
function progInit() {
  progLoad();
  $('mProfile').addEventListener('click', () => { progRender(); $('profWin').hidden = false; SND.play('click'); });
  $('pgClose').addEventListener('click', () => { $('profWin').hidden = true; });
  $('pgDailyGo').addEventListener('click', progStartDaily);
  /* eigene Flottenfarbe im Gefecht und in den Wellen (nicht im Mehrspieler: dort entscheidet die Lobby) */
  const bg = beginGame; beginGame = function (opts, kind, saved, seat) {
    const d = progLoad();
    if (!saved && d.col && opts && (kind === 'skirmish' || kind === 'waves') && Array.isArray(opts.players)) {
      const me = opts.players.find(p => p.human); if (me && !opts.players.some(p => p !== me && p.color === d.col)) me.color = d.col;
    }
    const r = bg.apply(this, arguments);
    PROG.track = { g: UI.g, flank: 0, super: 0, sal: 0 };
    return r;
  };
  const cons = UI.consume; UI.consume = function (evs) { progTrack(evs); return cons.call(this, evs); };
  const se = showEnd; showEnd = function () { const was = UI.endShown; se(); if (!was && UI.endShown) { let r = null; try { r = progEnd(); } catch (e) { r = null; } progEndUi(r); } };
}
