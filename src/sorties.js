/* ===== sorties.js ===== (Fassung 27)
   EINSÄTZE – kurze Gefechte mit festem Verband und festem Ziel, drei bis acht Minuten, ohne Basisbau. Sie laufen im
   Missionsgerüst (mission.js), stehen aber nicht in der Kampagne: frei wählbar, immer auf Normal. Wertung in Sternen:
   ein Stern für den Sieg, je einer für die beiden Nebenziele (CAMP.st, campaign.js).
   Jeder Einsatz hat tease (eine Zeile für die Karte) und mins (Richtwert in Minuten). */
const SORTIES = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
CAMPAIGN.push({ id: 'e', name: 'Einsätze', f: '', ms: SORTIES, free: 1, sortie: 1 });
/* Sterne aus dem Missionszustand: Sieg + erfüllte Nebenziele */
function sortieStars(g) { const M = g.mis; if (!M || M.res !== 1) return 0; const gd = misGoalDefs(g); return 1 + M.goals.filter(q => { const d = gd.find(x => x.id === q.id); return d.side && q.st === 2; }).length; }
/* Verband ohne eigene KI zum Angriff schicken (alle, nicht nur untätige) */
function sortieCharge(g, ents, x, y) { for (const u of ents) if (!u.dead) { u.hold = false; u.o = { t: 'amove', x: x + (u.id % 5 - 2) * 22, y: y + (u.id % 3 - 1) * 22 }; u.path = null; } }
function sortieLost(g, M) { return (M.f.n0 || 0) - g.ships.filter(u => !u.dead && !u.derelict && u.owner === g.human && u.def.role !== 'fighter' && !u.convoy).length; }
function sortieOwn(g, M, list, x, y, ang, opt) { const us = misTag(g, 'own', misSpawn(g, g.human, list, x, y, ang, opt)); M.f.n0 = (M.f.n0 || 0) + us.length; return us; }

/* TAGESEINSATZ (Fassung 28): derselbe Einsatz mit einer Erschwernis (M.mut aus opts.mis.mut) – »tough«: feindliche Schiffe
   und Stationen halten 30 % mehr aus; »lean«: der eigene Verband beginnt mit einem Schiff weniger; »both«: beides.
   Welcher Einsatz an welchem Tag dran ist, bestimmt die Bedienung (campaign.js sortieDaily). */
const SORTIE_MUTS = {
  tough: { name: 'Zäher Gegner', desc: 'Feindliche Schiffe und Stationen halten 30 % mehr aus.' },
  lean: { name: 'Kleiner Verband', desc: 'Du beginnst mit einem Schiff weniger.' },
  both: { name: 'Unter Druck', desc: 'Der Gegner hält 30 % mehr aus, und du beginnst mit einem Schiff weniger.' }
};
function sortieMutStep(g, M) {
  if (M.mut !== 'tough' && M.mut !== 'both') return;
  const t = g.tm[g.human];
  for (const u of g.ships) if (!u.mt && !u.dead && g.tm[u.owner] !== t) { u.mt = 1; u.hullMax *= 1.3; u.hull *= 1.3; }
  for (const b of g.bldgs) if (!b.mt && !b.dead && g.tm[b.owner] !== t) { b.mt = 1; b.hullMax *= 1.3; b.hull *= 1.3; }
}
function sortieMutSetup(g, M) {
  if (M.mut === 'lean' || M.mut === 'both') {
    const keep = new Set([].concat(M.tag.art || [], M.tag.levi || [])), own = misLive(g, M.tag.own || []).filter(u => !keep.has(u.id));
    if (own.length > 2) { removeShip(g, own[own.length - 1]); M.f.n0 = (M.f.n0 || 1) - 1; }
  }
  sortieMutStep(g, M);
}

