/* ===== missions.js ===== */
'use strict';
/* =====================================================================
   DIE MISSIONEN DER KAMPAGNE »QUARANTINE«. Jede Mission: name, act, f (Fraktion des Spielers), brief (Absätze), who
   (Sprecher der Besprechung), hints, goals, map {w, h, starts, build}, sides, lock, setup, step, outro.
   Die Stille vor vierzig Jahren war kein Unfall, sondern eine Quarantäne gegen die Brood.
   ===================================================================== */
/* Rohstoffe an einem Start: Eismond und Erz in der Nähe, Richtung dir (zur Kartenmitte) */
function misRes(map, rng, s, dir) {
  iceMoon(map, s.x + dcos(dir + 0.9) * 330, s.y + dsin(dir + 0.9) * 330, rng);
  oreCluster(map, s.x + dcos(dir - 0.9) * 320, s.y + dsin(dir - 0.9) * 320, rng, 3);
}
function misScatter(map, rng, n) { scatter(map, n, rng, map.starts.concat(map.nodes, map.fields, map.sites, map.gates)); }
/* Brood-Verband nach Wert (Biomasse) zusammenstellen */
function broodPack(g, value, heavy) {
  const out = [];
  let guard = 0;
  while (value > 0 && guard++ < 80) {
    const r = g.rng();
    const t = heavy && r < 0.15 ? 'acidmaw' : r < 0.35 ? 'ravager' : r < 0.6 ? 'spitter' : 'swarm';
    out.push(t); value -= SHIPS[t].cost.ice;
  }
  return out;
}
/* Durchbruch aus einem Tor: Effekt und Verband */
function misBreach(g, owner, list, gt, ang) {
  ev(g, 'breach', { x: gt.x, y: gt.y, r: 120 });
  return misSpawn(g, owner, list, gt.x + dcos(ang) * 60, gt.y + dsin(ang) * 60, ang);
}

/* Nur für Tests und Messungen (Missionshilfe auto): die KI am Steuer des Spielers warf ihre Flotte früh gegen befestigte
   Basen. Stattdessen sammelt sich die Flotte vor der eigenen Basis und greift erst ab thr Kommandopunkten geschlossen
   das Ziel an (ohne Ziel: nur verteidigen); schrumpft sie unter ein Drittel, sammelt sie sich neu. skip: Schiffe, die
   eine eigene Aufgabe haben; at: Sammelpunkt statt vor der Basis. */
function misAutoArmy(g, M, tgt, thr, skip, at) {
  const pi = g.human, b = g.bldgs.find(x => !x.dead && x.owner === pi && x.role === 'base');
  const war = g.ships.filter(u => !u.dead && !u.derelict && u.owner === pi && u.def.role === 'war' && u.def.wpn.length && !(skip && skip(u)));
  const cp = war.reduce((a, u) => a + u.def.cp, 0);
  if (M.f.army === 1 && (cp < thr * 0.35 || !tgt)) M.f.army = 0;
  if (!M.f.army && tgt && cp >= thr) M.f.army = 1;
  const cx = g.map.w / 2, cy = g.map.h / 2, hx = at ? at.x : b ? b.x + (cx - b.x) * 0.18 : cx, hy = at ? at.y : b ? b.y + (cy - b.y) * 0.18 : cy;
  for (const u of war) {
    u.task = 1;
    if (M.f.army === 1) { if (u.o.t === 'idle' || u.o.t === 'hold' || (u.o.t === 'amove' && hyp(u.o.x - tgt.x, u.o.y - tgt.y) > 300)) { u.hold = false; u.o = { t: 'amove', x: tgt.x + (u.id % 5 - 2) * 25, y: tgt.y + (u.id % 3 - 1) * 25 }; u.path = null; } }
    else if ((u.o.t === 'idle' || u.o.t === 'hold') && hyp(u.x - hx, u.y - hy) > 320) { u.hold = false; u.o = { t: 'amove', x: hx + (u.id % 5 - 2) * 35, y: hy + (u.id % 4 - 1.5) * 35 }; u.path = null; }
  }
}

/* ================================================================== PROLOG: THE SILENCE ================ */
MISSIONS.p1 = {
  act: 'p', name: 'Die Stille', f: 'legion', who: 'vossY', seed: 101,
  brief: ['Vor vierzig Jahren. Das Imperium beherrscht den Kessel durch das Tornetz der Erbauer. Nur der Mars hat den Toren nie getraut und kämpft für seine Unabhängigkeit.',
    'Leutnant Ilya Voss führt eine Staffel der Imperialen Flotte an das Tor von Calder. Dort soll die Flotte durch das Tor zum Kern des Reichs zurückkehren – doch eine Vorhut der Republik lauert am Tor.'],
  hints: ['Tippe ein Schiff an, um es zu wählen; ein Tipp auf den Raum schickt es los. Zweimal schnell tippen wählt alle Schiffe dieses Typs auf dem Bildschirm.',
    'Die Taste »Auswahl« zieht einen Rahmen um mehrere Schiffe.', 'Ein Tipp auf einen Gegner greift ihn an. Lange auf eine Taste drücken zeigt die Erklärung.'],
  goals: [{ id: 'gate', t: 'Führe die Staffel zum Tor von Calder' }, { id: 'mars', t: 'Vernichte die Vorhut der Republik', later: 1 },
    { id: 'flee', t: 'Rückzug: Erreiche den Sammelpunkt im Westen', later: 1 }, { id: 'keep', t: 'Bring mindestens vier Schiffe heim', side: 1, min: 1, keep: 1 }],
  map: { w: 3400, h: 2200, starts: [{ x: 520, y: 1100, ang: 0 }, { x: 2900, y: 1100, ang: Math.PI }, { x: 700, y: 1500, ang: 0 }],
    build(m, rng) {
      gatePair(m, 2250, 1100, 3150, 300, 'active');
      field(m, 1500, 380, 210, rng); field(m, 1600, 1850, 230, rng); field(m, 2700, 1750, 160, rng, 0.8);
      iceMoon(m, 1200, 1500, rng, true);
      misScatter(m, rng, 26);
    } },
  sides: [{ f: 'legion', name: 'Imperiale Flotte', base: false }, { f: 'mars', name: 'Martian Republic', base: false }, { f: 'legion', name: 'Kaiserliche Garde', base: false, team: 0, color: '#ffe9a8' }],
  lock: { ships: [], bldgs: [], noDoc: true },
  outro: 'Das Tor von Calder erlischt – und mit ihm jedes Tor im Kessel. Die Flotte ist abgeschnitten, das Imperium zerfällt in einer Nacht. Niemand erfährt, wer den Befehl gab. Vierzig Jahre später …',
  setup(g, M) {
    const h = g.human, s = g.map.starts[0];
    const fleet = misSpawn(g, h, ['paladin', 'paladin', 'paladin', 'herald', 'herald', 'herald', 'bastion'], s.x, s.y, 0);
    fleet[0].hero = 'Ilya Voss';
    misTag(g, 'own', fleet);
    for (const u of fleet) u.auto = true;
    const sov = misSpawn(g, 2, ['sovereign', 'basilica', 'paladin', 'paladin'], 700, 1550, 0, { hold: true });
    sov[0].hero = 'Seraph'; misTag(g, 'guard', sov);
    for (const u of sov) u.stance = 2;
    const gt = g.gates[0]; gt.owner = 2;
    const v = misSpawn(g, 1, lv(g, ['needle', 'needle', 'hedgehog'], ['needle', 'needle', 'hedgehog', 'hedgehog', 'needle'], ['needle', 'needle', 'needle', 'hedgehog', 'hedgehog', 'hedgehog', 'spear']), gt.x + 240, gt.y, Math.PI, { hold: true });
    misTag(g, 'van', v);
    misSet(g, 'gate', 1); misSet(g, 'keep', 1, fleet.length, 4);
    misMark(g, 'gate', gt.x, gt.y, 300, 'Tor von Calder');
    misCam(g, gt.x, gt.y, 0.6, 2.5);
    misSay(g, 'Staffel Voss, hier spricht die Garde. Das Tor von Calder ist frei? Dann bringen Sie uns nach Hause.', 'seraph', 1);
    misSay(g, 'Verstanden, Seraph. Staffel, Formation halten – zum Tor.', 'vossY', 6);
    misSay(g, 'Tipp: Wähle die Staffel mit der Taste »Auswahl« und einem Rahmen, dann tippe in Richtung Tor.', 'hq', 10);
  },
  step(g, M) {
    const gt = g.gates[0];
    if (misOn(g, 'gate') && misNear(g, g.human, gt.x, gt.y, 700) >= 3) {
      misSet(g, 'gate', 2); misSet(g, 'mars', 1, 0, misIds(misLive(g, M.tag.van)).length); misUnmark(g, 'gate');
      misSay(g, 'Kontakt! Republik-Schiffe am Tor. Sie haben uns erwartet.', 'vossY');
      misHunt(g, M.tag.van);
    }
    if (misGoal(g, 'mars').st === 1) {
      const left = misCount(g, M.tag.van);
      misGoal(g, 'mars').v = misGoal(g, 'mars').n - left;
      if (!left) {
        misSet(g, 'mars', 2);
        M.t.jump = g.time + 4; M.f.phase = 1;
        misSay(g, 'Weg frei. Garde, Sie zuerst.', 'vossY');
        for (const u of misLive(g, M.tag.guard)) { u.hold = false; u.o = { t: 'move', x: gt.x - 30, y: gt.y + (u.id % 3 - 1) * 40 }; u.path = null; }
      }
    }
    /* die Garde springt, dann der Befehl des Kaisers */
    if (M.f.phase === 1) {
      for (const u of misLive(g, M.tag.guard)) if (hyp(u.x - gt.x, u.y - gt.y) < 110) { ev(g, 'jump', { x: u.x, y: u.y, owner: u.owner, r: u.def.r, from: 1 }); removeShip(g, u); }
      if (!misCount(g, M.tag.guard) || g.time > M.t.jump + 40) {
        M.f.phase = 2; M.t.dark = g.time + 6;
        for (const u of misLive(g, M.tag.guard)) removeShip(g, u);
        misSay(g, 'Seraph. Hier spricht der Kaiser. Schließen Sie das Tor. Alle Tore. Jetzt.', 'emperor');
        misSay(g, 'Bestätigt, Majestät.', 'seraph', 3);
        misCam(g, gt.x, gt.y, 0.75, 2);
      }
    }
    if (M.f.phase === 2 && g.time >= M.t.dark) {
      M.f.phase = 3;
      for (const t of g.gates) { t.state = 'dead'; t.owner = -1; }
      ev(g, 'gateDark', { x: gt.x, y: gt.y });
      misSay(g, 'Seraph? Seraph! Das Tor ist tot … die Hälfte der Flotte ist noch auf der anderen Seite!', 'vossY', 1);
      misSay(g, 'Hier spricht Kommandant Kessler. Ihr Kaiser hat Sie verraten, Imperiale. Ergeben Sie sich.', 'kessler', 6);
      M.t.main = g.time + 10;
    }
    if (M.f.phase === 3 && g.time >= M.t.main) {
      M.f.phase = 4;
      const list = lv(g, ['hedgehog', 'hedgehog', 'spear', 'needle', 'needle'], ['hammer', 'hedgehog', 'hedgehog', 'spear', 'needle', 'needle', 'needle'], ['hammer', 'hammer', 'hedgehog', 'hedgehog', 'hedgehog', 'spear', 'spear', 'needle', 'needle']);
      misTag(g, 'main', misSpawn(g, 1, list, 3000, 1100, Math.PI));
      misSet(g, 'flee', 1);
      M.S.rally = { x: 380, y: 380 }; misMark(g, 'rally', 380, 380, 320, 'Sammelpunkt');
      misReveal(g, 380, 380, 300, 600);
      misSay(g, 'Wir können sie nicht halten. Alle Schiffe: Rückzug zum Sammelpunkt im Nordwesten!', 'vossY');
    }
    if (M.f.phase === 4) {
      if (g.tick % 60 === 5) misHunt(g, M.tag.main);
      const own = g.ships.filter(u => !u.dead && !u.derelict && u.owner === g.human);
      misGoal(g, 'keep').v = own.length; misGoal(g, 'keep').n = 4;
      if (own.length < 4 && misOn(g, 'keep')) misSet(g, 'keep', 3);
      const home = own.filter(u => hyp(u.x - M.S.rally.x, u.y - M.S.rally.y) < 320).length;
      misGoal(g, 'flee').v = home; misGoal(g, 'flee').n = Math.max(1, Math.min(3, own.length));
      if (home >= Math.min(3, own.length) && home > 0) misWin(g);
    }
  }
};

