/* ===== data.js ===== */
'use strict';
/* =====================================================================
   SPIELDATEN – Fraktionen, Waffen, Schiffe, Gebäude, KI-Stufen
   Alle Zahlen des Balancings stehen hier und nur hier. Maße in Weltpixeln, Zeiten in Sekunden, Winkel in Bogenmaß.
   ===================================================================== */
const START_RES = { ice: 1200, ore: 600 };
const CP_BASE = 24;                          // Kommandopunkte ohne Relais
const BUILD_RANGE = 460;                     // Abstand eines neuen Gebäudes zum nächsten eigenen
const BUILD_RANGE_BASE = 700;                // … zur Kommandobasis
const XP_RANKS = [3, 8, 15];                 // Abschüsse je Rang (Veteran, Elite, Ass)
const RANK_NAMES = ['', 'Veteran', 'Elite', 'Ass'];
const CARGO_TIME = 6;                        // Sekunden, um den Frachtraum zu füllen
const SHIELD_DELAY = 3;                      // Sekunden ohne Treffer, bis der Schild wieder lädt
const DMG_VS_SHIELD = { beam: 1.4, kin: 0.6, torp: 1.0, pd: 1.0, rail: 0.7, acid: 0.8, bite: 0.9 };
const DMG_VS_HULL = { beam: 0.78, kin: 1.25, torp: 1.0, pd: 0.5, rail: 1.3, acid: 1.0, bite: 1.2 };
/* Konter nach Größenklasse des Ziels (f Jäger, s klein, m mittel, l groß): Torpedos gegen Große, Strahlen und Autokanonen
   gegen Kleine, Railguns gegen Mittlere. Stationen nehmen Torpedos und Railguns etwas stärker (BLD). */
const COUNTER = {
  torp: { f: 0.5, s: 0.75, m: 1.15, l: 1.9, b: 1.15 }, rail: { f: 0.5, s: 0.8, m: 1.35, l: 1.1, b: 1.15 },
  beam: { f: 1.15, s: 1.25, m: 1.0, l: 0.85, b: 0.9 }, art: { f: 0.1, s: 0.5, m: 0.75, l: 0.95, b: 2.2 }, kin: { f: 1.2, s: 1.2, m: 1.0, l: 0.85, b: 1.0 },
  acid: { f: 1, s: 0.9, m: 1.1, l: 1.2, b: 1.0 }, bite: { f: 1, s: 1.15, m: 1.0, l: 0.9, b: 0.9 }
};
/* Zielverfolgung: schwere Geschütze großer Schiffe folgen kleinen, wendigen Zielen schlecht (Schütze → Ziel) */
const TRACK = { l: { f: 0.4, s: 0.5, m: 0.85 }, m: { f: 0.7, s: 0.85 } };
const CLS_NAME = { s: 'kleine Schiffe', m: 'mittlere Schiffe', l: 'große Schiffe', b: 'Stationen' };
/* Flanke und Heck: Treffer von der Seite +10 %, von hinten +25 % */
const FLANK_SIDE = 1.1, FLANK_REAR = 1.25;
/* Kampftempo: Faktor auf allen Waffenschaden (Schiffe, Stationen) und auf Schild-/Hüllenregeneration (damit Schilde in
   längeren Kämpfen nicht übermächtig werden). Eruptionen, Superwaffen und Aschenebel bleiben unverändert. */
const PACE = { tactical: { dmg: 0.4, regen: 0.5 }, normal: { dmg: 0.7, regen: 0.75 }, fast: { dmg: 1, regen: 1 } };
/* Trefferchance der Punktverteidigung gegen Torpedos */
const PD_TORP = 0.4;
/* Bergung: Anteil der Baukosten, den ein Wrack als Rohstoff hergibt */
const SALVAGE = 0.25;
const RELIC_GATE = 3;                        // Relikte, um ein Tor zu aktivieren
const NET_R = 440;                           // Reichweite des Nexus-Netzes von Knoten zu Knoten

const FACTIONS = {
  alliance: { id: 'alliance', name: 'The Alliance', team: '#5fb8ff', glow: '#8fe3ff', wpn: '#7ff6ff', hull: '#e8eef4', trim: '#4f8fc8',
    desc: 'Schilde, Strahlwaffen und Teamarbeit. Schwäche: wenig reiner Schaden.',
    story: 'Zwölf Kolonien, die nach der Stille nur überlebten, weil sie alles teilten. Die Charta von Haven, ein Bund freier Welten.' },
  mars: { id: 'mars', name: 'Martian Republic', team: '#ff7a4a', glow: '#ffb070', wpn: '#ffd27a', hull: '#9a9ca3', trim: '#c23e2a',
    desc: 'Keine Schilde, dicke Panzerung, Railguns und Punktverteidigung. Schwäche: Massenangriffe und Säure.',
    story: 'Der Mars hat den Toren nie getraut und eigene Technik gebaut. Als die Stille kam, flog seine Flotte als einzige weiter.' },
  legion: { id: 'legion', name: 'Golden Legion', team: '#f2c14e', glow: '#c9a0ff', wpn: '#d9b8ff', hull: '#e8dcbb', trim: '#8e5bd6',
    desc: 'Wenige Heldenschiffe mit Namen und Begleitdrohnen, Lichtlanzen durch Schilde, Sprünge. Gefallene Helden ruhen als Wrack und lassen sich reaktivieren. Schwäche: jeder Verlust tut weh.',
    story: 'Die Elitegarde des alten Imperiums. In jedem Kriegsschiff lebt der gespeicherte Geist eines gefallenen Legionärs. Nach der Stille fiel die Legion in einen Wachschlaf – jetzt flackern die Tore, und sie erwacht.' },
  nexus: { id: 'nexus', name: 'The Nexus', team: '#c9a0ff', glow: '#eadcff', wpn: '#f3e6ff', hull: '#efe9fb', trim: '#7a4fd0',
    desc: 'Kristallschiffe, die zu größeren verschmelzen, Übernahme angeschlagener Feinde, ein Netz aus Knoten statt Frachtern. Schwäche: langsam, vom Netz abhängig.',
    story: 'Das Steuernetz der Tore, nach der Stille vierzig Jahre allein. Sein Schluss: Trennung ist die Ursache allen Leids. Seitdem verbindet es alles mit sich.' },
  brood: { id: 'brood', name: 'The Brood', team: '#8be04a', glow: '#d6ff6a', wpn: '#b4ff3c', hull: '#6a4a7e', trim: '#2e8b3a', bio: true,
    desc: 'Lebende Schiffe ohne Schild, die sich heilen. Säure, Parasiten, Massen; Larven mutieren in jede Form. Schwäche: keine Reichweite.',
    story: 'Die Stille war eine Quarantäne – gegen sie. Durch flackernde Tore sind die ersten Nester in den Kessel gelangt. Die Brood kennt nur Biomasse, und alles ist Biomasse.' },
  guardian: { id: 'guardian', name: 'Erbauer-Wächter', team: '#9ff0c0', glow: '#9ff0c0', wpn: '#b8ffd8', hull: '#7c8f86', trim: '#3fb37f', hidden: true,
    desc: 'Neutrale Maschinen der Erbauer. Bewachen Ruinen und Stätten.', story: '' }
};
const PLAYABLE = ['alliance', 'mars', 'legion', 'nexus', 'brood'];
/* Namen der Heldenschiffe der Legion (Reihenfolge je Partie aus dem Zufall des Spiels) */
const HERO_NAMES = ['Aurelian', 'Castor', 'Seraphine', 'Valdris', 'Octavia', 'Lucan', 'Theodric', 'Ismene', 'Cassian', 'Vesper', 'Halvard', 'Ophira', 'Tiberon', 'Maelis', 'Corvin', 'Elara', 'Dorian', 'Sabriel', 'Quintus', 'Nerida', 'Ferris', 'Ilsabet', 'Marcan', 'Thessaly'];
/* KI-Stufen: think Denkpause, inc Einkommensfaktor, aid Mindesteinkommen (Eis je Sekunde, das die Stufe immer bekommt),
   army Flottenstärke (Kommandopunkte) für den ersten Angriff, tankers Frachter je Raffinerie */
const AI_LEVELS = {
  1: { name: 'Leicht', think: 3.0, inc: 0.8, aid: 0, army: 12, tankers: 2, exp: 1, def: 1, first: 360 },
  2: { name: 'Mittel', think: 1.8, inc: 1.0, aid: 5, army: 20, tankers: 3, exp: 2, def: 2, first: 270 },
  3: { name: 'Schwer', think: 1.1, inc: 1.2, aid: 12, army: 24, tankers: 3, exp: 3, def: 3, first: 210 }
};

/* ------------------------------------------------------------------ Waffen
   kind: beam (Strahl, sofortiger Treffer, viele kleine Impulse), kin (Geschoss, kann vorbeigehen), rail (Railgun,
   durchschlägt mehrere Ziele), torp (Torpedo, verfolgt sein Ziel, kann abgeschossen werden), pd (Punktverteidigung
   gegen Torpedos und Jäger). arc: halber Öffnungswinkel des Schussfelds, mount: Richtung des Schussfelds zum Bug. */
const W = {
  beamS: { kind: 'beam', dmg: 5, range: 260, arc: 0.6, mount: 0, reload: 0.12, snd: 'beam', w: 1.5 },
  beamM: { kind: 'beam', dmg: 7, range: 320, arc: 0.55, mount: 0, reload: 0.12, snd: 'beam', w: 2.2 },
  beamT: { kind: 'beam', dmg: 3, range: 240, arc: Math.PI, mount: 0, reload: 0.12, snd: 'beam', w: 1.2 },
  beamH: { kind: 'beam', dmg: 10, range: 360, arc: 0.9, mount: Math.PI / 2, reload: 0.12, snd: 'beam', w: 3 },
  beamHL: { kind: 'beam', dmg: 10, range: 360, arc: 0.9, mount: -Math.PI / 2, reload: 0.12, snd: 'beam', w: 3 },
  beamTw: { kind: 'beam', dmg: 6, range: 340, arc: Math.PI, mount: 0, reload: 0.12, snd: 'beam', w: 2.2 },
  beamTw3: { kind: 'beam', dmg: 9, range: 400, arc: Math.PI, mount: 0, reload: 0.12, snd: 'beam', w: 3 },
  fighter: { kind: 'kin', dmg: 7, range: 150, arc: 0.5, mount: 0, reload: 0.25, speed: 700, snd: 'auto', col: '#9ff' },
  autoS: { kind: 'kin', dmg: 10, range: 290, arc: Math.PI, mount: 0, reload: 0.4, speed: 820, snd: 'auto', spread: 0.06 },
  autoM: { kind: 'kin', dmg: 21, range: 320, arc: Math.PI, mount: 0, reload: 0.5, speed: 820, snd: 'auto', spread: 0.05 },
  autoB: { kind: 'kin', dmg: 32, range: 340, arc: 0.8, mount: Math.PI / 2, reload: 0.5, speed: 800, snd: 'cannon', spread: 0.05 },
  autoBL: { kind: 'kin', dmg: 32, range: 340, arc: 0.8, mount: -Math.PI / 2, reload: 0.5, speed: 800, snd: 'cannon', spread: 0.05 },
  autoTw: { kind: 'kin', dmg: 18, range: 360, arc: Math.PI, mount: 0, reload: 0.45, speed: 820, snd: 'cannon', spread: 0.04 },
  torpS: { kind: 'torp', dmg: 110, range: 420, arc: 0.7, mount: 0, reload: 8, speed: 240, turn: 1.6, life: 7, hp: 1, snd: 'torp' },
  torpM: { kind: 'torp', dmg: 120, range: 480, arc: 0.9, mount: 0, reload: 7, speed: 250, turn: 1.5, life: 7, hp: 1, snd: 'torp' },
  rail: { kind: 'rail', dmg: 220, range: 640, minR: 140, arc: 0.12, mount: 0, reload: 5, speed: 1600, pierce: 3, snd: 'rail' },
  railTw: { kind: 'rail', dmg: 180, range: 600, minR: 120, arc: Math.PI, mount: 0, reload: 7, speed: 1600, pierce: 2, snd: 'rail' },
  pd: { kind: 'pd', dmg: 20, range: 190, arc: Math.PI, mount: 0, reload: 0.22, snd: 'pd' },
  pdH: { kind: 'pd', dmg: 30, range: 230, arc: Math.PI, mount: 0, reload: 0.18, snd: 'pd' },
  /* Runde 2: Flaggschiffe und Doktrin-Schiffe */
  lanceX: { kind: 'beam', dmg: 14, range: 420, arc: 0.45, mount: 0, reload: 0.12, snd: 'beam', w: 3.4 },
  beamF: { kind: 'beam', dmg: 12, range: 380, arc: 0.9, mount: Math.PI / 2, reload: 0.12, snd: 'beam', w: 3.2 },
  beamFL: { kind: 'beam', dmg: 12, range: 380, arc: 0.9, mount: -Math.PI / 2, reload: 0.12, snd: 'beam', w: 3.2 },
  /* Fassung 21: Belagerungsgranaten – Bogenschuss nur auf Stationen, weit über die Reichweite jedes Turms hinaus, nur im Stand */
  shell: { kind: 'art', dmg: 300, range: 980, minR: 340, arc: Math.PI, mount: 0, reload: 6, speed: 300, splash: 70, art: 1, snd: 'cannon', col: '#ffb070' },
  shellAcid: { kind: 'art', dmg: 270, range: 960, minR: 340, arc: Math.PI, mount: 0, reload: 5.5, speed: 280, splash: 80, art: 1, snd: 'cannon', col: '#b4ff3c' },
  shellLance: { kind: 'art', dmg: 320, range: 1000, minR: 340, arc: Math.PI, mount: 0, reload: 6.5, speed: 320, splash: 60, art: 1, snd: 'cannon', col: '#d9b8ff' },
  railS: { kind: 'rail', dmg: 120, range: 520, minR: 100, arc: 0.15, mount: 0, reload: 4, speed: 1600, pierce: 2, snd: 'rail' },
  railF: { kind: 'rail', dmg: 200, range: 620, minR: 120, arc: 0.5, mount: Math.PI / 2, reload: 6, speed: 1600, pierce: 3, snd: 'rail' },
  railFL: { kind: 'rail', dmg: 200, range: 620, minR: 120, arc: 0.5, mount: -Math.PI / 2, reload: 6, speed: 1600, pierce: 3, snd: 'rail' },
  torpW: { kind: 'torp', dmg: 90, range: 440, arc: 0.8, mount: 0, reload: 5, speed: 260, turn: 1.8, life: 7, hp: 1, snd: 'torp' },
  /* Runde 3: Golden Legion – Lichtlanzen (violett), ein Teil geht durch Schilde (sp). Inquisitor: Strahl, der auf demselben
     Ziel bis zum Dreifachen anwächst (ramp). Zealot: Lanzenbug im Nahkampf. */
  lanceS: { kind: 'beam', dmg: 6, range: 330, arc: 0.6, mount: 0, reload: 0.12, snd: 'beam', w: 2, sp: 0.3, col: '#d9b8ff' },
  lanceM: { kind: 'beam', dmg: 10, range: 380, arc: 0.7, mount: 0, reload: 0.12, snd: 'beam', w: 2.8, sp: 0.3, col: '#d9b8ff' },
  lanceH: { kind: 'beam', dmg: 15, range: 430, arc: 0.6, mount: 0, reload: 0.12, snd: 'beam', w: 3.6, sp: 0.35, col: '#d9b8ff' },
  lanceT: { kind: 'beam', dmg: 5, range: 300, arc: Math.PI, mount: 0, reload: 0.12, snd: 'beam', w: 1.6, sp: 0.25, col: '#d9b8ff' },
  lanceSide: { kind: 'beam', dmg: 11, range: 400, arc: 0.9, mount: Math.PI / 2, reload: 0.12, snd: 'beam', w: 3, sp: 0.3, col: '#d9b8ff' },
  lanceSideL: { kind: 'beam', dmg: 11, range: 400, arc: 0.9, mount: -Math.PI / 2, reload: 0.12, snd: 'beam', w: 3, sp: 0.3, col: '#d9b8ff' },
  inqBeam: { kind: 'beam', dmg: 5, range: 400, arc: 0.5, mount: 0, reload: 0.12, snd: 'beam', w: 2.4, sp: 0.2, ramp: 3, col: '#ffd9ff' },
  ramBow: { kind: 'beam', dmg: 30, range: 95, arc: 0.4, mount: 0, reload: 0.12, snd: 'beam', w: 4, sp: 0.6, col: '#ffe6a0' },
  cherub: { kind: 'kin', dmg: 6, range: 160, arc: 0.5, mount: 0, reload: 0.22, speed: 720, snd: 'auto', col: '#e6ccff' },
  /* The Nexus – Kristallstrahlen (weiß-violett). Prism bricht den Strahl auf bis zu drei Ziele (split). */
  shardBeam: { kind: 'beam', dmg: 5, range: 300, arc: 0.8, mount: 0, reload: 0.12, snd: 'beam', w: 1.8, col: '#f3e6ff' },
  prismBeam: { kind: 'beam', dmg: 11, range: 360, arc: 0.9, mount: 0, reload: 0.12, snd: 'beam', w: 2.6, split: 3, col: '#f3e6ff' },
  monoBeam: { kind: 'beam', dmg: 20, range: 440, arc: 0.6, mount: 0, reload: 0.12, snd: 'beam', w: 4.2, col: '#f3e6ff' },
  monoSide: { kind: 'beam', dmg: 10, range: 380, arc: Math.PI, mount: 0, reload: 0.12, snd: 'beam', w: 2.4, split: 2, col: '#f3e6ff' },
  facetBeam: { kind: 'beam', dmg: 14, range: 420, arc: Math.PI, mount: 0, reload: 0.12, snd: 'beam', w: 3.2, split: 4, col: '#f3e6ff' },
  spireBeam: { kind: 'beam', dmg: 8, range: 340, arc: Math.PI, mount: 0, reload: 0.12, snd: 'beam', w: 2.2, col: '#f3e6ff' },
  crystalPd: { kind: 'pd', dmg: 24, range: 200, arc: Math.PI, mount: 0, reload: 0.2, snd: 'pd' },
  shardShot: { kind: 'kin', dmg: 28, range: 380, arc: Math.PI, mount: 0, reload: 0.6, speed: 760, snd: 'cannon', col: '#e6d2ff', spread: 0.05 },
  /* The Brood – Säure (acid: Schaden über Zeit, ohne Panzerung), Bisse (bite: Nahkampf, ap: durch Panzerung), Parasiten (para) */
  bite: { kind: 'kin', dmg: 8, range: 70, arc: 0.8, mount: 0, reload: 0.45, speed: 600, snd: 'bite', col: '#b4ff3c', ap: 1, bite: 1 },
  maw: { kind: 'kin', dmg: 46, range: 64, arc: 0.6, mount: 0, reload: 0.9, speed: 600, snd: 'bite', col: '#b4ff3c', ap: 1, bite: 1 },
  mawH: { kind: 'kin', dmg: 90, range: 80, arc: 0.7, mount: 0, reload: 1.2, speed: 600, snd: 'bite', col: '#b4ff3c', ap: 1, bite: 1 },
  acidSpit: { kind: 'kin', dmg: 26, range: 330, arc: 0.9, mount: 0, reload: 0.9, speed: 480, snd: 'acid', col: '#b4ff3c', acid: 1, spread: 0.04 },
  acidHeavy: { kind: 'kin', dmg: 48, range: 380, arc: Math.PI, mount: 0, reload: 1.3, speed: 460, snd: 'acid', col: '#b4ff3c', acid: 1, spread: 0.04 },
  acidTw: { kind: 'kin', dmg: 30, range: 360, arc: Math.PI, mount: 0, reload: 0.8, speed: 480, snd: 'acid', col: '#b4ff3c', acid: 1, spread: 0.04 },
  parasite: { kind: 'kin', dmg: 8, range: 290, arc: 0.9, mount: 0, reload: 3.5, speed: 420, snd: 'acid', col: '#ff9ad6', para: 1 },
  /* Erbauer-Wächter */
  wardBeam: { kind: 'beam', dmg: 12, range: 380, arc: Math.PI, mount: 0, reload: 0.12, snd: 'beam', w: 3, col: '#b8ffd8' },
  wardLance: { kind: 'beam', dmg: 26, range: 520, arc: 0.5, mount: 0, reload: 0.12, snd: 'beam', w: 5, sp: 0.4, col: '#b8ffd8' },
  droneGun: { kind: 'kin', dmg: 9, range: 260, arc: Math.PI, mount: 0, reload: 0.35, speed: 760, snd: 'auto', col: '#b8ffd8' }
};
for (const id in W) W[id].id = id;

