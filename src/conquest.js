/* ===== conquest.js ===== */
'use strict';
/* =====================================================================
   CONQUEST OF THE CALDERA – Feldzug auf der Sektorkarte. Zwanzig Systeme im Kessel, vier Fraktionen, die Brood am
   Haupttor. Pro Runde eine Tat des Spielers (Angriff mit RTS-Schlacht, Verteidigung, Befestigen), danach ziehen die
   KI-Fraktionen, Torstürme verbreiten die Brood. Gehaltene Systeme geben Boni für jede Schlacht (Werftsystem,
   Reliktwelt, Torsystem, Rohstoffwelt). Das Flaggschiff steigt über den Feldzug auf, Veteranen und Helden ziehen mit.
   Dazu Kapitel je Fraktion mit zwei Beratern, Entscheidungen, Gedächtnis der KI, Waffenstillstand in der Brood-Krise,
   ein Erzfeind, Erbauer-Logbücher und ein geheimes System, drei Enden je Fraktion.
   Der Zustand ist reine Daten (JSON) mit eigenem Zufall (CQ.rs), damit er gespeichert werden kann. Die Schlachten
   laufen als Mission »cqb« in der Simulation (Aufstellung aus der Schlachtbeschreibung).
   ===================================================================== */
const CQ_V = 1, CQ_W = 1000, CQ_H = 680;
const CQ_FACS = ['alliance', 'mars', 'legion', 'nexus'];
const CQ_CAPS = { alliance: { name: 'Haven', x: 110, y: 330 }, mars: { name: 'Neu-Tharsis', x: 470, y: 618 }, legion: { name: 'Aurum', x: 530, y: 62 }, nexus: { name: 'Der Kern', x: 890, y: 350 } };
const CQ_NAMES = ['Calder', 'Nera', 'Brask', 'Tessar', 'Vigil', 'Orrin', 'Kaskade', 'Morrow', 'Halcyon', 'Sabin', 'Rook', 'Iridia', 'Varga', 'Lumen', 'Pyre', 'Selk', 'Drift', 'Ostmark', 'Talon', 'Ember', 'Quill', 'Merin', 'Askel', 'Corvin'];
const CQ_TYPES = {
  yard: { name: 'Werftsystem', icon: '⚒', bonus: 'Jede Schlacht ein Begleitschiff mehr; ab zwei Werftsystemen steht zu Beginn eine Werft bereit, ab vier eine Werft II.' },
  relic: { name: 'Reliktwelt', icon: '◆', bonus: 'Zwei Relikte zu Beginn jeder Schlacht. Hier liegt ein Logbuch der Erbauer.' },
  gate: { name: 'Torsystem', icon: '◎', bonus: 'Sprung: Von einem Torsystem aus ist jedes andere Torsystem angreifbar.' },
  mine: { name: 'Rohstoffwelt', icon: '⬢', bonus: '+400 Eis und +200 Erz zu Beginn jeder Schlacht.' },
  cap: { name: 'Hauptwelt', icon: '★', bonus: 'Fällt die Hauptwelt, ist die Fraktion besiegt.' },
  core: { name: 'Das Haupttor', icon: '✺', bonus: 'Hier kam die Brood in den Kessel. Erst in der Krise erreichbar.' },
  secret: { name: 'Archiv der Erbauer', icon: '⌘', bonus: 'Eine Erbauer-Technologie für den Rest des Feldzugs.' }
};
const CQ_ESCORT = { alliance: 'lancer', mars: 'hedgehog', legion: 'paladin', nexus: 'prism' };
/* Einsatzgruppe, die in jeder Schlacht dabei ist */
const CQ_FORCE = { alliance: ['lancer', 'lancer', 'lancer', 'bulwark'], mars: ['hedgehog', 'hedgehog', 'spear', 'needle'], legion: ['paladin', 'paladin', 'bastion', 'herald'], nexus: ['prism', 'prism', 'shard', 'shard', 'binder'] };
const CQ_CRUISER = { alliance: 'bulwark', mars: 'spear', legion: 'inquisitor', nexus: 'mirror' };
const CQ_FLAG = { alliance: 'archipelago', mars: 'olympus', legion: 'sovereign', nexus: 'facet' };
const CQ_PACK = { alliance: [['wren', 'lancer', 'lancer'], ['bulwark', 'aegis'], ['reckoning']], mars: [['needle', 'hedgehog', 'hedgehog'], ['spear', 'boarder'], ['hammer']],
  legion: [['herald', 'paladin', 'paladin'], ['bastion', 'inquisitor'], ['basilica']], nexus: [['shard', 'prism', 'prism'], ['binder', 'mirror'], ['monolith']] };
const CQ_FNAME = { alliance: 'The Alliance', mars: 'Martian Republic', legion: 'Golden Legion', nexus: 'The Nexus', brood: 'The Brood', pir: 'Piraten', '': 'Niemand' };
const CQ_PIR_COLOR = '#d0453b';
/* Berater je Fraktion: A mahnt zur Vorsicht, B drängt zum Krieg */
const CQ_ADV = { alliance: ['marr', 'hale'], mars: ['kesslerA', 'bricks'], legion: ['cassius', 'seraph'], nexus: ['node', 'facet'] };
/* Erzfeinde: ein entkommener Kommandant je Fraktion */
const CQ_NEM = { alliance: { who: 'calder', name: 'Kommodore Rhys Calder' }, mars: { who: 'tarn', name: 'Major Ilka Tarn' }, legion: { who: 'varo', name: 'Inquisitor Varo' }, nexus: { who: 'nullf', name: 'Facette Null' } };
const CQ_LOGS = [
  'Logbuch I: »Die Tore verbinden den Kessel mit tausend Welten. Eine davon antwortet nicht mehr.«',
  'Logbuch II: »Das Signal aus der Tiefe ist kein Signal. Es ist ein Lockruf. Etwas hört die Tore.«',
  'Logbuch III: »Sie kamen durch das Haupttor. Sie fressen Schiffe, Stationen, ganze Monde. Wir nennen sie die Brut.«',
  'Logbuch IV: »Der Rat beschließt die Quarantäne. Alle Tore schweigen, bis die Brut verhungert ist.«',
  'Logbuch V: »Die Quarantäne braucht einen Wächter, der niemals zweifelt. Wir übergeben den Schlüssel dem Imperium.«',
  'Logbuch VI: »Das Archiv bewahrt, was wir wussten. Wer alle Logbücher liest, findet den Weg dorthin.«'
];