/* ================================================================== AKT 1: HAVEN (Alliance) ================ */
const ALLY_CORE = ['pathfinder', 'hauler', 'wren', 'lancer', 'bulwark'];
const ALLY_BLDG = ['base', 'yard', 'refinery', 'reactor', 'lab', 'turret', 'shield', 'relay'];
MISSIONS.a1m1 = {
  act: 'a1', name: 'Zwölf Kolonien', f: 'alliance', who: 'voss', seed: 211, supply: false,
  brief: ['Vierzig Jahre nach der Stille. Aus den Trümmern des Imperiums sind zwölf Kolonien geworden, verbunden durch die Charta von Haven. Ilya Voss, einst Offizierin des Imperiums, ist heute Admiralin der Alliance.',
    'Der Piratenfürst Vex überfällt die Kolonien am Rand des Kessels. Errichte einen Stützpunkt, schütze die Kolonien und zerschlage Vex\' Basis im Osten.'],
  hints: ['Erst Werft und Reaktor; Frachter sammeln Eis und Erz von selbst.', 'Fällt mehr als eine Kolonie, ist die Mission verloren.', 'Lanzentürme an den Kolonien halten kleine Überfälle auf.'],
  goals: [{ id: 'build', t: 'Errichte Werft und Reaktor', n: 2 }, { id: 'col', t: 'Halte mindestens zwei der drei Kolonien', n: 3 },
    { id: 'vex', t: 'Zerstöre die Basis von Vex' }, { id: 'all', t: 'Verliere keine Kolonie', side: 1, keep: 1 }],
  map: { w: 3600, h: 2600, starts: [{ x: 520, y: 1300, ang: 0 }, { x: 3080, y: 1300, ang: Math.PI }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], 0); misRes(m, rng, m.starts[1], Math.PI);
      iceMoon(m, 1300, 560, rng); iceMoon(m, 1450, 2050, rng); oreCluster(m, 1900, 1300, rng, 3);
      field(m, 2300, 700, 200, rng); field(m, 2350, 1950, 220, rng); field(m, 1800, 300, 140, rng, 0.7);
      misSite(m, 'ruin', 2000, 2300);
      misScatter(m, rng, 30);
    } },
  sides: [{ f: 'alliance' }, { f: 'mars', name: 'Vex\' Piraten', color: '#d0453b', ai: [1, 1, 1] }],
  lock: { ships: ALLY_CORE, bldgs: ALLY_BLDG, noDoc: true },
  outro: 'Die Piraten fliehen. Vex meldet sich ein letztes Mal: »Nichts für ungut, Admiralin. Geschäft ist Geschäft. Ach – und Ihr Tor im Osten flackert. Wussten Sie das schon?«',
  setup(g, M) {
    const h = g.players[g.human];
    h.ice = lv(g, 2400, 1800, 1500); h.ore = lv(g, 1200, 900, 700);
    const cols = [[1150, 760, 'Kolonie Nera'], [1250, 1850, 'Kolonie Brask'], [800, 2150, 'Kolonie Ost-Haven']];
    M.tag.col = [];
    cols.forEach(([x, y, n], i) => { const b = misBldg(g, g.human, 'relay', x, y, 2); b.label = n; b.hull = b.hullMax = b.hullMax * lv(g, 2, 2, 2.6); M.tag.col.push(b.id); if (i < lv(g, 3, 2, 2)) misBldg(g, g.human, 'turret', x + 70, y + (i === 0 ? 60 : -60)); });
    misTag(g, 'own', misSpawn(g, g.human, ['lancer', 'lancer', 'wren'], 800, 1300, 0));
    misFortify(g, 1, lv(g, 0, 0, 2));
    misSet(g, 'build', 1, 0, 2); misSet(g, 'col', 1, 3, 3); misSet(g, 'vex', 1); misSet(g, 'all', 1);
    M.t.raid = lv(g, 220, 170, 140);
    misSay(g, 'Admiralin, die Kolonien Nera, Brask und Ost-Haven melden Piratenschiffe. Vex wird mutiger.', 'hq', 1);
    misSay(g, 'Hätten wir Kriegsschiffe statt Frachter gebaut, wäre er es nicht. Aber der Rat hört ja nicht auf mich.', 'dal', 7);
    misSay(g, 'Dann bauen wir jetzt, Ratsherr. Werft und Reaktor zuerst.', 'voss', 13);
  },
  step(g, M) {
    const pi = g.human;
    if (misOn(g, 'build')) { const v = (misHas(g, pi, 'yard') ? 1 : 0) + (misHas(g, pi, 'reactor') ? 1 : 0); misGoal(g, 'build').v = v; if (v === 2) { misSet(g, 'build', 2); misMark(g, 'vex', g.map.starts[1].x, g.map.starts[1].y, 420, 'Basis von Vex'); misSay(g, 'Werft und Reaktor stehen. Die Basis von Vex liegt im Osten – wir brauchen eine Flotte.', 'voss'); } }
    const alive = misCount(g, M.tag.col);
    misGoal(g, 'col').v = alive;
    if (alive < 3 && misOn(g, 'all')) { misSet(g, 'all', 3); misSay(g, 'Eine Kolonie ist gefallen. Das wird der Rat nicht vergessen.', 'dal'); }
    if (alive < 2) { misLose(g, 'Zu viele Kolonien sind gefallen'); return; }
    /* Überfälle auf die Kolonien */
    if (g.time >= M.t.raid && g.players[1].alive) {
      M.f.raids = (M.f.raids || 0) + 1; M.t.raid = g.time + lv(g, 160, 140, 135);
      const live = misLive(g, M.tag.col), tg = live[M.f.raids % live.length];
      const list = ['needle', 'needle'].concat(M.f.raids > 2 && g.mis.lvl > 1 ? ['hedgehog'] : []).concat(M.f.raids > 4 && g.mis.lvl > 2 ? ['needle', 'boarder'] : []);
      const r = misTag(g, 'raid', misSpawn(g, 1, list, 3100, tg.y < 1300 ? 400 : 2200, Math.PI));
      for (const u of r) { u.o = { t: 'amove', x: tg.x, y: tg.y }; }
      misSay(g, ['{0} meldet Piraten im Anflug!', tg.label], 'hq');
    }
    if (g.tick % 90 === 5) misHunt(g, M.tag.raid);
    if (!g.bldgs.some(b => !b.dead && b.owner === 1)) misWin(g);
  },
  auto(g, M) {
    /* nur für den Test: je zwei Kampfschiffe halten Wache an jeder Kolonie */
    const live = misLive(g, M.tag.col), own = g.ships.filter(u => !u.dead && u.owner === g.human && u.def.wpn.length && !u.colG);
    for (const c of live) { const n = g.ships.filter(u => !u.dead && u.colG === c.id).length; for (let i = n; i < 2 && own.length; i++) { const u = own.shift(); u.colG = c.id; u.task = 1; u.o = { t: 'move', x: c.x + 60, y: c.y + 60 }; u.path = null; } }
  }
};

MISSIONS.a1m2 = {
  act: 'a1', name: 'Das flackernde Tor', f: 'alliance', who: 'voss', seed: 223,
  brief: ['Seit Wochen flackert das alte Tor im Osten, zum ersten Mal seit der Stille. Ein Konvoi mit Eis für die Kolonien wartet im Süden auf freie Bahn, und die Torwache meldet Bewegungen auf der anderen Seite.',
    'Halte die Torwache und bring den Konvoi sicher an den Ostrand. Niemand weiß, was durch ein Tor kommt, das vierzig Jahre geschlossen war.'],
  hints: ['Der Konvoi fliegt los, sobald die Route frei ist, und hält an, wenn Feinde vor ihm stehen. Bleib in seiner Nähe.', 'Das Tor öffnet sich etwa jede Minute für einen Augenblick.'],
  goals: [{ id: 'escort', t: 'Bring den Konvoi zum Ostrand' }, { id: 'guard', t: 'Halte die Torwache' },
    { id: 'purge', t: 'Vernichte alle Eindringlinge', later: 1 }, { id: 'fast', t: 'Gewinne in unter zwölf Minuten', side: 1, keep: 1 }],
  map: { w: 3600, h: 2600, starts: [{ x: 480, y: 1100, ang: 0 }, { x: 2000, y: 900, ang: Math.PI }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], 0);
      gatePair(m, 2050, 900, 3250, 300, 'flicker');
      iceMoon(m, 1200, 1700, rng); oreCluster(m, 1250, 500, rng, 3);
      field(m, 1650, 1550, 180, rng, 0.8); field(m, 2600, 1500, 220, rng); field(m, 2900, 700, 150, rng, 0.7);
      misScatter(m, rng, 28);
    } },
  sides: [{ f: 'alliance' }, { f: 'brood', name: 'Unbekannt', base: false }],
  lock: { ships: ALLY_CORE.concat(['haven']), bldgs: ALLY_BLDG, noDoc: true },
  outro: 'Die Eindringlinge sind tot, aber ihre Kadaver bewegen sich noch Stunden später. Die Wissenschaftler nennen sie »die Brut«. Ratsherr Dal fordert Kriegsrecht. Voss schweigt – sie hat dieses Flackern schon einmal gesehen.',
  setup(g, M) {
    const h = g.players[g.human], gt = g.gates[0];
    h.ice = lv(g, 2000, 1600, 1300); h.ore = lv(g, 1000, 800, 650);
    misTag(g, 'own', misSpawn(g, g.human, lv(g, ['lancer', 'lancer', 'lancer', 'bulwark', 'wren', 'wren'], ['lancer', 'lancer', 'lancer', 'bulwark', 'wren'], ['lancer', 'lancer', 'bulwark', 'wren']), gt.x - 520, gt.y + 150, 0));
    const cv = misSpawn(g, g.human, ['hauler', 'hauler', 'hauler', 'hauler', 'hauler'], 500, 2250, 0, { gap: 40, hold: true });
    for (const u of cv) { u.auto = false; u.convoy = 1; }
    misTag(g, 'convoy', cv);
    const w = [misBldg(g, g.human, 'shield', gt.x - 300, gt.y + 120, 2), misBldg(g, g.human, 'turret', gt.x - 240, gt.y - 110, 2), misBldg(g, g.human, 'turret', gt.x - 330, gt.y + 270, 2), misBldg(g, g.human, 'turret', gt.x - 420, gt.y - 20, lv(g, 2, 1, 1))];
    for (const b of w) b.label = 'Torwache';
    misTag(g, 'ward', w);
    misSet(g, 'escort', 1); misSet(g, 'guard', 1); misSet(g, 'fast', 1);
    M.f.cvx = 500; M.t.next = 80; M.f.wave = 0;
    misMark(g, 'east', 3250, 2250, 200, 'Ostrand');
    misSay(g, 'Konvoi Achtzehn bereit. Wir starten, sobald die Route frei ist.', 'hq', 1);
    misSay(g, 'Torwache an Flotte: Das Tor flackert wieder. Diesmal … sehen wir etwas dahinter.', 'hq', 8);
  },
  step(g, M) {
    const gt = g.gates[0], h = g.human;
    if (misOn(g, 'fast') && g.time > 720) misSet(g, 'fast', 3);
    /* Konvoi: fliegt ab der zweiten Welle, solange kein Feind vor ihm steht */
    const cv = misLive(g, M.tag.convoy);
    if (misOn(g, 'escort')) {
      if (!cv.length) { misLose(g, 'Der Konvoi ist verloren'); return; }
      const lead = cv.reduce((a, u) => u.x > a.x ? u : a, cv[0]);
      const danger = g.ships.some(u => !u.dead && u.owner === 1 && hyp(u.x - lead.x, u.y - lead.y) < 420);
      if (M.f.go && !danger) { M.f.cvx = Math.min(3350, Math.max(M.f.cvx, lead.x) + 80); for (const u of cv) { u.hold = false; u.o = { t: 'move', x: M.f.cvx + (u.id % 5) * 12, y: 2250 + (u.id % 3 - 1) * 40 }; u.path = null; } }
      else for (const u of cv) if (u.o.t !== 'hold') { u.o = { t: 'hold' }; u.hold = true; }
      if (cv.every(u => u.x > 3150)) { misSet(g, 'escort', 2); misUnmark(g, 'east'); for (const u of cv) { ev(g, 'jump', { x: u.x, y: u.y, owner: h, r: u.def.r, from: 1 }); removeShip(g, u); } misSay(g, 'Konvoi Achtzehn ist durch. Danke, Admiralin.', 'hq'); }
    }
    if (misOn(g, 'guard') && !misLive(g, M.tag.ward).length) { misLose(g, 'Die Torwache ist gefallen'); return; }
    /* Wellen aus dem Tor */
    if (g.time >= M.t.next && M.f.wave < 6) {
      M.f.wave++; M.t.next = g.time + lv(g, 80, 70, 62);
      const k = M.f.wave, val = lv(g, 300, 420, 550) + k * lv(g, 220, 300, 380);
      const pack = misTag(g, 'brood', misBreach(g, 1, broodPack(g, val, k >= 4), gt, Math.PI * 0.85));
      if (k % 2) for (const u of pack) u.o = { t: 'amove', x: gt.x - 250, y: gt.y + 100 };
      if (k === 1) { misSay(g, 'Torwache: Etwas kommt durch! Das sind … keine Schiffe. Die bewegen sich wie Tiere!', 'hq'); misCam(g, gt.x, gt.y, 0.8, 2); }
      if (k === 2) { M.f.go = 1; misSay(g, 'Was zum … die leben. Die Dinger leben, Admiralin!', 'dal'); misSay(g, 'Konvoi Achtzehn startet jetzt. Geben Sie uns Deckung!', 'hq', 4); }
      if (k === 3 && misOn(g, 'escort')) {
        misAsk(g, 'save', 'Zwei Notrufe zugleich: Ein großer Schwarm hält auf den Konvoi zu, ein zweiter auf die Torwache. Wir schaffen nur einen. Wohin schicken wir die Flotte?',
          [['convoy', 'Den Konvoi retten', 'Das Eis versorgt die Kolonien – und den Handel mit dem Mars.'], ['gate', 'Die Torwache halten', 'Wer das Tor hält, sieht, was als Nächstes kommt.']], 'voss');
      }
    }
    /* Entscheidung: das andere geht verloren */
    if (M.ch.save && !M.f.applied) {
      M.f.applied = 1; M.t.lost = g.time + 12;
      misSay(g, M.ch.save === 'convoy' ? 'Torwache … wir halten nicht – sie sind überall –' : 'Konvoi Achtzehn an Flotte – wir werden – (Rauschen)', 'hq', 4);
    }
    if (M.t.lost && g.time >= M.t.lost) {
      M.t.lost = 0;
      const list = M.ch.save === 'convoy' ? misLive(g, M.tag.ward) : misLive(g, M.tag.convoy);
      if (M.ch.save === 'convoy') misSet(g, 'guard', 3); else { misSet(g, 'escort', 3); misUnmark(g, 'east'); }
      for (const e of list) kill(g, e, null, 1);
      misSay(g, M.ch.save === 'convoy' ? 'Die Torwache ist gefallen. Möge die Charta ihnen gnädig sein.' : 'Der Konvoi ist verloren. Alle Frachter.', 'voss');
    }
    if (g.tick % 60 === 5) misHunt(g, M.tag.brood);
    if (M.f.wave >= 3 && !misOn(g, 'purge') && misGoal(g, 'purge').st === 0) misSet(g, 'purge', 1);
    if (M.f.wave >= 6 && !misCount(g, M.tag.brood)) {
      misSet(g, 'purge', 2);
      if (misOn(g, 'guard')) misSet(g, 'guard', 2);
      if (!misOn(g, 'escort') && !M.t.lost) { if (!M.ch.save) M.ch.save = misGoal(g, 'escort').st === 2 ? (misGoal(g, 'guard').st === 2 ? 'both' : 'convoy') : 'gate'; misWin(g); }
    }
  }
};