/* ------------------------------------------------------------------ Schiffe
   cls: Größenklasse s/m/l (bestimmt Werft-Stufe und ob Asteroidenfelder passierbar sind), r Rumpfradius, len Länge,
   tier: 1 ohne Labor, 2 Labor Stufe 1, 3 Labor Stufe 2. cp Kommandopunkte. Rollen: builder, tanker, war, carrier */
const SHIPS = {
  /* ---- The Alliance ---- */
  pathfinder: { f: 'alliance', name: 'Pathfinder', role: 'builder', cls: 's', r: 13, len: 34, hull: 320, shield: 160, sreg: 18, speed: 95, accel: 80, turn: 2.6, sensor: 380, cp: 1, cost: { ice: 300, ore: 150 }, time: 18, tier: 1, yard: 1, build: 1,
    desc: 'Bauschiff. Errichtet Stationen und repariert sie langsam.' },
  hauler: { f: 'alliance', name: 'Hauler', role: 'tanker', cls: 's', r: 12, len: 30, hull: 260, shield: 100, sreg: 14, speed: 105, accel: 90, turn: 2.8, sensor: 300, cp: 1, cost: { ice: 200, ore: 40 }, time: 12, tier: 1, yard: 1, cargo: 120,
    desc: 'Frachter. Baut Eis und Erz ab und bringt es zur Raffinerie.' },
  wren: { f: 'alliance', name: 'Wren', role: 'war', cls: 's', r: 10, len: 26, hull: 150, shield: 130, sreg: 16, speed: 165, accel: 140, turn: 3.3, sensor: 460, cp: 1, cost: { ice: 220, ore: 60 }, time: 11, tier: 1, yard: 1, wpn: ['beamS'],
    desc: 'Korvette. Schnell, mit großer Sensorreichweite. Gut zum Aufklären und gegen Frachter.' },
  lancer: { f: 'alliance', name: 'Lancer', role: 'war', cls: 's', r: 14, len: 38, hull: 330, shield: 280, sreg: 24, speed: 118, accel: 90, turn: 2.1, sensor: 400, cp: 2, cost: { ice: 380, ore: 160 }, time: 16, tier: 1, yard: 1, wpn: ['beamM', 'beamT'],
    desc: 'Fregatte. Allrounder mit Bugstrahl und Strahlturm. Rückgrat der Flotte.' },
  bulwark: { f: 'alliance', name: 'Bulwark', role: 'war', cls: 'm', r: 20, len: 56, hull: 680, shield: 620, sreg: 40, speed: 82, accel: 55, turn: 1.3, sensor: 400, cp: 3, cost: { ice: 720, ore: 360 }, time: 26, tier: 2, yard: 2, wpn: ['beamH', 'beamHL', 'beamT'], link: 140,
    desc: 'Kreuzer mit Schildverbund: Nachbarschiffe im Umkreis teilen ihren Schaden mit ihm. Breitseiten-Strahlen.' },
  haven: { f: 'alliance', name: 'Haven', role: 'carrier', cls: 'l', r: 28, len: 80, hull: 950, shield: 520, sreg: 36, speed: 62, accel: 40, turn: 0.9, sensor: 440, cp: 4, cost: { ice: 1100, ore: 600 }, time: 36, tier: 3, yard: 3, wpn: ['beamT'], hangar: 6, keep: 460,
    desc: 'Träger. Startet sechs Jäger und ersetzt verlorene. Hält sich aus dem Gefecht heraus.' },
  fighter: { f: 'alliance', name: 'Jäger', role: 'fighter', cls: 'f', r: 5, len: 12, hull: 60, shield: 0, sreg: 0, speed: 240, accel: 300, turn: 5, sensor: 200, cp: 0, cost: { ice: 0, ore: 0 }, time: 0, tier: 9, yard: 9, wpn: ['fighter'], hidden: true,
    desc: 'Jäger des Trägers Haven.' },
  /* ---- Martian Republic ---- */
  prospector: { f: 'mars', name: 'Prospector', role: 'builder', cls: 's', r: 14, len: 36, hull: 480, shield: 0, armor: 2, speed: 88, accel: 70, turn: 2.3, sensor: 360, cp: 1, cost: { ice: 300, ore: 150 }, time: 18, tier: 1, yard: 1, build: 1,
    desc: 'Bauschiff. Höhlt Asteroiden aus und errichtet Stationen.' },
  icehauler: { f: 'mars', name: 'Ice Hauler', role: 'tanker', cls: 's', r: 13, len: 32, hull: 420, shield: 0, armor: 2, speed: 98, accel: 80, turn: 2.5, sensor: 300, cp: 1, cost: { ice: 220, ore: 50 }, time: 12, tier: 1, yard: 1, cargo: 120,
    desc: 'Gepanzerter Frachter. Hält mehr aus als jeder andere Frachter.' },
  needle: { f: 'mars', name: 'Needle', role: 'war', cls: 's', r: 9, len: 30, hull: 300, shield: 0, armor: 1, speed: 185, accel: 170, turn: 3.4, sensor: 420, cp: 1, cost: { ice: 230, ore: 70 }, time: 11, tier: 1, yard: 1, wpn: ['torpS', 'autoS'],
    desc: 'Korvette mit Fackelantrieb. Sehr schnell, zwei Torpedos und eine leichte Autokanone.' },
  hedgehog: { f: 'mars', name: 'Hedgehog', role: 'war', cls: 's', r: 14, len: 36, hull: 520, shield: 0, armor: 2, speed: 112, accel: 85, turn: 2.0, sensor: 420, cp: 2, cost: { ice: 380, ore: 170 }, time: 16, tier: 1, yard: 1, wpn: ['pd', 'autoM', 'autoM'],
    desc: 'Abwehrfregatte. Zwei Autokanonen, dazu Punktverteidigung gegen Torpedos und Jäger.' },
  spear: { f: 'mars', name: 'Spear', role: 'war', cls: 'm', r: 18, len: 70, hull: 620, shield: 0, armor: 3, speed: 76, accel: 50, turn: 1.1, sensor: 520, cp: 3, cost: { ice: 760, ore: 420 }, time: 27, tier: 2, yard: 2, wpn: ['rail', 'autoS'], keep: 520,
    desc: 'Railgun-Kreuzer. Durchschlägt bis zu drei Ziele in einer Linie, braucht Abstand und lädt lange nach.' },
  hammer: { f: 'mars', name: 'Hammer', role: 'war', cls: 'l', r: 27, len: 82, hull: 1550, shield: 0, armor: 4, speed: 56, accel: 35, turn: 0.85, sensor: 420, cp: 4, cost: { ice: 1200, ore: 720 }, time: 38, tier: 3, yard: 3, wpn: ['autoB', 'autoB', 'autoBL', 'autoBL', 'pd', 'pd'], side: true,
    desc: 'Schlachtschiff. Breitseiten aus Autokanonen, schwerste Panzerung. Dreht die Flanke zum Feind.' },
  boarder: { f: 'mars', name: 'Boarder', role: 'war', cls: 's', r: 13, len: 34, hull: 380, shield: 0, armor: 2, speed: 125, accel: 100, turn: 2.4, sensor: 380, cp: 2, cost: { ice: 400, ore: 180 }, time: 17, tier: 2, yard: 1, wpn: ['autoS'], marines: 40, ab: 'board',
    desc: 'Enterschiff mit 40 Marines. Setzt sie auf ein Schiff über, dessen Crew geschwächt ist, und übernimmt es.' },
  /* ---- Flaggschiffe: eines je Partei, drei Fähigkeiten, Kommandant mit Namen ---- */
  archipelago: { f: 'alliance', name: 'Archipelago', role: 'war', cls: 'l', r: 30, len: 86, hull: 1500, shield: 950, sreg: 44, speed: 62, accel: 40, turn: 0.9, sensor: 480, cp: 5, cost: { ice: 1600, ore: 900 }, time: 48, tier: 3, yard: 3, wpn: ['beamF', 'beamFL', 'beamT', 'pdH'], link: 200, flag: true, abs: ['fieldyard', 'truce'], cmdr: 'Admiralin Ilya Voss',
    desc: 'Flaggschiff der Alliance. Werft im Feld, Schildverbund wie ein Bulwark und Waffenstillstand im Umkreis.' },
  olympus: { f: 'mars', name: 'Olympus', role: 'war', cls: 'l', r: 29, len: 88, hull: 2300, shield: 0, armor: 5, speed: 55, accel: 34, turn: 0.8, sensor: 480, cp: 5, cost: { ice: 1700, ore: 1000 }, time: 50, tier: 3, yard: 3, wpn: ['railF', 'railFL', 'autoB', 'autoBL', 'pdH', 'pdH'], side: true, flag: true, abs: ['broadside', 'grush', 'mark'], cmdr: 'Kommandantin Mara Kessler',
    desc: 'Flaggschiff der Republik. Railgun-Breitseite, G-Rausch für die Flotte und Zielmarkierung.' },
  /* ---- Doktrin-Schiffe (nur mit der passenden Doktrin baubar) ---- */
  aegis: { f: 'alliance', name: 'Aegis', role: 'war', cls: 'm', r: 19, len: 52, hull: 560, shield: 700, sreg: 50, speed: 85, accel: 55, turn: 1.3, sensor: 400, cp: 3, cost: { ice: 680, ore: 340 }, time: 25, tier: 2, yard: 2, wpn: ['beamT', 'beamT'], doc: 'charter', ab: 'dome',
    desc: 'Charter Guard. Spannt eine Schildkuppel auf: Verbündete im Umkreis nehmen 6 Sekunden lang nur halben Schaden.' },
  beacon: { f: 'alliance', name: 'Beacon', role: 'war', cls: 's', r: 12, len: 30, hull: 240, shield: 220, sreg: 20, speed: 120, accel: 90, turn: 2.6, sensor: 900, cp: 1, cost: { ice: 260, ore: 90 }, time: 13, tier: 1, yard: 1, wpn: [], doc: 'explorer',
    desc: 'Explorer Corps. Mobile Sensorstation mit riesiger Reichweite, unbewaffnet.' },
  reckoning: { f: 'alliance', name: 'Reckoning', role: 'war', cls: 'm', r: 20, len: 58, hull: 620, shield: 480, sreg: 34, speed: 88, accel: 55, turn: 1.4, sensor: 420, cp: 3, cost: { ice: 760, ore: 420 }, time: 27, tier: 2, yard: 2, wpn: ['lanceX', 'beamT'], doc: 'hardline', keep: 380,
    desc: 'Hardliners. Kreuzer mit Erbauer-Lanze: ein schwerer Strahl mit großer Reichweite.' },
  longshot: { f: 'mars', name: 'Longshot', role: 'war', cls: 's', r: 13, len: 40, hull: 360, shield: 0, armor: 2, speed: 110, accel: 80, turn: 1.9, sensor: 480, cp: 2, cost: { ice: 420, ore: 220 }, time: 17, tier: 1, yard: 1, wpn: ['railS'], doc: 'navy', keep: 440,
    desc: 'Navy Doctrine. Kleine Railgun-Fregatte, die auf Abstand bleibt.' },
  dropship: { f: 'mars', name: 'Dropship', role: 'war', cls: 'm', r: 17, len: 46, hull: 620, shield: 0, armor: 3, speed: 105, accel: 80, turn: 1.8, sensor: 380, cp: 3, cost: { ice: 620, ore: 300 }, time: 24, tier: 2, yard: 2, wpn: ['autoS', 'pd'], marines: 90, ab: 'board', doc: 'marines', stationsToo: true,
    desc: 'Marines. 90 Marines an Bord, entert Schiffe und sogar Stationen.' },
  wasp: { f: 'mars', name: 'Wasp', role: 'war', cls: 's', r: 10, len: 30, hull: 260, shield: 0, armor: 1, speed: 200, accel: 190, turn: 3.6, sensor: 420, cp: 1, cost: { ice: 260, ore: 90 }, time: 12, tier: 1, yard: 1, wpn: ['torpW', 'torpW'], doc: 'torch', ab: 'grush',
    desc: 'Torch Raiders. Torpedo-Korvette mit Nachbrenner, zwei Rohre.' },
  /* ---- Golden Legion: Heldenschiffe mit Namen (hero), Begleitdrohnen (hangar: cherub), fallen als Wrack (dormant) ---- */
  restorer: { f: 'legion', name: 'Restorer', role: 'builder', cls: 's', r: 13, len: 34, hull: 360, shield: 220, sreg: 20, speed: 92, accel: 80, turn: 2.5, sensor: 380, cp: 1, cost: { ice: 300, ore: 150 }, time: 18, tier: 1, yard: 1, build: 1,
    desc: 'Bauschiff. Errichtet Stationen und erweckt gefallene Heldenschiffe wieder (Wrack anfliegen).' },
  gleaner: { f: 'legion', name: 'Gleaner', role: 'tanker', cls: 's', r: 12, len: 30, hull: 280, shield: 140, sreg: 14, speed: 100, accel: 85, turn: 2.6, sensor: 300, cp: 1, cost: { ice: 200, ore: 40 }, time: 12, tier: 1, yard: 1, cargo: 125, relicBonus: 1,
    desc: 'Sammler. Baut Eis und Erz ab; findet in Ruinen doppelt so viele Relikte.' },
  cherub: { f: 'legion', name: 'Cherub', role: 'fighter', cls: 'f', r: 5, len: 12, hull: 70, shield: 30, sreg: 8, speed: 230, accel: 300, turn: 5, sensor: 200, cp: 0, cost: { ice: 0, ore: 0 }, time: 0, tier: 9, yard: 9, wpn: ['cherub'], hidden: true, crew: 0,
    desc: 'Begleitdrohne eines Heldenschiffs.' },
  herald: { f: 'legion', name: 'Herald', role: 'war', cls: 's', r: 11, len: 30, hull: 220, shield: 220, sreg: 20, speed: 160, accel: 130, turn: 3.2, sensor: 520, cp: 1, cost: { ice: 270, ore: 80 }, time: 14, tier: 1, yard: 1, wpn: ['lanceS'], hangar: 2, drone: 'cherub', hero: true, ab: 'blink',
    desc: 'Leichtes Heldenschiff. Springt ein Stück nach vorn, klärt auf, zwei Begleitdrohnen.' },
  paladin: { f: 'legion', name: 'Paladin', role: 'war', cls: 's', r: 15, len: 40, hull: 400, shield: 360, sreg: 26, speed: 110, accel: 85, turn: 2.0, sensor: 420, cp: 2, cost: { ice: 460, ore: 200 }, time: 20, tier: 1, yard: 1, wpn: ['lanceM', 'lanceT'], hangar: 2, drone: 'cherub', hero: true, ab: 'overload',
    desc: 'Heldenfregatte mit Lichtlanze: ein Drittel des Schadens geht durch Schilde. Zwei Begleitdrohnen.' },
  bastion: { f: 'legion', name: 'Bastion', role: 'war', cls: 'm', r: 21, len: 56, hull: 760, shield: 760, sreg: 46, speed: 78, accel: 50, turn: 1.2, sensor: 400, cp: 3, cost: { ice: 820, ore: 420 }, time: 28, tier: 2, yard: 2, wpn: ['lanceSide', 'lanceSideL', 'lanceT'], link: 160, hangar: 3, drone: 'cherub', hero: true, ab: 'dome',
    desc: 'Schildfestung. Schildverbund für Nachbarn und Drohnen, spannt eine Schildkuppel auf. Drei Begleitdrohnen.' },
  inquisitor: { f: 'legion', name: 'Inquisitor', role: 'war', cls: 'm', r: 19, len: 58, hull: 600, shield: 520, sreg: 34, speed: 86, accel: 55, turn: 1.4, sensor: 440, cp: 3, cost: { ice: 800, ore: 460 }, time: 28, tier: 2, yard: 2, wpn: ['inqBeam', 'lanceT'], hangar: 2, drone: 'cherub', hero: true, keep: 380,
    desc: 'Verhörstrahl: je länger er auf demselben Ziel bleibt, desto mehr Schaden, bis zum Dreifachen. Zwei Begleitdrohnen.' },
  reliquary: { f: 'legion', name: 'Reliquary', role: 'war', cls: 'm', r: 18, len: 50, hull: 560, shield: 560, sreg: 36, speed: 84, accel: 55, turn: 1.4, sensor: 440, cp: 2, cost: { ice: 640, ore: 320 }, time: 24, tier: 2, yard: 2, wpn: ['pd'], hangar: 2, drone: 'cherub', hero: true, bless: 240, siteBonus: 2, ab: 'repair',
    desc: 'Trägt die Relikte: Verbündete im Umkreis +12 % Schaden, Stätten und Ruinen doppelt so schnell. Notreparatur.' },
  basilica: { f: 'legion', name: 'Basilica', role: 'war', cls: 'l', r: 30, len: 88, hull: 2200, shield: 1300, sreg: 52, speed: 54, accel: 34, turn: 0.8, sensor: 460, cp: 6, cost: { ice: 1900, ore: 1100 }, time: 60, tier: 3, yard: 3, wpn: ['lanceH', 'lanceH', 'lanceSide', 'lanceSideL', 'lanceT', 'pdH'], hangar: 4, drone: 'cherub', hero: true, ab: 'surge',
    desc: 'Kathedralenschiff. Langsam, enorm stark, vier Begleitdrohnen.' },
  sovereign: { f: 'legion', name: 'Last Sovereign', role: 'war', cls: 'l', r: 30, len: 90, hull: 1700, shield: 1200, sreg: 50, speed: 60, accel: 38, turn: 0.9, sensor: 500, cp: 5, cost: { ice: 1700, ore: 950 }, time: 50, tier: 3, yard: 3, wpn: ['lanceH', 'lanceSide', 'lanceSideL', 'lanceT', 'pdH'], hangar: 3, drone: 'cherub', flag: true, hero: true, resurrect: 1, abs: ['fleetjump', 'lance'], cmdr: 'KI »Seraph«',
    desc: 'Flaggschiff der Legion. Das Schiff selbst ist der Kommandant. Sprung mit der Flotte, Lichtlanze, einmal pro Partie Wiederauferstehung.' },
  sanctum: { f: 'legion', name: 'Sanctum', role: 'war', cls: 'm', r: 20, len: 54, hull: 700, shield: 700, sreg: 44, speed: 80, accel: 50, turn: 1.3, sensor: 420, cp: 3, cost: { ice: 760, ore: 380 }, time: 26, tier: 2, yard: 2, wpn: ['lanceT', 'pd'], hangar: 2, drone: 'cherub', hero: true, doc: 'restoration', ab: 'fieldyard',
    desc: 'Restoration. Mobile Reparatur-Kathedrale: Feldwerft für die Flotte.' },
  zealot: { f: 'legion', name: 'Zealot', role: 'war', cls: 's', r: 12, len: 36, hull: 380, shield: 240, sreg: 22, speed: 175, accel: 150, turn: 3.0, sensor: 400, cp: 2, cost: { ice: 380, ore: 160 }, time: 15, tier: 1, yard: 1, wpn: ['ramBow', 'lanceT'], hangar: 1, drone: 'cherub', hero: true, doc: 'crusade', ab: 'grush', keep: 60,
    desc: 'Crusade. Rammschiff mit Lanzenbug: fliegt heran und brennt sich durch Schilde.' },
  oracle: { f: 'legion', name: 'Oracle', role: 'war', cls: 's', r: 12, len: 32, hull: 260, shield: 300, sreg: 24, speed: 120, accel: 90, turn: 2.6, sensor: 820, cp: 1, cost: { ice: 300, ore: 120 }, time: 14, tier: 1, yard: 1, wpn: [], hero: true, doc: 'ascension', ab: 'reveal', siteBonus: 2,
    desc: 'Ascension. Sieht weit, deckt Stätten auf, Weitblick über die ganze Karte.' },
  /* ---- The Nexus: Kristalle. merge: drei verschmelzen zur nächsten Form. net: Harvester liefern ins Netz. node: zählt als Netzknoten ---- */
  seed: { f: 'nexus', name: 'Seed', role: 'builder', cls: 's', r: 13, len: 32, hull: 340, shield: 240, sreg: 22, speed: 90, accel: 80, turn: 2.6, sensor: 380, cp: 1, cost: { ice: 300, ore: 150 }, time: 18, tier: 1, yard: 1, build: 1, node: 1,
    desc: 'Bauschiff. Setzt Knoten und Stationen; alles muss am Netz hängen. Zählt selbst als Knoten.' },
  harvester: { f: 'nexus', name: 'Harvester', role: 'tanker', cls: 's', r: 12, len: 30, hull: 300, shield: 160, sreg: 16, speed: 95, accel: 85, turn: 2.6, sensor: 300, cp: 1, cost: { ice: 220, ore: 50 }, time: 12, tier: 1, yard: 1, cargo: 70, mineT: 1.4, net: true,
    desc: 'Löst Vorkommen auf und schickt das Material durchs Netz: liefert sofort, solange es in Reichweite eines Knotens steht.' },
  shard: { f: 'nexus', name: 'Shard', role: 'war', cls: 's', r: 9, len: 24, hull: 150, shield: 150, sreg: 18, speed: 140, accel: 120, turn: 3.2, sensor: 400, cp: 1, cost: { ice: 200, ore: 60 }, time: 10, tier: 1, yard: 1, wpn: ['shardBeam'], merge: 'prism',
    desc: 'Billiger Kristallsplitter. Drei Shards verschmelzen zu einem Prism (Taste »Verschmelzen«).' },
  prism: { f: 'nexus', name: 'Prism', role: 'war', cls: 'm', r: 17, len: 46, hull: 560, shield: 520, sreg: 34, speed: 90, accel: 60, turn: 1.6, sensor: 420, cp: 3, cost: { ice: 620, ore: 280 }, time: 24, tier: 2, yard: 2, wpn: ['prismBeam', 'crystalPd'], merge: 'monolith',
    desc: 'Bricht seinen Strahl auf bis zu drei Ziele. Drei Prisms verschmelzen zu einem Monolith.' },
  monolith: { f: 'nexus', name: 'Monolith', role: 'war', cls: 'l', r: 27, len: 80, hull: 1900, shield: 1500, sreg: 48, speed: 52, accel: 32, turn: 0.8, sensor: 460, cp: 6, cost: { ice: 1800, ore: 1000 }, time: 56, tier: 3, yard: 3, wpn: ['monoBeam', 'monoBeam', 'monoSide', 'crystalPd', 'crystalPd'], merge: 'colossus',
    desc: 'Langsam, enorme Feuerkraft. Mit der Doktrin Singularity verschmelzen drei zu einem Colossus.' },
  binder: { f: 'nexus', name: 'Binder', role: 'war', cls: 'm', r: 16, len: 42, hull: 480, shield: 420, sreg: 30, speed: 105, accel: 75, turn: 1.9, sensor: 420, cp: 2, cost: { ice: 520, ore: 240 }, time: 20, tier: 2, yard: 1, wpn: ['shardBeam', 'shardBeam'], ab: 'bind', bindAt: 0.25,
    desc: 'Übernimmt ein feindliches Schiff mit weniger als 25 % Hülle (Taste »Übernahme«, dann Ziel).' },
  lattice: { f: 'nexus', name: 'Lattice', role: 'war', cls: 's', r: 12, len: 30, hull: 280, shield: 300, sreg: 24, speed: 110, accel: 80, turn: 2.6, sensor: 500, cp: 1, cost: { ice: 260, ore: 100 }, time: 13, tier: 1, yard: 1, wpn: [], node: 1,
    desc: 'Mobiler Netzknoten, unbewaffnet. Harvester liefern in seiner Nähe, Stationen bleiben verbunden.' },
  mirror: { f: 'nexus', name: 'Mirror', role: 'war', cls: 'm', r: 18, len: 48, hull: 620, shield: 700, sreg: 40, speed: 86, accel: 55, turn: 1.4, sensor: 400, cp: 3, cost: { ice: 700, ore: 340 }, time: 25, tier: 2, yard: 2, wpn: ['shardBeam', 'crystalPd'], reflect: 0.3, adapt: 1,
    desc: 'Wirft 30 % des Strahlschadens zurück. Passt sich an: gegen jede Waffenart, die es trifft, bis zu 50 % weniger Schaden.' },
  facet: { f: 'nexus', name: 'Prime Facet', role: 'war', cls: 'l', r: 29, len: 86, hull: 1800, shield: 1700, sreg: 56, speed: 58, accel: 36, turn: 0.9, sensor: 520, cp: 5, cost: { ice: 1700, ore: 950 }, time: 50, tier: 3, yard: 3, wpn: ['facetBeam', 'monoBeam', 'crystalPd', 'crystalPd'], node: 1, flag: true, abs: ['massbind', 'shardstorm', 'gravwell'], cmdr: 'Prime Facet, der älteste Kristall',
    desc: 'Flaggschiff des Nexus. Übernahme im Bereich, Splittersturm, Gravitationssog. Mobiler Netzknoten.' },
  conduit: { f: 'nexus', name: 'Conduit', role: 'war', cls: 'm', r: 17, len: 44, hull: 520, shield: 480, sreg: 32, speed: 100, accel: 70, turn: 1.8, sensor: 420, cp: 3, cost: { ice: 600, ore: 280 }, time: 22, tier: 2, yard: 2, wpn: ['shardBeam', 'shardBeam'], ab: 'bind', bindAt: 0.35, stationsToo: true, doc: 'unity',
    desc: 'Unity. Übernimmt Schiffe und sogar Stationen unter 35 % Hülle.' },
  spire: { f: 'nexus', name: 'Spire', role: 'war', cls: 'm', r: 18, len: 46, hull: 700, shield: 600, sreg: 36, speed: 70, accel: 45, turn: 1.2, sensor: 520, cp: 2, cost: { ice: 540, ore: 260 }, time: 22, tier: 2, yard: 2, wpn: ['spireBeam', 'spireBeam', 'crystalPd'], node: 1, doc: 'lattice',
    desc: 'Lattice Growth. Bewaffneter mobiler Netzknoten.' },
  colossus: { f: 'nexus', name: 'Colossus', role: 'war', cls: 'l', r: 36, len: 110, hull: 5200, shield: 4000, sreg: 70, speed: 40, accel: 24, turn: 0.6, sensor: 500, cp: 12, cost: { ice: 0, ore: 0 }, time: 0, tier: 3, yard: 3, wpn: ['monoBeam', 'monoBeam', 'monoBeam', 'facetBeam', 'monoSide', 'crystalPd', 'crystalPd', 'crystalPd'], hidden: true, doc: 'singularity',
    desc: 'Singularity. Drei Monolithe, zu einem verschmolzen. Nur durch Verschmelzen.' },
  /* ---- The Brood: nur Biomasse (Eis), kein Schild, regen Heilung je Sekunde. swarm: ein Schwarm aus n Winzlingen als ein Schiff.
     mut: Mutationen (Fähigkeiten mutX), eat: frisst Wracks. Alle Kosten ice = Biomasse. ---- */
  seeder: { f: 'brood', name: 'Seeder', role: 'builder', cls: 's', r: 14, len: 36, hull: 440, armor: 1, speed: 86, accel: 70, turn: 2.3, sensor: 360, cp: 1, cost: { ice: 420, ore: 0 }, time: 18, tier: 1, yard: 1, build: 1, regen: 0.012, crew: 0,
    desc: 'Lässt Nester wachsen: errichtet alle Bauten der Brood und heilt sie langsam.' },
  grazer: { f: 'brood', name: 'Grazer', role: 'tanker', cls: 's', r: 13, len: 32, hull: 380, armor: 1, speed: 100, accel: 85, turn: 2.6, sensor: 300, cp: 1, cost: { ice: 260, ore: 0 }, time: 12, tier: 1, yard: 1, cargo: 125, eat: 1, regen: 0.012, crew: 0,
    desc: 'Frisst Eis, Erz und Wracks – alles wird Biomasse. Wrack antippen, um es zu verschlingen.' },
  larva: { f: 'brood', name: 'Larva', role: 'war', cls: 's', r: 8, len: 20, hull: 200, armor: 0, speed: 150, accel: 140, turn: 3.4, sensor: 340, cp: 1, cost: { ice: 100, ore: 0 }, time: 5, tier: 1, yard: 1, wpn: ['bite'], regen: 0.02, crew: 0, abs: ['mutSwarm', 'mutSpit', 'mutRav', 'mutLeech'],
    desc: 'Grundform. Billig und schnell gezüchtet, mutiert in jede andere Form (Tasten). Beißt ein bisschen.' },
  swarm: { f: 'brood', name: 'Swarmling-Schwarm', role: 'war', cls: 's', r: 13, len: 26, hull: 330, armor: 0, speed: 175, accel: 160, turn: 3.6, sensor: 360, cp: 1, cost: { ice: 170, ore: 0 }, time: 7, tier: 1, yard: 1, wpn: ['bite', 'bite', 'bite'], swarm: 6, regen: 0.015, crew: 0,
    desc: 'Sechs Winzlinge als ein Schwarm. Billig, schnell, Masse. Punktverteidigung frisst sie.' },
  spitter: { f: 'brood', name: 'Spitter', role: 'war', cls: 's', r: 11, len: 30, hull: 400, armor: 1, speed: 115, accel: 95, turn: 2.6, sensor: 420, cp: 2, cost: { ice: 340, ore: 0 }, time: 12, tier: 1, yard: 1, wpn: ['acidSpit'], regen: 0.012, crew: 0, abs: ['mutMaw'], keep: 290,
    desc: 'Spuckt Säure: Schaden über Zeit, Panzerung hilft nicht. Mutiert zum Acid Maw.' },
  ravager: { f: 'brood', name: 'Ravager', role: 'war', cls: 's', r: 13, len: 38, hull: 600, armor: 2, speed: 140, accel: 120, turn: 2.6, sensor: 400, cp: 2, cost: { ice: 390, ore: 0 }, time: 13, tier: 1, yard: 1, wpn: ['maw'], regen: 0.012, crew: 0, ab: 'lunge',
    desc: 'Rammt und beißt. Bisse gehen durch Panzerung. Sprintet aufs Ziel zu.' },
  leech: { f: 'brood', name: 'Leech', role: 'war', cls: 's', r: 11, len: 32, hull: 360, armor: 0, speed: 150, accel: 130, turn: 3.0, sensor: 420, cp: 2, cost: { ice: 340, ore: 0 }, time: 13, tier: 1, yard: 1, wpn: ['parasite'], regen: 0.012, crew: 0, keep: 250,
    desc: 'Heftet Parasiten an Schiffe. Nach 12 Sekunden schlüpft daraus ein Schwarm, und das Opfer blutet.' },
  sporer: { f: 'brood', name: 'Sporer', role: 'war', cls: 'm', r: 16, len: 40, hull: 700, armor: 1, speed: 95, accel: 65, turn: 1.8, sensor: 420, cp: 2, cost: { ice: 480, ore: 0 }, time: 16, tier: 2, yard: 2, wpn: ['acidSpit'], regen: 0.012, crew: 0, ab: 'carpet', keep: 280,
    desc: 'Legt einen Sporenteppich: die Brood heilt darin, Feinde nehmen Schaden.' },
  acidmaw: { f: 'brood', name: 'Acid Maw', role: 'war', cls: 'm', r: 17, len: 48, hull: 950, armor: 2, speed: 92, accel: 60, turn: 1.6, sensor: 440, cp: 3, cost: { ice: 700, ore: 0 }, time: 20, tier: 2, yard: 2, wpn: ['acidHeavy', 'acidSpit'], regen: 0.012, crew: 0, keep: 330,
    desc: 'Schwerer Säurespucker, aus dem Spitter mutiert oder gezüchtet.' },
  leviathan: { f: 'brood', name: 'Leviathan', role: 'war', cls: 'l', r: 30, len: 92, hull: 3400, armor: 3, speed: 60, accel: 36, turn: 0.85, sensor: 460, cp: 5, cost: { ice: 2000, ore: 0 }, time: 46, tier: 3, yard: 3, wpn: ['mawH', 'mawH', 'acidHeavy', 'acidHeavy'], regen: 0.01, crew: 0, ab: 'devour',
    desc: 'Verschlingt kleine und mittlere Schiffe im Ganzen und heilt sich damit.' },
  matriarch: { f: 'brood', name: 'Brood Matriarch', role: 'war', cls: 'l', r: 32, len: 98, hull: 3000, armor: 3, speed: 62, accel: 38, turn: 0.85, sensor: 500, cp: 5, cost: { ice: 2200, ore: 0 }, time: 48, tier: 3, yard: 3, wpn: ['acidHeavy', 'acidHeavy', 'acidSpit', 'acidSpit', 'mawH'], regen: 0.01, crew: 0, flag: true, grow: 1, abs: ['callswarm', 'devour', 'carpet'], cmdr: 'Die Matriarch',
    desc: 'Flaggschiff der Brood. Das älteste Wesen im Kessel: wächst mit jedem Abschuss, ruft den Schwarm, verschlingt Schiffe, legt Sporen.' },
  broodmother: { f: 'brood', name: 'Broodmother', role: 'war', cls: 'm', r: 18, len: 50, hull: 900, armor: 2, speed: 80, accel: 50, turn: 1.4, sensor: 420, cp: 3, cost: { ice: 680, ore: 0 }, time: 22, tier: 2, yard: 2, wpn: ['acidSpit', 'acidSpit'], regen: 0.012, crew: 0, doc: 'hive', ab: 'callswarm', keep: 300,
    desc: 'Hive Mind. Gebiert alle 45 Sekunden einen Schwarm an Ort und Stelle.' },
  plaguebearer: { f: 'brood', name: 'Plaguebearer', role: 'war', cls: 'm', r: 17, len: 46, hull: 800, armor: 1, speed: 100, accel: 65, turn: 1.7, sensor: 440, cp: 3, cost: { ice: 640, ore: 0 }, time: 20, tier: 2, yard: 2, wpn: ['parasite', 'parasite', 'acidSpit'], regen: 0.012, crew: 0, doc: 'plague', burst: 1, keep: 270,
    desc: 'Plague. Zwei Parasitenwerfer; platzt beim Tod in eine Säurewolke.' },
  behemoth: { f: 'brood', name: 'Behemoth', role: 'war', cls: 'l', r: 30, len: 88, hull: 4000, armor: 4, speed: 66, accel: 40, turn: 0.9, sensor: 440, cp: 5, cost: { ice: 1900, ore: 0 }, time: 42, tier: 3, yard: 3, wpn: ['mawH', 'mawH', 'mawH', 'acidTw'], regen: 0.014, crew: 0, doc: 'titan', ab: 'lunge',
    desc: 'Titan. Gepanzerter Rammkoloss mit drei Mäulern, sprintet aufs Ziel zu.' },
  /* ---- Erbauer-Wächter (neutral): Drohnen an Ruinen, der schlafende Wächter als Stätte, Erbauer-Sentinel als Belohnung ---- */
  drone: { f: 'guardian', name: 'Wächterdrohne', role: 'war', cls: 's', r: 10, len: 26, hull: 240, shield: 200, sreg: 20, speed: 150, accel: 130, turn: 3.2, sensor: 500, cp: 0, cost: { ice: 0, ore: 0 }, time: 0, tier: 9, yard: 9, wpn: ['droneGun', 'wardBeam'], hidden: true, crew: 0,
    desc: 'Wächterdrohne der Erbauer.' },
  warden: { f: 'guardian', name: 'Der Wächter', role: 'war', cls: 'l', r: 44, len: 120, hull: 6000, shield: 3000, sreg: 60, speed: 45, accel: 30, turn: 0.6, sensor: 700, cp: 0, cost: { ice: 0, ore: 0 }, time: 0, tier: 9, yard: 9, wpn: ['wardLance', 'wardBeam', 'wardBeam', 'wardBeam', 'pdH', 'pdH'], hidden: true, crew: 0, armor: 2,
    desc: 'Schlafende Riesenmaschine der Erbauer. Wer sie weckt, hat sie am Hals – wer sie zerstört, bekommt Relikte.' },
  sentinel: { f: 'guardian', name: 'Erbauer-Sentinel', role: 'war', cls: 'l', r: 26, len: 76, hull: 1600, shield: 1600, sreg: 60, speed: 85, accel: 50, turn: 1.1, sensor: 600, cp: 4, cost: { ice: 0, ore: 0 }, time: 0, tier: 9, yard: 9, wpn: ['wardLance', 'wardBeam', 'wardBeam', 'pdH'], hidden: true, crew: 60, ab: 'blink',
    desc: 'Einzigartiges Erbauer-Schiff aus der Zitadelle. Springt, Lanze durch Schilde.' }
};
/* Crew je Größenklasse (ohne Angabe am Schiff) */
const CREW_CLS = { f: 0, s: 30, m: 80, l: 160 };
/* Fassung 21: Belagerungsartillerie je Fraktion – feuert im Stand Bogengranaten auf Stationen weit außerhalb der
   Turmreichweite (980 gegen etwa 400), trifft keine Schiffe, ist selbst aber sehr verwundbar (wenig Hülle, kein Schild,
   langsam, Mindestabstand 340). Gegenmittel: schnelle Schiffe, die hinter die Turmlinie stoßen. */