/* ------------------------------------------------------------------ Zufall des Feldzugs */
function cqRand(C) { C.rs = (C.rs + 0x6D2B79F5) | 0; let t = Math.imul(C.rs ^ (C.rs >>> 15), 1 | C.rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function cqPick(C, arr) { return arr[Math.floor(cqRand(C) * arr.length)]; }
function cqShuffle(C, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(cqRand(C) * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
function cqSig(x) { return 1 / (1 + Math.exp(-x)); }

/* ------------------------------------------------------------------ Neuer Feldzug */
function cqSegCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  if (a === c || a === d || b === c || b === d) return false;
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
function cqNew(fac, lvl, seed) {
  seed = (seed >>> 0) || 1;
  const C = { v: CQ_V, seed, rs: seed, fac, lvl: clamp(lvl | 0, 1, 3), turn: 1, sys: [], links: [], f: {}, rel: {}, betray: {}, cease: {}, threats: [], flag: { kills: 0 }, vets: [], logs: [], inf: 0, nem: null, crisis: 0, broodT: 4, chap: 0, ev: {}, fx: {}, queue: [], report: [], over: 0, ending: '', pending: null, stats: { battles: 0, won: 0, lost: 0, auto: 0, taken: 0 }, etech: '', secret: 0, log: [] };
  const S = C.sys, add = (o) => { o.id = S.length; S.push(Object.assign({ owner: '', gar: 1, fort: 0, log: -1, links: [] }, o)); return o; };
  for (const f of CQ_FACS) { const c = CQ_CAPS[f]; add({ name: c.name, x: c.x, y: c.y, type: 'cap', owner: f, gar: 3, home: f }); }
  add({ name: 'Das Haupttor', x: 500, y: 335, type: 'core', owner: 'seal', gar: 3 });
  /* übrige Systeme: im Kessel verteilt, mit Abstand zueinander */
  const names = cqShuffle(C, CQ_NAMES.slice());
  for (let tries = 0; S.length < 20 && tries < 4000; tries++) {
    const a = cqRand(C) * TAU, r = Math.sqrt(cqRand(C)), x = 500 + Math.cos(a) * r * 430, y = 335 + Math.sin(a) * r * 285;
    if (S.some(s => Math.hypot(s.x - x, s.y - y) < (s.type === 'cap' || s.type === 'core' ? 125 : 105))) continue;
    add({ name: names[S.length], x: Math.round(x), y: Math.round(y), type: '' });
  }
  const free = S.filter(s => !s.type);
  const types = ['yard', 'yard', 'yard', 'yard', 'relic', 'relic', 'relic', 'relic', 'gate', 'gate', 'gate', 'mine', 'mine', 'mine', 'mine'];
  cqShuffle(C, types);
  free.forEach((s, i) => { s.type = types[i % types.length]; });
  /* Verbindungen: kurze Kanten ohne Kreuzung, dann zusammenhängend machen */
  const edges = [];
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) { const d = Math.hypot(S[i].x - S[j].x, S[i].y - S[j].y); if (d < 250) edges.push([d, i, j]); }
  edges.sort((a, b) => a[0] - b[0]);
  const L = C.links, deg = S.map(() => 0);
  const ok = (i, j) => !L.some(([a, b]) => cqSegCross(S[i], S[j], S[a], S[b]));
  for (const [, i, j] of edges) if (deg[i] < 4 && deg[j] < 4 && ok(i, j)) { L.push([i, j]); deg[i]++; deg[j]++; }
  for (let guard = 0; guard < 40; guard++) {
    const comp = cqComp(S.length, L);
    if (comp.every(c => c === comp[0])) break;
    let best = null;
    for (let i = 0; i < S.length; i++) for (let j = 0; j < S.length; j++) if (comp[i] === comp[0] && comp[j] !== comp[0]) { const d = Math.hypot(S[i].x - S[j].x, S[i].y - S[j].y); if (!best || d < best[0]) best = [d, i, j]; }
    L.push([best[1], best[2]]);
  }
  for (const [a, b] of L) { S[a].links.push(b); S[b].links.push(a); }
  /* Startbesitz: Hauptwelt und das nächste freie System; Rest Piraten */
  for (const f of CQ_FACS) {
    const cap = S.find(s => s.home === f);
    const near = cap.links.map(i => S[i]).filter(s => !s.owner && s.type !== 'core').sort((a, b) => Math.hypot(a.x - cap.x, a.y - cap.y) - Math.hypot(b.x - cap.x, b.y - cap.y))[0];
    if (near) { near.owner = f; near.gar = 2; }
    C.f[f] = { alive: true, pow: 2.4 + cqRand(C) * 0.4 };
    if (f !== fac) { C.rel[f] = 0; C.betray[f] = 0; C.cease[f] = 0; }
  }
  for (const s of S) if (!s.owner) { s.owner = 'pir'; s.gar = cqRand(C) < 0.45 ? 2 : 1; }
  /* Logbücher in den Reliktwelten und zwei Torsystemen */
  let n = 0;
  for (const s of S.filter(x => x.type === 'relic').concat(S.filter(x => x.type === 'gate').slice(0, 2))) if (n < CQ_LOGS.length) s.log = n++;
  C.queue.push({ k: 'chap', n: 1 });
  C.chap = 1;
  return C;
}
function cqComp(n, L) { const c = Array.from({ length: n }, (_, i) => i); const f = i => (c[i] === i ? i : (c[i] = f(c[i]))); for (const [a, b] of L) c[f(a)] = f(b); return c.map((_, i) => f(i)); }

/* ------------------------------------------------------------------ Abfragen */
function cqMine(C) { return C.sys.filter(s => s.owner === C.fac); }
function cqCount(C, type) { return C.sys.filter(s => s.owner === C.fac && s.type === type).length; }
function cqCap(C, f) { return C.sys.find(s => s.home === f); }
function cqOwnerName(o) { return CQ_FNAME[o] || (o === 'seal' ? 'Versiegelt' : o); }
/* Angreifbar: Nachbar eines eigenen Systems, über Tore jedes andere Torsystem, das Haupttor erst in der Krise */
function cqTargets(C) {
  const out = new Set(), mine = cqMine(C), gate = mine.some(s => s.type === 'gate');
  for (const s of mine) for (const j of s.links) { const t = C.sys[j]; if (t.owner !== C.fac) out.add(t.id); }
  if (gate) for (const t of C.sys) if (t.type === 'gate' && t.owner !== C.fac) out.add(t.id);
  for (const t of C.sys) if (t.type === 'core') { if (C.crisis > 0 && C.chap >= 5) out.add(t.id); else out.delete(t.id); }
  for (const t of C.sys) if (t.type === 'secret' && t.owner !== C.fac) out.add(t.id);
  return [...out].filter(id => C.sys[id].owner !== C.fac);
}
/* Stärke des Spielers für berechnete Schlachten */
function cqPower(C) {
  const rank = cqFlagRank(C);
  return 2.9 + Math.min(8, C.vets.length) * 0.4 + rank * 0.45 + cqCount(C, 'yard') * 0.3 + (C.fx.weapon > 0 ? 1 : 0) + (C.inf <= -2 ? 0.4 : 0) + (C.etech ? 0.5 : 0) + [0, 0.6, 0, -0.5][C.lvl];
}
function cqFlagRank(C) { return XP_RANKS.filter(k => C.flag.kills >= k).length; }
function cqFoePow(C, o) { if (o === 'pir') return 1 + C.turn * 0.05; if (o === 'brood') return 1.6 + Math.min(3, Math.max(0, C.crisis) * 0.25) + C.turn * 0.03; if (o === 'seal') return 6; return C.f[o] ? C.f[o].pow : 1; }
function cqDef(C, s) { return s.gar * 1.15 + s.fort * 0.8 + (s.type === 'cap' ? 2.4 : 0) + (s.type === 'core' ? 2 : 0) + cqFoePow(C, s.owner) * 0.25; }
function cqChance(C, s) { return clamp(cqSig((cqPower(C) - cqDef(C, s) + 0.6) / 1.2), 0.05, 0.95); }

/* ------------------------------------------------------------------ Schlachtbeschreibung */
function cqSpec(C, kind, sid, by) {
  const s = C.sys[sid], fac = C.fac;
  if (kind === 'attack' && s.type === 'core') kind = 'core';
  if (kind === 'attack' && s.type === 'secret') kind = 'secret';
  const foe = kind === 'defend' ? by : s.owner;
  const sp = { kind, sys: sid, name: s.name, type: s.type, foe, gar: s.gar, fort: s.fort, cap: s.type === 'cap', turn: C.turn, fac, lvl: C.lvl, seed: (C.seed * 31 + C.turn * 977 + sid * 13) >>> 0,
    flag: { t: CQ_FLAG[fac], kills: C.flag.kills }, vets: C.vets.map(v => ({ t: v.t, k: v.k || 0, h: v.h || '' })), esc: Math.min(4, cqCount(C, 'yard')) + (C.fx.esc || 0), yard: cqCount(C, 'yard'),
    res: { ice: 1500 + cqCount(C, 'mine') * 400 + (C.fx.trade ? 300 : 0), ore: 800 + cqCount(C, 'mine') * 200 + (C.fx.trade ? 150 : 0) }, relics: cqCount(C, 'relic') * 2,
    mfx: cqMfx(C), etech: C.etech || '', nem: null, allies: [], pow: Math.round(cqFoePow(C, foe) * 10) / 10, crisis: C.crisis };
  if (C.nem && !C.nem.dead && C.nem.f === foe) sp.nem = { who: C.nem.who, name: C.nem.name, lvl: C.nem.lvl };
  if (kind === 'core') sp.allies = CQ_FACS.filter(f => f !== fac && C.f[f].alive && C.cease[f] > 0).slice(0, 2);
  if (kind === 'defend') { const th = C.threats.find(t => t.sys === sid && t.by === by); sp.pow = th ? th.pow : sp.pow; }
  return sp;
}
function cqMfx(C) {
  const fx = {};
  if (C.inf >= 2) { fx.hull = 1.1; fx.shield = 1.1; }
  if (C.inf <= -2 || C.fx.weapon > 0 || C.fx.hunt > 0) { const k = 1 + (C.inf <= -2 ? 0.1 : 0) + (C.fx.weapon > 0 ? 0.2 : 0) + (C.fx.hunt > 0 ? 0.1 : 0); for (const w of ['beam', 'kin', 'torp', 'rail']) fx[w] = Math.round(k * 100) / 100; }
  return fx;
}
/* Optionen für createGame aus der Beschreibung */
function cqBattleOpts(sp) {
  const ai = sp.cap ? sp.lvl : Math.max(1, sp.lvl - 1);
  const players = [{ faction: sp.fac, human: true, team: 0 }];
  if (sp.kind === 'attack') {
    if (sp.foe === 'pir') players.push({ faction: sp.seed % 2 ? 'mars' : 'alliance', ai: 1, name: 'Piraten', color: CQ_PIR_COLOR, team: 1 });
    else players.push({ faction: sp.foe, ai, name: CQ_FNAME[sp.foe], team: 1 });
  } else if (sp.kind === 'defend') {
    players.push({ faction: sp.foe === 'pir' ? 'mars' : sp.foe, ai: 0, base: false, name: CQ_FNAME[sp.foe], color: sp.foe === 'pir' ? CQ_PIR_COLOR : undefined, team: 1 });
  } else if (sp.kind === 'core') {
    players.push({ faction: 'brood', ai: 0, base: false, name: 'The Brood', team: 1 });
    for (const f of sp.allies) players.push({ faction: f, ai: 2, name: CQ_FNAME[f], team: 0 });
  }
  for (const p of players) if (p.color === undefined) delete p.color;
  return { seed: sp.seed || 1, players, mis: { id: 'cqb', lvl: clamp(sp.cap ? 3 : sp.gar, 1, 3), carry: {}, cq: sp } };
}

/* ------------------------------------------------------------------ Taten des Spielers */
function cqFortify(C, sid) {
  const s = C.sys[sid];
  if (!s || s.owner !== C.fac || s.fort >= 3) return false;
  s.fort++;
  C.report = [{ k: 'own', t: ['{0} befestigt (Stufe {1}).', s.name, s.fort] }];
  cqWorld(C);
  return true;
}
/* berechnete Schlacht: Ausgang nach Stärke, Verluste bei den Veteranen */
function cqAuto(C, sp) {
  const s = C.sys[sp.sys];
  let p;
  if (sp.kind === 'defend') { const th = C.threats.find(t => t.sys === sp.sys) || { pow: 2 }; p = clamp(cqSig((cqPower(C) * 0.7 + 1.2 + s.fort * 0.9 + (s.type === 'cap' ? 2.4 : 0) - th.pow * 0.75 - 1) / 1.2), 0.08, 0.95); }
  else p = cqChance(C, s);
  const win = cqRand(C) < p;
  const vets = C.vets.filter(() => cqRand(C) > (win ? 0.2 : 0.5));
  if (win && cqRand(C) < 0.4) vets.push({ t: CQ_ESCORT[C.fac], k: 3, h: '' });
  C.stats.auto++;
  return { win, vets, flagKills: C.flag.kills + (win ? 1 : 0), flagAlive: true, auto: 1, nemDead: false, logFound: win };
}
/* Ergebnis einer Schlacht übernehmen, dann ziehen die anderen */
function cqResult(C, sp, R) {
  const s = C.sys[sp.sys], rep = C.report = [];
  C.stats.battles++;
  if (R.win) C.stats.won++; else C.stats.lost++;
  C.pending = null;
  C.vets = (R.vets || []).slice(0, 8);
  C.flag.kills = R.flagAlive ? Math.max(C.flag.kills, R.flagKills || 0) : Math.floor((R.flagKills || C.flag.kills) * 0.6);
  if (!R.flagAlive) rep.push({ k: 'bad', t: 'Das Flaggschiff wurde schwer getroffen und verliert Erfahrung.' });
  if (C.fx.weapon > 0) C.fx.weapon--;
  if (C.fx.hunt > 0) C.fx.hunt--;
  /* Erzfeind */
  if (sp.nem && C.nem && !C.nem.dead) {
    if (R.nemDead) { C.nem.dead = 1; C.flag.kills += 4; rep.push({ k: 'good', t: ['{0} ist gefallen. Der Erzfeind verfolgt dich nicht mehr.', C.nem.name] }); }
    else if (R.win) { C.nem.lvl = Math.min(3, C.nem.lvl + 1); rep.push({ k: 'warn', t: ['{0} entkommt erneut und schwört Rache.', C.nem.name] }); }
  }
  if (sp.kind === 'defend') {
    C.threats = C.threats.filter(t => t.sys !== sp.sys);
    if (R.win) { rep.push({ k: 'good', t: ['Angriff auf {0} abgewehrt.', s.name] }); C.f[sp.foe] && (C.f[sp.foe].pow = Math.max(1.5, C.f[sp.foe].pow - 0.3)); }
    else { cqTake(C, s, sp.foe, rep); }
  } else if (R.win) {
    const prev = s.owner;
    s.owner = C.fac; s.gar = 1; s.fort = 1; C.stats.taken++;
    rep.push({ k: 'good', t: prev !== 'pir' ? ['{0} erobert (bisher {1}).', s.name, cqOwnerName(prev)] : ['{0} erobert.', s.name] });
    C.threats = C.threats.filter(t => t.sys !== s.id);
    if (CQ_FACS.indexOf(prev) >= 0) {
      C.rel[prev] = (C.rel[prev] || 0) - 15;
      if (C.cease[prev] > 0) { C.cease[prev] = 0; C.betray[prev] = 1; C.rel[prev] -= 60; rep.push({ k: 'bad', t: ['{0} nennt dich einen Verräter. Der Waffenstillstand ist gebrochen – das vergisst man dir nicht.', CQ_FNAME[prev]] }); }
      C.f[prev].pow = Math.max(1.5, C.f[prev].pow - 0.4);
      if (s.type === 'cap') cqFall(C, prev, rep);
      cqDomCheck(C);
      if (!C.nem && s.type !== 'cap') { const N = CQ_NEM[prev]; C.nem = { f: prev, who: N.who, name: N.name, lvl: 1, dead: 0 }; rep.push({ k: 'warn', t: ['{0} entkommt aus {1}: »Das war nicht das letzte Mal.«', N.name, s.name] }); }
      if (!C.ev.surrender && cqRand(C) < 0.6) C.queue.push({ k: 'event', id: 'surrender', f: prev, sys: s.id });
    }
    if (prev === 'brood' && s.type === 'core') { cqBroodEnd(C, rep); C.queue.push({ k: 'final' }); }
    if (s.type === 'secret') { C.etech = cqPick(C, Object.keys(ETECH)); rep.push({ k: 'good', t: ['Das Archiv der Erbauer öffnet sich: {0} – für den Rest des Feldzugs.', ETECH[C.etech].name] }); }
    if (s.log >= 0 && C.logs.indexOf(s.log) < 0) { C.logs.push(s.log); C.queue.push({ k: 'log', n: s.log }); }
  } else {
    rep.push({ k: 'bad', t: ['Der Angriff auf {0} ist gescheitert.', s.name] });
    s.gar = Math.min(3, s.gar + (cqRand(C) < 0.4 ? 1 : 0));
  }
  cqWorld(C);
}
function cqTake(C, s, by, rep, quiet) {
  const prev = s.owner;
  s.owner = by; s.gar = by === 'brood' ? 1 + (C.crisis > 0 ? 1 : 0) : 2; s.fort = 0;
  if (!quiet) rep.push({ k: prev === C.fac ? 'bad' : 'info', t: [prev === C.fac ? '{0} ist an {1} gefallen.' : '{0} fällt an {1}.', s.name, cqOwnerName(by)] });
  if (s.type === 'cap' && prev !== by) { if (prev === C.fac) { C.over = -1; C.ending = 'lost'; } else if (C.f[prev]) cqFall(C, prev, rep); }
}
/* eine Fraktion ist besiegt: ihre Systeme werden zu Piratennestern */
function cqFall(C, f, rep) {
  if (!C.f[f] || !C.f[f].alive) return;
  C.f[f].alive = false; C.cease[f] = 0;
  for (const s of C.sys) if (s.owner === f) { s.owner = 'pir'; s.gar = 1; s.fort = 0; }
  C.threats = C.threats.filter(t => t.by !== f);
  rep.push({ k: 'big', t: ['{0} ist besiegt. Ihre Systeme zerfallen zu Piratennestern.', CQ_FNAME[f]] });
  if (C.nem && C.nem.f === f && !C.nem.dead) { C.nem.dead = 1; rep.push({ k: 'info', t: ['{0} verschwindet mit dem Fall seiner Fraktion.', C.nem.name] }); }
  cqDomCheck(C);
}
/* Herrschaft: alle drei fremden Hauptwelten gehören dem Spieler */
function cqDomCheck(C) { if (!C.over && CQ_FACS.filter(x => x !== C.fac).every(x => cqCap(C, x).owner === C.fac)) { C.over = 1; C.ending = 'dom'; } }
function cqBroodEnd(C, rep) {
  C.crisis = -1;
  for (const s of C.sys) if (s.owner === 'brood') { s.owner = 'pir'; s.gar = 1; }
  C.threats = C.threats.filter(t => t.by !== 'brood');
  rep.push({ k: 'big', t: 'Die Matriarch ist tot. Ohne sie zerfallen die Schwärme im ganzen Kessel.' });
}

/* ------------------------------------------------------------------ Zug der Welt */
function cqWorld(C) {
  const rep = C.report;
  if (C.over) return;
  /* 1. angekündigte Angriffe auf den Spieler, die nicht abgewehrt wurden */
  for (const th of C.threats.slice()) {
    if (th.turn >= C.turn) continue;
    const s = C.sys[th.sys];
    C.threats.splice(C.threats.indexOf(th), 1);
    if (s.owner !== C.fac) continue;
    const def = 1.6 + s.fort * 1.2 + (s.type === 'cap' ? 3.2 : 0) + cqCount(C, 'yard') * 0.2 + Math.min(6, C.vets.length) * 0.15 + (C.inf >= 2 ? 0.4 : 0) - (C.lvl - 2) * 0.4;
    if (cqRand(C) < cqSig((def - th.pow * 0.7) / 1.1)) rep.push({ k: 'good', t: ['{0} hält dem Angriff von {1} stand.', s.name, cqOwnerName(th.by)] });
    else { cqTake(C, s, th.by, rep); if (C.over) return; }
  }
  /* 2. die KI-Fraktionen */
  const order = cqShuffle(C, CQ_FACS.filter(f => f !== C.fac && C.f[f].alive));
  let threatNew = 0;
  for (const f of order) {
    const F = C.f[f];
    F.pow = Math.min(8, F.pow + 0.12 + C.sys.filter(s => s.owner === f).length * 0.02);
    if (!F.alive || cqRand(C) > [0, 0.5, 0.6, 0.7][C.lvl]) continue;
    let best = null, bs = -1e9;
    for (const s of C.sys) if (s.owner === f) for (const j of s.links) {
      const t = C.sys[j];
      if (t.owner === f || t.owner === 'seal' || t.type === 'secret' || t.type === 'core') continue;
      let sc = 0;
      if (t.owner === 'pir') sc = 3 - t.gar;
      else if (t.owner === 'brood') sc = C.crisis > 0 ? 3.2 - t.gar * 0.5 : 1;
      else if (t.owner === C.fac) { if (C.cease[f] > 0 || threatNew || C.turn < 3 || C.threats.some(x => x.sys === t.id) || C.threats.length >= 2) continue; sc = 1 + (C.rel[f] < -20 ? 1.2 : 0) + (C.betray[f] ? 1 : 0) - t.fort * 0.4 - (t.type === 'cap' ? 1 : 0); }
      else if (C.f[t.owner]) sc = 1 - t.gar * 0.3 + (t.type === 'cap' ? -1 : 0);
      sc += cqRand(C) * 1.4 + (t.type === 'yard' || t.type === 'mine' ? 0.3 : 0);
      if (sc > bs) { bs = sc; best = t; }
    }
    if (!best || bs < 0.6) continue;
    if (best.owner === C.fac) {
      const pow = Math.round((F.pow + (C.nem && !C.nem.dead && C.nem.f === f ? 0.6 * C.nem.lvl : 0)) * 10) / 10;
      C.threats.push({ sys: best.id, by: f, pow, turn: C.turn }); threatNew = 1;
      rep.push({ k: 'warn', t: ['{0} sammelt eine Flotte gegen {1}.', CQ_FNAME[f], best.name] });
    } else {
      const p = cqSig((F.pow * 0.45 + 0.6 - cqDef(C, best) * 0.9) / 1.0);
      if (cqRand(C) < p) { const prev = best.owner; cqTake(C, best, f, rep); void prev; if (C.over) return; }
    }
  }
  /* 3. Garnisonen wachsen */
  if (C.turn % 4 === 0) for (const s of C.sys) if (s.owner !== C.fac && s.owner !== 'seal' && s.gar < (s.owner === 'pir' ? 2 : 3)) s.gar++;
  /* 4. die Brood: Torstürme, in der Krise breitet sie sich aus und greift an */
  if (C.turn >= C.broodT && C.crisis >= 0) {
    const pStorm = (C.crisis > 0 ? 0.22 : 0.1) * (C.fx.storm > 0 ? 2 : 1);
    for (const g of C.sys.filter(s => (s.type === 'gate' || s.type === 'core') && s.owner !== 'brood')) {
      if (cqRand(C) >= pStorm) continue;
      const cand = g.links.map(j => C.sys[j]).filter(t => t.type !== 'cap' && t.owner !== 'brood' && t.owner !== C.fac && t.type !== 'core');
      if (!cand.length) continue;
      const t = cqPick(C, cand);
      rep.push({ k: 'brood', t: ['Torsturm bei {0}: Die Brood befällt {1}.', g.name, t.name] });
      cqTake(C, t, 'brood', rep, true);
      if (C.over) return;
    }
    if (C.crisis > 0) {
      let spread = 0;
      for (const s of cqShuffle(C, C.sys.filter(x => x.owner === 'brood'))) {
        if (spread >= 2 || cqRand(C) >= 0.22) continue;
        spread++;
        const cand = s.links.map(j => C.sys[j]).filter(t => t.owner !== 'brood' && t.owner !== 'seal' && t.type !== 'secret');
        if (!cand.length) continue;
        const t = cqPick(C, cand);
        if (t.owner === C.fac) { if (!C.threats.some(x => x.sys === t.id)) { C.threats.push({ sys: t.id, by: 'brood', pow: Math.round(cqFoePow(C, 'brood') * 10) / 10, turn: C.turn }); rep.push({ k: 'brood', t: ['Schwärme der Brood halten auf {0} zu.', t.name] }); } }
        else if (cqRand(C) < cqSig((cqFoePow(C, 'brood') - cqDef(C, t)) / 1.2)) { rep.push({ k: 'brood', t: t.owner !== 'pir' ? ['Die Brood überrennt {0} ({1}).', t.name, cqOwnerName(t.owner)] : ['Die Brood überrennt {0}.', t.name] }); cqTake(C, t, 'brood', rep, true); }
      }
      C.crisis++;
    }
  }
  if (C.fx.storm > 0) C.fx.storm--;
  for (const f in C.cease) if (C.cease[f] > 0) { C.cease[f]--; if (!C.cease[f] && C.f[f].alive) rep.push({ k: 'warn', t: ['Der Waffenstillstand mit {0} ist ausgelaufen.', CQ_FNAME[f]] }); }
  /* 5. Geschichte: Kapitel, Logbücher, Ereignisse */
  const n = cqMine(C).length;
  if (C.chap === 1 && (n >= 4 || C.turn >= 5)) { C.chap = 2; C.queue.push({ k: 'chap', n: 2 }); }
  else if (C.chap === 2 && (cqCount(C, 'gate') > 0 || C.logs.length >= 2 || C.turn >= 9)) { C.chap = 3; C.queue.push({ k: 'chap', n: 3 }); }
  else if (C.chap === 3 && !C.crisis && (C.turn >= 12 || n >= 8)) { C.chap = 4; C.crisis = 1; const core = C.sys.find(s => s.type === 'core'); core.owner = 'brood'; core.gar = 3; C.queue.push({ k: 'chap', n: 4 }); rep.push({ k: 'brood', t: 'Am Haupttor erwacht die Matriarch. Die Brood bricht in den Kessel.' }); }
  else if (C.chap === 4 && C.crisis >= 3) { C.chap = 5; C.queue.push({ k: 'chap', n: 5 }); }
  if (C.logs.length >= CQ_LOGS.length && !C.secret) {
    C.secret = 1;
    const core = C.sys.find(s => s.type === 'core');
    const sec = { id: C.sys.length, name: 'Archiv der Erbauer', x: Math.min(CQ_W - 60, core.x + 150), y: Math.max(60, core.y - 230), type: 'secret', owner: 'guard', gar: 3, fort: 0, log: -1, links: [] };
    C.sys.push(sec);
    rep.push({ k: 'big', t: 'Die sechs Logbücher weisen den Weg: Das Archiv der Erbauer liegt offen.' });
  }
  if (!C.queue.some(q => q.k === 'event' || q.k === 'chap') && C.turn >= 3 && cqRand(C) < 0.35) {
    const pool = [];
    if ((C.ev.refugee || 0) < 2) pool.push('refugee');
    if (!C.ev.weapon && cqCount(C, 'relic') > 0) pool.push('weapon');
    if (pool.length) C.queue.push({ k: 'event', id: cqPick(C, pool) });
  }
  C.turn++;
  C.log.push(C.turn);
  if (C.log.length > 50) C.log.shift();
}

/* ------------------------------------------------------------------ Kapitel, Ereignisse und Enden */
/* Zeilen [Sprecher, Text]; a/b = die Berater der Fraktion. Entscheidungen: [Wert, Titel, Beschreibung, Berater] */
const CQ_CHAP = {
  alliance: [
    { t: 'Die Charta ruft', l: [['a', 'Die Tore flackern, und jede Macht im Kessel greift nach den Systemen dazwischen. Die Charta muss wachsen, Admiral – aber mit Bedacht.'], ['b', 'Mit Bedacht verliert man Kriege, Ratsfrau. Wer Werften und Tore hält, diktiert den Frieden.'], ['hq', 'Auftrag: Haven sichern, Systeme gewinnen. Tippe auf ein benachbartes System.']] },
    { t: 'Die neuen Grenzen', l: [['a', 'Vier Systeme unter der Charta. Die Menschen dort fragen, ob sie Bürger werden oder Besetzte.'], ['b', 'Besetzte. Bis der Krieg vorbei ist.']],
      d: { id: 'charter', q: 'Was wird aus den eroberten Systemen?', o: [['a', 'In die Charta aufnehmen', 'Die Systeme wählen Vertreter. Die anderen Mächte sehen, dass die Alliance Wort hält.'], ['b', 'Kriegsrecht verhängen', 'Jedes eigene System wird um eine Stufe befestigt.']] } },
    { t: 'Das erste Tor', l: [['a', 'Ein Tor. Wir könnten Handelsrouten öffnen, zum ersten Mal seit der Stille.'], ['b', 'Oder Truppen schicken. Ein Tor ist eine Kanone, die Flotten verschießt.']],
      d: { id: 'gate', q: 'Wozu dient das Tor?', o: [['a', 'Handelsroute öffnen', 'Jede Schlacht beginnt mit 300 Eis und 150 Erz mehr.'], ['b', 'Torkommando aufstellen', 'Ein erfahrener Kreuzer stößt zur Flotte.']] } },
    { t: 'Der Hunger', l: [['hq', 'Alle Kanäle: Am Haupttor erwacht etwas. Die Brood strömt aus jedem Riss.'], ['a', 'Das ist größer als unsere Fehden. Bieten wir allen einen Waffenstillstand an.'], ['b', 'Oder wir lassen die Brood unsere Feinde schwächen – und nehmen danach, was übrig ist.']], d: 'truce' },
    { t: 'Das Haupttor', l: [['b', 'Das Haupttor. Wenn wir die Matriarch dort töten, ist dieser Krieg entschieden.'], ['a', 'Dann tun Sie es, General. Und danach reden wir darüber, was mit den Toren geschieht.']] }
  ],
  mars: [
    { t: 'Neu-Tharsis', l: [['a', 'Sieben Jahre Fackelflug, und der Kessel ist immer noch ein Pulverfass. Neu-Tharsis braucht Werften und Rohstoffe.'], ['b', 'Und Feinde, Admiralin. Die Jungs wollen endlich was zu tun.'], ['hq', 'Auftrag: den Brückenkopf ausbauen. Tippe auf ein benachbartes System.']] },
    { t: 'Beute', l: [['b', 'Vier Systeme! Die Werften dort sind voll mit Ersatzteilen. Ich sag ja nur.'], ['a', 'Und voll mit Leuten, die uns morgen hassen, wenn wir sie heute ausrauben.']],
      d: { id: 'spoils', q: 'Was geschieht mit den eroberten Werften?', o: [['a', 'Wiederaufbauen', 'Die Bewohner arbeiten mit uns. Die anderen Mächte werden vorsichtiger.'], ['b', 'Ausschlachten', 'Jede Schlacht ein Begleitschiff mehr.']] } },
    { t: 'Ein Tor in unserer Hand', l: [['a', 'Der Mars hat den Toren nie getraut. Jetzt halten wir eines.'], ['b', 'Dann jagen wir eine Ladung Sprengstoff durch und sehen, wer auf der anderen Seite schreit.']],
      d: { id: 'gate', q: 'Was macht die Republik mit dem Tor?', o: [['a', 'Bewachen und studieren', 'Alle Torsysteme der Republik werden um eine Stufe befestigt.'], ['b', 'Durchbruchskommando', 'Ein erfahrener Hammer stößt zur Flotte.']] } },
    { t: 'Der Hunger', l: [['hq', 'Notruf aus dem ganzen Kessel: Die Matriarch ist erwacht.'], ['a', 'Wir sind nicht sieben Jahre geflogen, um gefressen zu werden. Waffenstillstand mit allen.'], ['b', 'Oder wir lassen die Viecher die Legion fressen und räumen danach auf.']], d: 'truce' },
    { t: 'Das Haupttor', l: [['a', 'Das Haupttor. Alles, was der Mars gefürchtet hat, kam durch dieses Ding.'], ['b', 'Dann machen wir es zu. Endgültig. Und laut.']] }
  ],
  legion: [
    { t: 'Aurum', l: [['b', 'Der Kaiser ist fort, doch die Legion steht. Aurum ist unser Thron, der Kessel unser Reich.'], ['a', 'Unser Reich, Seraph? Oder das des Kaisers, der uns verlassen hat?'], ['hq', 'Auftrag: das Reich zurückgewinnen. Tippe auf ein benachbartes System.']] },
    { t: 'Die Geister', l: [['a', 'Die Helden in unseren Schiffen fragen, wofür sie diesmal sterben.'], ['b', 'Für die Legion. Das hat immer genügt.']],
      d: { id: 'heroes', q: 'Was antwortet die Legion ihren Helden?', o: [['a', 'Die Wahrheit sagen', 'Sie kämpfen aus Überzeugung. Die anderen Mächte hören davon.'], ['b', 'Zu den Waffen rufen', 'Ein weiteres Heldenschiff erwacht und stößt zur Flotte.']] } },
    { t: 'Das Tor des Kaisers', l: [['a', 'Durch dieses Tor floh der Kaiser. Vielleicht finden wir dort Antworten.'], ['b', 'Antworten sind ein Luxus. Das Tor ist eine Waffe.']],
      d: { id: 'gate', q: 'Was sucht die Legion am Tor?', o: [['a', 'Antworten', 'Alle Torsysteme der Legion werden um eine Stufe befestigt.'], ['b', 'Eine Waffe', 'Ein erfahrener Inquisitor stößt zur Flotte.']] } },
    { t: 'Der Hunger', l: [['b', 'Die Brut ist zurück. Das ist es, wovor der Kaiser die Tore verschloss.'], ['a', 'Dann war die Stille kein Verrat. Bieten wir den anderen Frieden an, Seraph.']], d: 'truce' },
    { t: 'Das Haupttor', l: [['b', 'Hier endete das Imperium. Hier endet die Brut.'], ['a', 'Und danach, Seraph? Schließen wir die Tore wieder, wie der Kaiser?']] }
  ],
  nexus: [
    { t: 'Verbinde', l: [['b', 'Verbinde. Öffne. Das Netz will wachsen, und der Kessel ist voller getrennter Systeme.'], ['a', 'Die Stimme sagt es. Aber woher kommt die Stimme, Prime Facet?'], ['hq', 'Auftrag: das Netz ausdehnen. Tippe auf ein benachbartes System.']] },
    { t: 'Das Netz wächst', l: [['b', 'Vier Systeme verbunden. Die Stimme ist zufrieden.'], ['a', 'Die Systeme sind es nicht. Sie wollten nie Teil von uns sein.']],
      d: { id: 'net', q: 'Wie verbindet der Nexus die neuen Systeme?', o: [['a', 'Freiwillig', 'Die Systeme schließen sich selbst an. Die anderen Mächte fürchten uns weniger.'], ['b', 'Zwangsweise', 'Jedes eigene System wird um eine Stufe befestigt.']] } },
    { t: 'Die Frequenz', l: [['a', 'Das Tor singt in derselben Frequenz wie die Stimme. Das ist kein Zufall.'], ['b', 'Dann ist das Tor ein Teil von uns. Öffne es.']],
      d: { id: 'gate', q: 'Was tut der Nexus mit dem Tor?', o: [['a', 'Abschirmen', 'Alle Torsysteme des Nexus werden um eine Stufe befestigt.'], ['b', 'Öffnen', 'Ein erfahrener Monolith stößt zur Flotte.']] } },
    { t: 'Der Hunger', l: [['b', 'Die Stimme … ist Hunger.'], ['a', 'Ich habe es euch gesagt. Jetzt brauchen wir alle, die noch denken können.']], d: 'truce' },
    { t: 'Das Haupttor', l: [['a', 'Das Haupttor. Von dort kommt die Stimme.'], ['b', 'Dann trenne ich sie vom Netz. Für immer.']] }
  ]
};
const CQ_TRUCE = { id: 'truce', q: 'Die Brood überrennt den Kessel. Wie antwortet deine Fraktion?', o: [['a', 'Waffenstillstand anbieten', 'Wer dir nicht feind ist, kämpft mit dir gegen die Brood – und greift dich nicht an.'], ['b', 'Die Gelegenheit nutzen', 'Vier Schlachten lang +10 % Waffenschaden. Keine Verbündeten.']] };
const CQ_FINAL = { id: 'final', q: 'Die Matriarch ist tot. Das Haupttor steht offen. Was geschieht mit den Toren?', o: [['a', 'Die Tore versiegeln', 'Der Kessel ist sicher – und wieder allein.'], ['b', 'Die Tore offen halten', 'Der Krieg geht weiter, dorthin, woher die Brood kam.']] };
const CQ_END = {
  dom: { alliance: 'Die Charta reicht vom Haupttor bis an den Aschenebel. Haven regiert den Kessel – nicht mit Verträgen, sondern mit Flotten. Ob das noch die Alliance ist, die Ilya Voss gegründet hat, fragt niemand mehr laut.',
    mars: 'Die rote Fahne weht über jeder Hauptwelt. Die Republik, die nie einem Tor traute, besitzt jetzt alle. Neu-Tharsis feiert drei Tage lang, und Sergeant Okafor schläft keine einzige Nacht davon.',
    legion: 'Das Reich ist zurück, größer als unter dem Kaiser. Seraph setzt sich nicht auf den Thron – er stellt ihn leer in den Saal von Aurum. Für den Fall, dass jemand zurückkehrt.',
    nexus: 'Alles ist verbunden. Kein System im Kessel ist mehr allein. Prime Facet hört keine Stimme mehr, nur noch das eigene Netz – und manchmal, ganz leise, die Zweifel von K-7.' },
  seal: { alliance: 'Die Tore schweigen wieder, diesmal nach Beschluss der Charta und mit der Unterschrift aller. Der Kessel ist allein, aber er ist frei. Ratsfrau Marr nennt es den Frieden von Haven.',
    mars: 'Die Republik sprengt jedes Tor im Kessel, eines nach dem anderen, live übertragen nach Neu-Tharsis. Kessler sieht zu und sagt nur: »Hätten wir vor vierzig Jahren schon tun sollen.«',
    legion: 'Seraph schließt die Tore, wie er es vor vierzig Jahren tat – doch diesmal erklärt er jedem im Kessel, warum. Cassius führt die Legion fortan als Wächter, nicht als Herrscher.',
    nexus: 'Der Nexus trennt die Tore vom Netz. Zum ersten Mal entscheidet er sich für eine Trennung. K-7 kehrt ins Netz zurück, und es fühlt sich an wie Heilung.' },
  open: { alliance: 'Die Tore bleiben offen. Eine Flotte unter der Fahne der Charta springt in die Tiefe, dorthin, woher die Brood kam. General Hale führt sie selbst. Haven wartet auf Nachricht.',
    mars: 'Die Republik schickt ihre Flotte durch das Haupttor. Okafor steht an der Spitze, Kessler bleibt zurück und hält den Kessel. »Bring sie alle heim, Sergeant.« – »Und ein paar Trophäen.«',
    legion: 'Die Legion springt durch das Haupttor, um den Kaiser zu finden – oder das, was ihn vertrieben hat. Seraph führt, und hinter ihm folgen tausend Geister, die nicht aufhören wollen zu kämpfen.',
    nexus: 'Prime Facet verbindet das Netz mit dem, was hinter den Toren liegt. Wenn die Brood ein Netz hat, wird der Nexus es finden – und übernehmen.' },
  lost: 'Deine Hauptwelt ist gefallen. Der Feldzug ist verloren. Der Kessel wird weiterbrennen – ohne dich.'
};
/* Eine Entscheidung anwenden. Rückgabe: Zeilen für den Bericht */
function cqDecide(C, item, v) {
  const out = [], mine = cqMine(C), isA = v === 'a';
  const id = item.id || (item.d && item.d.id);
  const rel = n => { for (const f in C.rel) C.rel[f] += n; };
  const fortAll = pred => { for (const s of mine) if (!pred || pred(s)) s.fort = Math.min(3, s.fort + 1); };
  if (id !== 'final') C.inf = clamp(C.inf + (isA ? 1 : -1), -5, 5);
  switch (id) {
    case 'charter': case 'net':
      if (isA) { rel(8); out.push('Die anderen Mächte sehen dich mit anderen Augen.'); }
      else { fortAll(); out.push('Alle eigenen Systeme sind um eine Stufe befestigt.'); }
      break;
    case 'spoils':
      if (isA) { rel(8); out.push('Die Bewohner arbeiten mit dir. Die anderen Mächte werden vorsichtiger.'); }
      else { C.fx.esc = (C.fx.esc || 0) + 1; out.push('Jede Schlacht ein Begleitschiff mehr.'); }
      break;
    case 'heroes':
      if (isA) { rel(8); out.push('Die Helden kämpfen aus Überzeugung. Im Kessel spricht man davon.'); }
      else { C.vets.push({ t: 'paladin', k: 8, h: cqPick(C, ['Varian', 'Lucan', 'Aurelia', 'Octavia', 'Severin']) }); out.push('Ein Heldenschiff erwacht und stößt zur Flotte.'); }
      break;
    case 'gate':
      if (isA) { if (C.fac === 'alliance') { C.fx.trade = 1; out.push('Handelsroute offen: mehr Eis und Erz in jeder Schlacht.'); } else { fortAll(s => s.type === 'gate'); out.push('Die Torsysteme sind befestigt.'); } }
      else { C.vets.push({ t: { alliance: 'bulwark', mars: 'hammer', legion: 'inquisitor', nexus: 'monolith' }[C.fac], k: 8, h: '' }); out.push('Ein erfahrenes Schiff stößt zur Flotte.'); }
      break;
    case 'truce':
      if (isA) {
        const ok = [];
        for (const f of CQ_FACS) if (f !== C.fac && C.f[f].alive && !C.betray[f] && C.rel[f] > (C.inf >= 2 ? -60 : -40)) { C.cease[f] = 12; ok.push(CQ_FNAME[f]); C.threats = C.threats.filter(t => t.by !== f); }
        out.push(ok.length ? ['Waffenstillstand mit {0}. Gemeinsam gegen die Brood.', ['%list'].concat(ok)] : 'Niemand nimmt dein Angebot an. Zu viel Blut zwischen euch.');
      } else { C.fx.hunt = 4; out.push('Vier Schlachten lang mehr Waffenschaden. Keine Verbündeten.'); }
      break;
    case 'refugee':
      C.ev.refugee = (C.ev.refugee || 0) + 1;
      if (isA) {
        C.vets.push({ t: CQ_ESCORT[C.fac], k: 3, h: '' }); out.push('Die Crews der Flüchtlinge bemannen ein Schiff.');
        const cand = mine.filter(s => s.type !== 'cap');
        if (cand.length && cqRand(C) < 0.3) { const s = cqPick(C, cand); cqTake(C, s, 'brood', [], true); out.push(['Mit dem Konvoi kamen Sporen: Die Brood befällt {0}.', s.name]); }
      } else { rel(-5); out.push('Der Konvoi zieht weiter. Im Kessel spricht man darüber.'); }
      break;
    case 'weapon':
      C.ev.weapon = 1;
      if (isA) { rel(4); out.push('Die Waffe bleibt versiegelt.'); }
      else { C.fx.weapon = 3; C.fx.storm = 4; out.push('Drei Schlachten lang +20 % Waffenschaden. Die Torstürme werden häufiger.'); }
      break;
    case 'surrender':
      C.ev.surrender = 1;
      if (isA) { C.rel[item.f] = (C.rel[item.f] || 0) + 25; out.push(['{0} rechnet dir die Auslieferung hoch an.', CQ_FNAME[item.f]]); }
      else { C.vets.push({ t: CQ_CRUISER[item.f], k: 8, h: 'Überläufer' }); C.rel[item.f] = (C.rel[item.f] || 0) - 10; out.push('Der Kreuzer des Überläufers kämpft jetzt für dich.'); }
      break;
    case 'final':
      C.over = 1; C.ending = isA ? 'seal' : 'open';
      break;
  }
  C.vets = C.vets.slice(0, 8);
  return out;
}
/* Ereignistexte: Sprecher, Text, Entscheidung */
function cqEventDef(C, item) {
  if (item.id === 'refugee') return { t: 'Flüchtlingskonvoi', l: [['a', 'Ein Konvoi aus den befallenen Randsystemen bittet um Aufnahme. Hunderte Familien – und Crews, die kämpfen wollen.'], ['b', 'Und wer weiß, was sie aus den befallenen Systemen mitbringen.']],
    d: { id: 'refugee', q: 'Den Konvoi aufnehmen?', o: [['a', 'Aufnehmen', 'Ein Schiff mehr in der Flotte. Vielleicht kommen Sporen mit.'], ['b', 'Abweisen', 'Sicher – aber der Kessel sieht zu.']] } };
  if (item.id === 'weapon') { const s = cqMine(C).find(x => x.type === 'relic'); return { t: 'Eine Erbauer-Waffe', l: [['a', ['In den Ruinen von {0} liegt eine Waffe der Erbauer. Sie zerreißt Flotten – und sie ruft, was hinter den Toren wartet.', s ? s.name : 'einer Reliktwelt']], ['b', 'Eine Waffe, die Flotten zerreißt. Wo ist das Problem?']],
    d: { id: 'weapon', q: 'Was geschieht mit der Erbauer-Waffe?', o: [['a', 'Versiegeln', 'Kein Risiko. Die anderen Mächte schätzen das.'], ['b', 'Einsetzen', 'Drei Schlachten lang +20 % Waffenschaden, aber mehr Torstürme.']] } }; }
  if (item.id === 'surrender') { const s = C.sys[item.sys]; return { t: 'Ein Kommandant ergibt sich', l: [['b', ['Der Kommandant von {0} in {1} ergibt sich mit seinem Kreuzer.', CQ_FNAME[item.f], s ? s.name : 'dem System']], ['a', ['Liefern wir ihn aus, rechnet {0} uns das hoch an.', CQ_FNAME[item.f]]]],
    d: { id: 'surrender', q: 'Was geschieht mit dem Kommandanten?', o: [['a', 'Ausliefern', ['{0} wird freundlicher.', CQ_FNAME[item.f]]], ['b', 'Anwerben', 'Sein Kreuzer kämpft für dich.']] } }; }
  return null;
}
/* Speichern: der Feldzug liegt getrennt vom Spielstand der Schlacht */
const CQ_KEY = 'ra.cq';
function cqSave(C) { try { localStorage.setItem(CQ_KEY, JSON.stringify(C)); return true; } catch (e) { return false; } }
function cqLoad() { try { const d = JSON.parse(localStorage.getItem(CQ_KEY) || 'null'); return d && d.v === CQ_V && Array.isArray(d.sys) ? d : null; } catch (e) { return null; } }
function cqClear() { try { localStorage.removeItem(CQ_KEY); } catch (e) { /* egal */ } }

/* ================================================================== SCHLACHTEN DES FELDZUGS (Mission »cqb«) */
/* Verband einer Fraktion nach Wert */
function cqPack(g, f, value) {
  if (f === 'brood') return broodPack(g, value, value > 2000);
  const P = CQ_PACK[f] || CQ_PACK.mars, out = [];
  for (let guard = 0; value > 0 && guard < 40; guard++) {
    const r = g.rng(), tier = value > 2600 && r < 0.22 ? 2 : value > 900 && r < 0.55 ? 1 : 0;
    const list = P[tier].filter(t => SHIPS[t]), t = list[Math.floor(g.rng() * list.length)];
    out.push(t); value -= SHIPS[t].cost.ice + (SHIPS[t].cost.ore || 0);
  }
  return out;
}
/* Schiff mit Erfahrung aufstellen */
function cqVet(g, owner, type, x, y, ang, kills, hero) {
  const u = addShip(g, type, owner, x, y, ang);
  if (kills) { u.kills = kills; gainXp(g, u, 0); }
  if (hero) u.hero = hero;
  return u;
}
function cqFoeLabel(S) { return S.foe === 'pir' ? 'das Piratennest' : S.foe === 'brood' ? 'das Nest der Brood' : ['die Kommandobasis von {0}', CQ_FNAME[S.foe]]; }
MISSIONS.cqb = {
  act: 'cq', name: 'Schlacht', who: 'hq', seed: 1, hidden: 1,
  map(mis) {
    const S = mis.cq || { kind: 'attack', type: 'mine' }, big = S.cap || S.kind === 'core';
    const w = big ? 4000 : 3600, h = big ? 2700 : 2500;
    const starts = [{ x: 520, y: h / 2, ang: 0 }, { x: w - 520, y: h / 2, ang: Math.PI }];
    if (S.kind === 'core') starts.push({ x: 700, y: 480, ang: 0.3 }, { x: 700, y: h - 480, ang: -0.3 });
    return { w, h, starts, build(m, rng) {
      misRes(m, rng, m.starts[0], 0);
      if (S.kind === 'attack') misRes(m, rng, m.starts[1], Math.PI);
      if (S.kind === 'core') { misRes(m, rng, m.starts[2], 0.3); misRes(m, rng, m.starts[3], -0.3); gatePair(m, w - 480, h / 2, w - 240, 260, 'flicker'); iceMoon(m, w * 0.45, h / 2, rng, true); field(m, w * 0.62, h * 0.25, 200, rng); field(m, w * 0.62, h * 0.75, 200, rng); }
      else if (S.kind === 'secret') { misSite(m, 'warden', w * 0.66, h / 2); misSite(m, 'citadel', w * 0.42, h * 0.24); misSite(m, 'ruin', w * 0.42, h * 0.78); iceMoon(m, w * 0.3, h * 0.72, rng); oreCluster(m, w * 0.3, h * 0.28, rng, 3); }
      else {
        const t = S.type;
        if (t === 'relic') { misSite(m, 'ruin', w * 0.42, h * 0.22); misSite(m, 'ruin', w * 0.5, h * 0.78); misSite(m, 'ruin', w * 0.6, h * 0.4); iceMoon(m, w * 0.5, h * 0.5, rng); }
        else if (t === 'gate') { gatePair(m, w * 0.5, h * 0.22, w * 0.5, h * 0.78, 'flicker'); iceMoon(m, w * 0.5, h * 0.5, rng, true); }
        else if (t === 'yard') { oreCluster(m, w * 0.45, h * 0.28, rng, 3); oreCluster(m, w * 0.55, h * 0.72, rng, 3); iceMoon(m, w * 0.5, h * 0.5, rng); }
        else if (t === 'mine') { iceMoon(m, w * 0.5, h * 0.5, rng, true); oreCluster(m, w * 0.5, h * 0.2, rng, 3); oreCluster(m, w * 0.5, h * 0.8, rng, 3); }
        else { iceMoon(m, w * 0.5, h * 0.5, rng, true); oreCluster(m, w * 0.45, h * 0.24, rng, 2); oreCluster(m, w * 0.55, h * 0.76, rng, 2); }
        field(m, w * 0.36, h * 0.5 + (S.seed % 2 ? 360 : -360), 170, rng, 0.8); field(m, w * 0.66, h * 0.5 + (S.seed % 2 ? -380 : 380), 190, rng);
      }
      misScatter(m, rng, big ? 34 : 28);
    } };
  },
  goals(mis) {
    const S = mis.cq || {}, out = [];
    if (S.kind === 'attack') {
      out.push({ id: 'base', t: ['Zerstöre {0}', cqFoeLabel(S)] });
      if (S.type === 'relic') out.push({ id: 'ruin', t: 'Scanne die Erbauer-Ruinen', n: 3, side: 1 });
      if (S.type === 'gate') out.push({ id: 'gate', t: 'Aktiviere ein Tor', side: 1 });
    } else if (S.kind === 'defend') out.push({ id: 'hold', t: 'Wehre die Angriffswellen ab', n: S.waves || 3 });
    else if (S.kind === 'core') { out.push({ id: 'nests', t: 'Zerstöre die Nester am Haupttor' }, { id: 'mat', t: 'Vernichte die Brood Matriarch', later: 1 }); }
    else if (S.kind === 'secret') out.push({ id: 'warden', t: 'Bezwinge den Wächter des Archivs' });
    if (S.nem) out.push({ id: 'nem', t: ['Stelle {0}', S.nem.name], side: 1 });
    out.push({ id: 'flag', t: 'Das Flaggschiff überlebt', side: 1, keep: 1 });
    return out;
  },
  setup(g, M) {
    const S = g.opts.mis.cq, pi = g.human, h = g.players[pi], s0 = g.map.starts[0], w = g.map.w, H = g.map.h;
    M.S.kind = S.kind;
    h.ice = S.res.ice; h.ore = S.res.ore; h.relics = S.relics || 0;
    h.mfx = S.mfx && Object.keys(S.mfx).length ? S.mfx : null;
    if (S.etech && ETECH[S.etech]) { h.etech = S.etech; if (ETECH[S.etech].reveal) misReveal(g, w / 2, H / 2, 4000, 9999); }
    recalcTech(g, h);
    /* Flotte: Flaggschiff mit Rang, Veteranen, Begleitschiffe aus den Werftsystemen */
    const fl = cqVet(g, pi, S.flag.t, s0.x + 260, s0.y, 0, S.flag.kills, '');
    fl.cqFlag = 1; M.f.flag = fl.id; M.f.fk = fl.kills;
    M.tag.own = [fl.id];
    S.vets.forEach((v, i) => { const u = cqVet(g, pi, v.t, s0.x + 180 - (i >> 2) * 50, s0.y - 150 + (i % 4) * 100, 0, v.k, v.h); u.cqv = 1; M.tag.own.push(u.id); });
    const force = CQ_FORCE[S.fac].concat(Array((S.esc || 0) + [0, 2, 0, 0][S.lvl]).fill(CQ_ESCORT[S.fac])).slice(0, S.lvl === 3 ? CQ_FORCE[S.fac].length - 1 + (S.esc || 0) : 99);
    misTag(g, 'own', misSpawn(g, pi, force, s0.x + 120, s0.y + 240, 0));
    const base = g.bldgs.find(b => b.owner === pi && b.role === 'base');
    if (S.yard >= 2 && base) { const sp = misSpot(g, pi, 'yard', base); if (sp) misBldg(g, pi, 'yard', sp[0], sp[1], S.yard >= 4 ? 2 : 1); }
    misSet(g, 'flag', 1);
    const foe = S.foe === 'pir' ? 'Piraten' : CQ_FNAME[S.foe] || '';
    if (S.kind === 'attack') {
      M.lvl = S.cap ? 3 : clamp(S.gar, 1, 2);
      misFortify(g, 1, (S.gar - 1) + S.fort + (S.cap ? 3 : 0) + Math.floor(S.turn / 6));
      if (S.cap) { const b = g.bldgs.find(x => x.owner === 1 && x.role === 'base'); if (b) for (const [dx, dy] of [[-260, -260], [-260, 260]]) if (!canPlace(g, 1, 'turret', b.x + dx, b.y + dy)) misBldg(g, 1, 'turret', b.x + dx, b.y + dy, 3); }
      misSet(g, 'base', 1);
      if (S.type === 'relic') misSet(g, 'ruin', 1, 0, 3);
      if (S.type === 'gate') misSet(g, 'gate', 1);
      const fb = g.bldgs.find(x => x.owner === 1 && x.role === 'base');
      if (fb) misMark(g, 'base', fb.x, fb.y, 380, S.foe === 'pir' ? 'Piratennest' : S.foe === 'brood' ? 'Nest' : 'Basis');
      misSay(g, S.cap ? ['Die Hauptwelt von {0}. Sie verteidigen jeden Meter.', foe] : ['System {0}. {1} Zerstört {2}.', S.name, S.foe === 'pir' ? 'Piraten haben sich hier eingenistet.' : S.foe === 'brood' ? 'Die Brood hat das System befallen.' : ['{0} hält es.', foe], cqFoeLabel(S)], 'hq', 1);
    } else if (S.kind === 'defend') {
      /* eigene Basis nach Befestigungsstufe, Angreifer in Wellen von Osten */
      if (base) {
        const L = clamp(1 + S.fort, 1, 3);
        if (L > 1) { base.lv = L; const l = lvOf(base); base.hull = base.hullMax = l.hull; base.shieldMax = l.shield * h.tfx.shield; base.shield = base.shieldMax; base.wcd = l.wpn.map(() => 0); }
        for (let i = 0; i < 1 + S.fort + (S.cap ? 2 : 0); i++) { const a = (i - S.fort / 2) * 0.55, x = base.x + dcos(a) * 260, y = base.y + dsin(a) * 260; if (!canPlace(g, pi, 'turret', x, y)) misBldg(g, pi, 'turret', x, y, Math.min(3, 1 + (S.fort >> 1))); }
      }
      const n = S.waves || 3;
      misSet(g, 'hold', 1, 0, n);
      M.t.wave = 55; M.f.w = 0; M.f.n = n;
      misSay(g, ['{0} greift {1} an! Die erste Welle kommt in knapp einer Minute.', foe, S.name], 'hq', 1);
    } else if (S.kind === 'core') {
      const gt = g.gates[0];
      const nest = [misBldg(g, 1, 'base', gt.x - 120, gt.y, 2)];
      for (const [dx, dy] of [[-360, -330], [-360, 330], [-620, -120], [-620, 160]]) nest.push(misBldg(g, 1, 'spore', gt.x + dx, gt.y + dy, 2));
      nest.push(misBldg(g, 1, 'turret', gt.x - 520, gt.y - 420, 2), misBldg(g, 1, 'turret', gt.x - 520, gt.y + 420, 2));
      for (const b of nest) b.label = 'Nest';
      misTag(g, 'nest', nest);
      misTag(g, 'ng', misSpawn(g, 1, broodPack(g, 1100 + S.lvl * 500 + (S.pow || 2) * 150, true), gt.x - 450, gt.y, Math.PI, { hold: true }));
      misSet(g, 'nests', 1, 0, nest.length);
      misMark(g, 'nest', gt.x - 300, gt.y, 520, 'Nest am Haupttor');
      M.t.wave = 120; M.f.w = 0;
      misTag(g, 'own', misSpawn(g, pi, Array(3).fill(CQ_ESCORT[S.fac]), s0.x + 60, s0.y - 260, 0));
      misSay(g, 'Das Haupttor. Die Matriarch wartet dahinter. Erst die Nester, dann sie.', 'hq', 1);
      if (S.allies && S.allies.length) misSay(g, S.allies.length > 1 ? ['Unsere Verbündeten aus dem Waffenstillstand sind in Position: {0} und {1}.', CQ_FNAME[S.allies[0]], CQ_FNAME[S.allies[1]]] : ['Unsere Verbündeten aus dem Waffenstillstand sind in Position: {0}.', CQ_FNAME[S.allies[0]]], 'hq', 7);
    } else if (S.kind === 'secret') {
      const wd = g.sites.find(x => x.kind === 'warden'), gu = wd ? misLive(g, wd.guard)[0] : null;
      if (gu) { misTag(g, 'warden', [gu]); misMark(g, 'warden', wd.x, wd.y, 260, 'Der Wächter'); }
      if (wd && g.neutral >= 0) misTag(g, 'drones', misSpawn(g, g.neutral, Array(4 + S.lvl * 2).fill('drone'), wd.x - 260, wd.y, Math.PI, { hold: true }));
      misSet(g, 'warden', 1);
      misSay(g, '… wer alle Logbücher gelesen hat, darf eintreten. Wer eintreten will, muss den Wächter bezwingen …', 'echo', 1);
      misSay(g, 'Der Wächter schläft, bis jemand auf ihn schießt. Erst aufbauen, dann wecken.', 'hq', 8);
    }
    /* der Erzfeind */
    if (S.nem && S.kind !== 'core' && S.kind !== 'secret') {
      const ft = CQ_FLAG[S.foe];
      if (ft) {
        const at = S.kind === 'defend' ? null : g.map.starts[1];
        if (at) { const u = cqVet(g, 1, ft, at.x - 280, at.y, Math.PI, S.nem.lvl > 1 ? XP_RANKS[Math.min(2, S.nem.lvl - 2)] : 0, S.nem.name); u.o = { t: 'hold' }; u.hold = true; u.gar = 1; misTag(g, 'nem', [u]); M.f.nemOn = 1; }
        else M.f.nemWave = S.waves || 3;
        misSet(g, 'nem', 1);
        misSay(g, S.nem.lvl > 1 ? 'Sie schon wieder. Diesmal bin ich vorbereitet.' : 'Wir sehen uns wieder, habe ich gesagt. Hier bin ich.', S.nem.who, 6);
      }
    }
  },
  step(g, M) {
    const S = g.opts.mis.cq, pi = g.human, w = g.map.w, H = g.map.h;
    const fl = g.byId.get(M.f.flag);
    if (fl && !fl.dead) M.f.fk = fl.kills;
    else if (misOn(g, 'flag')) { misSet(g, 'flag', 3); misSay(g, 'Das Flaggschiff ist getroffen! Es muss zur Reparatur zurück.', 'hq'); }
    if (M.tag.nem && misOn(g, 'nem') && !misCount(g, M.tag.nem)) { misSet(g, 'nem', 2); M.f.nemDead = 1; misSay(g, '… nicht … so …', S.nem.who); }
    if (S.kind === 'attack') {
      if (S.type === 'relic' && misOn(g, 'ruin')) { const n = g.sites.filter(x => x.kind === 'ruin' && x.scanned && x.owner === pi).length; misGoal(g, 'ruin').v = n; if (n >= 3) misSet(g, 'ruin', 2); }
      if (S.type === 'gate' && misOn(g, 'gate') && g.gates.some(x => x.state === 'active' && x.owner === pi)) misSet(g, 'gate', 2);
      if (!g.bldgs.some(b => !b.dead && b.owner === 1 && b.role === 'base')) { if (misOn(g, 'nem')) misSet(g, 'nem', 3); misSay(g, ['System {0} gehört uns.', S.name], 'hq'); misWin(g); }
      if (M.tag.nem && g.tick % 90 === 15 && M.f.nemOn && g.time > 600) { for (const u of misLive(g, M.tag.nem)) u.gar = 0; misHunt(g, M.tag.nem); }
    } else if (S.kind === 'defend') {
      if (M.f.w < M.f.n && g.time >= M.t.wave) {
        M.f.w++; M.t.wave = g.time + 75;
        const val = 700 + (S.pow || 2) * 240 + M.f.w * 260 + (S.lvl - 2) * 300;
        const list = cqPack(g, S.foe === 'pir' ? 'mars' : S.foe, val);
        const pack = misTag(g, 'att', misSpawn(g, 1, list, w - 260, H / 2 + (M.f.w % 2 ? -380 : 380), Math.PI));
        misTag(g, 'w' + M.f.w, pack);
        if (M.f.nemWave === M.f.w && CQ_FLAG[S.foe]) { const u = cqVet(g, 1, CQ_FLAG[S.foe], w - 300, H / 2, Math.PI, S.nem.lvl > 1 ? XP_RANKS[Math.min(2, S.nem.lvl - 2)] : 0, S.nem.name); misTag(g, 'nem', [u]); misTag(g, 'att', [u]); misTag(g, 'w' + M.f.w, [u]); misSay(g, 'Ich führe diese Welle selbst an. Für die Ehre – und für die Rache.', S.nem.who); }
        misSay(g, M.f.w === M.f.n ? 'Letzte Welle! Alles, was sie haben.' : ['Welle {0} von {1} im Anflug!', M.f.w, M.f.n], 'hq');
      }
      if (g.tick % 60 === 5) misHunt(g, M.tag.att);
      let done = 0;
      for (let k = 1; k <= M.f.w; k++) if (!misCount(g, M.tag['w' + k])) done++;
      misGoal(g, 'hold').v = done;
      if (M.f.w >= M.f.n && done >= M.f.n) { misSet(g, 'hold', 2); if (misOn(g, 'nem')) misSet(g, 'nem', 3); misSay(g, ['{0} hält. Der Angriff ist zerschlagen.', S.name], 'hq'); misWin(g); }
    } else if (S.kind === 'core') {
      const gt = g.gates[0], left = misCount(g, M.tag.nest);
      misGoal(g, 'nests').v = misGoal(g, 'nests').n - left;
      if (g.time >= M.t.wave && !misDone(g, 'mat')) {
        M.f.w++; M.t.wave = g.time + (left ? 70 : 95);
        misTag(g, 'brood', misBreach(g, 1, broodPack(g, 700 + S.lvl * 250 + M.f.w * 320, M.f.w >= 3), gt, Math.PI));
      }
      if (g.tick % 60 === 5) misHunt(g, M.tag.brood);
      if (misOn(g, 'nests') && !left) { misSet(g, 'nests', 2); misSet(g, 'mat', 1); misUnmark(g, 'nest'); misCam(g, gt.x, gt.y, 0.65, 2.5); misSay(g, 'Die Nester brennen. Sie sammelt sich hinter dem Tor – 45 Sekunden. Repariert und sammelt euch!', 'hq'); M.t.mat = g.time + 45; M.t.wave = g.time + 60; }
      if (M.t.mat && g.time >= M.t.mat) {
        M.t.mat = 0;
        const pack = misBreach(g, 1, ['matriarch'].concat(S.lvl >= 3 ? ['leviathan', 'leviathan'] : S.lvl >= 2 ? ['leviathan'] : []), gt, Math.PI);
        pack[0].hero = 'Die Matriarch'; misTag(g, 'mat', [pack[0]]); misTag(g, 'brood', pack);
        misSay(g, '(Ein Signal ohne Worte. Jeder Bildschirm im Kessel zeigt für einen Augenblick dasselbe Muster.)', 'voice');
      }
      if (misOn(g, 'mat') && M.tag.mat && !misCount(g, M.tag.mat)) { misSet(g, 'mat', 2); misSay(g, 'Die Matriarch ist tot!', 'hq'); misWin(g); }
    } else if (S.kind === 'secret') {
      if (M.tag.warden && !misCount(g, M.tag.warden)) { misSet(g, 'warden', 2); misSay(g, '… ihr dürft eintreten …', 'echo'); misWin(g); }
    }
  }
};
/* Ergebnis einer Schlacht für den Feldzug: Sieg, überlebende Veteranen, Flaggschiff, Erzfeind */
function cqBattleResult(g) {
  const M = g.mis, pi = g.human, vets = [];
  for (const u of g.ships) {
    if (u.dead || u.derelict || u.owner !== pi || u.cqFlag || u.def.role !== 'war' || !u.def.wpn || !u.def.wpn.length) continue;
    if (u.cqv || u.rank >= 1 || u.hero) vets.push({ t: u.type, k: Math.round(u.kills || 0), h: u.hero || '' });
  }
  vets.sort((a, b) => b.k - a.k);
  const fl = g.byId.get(M.f.flag);
  return { win: M.res === 1, vets: vets.slice(0, 8), flagKills: Math.round(M.f.fk || 0), flagAlive: !!(fl && !fl.dead), nemDead: !!M.f.nemDead };
}