MISSIONS.a1m3 = {
  act: 'a1', name: 'Haven hält', f: 'alliance', who: 'voss', seed: 239,
  brief: ['Die Brut hat am Tor ein Nest gebaut, und es wächst. Jede Stunde schlüpfen neue Schwärme, und ihr nächstes Ziel ist Haven selbst, die Hauptwelt der Charta.',
    'Halte Haven, bis die Verstärkung der Kolonien eintrifft, und brenne dann das Nest aus. Vorher will Voss wissen, was im Nest wächst: Eine getarnte Wren kommt nahe genug heran. In den Trümmern zwischen Haven und dem Tor liegt eine Ruine der Erbauer, die seit der Stille wieder leuchtet – und dort lauert etwas, das man nicht sieht.'],
  hints: ['Tarnung (zweite Fähigkeit der Wren): unsichtbar, bis sie schießt oder 25 Sekunden um sind. Geschütze und Nester entdecken sie in Waffenreichweite.', 'Sensorimpuls (Wren): deckt 8 Sekunden alles im Umkreis von 900 auf – auch Getarnte.', 'Schildgeneratoren und Lanzentürme vor der Basis brechen die ersten Wellen.', 'Die Ruine scannt ein Schiff, das daneben steht.'],
  goals: [{ id: 'scout', t: 'Kundschafte das Nest mit einer getarnten Wren aus' }, { id: 'hold', t: 'Halte Haven gegen drei Angriffswellen', n: 3 }, { id: 'nest', t: 'Zerstöre das Nest am Tor', later: 1 },
    { id: 'lurk', t: 'Spüre die Lauerer an der Ruine auf und vernichte sie', side: 1 }, { id: 'echo', t: 'Scanne die Erbauer-Ruine', side: 1 }, { id: 'arch', t: 'Die Archipelago überlebt', side: 1, keep: 1 }],
  map: { w: 3800, h: 2600, starts: [{ x: 560, y: 1300, ang: 0 }, { x: 3200, y: 1300, ang: Math.PI }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], 0);
      iceMoon(m, 1500, 600, rng); oreCluster(m, 1400, 2000, rng, 3); iceMoon(m, 2300, 1950, rng);
      gatePair(m, 3350, 1300, 3500, 250, 'flicker');
      field(m, 2200, 900, 220, rng); field(m, 2500, 1700, 180, rng); field(m, 1100, 300, 140, rng, 0.7);
      misSite(m, 'ruin', 1950, 1350);
      misScatter(m, rng, 30);
    } },
  sides: [{ f: 'alliance' }, { f: 'brood', name: 'The Brood', base: false }],
  lock: { ships: ALLY_CORE.concat(['haven', 'aegis', 'beacon', 'reckoning']), bldgs: ALLY_BLDG },
  outro: 'Das Nest brennt. In der Ruine flackert ein grünes Gesicht auf, das Echo eines Erbauers: »Ihr habt es wieder geöffnet. Wir haben es nicht ohne Grund geschlossen.« Dann ist es fort.',
  setup(g, M) {
    const h = g.players[g.human];
    h.ice = lv(g, 3000, 2400, 2000); h.ore = lv(g, 1600, 1300, 1000);
    misBldg(g, g.human, 'yard', 760, 1050); misBldg(g, g.human, 'reactor', 420, 1600); misBldg(g, g.human, 'turret', 900, 1450);
    const fl = misSpawn(g, g.human, ['archipelago', 'lancer', 'lancer', 'bulwark'], 950, 1300, 0);
    fl[0].hero = 'Ilya Voss'; misTag(g, 'arch', [fl[0]]);
    const s = g.map.starts[1];
    const nest = [misBldg(g, 1, 'base', s.x, s.y), misBldg(g, 1, 'spore', s.x - 200, s.y - 180), misBldg(g, 1, 'spore', s.x - 220, s.y + 200), misBldg(g, 1, 'turret', s.x - 260, s.y)];
    for (const b of nest) b.label = 'Nest';
    misTag(g, 'nest', nest);
    misTag(g, 'nguard', misSpawn(g, 1, broodPack(g, lv(g, 1000, 1500, 2100)), s.x - 300, s.y, Math.PI, { hold: true }));
    /* Fassung 20: zwei Wren für Tarnung und Sensorimpuls; getarnte Lauerer (Leech) an der Ruine */
    misTag(g, 'wren', misSpawn(g, g.human, ['wren', 'wren'], 820, 1080, 0));
    const lk = [];
    for (let i = 0, n = lv(g, 3, 4, 5); i < n; i++) { const a = i / n * TAU + 0.4, u = addShip(g, 'leech', 1, 1950 + dcos(a) * 210, 1350 + dsin(a) * 210, a); u.o = { t: 'hold' }; u.hold = true; u.abT.cloak = ABIL.cloak.dur; u.hx = u.x; u.hy = u.y; lk.push(u); }
    misTag(g, 'lurk', lk);
    misSet(g, 'scout', 1); misSet(g, 'hold', 1, 0, 3); misSet(g, 'lurk', 1, 0, lk.length); misSet(g, 'echo', 1); misSet(g, 'arch', 1);
    misMark(g, 'ruin', 1950, 1350, 130, 'Erbauer-Ruine'); misMark(g, 'scout', s.x - 100, s.y, 700, 'Nest');
    M.t.wave = lv(g, 200, 180, 160); M.f.wave = 0;
    misSay(g, 'Hier ist Haven. Alle Kolonien schicken, was sie haben – aber es braucht Zeit. Halten Sie durch, Admiralin.', 'hq', 1);
    misSay(g, 'Die erste Welle kommt in etwa drei Minuten. Bauen Sie Verteidigung.', 'voss', 7);
    misSay(g, 'Und die Kolonien wollen wissen, wogegen sie kämpfen. Eine Wren tarnen – zweite Fähigkeit – und bis an das Nest fliegen. Getarnt sieht sie nur, wer direkt neben ihr steht oder ein Geschütz hat.', 'voss', 14);
  },
  step(g, M) {
    const s = g.map.starts[1], pi = g.human;
    if (misOn(g, 'arch') && !misCount(g, M.tag.arch)) misSet(g, 'arch', 3);
    /* Aufklärung: eine getarnte Wren erreicht den Rand des Nests */
    if (misOn(g, 'scout') && (misLive(g, M.tag.nest).length === 0 || g.ships.some(u => !u.dead && u.owner === pi && u.type === 'wren' && u.abT.cloak > 0 && hyp(u.x - (s.x - 100), u.y - s.y) < 700))) {
      misSet(g, 'scout', 2); misUnmark(g, 'scout'); M.f.intel = 1;
      misReveal(g, s.x, s.y, 700, 45);
      misSay(g, 'Wren an Haven: Nest gesichtet. Drei Brutkammern, ein Säuregeschütz – und sie sammeln sich. Übertrage alles.', 'hq');
      misSay(g, 'Gut gemacht. Mit diesen Daten schicken die Kolonien die richtigen Schiffe.', 'voss', 5);
    }
    /* Lauerer: getarnt auf Posten; kommt ein Schiff zu nahe, greifen alle in der Nähe an (Schießen enttarnt) */
    for (const u of misLive(g, M.tag.lurk)) {
      if (u.o.t === 'idle') { u.o = { t: 'hold' }; u.hold = true; }
      if (u.o.t !== 'hold') continue;
      if (!(u.abT.cloak > 5)) u.abT.cloak = ABIL.cloak.dur;
      let tg = null, td = 360;
      for (const e of g.ships) if (!e.dead && !e.derelict && g.tm[e.owner] === g.tm[pi] && e.def.role !== 'fighter') { const d = hyp(e.x - u.x, e.y - u.y); if (d < td) { td = d; tg = e; } }
      if (tg) {
        for (const v of misLive(g, M.tag.lurk)) if (v.o.t === 'hold' && hyp(v.x - tg.x, v.y - tg.y) < 600) { v.hold = false; v.o = { t: 'attack', tid: tg.id, x: tg.x, y: tg.y }; v.tgt = tg.id; v.path = null; }
        if (!M.f.ambush) { M.f.ambush = 1; misSay(g, 'Lauerer! Getarnte Brut an der Ruine – wir sehen sie erst, wenn sie zubeißen. Eine Wren mit Sensorimpuls macht sie sichtbar!', 'voss'); }
      }
    }
    if (misOn(g, 'lurk')) { const q = misGoal(g, 'lurk'), left = misCount(g, M.tag.lurk); q.v = q.n - left; if (!left) { misSet(g, 'lurk', 2); misSay(g, 'Die Lauerer sind erledigt. Die Ruine gehört uns.', 'voss'); } }
    if (misOn(g, 'echo') && g.sites[0] && g.sites[0].scanned) { misSet(g, 'echo', 2); misUnmark(g, 'ruin'); misSay(g, '… geöffnet … wir haben es nicht ohne Grund … geschlossen …', 'echo'); }
    if (M.f.wave < 3 && g.time >= M.t.wave) {
      M.f.wave++; M.t.wave = g.time + lv(g, 130, 120, 110);
      const val = lv(g, 900, 1200, 1500) + M.f.wave * lv(g, 500, 700, 900);
      const pack = misTag(g, 'w' + M.f.wave, misSpawn(g, 1, broodPack(g, val, M.f.wave >= 2), s.x - 350, s.y + (M.f.wave - 2) * 300, Math.PI));
      if (M.f.wave === 3 && g.mis.lvl > 1) pack.push(...misSpawn(g, 1, ['leviathan'], s.x - 450, s.y, Math.PI));
      misTag(g, 'waves', pack);
      for (const u of pack) { u.o = { t: 'amove', x: g.map.starts[0].x, y: g.map.starts[0].y }; }
      misSay(g, ['Welle eins! Sie kommen über das Trümmerfeld.', 'Zweite Welle, größer als die erste.', 'Das ist alles, was sie haben – und es ist viel. Halten!'][M.f.wave - 1], 'voss');
    }
    if (g.tick % 60 === 5) misHunt(g, M.tag.waves, g.map.starts[0]);
    const done = [1, 2, 3].filter(k => M.tag['w' + k] && !misCount(g, M.tag['w' + k])).length;
    misGoal(g, 'hold').v = done;
    if (misOn(g, 'hold') && done >= 3) {
      misSet(g, 'hold', 2);
      if (misOn(g, 'scout')) misSay(g, 'Die Wellen sind gebrochen. Die Kolonien warten nur noch auf die Daten aus dem Nest – schickt die getarnte Wren!', 'voss');
    }
    /* Gegenangriff, sobald Haven gehalten hat und das Nest erkundet ist */
    if (misDone(g, 'hold') && misDone(g, 'scout') && misGoal(g, 'nest').st === 0 && misCount(g, M.tag.nest)) {
      misSet(g, 'nest', 1); misMark(g, 'nest', s.x - 100, s.y, 420, 'Nest');
      misReveal(g, s.x, s.y, 600, 60); misCam(g, s.x, s.y, 0.7, 2);
      misSay(g, 'Die Kolonien sind da! Jetzt drehen wir den Spieß um. Brennt das Nest aus.', 'voss');
      const rf = misSpawn(g, g.human, lv(g, ['lancer', 'lancer', 'bulwark', 'haven'], ['lancer', 'lancer', 'bulwark'], ['lancer', 'bulwark']), 300, 300, 0.4);
      misTag(g, 'own', rf);
    }
    if (misGoal(g, 'nest').st <= 1 && !misCount(g, M.tag.nest)) misSet(g, 'nest', 2);
    if (misDone(g, 'nest') && misDone(g, 'hold') && misDone(g, 'scout')) misWin(g);
  },
  auto(g, M) {
    /* nur für den Test: eine Wren tarnt sich und fliegt an den Rand des Nests */
    if (!misOn(g, 'scout')) return;
    const s = g.map.starts[1], w = misLive(g, M.tag.wren).concat(g.ships.filter(u => !u.dead && u.owner === g.human && u.type === 'wren'))[0];
    if (!w) return;
    w.task = 1;
    const tx = s.x - 650, ty = s.y - 200, d = hyp(w.x - tx, w.y - ty);
    if (d < 1500 && !(w.abT.cloak > 0) && !(w.abcd.cloak > 0)) cmdAbility(g, g.human, [w.id], 'cloak');
    if (w.o.t !== 'move' && (w.abT.cloak > 0 || d > 1500)) { w.o = { t: 'move', x: tx, y: ty }; w.path = null; }
    else if (w.o.t !== 'move' && d <= 1500) { w.o = { t: 'move', x: tx - 900, y: ty }; w.path = null; }
  }
};

/* ================================================================== AKT 2: THE LONG BURN (Martian Republic) ================ */
const MARS_CORE = ['prospector', 'icehauler', 'needle', 'hedgehog', 'spear', 'hammer', 'boarder'];
const MARS_BLDG = ['base', 'yard', 'refinery', 'reactor', 'lab', 'turret', 'flak', 'relay'];
/* a2m1: Mittelpunkt des Nebelbogens um die Kaskade (unterhalb des Kartenrands), Bauplatz und Wrackfeld */
const M_A2M1_K = { x: 1900, y: 2650, bx: 1920, by: 2130, wx: 1150, wy: 1250 };
MISSIONS.a2m1 = {
  act: 'a2', name: 'Ankunft', f: 'mars', who: 'kessler', seed: 307,
  brief: ['Sieben Jahre Flug unter Fackelantrieb. Die Flotte der Republik erreicht den Kessel, ohne ein einziges Tor zu benutzen – der Mars hat ihnen nie getraut. Kommandantin Mara Kessler soll einen Brückenkopf errichten.',
    'Doch nicht alle in der Charta freuen sich über die Ankunft. Ratsherr Aren Dal hat eigenmächtig eine Kampfgruppe geschickt, um »die Imperialisten von gestern« aufzuhalten.',
    'Nach sieben Jahren sind die Lager leer. Vor dem Landeplatz treibt ein Wrackfeld aus der Nacht der Stille – Bergungsgut. Die reichen Eisfelder der Kaskade im Süden liegen hinter einem Ionennebel, in dem nichts gebaut werden kann: Dort hilft nur eine Außenbasis.'],
  hints: ['Mars-Schiffe haben keine Schilde, aber dicke Panzerung. Hedgehogs schießen Torpedos und Jäger ab.', 'Bergung: Frachter wählen und ein Wrack antippen – sie zerlegen es und bringen Erz heim.', 'Außenbasis: Das Bauschiff kann eine weitere Kommandobasis überall errichten, auch fern der eigenen Stationen. Um sie herum lässt sich wieder bauen.', 'Boarder entern Schiffe, deren Crew geschwächt ist.'],
  goals: [{ id: 'base', t: 'Baue die Werft auf Stufe II aus' }, { id: 'outpost', t: 'Errichte eine Außenbasis an der Kaskade' }, { id: 'dal', t: 'Zerstöre die Kommandobasis der Hardliner' },
    { id: 'salv', t: 'Berge Erz aus dem Wrackfeld', side: 1, n: 900 }, { id: 'board', t: 'Kapere ein Schiff der Alliance', side: 1 }],
  map: { w: 3600, h: 2600, starts: [{ x: 520, y: 1700, ang: -0.3 }, { x: 3080, y: 900, ang: Math.PI - 0.3 }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], -0.3); misRes(m, rng, m.starts[1], Math.PI - 0.3);
      iceMoon(m, 1700, 1300, rng, true); oreCluster(m, 1300, 600, rng, 3); oreCluster(m, 950, 1500, rng, 2);
      field(m, 900, 950, 150, rng, 0.8); field(m, 2500, 300, 200, rng); field(m, 2150, 1250, 120, rng, 0.6);
      /* Fassung 20: die Kaskade – reiche Vorkommen im Süden hinter einem Ionennebel (zu breit für eine Relaiskette),
         erreichbar nur mit einer Außenbasis */
      const K = M_A2M1_K;
      for (let k = 0; k <= 12; k++) { const a = Math.PI + k / 12 * Math.PI; nebula(m, K.x + Math.cos(a) * 900, K.y + Math.sin(a) * 900, 270, 'ion'); }
      iceMoon(m, 1680, 2290, rng, true); iceMoon(m, 2160, 2270, rng); oreCluster(m, 1920, 2450, rng, 3);
      misScatter(m, rng, 30);
    } },
  sides: [{ f: 'mars' }, { f: 'alliance', name: 'Hardliner von Aren Dal', color: '#7aa7d8', ai: [1, 2, 2] }],
  lock: { ships: MARS_CORE, bldgs: MARS_BLDG },
  outro: 'Dals Kampfgruppe ist zerschlagen. Admiralin Voss entschuldigt sich über offenen Funk – und bittet die Republik um Hilfe gegen die Brut. Kessler nimmt an. Aber sie will zuerst ein Tor in die Hand bekommen.',
  setup(g, M) {
    const h = g.players[g.human], c = M.carry;
    h.ice = lv(g, 2400, 2000, 1700); h.ore = lv(g, 1300, 1100, 900);
    if (c.save === 'convoy' || c.save === 'both') { h.ice += 1500; h.ore += 800; M.f.bonus = 1; }
    const fl = misSpawn(g, g.human, ['hedgehog', 'hedgehog', 'needle', 'needle', 'boarder'], 800, 1550, -0.3);
    fl[4].hero = 'Sgt. Okafor'; misTag(g, 'own', fl);
    misFortify(g, 1, lv(g, 2, 2, 2));
    /* Wrackfeld aus der Nacht der Stille: alte Imperiumsschiffe, bergbar (Bergung, Fassung 18), zerfallen nicht */
    const K = M_A2M1_K, wl = ['sovereign', 'bastion', 'paladin', 'paladin', 'basilica', 'inquisitor'];
    M.S.wr = [];
    wl.forEach((t, i) => { const a = i * 2.2, d = 60 + (i % 3) * 70, w = { x: K.wx + dcos(a) * d, y: K.wy + dsin(a) * d, ang: a * 1.7, type: t, owner: -1, until: 1e9, id: g.nextId++, sal: [420, 260, 180, 180, 300, 220][i] }; g.wrecks.push(w); M.S.wr.push([w.id, w.sal]); });
    misSet(g, 'base', 1); misSet(g, 'outpost', 1); misSet(g, 'dal', 1); misSet(g, 'salv', 1, 0, 900); misSet(g, 'board', 1);
    misMark(g, 'kas', K.bx, K.by + 120, 330, 'Kaskade'); misMark(g, 'wr', K.wx, K.wy, 220, 'Wrackfeld');
    misReveal(g, K.bx, K.by + 150, 450, 30);
    if (c.save === 'gate' || c.save === 'both') M.t.rf = 90;
    misSay(g, 'Flotte, hier Kessler. Willkommen im Kessel. Errichtet den Brückenkopf, bevor uns jemand willkommen heißt.', 'kessler', 1);
    misSay(g, 'Kommandantin, die Alliance hat ein Begrüßungskomitee geschickt. Mit Kanonen.', 'bricks', 8);
    misSay(g, 'Unsere Lager sind leer. Schickt die Frachter ins Wrackfeld – Frachter wählen, Wrack antippen. Vierzig Jahre altes Imperiumserz ist immer noch Erz.', 'kessler', 15);
    misSay(g, 'Und die Kaskade im Süden: Eis für Jahre, aber hinter einem Ionennebel. Eine Relaiskette kommt da nicht durch – das Bauschiff muss eine Außenbasis direkt an die Felder setzen.', 'kessler', 30);
    if (M.f.bonus) misSay(g, 'Der Konvoi, den die Alliance gerettet hat, bringt uns Eis und Erz. Wenigstens einer dort mag uns.', 'bricks', 22);
  },
  step(g, M) {
    const pi = g.human, K = M_A2M1_K;
    if (misOn(g, 'base') && misHasLv(g, pi, 'yard', 2)) { misSet(g, 'base', 2); misMark(g, 'dal', g.map.starts[1].x, g.map.starts[1].y, 420, 'Hardliner'); misSay(g, 'Werft Stufe II. Jetzt bauen wir Kreuzer.', 'kessler'); }
    /* Außenbasis an der Kaskade: eine fertige eigene Kommandobasis innerhalb des Nebelbogens */
    if (misOn(g, 'outpost') && g.bldgs.some(b => !b.dead && b.done && b.owner === pi && b.role === 'base' && hyp(b.x - K.x, b.y - K.y) < 640)) {
      misSet(g, 'outpost', 2); misUnmark(g, 'kas');
      misSay(g, 'Die Außenbasis an der Kaskade steht. Raffinerie daneben, und die Frachter haben Arbeit für Jahre.', 'kessler');
    }
    /* Bergung: was aus den Wracks des Feldes geholt wurde */
    if (misOn(g, 'salv')) {
      let got = 0;
      for (const [id, s0] of M.S.wr) { const w = g.wrecks.find(q => q.id === id); got += s0 - (w ? Math.max(0, w.sal) : 0); }
      misGoal(g, 'salv').v = Math.min(900, Math.round(got));
      if (got >= 900) { misSet(g, 'salv', 2); misUnmark(g, 'wr'); misSay(g, 'Das Wrackfeld ist ausgeschlachtet. Der Kaiser hätte sich gefreut, wie gut seine Schiffe noch brennen.', 'bricks'); }
    }
    if (M.t.rf && g.time >= M.t.rf) { M.t.rf = 0; misTag(g, 'own', misSpawn(g, pi, ['spear', 'spear', 'hedgehog'], 300, 2300, -0.6)); misSay(g, 'Verstärkung durch das Tor, das die Alliance gehalten hat. Seltsam, dass wir ihnen danken müssen.', 'kessler'); }
    if (misOn(g, 'board') && g.ships.some(u => !u.dead && u.owner === pi && u.def.f === 'alliance')) { misSet(g, 'board', 2); misSay(g, 'Gekapert! Hübsch sauber, so ein Alliance-Schiff. Schade drum.', 'bricks'); }
    if (misOn(g, 'dal') && !g.bldgs.some(b => !b.dead && b.owner === 1 && b.role === 'base')) {
      misSet(g, 'dal', 2); misUnmark(g, 'dal');
      misSay(g, 'Hier spricht Aren Dal. Das wird Folgen haben, Republik.', 'dal');
      if (misOn(g, 'outpost')) misSay(g, 'Die Hardliner sind fort. Jetzt die Außenbasis an der Kaskade – ohne Eis hält kein Brückenkopf.', 'kessler', 5);
    }
    if (misDone(g, 'dal') && misDone(g, 'outpost')) misWin(g);
  },
  auto(g, M) {
    /* nur für den Test: wie Kessler rät, setzt das Bauschiff die Außenbasis an die Kaskade, sobald sie bezahlbar ist */
    const pi = g.human, p = g.players[pi], K = M_A2M1_K;
    if (!misOn(g, 'outpost') || g.bldgs.some(b => !b.dead && b.owner === pi && b.role === 'base' && hyp(b.x - K.x, b.y - K.y) < 640)) return;
    const b = g.ships.find(u => !u.dead && u.owner === pi && u.def.build && u.o.t !== 'build');
    if (b && canPay(p, bcost(p, BLDG.mars.base)) && g.time > 20) execCmd(g, { t: 'build', p: pi, u: [b.id], role: 'base', x: K.bx, y: K.by });
  }
};