const ART_SHIPS = {
  catapult: { f: 'alliance', name: 'Catapult', role: 'war', cls: 'm', r: 16, len: 50, hull: 170, shield: 0, speed: 58, accel: 40, turn: 1.1, sensor: 420, cp: 3, cost: { ice: 460, ore: 260 }, time: 22, tier: 2, yard: 2, wpn: ['shell'], keep: 900, art: 1,
    desc: 'Belagerungsartillerie. Feuert im Stand Granaten aus großer Entfernung, weit außerhalb der Turmreichweite – vor allem auf Stationen, aber auch auf Schiffe. Die Granaten fliegen lange: wer in Bewegung bleibt, weicht aus. Selbst kaum gepanzert – braucht Begleitschutz.' },
  mortar: { f: 'mars', name: 'Mortar', role: 'war', cls: 'm', r: 16, len: 50, hull: 210, shield: 0, armor: 1, speed: 54, accel: 38, turn: 1.0, sensor: 420, cp: 3, cost: { ice: 440, ore: 280 }, time: 22, tier: 2, yard: 2, wpn: ['shell'], keep: 900, art: 1,
    desc: 'Belagerungsmörser. Schwere Granaten im Bogen aus großer Entfernung, nur im Stand. Bewegliche Schiffe weichen aus, im Nahkampf wehrlos.' },
  ballista: { f: 'legion', name: 'Ballista', role: 'war', cls: 'm', r: 16, len: 50, hull: 150, shield: 80, sreg: 6, speed: 60, accel: 42, turn: 1.1, sensor: 440, cp: 3, cost: { ice: 470, ore: 260 }, time: 22, tier: 2, yard: 2, wpn: ['shellLance'], keep: 920, art: 1,
    desc: 'Lanzenwerfer. Schleudert gebündeltes Licht im Bogen jenseits der Turmreichweite, auf Stationen und Schiffe. Kein Heldenschiff: fällt, wenn es fällt.' },
  lodestar: { f: 'nexus', name: 'Lodestar', role: 'war', cls: 'm', r: 16, len: 48, hull: 160, shield: 60, sreg: 8, speed: 56, accel: 40, turn: 1.1, sensor: 440, cp: 3, cost: { ice: 460, ore: 270 }, time: 22, tier: 2, yard: 2, wpn: ['shell'], keep: 900, art: 1,
    desc: 'Kristallkatapult. Wirft verdichtete Kristallmasse aus großer Entfernung, nur im Stand. Bewegliche Ziele weichen aus. Zerbrechlich.' },
  boomer: { f: 'brood', name: 'Boomer', role: 'war', cls: 'm', r: 15, len: 46, hull: 230, armor: 0, speed: 60, accel: 44, turn: 1.2, sensor: 420, cp: 3, cost: { ice: 640, ore: 0 }, time: 18, tier: 2, yard: 2, wpn: ['shellAcid'], regen: 0.01, crew: 0, keep: 880, art: 1,
    desc: 'Sporenmörser. Spuckt Säureblasen im hohen Bogen weit hinter die Turmlinie, nur im Stand. Bewegliche Ziele weichen aus, im Nahkampf wehrlos.' }
};
Object.assign(SHIPS, ART_SHIPS);
/* Subsysteme: Antrieb, Waffen, Schilde (Mars: Schadenskontrolle für die Panzerung), Sensoren, Lebenserhaltung */
const SUBS = ['drive', 'wpn', 'shield', 'sensor', 'life'];
const SUB_NAMES = { drive: 'Antrieb', wpn: 'Waffen', shield: 'Schilde', sensor: 'Sensoren', life: 'Lebenserhaltung' };
const SUB_ICON = { drive: '⚙', wpn: '✶', shield: '◯', sensor: '◎', life: '☺' };
const SUB_FRAC = 0.35;                       // Subsystem-Punkte als Anteil der Hülle
const SUB_HIT = 0.7;                         // Anteil des Hüllenschadens, der ins anvisierte Subsystem geht
const SUB_REPAIR = 0.012;                    // Selbstreparatur je Sekunde (Anteil), an der Werft das Fünffache
/* Gewicht in der KI-Flottenwahl (1 = normal): Unterstützer seltener */
const AI_W = { leech: 0.2, spitter: 0.6, shard: 0.5, wren: 0.4, sporer: 0.5, plaguebearer: 0.6, binder: 0.5, conduit: 0.5, lattice: 0.15, spire: 0.4, mirror: 0.6, beacon: 0.15, oracle: 0.15, reliquary: 0.5, boarder: 0.5, dropship: 0.5, aegis: 0.7, sanctum: 0.4 };
/* Tarnung: je Fraktion ein Schiff für Hinterhalte und Aufklärung */
for (const id of ['wren', 'boarder', 'herald', 'shard', 'leech']) SHIPS[id].ab2 = ['cloak'];
for (const id in SHIPS) { const s = SHIPS[id]; s.id = id; s.aiW = AI_W[id] || 1; s.wpn = (s.wpn || []).map(w => W[w]); s.armor = s.armor || 0; s.shield = s.shield || 0; if (s.crew === undefined) s.crew = s.role === 'tanker' ? 12 : s.role === 'builder' ? 24 : CREW_CLS[s.cls] || 0; if (s.wpn.some(w => w.kind !== 'pd' && Math.abs(w.mount) > 1)) s.side = true; }
/* ------------------------------------------------------------------ Spezialfähigkeiten
   cd Abklingzeit, dur Dauer, r Umkreis. Wirkung in combat.js (abilityUse/abilityTick). */