/* ------------------------------------------------------------------ 1 Blockadebrecher (Alliance) */
MISSIONS.e1 = {
  act: 'e', name: 'Blockadebrecher', f: 'alliance', who: 'voss', seed: 811, mins: 6, supply: false,
  tease: 'Drei Frachter, drei Sperrriegel. Bring den Konvoi durch.',
  brief: ['Die Republik hat den Korridor nach Haven abgeriegelt. Drei Frachter mit Kühlmittel müssen trotzdem durch, heute noch.',
    'Dein Geleit ist klein. Räume einen Riegel nach dem anderen und bleib vor dem Konvoi.'],
  hints: ['Der Konvoi hält an, sobald Feinde vor ihm stehen, und fliegt weiter, wenn der Weg frei ist.', 'Nach zwei Minuten kommen Jäger von hinten. Lass ein Schiff beim Konvoi.'],
  goals: [{ id: 'escort', t: 'Bring den Konvoi zum Ostrand' }, { id: 'all', t: 'Alle drei Frachter kommen an', side: 1, keep: 1 }, { id: 'fast', t: 'Schaffe es in unter sechs Minuten', side: 1, keep: 1 }],
  map: { w: 4600, h: 1800, starts: [{ x: 300, y: 900, ang: 0 }, { x: 4300, y: 900, ang: Math.PI }],
    build(m, rng) { field(m, 1000, 420, 170, rng, 0.8); field(m, 1750, 1380, 190, rng); field(m, 2500, 420, 160, rng, 0.8); field(m, 3250, 1400, 170, rng, 0.7); field(m, 3900, 430, 150, rng, 0.7); misScatter(m, rng, 26); } },
  sides: [{ f: 'alliance', base: false }, { f: 'mars', name: 'Blockadeflotte', base: false }],
  lock: null,
  outro: 'Konvoi durch. In Haven laufen die Reaktoren wieder im grünen Bereich – für diese Woche.',
  setup(g, M) {
    sortieOwn(g, M, ['bulwark', 'lancer', 'lancer', 'lancer', 'wren', 'wren'], 620, 900, 0);
    const cv = misSpawn(g, g.human, ['hauler', 'hauler', 'hauler'], 300, 900, 0, { gap: 50, hold: true });
    for (const u of cv) { u.auto = false; u.convoy = 1; }
    misTag(g, 'convoy', cv);
    misTag(g, 'foe', misSpawn(g, 1, ['needle', 'needle', 'needle'], 1250, 880, Math.PI, { hold: true }));
    misTag(g, 'foe', misSpawn(g, 1, ['hedgehog', 'needle', 'needle', 'longshot'], 2050, 940, Math.PI, { hold: true }));
    misTag(g, 'foe', misSpawn(g, 1, ['spear', 'hedgehog', 'needle', 'needle'], 2850, 880, Math.PI, { hold: true }));
    misTag(g, 'foe', misSpawn(g, 1, ['spear', 'hedgehog', 'hedgehog', 'longshot', 'needle'], 3650, 920, Math.PI, { hold: true }));
    misSet(g, 'escort', 1); misSet(g, 'all', 1); misSet(g, 'fast', 1);
    M.f.cvx = 300;
    misMark(g, 'east', 4350, 900, 180, 'Ostrand');
    misSay(g, 'Konvoi an Geleit: Wir folgen Ihnen. Machen Sie uns den Weg frei.', 'hq', 1);
  },
  step(g, M) {
    const cv = misLive(g, M.tag.convoy);
    if (misOn(g, 'fast') && g.time > 360) misSet(g, 'fast', 3);
    if (misOn(g, 'all') && cv.length + (M.f.home || 0) < 3) misSet(g, 'all', 3);
    if (!M.f.hunt && g.time > 120 && cv.length) { M.f.hunt = 1; misTag(g, 'hunt', misSpawn(g, 1, ['needle', 'needle', 'wasp'], Math.max(140, cv[0].x - 900), 300, 0.6)); misSay(g, 'Kontakte von achtern! Jäger halten auf den Konvoi zu.', 'hq'); }
    if (M.f.hunt && g.tick % 60 === 5 && cv.length) sortieCharge(g, misLive(g, M.tag.hunt), cv[0].x, cv[0].y);
    for (const u of cv) if (u.x > 4220) { M.f.home = (M.f.home || 0) + 1; ev(g, 'jump', { x: u.x, y: u.y, owner: g.human, r: u.def.r, from: 1 }); removeShip(g, u); }
    const left = misLive(g, M.tag.convoy);
    if (!left.length) { if (M.f.home) { misUnmark(g, 'east'); misWin(g); } else misLose(g, 'Der Konvoi ist verloren'); return; }
    const lead = left.reduce((a, u) => u.x > a.x ? u : a, left[0]);
    const danger = g.ships.some(u => !u.dead && u.owner === 1 && u.x > lead.x - 120 && hyp(u.x - lead.x, u.y - lead.y) < 460);
    if (!danger) { M.f.cvx = Math.min(4400, M.f.cvx + 7);   /* schwer beladen: der Konvoi kriecht, das Geleit hat Zeit zum Räumen */ for (const u of left) { u.hold = false; u.o = { t: 'move', x: M.f.cvx + (u.id % 5) * 12, y: 900 + (u.id % 3 - 1) * 45 }; u.path = null; } }
    else for (const u of left) if (u.o.t !== 'hold') { u.o = { t: 'hold' }; u.hold = true; }
  },
  auto(g, M) { const cv = misLive(g, M.tag.convoy); if (!cv.length) return; const lead = cv.reduce((a, u) => u.x > a.x ? u : a, cv[0]); const own = misLive(g, M.tag.own); own.forEach((u, i) => { if (u.o.t !== 'idle' && u.o.t !== 'hold') return; const back = i % 3 === 2; if (back && hyp(u.x - lead.x, u.y - lead.y) < 200) return; u.hold = false; u.o = { t: 'amove', x: back ? lead.x - 40 : Math.min(4300, lead.x + 380), y: 900 + (u.id % 5 - 2) * 30 }; u.path = null; }); }
};

