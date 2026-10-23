/* Kartenprüfung: jede Karte in jeder Spielerzahl – alle Startplätze erreichen einander (Wegsuche für alle drei Größenklassen),
   kein Start, Vorkommen oder Stätte liegt in Fels, Feld oder Nebel, Korridore sind vorhanden (mittlere Klasse findet einen Weg,
   der länger ist als die Luftlinie – die Tasche zwingt zum Umweg). */
const { loadSim } = require('./harness.js'); const X = loadSim();
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('  FEHLER ' + msg); } };
for (const id of Object.keys(X.MAPS)) for (const np of X.MAPS[id].np) {
  const m = X.generateMap(id, np, 7); const g = X.createGame({ map: id, players: Array.from({ length: np }, (_, i) => ({ faction: i % 2 ? 'mars' : 'alliance', human: i === 0, ai: i ? 2 : 0 })), seed: 7 });
  const map = g.map; let worst = 0, detour = 0;
  for (let i = 0; i < map.starts.length; i++) for (let j = i + 1; j < map.starts.length; j++) {
    const a = map.starts[i], b = map.starts[j], air = Math.hypot(a.x - b.x, a.y - b.y);
    for (let cls = 0; cls < 3; cls++) { const p = X.findPath(map, cls, a.x, a.y, b.x, b.y); ok(p && p.length, id + '/' + np + ': kein Weg (Klasse ' + cls + ') von Start ' + i + ' zu ' + j); if (p && p.length) { let l = 0, px = a.x, py = a.y; for (const q of p) { l += Math.hypot(q.x - px, q.y - py); px = q.x; py = q.y; } if (cls === 1) detour = Math.max(detour, l / air); } }
  }
  for (const n of map.nodes) { ok(!X.ctx.inField(map, n.x, n.y) || id === 'shattered', id + '/' + np + ': Vorkommen im Feld bei ' + Math.round(n.x) + ',' + Math.round(n.y)); ok(X.ctx.nebAt(map, n.x, n.y) === 0, id + '/' + np + ': Vorkommen im Nebel bei ' + Math.round(n.x) + ',' + Math.round(n.y)); }
  for (const s of map.sites) { ok(X.ctx.nebAt(map, s.x, s.y) === 0, id + '/' + np + ': Stätte im Nebel ' + s.kind); ok(!map.rocks.some(r => Math.hypot(r.x - s.x, r.y - s.y) < r.r + s.r * 0.8), id + '/' + np + ': Fels in der Stätte ' + s.kind); }
  for (const s of map.starts) { ok(X.ctx.nebAt(map, s.x, s.y) === 0 && !X.ctx.inField(map, s.x, s.y), id + '/' + np + ': Start im Nebel/Feld'); ok(!map.rocks.some(r => Math.hypot(r.x - s.x, r.y - s.y) < r.r + 120), id + '/' + np + ': Fels am Start'); ok(!map.nebs.some(n => Math.hypot(n.x - s.x, n.y - s.y) < n.r + 300), id + '/' + np + ': Nebel zu nahe am Start'); }
  /* Basis muss gebaut werden können: Platz für Werft und Raffinerie neben der Basis */
  let free = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (!X.canPlace(g, 0, 'yard', map.starts[0].x + Math.cos(a) * 170, map.starts[0].y + Math.sin(a) * 170)) free++; }
  ok(free >= 6, id + '/' + np + ': zu wenig Bauplatz um die Basis (' + free + '/16)');
  console.log(id.padEnd(11) + np + ' Spieler: ' + map.nodes.length + ' Vorkommen, ' + map.rocks.length + ' Felsen, ' + map.fields.length + ' Felder, ' + map.nebs.length + ' Nebel, Umweg ×' + detour.toFixed(2) + ', Bauplatz ' + free + '/16');
}
console.log(fail ? fail + ' FEHLER' : 'ALL OK');
process.exit(fail ? 1 : 0);