const ABIL = {
  cloak: { name: 'Tarnung', short: 'Tarnung', cd: 35, dur: 25, icon: '◌', desc: 'Unsichtbar für den Feind, bis das Schiff angreift oder 25 Sekunden um sind. Geschütze und Stationen entdecken getarnte Schiffe in ihrer Waffenreichweite, Schiffe erst aus nächster Nähe, Sensorimpulse im ganzen Umkreis.' },
  pulse: { name: 'Sensorimpuls', short: 'Impuls', cd: 40, dur: 8, r: 900, icon: '◎', desc: 'Deckt 8 Sekunden lang alles im Umkreis von 900 auf.' },
  overload: { name: 'Lanzenüberladung', short: 'Überladung', cd: 40, dur: 5, icon: '✶', desc: 'Strahlwaffen 5 Sekunden lang +40 % Schaden, danach 3 Sekunden Waffen aus.' },
  surge: { name: 'Schildstoß', short: 'Schildstoß', cd: 45, dur: 0, r: 160, icon: '◯', desc: 'Lädt die Schilde aller Verbündeten im Umkreis sofort um 25 % nach.' },
  resupply: { name: 'Nachschub', short: 'Nachschub', cd: 60, dur: 0, icon: '✈', desc: 'Startet sofort alle fehlenden Jäger.' },
  repair: { name: 'Notreparatur', short: 'Reparatur', cd: 30, dur: 10, r: 220, icon: '✚', desc: 'Repariert das beschädigteste eigene Schiff oder die Station im Umkreis 10 Sekunden lang um 2,5 % je Sekunde.' },
  grush: { name: 'G-Rausch', short: 'G-Rausch', cd: 30, dur: 4, icon: '»', desc: 'Doppelte Geschwindigkeit für 4 Sekunden, kostet danach 10 % der Crew.' },
  flak: { name: 'Sperrfeuer', short: 'Sperrfeuer', cd: 35, dur: 6, icon: '✦', desc: 'Autokanonen 6 Sekunden lang +40 % Feuerrate, Punktverteidigung dreimal so schnell.' },
  pierce: { name: 'Durchschlag', short: 'Durchschlag', cd: 30, dur: 12, icon: '➤', desc: 'Der nächste Railgun-Schuss durchschlägt sechs Ziele mit +50 % Schaden.' },
  broadside: { name: 'Breitseite', short: 'Breitseite', cd: 40, dur: 2.5, icon: '≡', desc: 'Alle Geschütze feuern 2,5 Sekunden lang ohne Nachladen, nach beiden Seiten.' },
  board: { name: 'Entern', short: 'Entern', cd: 20, dur: 0, r: 70, icon: '⚑', desc: 'Setzt die Marines auf das Ziel über. Ist dessen Crew besiegt, gehört das Schiff dir.' },
  dome: { name: 'Schildkuppel', short: 'Kuppel', cd: 45, dur: 6, r: 200, icon: '◍', desc: 'Verbündete im Umkreis nehmen 6 Sekunden lang nur halben Schaden.' },
  /* Flaggschiffe */
  fieldyard: { name: 'Feldwerft', short: 'Feldwerft', cd: 50, dur: 12, r: 220, icon: '⚒', desc: 'Repariert 12 Sekunden lang alle eigenen Schiffe im Umkreis um 3 % je Sekunde.' },
  truce: { name: 'Waffenstillstand', short: 'Waffenruhe', cd: 90, dur: 5, r: 320, icon: '☮', desc: 'Feindliche Schiffe im Umkreis feuern 5 Sekunden lang nicht.' },
  mark: { name: 'Zielmarkierung', short: 'Markieren', cd: 50, dur: 10, r: 500, icon: '◉', desc: 'Markiert das nächste feindliche Großschiff: alle Verbündeten machen 10 Sekunden lang +30 % Schaden dagegen.' },
  /* vierte Fähigkeit je Doktrin */
  invuln: { name: 'Unverwundbar', short: 'Schutzfeld', cd: 100, dur: 5, icon: '◈', desc: 'Das Flaggschiff nimmt 5 Sekunden lang keinen Schaden.' },
  reveal: { name: 'Weitblick', short: 'Weitblick', cd: 90, dur: 8, icon: '👁', desc: 'Deckt 8 Sekunden lang die ganze Karte auf.' },
  lance: { name: 'Lanzenschlag', short: 'Lanze', cd: 60, dur: 0, r: 520, icon: '⚡', desc: 'Ein Strahlschlag mit 700 Schaden auf das nächste feindliche Ziel im Umkreis.' },
  barrage: { name: 'Sperrfeuer', short: 'Granaten', cd: 60, dur: 0, r: 560, icon: '☄', desc: 'Acht schwere Granaten auf den nächsten Feind im Umkreis.' },
  massboard: { name: 'Massenentern', short: 'Entersturm', cd: 80, dur: 0, r: 260, icon: '⚑', desc: 'Setzt 120 Marines auf die drei nächsten feindlichen Schiffe über.' },
  sprint: { name: 'Flottensprint', short: 'Sprint', cd: 60, dur: 6, r: 320, icon: '»', desc: 'Alle Verbündeten im Umkreis fliegen 6 Sekunden lang +60 % schneller.' },
  /* Runde 3 */
  blink: { name: 'Strömungssprung', short: 'Sprung', cd: 20, dur: 0, r: 320, icon: '⤳', desc: 'Springt 320 Einheiten weit in Flugrichtung.' },
  fleetjump: { name: 'Flottensprung', short: 'Flottensprung', cd: 60, dur: 0, r: 280, icon: '⤳', desc: 'Das Flaggschiff und alle Verbündeten im Umkreis springen 500 Einheiten in Flugrichtung.' },
  revive: { name: 'Wiedererweckung', short: 'Erwecken', cd: 90, dur: 0, r: 400, icon: '✚', desc: 'Erweckt das nächste eigene ruhende Heldenschiff im Umkreis sofort mit halber Hülle.' },
  crusade: { name: 'Kreuzzugsruf', short: 'Kreuzzug', cd: 60, dur: 8, r: 340, icon: '✠', desc: 'Verbündete im Umkreis 8 Sekunden lang +30 % Tempo und +25 % Schaden.' },
  timejump: { name: 'Zeitsprung', short: 'Zeitsprung', cd: 90, dur: 0, r: 280, icon: '↺', desc: 'Verbündete im Umkreis bekommen Hülle und Schild von vor 10 Sekunden zurück.' },
  bind: { name: 'Übernahme', short: 'Übernahme', cd: 25, dur: 0, r: 140, icon: '◈', desc: 'Übernimmt ein feindliches Schiff mit wenig Hülle sofort. Ziel antippen.' },
  massbind: { name: 'Massenübernahme', short: 'Massen-übernahme', cd: 90, dur: 0, r: 260, icon: '◈', desc: 'Übernimmt alle feindlichen Schiffe im Umkreis, die unter 40 % Hülle sind.' },
  shardstorm: { name: 'Splittersturm', short: 'Splittersturm', cd: 50, dur: 0, r: 420, icon: '✧', desc: 'Zwölf Kristallsplitter auf die nächsten Feinde im Umkreis.' },
  gravwell: { name: 'Gravitationssog', short: 'Sog', cd: 60, dur: 6, r: 300, icon: '◎', desc: 'Feinde im Umkreis werden 6 Sekunden lang zum Flaggschiff gezogen und sind halb so schnell.' },
  netpulse: { name: 'Netzimpuls', short: 'Netzimpuls', cd: 80, dur: 0, r: 500, icon: '⌬', desc: 'Repariert alle eigenen Stationen im Umkreis um 25 % und verbindet sie 30 Sekunden lang mit dem Netz.' },
  singularity: { name: 'Singularität', short: 'Singularität', cd: 100, dur: 5, r: 360, icon: '●', desc: 'Zieht alle Feinde im Umkreis 5 Sekunden lang zum Flaggschiff und beschädigt sie.' },
  /* Runde 4: The Brood. mut: Zielform, Kosten = Preisunterschied, dur = Kokonzeit */
  mutSwarm: { name: 'Mutation: Schwarm', short: 'Schwarm', cd: 0, dur: 6, icon: '⁂', mut: 'swarm', desc: 'Die Larve verpuppt sich 6 Sekunden lang und schlüpft als Swarmling-Schwarm. Kostet den Preisunterschied.' },
  mutSpit: { name: 'Mutation: Spitter', short: 'Spitter', cd: 0, dur: 8, icon: '⁂', mut: 'spitter', desc: 'Die Larve verpuppt sich 8 Sekunden lang und schlüpft als Spitter. Kostet den Preisunterschied.' },
  mutRav: { name: 'Mutation: Ravager', short: 'Ravager', cd: 0, dur: 8, icon: '⁂', mut: 'ravager', desc: 'Die Larve verpuppt sich 8 Sekunden lang und schlüpft als Ravager. Kostet den Preisunterschied.' },
  mutLeech: { name: 'Mutation: Leech', short: 'Leech', cd: 0, dur: 8, icon: '⁂', mut: 'leech', desc: 'Die Larve verpuppt sich 8 Sekunden lang und schlüpft als Leech. Kostet den Preisunterschied.' },
  mutMaw: { name: 'Mutation: Acid Maw', short: 'Acid Maw', cd: 0, dur: 12, icon: '⁂', mut: 'acidmaw', desc: 'Der Spitter verpuppt sich 12 Sekunden lang und schlüpft als Acid Maw. Kostet den Preisunterschied, braucht Brutgrube II.' },
  lunge: { name: 'Sprung aufs Ziel', short: 'Sprint', cd: 25, dur: 3, icon: '»', desc: 'Doppelte Geschwindigkeit für 3 Sekunden, der nächste Biss macht doppelten Schaden.' },
  carpet: { name: 'Sporenteppich', short: 'Sporen', cd: 40, dur: 0, r: 170, icon: '✺', desc: 'Legt 25 Sekunden lang einen Sporenteppich: Brood heilt darin 2 % je Sekunde, Feinde verlieren 1,5 % je Sekunde.' },
  devour: { name: 'Verschlingen', short: 'Verschlingen', cd: 35, dur: 0, r: 90, icon: '◖', desc: 'Verschlingt das nächste kleine oder mittlere feindliche Schiff im Umkreis, das unter 60 % Hülle ist: sofort tot, heilt um 40 % seiner Hülle, gibt Biomasse.' },
  callswarm: { name: 'Schwarmruf', short: 'Schwarmruf', cd: 45, dur: 0, r: 120, icon: '⁂', desc: 'Gebiert sofort einen Swarmling-Schwarm. Beim Flaggschiff drei.' },
  frenzy: { name: 'Raserei', short: 'Raserei', cd: 70, dur: 8, r: 360, icon: '✶', desc: 'Alle Brood-Schiffe im Umkreis 8 Sekunden lang +40 % Feuerrate und Tempo.' },
  plague: { name: 'Seuche', short: 'Seuche', cd: 80, dur: 0, r: 320, icon: '☣', desc: 'Setzt Parasiten auf alle feindlichen Schiffe im Umkreis.' },
  molt: { name: 'Häutung', short: 'Häutung', cd: 90, dur: 0, icon: '✚', desc: 'Das Flaggschiff heilt sofort 50 % seiner Hülle und verliert alle Säure und Parasiten.' },
  merge: { name: 'Verschmelzen', short: 'Verschmelzen', cd: 0, dur: 0, r: 90, icon: '⟁', desc: 'Drei gleiche Kristallschiffe nahe beieinander verschmelzen zur nächsten Form. Erfahrung bleibt erhalten.' }
};
for (const id in ABIL) ABIL[id].id = id;
SHIPS.wren.ab = 'pulse'; SHIPS.lancer.ab = 'overload'; SHIPS.bulwark.ab = 'surge'; SHIPS.haven.ab = 'resupply'; SHIPS.pathfinder.ab = 'repair';
SHIPS.needle.ab = 'grush'; SHIPS.hedgehog.ab = 'flak'; SHIPS.spear.ab = 'pierce'; SHIPS.hammer.ab = 'broadside'; SHIPS.prospector.ab = 'repair';
/* ------------------------------------------------------------------ Doktrinen
   Wahl ab Kommandobasis Stufe 2, endgültig. fx wie bei der Forschung; ship exklusives Schiff; flagAb vierte
   Flaggschiff-Fähigkeit; strong/weak für die Karte; fit Spielweise; rec: Gegnerfraktion, bei der die Karte »Empfohlen« zeigt */