/* ------------------------------------------------------------------ 2 Letzte Bastion (Mars) */
MISSIONS.e2 = {
  act: 'e', name: 'Letzte Bastion', f: 'mars', who: 'kessler', seed: 823, mins: 5, supply: false,
  tease: 'Fünf Minuten halten, bis die Flotte springt.',
  brief: ['Der Sprungsender von Relais Vier ruft die Flotte. Er braucht fünf Minuten, und die Brood hat ihn gehört.',
    'Halte den Sender. Was danach aus uns wird, ist zweitrangig.'],
  hints: ['Die Schwärme kommen abwechselnd aus Norden, Osten und Süden. Die Richtung wird angesagt.', 'Stell die Hammer nah an den Sender, ihre Punktverteidigung schützt ihn.'],
  goals: [{ id: 'hold', t: 'Halte den Sender', time: 1, n: 300 }, { id: 'hull', t: 'Der Sender behält mehr als die halbe Hülle', side: 1, keep: 1 }, { id: 'loss', t: 'Verliere höchstens zwei Schiffe', side: 1, keep: 1 }],
  map: { w: 2800, h: 2400, starts: [{ x: 1400, y: 1200, ang: 0 }, { x: 2600, y: 1200, ang: Math.PI }],
    build(m, rng) { field(m, 700, 600, 170, rng, 0.8); field(m, 2100, 1900, 170, rng, 0.8); field(m, 650, 1850, 150, rng, 0.7); misScatter(m, rng, 20); } },
  sides: [{ f: 'mars', base: false }, { f: 'brood', name: 'The Brood', base: false }],
  lock: null,
  outro: 'Der Sender schweigt, die Flotte ist da. Relais Vier steht noch – zerbeult, verätzt, unser.',
  setup(g, M) {
    const b = misBldg(g, g.human, 'relay', 1400, 1200, 2); b.label = 'Sprungsender'; M.f.relay = b.id;
    misBldg(g, g.human, 'turret', 1560, 1090, 2); misBldg(g, g.human, 'turret', 1240, 1310, 2);
    sortieOwn(g, M, ['hammer', 'hedgehog', 'hedgehog', 'spear', 'spear', 'needle', 'needle'], 1400, 1010, -Math.PI / 2);
    misSet(g, 'hold', 1, 0, 300); misSet(g, 'hull', 1); misSet(g, 'loss', 1);
    M.t.next = 14; M.f.wave = 0;
    misMark(g, 'relay', 1400, 1200, 150, 'Sprungsender');
    misSay(g, 'Sender läuft. Fünf Minuten, Kommandantin. Sie kommen.', 'bricks', 1);
  },
  step(g, M) {
    const b = g.byId.get(M.f.relay), q = misGoal(g, 'hold');
    if (!b || b.dead) { misLose(g, 'Der Sender ist zerstört'); return; }
    q.v = Math.min(300, Math.floor(g.time));
    if (misOn(g, 'hull') && b.hull < b.hullMax * 0.5) misSet(g, 'hull', 3);
    if (misOn(g, 'loss') && sortieLost(g, M) > 2) misSet(g, 'loss', 3);
    if (g.time >= M.t.next && g.time < 285) {
      const k = ++M.f.wave, dir = [-Math.PI / 2, 0, Math.PI / 2][k % 3];
      M.t.next = g.time + 34;
      const x = 1400 + dcos(dir) * 1050, y = 1200 + dsin(dir) * 1000;
      const pack = misTag(g, 'brood', misSpawn(g, 1, broodPack(g, 620 + k * 270, k >= 5), x, y, dir + Math.PI));
      sortieCharge(g, pack, 1400, 1200);
      ev(g, 'breach', { x, y, r: 120 });
      misSay(g, ['Schwarm aus Norden!', 'Schwarm aus Osten!', 'Schwarm aus Süden!'][k % 3], 'bricks');
    }
    if (g.tick % 60 === 5) misHunt(g, M.tag.brood, { x: 1400, y: 1200 });
    if (g.time >= 300) { misUnmark(g, 'relay'); ev(g, 'jump', { x: 1400, y: 900, owner: g.human, r: 60 }); misWin(g); }
  },
  auto(g, M) { for (const u of misLive(g, M.tag.own)) if ((u.o.t === 'idle' || u.o.t === 'hold') && hyp(u.x - 1400, u.y - 1200) > 330) { u.hold = false; u.o = { t: 'amove', x: 1400 + (u.id % 5 - 2) * 50, y: 1200 + (u.id % 3 - 1) * 60 }; u.path = null; } }
};