MISSIONS.a2m2 = {
  act: 'a2', name: 'Torsturm', f: 'mars', who: 'kessler', seed: 331,
  brief: ['Ein totes Erbauer-Tor im Grenzgebiet. Wer es aktiviert, kann Flotten über den halben Kessel springen lassen. Der Mars will es haben, bevor die Alliance auf dieselbe Idee kommt.',
    'Ein Tor erwacht nur mit Relikten aus den Ruinen der Erbauer. Das Problem: Vex hat seine Festung um das tote Tor herum gebaut – hinter einem Felsring, mit Geschützen und einer Garnison. Wer das Tor will, muss die Festung knacken.'],
  hints: ['Ein Schiff neben einer Ruine scannt sie. Jede Ruine hier birgt mindestens ein Relikt.', 'Die Garnison der Festung verlässt ihre Posten nur, wenn du ihr zu nahe kommst, und wird aus dem Kern nachgebaut. Erst eine Flotte sammeln, dann mit allem zugleich durch eine Pforte.', 'Hammer und Spear brechen Geschütze aus der Distanz. Fällt der Kern, gehört der Schatz dir.', 'Ein Tor aktiviert man, indem man es 20 Sekunden mit Kampfschiffen hält und drei Relikte zahlt.'],
  goals: [{ id: 'relics', t: 'Sammle drei Relikte aus den Ruinen', n: 3 }, { id: 'fort', t: 'Knacke Vex\' Festung: Zerstöre oder entere ihren Kern' }, { id: 'gate', t: 'Aktiviere das Tor', later: 1 }, { id: 'legion', t: 'Vernichte, was durch das Tor kommt', later: 1 },
    { id: 'fast', t: 'Knacke die Festung in unter 15 Minuten', side: 1 }],
  map: { w: 3800, h: 2800, starts: [{ x: 520, y: 1400, ang: 0 }, { x: 2950, y: 2000, ang: Math.PI }, { x: 2600, y: 1680, ang: Math.PI }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], 0);
      /* Fassung 20: das tote Tor liegt innerhalb von Vex' Festung (Piratenfestung wie in Corsair's Keep) hinter einem
         Felsring mit zwei Pforten (West, Nord) */
      gatePair(m, 2600, 1680, 3400, 450, 'dead');
      for (const [x, y] of [[1300, 500], [1450, 2300], [2150, 1050]]) misSite(m, 'ruin', x, y);
      iceMoon(m, 1500, 1400, rng); oreCluster(m, 2200, 600, rng, 3); oreCluster(m, 2150, 2250, rng, 2); oreCluster(m, 880, 1430, rng, 3); oreCluster(m, 1050, 800, rng, 2);
      field(m, 1800, 950, 180, rng); field(m, 1750, 1850, 160, rng); field(m, 2900, 950, 160, rng, 0.8);
      const F = { x: 2950, y: 2000, r: 330 }, pts = [];
      for (let k = 0; k <= 48; k++) { const a = k / 48 * TAU; pts.push([F.x + Math.cos(a) * 640, F.y + Math.sin(a) * 640]); }
      const gaps = [[0.5, 240], [0.75, 240]];
      belt(m, pts, 130, rng, gaps.map(([t]) => [t, 280]), 0.5); wall(m, pts, rng, gaps, 26);
      m.fort = F;
      scatter(m, 26, rng, m.starts.concat(m.nodes, m.fields, m.sites, m.gates, [{ x: F.x, y: F.y, r: 700 }]));
    } },
  sides: [{ f: 'mars' }, { f: 'alliance', name: 'Vex\' Piraten', color: '#d0453b', base: false }, { f: 'legion', name: 'Die erwachende Legion', base: false }],
  lock: { ships: MARS_CORE.concat(['longshot', 'dropship', 'wasp']), bldgs: MARS_BLDG },
  outro: 'Vex\' Festung ist ein rauchender Felsring, und die ersten Schiffe der Legion treiben als goldene Wracks im All – und richten sich langsam wieder auf. Kessler funkt an alle: »Die Legion ist zurück. Das Imperium ist zurück.« Niemand antwortet. Nur Vex lacht irgendwo im Rauschen.',
  setup(g, M) {
    const h = g.players[g.human], vp = g.map.starts[1];
    h.ice = lv(g, 2600, 2200, 1800); h.ore = lv(g, 1400, 1200, 1000);
    misBldg(g, g.human, 'yard', 720, 1150, 2); misBldg(g, g.human, 'reactor', 380, 1700);
    misTag(g, 'own', misSpawn(g, g.human, ['spear', 'hedgehog', 'hedgehog', 'needle', 'needle'].concat(lv(g, ['hammer', 'spear'], ['spear'], [])), 850, 1450, 0));
    /* Vex' Festung (fortSetup in sim.js): Garnison und Geschütze nach Schwierigkeit; Leicht ohne zwei Geschütze */
    const fp = g.players[g.pirate];
    fp.name = 'Vex\' Piraten'; fp.color = '#d0453b';
    misFortTune(g, { cap: lv(g, 4, 5, 6), turrets: lv(g, 3, 4, 5), tlv: 1, flak: lv(g, 1, 2, 2), core: 2 });
    for (const b of g.bldgs) if (!b.dead && b.owner === g.pirate) b.label = 'Vex\' Festung';
    misTag(g, 'pir', misSpawn(g, 1, lv(g, ['lancer', 'wren', 'wren'], ['lancer', 'lancer', 'wren', 'wren'], ['lancer', 'lancer', 'bulwark', 'wren', 'wren']), vp.x - 760, vp.y - 120, Math.PI, { hold: true }));
    misSet(g, 'relics', 1, 0, 3); misSet(g, 'fort', 1); misSet(g, 'fast', 1);
    g.sites.forEach((st, i) => { if (st.kind === 'ruin') misMark(g, 'ruin' + i, st.x, st.y, 130, 'Ruine'); });
    misMark(g, 'fort', vp.x, vp.y, 460, 'Vex\' Festung');
    misReveal(g, vp.x, vp.y, 520, 25);
    M.t.raid = lv(g, 240, 190, 150); M.f.scan = [0, 0, 0];
    misCam(g, vp.x, vp.y, 0.7, 2.5);
    misSay(g, 'Da ist es. Ein Tor der Erbauer, tot wie ein Stein – mitten in einer Piratenfestung. Holt erst die Relikte aus den Ruinen.', 'kessler', 1);
    misSay(g, 'Vex hat seine Festung um das Tor gebaut. Wer durchwill, zahlt Zoll. Ich sag ja nur.', 'bricks', 7);
    misSay(g, 'Hier spricht Vex. Willkommen im Kessel, Republik. Meine Festung steht seit zehn Jahren. Kommt ruhig vorbei.', 'vex', 14);
    misSay(g, 'Die Garnison bleibt auf ihren Posten, bis wir zu nahe kommen. Wir sammeln eine Flotte und gehen mit allem zugleich durch eine Pforte.', 'kessler', 22);
  },
  step(g, M) {
    const pi = g.human, h = g.players[pi], gt = g.gates[0];
    /* jede Ruine gibt hier sicher ein Relikt (dazu, was der Scan sonst bringt) */
    g.sites.forEach((st, i) => { if (st.kind === 'ruin' && st.scanned) misUnmark(g, 'ruin' + i); if (st.kind === 'ruin' && st.scanned && !M.f.scan[i] && st.owner === pi) { M.f.scan[i] = 1; grantRelics(g, pi, 1, st.x, st.y, 'Relikt der Erbauer'); } });
    if (misOn(g, 'relics')) { misGoal(g, 'relics').v = Math.min(3, h.relics); if (h.relics >= 3) { misSet(g, 'relics', 2); misSet(g, 'gate', 1); misMark(g, 'gate', gt.x, gt.y, 200, 'Totes Tor'); misReveal(g, gt.x, gt.y, 400, 60); misSay(g, g.fort.done ? 'Drei Relikte. Jetzt das Tor: zwanzig Sekunden halten, dann erwacht es.' : 'Drei Relikte. Jetzt die Festung – das Tor liegt in ihrer Mitte. Danach zwanzig Sekunden am Tor halten.', 'kessler'); } }
    /* die Festung: fällt der Kern (zerstört oder geentert), gehört Vex' Beute dem Eroberer (fortFall in sim.js) */
    if (misOn(g, 'fort') && g.fort.done) {
      misSet(g, 'fort', 2); misUnmark(g, 'fort');
      if (misOn(g, 'fast')) misSet(g, 'fast', 2);
      misSay(g, 'Der Kern brennt! Und seht euch das an – Relikte, Eis, Erz. Vex hat gut gesammelt.', 'bricks');
      misSay(g, 'Nimm die Steine, Kommandantin. Ich habe noch andere Festungen. Wir sehen uns.', 'vex', 6);
      if (misOn(g, 'gate')) misSay(g, 'Die Geschütze am Tor räumen, dann zwanzig Sekunden halten.', 'kessler', 10);
    }
    if (misOn(g, 'fast') && g.time > 900) misSet(g, 'fast', 3);
    /* solange der Kern steht, schirmt er das Tor ab: die Aktivierung bleibt kurz vor dem Ende stehen */
    if (!g.fort.done && gt.state !== 'active' && gt.prog > 0.9) {
      gt.prog = 0.9;
      if (!M.f.shield) { M.f.shield = 1; misSay(g, 'Das Tor reagiert nicht! Der Festungskern schirmt es ab – erst muss der Kern fallen.', 'bricks'); }
    }
    if (misGoal(g, 'relics').st === 1 && misOn(g, 'gate') === false && h.relics < 3 && M.f.scan.every(x => x) && !M.f.gift) { M.f.gift = 1; grantRelics(g, pi, 3 - h.relics, gt.x, gt.y, 'Ein Relikt von Vex\' Leuten, eingesammelt'); }
    if (misOn(g, 'gate') && gt.state === 'active' && gt.owner === pi) {
      misSet(g, 'gate', 2); misSet(g, 'legion', 1); misUnmark(g, 'gate');
      M.t.leg = g.time + 6;
      misCam(g, gt.x, gt.y, 0.7, 2);
      misSay(g, 'Das Tor lebt! Kommandantin, da kommt etwas durch – auf unserer Frequenz!', 'bricks');
      misSay(g, 'Republik. Ihr habt das Tor geöffnet. Die Legion erwacht. Und die Legion erinnert sich an euch.', 'seraph', 4);
    }
    if (M.t.leg && g.time >= M.t.leg) {
      /* die Vorhut kommt in zwei Schüben: erst die Paladine, dann die schweren Schiffe mit Cassius */
      const first = !M.f.leg1;
      M.f.leg1 = 1; M.t.leg = first ? g.time + 22 : 0;
      const list = first ? lv(g, ['paladin', 'paladin', 'herald'], ['paladin', 'paladin', 'paladin', 'herald'], ['paladin', 'paladin', 'paladin', 'herald', 'herald'])
        : lv(g, ['paladin', 'herald', 'bastion', 'inquisitor'], ['paladin', 'herald', 'bastion', 'bastion', 'inquisitor'], ['paladin', 'paladin', 'herald', 'bastion', 'bastion', 'inquisitor', 'basilica']);
      const pack = misBreach(g, 2, list, gt, Math.PI);
      if (!first) { pack[pack.length - 1].hero = 'Cassius'; misSay(g, 'Zweiter Schub! Schwere Einheiten – und ein Heldenschiff.', 'bricks'); }
      M.tag.leg = (M.tag.leg || []).concat(pack.map(u => u.id));
    }
    if (g.tick % 60 === 5) { misHunt(g, M.tag.leg); }
    if (misOn(g, 'legion') && M.f.leg1 && !M.t.leg && !misLive(g, M.tag.leg).some(u => u.owner === 2)) misWin(g);
    /* Raubzüge mit gestohlenen Alliance-Schiffen, solange die Festung steht */
    if (g.time >= M.t.raid && !g.fort.done) {
      M.t.raid = g.time + lv(g, 190, 160, 130);
      const vp = g.map.starts[1];
      misTag(g, 'pir', misSpawn(g, 1, lv(g, ['wren', 'wren'], ['lancer', 'wren', 'wren'], ['lancer', 'lancer', 'wren', 'wren']), vp.x - 760, vp.y - 60, Math.PI));
    }
    if (g.tick % 90 === 35) misHunt(g, M.tag.pir.filter(id => { const u = g.byId.get(id); return u && !u.hold; }));
  },
  auto(g, M) {
    /* nur für den Test: je ein Schiff an jede ungescannte Ruine; mit genug Flotte gegen die Festung (die KI meidet sie);
       mit drei Relikten die Flotte ans Tor */
    const own = g.ships.filter(u => !u.dead && u.owner === g.human && u.def.wpn.length);
    g.sites.forEach((st, i) => { if (st.kind !== 'ruin' || st.scanned) return; if (!own.some(u => u.ruin === i)) { const u = own.find(x => x.ruin === undefined); if (u) { u.ruin = i; u.task = 1; u.o = { t: 'move', x: st.x + st.r + 50, y: st.y }; u.path = null; } } });
    const war = own.filter(u => u.def.role === 'war'), cp = war.reduce((a, u) => a + u.def.cp, 0);
    const thr = lv(g, 30, 38, 44);
    if (M.f.storm === 1 && cp < thr * 0.35 && g.time < 1200) M.f.storm = 0;
    /* bis zum Sturm sammelt sich die Flotte vor der eigenen Werft (die KI jagte sonst Raubzüge bis unter die Festungsgeschütze) */
    if (!M.f.storm && !g.fort.done) for (const u of war) if (u.ruin === undefined && (u.o.t === 'idle' || u.o.t === 'hold' || !u.task)) { u.task = 1; if (hyp(u.x - 1000, u.y - 1350) > 260) { u.hold = false; u.o = { t: 'amove', x: 1000 + (u.id % 5) * 30, y: 1350 + (u.id % 7) * 25 }; u.path = null; } }
    if (!g.fort.done && (M.f.storm || cp >= thr || g.time > 1200)) { M.f.storm = 1; const c = g.byId.get(g.fort.core); for (const u of war) if (c && u.o.t !== 'amove' && u.ruin === undefined) { u.task = 1; u.hold = false; u.o = { t: 'amove', x: c.x, y: c.y }; u.path = null; } }
    if (g.fort.done && M.f.storm === 1) { M.f.storm = 2; for (const u of war) u.task = 0; }
    if (misOn(g, 'gate') && g.fort.done && (own.length >= 11 || g.time > 600)) { const gt = g.gates[0]; for (const u of own) { u.task = 1; if (u.o.t === 'idle' && hyp(u.x - gt.x, u.y - gt.y) > 200) { u.o = { t: 'amove', x: gt.x - 120 + (u.id % 5) * 20, y: gt.y }; u.path = null; } } }
  }
};

