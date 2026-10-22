/* ===== campaign.js ===== */
'use strict';
/* =====================================================================
   KAMPAGNE (Oberfläche) – Kampagnenseite im Hauptmenü, Einsatzbesprechung, Titelkarte, Funk mit Porträt und Ziele
   im Gefecht, Entscheidungen, Kamerafahrten, Nachbesprechung und Fortschritt (localStorage 'ra.camp').
   Die Missionen selbst laufen deterministisch in mission.js / missions.js; hier wird nur angezeigt und befohlen.
   ===================================================================== */
const CAMP = { done: {}, ch: {}, lvl: 2, fac: 'alliance', all: false, last: '' };
const CAMP_KEY = 'ra.camp';
const MISUI = { brief: '', gh: '', cam: null, ask: '', fold: false, picT: 0 };
const RADIO = { q: [], cur: null, age: 0, shown: -1, log: [] };
const RADIO_CPS = 52, LVL_NAME = ['', 'Leicht', 'Normal', 'Schwer'];
/* Entscheidungen, wie die Chronik sie erzählt */
const CARRY_TXT = {
  save: { convoy: 'Haven rettete den Konvoi, die Torwache fiel.', gate: 'Haven hielt die Torwache, der Konvoi ging verloren.', both: 'Haven rettete Konvoi und Torwache.' },
  voss: { spare: 'Die Legion verschonte Ilya Voss.', kill: 'Die Legion tötete Ilya Voss.' },
  node: { live: 'Prime Facet ließ Knoten K-7 leben.', kill: 'Prime Facet löschte Knoten K-7.' },
  end: { seal: 'Die Tore wurden für immer versiegelt.', open: 'Die Tore blieben offen.' }
};
/* was eine frühere Entscheidung in dieser Mission bewirkt */
const CARRY_EFFECT = {
  a2m1: { save: { convoy: ['Der gerettete Konvoi bringt dir 1500 Eis und 800 Erz.'], gate: ['Die gehaltene Torwache schickt nach 90 Sekunden Verstärkung.'], both: ['Der gerettete Konvoi bringt dir 1500 Eis und 800 Erz.', 'Die gehaltene Torwache schickt nach 90 Sekunden Verstärkung.'] } },
  a5m1: { save: { convoy: ['Der Konvoi von Haven bringt 1500 Eis und 800 Erz.'], both: ['Der Konvoi von Haven bringt 1500 Eis und 800 Erz.'] },
    voss: { spare: ['Ilya Voss kommt mit ihrer Flotte zu Hilfe.'], kill: ['Ohne Voss schickt die Alliance niemanden.'] },
    node: { live: ['Knoten K-7 sieht das Tor für dich und warnt vor jedem Schwarm.'], kill: ['Ohne K-7 kommen die Schwärme ohne Vorwarnung.'] } }
};
function campLoad() { try { const d = JSON.parse(localStorage.getItem(CAMP_KEY) || '{}'); if (d && typeof d === 'object') { Object.assign(CAMP, d); CAMP.done = d.done || {}; CAMP.ch = d.ch || {}; } } catch (e) { /* kein Fortschritt */ } }
function campSave() { try { localStorage.setItem(CAMP_KEY, JSON.stringify(CAMP)); } catch (e) { /* Speicher gesperrt */ } }
function campUnlocked(id) { if (CAMP.all) return true; const A0 = campAct(id); if (A0 && A0.free) return true; const i = CAMP_ORDER.indexOf(id); return i <= 0 || !!CAMP.done[CAMP_ORDER[i - 1]]; }
function campNext(id) { if (id === 'tut') return CAMP.done.p1 ? '' : 'p1'; const i = CAMP_ORDER.indexOf(id); return i >= 0 && i < CAMP_ORDER.length - 1 ? CAMP_ORDER[i + 1] : ''; }
function campAct(id) { return CAMPAIGN.find(a => a.ms.indexOf(id) >= 0); }
function misLabel(id) {
  const A = campAct(id);
  if (!A) return '';
  if (A.id === 'p') return L('Prolog');
  if (A.id === 't') return L('Ausbildung');
  if (A.id === 'b') return L('Bonus');
  if (A.id === 'a5') return L('Finale');
  return A.id.slice(1) + '.' + (A.ms.indexOf(id) + 1);
}
/* »Akt 1: Haven · Mission 2«, beim Prolog, Finale und Bonus nur der Aktname */
function misHead(id) { const A = campAct(id), l = misLabel(id); return L(A.name) + (/^\d/.test(l) ? ' · ' + L('Mission {0}', l) : ''); }
function actColor(A) { const F = FACTIONS[A.f]; return F ? F.team : '#ffb86b'; }