const DOCTRINES = {
  alliance: [
    { id: 'charter', name: 'Charter Guard', style: 'Halte die Linie', tag: 'Verteidigung', desc: 'Deine Flotte wird zur Festung. Langsam, aber kaum zu knacken.', fx: { shield: 1.25, link: 1.5, linkShare: 0.5, bshield: 1.3 }, ship: 'aegis', flagAb: 'invuln',
      strong: ['mars'], strongWhy: 'Torpedos prallen an der Kuppel ab', weak: [], weakWhy: 'Wenig Schaden: lange Gefechte', fit: 'Basis halten, Rückzugsgefechte, Schildverbund', rec: 'mars', gives: ['Schilde +25 %, Stationen +30 %', 'Schildverbund weiter und stärker', 'Schiff Aegis mit Schildkuppel', 'Flaggschiff: 5 s unverwundbar'] },
    { id: 'explorer', name: 'Explorer Corps', style: 'Sieh alles zuerst', tag: 'Aufklärung', desc: 'Weite Sensoren, schnelle Schiffe, nie überrascht.', fx: { sensor: 1.3, speed: 1.1, cargo: 1.15 }, ship: 'beacon', flagAb: 'reveal',
      strong: [], strongWhy: 'Sieht Angriffe früh, findet Vorkommen zuerst', weak: ['mars'], weakWhy: 'Kein Vorteil im Nahkampf', fit: 'Ausbreiten, Hinterhalte vermeiden, Frachter schützen', rec: '', gives: ['Sensoren +30 %, Tempo +10 %', 'Frachter laden +15 %', 'Schiff Beacon: mobile Sensorstation', 'Flaggschiff: ganze Karte 8 s sichtbar'] },
    { id: 'hardline', name: 'Hardliners', style: 'Schlag zuerst', tag: 'Angriff', desc: 'Erbauer-Technik in den Waffen. Mehr Schaden, dünnere Schilde.', fx: { beam: 1.3, shield: 0.9 }, ship: 'reckoning', flagAb: 'lance',
      strong: ['alliance'], strongWhy: 'Strahlen brennen durch Schilde', weak: ['mars'], weakWhy: 'Panzerung schluckt Strahlen', fit: 'Früh angreifen, Stationen niederbrennen', rec: 'alliance', gives: ['Strahlwaffen +30 % Schaden', 'Schilde −10 %', 'Schiff Reckoning mit Erbauer-Lanze', 'Flaggschiff: Lanzenschlag 700 Schaden'] }
  ],
  mars: [
    { id: 'navy', name: 'Navy Doctrine', style: 'Triff aus der Ferne', tag: 'Fernkampf', desc: 'Railguns tragen weiter und laden schneller. Der Feind stirbt, bevor er ankommt.', fx: { railReload: 0.75, rail: 1.15 }, ship: 'longshot', flagAb: 'barrage',
      strong: ['alliance'], strongWhy: 'Railguns durchschlagen Formationen', weak: [], weakWhy: 'Schwach, wenn der Feind nah herankommt', fit: 'Abstand halten, Engstellen beherrschen', rec: 'alliance', gives: ['Railguns +15 % Schaden, laden 25 % schneller', 'Schiff Longshot: Railgun-Fregatte', 'Flaggschiff: Sperrfeuer'] },
    { id: 'marines', name: 'Marines', style: 'Nimm, was du brauchst', tag: 'Entern', desc: 'Schnelle Enterkommandos. Feindliche Schiffe werden zu deinen.', fx: { board: 2, marines: 1.5 }, ship: 'dropship', flagAb: 'massboard',
      strong: ['alliance'], strongWhy: 'Große Schiffe lassen sich kapern', weak: [], weakWhy: 'Gegen Jägerschwärme wirkungslos', fit: 'Angeschlagene Großschiffe kapern, Stationen übernehmen', rec: 'alliance', gives: ['Entern doppelt so schnell, +50 % Marines', 'Schiff Dropship entert auch Stationen', 'Flaggschiff: Massenentern'] },
    { id: 'torch', name: 'Torch Raiders', style: 'Zuschlagen und weg', tag: 'Überfall', desc: 'Schnelle Schiffe, starke Torpedos, keine Reue.', fx: { speed: 1.15, torp: 1.25, grushFree: 1 }, ship: 'wasp', flagAb: 'sprint',
      strong: ['alliance'], strongWhy: 'Frachter und Außenposten sind leichte Beute', weak: ['mars'], weakWhy: 'Punktverteidigung schießt Torpedos ab', fit: 'Überfälle auf Frachter, Hit and Run', rec: '', gives: ['Tempo +15 %, Torpedos +25 %', 'G-Rausch ohne Crewverlust', 'Schiff Wasp: Torpedo-Korvette', 'Flaggschiff: Flottensprint'] }
  ],
  legion: [
    { id: 'restoration', name: 'Restoration', style: 'Nichts geht verloren', tag: 'Aufbau', desc: 'Gefallene Helden kehren schneller zurück, jedes Heldenschiff bekommt eine Drohne mehr.', fx: { drones: 1, recrew: 2 }, ship: 'sanctum', flagAb: 'revive',
      strong: ['mars'], strongWhy: 'Verluste werden ersetzt, die Republik kapert nichts', weak: ['nexus'], weakWhy: 'Wenig zusätzlicher Schaden', fit: 'Lange Partien, Flotte zusammenhalten', rec: 'mars', gives: ['+1 Begleitdrohne je Heldenschiff', 'Wiedererwecken doppelt so schnell', 'Schiff Sanctum: Feldwerft-Kathedrale', 'Flaggschiff: Wiedererweckung'] },
    { id: 'crusade', name: 'Crusade', style: 'Vorwärts, im Namen des Kaisers', tag: 'Angriff', desc: 'Helden steigen doppelt so schnell auf, Lanzen brennen heißer.', fx: { xp: 2, beam: 1.15 }, ship: 'zealot', flagAb: 'crusade',
      strong: ['nexus', 'alliance'], strongWhy: 'Lanzen gehen durch Schilde', weak: ['mars'], weakWhy: 'Panzerung schluckt Lanzen', fit: 'Früh angreifen, Erfahrung sammeln', rec: 'alliance', gives: ['Erfahrung doppelt so schnell', 'Lanzen +15 % Schaden', 'Schiff Zealot: Rammschiff mit Lanzenbug', 'Flaggschiff: Kreuzzugsruf'] },
    { id: 'ascension', name: 'Ascension', style: 'Die Erbauer verstehen', tag: 'Erbauer-Technik', desc: 'Sprünge laden schneller, Relikte zählen doppelt, Stätten werden schneller aktiviert.', fx: { jumpCd: 0.5, relic: 2, site: 1.5 }, ship: 'oracle', flagAb: 'timejump',
      strong: [], strongWhy: 'Beherrscht Tore und Stätten der Karte', weak: ['mars'], weakWhy: 'Kein Vorteil im offenen Gefecht', fit: 'Karten mit Toren und Stätten, Ruinen scannen', rec: '', gives: ['Sprünge laden doppelt so schnell', 'Relikte zählen doppelt', 'Schiff Oracle: sieht weit, deckt Stätten auf', 'Flaggschiff: Zeitsprung'] }
  ],
  brood: [
    { id: 'hive', name: 'Hive Mind', style: 'Masse ist alles', tag: 'Schwarm', desc: 'Schwärme sind größer und billiger, alles heilt schneller.', fx: { swarm: 2, swarmCost: 0.7, regen: 1.5 }, ship: 'broodmother', flagAb: 'frenzy',
      strong: ['mars', 'legion'], strongWhy: 'Wenige Ziele ertrinken in Masse', weak: ['alliance'], weakWhy: 'Jäger und Abwehr fressen Schwärme', fit: 'Früh angreifen, überall zugleich sein', rec: 'legion', gives: ['Schwärme +2 Winzlinge, 30 % billiger', 'Heilung +50 %', 'Schiff Broodmother gebiert Schwärme', 'Flaggschiff: Raserei'] },
    { id: 'plague', name: 'Plague', style: 'Alles verfault', tag: 'Säure und Parasiten', desc: 'Säure brennt länger, Parasiten schlüpfen schneller.', fx: { acid: 1.5, paraT: 0.6 }, ship: 'plaguebearer', flagAb: 'plague',
      strong: ['mars', 'alliance'], strongWhy: 'Panzerung hilft nicht gegen Säure', weak: ['nexus'], weakWhy: 'Verschmolzene Riesen verkraften Säure', fit: 'Lange Gefechte, Parasiten auf Großschiffe', rec: 'mars', gives: ['Säure +50 % Schaden', 'Parasiten schlüpfen in 7 statt 12 s', 'Schiff Plaguebearer: zwei Parasitenwerfer', 'Flaggschiff: Seuche'] },
    { id: 'titan', name: 'Titan', style: 'Größer als alles', tag: 'Großschiffe', desc: 'Großschiffe billiger und zäher, Leviathane verschlingen schneller.', fx: { bigCost: 0.8, hull: 1.15, devourCd: 0.6 }, ship: 'behemoth', flagAb: 'molt',
      strong: ['alliance', 'nexus'], strongWhy: 'Mäuler gehen durch Schilde und Panzerung', weak: ['mars'], weakWhy: 'Railguns durchschlagen große Rümpfe', fit: 'Wenige Riesen, eine Schlacht', rec: 'nexus', gives: ['Großschiffe 20 % billiger', 'Hülle +15 %', 'Verschlingen lädt 40 % schneller', 'Schiff Behemoth', 'Flaggschiff: Häutung'] }
  ],
  nexus: [
    { id: 'unity', name: 'Unity', style: 'Alles wird eins', tag: 'Übernahme', desc: 'Übernahme schneller und schon ab 35 % Hülle, auch Stationen.', fx: { bindAt: 0.35, bindCd: 0.6 }, ship: 'conduit', flagAb: 'massbind',
      strong: ['alliance', 'legion'], strongWhy: 'Große Schiffe werden zu deinen', weak: ['mars'], weakWhy: 'Gekaperte Panzerschiffe sind ohne Schilde verwundbar', fit: 'Angeschlagene Feinde einsammeln', rec: 'legion', gives: ['Übernahme ab 35 % Hülle, Abklingzeit −40 %', 'Schiff Conduit: übernimmt auch Stationen', 'Flaggschiff: Massenübernahme mit halber Hülle'] },
    { id: 'lattice', name: 'Lattice Growth', style: 'Das Netz wächst', tag: 'Netz und Wirtschaft', desc: 'Knoten billiger, Netz reicht weiter, Stationen reparieren sich selbst.', fx: { net: 1.3, nodeCost: 0.6, bregen: 1 }, ship: 'spire', flagAb: 'netpulse',
      strong: ['mars'], strongWhy: 'Das Netz hält Überfälle aus', weak: [], weakWhy: 'Kein Vorteil im Kampf', fit: 'Ausbreiten, Vorkommen besetzen, lange Partien', rec: 'mars', gives: ['Netzreichweite +30 %, Knoten 40 % billiger', 'Stationen reparieren sich selbst', 'Schiff Spire: bewaffneter Knoten', 'Flaggschiff: Netzimpuls'] },
    { id: 'singularity', name: 'Singularity', style: 'Weniger, aber riesig', tag: 'Verschmelzen', desc: 'Verschmolzene Schiffe bekommen +20 % Hülle und Schild, drei Monolithe werden zu einem Colossus.', fx: { mergeBonus: 1.2 }, ship: 'colossus', flagAb: 'singularity',
      strong: ['alliance'], strongWhy: 'Riesige Schiffe brechen jede Linie', weak: ['mars'], weakWhy: 'Railguns und Enterkommandos gegen wenige Ziele', fit: 'Flotte zusammenziehen, eine große Schlacht', rec: 'alliance', gives: ['Verschmolzene Schiffe +20 % Hülle und Schild', 'Monolithe verschmelzen zum Colossus', 'Flaggschiff: Singularität'] }
  ]
};
for (const f in DOCTRINES) for (const d of DOCTRINES[f]) d.f = f;
/* Erbauer-Technologien aus dem Archiv: wer es hält, wählt eine von drei; gilt nur auf dieser Karte */
const ETECH = {
  phase: { name: 'Phasenpanzerung', desc: 'Jeder fünfte Treffer geht durch das Schiff hindurch, ohne Schaden.', fx: { phase: 1 } },
  reactor2: { name: 'Erbauer-Reaktor', desc: 'Alle Reaktoren liefern doppelt so viel Energie.', fx: { energy: 2 } },
  anchor: { name: 'Gravitationsanker', desc: 'Das Flaggschiff bekommt den Gravitationssog: Feinde im Umkreis werden festgehalten.', fx: {}, flagAb: 'gravwell' },
  forge: { name: 'Erbauer-Schmiede', desc: 'Werften bauen 40 % schneller, die Superwaffe lädt 50 % schneller.', fx: { rate: 1.4, superCharge: 1.5 } },
  echo: { name: 'Echoschild', desc: 'Schilde laden doppelt so schnell und schon eine Sekunde nach dem letzten Treffer.', fx: { sreg: 2, sdelay: 1 } },
  sight: { name: 'Erbauer-Auge', desc: 'Sensoren +50 %, die ganze Karte ist erkundet.', fx: { sensor: 1.5 }, reveal: 1 }
};
for (const id in ETECH) ETECH[id].id = id;
function doctrineDef(f, id) { for (const d of DOCTRINES[f]) if (d.id === id) return d; return null; }