/* ================================================================== AKT 3: AWAKENING (Golden Legion) ================ */
const LEG_CORE = ['restorer', 'gleaner', 'herald', 'paladin', 'bastion', 'inquisitor', 'reliquary', 'basilica'];
const LEG_BLDG = ['base', 'yard', 'refinery', 'reactor', 'lab', 'turret', 'shield', 'relay'];
MISSIONS.a3m1 = {
  act: 'a3', name: 'Erwachen', f: 'legion', who: 'seraph', seed: 409,
  brief: ['Vierzig Jahre Wachschlaf. Die Legion war die Elitegarde des Imperiums; in jedem Kriegsschiff lebt der gespeicherte Geist eines gefallenen Legionärs. Jetzt flackern die Tore, und Seraph weckt seine Helden.',
    'Die Heldenschiffe treiben als Wracks im Trümmerfeld. Ein Restorer erweckt sie, wenn er nahe genug heranfliegt. Doch der Nexus hat das Feld entdeckt und will die Wracks für sich.'],
  hints: ['Den Restorer neben ein ruhendes Heldenschiff fliegen: Es erwacht nach kurzer Zeit.', 'Heldenschiffe fallen nicht, sie ruhen und lassen sich wieder erwecken.', 'Lichtlanzen gehen zum Teil durch Schilde – gut gegen den Nexus.'],
  goals: [{ id: 'wake', t: 'Erwecke fünf Helden', n: 5 }, { id: 'core', t: 'Zerstöre den Kernknoten des Nexus', later: 1 },
    { id: 'fast', t: 'Erwecke alle fünf in sechs Minuten', side: 1 }],
  map: { w: 3800, h: 2600, starts: [{ x: 520, y: 1300, ang: 0 }, { x: 3200, y: 1300, ang: Math.PI }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], 0); misRes(m, rng, m.starts[1], Math.PI);
      field(m, 1500, 700, 260, rng, 0.7); field(m, 1600, 1900, 260, rng, 0.7); field(m, 2300, 1300, 200, rng, 0.6);
      iceMoon(m, 1100, 1350, rng); oreCluster(m, 2000, 450, rng, 3); oreCluster(m, 2000, 2150, rng, 3); oreCluster(m, 480, 1720, rng, 3);
      misScatter(m, rng, 26);
    } },
  sides: [{ f: 'legion' }, { f: 'nexus', name: 'The Nexus', ai: [1, 1, 1] }],
  lock: { ships: LEG_CORE, bldgs: LEG_BLDG },
  outro: 'Fünf Helden kehren zurück, und mit jedem eine Erinnerung an die letzte Nacht des Imperiums. Cassius, der jüngste der Geister, fragt Seraph, warum der Kaiser die Tore schloss. Seraph antwortet nicht. Stattdessen nennt er ein Ziel: Ilya Voss, die Verräterin.',
  setup(g, M) {
    const h = g.players[g.human];
    h.ice = lv(g, 2200, 1900, 1600); h.ore = lv(g, 1200, 1000, 850);
    const spots = [[1250, 650, 'paladin'], [1350, 2000, 'paladin'], [1750, 1300, 'bastion'], [2050, 800, 'inquisitor'], [2150, 1850, 'herald']];
    M.tag.dorm = [];
    spots.forEach(([x, y, t], i) => { const u = addShip(g, t, g.human, x, y, (i * 1.3) % TAU); makeDerelict(g, u); u.hull = u.hullMax * 0.15; u.dormant = 1; u.derT = 1e9; M.tag.dorm.push(u.id); });
    misTag(g, 'own', misSpawn(g, g.human, ['restorer', 'herald', 'paladin'], 800, 1300, 0));
    misFortify(g, 1, lv(g, 0, 0, 3));
    misSet(g, 'wake', 1, 0, 5); misSet(g, 'fast', 1);
    for (const id of M.tag.dorm) { const u = g.byId.get(id); misReveal(g, u.x, u.y, 160, 40); }
    misSay(g, 'Erwacht, Legionäre. Der Kaiser ruft.', 'seraph', 1);
    misSay(g, 'Seraph … wie lange haben wir geschlafen? Und wo ist der Kaiser?', 'cassius', 6);
    misSay(g, 'Später, Cassius. Erst die Brüder. Der Restorer soll sie wecken.', 'seraph', 11);
    M.t.core = 0;
  },
  step(g, M) {
    const woke = M.tag.dorm.filter(id => { const u = g.byId.get(id); return u && !u.dead && !u.derelict; }).length;
    misGoal(g, 'wake').v = Math.max(misGoal(g, 'wake').v, woke);
    M.tag.dorm.forEach((id, i) => { const u = g.byId.get(id); if (u && !u.dead && u.derelict && misOn(g, 'wake')) misMark(g, 'h' + i, u.x, u.y, 90, u.hero || 'Held'); else misUnmark(g, 'h' + i); });
    if (misOn(g, 'fast') && g.time > 360) misSet(g, 'fast', 3);
    if (misOn(g, 'wake') && misGoal(g, 'wake').v >= 5) {
      misSet(g, 'wake', 2); if (misOn(g, 'fast')) misSet(g, 'fast', 2);
      misSet(g, 'core', 1);
      const s = g.map.starts[1]; misReveal(g, s.x, s.y, 500, 30); misMark(g, 'core', s.x, s.y, 420, 'Kernknoten');
      misSay(g, 'Alle fünf sind wach. Der Nexus will unsere Toten? Dann zeigen wir ihm die Lebenden.', 'seraph');
    }
    if (misGoal(g, 'wake').v > (M.f.lastW || 0)) { M.f.lastW = misGoal(g, 'wake').v; if (M.f.lastW < 5) misSay(g, ['', 'Ein Bruder erwacht.', 'Zwei. Die Legion wächst.', 'Drei. Ich erinnere mich an seinen Namen.', 'Vier. Noch einer, Restorer.'][M.f.lastW], 'seraph'); }
    if (!g.bldgs.some(b => !b.dead && b.owner === 1 && b.role === 'base')) { if (misOn(g, 'core') || misGoal(g, 'wake').st === 2) misWin(g); else if (!M.f.coreEarly) { M.f.coreEarly = 1; misSet(g, 'core', 2); } }
    if (misGoal(g, 'core').st === 2 && misGoal(g, 'wake').st === 2) misWin(g);
  },
  auto(g, M) {
    const r = g.ships.find(u => !u.dead && u.owner === g.human && u.type === 'restorer');
    const dorm = M.tag.dorm.map(id => g.byId.get(id)).filter(u => u && !u.dead && u.derelict);
    if (r && dorm.length && (r.o.t === 'idle' || r.o.t === 'move')) { const t = dorm[0]; r.o = { t: 'move', x: t.x + 40, y: t.y }; r.path = null; }
    const nb = g.bldgs.find(b => !b.dead && b.owner === 1 && b.role === 'base');
    misAutoArmy(g, M, misDone(g, 'wake') ? nb : null, lv(g, 24, 30, 36));
  }
};

MISSIONS.a3m2 = {
  act: 'a3', name: 'Die Verräterin', f: 'legion', who: 'seraph', seed: 433,
  brief: ['Ilya Voss diente dem Imperium, als die Tore erloschen. Danach baute sie die Alliance auf – aus den Trümmern dessen, was sie verraten hat, sagt Seraph.',
    'Ihr Flaggschiff Archipelago liegt vor ihrer Basis im Osten. Stellt sie. Seraph will sie vor sich sehen, bevor er entscheidet. Cassius hat Fragen, die er besser nicht stellen sollte.'],
  hints: ['Die Archipelago lässt sich nicht zerstören, nur stellen: unter ein Viertel ihrer Hülle bringen.', 'Ihre Basis ist mit Lanzentürmen und Schildgeneratoren gesichert.'],
  goals: [{ id: 'voss', t: 'Stelle die Archipelago (unter 25 % Hülle)' }, { id: 'base', t: 'Zerstöre die Kommandobasis der Alliance', later: 1 },
    { id: 'heroes', t: 'Kein Heldenschiff ruht am Ende', side: 1, keep: 1 }],
  map: { w: 3800, h: 2600, starts: [{ x: 520, y: 1300, ang: 0 }, { x: 3200, y: 1300, ang: Math.PI }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], 0); misRes(m, rng, m.starts[1], Math.PI);
      iceMoon(m, 1900, 1300, rng, true); oreCluster(m, 1500, 450, rng, 3); oreCluster(m, 2300, 2150, rng, 3);
      field(m, 1300, 1900, 200, rng); field(m, 2500, 700, 200, rng); field(m, 2600, 1800, 150, rng, 0.8);
      misScatter(m, rng, 28);
    } },
  sides: [{ f: 'legion' }, { f: 'alliance', name: 'Alliance', ai: [1, 1, 1] }],
  lock: { ships: LEG_CORE.concat(['sovereign', 'sanctum', 'zealot', 'oracle']), bldgs: LEG_BLDG.concat(['super']) },
  outro: 'Cassius hat die Frage gestellt, und Seraph hat geantwortet: Der Kaiser selbst hat die Stille befohlen. Seraph schaltete die Tore auf seinen Befehl ab und schwieg vierzig Jahre. »Warum?«, fragt Cassius. »Weil etwas hindurch wollte«, sagt Seraph.',
  setup(g, M) {
    const h = g.players[g.human], s = g.map.starts[1];
    h.ice = lv(g, 3000, 2500, 2100); h.ore = lv(g, 1700, 1400, 1150);
    misBldg(g, g.human, 'yard', 740, 1050, 2); misBldg(g, g.human, 'lab', 380, 1600);
    const own = misSpawn(g, g.human, ['sovereign', 'paladin', 'paladin', 'bastion', 'herald'], 850, 1300, 0);
    own[0].hero = 'Seraph'; misTag(g, 'own', own);
    const v = misSpawn(g, 1, ['archipelago'], s.x - 760, s.y, Math.PI, { hold: true });
    v[0].hero = 'Ilya Voss'; v[0].minHull = v[0].hullMax * 0.2; misTag(g, 'voss', v);
    misTag(g, 'vg', misSpawn(g, 1, lv(g, ['lancer', 'lancer'], ['lancer', 'lancer', 'bulwark'], ['lancer', 'lancer', 'bulwark', 'aegis']), s.x - 840, s.y, Math.PI, { hold: true }));
    misBldg(g, 1, 'turret', s.x - 260, s.y - 220, lv(g, 1, 2, 2)); misBldg(g, 1, 'turret', s.x - 260, s.y + 220, lv(g, 1, 2, 2));
    misFortify(g, 1, lv(g, 0, 1, 4));
    misSet(g, 'voss', 1); misSet(g, 'heroes', 1); M.t.rf = 150; M.f.rf = 0;
    misSay(g, 'Ilya Voss. Sie trug einst die Farben des Kaisers. Heute trägt sie die einer Charta. Wir holen sie.', 'seraph', 1);
    misSay(g, 'Seraph … was genau hat sie verraten? Ich erinnere mich an keine Schlacht, in der sie floh.', 'cassius', 8);
  },
  step(g, M) {
    const v = misLive(g, M.tag.voss)[0];
    if (misOn(g, 'voss') && v && v.hull <= v.hullMax * 0.26) {
      misSet(g, 'voss', 2);
      v.abT.invuln = 999; v.stance = 2; v.o = { t: 'hold' }; v.hold = true;
      misSay(g, 'Seraph. Ich hätte wissen müssen, dass du es bist. Hast du ihnen erzählt, wer den Befehl gab?', 'voss');
      misSay(g, 'Seraph? Wovon spricht sie?', 'cassius', 5);
      misAsk(g, 'voss', 'Die Archipelago treibt manövrierunfähig vor euch. Voss funkt offen: Sie weiß, wer die Tore schloss. Was befiehlt die Legion?',
        [['spare', 'Voss verschonen', 'Sie zieht ab. Vielleicht braucht der Kessel sie noch.'], ['kill', 'Die Archipelago zerstören', 'Der Kaiser hat Verräter nie verschont.']], 'seraph');
    }
    if (M.ch.voss && !M.f.vdone) {
      M.f.vdone = 1;
      if (v) {
        if (M.ch.voss === 'spare') { ev(g, 'jump', { x: v.x, y: v.y, owner: v.owner, r: v.def.r, from: 1 }); removeShip(g, v); misSay(g, 'Danke … Cassius, nicht wahr? Frag ihn nach dem Kaiser. Frag ihn, warum.', 'voss'); }
        else { v.minHull = 0; v.abT.invuln = 0; kill(g, v, null, g.human); misSay(g, 'Es ist vollbracht.', 'seraph'); }
      }
      misSay(g, 'Seraph. Wer hat den Befehl gegeben? Sag es mir.', 'cassius', 6);
      misSay(g, '… Der Kaiser. Ich habe die Tore auf seinen Befehl geschlossen. Und jetzt: die Basis.', 'seraph', 12);
      misSet(g, 'base', 1); misMark(g, 'base', g.map.starts[1].x, g.map.starts[1].y, 420, 'Basis der Alliance');
    }
    /* Fassung 20: Seraph ruft weitere Geister – Verstärkung aus dem Westen, damit die Legion im langsameren Kampftempo
       nicht allein an ihrer Wirtschaft hängt */
    if (M.t.rf && g.time >= M.t.rf && M.f.rf < lv(g, 4, 3, 3)) {
      M.f.rf++; M.t.rf = g.time + lv(g, 150, 170, 190);
      misTag(g, 'own', misSpawn(g, g.human, M.f.rf % 2 ? ['paladin', 'paladin', 'herald'] : ['bastion', 'paladin', 'herald'], 300, 1300 + (M.f.rf % 2 ? -250 : 250), 0));
      misSay(g, M.f.rf === 1 ? 'Weitere Geister erwachen in ihren Hüllen. Sie folgen dem Ruf, Seraph.' : 'Noch eine Staffel. Die Legion vergisst ihre Toten nicht.', M.f.rf === 1 ? 'cassius' : 'seraph');
    }
    const fin = () => { if (g.ships.some(u => !u.dead && u.owner === g.human && u.derelict && u.dormant)) misSet(g, 'heroes', 3); misWin(g); };
    if (!g.bldgs.some(b => !b.dead && b.owner === 1 && b.role === 'base')) { if (misGoal(g, 'voss').st === 2 && M.f.vdone) { fin(); return; } else if (misGoal(g, 'base').st === 0) misSet(g, 'base', 2); }
    if (misGoal(g, 'base').st === 2 && M.f.vdone) fin();
  },
  auto(g, M) {
    /* nur für den Test: erst eine Flotte sammeln (Fassung 20, langsameres Kampftempo), dann geschlossen auf die Archipelago */
    const v = misLive(g, M.tag.voss)[0], war = g.ships.filter(u => !u.dead && !u.derelict && u.owner === g.human && u.def.role === 'war' && u.def.wpn.length);
    if (!misOn(g, 'voss')) { misAutoArmy(g, M, M.f.vdone ? g.bldgs.find(b => !b.dead && b.owner === 1 && b.role === 'base') : null, lv(g, 24, 30, 36)); return; }
    if (!M.f.go && war.reduce((a, u) => a + u.def.cp, 0) >= lv(g, 26, 32, 38)) M.f.go = 1;
    if (!M.f.go) misAutoArmy(g, M, null, 99);
    if (v && M.f.go) for (const u of war) if (u.o.t === 'idle' || u.o.t === 'move' || u.o.t === 'hold') { u.task = 1; u.hold = false; u.o = { t: 'attack', tid: v.id, x: v.x, y: v.y }; u.tgt = v.id; }
  }
};