/* ------------------------------------------------------------------ Kampagnenseite */
function campRender() {
  const box = $('campActs');
  box.textContent = '';
  const next = !CAMP.done.tut && !Object.keys(CAMP.done).length ? 'tut' : CAMP_ORDER.find(id => !CAMP.done[id] && campUnlocked(id));
  for (const A of CAMPAIGN) {
    const row = document.createElement('div'), parts = A.name.split(': '), F = FACTIONS[A.f];
    row.className = 'act'; row.style.setProperty('--fc', actColor(A));
    row.innerHTML = '<h3><small>' + esc(L(parts[0])) + ' · ' + esc(F ? F.name : L('Freie Wahl')) + '</small>' + esc(L(parts[1] || parts[0])) + '</h3>';
    const ms = document.createElement('div'); ms.className = 'mis';
    for (const id of A.ms) {
      const def = MISSIONS[id], open = campUnlocked(id), done = CAMP.done[id], b = document.createElement('button');
      b.className = 'mcard' + (done ? ' done' : '') + (!open ? ' lock' : '') + (id === next ? ' next' : '');
      b.innerHTML = '<small>' + esc(misLabel(id)) + (done ? '<span class="stars" title="' + esc(L(LVL_NAME[done])) + '">' + '★'.repeat(done) + '</span>' : '') + '</small><b>' + esc(L(def.name)) + '</b>';
      b.addEventListener('click', () => { if (!campUnlocked(id)) { SND.play('err'); toast(L('Erst die vorige Mission abschließen')); return; } SND.play('click'); openBrief(id); });
      ms.appendChild(b);
    }
    row.appendChild(ms);
    box.appendChild(row);
  }
  const ch = [];
  for (const k of ['save', 'voss', 'node', 'end']) if (CAMP.ch[k] && CARRY_TXT[k][CAMP.ch[k]]) ch.push(L(CARRY_TXT[k][CAMP.ch[k]]));
  const cr = $('campChron');
  cr.hidden = !ch.length;
  cr.innerHTML = ch.length ? '<b>' + L('Chronik') + ':</b> ' + ch.map(esc).join(' ') : '';
  setText('campAll', L(CAMP.all ? 'Sperren wieder an' : 'Alle freischalten'));
}
/* ------------------------------------------------------------------ Einsatzbesprechung */
function openBrief(id) {
  const def = MISSIONS[id], A = campAct(id), who = CHARS[def.who] || CHARS.hq;
  MISUI.brief = id;
  const win = $('brief');
  win.style.setProperty('--fc', actColor(A));
  setText('briefAct', misHead(id));
  setText('briefName', L(def.name));
  setText('briefWho', L(who.name) + (who.role ? ' · ' + L(who.role) : ''));
  $('briefText').innerHTML = def.brief.map(p => '<p>' + esc(L(p)) + '</p>').join('');
  const gl = def.goals.filter(d => !d.later);
  $('briefGoals').innerHTML = gl.map(d => '<li' + (d.side ? ' class="side"' : '') + '>' + esc(T(d.t)) + (d.side ? ' <small>(' + L('Nebenziel') + ')</small>' : '') + '</li>').join('') + (def.goals.some(d => d.later) ? '<li class="more">' + L('Weitere Ziele folgen im Einsatz.') + '</li>' : '');
  $('briefHints').innerHTML = (def.hints || []).map(h => '<li>' + esc(L(h)) + '</li>').join('');
  const fx = [], use = CARRY_EFFECT[id] || {};
  for (const k in use) { const v = CAMP.ch[k]; if (v && use[k][v]) for (const s of use[k][v]) fx.push(s); }
  const cb = $('briefCarry'); cb.hidden = !fx.length; cb.innerHTML = fx.length ? '<b>' + L('Aus früheren Einsätzen') + '</b><br>' + fx.map(s => esc(L(s))).join('<br>') : '';
  $('briefFacRow').hidden = !def.pick;
  if (def.pick) { if (PLAYABLE.indexOf(CAMP.fac) < 0 || CAMP.fac === 'brood') CAMP.fac = 'alliance'; segInit('briefFac', PLAYABLE.filter(f => f !== 'brood').map(f => [f, FACTIONS[f].name]), () => CAMP.fac, v => { CAMP.fac = v; campSave(); }); }
  segInit('briefLvl', [[1, 'Leicht'], [2, 'Normal'], [3, 'Schwer']], () => CAMP.lvl, v => { CAMP.lvl = v; campSave(); });
  win.hidden = false;
  win.querySelector('.win').scrollTop = 0;
  drawPortrait($('briefPic'), def.who, R.time);
}
function closeBrief() { $('brief').hidden = true; MISUI.brief = ''; }
function misStart(id) {
  const def = MISSIONS[id];
  CAMP.last = id; campSave();
  beginGame(misOpts(id, CAMP.lvl, JSON.parse(JSON.stringify(CAMP.ch)), def.pick ? CAMP.fac : undefined), 'mis');
}