/* ------------------------------------------------------------------ 3 Kopfjagd (Legion) */
MISSIONS.e3 = {
  act: 'e', name: 'Kopfjagd', f: 'legion', who: 'seraph', seed: 839, mins: 4, supply: false,
  tease: 'Ein Schlachtschiff, ein Fluchtweg. Stell es vorher.',
  brief: ['Die Olympus »Tharsis« umrundet mit ihrem Geleit das große Trümmerfeld und hält auf den Sprungpunkt im Südwesten zu. Erreicht sie ihn, fällt morgen eine Welt.',
    'Deine Helden sind schneller. Brich durch das Geleit und bring das Schlachtschiff zu Fall, bevor es springt.'],
  hints: ['Zealots sind schnell und schlagen hart, halten aber wenig aus. Schick die Paladine voraus.', 'Das Geleit ist nicht das Ziel. Es zählt nur die Olympus.'],
  goals: [{ id: 'kill', t: 'Zerstöre die Olympus vor dem Sprung' }, { id: 'loss', t: 'Verliere höchstens ein Schiff', side: 1, keep: 1 }, { id: 'fast', t: 'Schaffe es in unter vier Minuten', side: 1, keep: 1 }],
  map: { w: 5000, h: 3200, starts: [{ x: 2500, y: 2950, ang: -1.57 }, { x: 500, y: 500, ang: 0 }],
    build(m, rng) { field(m, 2500, 1500, 420, rng, 1); field(m, 3300, 1650, 260, rng, 0.9); field(m, 1750, 1500, 200, rng, 0.8); misScatter(m, rng, 30); } },
  sides: [{ f: 'legion', base: false }, { f: 'mars', name: 'Geleitzug Tharsis', base: false }],
  lock: null,
  outro: 'Die Tharsis treibt als Wrack durch den Korridor. Seraph notiert: eine Welt, die morgen nicht fällt.',
  setup(g, M) {
    sortieOwn(g, M, ['inquisitor', 'paladin', 'paladin', 'zealot', 'zealot', 'herald', 'herald'], 2500, 2950, -1.57);
    const o = addShip(g, 'olympus', 1, 500, 500, 0); o.label = 'Tharsis'; M.f.oly = o.id; o.auto = false;
    const esc = misTag(g, 'esc', misSpawn(g, 1, ['hedgehog', 'hedgehog', 'spear', 'spear', 'needle', 'needle', 'needle'], 620, 500, 0));
    cmdEscort(g, esc, o);
    misSet(g, 'kill', 1); misSet(g, 'loss', 1); misSet(g, 'fast', 1);
    M.f.wp = 0; misMark(g, 'jump', 700, 2700, 170, 'Sprungpunkt');
    misSay(g, 'Ziel erfasst. Die Tharsis braucht etwa fünf Minuten um das Trümmerfeld.', 'seraph', 1);
  },
  step(g, M) {
    const o = g.byId.get(M.f.oly);
    if (misOn(g, 'fast') && g.time > 240) misSet(g, 'fast', 3);
    if (misOn(g, 'loss') && sortieLost(g, M) > 1) misSet(g, 'loss', 3);
    if (!o || o.dead || o.derelict) { misUnmark(g, 'jump'); misWin(g); return; }
    const WP = [[4400, 600], [4400, 2600], [700, 2700]], w = WP[M.f.wp];
    if (hyp(o.x - w[0], o.y - w[1]) < 170) { if (M.f.wp === 2) { ev(g, 'jump', { x: o.x, y: o.y, owner: 1, r: o.def.r, from: 1 }); misLose(g, 'Die Olympus ist gesprungen'); return; } M.f.wp++; if (M.f.wp === 2) misSay(g, 'Die Tharsis dreht auf den Sprungpunkt ein. Letzte Gelegenheit.', 'seraph'); }
    if (g.tick % 30 === 5) { const q = WP[M.f.wp]; o.o = { t: 'move', x: q[0], y: q[1] }; }
    misMark(g, 'oly', o.x, o.y, 90, 'Tharsis');
  }
};