/* ================================================================== AKT 4: ONE VOICE (The Nexus) ================ */
const NEX_CORE = ['seed', 'harvester', 'shard', 'prism', 'monolith', 'binder', 'lattice', 'mirror'];
const NEX_BLDG = ['base', 'yard', 'refinery', 'reactor', 'lab', 'turret', 'shield', 'relay'];
MISSIONS.a4m1 = {
  act: 'a4', name: 'Das Netz', f: 'nexus', who: 'facet', seed: 503,
  brief: ['Der Nexus war das Steuernetz der Tore. Vierzig Jahre allein hat er gelernt, dass Trennung die Ursache allen Leids ist. Seit die Tore flackern, hört Prime Facet eine Stimme, die er für einen anderen Knoten hält.',
    'Die Stimme verlangt: Verbinde. Spanne das Netz über die drei Vorkommen im Grenzgebiet und hole dir die Schiffe der Republik, die es verhindern wollen.'],
  hints: ['Alles muss am Netz hängen: Netzknoten verbinden Stationen in ihrem Umkreis.', 'Binder übernehmen angeschlagene feindliche Schiffe: Taste »Übernahme«, dann Ziel. In dieser Mission gelingt das schon bei fast halber Hülle.', 'Drei gleiche Kristallschiffe verschmelzen zur nächsten Form.'],
  goals: [{ id: 'nodes', t: 'Baue Netzknoten an den drei markierten Stellen', n: 3 }, { id: 'bind', t: 'Übernimm drei Schiffe der Republik', n: 3 },
    { id: 'merge', t: 'Verschmilz ein Prism', side: 1 }],
  map: { w: 3800, h: 2800, starts: [{ x: 520, y: 1400, ang: 0 }, { x: 3200, y: 1400, ang: Math.PI }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], 0); misRes(m, rng, m.starts[1], Math.PI);
      iceMoon(m, 1500, 550, rng); oreCluster(m, 1800, 1400, rng, 3); iceMoon(m, 1500, 2250, rng); oreCluster(m, 480, 1820, rng, 3);
      field(m, 2400, 800, 220, rng); field(m, 2400, 2000, 220, rng); field(m, 1100, 1900, 140, rng, 0.7);
      misScatter(m, rng, 30);
    } },
  sides: [{ f: 'nexus' }, { f: 'mars', name: 'Martian Republic', ai: 0 }],
  lock: { ships: NEX_CORE, bldgs: NEX_BLDG },
  outro: 'Das Netz wächst, und die Stimme wird lauter. Prime Facet fühlt sich zum ersten Mal seit vierzig Jahren nicht allein. Nur ein Knoten am Rand des Netzes, K-7, meldet eine Störung: Die Stimme kommt nicht aus dem Netz.',
  setup(g, M) {
    const h = g.players[g.human];
    h.ice = lv(g, 2400, 2000, 1700); h.ore = lv(g, 1300, 1100, 900);
    misTag(g, 'own', misSpawn(g, g.human, ['binder', 'binder', 'shard', 'shard', 'shard', 'prism'], 850, 1400, 0));
    /* die Stimme verstärkt das Netz: Übernahme gelingt hier schon bei mehr Hülle */
    h.mfx = { bindAt: lv(g, 0.2, 0.15, 0.13) }; recalcTech(g, h);
    M.t.pat = 110; M.t.raid = lv(g, 220, 190, 160); M.f.raid = 0;
    misMark(g, 'n1', 1500, 800, 240, 'Knoten'); misMark(g, 'n2', 1950, 1400, 240, 'Knoten'); misMark(g, 'n3', 1500, 2000, 240, 'Knoten');
    misFortify(g, 1);
    misSet(g, 'nodes', 1, 0, 3); misSet(g, 'bind', 1, 0, 3); misSet(g, 'merge', 1);
    misSay(g, 'Verbinde. Öffne. Wir sind viele.', 'voice', 1);
    misSay(g, 'Ich höre dich, Bruder. Das Netz wird wachsen. Knoten an die drei Vorkommen.', 'facet', 5);
  },
  step(g, M) {
    const pi = g.human;
    let n = 0;
    for (const mk of M.marks) { mk.done = g.bldgs.some(b => !b.dead && b.done && b.owner === pi && b.role === 'relay' && hyp(b.x - mk.x, b.y - mk.y) <= mk.r); if (mk.done) n++; }
    misGoal(g, 'nodes').v = n;
    if (misOn(g, 'nodes') && n >= 3) { misSet(g, 'nodes', 2); misSay(g, 'Drei Knoten. Ich spüre das Grenzgebiet wie meine eigenen Facetten.', 'facet'); }
    M.tag.bound = M.tag.bound || [];
    for (const u of g.ships) if (!u.dead && u.owner === pi && u.def.f === 'mars' && !M.tag.bound.includes(u.id)) M.tag.bound.push(u.id);
    M.f.bound = M.tag.bound.length;
    misGoal(g, 'bind').v = Math.min(3, M.f.bound);
    if (misOn(g, 'bind') && M.f.bound >= 3) { misSet(g, 'bind', 2); misSay(g, 'Sie sträuben sich, dann schweigen sie. Gut. Gut.', 'voice'); }
    if (misOn(g, 'merge') && g.ships.some(u => !u.dead && u.owner === pi && u.type === 'prism' && u.merged)) misSet(g, 'merge', 2);
    /* Aufklärer der Republik, angeschlagen von den Kämpfen im Grenzgebiet: leichte Beute für die Binder */
    if (g.time >= M.t.pat && !misDone(g, 'bind')) {
      M.t.pat = g.time + lv(g, 75, 90, 110);
      const mk = M.marks[(M.f.pat = ((M.f.pat || 0) + 1)) % 3];
      const pack = misSpawn(g, 1, ['needle', 'needle'], 3000, mk.y, Math.PI);
      for (const u of pack) { u.hull = u.hullMax * lv(g, 0.4, 0.42, 0.4); u.task = 1; u.o = { t: 'amove', x: mk.x, y: mk.y }; u.path = null; }
      if (M.f.pat === 1) misSay(g, 'Aufklärer der Republik, beschädigt. Sie suchen unsere Knoten. Nimm sie dir – die Stimme macht die Übernahme leicht.', 'facet');
    }
    /* Fassung 20: die Republik verteidigt ihre Basis und schickt Kampfgruppen gegen das wachsende Netz (geskriptet statt
       freier KI – im taktischen Tempo überrollte die KI das junge Netz, bevor die Knoten standen) */
    if (g.time >= M.t.raid && misCount(g, g.bldgs.filter(b => b.owner === 1 && b.role === 'base').map(b => b.id))) {
      const k = ++M.f.raid, s = g.map.starts[1];
      M.t.raid = g.time + lv(g, 150, 130, 115);
      const list = ['needle', 'hedgehog'].concat(k > 1 ? ['spear'] : [], k > 2 ? ['needle', 'hedgehog'] : [], k > 3 && g.mis.lvl > 1 ? ['hammer'] : [], k > 4 ? ['spear', 'needle'] : [], g.mis.lvl > 2 ? ['hedgehog'] : []);
      misTag(g, 'raid', misSpawn(g, 1, list, s.x - 380, s.y + (k % 2 ? -250 : 250), Math.PI));
      if (k === 1) misSay(g, 'Eine Kampfgruppe der Republik hält auf das Netz zu. Kristallwachen an die Knoten!', 'facet');
    }
    if (g.tick % 90 === 45) misHunt(g, M.tag.raid);
    if (misDone(g, 'nodes') && misDone(g, 'bind')) misWin(g);
  },
  auto(g, M) {
    /* nur für den Test: Netzkette zu den Markierungen, Binder sammelt angeschlagene Schiffe ein */
    const pi = g.human, p = g.players[pi], seed = g.ships.find(u => !u.dead && u.owner === pi && u.type === 'seed');
    const mk = M.marks.find(m => !m.done);
    if (seed && mk && seed.o.t === 'idle' && canPay(p, bcost(p, BLDG.nexus.relay))) {
      let near = null, nd = 1e9;
      for (const b of g.bldgs) if (!b.dead && b.done && b.owner === pi) { const d = hyp(b.x - mk.x, b.y - mk.y); if (d < nd) { nd = d; near = b; } }
      if (near) {
        const a = datan2(mk.y - near.y, mk.x - near.x), step = Math.min(380, nd);
        for (let k = 0; k < 12; k++) { const aa = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25, x = near.x + dcos(aa) * step, y = near.y + dsin(aa) * step; if (!canPlace(g, pi, 'relay', x, y)) { execCmd(g, { t: 'build', p: pi, u: [seed.id], role: 'relay', x, y }); break; } }
      }
    }
    for (const b of g.ships) if (!b.dead && b.owner === pi && b.type === 'binder' && !(b.abcd.bind > 0)) {
      let tg = null;
      for (const e of g.ships) if (!e.dead && e.owner === 1 && e.def.role !== 'fighter' && e.hull / e.hullMax < (b.def.bindAt || 0.25) + p.tfx.bindAt && hyp(e.x - b.x, e.y - b.y) < 1600) { tg = e; break; }
      if (tg) { b.task = 1; if (tdist(b, tg) < 130) abilityUse(g, b, 'bind', tg); else { b.o = { t: 'move', x: tg.x, y: tg.y }; b.path = null; } }
      else { const mate = g.ships.find(u => !u.dead && u.owner === pi && u !== b && u.o.t === 'attack'); if (mate && b.o.t !== 'move') { b.task = 1; b.o = { t: 'move', x: mate.x, y: mate.y }; b.path = null; } else if (!mate) b.task = 0; }
    }
    /* die Ziele verlangen keinen Angriff auf die Republik: Flotte hält die Basis */
    misAutoArmy(g, M, null, 99, u => u.type === 'binder', mk || M.marks[1]);
  }
};