/* ------------------------------------------------------------------ Gebäude
   Je Rolle drei Stufen (lv[0..2]). energy: Erzeugung (+) oder Verbrauch (−). r Radius für Platz, Treffer und Auswahl.
   Alle Fraktionen haben dieselben Rollen mit derselben Grundform; die Werte unterscheiden sich. */
function lv3(a, b, c) { return [a, b, c]; }
const BLDG = {
  alliance: {
    base: { role: 'base', name: 'Kommandobasis', r: 64, tab: 'eco', unique: true, lv: lv3(
      { hull: 2600, shield: 500, sreg: 30, energy: 22, cp: 6, cost: null, time: 0 },
      { hull: 3400, shield: 700, sreg: 36, energy: 32, cp: 10, cost: { ice: 700, ore: 400 }, time: 40, wpn: ['beamTw', 'beamTw'] },
      { hull: 4400, shield: 950, sreg: 44, energy: 44, cp: 14, cost: { ice: 1100, ore: 700 }, time: 55, wpn: ['beamTw', 'beamTw', 'beamTw', 'beamTw', 'beamTw3', 'pdH'] }),
      desc: 'Herz der Basis. Ab Stufe 2 bewaffnet, Stufe 3 mit Abwehr gegen Torpedos und Jäger. Schaltet Technikstufen frei.' },
    yard: { role: 'yard', name: 'Werft', r: 50, tab: 'mil', lv: lv3(
      { hull: 1500, shield: 250, sreg: 16, energy: -10, cost: { ice: 500, ore: 250 }, time: 32, rate: 1 },
      { hull: 2000, shield: 350, sreg: 20, energy: -15, cost: { ice: 450, ore: 250 }, time: 28, rate: 1.2 },
      { hull: 2600, shield: 450, sreg: 24, energy: -20, cost: { ice: 650, ore: 400 }, time: 34, rate: 1.4 }),
      desc: 'Baut Schiffe. Stufe 2 für Kreuzer, Stufe 3 für Träger und Schlachtschiffe. Repariert angedockte Schiffe.' },
    refinery: { role: 'refinery', name: 'Raffinerie', r: 40, tab: 'eco', lv: lv3(
      { hull: 1200, shield: 200, sreg: 14, energy: -5, cost: { ice: 350, ore: 120 }, time: 24, docks: 1, bonus: 1 },
      { hull: 1600, shield: 280, sreg: 18, energy: -7, cost: { ice: 300, ore: 150 }, time: 22, docks: 2, bonus: 1.1 },
      { hull: 2000, shield: 360, sreg: 22, energy: -9, cost: { ice: 450, ore: 250 }, time: 26, docks: 3, bonus: 1.2 }),
      desc: 'Nimmt Eis und Erz an. Mehr Andockplätze je Stufe, Stufe 3 verarbeitet mit Aufschlag.' },
    reactor: { role: 'reactor', name: 'Reaktor', r: 30, tab: 'eco', lv: lv3(
      { hull: 900, shield: 150, sreg: 12, energy: 26, cost: { ice: 250, ore: 150 }, time: 20 },
      { hull: 1200, shield: 220, sreg: 16, energy: 42, cost: { ice: 250, ore: 180 }, time: 20 },
      { hull: 1500, shield: 300, sreg: 20, energy: 64, cost: { ice: 350, ore: 260 }, time: 24 }),
      desc: 'Erzeugt Energie. Bei Energiemangel laden Schilde langsamer und Werften bauen langsamer.' },
    lab: { role: 'lab', name: 'Labor', r: 34, tab: 'mil', unique: true, lv: lv3(
      { hull: 1000, shield: 200, sreg: 14, energy: -8, cost: { ice: 450, ore: 250 }, time: 30 },
      { hull: 1300, shield: 280, sreg: 18, energy: -12, cost: { ice: 500, ore: 350 }, time: 34 },
      { hull: 1600, shield: 360, sreg: 22, energy: -16, cost: { ice: 700, ore: 500 }, time: 40 }),
      desc: 'Schaltet Technikstufen frei: Stufe 1 für Kreuzer, Stufe 2 für Großschiffe.' },
    turret: { role: 'turret', name: 'Lanzenturm', r: 20, tab: 'def', lv: lv3(
      { hull: 700, shield: 220, sreg: 20, energy: -4, cost: { ice: 260, ore: 120 }, time: 16, wpn: ['beamTw'] },
      { hull: 950, shield: 300, sreg: 24, energy: -6, cost: { ice: 220, ore: 120 }, time: 16, wpn: ['beamTw', 'beamTw'] },
      { hull: 1250, shield: 400, sreg: 30, energy: -8, cost: { ice: 300, ore: 180 }, time: 20, wpn: ['beamTw3', 'beamTw3'] }),
      desc: 'Geschützturm mit Strahlwaffen. Stark gegen Schilde.' },
    shield: { role: 'shield', name: 'Schildgenerator', r: 26, tab: 'def', lv: lv3(
      { hull: 800, shield: 300, sreg: 30, energy: -10, cost: { ice: 320, ore: 160 }, time: 24, aura: 230, give: 300 },
      { hull: 1000, shield: 400, sreg: 36, energy: -14, cost: { ice: 300, ore: 180 }, time: 22, aura: 290, give: 450 },
      { hull: 1200, shield: 500, sreg: 44, energy: -18, cost: { ice: 400, ore: 260 }, time: 26, aura: 350, give: 650 }),
      desc: 'Gibt allen eigenen Stationen im Umkreis einen zusätzlichen Schild.' },
    relay: { role: 'relay', name: 'Kommandorelais', r: 20, tab: 'eco', lv: lv3(
      { hull: 600, shield: 120, sreg: 12, energy: -3, cost: { ice: 200, ore: 100 }, time: 14, cp: 8 },
      { hull: 800, shield: 160, sreg: 14, energy: -4, cost: { ice: 180, ore: 100 }, time: 14, cp: 12 },
      { hull: 1000, shield: 220, sreg: 16, energy: -5, cost: { ice: 240, ore: 140 }, time: 16, cp: 18 }),
      desc: 'Mehr Kommandopunkte, also mehr Schiffe zugleich.' },
    super: { role: 'super', name: 'Exodus-Tor', r: 54, tab: 'spec', unique: true, req: { base: 3, lab: 2 }, lv: lv3(
      { hull: 2200, shield: 500, sreg: 24, energy: -30, cost: { ice: 1500, ore: 1000 }, time: 90, charge: 240, sr: 260 },
      { hull: 2600, shield: 600, sreg: 28, energy: -36, cost: { ice: 800, ore: 600 }, time: 50, charge: 190, sr: 320 },
      { hull: 3000, shield: 700, sreg: 32, energy: -42, cost: { ice: 1000, ore: 800 }, time: 60, charge: 150, sr: 380 }),
      desc: 'Superwaffe. Versetzt alle eigenen Schiffe im Umkreis des Tors an einen beliebigen Punkt der Karte. Lädt lange nach.' }
  },
  mars: {
    base: { role: 'base', name: 'Kommandobasis', r: 64, tab: 'eco', unique: true, lv: lv3(
      { hull: 3600, shield: 0, armor: 3, energy: 22, cp: 6, cost: null, time: 0 },
      { hull: 4600, shield: 0, armor: 4, energy: 32, cp: 10, cost: { ice: 700, ore: 400 }, time: 40, wpn: ['autoTw', 'autoTw'] },
      { hull: 5800, shield: 0, armor: 5, energy: 44, cp: 14, cost: { ice: 1100, ore: 700 }, time: 55, wpn: ['autoTw', 'autoTw', 'autoTw', 'autoTw', 'railTw', 'pdH'] }),
      desc: 'Herz der Basis, in einen Asteroiden gebaut. Ab Stufe 2 bewaffnet, Stufe 3 mit Railgun und Abwehr.' },
    yard: { role: 'yard', name: 'Werft', r: 50, tab: 'mil', lv: lv3(
      { hull: 2000, shield: 0, armor: 2, energy: -10, cost: { ice: 500, ore: 250 }, time: 32, rate: 1 },
      { hull: 2600, shield: 0, armor: 3, energy: -15, cost: { ice: 450, ore: 250 }, time: 28, rate: 1.2 },
      { hull: 3300, shield: 0, armor: 3, energy: -20, cost: { ice: 650, ore: 400 }, time: 34, rate: 1.4 }),
      desc: 'Baut Schiffe. Stufe 2 für Kreuzer, Stufe 3 für Schlachtschiffe. Repariert angedockte Schiffe.' },
    refinery: { role: 'refinery', name: 'Raffinerie', r: 40, tab: 'eco', lv: lv3(
      { hull: 1600, shield: 0, armor: 2, energy: -5, cost: { ice: 350, ore: 120 }, time: 24, docks: 1, bonus: 1 },
      { hull: 2100, shield: 0, armor: 2, energy: -7, cost: { ice: 300, ore: 150 }, time: 22, docks: 2, bonus: 1.1 },
      { hull: 2600, shield: 0, armor: 3, energy: -9, cost: { ice: 450, ore: 250 }, time: 26, docks: 3, bonus: 1.2 }),
      desc: 'Nimmt Eis und Erz an. Mehr Andockplätze je Stufe, Stufe 3 verarbeitet mit Aufschlag.' },
    reactor: { role: 'reactor', name: 'Reaktor', r: 30, tab: 'eco', lv: lv3(
      { hull: 1200, shield: 0, armor: 2, energy: 26, cost: { ice: 250, ore: 150 }, time: 20 },
      { hull: 1600, shield: 0, armor: 2, energy: 42, cost: { ice: 250, ore: 180 }, time: 20 },
      { hull: 2000, shield: 0, armor: 3, energy: 64, cost: { ice: 350, ore: 260 }, time: 24 }),
      desc: 'Erzeugt Energie. Bei Energiemangel schießt die Abwehr langsamer und Werften bauen langsamer.' },
    lab: { role: 'lab', name: 'Labor', r: 34, tab: 'mil', unique: true, lv: lv3(
      { hull: 1300, shield: 0, armor: 2, energy: -8, cost: { ice: 450, ore: 250 }, time: 30 },
      { hull: 1700, shield: 0, armor: 2, energy: -12, cost: { ice: 500, ore: 350 }, time: 34 },
      { hull: 2100, shield: 0, armor: 3, energy: -16, cost: { ice: 700, ore: 500 }, time: 40 }),
      desc: 'Schaltet Technikstufen frei: Stufe 1 für Kreuzer, Stufe 2 für Großschiffe.' },
    turret: { role: 'turret', name: 'Geschützplattform', r: 20, tab: 'def', lv: lv3(
      { hull: 950, shield: 0, armor: 2, energy: -4, cost: { ice: 260, ore: 120 }, time: 16, wpn: ['autoTw'] },
      { hull: 1250, shield: 0, armor: 3, energy: -6, cost: { ice: 220, ore: 120 }, time: 16, wpn: ['autoTw', 'autoTw'] },
      { hull: 1600, shield: 0, armor: 4, energy: -8, cost: { ice: 300, ore: 180 }, time: 20, wpn: ['autoTw', 'autoTw', 'railTw'] }),
      desc: 'Geschützplattform mit Autokanonen, auf Stufe 3 mit Railgun. Stark gegen Panzerung.' },
    flak: { role: 'flak', name: 'Flakplattform', r: 24, tab: 'def', lv: lv3(
      { hull: 900, shield: 0, armor: 2, energy: -6, cost: { ice: 300, ore: 140 }, time: 20, wpn: ['pdH', 'pdH'] },
      { hull: 1150, shield: 0, armor: 3, energy: -8, cost: { ice: 260, ore: 140 }, time: 18, wpn: ['pdH', 'pdH', 'pdH', 'autoS'] },
      { hull: 1450, shield: 0, armor: 3, energy: -10, cost: { ice: 350, ore: 200 }, time: 22, wpn: ['pdH', 'pdH', 'pdH', 'pdH', 'autoM'] }),
      desc: 'Punktverteidigung gegen Torpedos und Jäger, dazu leichte Kanonen gegen Korvetten.' },
    relay: { role: 'relay', name: 'Kommandorelais', r: 20, tab: 'eco', lv: lv3(
      { hull: 800, shield: 0, armor: 2, energy: -3, cost: { ice: 200, ore: 100 }, time: 14, cp: 8 },
      { hull: 1000, shield: 0, armor: 2, energy: -4, cost: { ice: 180, ore: 100 }, time: 14, cp: 12 },
      { hull: 1200, shield: 0, armor: 3, energy: -5, cost: { ice: 240, ore: 140 }, time: 16, cp: 18 }),
      desc: 'Mehr Kommandopunkte, also mehr Schiffe zugleich.' },
    super: { role: 'super', name: 'Massetreiber', r: 54, tab: 'spec', unique: true, req: { base: 3, lab: 2 }, lv: lv3(
      { hull: 2800, shield: 0, armor: 4, energy: -30, cost: { ice: 1500, ore: 1000 }, time: 90, charge: 240, dmg: 2400, sr: 150 },
      { hull: 3300, shield: 0, armor: 4, energy: -36, cost: { ice: 800, ore: 600 }, time: 50, charge: 190, dmg: 3000, sr: 170 },
      { hull: 3800, shield: 0, armor: 5, energy: -42, cost: { ice: 1000, ore: 800 }, time: 60, charge: 150, dmg: 3600, sr: 190 }),
      desc: 'Superwaffe. Schießt eine Masse quer über die Karte: schwerer Schaden im Zielkreis nach wenigen Sekunden Flug. Lädt lange nach.' }
  }
};
/* Fassung 22: drei neue Stationen je Fraktion (Legion, Nexus und Brood übernehmen sie über cloneBldgs mit eigenen Namen).
   Schildwall: Emitter, der ein Sperrfeld zu einem eigenen Turm oder Emitter in Reichweite spannt (field Feldstärke,
   freg Aufladung je s) – feindliche Schiffe kommen nicht hindurch, feindliche Schüsse bleiben im Feld hängen.
   Frühwarnstation: keine Waffen, sehr weite Sicht (sensor), deckt getarnte Schiffe im Umkreis detect auf.
   Reparaturdock: repariert eigene Schiffe im Umkreis rep (Hülle und Subsysteme, hrate Anteil je s) und langsam eigene
   Stationen im Umkreis brep (brate). */