/* ------------------------------------------------------------------ 4 Überfall (Nexus) */
MISSIONS.e4 = {
  act: 'e', name: 'Überfall', f: 'nexus', who: 'facet', seed: 853, mins: 4, supply: false,
  tease: 'Rein, die Raffinerien brechen, raus. Bevor die Wache kommt.',
  brief: ['Die Charta speist ihre Front aus zwei Raffinerien hinter den Linien. Sie sind schwach bewacht, aber die Wachflotte ist nur zweieinhalb Minuten entfernt.',
    'Brich beide Raffinerien und kehre zum Sammelpunkt zurück. Wir tauschen keine Splitter gegen Stahl.'],
  hints: ['Die Geschütze decken nur die Zufahrt. Von der Seite kommst du näher heran.', 'Sobald die Wachflotte da ist, hilft nur noch Rückzug.'],
  goals: [{ id: 'raid', t: 'Zerstöre beide Raffinerien', n: 2 }, { id: 'home', t: 'Kehre zum Sammelpunkt zurück', later: 1 }, { id: 'loss', t: 'Verliere höchstens zwei Schiffe', side: 1, keep: 1 }, { id: 'fast', t: 'Schaffe es in unter drei Minuten', side: 1, keep: 1 }],
  map: { w: 3600, h: 2400, starts: [{ x: 400, y: 2000, ang: -0.6 }, { x: 3200, y: 500, ang: 2.5 }],
    build(m, rng) { iceMoon(m, 2500, 700, rng); iceMoon(m, 2700, 1700, rng); field(m, 1500, 1500, 200, rng, 0.8); field(m, 1700, 500, 170, rng, 0.7); misScatter(m, rng, 26); } },
  sides: [{ f: 'nexus', base: false }, { f: 'alliance', name: 'Charta-Versorgung', base: false }],
  lock: null,
  outro: 'Zwei Raffinerien weniger, kein Splitter verschwendet. Prime Facet nennt das Rechnen.',
  setup(g, M) {
    sortieOwn(g, M, ['mirror', 'prism', 'prism', 'shard', 'shard', 'shard', 'shard', 'lattice'], 400, 2000, -0.6);
    const r1 = misBldg(g, 1, 'refinery', 2300, 800, 2), r2 = misBldg(g, 1, 'refinery', 2550, 1500, 2);
    M.f.r1 = r1.id; M.f.r2 = r2.id;
    misBldg(g, 1, 'turret', 2050, 900); misBldg(g, 1, 'turret', 2330, 1620);
    misTag(g, 'foe', misSpawn(g, 1, ['lancer', 'wren', 'wren'], 2200, 1000, Math.PI, { hold: true }));
    misTag(g, 'foe', misSpawn(g, 1, ['lancer', 'lancer', 'wren'], 2420, 1380, Math.PI, { hold: true }));
    for (const [x, y] of [[2420, 700], [2620, 1620], [2500, 1150]]) { const h = addShip(g, 'hauler', 1, x, y, 0); h.auto = false; h.o = { t: 'hold' }; }
    misSet(g, 'raid', 1, 0, 2); misSet(g, 'loss', 1); misSet(g, 'fast', 1);
    misMark(g, 'r1', 2300, 800, 110, 'Raffinerie'); misMark(g, 'r2', 2550, 1500, 110, 'Raffinerie');
    misSay(g, 'Zwei Ziele. Die Wachflotte braucht zweieinhalb Minuten. Rechne.', 'facet', 1);
  },
  step(g, M) {
    const a = g.byId.get(M.f.r1), b = g.byId.get(M.f.r2), n = (a && !a.dead ? 0 : 1) + (b && !b.dead ? 0 : 1);
    misGoal(g, 'raid').v = n;
    if (n >= 1) misUnmark(g, a && !a.dead ? 'r2' : 'r1'); if (n >= 2) { misUnmark(g, 'r1'); misUnmark(g, 'r2'); }
    if (misOn(g, 'fast') && g.time > 180) misSet(g, 'fast', 3);
    if (misOn(g, 'loss') && sortieLost(g, M) > 2) misSet(g, 'loss', 3);
    if (!M.f.guard && g.time > 150) { M.f.guard = 1; misTag(g, 'guard', misSpawn(g, 1, ['bulwark', 'bulwark', 'reckoning', 'lancer', 'lancer', 'lancer', 'lancer'], 3350, 400, 2.5)); misSay(g, 'Die Wachflotte ist da. Zeit zu gehen.', 'facet'); }
    if (M.f.guard && g.tick % 60 === 5) misHunt(g, M.tag.guard);
    if (n >= 2 && misOn(g, 'raid')) { misSet(g, 'raid', 2); misSet(g, 'home', 1); misMark(g, 'home', 400, 2000, 220, 'Sammelpunkt'); misSay(g, 'Beide Ziele gebrochen. Zurück zum Sammelpunkt.', 'facet'); }
    if (misOn(g, 'home')) { const own = g.ships.filter(u => !u.dead && !u.derelict && u.owner === g.human && u.def.role !== 'fighter'); if (own.length && own.every(u => hyp(u.x - 400, u.y - 2000) < 260)) { misUnmark(g, 'home'); misWin(g); } }
  },
  auto(g, M) {
    const a = g.byId.get(M.f.r1), b = g.byId.get(M.f.r2), t = a && !a.dead ? a : b && !b.dead ? b : null;
    const us = misLive(g, M.tag.own);
    if (t) { const idle = us.filter(u => u.o.t === 'idle' || u.o.t === 'hold'); if (idle.length) execCmd(g, { t: 'attack', p: g.human, u: idle.map(u => u.id), e: t.id }); }
    else { const go = us.filter(u => u.o.t !== 'move'); if (go.length) execCmd(g, { t: 'move', p: g.human, u: go.map(u => u.id), x: 400, y: 2000 }); }
  }
};