MISSIONS.a4m2 = {
  act: 'a4', name: 'Der abgetrennte Knoten', f: 'nexus', who: 'facet', seed: 521,
  brief: ['Knoten K-7 hat sich vom Netz getrennt. Er sendet nur noch einen Satz, immer wieder: »Die Stimme kommt nicht aus dem Netz.« Die Stimme verlangt, dass K-7 gelöscht wird – und dass das alte Tor im Süden geöffnet wird.',
    'Prime Facet zögert zum ersten Mal. Ein Knoten, der zweifelt, ist ein Knoten, der fühlt. Erreiche K-7 und entscheide. Dann öffne das Tor, wie die Stimme es will.'],
  hints: ['Die drei Relikte für das Tor bringt Prime Facet bereits mit.', 'Was durch das Tor kommt, kommt in Wellen. Netzknoten und Kristallwachen an das Tor setzen.'],
  goals: [{ id: 'k7', t: 'Erreiche Knoten K-7' }, { id: 'gate', t: 'Öffne das Tor im Süden', later: 1 }, { id: 'survive', t: 'Überlebe, was durch das Tor kommt', later: 1, time: 1 },
    { id: 'core', t: 'Der Kernknoten bleibt unversehrt', side: 1, keep: 1 }],
  map: { w: 3800, h: 2800, starts: [{ x: 520, y: 900, ang: 0.3 }, { x: 3200, y: 700, ang: Math.PI }, { x: 3100, y: 1700, ang: Math.PI }, { x: 1900, y: 2300, ang: -Math.PI / 2 }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], 0.3);
      gatePair(m, 1900, 2250, 3500, 2500, 'dead');
      iceMoon(m, 1400, 1300, rng); oreCluster(m, 1100, 1900, rng, 3); oreCluster(m, 2400, 1500, rng, 3); iceMoon(m, 2600, 2100, rng);
      field(m, 2200, 600, 220, rng); field(m, 2700, 1200, 160, rng, 0.8); field(m, 900, 2400, 150, rng, 0.7);
      misScatter(m, rng, 28);
    } },
  sides: [{ f: 'nexus' }, { f: 'mars', name: 'Martian Republic', ai: [1, 1, 2] }, { f: 'nexus', name: 'Knoten K-7', base: false, team: 0, color: '#9ff0c0' }, { f: 'brood', name: 'Die Stimme', base: false }],
  lock: { ships: NEX_CORE.concat(['facet', 'conduit', 'spire']), bldgs: NEX_BLDG },
  outro(g) { return (g.mis.ch.node === 'live' ? 'K-7 hat recht behalten. Die Stimme ist das Signal der Brood Matriarch, die den Nexus benutzt hat, um die Tore zu öffnen. Prime Facet schaltet das Signal ab – und hört zum ersten Mal die Stille. »Wir waren nie allein. Wir waren benutzt.«' : 'Durch das Tor kam die Brut, und mit ihr die Wahrheit: Die Stimme ist das Signal der Brood Matriarch. Sie hat den Nexus benutzt, um die Tore zu öffnen. Prime Facet hat den einzigen Knoten gelöscht, der es ihm sagen wollte.'); },
  setup(g, M) {
    const h = g.players[g.human];
    h.ice = lv(g, 2800, 2300, 1900); h.ore = lv(g, 1500, 1250, 1000);
    h.relics = 3;
    misBldg(g, g.human, 'yard', 700, 650, 2); misBldg(g, g.human, 'relay', 900, 1150);
    const own = misSpawn(g, g.human, ['facet', 'prism', 'prism', 'binder', 'mirror'], 850, 950, 0.3);
    own[0].hero = 'Prime Facet'; misTag(g, 'own', own);
    const ks = g.map.starts[2];
    const k = misBldg(g, 2, 'relay', ks.x - 600, ks.y + 200); k.label = 'Knoten K-7'; misTag(g, 'k7', [k]);
    M.S.k7 = { x: k.x, y: k.y };
    misMark(g, 'k7', k.x, k.y, 300, 'K-7');
    misFortify(g, 1);
    misSet(g, 'k7', 1); misSet(g, 'core', 1);
    misSay(g, 'Lösche K-7. Öffne das Tor. Wir warten so lange.', 'voice', 1);
    misSay(g, 'Die Stimme kommt nicht aus dem Netz. Die Stimme kommt nicht aus dem Netz. Die Stimme …', 'node', 7);
  },
  step(g, M) {
    const pi = g.human, gt = g.gates[0];
    if (misOn(g, 'core') && !g.bldgs.some(b => !b.dead && b.owner === pi && b.role === 'base')) misSet(g, 'core', 3);
    if (misOn(g, 'k7') && misNear(g, pi, M.S.k7.x, M.S.k7.y, 420) >= 1) {
      misSet(g, 'k7', 2); misUnmark(g, 'k7');
      misSay(g, 'Prime Facet. Hör mir zu. Die Stimme hat kein Muster, das wir kennen. Sie wächst. Sie frisst.', 'node');
      misAsk(g, 'node', 'K-7 bittet um sein Leben. Die Stimme verlangt seine Löschung. Was tut Prime Facet?',
        [['live', 'K-7 leben lassen', 'Ein zweifelnder Knoten ist ein freier Knoten.'], ['kill', 'K-7 löschen', 'Die Stimme hat das Netz wachsen lassen. Sie hat recht.']], 'facet');
    }
    if (M.ch.node && !M.f.ndone) {
      M.f.ndone = 1;
      if (M.ch.node === 'kill') { for (const b of misLive(g, M.tag.k7)) { ev(g, 'lance', { x: b.x - 200, y: b.y - 200, tx: b.x, ty: b.y, owner: pi }); kill(g, b, null, pi); } misSay(g, 'Gelöscht. Das Netz ist wieder eins.', 'facet'); misSay(g, 'Gut. Jetzt das Tor.', 'voice', 4); }
      else { misSay(g, 'Danke. Wenn das Tor aufgeht, sei bereit. Ich werde dich warnen.', 'node'); misSay(g, 'Ungehorsam. Öffne das Tor.', 'voice', 5); }
      misSet(g, 'gate', 1); misReveal(g, gt.x, gt.y, 500, 120); misCam(g, gt.x, gt.y, 0.7, 2); misMark(g, 'gate', gt.x, gt.y, 200, 'Tor im Süden');
    }
    if (misOn(g, 'gate') && gt.state === 'active' && gt.owner === pi) {
      misSet(g, 'gate', 2); misUnmark(g, 'gate'); misSet(g, 'survive', 1, 0, lv(g, 300, 330, 330));
      M.t.surv = g.time + lv(g, 300, 330, 330);
      M.t.wave = g.time + (M.ch.node === 'live' ? 30 : 8); M.f.w = 0;
      if (M.ch.node === 'live') misSay(g, 'Jetzt! Es kommt – nicht aus dem Netz, durch das Tor! Dreißig Sekunden!', 'node');
      else misSay(g, 'Endlich.', 'voice', 2);
    }
    if (misOn(g, 'survive')) {
      misGoal(g, 'survive').v = misGoal(g, 'survive').n - misLeft(g, M, 'surv');
      if (g.time >= M.t.wave) {
        M.f.w++; M.t.wave = g.time + lv(g, 55, 48, 45);
        const val = lv(g, 900, 1200, 1500) + M.f.w * lv(g, 350, 450, 600) + (M.ch.node === 'kill' && M.f.w === 1 ? 800 : 0);
        misTag(g, 'brood', misBreach(g, 3, broodPack(g, val, M.f.w >= 2), gt, -Math.PI / 2));
        if (M.f.w === 1) misSay(g, 'Das … ist keine Verbindung. Das ist Hunger.', 'facet');
      }
      if (g.time >= M.t.surv) { misSet(g, 'survive', 2); misWin(g); return; }
    }
    if (g.tick % 60 === 5) misHunt(g, M.tag.brood);
  },
  auto(g, M) { if (misOn(g, 'k7') || misOn(g, 'gate')) { const to = misOn(g, 'k7') ? M.S.k7 : g.gates[0]; for (const u of g.ships) if (!u.dead && u.owner === g.human && u.def.wpn.length && u.o.t === 'idle' && hyp(u.x - to.x, u.y - to.y) > 200) { u.o = { t: 'move', x: to.x + (u.id % 5) * 20, y: to.y - 80 }; u.path = null; } } }
};

/* ================================================================== AKT 5: QUARANTINE (Finale) ================ */
MISSIONS.a5m1 = {
  act: 'a5', name: 'Das Haupttor', f: '', pick: 1, who: 'echo', seed: 601,
  brief: ['Die Matriarch hat den Kessel gefunden. Am Haupttor der Erbauer wächst ihr Nest, und mit jeder Stunde kommen mehr Schwärme durch. Wer jetzt noch gegeneinander kämpft, kämpft für sie.',
    'Wähle deine Fraktion. Kessler und die Republik stehen an deiner Seite, und wer in diesem Krieg verschont wurde, kommt vielleicht zu Hilfe. Brenne das Nest aus, töte die Matriarch – und entscheide dann, was mit den Toren geschieht.'],
  hints: ['Die Nester rund um das Tor zuerst: Solange sie stehen, kommen die Schwärme schneller.', 'Die Matriarch wächst mit jedem Abschuss. Nicht mit kleinen Gruppen angreifen.'],
  goals: [{ id: 'nests', t: 'Zerstöre die Nester am Haupttor' }, { id: 'mat', t: 'Vernichte die Brood Matriarch', later: 1 }, { id: 'end', t: 'Entscheide über die Tore', later: 1 },
    { id: 'allies', t: 'Alle Verbündeten überleben', side: 1, keep: 1 }],
  map: { w: 4200, h: 3000, starts: [{ x: 700, y: 2450, ang: -0.6 }, { x: 2100, y: 650, ang: Math.PI / 2 }, { x: 3500, y: 2450, ang: -2.5 }, { x: 550, y: 1250, ang: 0 }],
    build(m, rng) {
      for (const i of [0, 2, 3]) misRes(m, rng, m.starts[i], m.starts[i].ang);
      gatePair(m, 2100, 420, 3900, 250, 'flicker');
      iceMoon(m, 2100, 1700, rng, true); oreCluster(m, 1500, 1200, rng, 3); oreCluster(m, 2700, 1200, rng, 3); iceMoon(m, 1300, 2100, rng); iceMoon(m, 2900, 2100, rng);
      field(m, 1300, 600, 230, rng); field(m, 2900, 650, 230, rng); field(m, 2100, 2500, 200, rng, 0.8);
      misSite(m, 'ruin', 2100, 1250);
      misScatter(m, rng, 34);
    } },
  sides(fac, carry) {
    const s = [{ f: fac || 'alliance' }, { f: 'brood', name: 'The Brood', base: false }, { f: 'mars', name: 'Kessler', ai: 2, team: 0, color: '#ff9a6a' }];
    if (carry.voss === 'spare') s.push({ f: 'alliance', name: 'Voss', ai: 2, team: 0, color: '#8fd0ff' });
    return s;
  },
  outro(g) { return g.mis.ch.end === 'seal' ? 'Das Echo der Erbauer zeigt den Weg: Alle Tore erlöschen, diesmal für immer und aus freiem Willen. Der Kessel ist allein, getrennt vom Rest der Galaxis – aber sicher. Die Stille ist zurück. Diesmal weiß jeder, warum.' : 'Die Tore bleiben offen. Eine vereinte Flotte aus Alliance, Republik, Legion und Nexus springt hindurch, dorthin, woher die Brood kam. Der Krieg ist nicht vorbei. Er hat gerade erst angefangen.'; },
  setup(g, M) {
    const h = g.players[g.human], c = M.carry, s0 = g.map.starts[0];
    h.ice = lv(g, 3500, 3000, 2500); h.ore = lv(g, 2000, 1700, 1400);
    if (c.save === 'convoy' || c.save === 'both') { h.ice += 1500; h.ore += 800; }
    misBldg(g, g.human, 'yard', s0.x + 230, s0.y - 120, 2); misBldg(g, g.human, 'lab', s0.x - 200, s0.y + 150);
    const fac = h.faction, core = { alliance: ['lancer', 'lancer', 'bulwark'], mars: ['hedgehog', 'hedgehog', 'spear'], legion: ['paladin', 'paladin', 'bastion'], nexus: ['prism', 'prism', 'binder'], brood: ['ravager', 'spitter', 'spitter'] }[fac] || ['lancer'];
    misTag(g, 'own', misSpawn(g, g.human, core, s0.x + 300, s0.y - 300, -0.6));
    const gt = g.gates[0], ns = [[1750, 650], [2450, 650], [1850, 950], [2350, 950]];
    const nest = [misBldg(g, 1, 'base', 2100, 700, lv(g, 2, 2, 3))];
    for (const [x, y] of ns) nest.push(misBldg(g, 1, 'spore', x, y, lv(g, 2, 2, 3)));
    nest.push(misBldg(g, 1, 'turret', 1950, 1100, 2), misBldg(g, 1, 'turret', 2250, 1100, 2));
    for (const b of nest) b.label = 'Nest';
    misTag(g, 'nest', nest);
    misTag(g, 'ng', misSpawn(g, 1, broodPack(g, lv(g, 2000, 2800, 3600), true), 2100, 1050, Math.PI / 2, { hold: true }));
    misSet(g, 'nests', 1, 0, nest.length); misSet(g, 'allies', 1);
    misMark(g, 'nest', 2100, 850, 480, 'Nest am Haupttor');
    M.t.wave = lv(g, 120, 100, 85); M.f.w = 0;
    if (c.node === 'live') { misReveal(g, gt.x, gt.y + 300, 700, 9999); misSay(g, 'Hier spricht K-7. Ich sehe das Tor für euch. Ich sage euch, wann sie kommen.', 'node', 12); }
    misSay(g, 'Ihr habt es wieder geöffnet. Jetzt schließt, was ihr geöffnet habt – oder geht hindurch.', 'echo', 1);
    misSay(g, 'Kessler hier. Die Republik steht. Sagen Sie, wo es brennt.', 'kessler', 7);
    if (c.voss === 'spare') misSay(g, 'Voss hier. Jemand hat mich einmal verschont. Ich bin gekommen, um mich zu revanchieren.', 'voss', 13);
    else misSay(g, 'Die Alliance schickt niemanden. Seit Voss fiel, streitet der Rat nur noch.', 'hq', 13);
  },
  step(g, M) {
    const gt = g.gates[0], c = M.carry;
    const left = misCount(g, M.tag.nest);
    misGoal(g, 'nests').v = misGoal(g, 'nests').n - left;
    if (misOn(g, 'allies') && g.players.some(p => p.team === 0 && p.ai && !p.alive)) misSet(g, 'allies', 3);
    /* Schwärme aus dem Tor, schneller solange die Nester stehen */
    if (g.time >= M.t.wave && !misDone(g, 'mat')) {
      M.f.w++; M.t.wave = g.time + (left ? lv(g, 75, 65, 55) : lv(g, 110, 95, 80));
      const val = lv(g, 1000, 1400, 1800) + M.f.w * lv(g, 300, 420, 550);
      const pack = misTag(g, 'brood', misBreach(g, 1, broodPack(g, val, M.f.w >= 3), gt, Math.PI / 2));
      const allies = g.players.filter(p => p.team === 0 && p.alive && !p.neutral), tp = allies[M.f.w % allies.length];
      for (const u of pack) u.o = { t: 'amove', x: tp.start.x, y: tp.start.y };
      if (c.node === 'live') misSay(g, tp.id === g.human ? 'K-7: Schwarm durch das Tor, Kurs auf euch.' : ['K-7: Schwarm durch das Tor, Kurs auf {0}.', tp.name || 'die Verbündeten'], 'node');
    }
    if (g.tick % 60 === 5) misHunt(g, M.tag.brood);
    if (misOn(g, 'nests') && !left) {
      misSet(g, 'nests', 2); misSet(g, 'mat', 1); misUnmark(g, 'nest');
      misCam(g, gt.x, gt.y, 0.65, 2.5);
      misSay(g, 'Die Nester brennen. Und jetzt … kommt sie selbst.', 'kessler');
      M.t.mat = g.time + 5;
    }
    if (M.t.mat && g.time >= M.t.mat) {
      M.t.mat = 0;
      const pack = misBreach(g, 1, ['matriarch'].concat(lv(g, ['leviathan', 'leviathan'], ['leviathan', 'leviathan', 'acidmaw'], ['leviathan', 'leviathan', 'leviathan', 'acidmaw', 'acidmaw'])), gt, Math.PI / 2);
      pack[0].hero = 'Die Matriarch';
      misTag(g, 'mat', [pack[0]]); misTag(g, 'brood', pack);
      misSay(g, '(Ein Signal ohne Worte. Jeder Bildschirm im Kessel zeigt für einen Augenblick dasselbe Muster.)', 'voice');
    }
    if (misOn(g, 'mat') && M.tag.mat && !misCount(g, M.tag.mat)) {
      misSet(g, 'mat', 2); misSet(g, 'end', 1);
      misSay(g, 'Sie ist tot. Die Schwärme zerfallen. Aber das Tor ist offen – und dahinter sind mehr.', 'echo');
      misAsk(g, 'end', 'Die Matriarch ist tot. Das Echo der Erbauer bietet an, alle Tore für immer zu schließen. Oder ihr lasst sie offen und tragt den Krieg dorthin, woher die Brood kam.',
        [['seal', 'Die Tore versiegeln', 'Getrennt vom Rest der Galaxis, aber sicher.'], ['open', 'Die Tore offen lassen', 'Die Brood an ihrem Ursprung bekämpfen.']], 'echo');
      for (const u of misLive(g, M.tag.brood)) { u.hull *= 0.3; }
    }
    if (M.ch.end && !M.f.edone) { M.f.edone = 1; misSet(g, 'end', 2); misWin(g); }
  }
};