for (const f of ['alliance', 'mars']) {
  const m = f === 'mars', sh = (a, b) => m ? 0 : a, ar = (a) => m ? a : 0;
  BLDG[f].wall = { role: 'wall', name: m ? 'Sperrwall' : 'Schildwall', r: 16, tab: 'def', lv: lv3(
    { hull: 520, shield: sh(150), sreg: sh(12), armor: ar(2), energy: -6, cost: { ice: 200, ore: 120 }, time: 18, field: 1500, freg: 40 },
    { hull: 680, shield: sh(200), sreg: sh(14), armor: ar(2), energy: -8, cost: { ice: 180, ore: 110 }, time: 16, field: 2300, freg: 60 },
    { hull: 860, shield: sh(260), sreg: sh(18), armor: ar(3), energy: -10, cost: { ice: 240, ore: 150 }, time: 18, field: 3300, freg: 85 }),
    desc: m ? 'Emitter für ein Sperrfeld zu einem eigenen Turm oder Emitter in Reichweite. Feindliche Schiffe kommen nicht hindurch, feindliche Schüsse bleiben im Feld hängen. Braucht Energie; bricht das Feld zusammen, baut es sich nach einigen Sekunden neu auf.' : 'Emitter für einen Schildwall zu einem eigenen Turm oder Emitter in Reichweite. Feindliche Schiffe kommen nicht hindurch, feindliche Schüsse bleiben im Feld hängen. Braucht Energie; bricht das Feld zusammen, baut es sich nach einigen Sekunden neu auf.' };
  BLDG[f].radar = { role: 'radar', name: m ? 'Frühwarnradar' : 'Frühwarnstation', r: 24, tab: 'def', lv: lv3(
    { hull: 600, shield: sh(120), sreg: sh(10), armor: ar(1), energy: -8, cost: { ice: 220, ore: 140 }, time: 20, sensor: 1100, detect: 500 },
    { hull: 800, shield: sh(160), sreg: sh(12), armor: ar(2), energy: -10, cost: { ice: 200, ore: 120 }, time: 18, sensor: 1250, detect: 560 },
    { hull: 1000, shield: sh(220), sreg: sh(14), armor: ar(2), energy: -12, cost: { ice: 260, ore: 160 }, time: 20, sensor: 1400, detect: 620 }),
    desc: 'Keine Waffen, aber sehr weite Sicht. Deckt getarnte Schiffe in der Nähe auf. Braucht Energie.' };
  BLDG[f].dock = { role: 'dock', name: m ? 'Instandsetzungsdock' : 'Reparaturdock', r: 34, tab: 'mil', lv: lv3(
    { hull: 1000, shield: sh(200), sreg: sh(14), armor: ar(2), energy: -8, cost: { ice: 300, ore: 160 }, time: 24, rep: 300, hrate: 0.025, brep: 350, brate: 0.004 },
    { hull: 1300, shield: sh(280), sreg: sh(18), armor: ar(2), energy: -10, cost: { ice: 260, ore: 150 }, time: 22, rep: 330, hrate: 0.03, brep: 350, brate: 0.005 },
    { hull: 1600, shield: sh(360), sreg: sh(22), armor: ar(3), energy: -12, cost: { ice: 340, ore: 220 }, time: 26, rep: 360, hrate: 0.036, brep: 380, brate: 0.006 }),
    desc: 'Repariert eigene Schiffe in der Nähe (Hülle und Subsysteme, schneller als die Selbstreparatur) und langsam eigene Stationen. Vorsichtige Schiffe ziehen sich auch hierher zurück.' };
}
/* Fassung 22: Turmgrenze und Schildwall */
const TOWER_ROLES = { turret: 1, flak: 1 };
const TOWER_BASE = 4, TOWER_PER_LV = 2, TOWER_PER_OUTPOST = 2;   // Türme = 4 + 2 × Stufe der besten Basis + 2 je weitere Basis
const WALL_MAX = 380, WALL_MIN = 70, WALL_CAP = 8;               // Feldlänge (zwischen den Rändern), Anzahl Emitter je Spieler
const WALL_ANCHOR = { turret: 1, flak: 1, spore: 1, wall: 1 };
const WALL_DOWN = 10;                                             // Sekunden, bis ein zusammengebrochenes Feld neu startet
/* Golden Legion und Nexus: dieselben Rollen wie die Alliance (Schilde), mit eigenen Namen, Waffen und Superwaffe */
function cloneBldgs(src, patch) {
  const out = JSON.parse(JSON.stringify(src));
  for (const role in patch) { const p = patch[role]; if (p === null) { delete out[role]; continue; } for (const k in p) { if (k === 'lv') p.lv.forEach((l, i) => Object.assign(out[role].lv[i], l)); else out[role][k] = p[k]; } }
  return out;
}
BLDG.legion = cloneBldgs(BLDG.alliance, {
  base: { name: 'Thronhalle', desc: 'Herz der Basis, eine wiederhergestellte Erbauer-Festung. Ab Stufe 2 mit Lichtlanzen bewaffnet.', lv: [{ shield: 600, sreg: 34 }, { shield: 820, sreg: 40, wpn: ['lanceM', 'lanceM'] }, { shield: 1100, sreg: 48, wpn: ['lanceM', 'lanceM', 'lanceM', 'lanceM', 'lanceH', 'pdH'] }] },
  yard: { name: 'Reliquienwerft', desc: 'Baut Heldenschiffe. Stufe 2 für Kreuzer, Stufe 3 für die Basilica. Repariert angedockte Schiffe.' },
  refinery: { name: 'Schatzkammer', desc: 'Nimmt Eis und Erz an. Mehr Andockplätze je Stufe, Stufe 3 verarbeitet mit Aufschlag.' },
  reactor: { name: 'Sonnenkern' },
  lab: { name: 'Archivturm', desc: 'Schaltet Technikstufen frei: Stufe 1 für Kreuzer, Stufe 2 für Großschiffe.' },
  turret: { name: 'Lanzenbastion', desc: 'Geschützturm mit Lichtlanzen: ein Teil des Schadens geht durch Schilde.', lv: [{ wpn: ['lanceM'] }, { wpn: ['lanceM', 'lanceM'] }, { wpn: ['lanceH', 'lanceM'] }] },
  shield: { name: 'Ägis-Schrein' },
  relay: { name: 'Bannerturm' },
  super: { name: 'Sunbreaker', desc: 'Superwaffe. Entfacht eine Sterneneruption in einem Kartenbereich: acht Sekunden lang schwerer Schaden an allem darin, auch an eigenen Schiffen.', lv: [{ sr: 230, dmg: 110, dur: 8, charge: 240 }, { sr: 260, dmg: 140, dur: 8, charge: 190 }, { sr: 290, dmg: 170, dur: 9, charge: 150 }] },
  /* Fassung 22 */
  wall: { name: 'Ägiswall' }, radar: { name: 'Seherturm' }, dock: { name: 'Restaurationsdock' }
});
BLDG.nexus = cloneBldgs(BLDG.alliance, {
  base: { name: 'Kernknoten', desc: 'Herz des Netzes. Alle Stationen müssen über Knoten mit ihm verbunden sein. Ab Stufe 2 mit gebrochenem Kristallstrahl bewaffnet.', lv: [{ shield: 560, sreg: 34 }, { shield: 760, sreg: 40, wpn: ['prismBeam', 'prismBeam'] }, { shield: 1000, sreg: 48, wpn: ['prismBeam', 'prismBeam', 'prismBeam', 'facetBeam', 'crystalPd', 'crystalPd'] }] },
  yard: { name: 'Wachskammer', desc: 'Züchtet Kristallschiffe. Stufe 2 für Prism, Stufe 3 für Monolith und Prime Facet.' },
  refinery: { name: 'Verdichter', desc: 'Harvester liefern ins Netz, nicht hierher. Der Verdichter veredelt: +10 % je Stufe auf alles, was ankommt.', lv: [{ docks: 1, bonus: 1.05 }, { docks: 2, bonus: 1.1 }, { docks: 3, bonus: 1.2 }] },
  reactor: { name: 'Resonator' },
  lab: { name: 'Facettenkammer' },
  turret: { name: 'Kristallwacht', desc: 'Geschützturm mit Kristallstrahlen, die sich auf mehrere Ziele brechen.', lv: [{ wpn: ['spireBeam'] }, { wpn: ['spireBeam', 'spireBeam'] }, { wpn: ['prismBeam', 'spireBeam', 'crystalPd'] }] },
  shield: { name: 'Hüllenprisma' },
  relay: { name: 'Netzknoten', desc: 'Knoten des Netzes: verbindet Stationen in seinem Umkreis, gibt Kommandopunkte, Harvester liefern in seiner Nähe.', tab: 'eco', lv: [{ cost: { ice: 160, ore: 70 }, time: 12, cp: 6, net: 1 }, { cost: { ice: 150, ore: 80 }, time: 12, cp: 10, net: 1.15 }, { cost: { ice: 200, ore: 120 }, time: 14, cp: 16, net: 1.3 }] },
  super: { name: 'Resonanz', desc: 'Superwaffe. Übernimmt alle kleinen feindlichen Schiffe im Zielbereich – sie gehören danach dir.', lv: [{ sr: 260, charge: 240 }, { sr: 300, charge: 190 }, { sr: 340, charge: 150 }] },
  /* Fassung 22 */
  wall: { name: 'Gitterwall' }, radar: { name: 'Lauschkristall' }, dock: { name: 'Heilkristall' }
});
/* The Brood: aus der Republik (keine Schilde), organisch: regen heilt je Sekunde, Kosten nur Biomasse. spore statt Flak. */
BLDG.brood = cloneBldgs(BLDG.mars, {
  base: { name: 'Schwarmherz', desc: 'Herz des Nests, ein lebender Koloss. Ab Stufe 2 mit Säurespuckern bewaffnet. Heilt sich selbst.', lv: [{ armor: 2, regen: 0.004 }, { armor: 3, regen: 0.005, wpn: ['acidTw', 'acidTw'] }, { armor: 4, regen: 0.006, wpn: ['acidTw', 'acidTw', 'acidTw', 'acidTw', 'acidHeavy', 'acidHeavy'] }] },
  yard: { name: 'Brutgrube', desc: 'Züchtet Larven und alle Formen. Stufe 2 für Sporer und Acid Maw, Stufe 3 für Leviathan und Matriarch.', lv: [{ regen: 0.004 }, { regen: 0.005 }, { regen: 0.006 }] },
  refinery: { name: 'Verdauungskammer', desc: 'Grazer liefern hierher. Eis und Erz werden zu Biomasse.', lv: [{ regen: 0.004 }, { regen: 0.005 }, { regen: 0.006 }] },
  reactor: { name: 'Brutkammer', desc: 'Erzeugt Nährsaft (Energie). Bei Mangel heilen Nester langsamer und Brutgruben züchten langsamer.', lv: [{ regen: 0.004 }, { regen: 0.005 }, { regen: 0.006 }] },
  lab: { name: 'Cortex', desc: 'Das Gehirn: schaltet Mutationsstufen frei.', lv: [{ regen: 0.004 }, { regen: 0.005 }, { regen: 0.006 }] },
  turret: { name: 'Säurekrater', desc: 'Spuckt Säure auf alles in der Nähe.', lv: [{ wpn: ['acidTw'], regen: 0.005 }, { wpn: ['acidTw', 'acidTw'], regen: 0.006 }, { wpn: ['acidTw', 'acidTw', 'acidHeavy'], regen: 0.007 }] },
  flak: null,
  relay: { name: 'Pheromonknoten', desc: 'Mehr Kommandopunkte, also mehr Brut zugleich.', lv: [{ regen: 0.005 }, { regen: 0.006 }, { regen: 0.007 }] },
  super: { name: 'Brutsturm', desc: 'Superwaffe. Lässt irgendwo auf der Karte einen Sturm aus Schwärmen und Ravagern schlüpfen, der 60 Sekunden lebt.', lv: [{ sr: 200, charge: 240, regen: 0.004, packs: 8 }, { sr: 230, charge: 190, regen: 0.005, packs: 11 }, { sr: 260, charge: 150, regen: 0.006, packs: 14 }] },
  /* Fassung 22 */
  wall: { name: 'Membranwall', desc: 'Spannt eine zähe Membran zu einem eigenen Säurekrater, Sporennest oder Membranknoten in Reichweite. Feindliche Schiffe kommen nicht hindurch, feindliche Schüsse bleiben in der Membran hängen. Braucht Nährsaft; reißt sie, wächst sie nach einigen Sekunden nach.', lv: [{ regen: 0.005 }, { regen: 0.006 }, { regen: 0.007 }] },
  radar: { name: 'Sinnesknospe', desc: 'Ein riesiges Auge ohne Waffen: sehr weite Sicht, spürt getarnte Schiffe in der Nähe auf. Braucht Nährsaft.', lv: [{ regen: 0.004 }, { regen: 0.005 }, { regen: 0.006 }] },
  dock: { name: 'Heilgrube', desc: 'Heilt eigene Brut in der Nähe (Hülle und Organe, schneller als die eigene Heilung) und langsam eigene Nester. Vorsichtige Brut zieht sich auch hierher zurück.', lv: [{ regen: 0.005 }, { regen: 0.006 }, { regen: 0.007 }] }
});
BLDG.brood.spore = { role: 'spore', name: 'Sporennest', r: 26, tab: 'def', lv: lv3(
  { hull: 900, shield: 0, armor: 1, energy: -6, cost: { ice: 420, ore: 0 }, time: 20, aura: 220, regen: 0.006 },
  { hull: 1150, shield: 0, armor: 2, energy: -8, cost: { ice: 380, ore: 0 }, time: 18, aura: 280, regen: 0.007 },
  { hull: 1450, shield: 0, armor: 2, energy: -10, cost: { ice: 500, ore: 0 }, time: 22, aura: 340, regen: 0.008 }),
  desc: 'Sporenwolke: Brood-Schiffe heilen im Umkreis 2 % je Sekunde, Feinde verlieren 1 % je Sekunde.' };
for (const role in BLDG.brood) for (const l of BLDG.brood[role].lv) if (l.cost) { l.cost = { ice: l.cost.ice + l.cost.ore, ore: 0 }; }
/* Das Siegel (Quarantine Line): ein Erbauer-Tor in der Kartenmitte, das alle gemeinsam halten. Nicht baubar. */
for (const f in BLDG) BLDG[f].seal = { role: 'seal', name: 'Das Siegel', r: 80, tab: 'none', unique: true, hidden: true, lv: lv3(
  { hull: 14000, shield: 1500, sreg: 40, energy: 0, cp: 0, cost: null, time: 0 },
  { hull: 16000, shield: 1800, sreg: 44, energy: 0, cp: 0, cost: { ice: 2000, ore: 1200 }, time: 90, wpn: ['wardBeam', 'wardBeam'] },
  { hull: 18000, shield: 2200, sreg: 48, energy: 0, cp: 0, cost: { ice: 3000, ore: 1800 }, time: 120, wpn: ['wardBeam', 'wardBeam', 'wardLance', 'pdH', 'pdH'] }),
  desc: 'Das Siegel der Erbauer. Fällt es, strömt die Brood ungehindert in den Kessel – alle haben verloren. Lässt sich ausbauen und wehrt sich dann.' };
/* Außenbasen: die Kommandobasis ist mehrfach baubar (die erste steht zum Start), überall auf der Karte */
for (const f in BLDG) { const b = BLDG[f].base; if (!b) continue; b.unique = false; b.lv[0].cost = f === 'brood' ? { ice: 2300, ore: 0 } : { ice: 1500, ore: 800 }; b.lv[0].time = 75; }
for (const f in BLDG) for (const role in BLDG[f]) { const b = BLDG[f][role]; b.f = f; b.id = role; for (const l of b.lv) { l.wpn = (l.wpn || []).map(w => W[w]); l.armor = l.armor || 0; l.shield = l.shield || 0; l.sreg = l.sreg || 0; } }
/* ------------------------------------------------------------------ Balance (Runde 16)
   Verteidigung zählt wie bei Armada 2: Geschütze sind kosteneffizient gegen gleich teure Schiffe, große Schiffe sind
   träge. Die Faktoren wirken auf die Grunddaten oben; Waffen der Stationen werden dafür kopiert (Schiffe teilen manche).
   Geschütz-Schaden je Fraktion so, dass Stufe I überall etwa 85–105 Schaden/s macht (vorher 38–83). */
const BAL = {
  speed: { f: 1, s: 0.88, m: 0.78, l: 0.66 }, accel: { f: 1, s: 0.9, m: 0.8, l: 0.7 }, turn: { f: 1, s: 0.92, m: 0.85, l: 0.78 },
  tower: { roles: { turret: 1, flak: 1 }, hull: 1.3, shield: 1.3, range: 1.1, dps: { alliance: 1.55, mars: 1.9, legion: 1.3, nexus: 1.25, brood: 1.9, guardian: 1.6 }, flak: 1.4 },
  base: { hull: 2.1, shield: 1.6, dps: 1.4, range: 1.1 }, other: { hull: 1.25 }
};
for (const id in SHIPS) { const s = SHIPS[id]; if (s.role !== 'war') continue; s.speed = Math.round(s.speed * (s.f === 'brood' && s.cls === 's' ? 0.95 : BAL.speed[s.cls])); s.accel = Math.round(s.accel * BAL.accel[s.cls]); s.turn = +(s.turn * BAL.turn[s.cls]).toFixed(2); }
/* Fraktionsausgleich nach der Balance-Matrix (Legion gewann 91 %, Brood 20 %): Paladin-Lanze schwächer und teurer,
   Begleitdrohnen langsamer nachgebaut (combat.js), Brood-Kampfschiffe zäher und billiger */
SHIPS.paladin.wpn = SHIPS.paladin.wpn.map((w, i) => Object.assign({}, w, { dmg: i === 0 ? 8 : 4 })); SHIPS.paladin.cost = { ice: 560, ore: 240 }; SHIPS.paladin.hull = 340;
SHIPS.paladin.hangar = 1; SHIPS.herald.hangar = 1;
SHIPS.paladin.shield = 320;
/* Mars: Rümpfe +8 %, Hedgehog billiger (Autokanonen tun sich gegen Schilde schwer) */
for (const id in SHIPS) { const s = SHIPS[id]; if (s.f === 'mars' && s.role === 'war') s.hull = Math.round(s.hull * 1.08); }
SHIPS.hedgehog.cost = { ice: 340, ore: 150 };
/* Brood: fast nur kleine Schiffe, die Konter gegen Kleine treffen sie voll – dafür zäher und billiger */
/* (Runde 17, Kampftempo Taktisch: Brood gewann 19 von 24 entschiedenen Partien – Rumpf- und Kostenbonus entfallen) */
/* Nexus: Kampfschiffe Rumpf +12 %, Schaden +10 % (verlor im Tempo Taktisch fast alles) */
for (const id in SHIPS) { const s = SHIPS[id]; if (s.f !== 'nexus' || s.role !== 'war') continue; s.hull = Math.round(s.hull * 1.12); s.wpn = s.wpn.map(w => w.kind === 'pd' ? w : Object.assign({}, w, { dmg: +(w.dmg * 1.1).toFixed(2) })); }
/* Alliance: Schilde der Kampfschiffe +15 %, Lancer etwas billiger */
for (const id in SHIPS) { const s = SHIPS[id]; if (s.f === 'alliance' && s.role === 'war') { if (s.shield) s.shield = Math.round(s.shield * 1.15); s.hull = Math.round(s.hull * 1.12); s.wpn = s.wpn.map(w => w.kind === 'pd' ? w : Object.assign({}, w, { dmg: +(w.dmg * 1.18).toFixed(2) })); } }
SHIPS.lancer.cost = { ice: 350, ore: 140 };
/* Runde 18: Alliance-Kampfschiffe 4 % billiger, Mars-Rümpfe +6 % */
for (const id in SHIPS) { const s = SHIPS[id]; if (s.f === 'alliance' && s.role === 'war') for (const k in s.cost) s.cost[k] = Math.round(s.cost[k] * 0.96); if (s.f === 'mars' && s.role === 'war') s.hull = Math.round(s.hull * 1.06); }
/* Runde 18 (Fassung 20, neue KI im Gefecht): Legion gewann nur noch 19–25 % – Kampfschiffe Rumpf +8 % */
for (const id in SHIPS) { const s = SHIPS[id]; if (s.f === 'legion' && s.role === 'war') s.hull = Math.round(s.hull * 1.08); }
/* Brood: Biomasse aus allem – die Grube verwertet 15 % mehr (gleicht die anfällige Ausbreitung aus) */
/* (Runde 18: mit doppelten Vorkommen kein Brood-Bonus mehr nötig) */
/* Kostenduelle (tools/balance/duel.js, Runde 17): Ausreißer auf etwa ±0,25 Vorsprung bei gleichem Budget bringen */
const TUNE = { behemoth: { hull: 0.85, dps: 0.8 }, leviathan: { hull: 0.88, dps: 0.8 }, swarm: { hull: 0.88, dps: 0.65 }, larva: { cost: 1.2 }, broodmother: { cost: 1.3 }, sporer: { cost: 1.35 }, acidmaw: { hull: 0.9 }, spire: { cost: 1.15 }, zealot: { hull: 0.85, dps: 0.7 }, hammer: { hull: 0.92, cost: 1.15 },
  wasp: { cost: 0.86 }, shard: { cost: 0.85, hull: 1.15 }, prism: { cost: 0.8 }, paladin: { cost: 1.08 }, herald: { cost: 1.08 }, longshot: { cost: 0.72 }, basilica: { cost: 0.87 }, bulwark: { dps: 1.15 } };