/* ------------------------------------------------------------------ 5 Fressrausch (Brood) */
MISSIONS.e5 = {
  act: 'e', name: 'Fressrausch', f: 'brood', who: 'voice', seed: 859, mins: 6, supply: false,
  tease: 'Der Korridor ist voller Beute. Friss, solange er offen ist.',
  brief: ['Geleitzüge. Einer nach dem anderen, quer durch das Jagdrevier. Sechs Minuten, dann schließt sich der Korridor.',
    '(Hunger.)'],
  hints: ['Frachter zählen genauso wie Kriegsschiffe. Die Schwärmer holen sie ein.', 'Leviathane verschlingen angeschlagene Schiffe und heilen sich daran.'],
  goals: [{ id: 'eat', t: 'Erlege zwanzig Schiffe', n: 20 }, { id: 'time', t: 'Zeit bis der Korridor schließt', time: 1, n: 360 }, { id: 'more', t: 'Erlege dreißig Schiffe', side: 1, n: 30 }, { id: 'levi', t: 'Beide Leviathane überleben', side: 1, keep: 1 }],
  map: { w: 3400, h: 2400, starts: [{ x: 1700, y: 1200, ang: 0 }, { x: 200, y: 400, ang: 0 }],
    build(m, rng) { field(m, 900, 1250, 180, rng, 0.8); field(m, 2500, 1150, 180, rng, 0.8); field(m, 1700, 2050, 160, rng, 0.7); misScatter(m, rng, 24); } },
  sides: [{ f: 'brood', base: false }, { f: 'alliance', name: 'Geleitzüge', base: false }],
  lock: null,
  outro: 'Der Korridor ist still. Die Matriarch wird satt sein – eine Weile.',
  setup(g, M) {
    const us = sortieOwn(g, M, ['leviathan', 'leviathan', 'ravager', 'ravager', 'ravager', 'spitter', 'spitter', 'swarm', 'swarm', 'swarm'], 1700, 1200, -Math.PI / 2);
    M.tag.levi = us.filter(u => u.type === 'leviathan').map(u => u.id);
    misSet(g, 'eat', 1, 0, 20); misSet(g, 'time', 1, 0, 360); misSet(g, 'more', 1, 0, 30); misSet(g, 'levi', 1);
    M.t.next = 4; M.f.k = 0; M.f.k0 = g.players[g.human].stats.kills;
    misSay(g, '(Beute. Viele.)', 'voice', 1);
  },
  step(g, M) {
    const n = g.players[g.human].stats.kills - M.f.k0;
    misGoal(g, 'eat').v = Math.min(20, n); misGoal(g, 'more').v = Math.min(30, n); misGoal(g, 'time').v = Math.min(360, Math.floor(g.time));
    if (n >= 20 && misOn(g, 'eat')) misSet(g, 'eat', 2);
    if (n >= 30 && misOn(g, 'more')) misSet(g, 'more', 2);
    if (misOn(g, 'levi') && misCount(g, M.tag.levi) < 2) misSet(g, 'levi', 3);
    if (g.time >= M.t.next && g.time < 340) {
      const k = M.f.k++, top = k % 2 === 0, y = top ? 450 : 1950, x0 = k % 4 < 2 ? 150 : 3250, x1 = 3400 - x0, a = x0 < x1 ? 0 : Math.PI;
      M.t.next = g.time + 30;
      const list = ['hauler', 'hauler', 'hauler', 'wren', 'lancer'].concat(k >= 3 ? ['lancer'] : [], k >= 6 ? ['bulwark'] : []);
      const cv = misTag(g, 'cv', misSpawn(g, 1, list, x0, y, a, { gap: 50 }));
      for (const u of cv) u.auto = false;
      (M.S.cv = M.S.cv || []).push({ ids: cv.map(u => u.id), x: x0, x1, y, d: x0 < x1 ? 1 : -1 });
      ev(g, 'ping', { x: x0, y, owner: g.human });
      misSay(g, top ? '(Beute im Norden.)' : '(Beute im Süden.)', 'voice');
    }
    /* Geleitzüge kriechen (schwer beladen): das Ziel wandert je Schritt ein Stück weiter; am Rand springen sie weg */
    for (const c of M.S.cv || []) {
      c.x += c.d * 16;
      for (const u of misLive(g, c.ids)) {
        if ((c.x - c.x1) * c.d >= 0 && Math.abs(u.x - c.x1) < 160) { ev(g, 'jump', { x: u.x, y: u.y, owner: 1, r: u.def.r, from: 1 }); removeShip(g, u); continue; }
        const armed = u.def.wpn.length, busy = armed && u.tgt;
        if (!busy) u.o = { t: 'move', x: c.x + (u.id % 4 - 1.5) * 45, y: c.y + (u.id % 3 - 1) * 45 };
      }
    }
    if (g.time >= 360 || (n >= 30 && !M.f.done)) { M.f.done = 1; if (n >= 20) misWin(g); else misLose(g, 'Der Korridor hat sich geschlossen'); }
  }
};