/* ================================================================== BONUS: THE HUNGER (The Brood) ================ */
MISSIONS.b1 = {
  act: 'b', name: 'Der Hunger', f: 'brood', who: 'voice', seed: 701,
  brief: ['Was, wenn es anders gekommen wäre? Die Matriarch ruht in ihrem Nest am Rand des Kessels. Drei Mächte haben sich gegen sie verschworen: die Alliance, die Republik und die Legion.',
    'Es gibt keine Verbündeten. Es gibt nur Biomasse. Verschlinge alle drei.'],
  hints: ['Grazer fressen Eis, Erz und Wracks. Larven sind billig und mutieren in jede Form.', 'Leviathane verschlingen angeschlagene Schiffe und heilen sich daran.', 'Die drei Gegner kämpfen auch gegeneinander.'],
  goals: [{ id: 'eat', t: 'Vernichte die drei Kommandobasen', n: 3 }, { id: 'fast', t: 'Schaffe es in 25 Minuten', side: 1, keep: 1 }],
  map: { w: 4200, h: 3000, starts: [{ x: 700, y: 2400, ang: -0.6 }, { x: 3500, y: 2400, ang: -2.5 }, { x: 3500, y: 600, ang: 2.5 }, { x: 700, y: 600, ang: 0.6 }],
    build(m, rng) {
      for (const s of m.starts) misRes(m, rng, s, s.ang);
      iceMoon(m, 2100, 1500, rng, true); oreCluster(m, 2100, 800, rng, 3); oreCluster(m, 2100, 2200, rng, 3); oreCluster(m, 1300, 1500, rng, 2); oreCluster(m, 2900, 1500, rng, 2);
      field(m, 1500, 1000, 200, rng); field(m, 2700, 1000, 200, rng); field(m, 1500, 2000, 200, rng); field(m, 2700, 2000, 200, rng);
      misScatter(m, rng, 36);
    } },
  sides: [{ f: 'brood' }, { f: 'alliance', name: 'The Alliance', ai: [1, 2, 2], team: 1 }, { f: 'mars', name: 'Martian Republic', ai: [1, 2, 2], team: 2 }, { f: 'legion', name: 'Golden Legion', ai: [1, 2, 2], team: 3 }],
  lock: null,
  outro: 'Der Kessel ist still. Nicht die Stille der Tore – die Stille danach. Die Matriarch wächst, und irgendwo jenseits der Tore wartet der Rest der Galaxis.',
  setup(g, M) {
    const h = g.players[g.human];
    h.ice = lv(g, 5000, 4000, 3200);
    misTag(g, 'own', misSpawn(g, g.human, ['matriarch', 'leviathan', 'ravager', 'ravager', 'ravager', 'spitter', 'spitter', 'spitter', 'spitter', 'swarm', 'swarm', 'swarm', 'sporer'], 950, 2150, -0.6));
    misBldg(g, g.human, 'yard', 900, 2600, 2); misBldg(g, g.human, 'spore', 500, 2200); misBldg(g, g.human, 'turret', 950, 2300, 2);
    for (const pi of [1, 2, 3]) misFortify(g, pi, lv(g, -2, 0, 1));
    misSet(g, 'eat', 1, 0, 3); misSet(g, 'fast', 1);
    misSay(g, '(Hunger.)', 'voice', 1);
  },
  step(g, M) {
    const n = [1, 2, 3].filter(pi => !g.bldgs.some(b => !b.dead && b.owner === pi && b.role === 'base')).length;
    misGoal(g, 'eat').v = n;
    if (misOn(g, 'fast') && g.time > 1500) misSet(g, 'fast', 3);
    if (n >= 3) misWin(g);
  }
};

/* ================================================================== AUSBILDUNG (Tutorial) ================ */
/* Schritt für Schritt: wählen, fliegen, angreifen, Rahmen, Vorstoß, Minikarte, bauen, Werft, Fähigkeit, Ernstfall.
   M.S.hl nennt die Taste, die die Oberfläche hervorhebt (nur Anzeige). */
const TUT_STEPS = [
  { id: 'move', hl: '', say: ['Willkommen an Bord, Kadett. Tippe die kleine Wren an, um sie zu wählen – dann tippe auf die Markierung.', 'Wren antippen (sie leuchtet grün eingekreist), dann die Markierung.'] },
  { id: 'shoot', hl: '', say: ['Gut geflogen. Jetzt die Zielscheibe: Mit gewählter Wren den Gegner antippen heißt angreifen.', 'Wren wählen, dann die rote Zielscheibe antippen.'] },
  { id: 'group', hl: 'cmd:Auswahl', say: ['Drei Lancer sind eingetroffen. Tippe unten rechts auf »Auswahl« und ziehe einen Rahmen um alle drei. Dann tippe auf die Markierung.', '»Auswahl« antippen, mit dem Finger einen Rahmen um die Lancer ziehen, dann die Markierung.'] },
  { id: 'amove', hl: 'cmd:Vorstoß', say: ['»Vorstoß« schickt die Auswahl los und greift alles auf dem Weg an. Lancer gewählt lassen, »Vorstoß«, dann hinter die Zielgruppe tippen.', 'Lancer wählen, »Vorstoß« antippen, dann die Zielgruppe.'] },
  { id: 'mini', hl: 'el:#mini', say: ['Oben rechts die Minikarte: Antippen springt dorthin, rote Ringe zeigen Angriffe. Zwei Finger zoomen die Karte, ein Finger verschiebt sie.'] },
  { id: 'yard', hl: 'item:yard', say: ['Jetzt die Basis. Wähle das Bauschiff, den Pathfinder. Unten erscheint das Baumenü: »Werft« antippen, dann einen freien Platz neben der Kommandobasis.', 'Pathfinder antippen, im Baumenü »Werft«, dann einen Platz nahe der Basis. Grün heißt: passt.'] },
  { id: 'reactor', hl: 'item:reactor', say: ['Stationen brauchen Energie. Baue mit dem Pathfinder einen Reaktor.', 'Pathfinder wählen, »Reaktor«, Platz antippen.'] },
  { id: 'train', hl: 'item:lancer', say: ['Die Werft steht. Tippe sie an und gib einen Lancer in Auftrag.', 'Werft antippen, dann »Lancer« im Menü unten.'] },
  { id: 'ability', hl: 'ab', say: ['Viele Schiffe haben eine Spezialfähigkeit, die orangene Taste. Wähle einen Lancer und setze »Lanzenüberladung« ein. Langes Drücken auf eine Taste erklärt sie.', 'Lancer wählen, dann die orangene Taste.'] },
  { id: 'defend', hl: '', say: ['Ernstfall! Piraten im Anflug auf die Basis. Alle Kampfschiffe wählen und abwehren.', 'Alle Schiffe mit einem Rahmen wählen und die Piraten antippen.'] }
];
MISSIONS.tut = {
  act: 't', name: 'Grundausbildung', f: 'alliance', who: 'voss', seed: 77, quiet: 1,
  brief: ['Bevor du eine Flotte führst, lernst du sie zu bedienen. Admiralin Voss nimmt dich auf dem Übungsgelände von Haven unter ihre Fittiche.',
    'Schritt für Schritt: Schiffe wählen und fliegen, angreifen, mehrere Schiffe führen, eine Werft bauen, Schiffe in Auftrag geben, Fähigkeiten einsetzen. Am Ende ein kleiner Ernstfall.'],
  hints: ['Tippen wählt, Tippen auf Raum fliegt, Tippen auf Gegner greift an.', 'Lange auf eine Taste drücken zeigt die Erklärung.', 'Die Pause oben rechts hält alles an.'],
  goals: [{ id: 'move', t: 'Fliege die Wren zur Markierung' }, { id: 'shoot', t: 'Zerstöre die Zielscheibe', later: 1 }, { id: 'group', t: 'Führe die drei Lancer zur Markierung', later: 1 },
    { id: 'amove', t: 'Vorstoß: Zerstöre die Zielgruppe', later: 1 }, { id: 'mini', t: 'Die Minikarte', later: 1 }, { id: 'yard', t: 'Baue eine Werft', later: 1 }, { id: 'reactor', t: 'Baue einen Reaktor', later: 1 },
    { id: 'train', t: 'Gib einen Lancer in Auftrag', later: 1 }, { id: 'ability', t: 'Setze eine Fähigkeit ein', later: 1 }, { id: 'defend', t: 'Wehre die Piraten ab', later: 1 }],
  map: { w: 3200, h: 2000, starts: [{ x: 480, y: 1000, ang: 0 }, { x: 2900, y: 1000, ang: Math.PI }],
    build(m, rng) {
      misRes(m, rng, m.starts[0], 0);
      iceMoon(m, 2300, 500, rng); field(m, 2500, 1600, 170, rng, 0.7); field(m, 1600, 300, 120, rng, 0.6);
      misScatter(m, rng, 14);
    } },
  sides: [{ f: 'alliance' }, { f: 'mars', name: 'Zielscheiben', color: '#d0453b', base: false }],
  lock: { ships: ['pathfinder', 'hauler', 'wren', 'lancer', 'bulwark'], bldgs: ['base', 'yard', 'refinery', 'reactor', 'turret', 'shield', 'relay'], noDoc: true },
  supply: false,
  outro: 'Ausbildung bestanden. Du kannst Schiffe führen, Stationen bauen und eine Basis verteidigen. Der Rest ist Erfahrung – und die beginnt vor vierzig Jahren, am Tor von Calder.',
  setup(g, M) {
    const h = g.players[g.human];
    h.ice = 3000; h.ore = 1600;
    for (const u of g.ships) if (u.owner === g.human) u.auto = false;
    M.f.k = -1; M.t.next = 1.5;
  },
  step(g, M) {
    const pi = g.human, h = g.players[pi], S = TUT_STEPS;
    const own = t => g.ships.filter(u => !u.dead && !u.derelict && u.owner === pi && u.type === t);
    /* nächster Schritt */
    if (M.t.next && g.time >= M.t.next) {
      M.t.next = 0; M.f.k++;
      const st = S[M.f.k];
      misSet(g, st.id, 1); M.S.hl = st.hl; M.t.k0 = g.time; M.f.hint = 0;
      ev(g, 'radio', { k: st.say[0], who: st.id === 'defend' ? 'hq' : 'voss', flush: 1 });
      if (st.id === 'move') { const w = own('wren')[0]; if (w) misCam(g, w.x + 250, w.y - 120, 1.1, 1.5); misMark(g, 'm', 1050, 700, 130, 'Ziel'); }
      if (st.id === 'shoot') { const t = misSpawn(g, 1, ['needle'], 1380, 700, Math.PI, { hold: true }); for (const u of t) u.stance = 2; misTag(g, 't1', t); misMark(g, 'm', 1380, 700, 70, 'Zielscheibe'); }
      if (st.id === 'group') { const l = misSpawn(g, pi, ['lancer', 'lancer', 'lancer'], 760, 1380, 0, { gap: 60 }); for (const u of l) u.auto = false; misTag(g, 'lan', l); misMark(g, 'm', 1350, 1350, 190, 'Sammelpunkt'); misCam(g, 1050, 1350, 0.9, 1.5); }
      if (st.id === 'amove') { const t = misSpawn(g, 1, ['needle', 'needle', 'hedgehog', 'needle'], 2000, 1150, Math.PI, { hold: true, gap: 70 }); for (const u of t) u.stance = 2; misTag(g, 't2', t); misMark(g, 'm', 2000, 1150, 200, 'Zielgruppe'); }
      if (st.id === 'mini') { misUnmark(g, 'm'); M.t.mini = g.time + 9; }
      if (st.id === 'yard' || st.id === 'reactor') { const b = own('pathfinder')[0]; if (b) { misMark(g, 'b', b.x, b.y, 50, 'Bauschiff'); misCam(g, b.x + 150, b.y, 1, 1.5); } }
      if (st.id === 'train') { misUnmark(g, 'b'); M.f.built0 = h.stats.built; const y = g.bldgs.find(b => !b.dead && b.owner === pi && b.role === 'yard'); if (y) misMark(g, 'b', y.x, y.y, y.def.r + 30, 'Werft'); }
      if (st.id === 'ability') { misUnmark(g, 'b'); M.f.ab0 = 1; for (const u of g.ships) if (u.owner === pi && u.abcd) for (const k in u.abcd) u.abcd[k] = 0; }
      if (st.id === 'defend') { const p = misSpawn(g, 1, ['needle', 'needle', 'hedgehog'], 2800, 1000, Math.PI); misTag(g, 'raid', p); misHunt(g, M.tag.raid); misCam(g, 1300, 1000, 0.7, 2); }
      return;
    }
    const k = M.f.k;
    if (k < 0 || M.t.next) return;
    const st = S[k];
    /* Erinnerung, wenn ein Schritt lange dauert */
    if (st.say[1] && g.time - M.t.k0 > 40 + M.f.hint * 40) { M.f.hint++; misSay(g, ['Tipp: {0}', st.say[1]], 'hq'); }
    if (st.id === 'yard' || st.id === 'reactor') { const b = own('pathfinder')[0]; if (b) misMark(g, 'b', b.x, b.y, 50, 'Bauschiff'); }
    if (st.id === 'defend' && g.tick % 90 === 5) misHunt(g, M.tag.raid);
    let done = false;
    if (st.id === 'move') done = own('wren').some(u => hyp(u.x - 1050, u.y - 700) < 150);
    else if (st.id === 'shoot') done = !misCount(g, M.tag.t1);
    else if (st.id === 'group') { const l = misLive(g, M.tag.lan); done = l.length > 0 && l.every(u => hyp(u.x - 1350, u.y - 1350) < 230); }
    else if (st.id === 'amove') done = !misCount(g, M.tag.t2);
    else if (st.id === 'mini') done = g.time >= M.t.mini;
    else if (st.id === 'yard') done = misHas(g, pi, 'yard');
    else if (st.id === 'reactor') done = misHas(g, pi, 'reactor');
    else if (st.id === 'train') done = h.stats.built > M.f.built0;
    else if (st.id === 'ability') done = g.ships.some(u => !u.dead && u.owner === pi && u.abcd && Object.values(u.abcd).some(v => v > 0));
    else if (st.id === 'defend') done = !misCount(g, M.tag.raid);
    if (done) {
      misSet(g, st.id, 2); M.S.hl = '';
      if (st.id === 'defend') { misSay(g, 'Sauber abgewehrt. Willkommen in der Flotte, Kommandant.', 'voss'); misWin(g); return; }
      const ok = ['Gut so.', 'Treffer.', 'Sauber.', 'Genau so.', 'Verstanden?', 'Die Werft steht.', 'Strom ist da.', 'Er läuft vom Band.', 'Spürst du die Wucht?'][k] || 'Gut.';
      misSay(g, ok, 'voss');
      M.t.next = g.time + 2.5;
    }
  }
};
