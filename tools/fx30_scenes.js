/* Fassung 30: Vergleichsbilder der Kampfeffekte (Brood, Mars, Nexus), Spielansicht ohne Leisten, nah.
   SCENES=tools/fx30_scenes.js PREFIX=fx-neu- FRAMES=24 node tools/promo29.js <build.html> */
const game = fs => `() => { beginGame({ map: 'expanse', seed: 7, pace: 'tactical', players: [${fs.map((f, i) => `{ faction: '${f}', ${i ? 'ai: 0' : 'human: true'}, team: ${i} }`).join(', ')}] }, 'skirmish'); }`;
const prep = () => { const g = UI.g; for (const u of g.ships.slice()) removeShip(g, u); for (const q of g.players) q.nob = true; window.__cx = g.map.w / 2; window.__cy = g.map.h / 2 + 520;
  window.__put = (o, list, x, y, ang) => list.map(([id, dx, dy]) => addShip(g, id, o, x + Math.cos(ang) * dx - Math.sin(ang) * dy, y + Math.sin(ang) * dx + Math.cos(ang) * dy, ang));
  window.__tough = arr => { for (const u of arr) { u.hullMax *= 8; u.hull = u.hullMax; u.o = { t: 'hold' }; } }; };
const view = z => `(i, n) => { window.__cine = null; R.cam.z = ${z}; R.center(__cx, __cy); }`;
module.exports = [
  { name: 'brood', sec: 2, steps: [game(['brood', 'alliance']), 3000, prep, () => { const g = UI.g;
      const T = __put(1, [['bulwark', 0, 0], ['haven', 30, 110], ['lancer', -10, -90]], __cx + 40, __cy, Math.PI); __tough(T); for (const u of T) { u.shieldMax = 0; u.shield = 0; }
      const B = __put(0, [['ravager', 0, -30], ['ravager', 0, 40], ['leviathan', -70, 120], ['swarm', 10, -100], ['larva', 20, 90], ['spitter', -230, -60], ['acidmaw', -260, 40], ['leech', -200, 130]], __cx - 70, __cy, 0);
      execCmd(g, { t: 'attack', p: 0, u: B.slice(0, 2).map(u => u.id), e: T[0].id }); execCmd(g, { t: 'attack', p: 0, u: [B[2].id, B[4].id], e: T[1].id }); execCmd(g, { t: 'attack', p: 0, u: [B[3].id], e: T[2].id }); execCmd(g, { t: 'attack', p: 0, u: B.slice(5).map(u => u.id), e: T[0].id });
      __fwd(150); UI.speed = 0.6; } ], opt: { each: view(3.2) } },
  { name: 'mars', sec: 2, steps: [game(['mars', 'alliance']), 3000, prep, () => { const g = UI.g;
      const T = __put(1, [['bulwark', 0, 0], ['bulwark', 20, 110], ['haven', 30, -110]], __cx + 190, __cy, Math.PI); __tough(T); for (const u of T) { u.shieldMax = 0; u.shield = 0; }
      const M = __put(0, [['hammer', 0, 0], ['olympus', -20, 110], ['spear', 10, -100], ['hedgehog', 60, -40], ['needle', 70, 60]], __cx - 130, __cy, 0); for (const u of M) u.o = { t: 'hold' };
      __fwd(130); UI.speed = 0.6; } ], opt: { each: view(2.0) } },
  { name: 'nexus', sec: 2, steps: [game(['nexus', 'alliance']), 3000, prep, () => { const g = UI.g;
      const T = __put(1, [['bulwark', 0, 0], ['bulwark', 20, 110], ['haven', 30, -110], ['lancer', -30, 50], ['lancer', -30, -50]], __cx + 190, __cy, Math.PI); __tough(T);
      const N = __put(0, [['monolith', 0, 0], ['prism', 10, 100], ['facet', -30, -110], ['shard', 60, 50], ['spire', 50, -50]], __cx - 130, __cy, 0); for (const u of N) u.o = { t: 'hold' };
      __fwd(100); UI.speed = 0.6; } ], opt: { each: view(2.0) } }
];