/* Erbauer-Lanze der Reckoning: Waffe der Alliance gegen große Schiffe */
SHIPS.reckoning.wpn = SHIPS.reckoning.wpn.map((w, i) => i === 0 ? Object.assign({}, w, { antiL: 1.5 }) : w);
for (const id in TUNE) { const s = SHIPS[id], t = TUNE[id]; if (t.hull) s.hull = Math.round(s.hull * t.hull); if (t.cost) for (const k in s.cost) s.cost[k] = Math.round(s.cost[k] * t.cost); if (t.dps) s.wpn = s.wpn.map(w => w.kind === 'pd' ? w : Object.assign({}, w, { dmg: +(w.dmg * t.dps).toFixed(2) })); }
for (const f in BLDG) for (const role in BLDG[f]) {
  const tw = BAL.tower.roles[role], bs = role === 'base';
  if (!tw && !bs) { for (const l of BLDG[f][role].lv) l.hull = Math.round(l.hull * BAL.other.hull); continue; }
  const k = bs ? BAL.base : BAL.tower, dk = bs ? BAL.base.dps : role === 'flak' ? BAL.tower.flak : (BAL.tower.dps[f] || 1.5);
  for (const l of BLDG[f][role].lv) { l.hull = Math.round(l.hull * k.hull); l.shield = Math.round(l.shield * k.shield); l.wpn = l.wpn.map(w => w.kind === 'pd' ? w : Object.assign({}, w, { dmg: +(w.dmg * dk).toFixed(2), range: Math.round(w.range * k.range) })); }
}
/* Fassung 22: Turmspezialisierung ab Stufe II. Beim Ausbau auf II wählt der Spieler einen Zweig; die Stufen II und III
   des Zweigs stehen in def.sp[zweig] (Stufe I bleibt gleich), lvOf(b) liest sie über b.spec.
   Flak: schnelle, leichtere Schüsse, stark gegen Kleine und Jäger (antiS), schwach gegen Große, dazu Punktverteidigung.
   Schwergeschütz: langsame, schwere Schüsse mit etwas mehr Reichweite, stark gegen Große (antiL), schwach gegen Kleine.
   Störsender: kein Schaden; feindliche Schiffe im Umkreis jam werden langsamer (jamSlow) und ihre Waffen tragen weniger weit (jamRange). */
const TSPEC = {
  flak: { name: 'Flak', icon: '✷', desc: 'Schnelle, leichtere Schüsse und Punktverteidigung: stark gegen kleine Schiffe und Jäger, schwach gegen große.' },
  heavy: { name: 'Schwergeschütz', icon: '◆', desc: 'Langsame, schwere Schüsse mit etwas mehr Reichweite: stark gegen große Schiffe, schwach gegen kleine.' },
  jam: { name: 'Störsender', icon: '≋', desc: 'Kein Schaden. Feindliche Schiffe im Umkreis werden langsamer, ihre Waffen tragen 20 % weniger weit.' }
};
const TSPEC_ORDER = ['flak', 'heavy', 'jam'];
for (const f in BLDG) {
  const d = BLDG[f].turret; if (!d) continue;
  d.sp = {};
  for (const sp of TSPEC_ORDER) d.sp[sp] = d.lv.map((l, i) => {
    if (i === 0) return l;
    const o = Object.assign({}, l), main = l.wpn.filter(w => w.kind !== 'pd');
    if (sp === 'flak') o.wpn = main.map(w => Object.assign({}, w, { id: w.id + ':flak', dmg: +(w.dmg * 0.5).toFixed(2), reload: +(w.reload * 0.5).toFixed(3), range: Math.round(w.range * 0.95), antiS: 1.6, antiL: 0.6, spread: w.spread ? w.spread * 1.4 : w.spread, speed: w.speed ? w.speed * 1.15 : w.speed })).concat(i === 1 ? [W.pdH] : [W.pdH, W.pdH]);
    else if (sp === 'heavy') o.wpn = main.map(w => Object.assign({}, w, { id: w.id + ':heavy', dmg: +(w.dmg * 2.3).toFixed(2), reload: +(w.reload * 2).toFixed(3), range: Math.round(w.range * 1.15), antiL: 1.6, antiS: 0.5, speed: w.speed ? w.speed * 0.75 : w.speed, spread: w.spread ? w.spread * 0.5 : w.spread, w: w.w ? w.w * 1.5 : w.w }));
    else { let r = 0; for (const w of main) r = Math.max(r, w.range); o.wpn = []; o.jam = Math.round(r * (i === 1 ? 1.05 : 1.2)); o.jamSlow = i === 1 ? 0.7 : 0.62; o.jamRange = 0.8; }
    return o;
  });
}
const BLDG_TABS = [['eco', 'Wirtschaft'], ['mil', 'Militär'], ['def', 'Verteidigung'], ['spec', 'Spezial']];
/* Bauschiff und Frachter je Fraktion */
const BUILDER = { alliance: 'pathfinder', mars: 'prospector', legion: 'restorer', nexus: 'seed', brood: 'seeder' };
const TANKER = { alliance: 'hauler', mars: 'icehauler', legion: 'gleaner', nexus: 'harvester', brood: 'grazer' };
const CORVETTE = { alliance: 'wren', mars: 'needle', legion: 'herald', nexus: 'shard', brood: 'swarm' };

/* ------------------------------------------------------------------ Forschung
   Je Fraktion neun Technologien in drei Stufen (lv = nötige Laborstufe), eine zugleich. fx: Multiplikatoren und Zuschläge,
   die recalcTech zu p.tfx zusammenrechnet. */
const TECH = {
  alliance: [
    { id: 'cargo', name: 'Tiefenbohrer', lv: 1, cost: { ice: 350, ore: 150 }, time: 40, desc: 'Frachter laden 40 % mehr.', fx: { cargo: 1.4 } },
    { id: 'shield1', name: 'Schildzellen', lv: 1, cost: { ice: 400, ore: 220 }, time: 45, desc: 'Schilde aller Schiffe und Stationen +20 %.', fx: { shield: 1.2 } },
    { id: 'beam1', name: 'Lanzenfokus', lv: 1, cost: { ice: 500, ore: 300 }, time: 50, desc: 'Strahlwaffen +15 % Schaden.', fx: { beam: 1.15 } },
    { id: 'sensor', name: 'Weitsensoren', lv: 2, cost: { ice: 300, ore: 160 }, time: 35, desc: 'Sensorreichweite +25 %.', fx: { sensor: 1.25 } },
    { id: 'sreg', name: 'Schnellladung', lv: 2, cost: { ice: 600, ore: 350 }, time: 55, desc: 'Schilde laden 50 % schneller und schon 2 s nach dem letzten Treffer.', fx: { sreg: 1.5, sdelay: 2 } },
    { id: 'drive', name: 'Ionenantrieb', lv: 2, cost: { ice: 500, ore: 300 }, time: 50, desc: 'Schiffe fliegen 12 % schneller und drehen 15 % schneller.', fx: { speed: 1.12, turn: 1.15 } },
    { id: 'yard', name: 'Werftautomatik', lv: 3, cost: { ice: 450, ore: 300 }, time: 45, desc: 'Werften bauen 25 % schneller.', fx: { rate: 1.25 } },
    { id: 'beam2', name: 'Lanzenfokus II', lv: 3, cost: { ice: 900, ore: 600 }, time: 80, desc: 'Strahlwaffen noch einmal +20 % Schaden.', fx: { beam: 1.2 } },
    { id: 'hull', name: 'Verbundrümpfe', lv: 3, cost: { ice: 800, ore: 500 }, time: 70, desc: 'Hülle aller Schiffe +15 %.', fx: { hull: 1.15 } }
  ],
  mars: [
    { id: 'cargo', name: 'Tiefenbohrer', lv: 1, cost: { ice: 350, ore: 150 }, time: 40, desc: 'Frachter laden 40 % mehr.', fx: { cargo: 1.4 } },
    { id: 'armor1', name: 'Panzerplatten', lv: 1, cost: { ice: 400, ore: 260 }, time: 45, desc: 'Panzerung aller Schiffe +1.', fx: { armor: 1 } },
    { id: 'ammo', name: 'Wolframkerne', lv: 1, cost: { ice: 500, ore: 320 }, time: 50, desc: 'Kanonen und Railguns +15 % Schaden.', fx: { kin: 1.15 } },
    { id: 'sensor', name: 'Weitsensoren', lv: 2, cost: { ice: 300, ore: 160 }, time: 35, desc: 'Sensorreichweite +25 %.', fx: { sensor: 1.25 } },
    { id: 'torch', name: 'Fackelantrieb II', lv: 2, cost: { ice: 500, ore: 300 }, time: 50, desc: 'Schiffe fliegen 15 % schneller und drehen 10 % schneller.', fx: { speed: 1.15, turn: 1.1 } },
    { id: 'aim', name: 'Zielrechner', lv: 2, cost: { ice: 450, ore: 300 }, time: 45, desc: 'Punktverteidigung und Railguns laden 25 % schneller.', fx: { pdReload: 0.75, railReload: 0.75 } },
    { id: 'yard', name: 'Werftautomatik', lv: 3, cost: { ice: 450, ore: 300 }, time: 45, desc: 'Werften bauen 25 % schneller.', fx: { rate: 1.25 } },
    { id: 'torp', name: 'Schwere Torpedos', lv: 3, cost: { ice: 800, ore: 500 }, time: 70, desc: 'Torpedos +30 % Schaden und doppelt so schwer abzuschießen.', fx: { torp: 1.3, torpHp: 2 } },
    { id: 'hull', name: 'Verbundpanzer', lv: 3, cost: { ice: 900, ore: 600 }, time: 80, desc: 'Hülle aller Schiffe +15 %.', fx: { hull: 1.15 } }
  ]
};
TECH.legion = [
  { id: 'cargo', name: 'Tiefenbohrer', lv: 1, cost: { ice: 350, ore: 150 }, time: 40, desc: 'Sammler laden 40 % mehr.', fx: { cargo: 1.4 } },
  { id: 'shield1', name: 'Ägisfeld', lv: 1, cost: { ice: 400, ore: 220 }, time: 45, desc: 'Schilde aller Schiffe und Stationen +20 %.', fx: { shield: 1.2 } },
  { id: 'lance1', name: 'Lanzenglut', lv: 1, cost: { ice: 500, ore: 300 }, time: 50, desc: 'Lichtlanzen +15 % Schaden.', fx: { beam: 1.15 } },
  { id: 'drones', name: 'Cherubim', lv: 2, cost: { ice: 400, ore: 220 }, time: 45, desc: 'Jedes Heldenschiff bekommt eine Begleitdrohne mehr.', fx: { drones: 1 } },
  { id: 'xp', name: 'Gedächtnis der Geister', lv: 2, cost: { ice: 450, ore: 260 }, time: 50, desc: 'Heldenschiffe steigen 50 % schneller auf.', fx: { xp: 1.5 } },
  { id: 'drive', name: 'Strömungsantrieb', lv: 2, cost: { ice: 500, ore: 300 }, time: 50, desc: 'Schiffe fliegen 12 % schneller, Sprünge laden 30 % schneller.', fx: { speed: 1.12, jumpCd: 0.7 } },
  { id: 'yard', name: 'Reliquienschmiede', lv: 3, cost: { ice: 450, ore: 300 }, time: 45, desc: 'Werften bauen 25 % schneller.', fx: { rate: 1.25 } },
  { id: 'lance2', name: 'Lanzenglut II', lv: 3, cost: { ice: 900, ore: 600 }, time: 80, desc: 'Lichtlanzen noch einmal +20 % Schaden.', fx: { beam: 1.2 } },
  { id: 'hull', name: 'Elfenbeinpanzer', lv: 3, cost: { ice: 800, ore: 500 }, time: 70, desc: 'Hülle aller Schiffe +15 %.', fx: { hull: 1.15 } }
];
TECH.nexus = [
  { id: 'cargo', name: 'Tiefenauflösung', lv: 1, cost: { ice: 350, ore: 150 }, time: 40, desc: 'Harvester lösen 40 % mehr auf.', fx: { cargo: 1.4 } },
  { id: 'shield1', name: 'Facettenschild', lv: 1, cost: { ice: 400, ore: 220 }, time: 45, desc: 'Schilde aller Schiffe und Stationen +20 %.', fx: { shield: 1.2 } },
  { id: 'beam1', name: 'Brechung', lv: 1, cost: { ice: 500, ore: 300 }, time: 50, desc: 'Kristallstrahlen +15 % Schaden.', fx: { beam: 1.15 } },
  { id: 'net', name: 'Weites Netz', lv: 2, cost: { ice: 300, ore: 160 }, time: 35, desc: 'Netzreichweite +25 %.', fx: { net: 1.25 } },
  { id: 'sreg', name: 'Kristallfluss', lv: 2, cost: { ice: 600, ore: 350 }, time: 55, desc: 'Schilde laden 50 % schneller und schon 2 s nach dem letzten Treffer.', fx: { sreg: 1.5, sdelay: 2 } },
  { id: 'bind', name: 'Tiefe Bindung', lv: 2, cost: { ice: 500, ore: 300 }, time: 50, desc: 'Übernahme schon ab 5 % mehr Hülle, Abklingzeit −25 %.', fx: { bindAt: 0.05, bindCd: 0.75 } },
  { id: 'yard', name: 'Schnellwuchs', lv: 3, cost: { ice: 450, ore: 300 }, time: 45, desc: 'Wachskammern bauen 25 % schneller.', fx: { rate: 1.25 } },
  { id: 'beam2', name: 'Brechung II', lv: 3, cost: { ice: 900, ore: 600 }, time: 80, desc: 'Kristallstrahlen noch einmal +20 % Schaden.', fx: { beam: 1.2 } },
  { id: 'hull', name: 'Dichtes Gitter', lv: 3, cost: { ice: 800, ore: 500 }, time: 70, desc: 'Hülle aller Schiffe +15 %.', fx: { hull: 1.15 } }
];
TECH.brood = [
  { id: 'cargo', name: 'Großer Magen', lv: 1, cost: { ice: 500, ore: 0 }, time: 40, desc: 'Grazer laden 40 % mehr.', fx: { cargo: 1.4 } },
  { id: 'armor1', name: 'Chitinpanzer', lv: 1, cost: { ice: 660, ore: 0 }, time: 45, desc: 'Panzerung aller Schiffe +1.', fx: { armor: 1 } },
  { id: 'acid1', name: 'Ätzdrüsen', lv: 1, cost: { ice: 800, ore: 0 }, time: 50, desc: 'Säure und Bisse +15 % Schaden.', fx: { kin: 1.15 } },
  { id: 'regen', name: 'Schnellheilung', lv: 2, cost: { ice: 600, ore: 0 }, time: 45, desc: 'Alle Brood-Schiffe heilen 50 % schneller.', fx: { regen: 1.5 } },
  { id: 'drive', name: 'Schnellere Flossen', lv: 2, cost: { ice: 800, ore: 0 }, time: 50, desc: 'Schiffe 15 % schneller, drehen 10 % schneller.', fx: { speed: 1.15, turn: 1.1 } },
  { id: 'molt', name: 'Schnelle Häutung', lv: 2, cost: { ice: 700, ore: 0 }, time: 45, desc: 'Mutationen dauern nur halb so lang, Larven 30 % billiger.', fx: { mutT: 0.5, larvaCost: 0.7 } },
  { id: 'yard', name: 'Zweiter Brutschlund', lv: 3, cost: { ice: 750, ore: 0 }, time: 45, desc: 'Brutgruben züchten 25 % schneller.', fx: { rate: 1.25 } },
  { id: 'acid2', name: 'Ätzdrüsen II', lv: 3, cost: { ice: 1500, ore: 0 }, time: 80, desc: 'Säure und Bisse noch einmal +20 % Schaden.', fx: { kin: 1.2 } },
  { id: 'hull', name: 'Dicke Haut', lv: 3, cost: { ice: 1400, ore: 0 }, time: 80, desc: 'Hülle aller Schiffe +15 %.', fx: { hull: 1.15 } }
];
TECH.guardian = [];
for (const f in TECH) for (const t of TECH[f]) t.f = f;
/* Grundwerte der Technikwirkung (ohne Forschung) */
const TFX0 = { cargo: 1, shield: 1, beam: 1, kin: 1, torp: 1, rail: 1, sensor: 1, sreg: 1, sdelay: SHIELD_DELAY, speed: 1, turn: 1, rate: 1, hull: 1, armor: 0, pdReload: 1, railReload: 1, torpHp: 1, link: 1, linkShare: 0.4, bshield: 1, board: 1, marines: 1, grushFree: 0, drones: 0, recrew: 1, xp: 1, jumpCd: 1, relic: 1, site: 1, bindAt: 0, bindCd: 1, net: 1, nodeCost: 1, bregen: 0, mergeBonus: 1, energy: 1, phase: 0, superCharge: 1, regen: 1, swarm: 0, swarmCost: 1, acid: 1, paraT: 1, bigCost: 1, devourCd: 1, mutT: 1, larvaCost: 1 };