/* ------------------------------------------------------------------ 6 Belagerung (Alliance) */
MISSIONS.e6 = {
  act: 'e', name: 'Belagerung', f: 'alliance', who: 'hale', seed: 863, mins: 5, supply: false,
  tease: 'Sechs Geschütze, drei Catapults. Bleib außerhalb ihrer Reichweite.',
  brief: ['Die Piraten haben ein Depot mit sechs Geschütztürmen befestigt. Ein Sturm kostet uns die halbe Staffel.',
    'Du bekommst drei Catapults. Sie schießen weiter als jeder Turm, aber nur im Stand. Schütze sie vor Ausfällen und zerlege die Stellung Turm für Turm.'],
  hints: ['Die Stellung ist aufgeklärt: Befiehl den Catapults den Angriff auf einen Turm, sie halten von selbst Abstand.', 'Alle vierzig Sekunden bricht ein Trupp aus dem Depot aus. Stell die Bulwarks vor die Catapults.'],
  goals: [{ id: 'tur', t: 'Zerstöre die sechs Geschütztürme', n: 6 }, { id: 'depot', t: 'Zerstöre das Depot', later: 1 }, { id: 'art', t: 'Kein Catapult geht verloren', side: 1, keep: 1 }, { id: 'fast', t: 'Schaffe es in unter sechs Minuten', side: 1, keep: 1 }],
  map: { w: 3400, h: 2200, starts: [{ x: 500, y: 1100, ang: 0 }, { x: 2700, y: 1100, ang: Math.PI }],
    build(m, rng) { field(m, 1500, 450, 170, rng, 0.8); field(m, 1500, 1800, 170, rng, 0.8); misScatter(m, rng, 22); } },
  sides: [{ f: 'alliance', base: false }, { f: 'mars', name: 'Vex\' Piraten', color: '#d0453b', base: false }],
  lock: null,
  outro: 'Das Depot brennt. Hale lässt ausrichten, Geduld sei auch eine Waffe.',
  setup(g, M) {
    const us = sortieOwn(g, M, ['catapult', 'catapult', 'catapult', 'bulwark', 'bulwark', 'aegis', 'lancer', 'lancer', 'beacon'], 700, 1100, 0);
    M.tag.art = us.filter(u => u.type === 'catapult').map(u => u.id);
    const d = misBldg(g, 1, 'refinery', 2700, 1100, 3); d.label = 'Depot'; M.f.depot = d.id;
    M.tag.tur = [[2330, 900], [2330, 1300], [2540, 700], [2540, 1500], [2520, 980], [2520, 1220]].map(([x, y]) => misBldg(g, 1, 'turret', x, y, 2).id);
    misTag(g, 'gar', misSpawn(g, 1, ['hedgehog', 'needle', 'needle'], 2520, 1100, Math.PI, { hold: true }));
    misSet(g, 'tur', 1, 0, 6); misSet(g, 'art', 1); misSet(g, 'fast', 1);
    M.t.next = 25; M.f.k = 0;
    misMark(g, 'depot', 2700, 1100, 150, 'Depot');
    misReveal(g, 2540, 1100, 560, 1e6);   /* Aufklärung hat die Stellung vermessen: Artillerie braucht Sicht aufs Ziel */
    misSay(g, 'Catapults in Stellung bringen, dann Geduld. Die Türme reichen nicht so weit wie Sie.', 'hale', 1);
  },
  step(g, M) {
    const t = misCount(g, M.tag.tur), d = g.byId.get(M.f.depot);
    misGoal(g, 'tur').v = 6 - t;
    if (misOn(g, 'fast') && g.time > 360) misSet(g, 'fast', 3);
    if (misOn(g, 'art') && misCount(g, M.tag.art) < 3) misSet(g, 'art', 3);
    if (!t && misOn(g, 'tur')) { misSet(g, 'tur', 2); misSet(g, 'depot', 1); misSay(g, 'Alle Türme stumm. Jetzt das Depot.', 'hale'); }
    if (!d || d.dead) { misUnmark(g, 'depot'); misWin(g); return; }
    if (g.time >= M.t.next) {
      const k = M.f.k++; M.t.next = g.time + 40;
      const pack = misTag(g, 'sortie', misSpawn(g, 1, (k % 2 ? ['needle', 'needle', 'wasp'] : ['needle', 'needle', 'needle']).concat(k >= 3 ? ['hedgehog'] : [], k >= 6 ? ['spear'] : []), 2760, 1100 + (k % 2 ? 160 : -160), Math.PI));
      const art = misLive(g, M.tag.art), tg = art.length ? art[k % art.length] : null;
      if (tg) sortieCharge(g, pack, tg.x, tg.y);
      if (k === 0) misSay(g, 'Ausfall! Sie halten auf die Catapults zu.', 'hale');
    }
    if (g.tick % 60 === 5) misHunt(g, M.tag.sortie);
  },
  auto(g, M) {
    const tur = misLive(g, M.tag.tur), d = g.byId.get(M.f.depot), tg = tur.length ? tur.reduce((a, b) => b.x < a.x ? b : a, tur[0]) : d;
    if (!tg) return;
    const art = misLive(g, M.tag.art).filter(u => u.o.t === 'idle' || u.o.t === 'hold'), rest = misLive(g, M.tag.own).filter(u => u.type !== 'catapult' && (u.o.t === 'idle' || u.o.t === 'hold'));
    if (art.length) execCmd(g, { t: 'attack', p: g.human, u: art.map(u => u.id), e: tg.id });
    const al = misLive(g, M.tag.art), ax = al.length ? al.reduce((a, u) => a + u.x, 0) / al.length + 170 : 1350, far = rest.filter(u => hyp(u.x - ax, u.y - 1100) > 240);
    if (far.length && tur.length) execCmd(g, { t: 'move', p: g.human, u: far.map(u => u.id), x: ax, y: 1100, am: 1 });
    if (rest.length && !tur.length) execCmd(g, { t: 'attack', p: g.human, u: rest.map(u => u.id), e: tg.id });
  }
};