/* ------------------------------------------------------------------ im Gefecht */
function misUiStart(g, resumed) {
  const on = !!g.mis;
  $('misBox').hidden = !on; $('radio').hidden = true; $('misTitle').hidden = true;
  $('hud').classList.toggle('mis', on);
  tutHL('');
  RADIO.q.length = 0; RADIO.cur = null; RADIO.log.length = 0;
  MISUI.gh = ''; MISUI.cam = null; MISUI.ask = ''; UI.askOpen = false; $('ask').hidden = true;
  if (!on) return;
  if (g.mis.id === 'cqb') { misUiHud(); if (!resumed) { const tc = $('misTitle'); cqUiStart(g); tc.hidden = false; tc.style.animation = 'none'; void tc.offsetWidth; tc.style.animation = ''; clearTimeout(MISUI.titleT); MISUI.titleT = setTimeout(() => { tc.hidden = true; }, 4600); } return; }
  const def = MISSIONS[g.mis.id], A = campAct(g.mis.id);
  $('goalsBox').classList.toggle('fold', MISUI.fold);
  misUiHud();
  if (!resumed) {
    const tc = $('misTitle');
    tc.innerHTML = '<small>' + esc(misHead(g.mis.id)) + '</small><b>' + esc(L(def.name)) + '</b><span>' + esc(L(LVL_NAME[g.mis.lvl])) + '</span>';
    tc.style.setProperty('--fc', actColor(A));
    tc.hidden = false; tc.style.animation = 'none'; void tc.offsetWidth; tc.style.animation = '';
    clearTimeout(MISUI.titleT); MISUI.titleT = setTimeout(() => { tc.hidden = true; }, 4600);
  }
  if (g.mis.ask) setTimeout(() => { if (UI.g === g) openAsk(); }, 400);
}
function radioPush(text, who, flush) {
  if (flush) { RADIO.q.length = 0; RADIO.cur = null; }
  const s = T(text);
  RADIO.q.push({ text: s, who: who || 'hq' });
  RADIO.log.push({ text: s, who: who || 'hq' });
  if (RADIO.log.length > 30) RADIO.log.shift();
  if (RADIO.q.length > 6) RADIO.q.splice(0, RADIO.q.length - 6);
  if (!RADIO.cur) radioNext();
  else setText('radioMore', '+' + RADIO.q.length);
}
function radioNext() {
  const el = $('radio');
  RADIO.cur = RADIO.q.shift() || null; RADIO.age = 0; RADIO.shown = -1;
  if (!RADIO.cur) { el.hidden = true; return; }
  const ch = CHARS[RADIO.cur.who] || CHARS.hq, F = FACTIONS[ch.f];
  el.style.setProperty('--rc', F ? F.team : RADIO.cur.who === 'foe' ? '#ff5b47' : '#8fe3ff');
  setText('radioName', L(ch.name)); setText('radioRole', ch.role ? L(ch.role) : '');
  setText('radioMore', RADIO.q.length ? '+' + RADIO.q.length : '');
  setText('radioText', '');
  el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  drawPortrait($('radioPic'), RADIO.cur.who, R.time);
  SND.play('radio');
}
function radioTap() {
  const r = RADIO.cur;
  if (!r) return;
  if (RADIO.shown < r.text.length) RADIO.age = r.text.length / RADIO_CPS + 0.01;
  else radioNext();
}
/* jedes Bild: Funk weiterschreiben, Porträt bewegen, Kamerafahrt, Besprechungsbild */
function misUiFrame(dt, run) {
  const now = R.time;
  if (MISUI.brief && !$('brief').hidden && now - MISUI.picT > 0.05) { MISUI.picT = now; drawPortrait($('briefPic'), MISSIONS[MISUI.brief].who, now); }
  if (MISUI.ask && !$('ask').hidden && now - MISUI.picT > 0.05) { MISUI.picT = now; const A = UI.g && UI.g.mis && UI.g.mis.ask; if (A) drawPortrait($('askPic'), A.who, now); }
  if ((UI.kind !== 'mis' && UI.kind !== 'cq') || !UI.g) return;
  const r = RADIO.cur;
  if (r) {
    if (run) RADIO.age += dt;
    const n = Math.min(r.text.length, Math.floor(RADIO.age * RADIO_CPS));
    if (n !== RADIO.shown) { RADIO.shown = n; $('radioText').textContent = r.text.slice(0, n); }
    if (now - (RADIO.picT || 0) > 0.05) { RADIO.picT = now; drawPortrait($('radioPic'), r.who, now); }
    const hold = clamp(2.4 + r.text.length / 28, 3.5, 9) * (RADIO.q.length > 2 ? 0.6 : 1);
    if (RADIO.age > r.text.length / RADIO_CPS + hold) radioNext();
  }
  const C = MISUI.cam;
  if (C) {
    if ((UI.camTravel || 0) !== C.trav) MISUI.cam = null;
    else {
      C.k = Math.min(1, C.k + dt / C.d);
      const e = C.k < 0.5 ? 2 * C.k * C.k : 1 - Math.pow(-2 * C.k + 2, 2) / 2;
      R.cam.z = C.z0 + (C.z1 - C.z0) * e;
      R.center(C.x0 + (C.x1 - C.x0) * e, C.y0 + (C.y1 - C.y0) * e);
      if (C.k >= 1) MISUI.cam = null;
    }
  }
}
function camCenter() { return { x: R.cam.x + R.cssW / R.cam.z / 2, y: R.cam.y + (R.cssH - R.padB * 0.5 + R.padT * 0.5) / R.cam.z / 2 }; }
function misUiCam(e) {
  const c = camCenter();
  MISUI.cam = { x0: c.x, y0: c.y, z0: R.cam.z, x1: e.x, y1: e.y, z1: e.z ? clamp(e.z, 0.45, 1.6) : R.cam.z, d: Math.max(0.6, e.d || 2), k: 0, trav: UI.camTravel || 0 };
}
/* Zielanzeige (aus hudUpdate) */
function misUiHud() {
  const g = UI.g;
  if (!g || !g.mis) return;
  const M = g.mis, gd = misGoalDefs(g), compact = MISSIONS[M.id].quiet;
  let h = '', done = 0, total = 0, lastDone = -1;
  if (compact) M.goals.forEach((q, i) => { if (q.st === 2) lastDone = i; });
  for (const q of M.goals) {
    const d = gd.find(x => x.id === q.id);
    if (!d.side) { total++; if (q.st === 2) done++; }
    if (!q.st) continue;
    if (compact && q.st === 2 && M.goals.indexOf(q) !== lastDone) continue;
    const cls = (q.st === 2 ? 'done' : q.st === 3 ? 'fail' : '') + (d.side ? ' side' : '');
    const ic = q.st === 2 ? '✓' : q.st === 3 ? '✗' : d.side ? '◇' : '◆';
    let v = '';
    if (q.st === 1) { if (d.time) v = clock(Math.max(0, q.n - q.v)); else if (d.min) v = L('{0} · mind. {1}', q.v, q.n); else if (q.n) v = q.v + '/' + q.n; }
    h += '<li class="' + cls + '"><i>' + ic + '</i><span>' + esc(T(d.t)) + '</span>' + (v ? '<span class="v">' + v + '</span>' : '') + '</li>';
  }
  if (h !== MISUI.gh) { MISUI.gh = h; $('goalsList').innerHTML = h; }
  tutHL(M.S && M.S.hl || '');
  setText('goalsN', done + '/' + total);
}
/* Ausbildung: die Taste hervorheben, die der Schritt nennt (cmd:…, item:…, tab:…, el:#id, ab) */
function tutHL(key) {
  const cur = MISUI.hlEl;
  if (MISUI.hlKey === key && (!key || (cur && cur.isConnected))) return;
  if (cur) cur.classList.remove('tutHL');
  MISUI.hlKey = key; MISUI.hlEl = null;
  if (!key) return;
  let el = null;
  if (key.indexOf('el:') === 0) el = document.querySelector(key.slice(3));
  else if (key === 'ab') el = document.querySelector('#cmds .key.ab');
  else el = document.querySelector('[data-k="' + key + '"]');
  if (!el && key.indexOf('item:') === 0 && UI.P) { const d = BLDG[UI.P.faction][key.slice(5)]; if (d) el = document.querySelector('[data-k="tab:' + d.tab + '"]'); }
  if (el) { el.classList.add('tutHL'); MISUI.hlEl = el; }
}
function goalFlash() { const b = $('goalsBox'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
/* Ereignisse der Mission (aus UI.consume) */
function misUiEvent(e) {
  const g = UI.g;
  if (!g || !g.mis) return;
  switch (e.t) {
    case 'radio': radioPush(e.k, e.who, e.flush); break;
    case 'cam': misUiCam(e); break;
    case 'ask': setTimeout(() => { if (UI.g === g && !g.over) openAsk(); }, 700); break;
    case 'chosen': { const k = CARRY_TXT[e.id] && CARRY_TXT[e.id][e.v]; if (k) toast(L(k), 'good', 4000); break; }
    case 'goal': {
      const d = misGoalDefs(g).find(x => x.id === e.id);
      misUiHud(); goalFlash();
      if (!d || g.time < 1 || MISSIONS[g.mis.id].quiet) break;
      if (e.st === 1) { toast(L(d.side ? 'Neues Nebenziel: {0}' : 'Neues Ziel: {0}', T(d.t)), 'warn', 4500); SND.play('ready'); }
      else if (e.st === 2) { toast(L('Ziel erfüllt: {0}', T(d.t)), 'good', 4000); SND.play('upgrade'); }
      else if (e.st === 3) { toast(L('Ziel verfehlt: {0}', T(d.t)), 'bad', 4000); SND.play('err'); }
      break;
    }
    case 'breach': SND.play('warp', e.x, e.y, 1); R.ping(e.x, e.y, '#ff5b47'); UI.alertT = g.time; UI.alertPos = { x: e.x, y: e.y }; buzz(50); break;
    case 'gateDark': SND.play('lowpower', e.x, e.y); R.ping(e.x, e.y, '#9ff0c0'); break;
  }
}

/* Pause: die letzten Funksprüche zum Nachlesen */
function misPauseLog() {
  const on = (UI.kind === 'mis' || UI.kind === 'cq') && RADIO.log.length > 0;
  $('pLog').hidden = !on;
  if (!on) return;
  $('pLogList').innerHTML = RADIO.log.slice(-8).reverse().map(r => { const ch = CHARS[r.who] || CHARS.hq, F = FACTIONS[ch.f]; return '<li><b style="color:' + (F ? F.team : '#8fe3ff') + '">' + esc(L(ch.name)) + '</b>' + esc(r.text) + '</li>'; }).join('');
}

/* ------------------------------------------------------------------ Entscheidung */
function openAsk() {
  const g = UI.g, A = g && g.mis && g.mis.ask;
  if (!A || UI.endShown || (UI.kind !== 'mis' && UI.kind !== 'cq')) return;
  if (MISUI.ask === A.id && !$('ask').hidden) return;
  MISUI.ask = A.id; UI.askOpen = true;
  const who = CHARS[A.who] || CHARS.hq, F = FACTIONS[who.f];
  $('ask').style.setProperty('--fc', F ? F.team : '#ffb86b');
  setText('askWho', L(who.name));
  $('askQ').textContent = T(A.q);
  const box = $('askOpts'); box.textContent = '';
  for (const o of A.o) {
    const b = document.createElement('button');
    b.className = 'dcard';
    b.innerHTML = '<h4>' + esc(T(o[1])) + '</h4><p>' + esc(T(o[2] || '')) + '</p>';
    b.addEventListener('click', () => chooseAsk(A.id, o[0]));
    box.appendChild(b);
  }
  $('ask').hidden = false;
  drawPortrait($('askPic'), A.who, R.time);
  SND.play('alert'); buzz(30);
}
function chooseAsk(id, v) {
  issue({ t: 'choice', id, v });
  $('ask').hidden = true; UI.askOpen = false; MISUI.ask = '';
  SND.play('order');
}

/* ------------------------------------------------------------------ Nachbesprechung */
function campRecord(M) {
  CAMP.done[M.id] = Math.max(CAMP.done[M.id] || 0, M.lvl);
  for (const k in M.ch) CAMP.ch[k] = M.ch[k];
  CAMP.last = M.id;
  campSave();
}
function misShowEnd() {
  if (UI.g.mis.id === 'cqb') return cqShowEnd();
  const g = UI.g, P = UI.P, M = g.mis, def = MISSIONS[M.id], won = M.res === 1;
  if (UI.endShown) return;
  UI.endShown = true; UI.endAt = performance.now();
  $('ask').hidden = true; UI.askOpen = false;
  if (won) campRecord(M);
  $('endTitle').textContent = L(won ? 'Mission erfüllt' : 'Mission gescheitert'); $('endTitle').className = won ? 'good' : 'bad';
  $('endText').textContent = misLabel(M.id) + ' · ' + L(def.name) + ' · ' + L(LVL_NAME[M.lvl]) + ' · ' + L('Spielzeit {0}', clock(g.time)) + (!won && M.why ? ' · ' + T(M.why) : '');
  const gd = misGoalDefs(g);
  $('endGoals').innerHTML = M.goals.map(q => { const d = gd.find(x => x.id === q.id); if (!q.st && d.later && !won) return ''; const ok = q.st === 2; return '<li class="' + (ok ? 'ok' : 'no') + '"><b>' + (ok ? '✓' : '✗') + '</b>' + esc(T(d.t)) + (d.side ? ' <small>(' + L('Nebenziel') + ')</small>' : '') + '</li>'; }).join('');
  const chs = Object.keys(M.ch).map(k => CARRY_TXT[k] && CARRY_TXT[k][M.ch[k]]).filter(x => x);
  $('endChoice').hidden = !chs.length; $('endChoice').textContent = chs.map(s => L(s)).join(' ');
  const outro = won ? (typeof def.outro === 'function' ? def.outro(g) : def.outro) : (def.hints && def.hints.length ? L('Tipp') + ': ' + L(def.hints[(g.tick >> 4) % def.hints.length]) : '');
  $('endOutro').hidden = !outro; $('endOutro').textContent = outro ? T(outro) : '';
  $('endOutro').classList.toggle('tip', !won);
  $('endMis').hidden = false;
  const st = $('endStats'); st.innerHTML = '<span></span><b>' + L('Abschüsse') + '</b><b>' + L('Verluste') + '</b>' + g.players.filter(p => !p.neutral && (p.id === g.human || !p.nob || p.stats.kills)).map(p => '<span style="color:' + pcolor(p) + '">' + esc(pname(p.id)) + '</span><span>' + p.stats.kills + ' / ' + p.stats.razed + '</span><span>' + p.stats.lost + ' / ' + p.stats.bLost + '</span>').join('');
  const nx = won ? campNext(M.id) : '';
  $('eNext').hidden = !nx; if (nx) setText('eNext', L('Weiter: {0}', L(MISSIONS[nx].name)));
  setText('eAgain', L('Noch einmal')); setText('eMenu', L('Kampagne'));
  setTimeout(() => { $('end').hidden = false; MUS.sting(won ? 'win' : 'lose'); SND.play(won ? 'win' : 'lose'); clearSave(); }, won ? 1600 : 1800);
}
function toCampaign(openId) {
  toMenu();
  menuPage('camp');
  if (openId) openBrief(openId);
}

/* ------------------------------------------------------------------ Verdrahtung */
function initCampaign() {
  campLoad();
  if ([1, 2, 3].indexOf(CAMP.lvl) < 0) CAMP.lvl = 2;
  $('mCamp').addEventListener('click', () => { SND.init(); SND.play('click'); menuPage('camp'); });
  $('campBack').addEventListener('click', () => { SND.play('click'); menuPage('home'); });
  $('campAll').addEventListener('click', () => { CAMP.all = !CAMP.all; campSave(); SND.play('click'); campRender(); });
  $('briefBack').addEventListener('click', () => { SND.play('click'); closeBrief(); });
  $('briefGo').addEventListener('click', () => { const id = MISUI.brief; if (!id) return; SND.init(); closeBrief(); launch(() => misStart(id)); });
  $('radio').addEventListener('click', e => { e.stopPropagation(); radioTap(); });
  $('goalsBox').addEventListener('click', e => { e.stopPropagation(); MISUI.fold = !MISUI.fold; $('goalsBox').classList.toggle('fold', MISUI.fold); SND.play('click'); });
  $('eNext').addEventListener('click', () => { if (UI.kind === 'cq') { cqLeave(UI.cqR); return; } const nx = UI.g && UI.g.mis ? campNext(UI.g.mis.id) : ''; toCampaign(nx); });
}
