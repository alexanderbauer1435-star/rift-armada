/* Fassung 22: Unterstützer je Fraktion – Rumpf eines verwandten Schiffs (vergrößert) plus Aufbau je Rolle:
   Minenleger: zwei Minenschienen am Heck mit Minen in Reihe (Warnlicht) · Reparaturschiff: zwei Kranarme mit
   leuchtenden Schweißköpfen und Reparaturkreuz · Truppentransporter: Truppenkapseln an beiden Flanken, Bugrampe.
   Nexus: Kristalle statt Metall, Brood: Eiersäcke, Fühler und Parasitenblase. Bug +Z, oben +Y (wie alle Schiffsmodelle). */
import * as THREE from 'three';
import { register, BUILD, cyl, box, sphere, at, both, crystal, orb, navLight } from '../kit.js';

function base(M, def, id, k) { const b = BUILD[id] ? BUILD[id](M, def) : new THREE.Mesh(new THREE.BoxGeometry(8, 4, 30), M.hull2); b.scale.setScalar(k); return b; }
const bio = M => !!M.flesh, cry = M => !!M.crystal;

/* Minenschienen: je Seite eine Schiene mit n Minen, die vorderste mit Warnlicht */
function mineRack(M, g, z0, n, x, y, r) {
  for (const s of [-1, 1]) {
    if (!bio(M)) g.add(at(box(r * 2.4, r * 1.2, n * r * 2.5 + 1, M.dark), s * x, y - r * 0.6, z0 + n * r * 1.25));
    for (let i = 0; i < n; i++) {
      const z = z0 + r + i * r * 2.5;
      if (bio(M)) { g.add(at(sphere(r * 1.1, M.flesh, 14, 10), s * x, y, z)); g.add(at(orb(M, r * 0.55), s * x, y + r * 0.5, z)); }
      else if (cry(M)) g.add(at(crystal(M, r * 2.4, r * 0.9, 6, i % 2 ? M.crystal : M.crystalDark), s * x, y, z, Math.PI / 2, 0, 0));
      else { g.add(at(sphere(r, M.hull2, 12, 8), s * x, y, z)); g.add(at(cyl(r * 0.45, r * 0.45, r * 2.3, M.dark, 8), s * x, y, z, 0, 0, Math.PI / 2)); }
    }
    if (!bio(M)) g.add(at(navLight(M, r * 0.35, 'red', 1.4), s * x, y + r, z0 + r));
  }
}
/* Kranarme: Schulter, Ober- und Unterarm, Schweißkopf (grün leuchtend) */
function arms(M, g, z, x, y, len) {
  for (const s of [-1, 1]) {
    const a = new THREE.Group();
    a.add(at(sphere(1.4, M.dark, 10, 8), 0, 0, 0));
    a.add(at(cyl(0.7, 0.6, len, bio(M) ? M.flesh : M.hull2, 8), 0, 0, len / 2, Math.PI / 2, 0, 0));
    const fore = new THREE.Group(); fore.position.z = len; fore.rotation.y = -s * 0.9;
    fore.add(at(cyl(0.55, 0.45, len * 0.7, bio(M) ? M.flesh : M.hull, 8), 0, 0, len * 0.35, Math.PI / 2, 0, 0));
    fore.add(at(sphere(0.8, bio(M) ? M.acid : M.green, 8, 6), 0, 0, len * 0.72));
    a.add(fore);
    a.position.set(s * x, y, z); a.rotation.y = s * 0.45; g.add(a);
  }
}
function cross(M, g, z, y, s) { g.add(at(box(s * 2, 0.4, s * 0.7, M.light), 0, y, z)); g.add(at(box(s * 0.7, 0.4, s * 2, M.light), 0, y, z)); g.add(at(box(s * 1.5, 0.5, s * 0.35, M.trim), 0, y + 0.05, z)); }
/* Truppenkapseln an den Flanken */
function pods(M, g, z0, n, x, y, w) {
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const z = z0 + i * (w + 2) + w / 2;
    if (cry(M)) { g.add(at(crystal(M, w * 1.1, 2.4, 6, M.crystal), s * x, y, z, Math.PI / 2, 0, 0)); g.add(at(sphere(0.7, M.core, 8, 6), s * x, y + 1.6, z)); continue; }
    g.add(at(box(4.6, 4.2, w, M.hull), s * x, y, z));
    g.add(at(box(4.8, 0.8, w * 0.5, M.trim), s * x, y + 2.1, z));
    g.add(at(box(0.3, 1.2, w * 0.6, M.windows), s * (x + 2.35), y + 0.4, z));
  }
}

function sup(id, b, k, extra) { register(id, (M, def) => { const g = new THREE.Group(); g.add(base(M, def, b, k)); extra(M, g); return g; }); }
/* Minenleger */
/* Tripwire (Allianz): seit Fassung 25 eigenes Modell in factions/alliance.js */
sup('caltrop', 'hedgehog', 1.1, (M, g) => { mineRack(M, g, -26, 3, 8.5, 2.4, 2.4); g.add(at(box(2, 0.6, 12, M.hazard || M.trim), 0, 4, -4)); });
sup('censer', 'paladin', 1.05, (M, g) => { mineRack(M, g, -24, 3, 8, 2.2, 2.2); g.add(at(cyl(2.2, 3.2, 3, M.gold || M.trim, 12), 0, 4.2, -4)); g.add(at(sphere(1.2, M.glow, 10, 8), 0, 6, -4)); });
sup('geode', 'prism', 1.0, (M, g) => { mineRack(M, g, -24, 3, 8.5, 1.8, 2.3); g.add(at(sphere(1.4, M.core || M.glow, 10, 8), 0, 3.5, -6)); });
sup('clutch', 'spitter', 1.35, (M, g) => mineRack(M, g, -24, 3, 7, 2.6, 2.6));
/* Reparaturschiffe */
sup('mender', 'pathfinder', 1.3, (M, g) => { arms(M, g, 6, 4.5, 2.6, 8); cross(M, g, -9, 4.2, 3.4); });
sup('anvil', 'prospector', 1.3, (M, g) => { arms(M, g, 6, 5.5, 2.8, 9); cross(M, g, -10, 4.6, 3.4); });
sup('hospitaller', 'restorer', 1.32, (M, g) => { arms(M, g, 5, 4.6, 2.6, 8); const h = new THREE.Mesh(new THREE.TorusGeometry(5, 0.45, 8, 32), M.gold || M.trim); h.rotation.x = Math.PI / 2; h.position.set(0, 4.6, -9); g.add(h); cross(M, g, -9, 4.4, 3); });
sup('lumen', 'seed', 1.38, (M, g) => { for (const s of [-1, 1]) { g.add(at(crystal(M, 13, 1.6, 6, M.crystal), s * 6, 2, 6, Math.PI / 2 - 0.2, s * 0.5, 0)); g.add(at(sphere(0.9, M.green, 8, 6), s * 10.5, 2, 15)); } g.add(at(sphere(2.2, M.core || M.glow, 12, 10), 0, 3.8, -6)); });
sup('nurse', 'grazer', 1.4, (M, g) => { arms(M, g, 6, 4, 2, 9); g.add(at(sphere(4.4, M.flesh, 16, 12), 0, 3.4, -9)); g.add(at(orb(M, 2), 0, 5.4, -9)); });
/* Truppentransporter */
sup('envoy', 'hauler', 1.45, (M, g) => { pods(M, g, -18, 3, 9.5, 1.6, 6); g.add(at(box(9, 1, 6, M.dark), 0, 0.6, 20, -0.25, 0, 0)); });
sup('breacher', 'boarder', 1.32, (M, g) => { pods(M, g, -20, 3, 10, 1.6, 6); both(g, at(cyl(0.2, 1.1, 9, M.hull2, 8), 3, 0.8, 23, Math.PI / 2, 0, 0)); });
sup('templar', 'herald', 1.55, (M, g) => { pods(M, g, -18, 3, 9.5, 1.8, 5.8); g.add(at(box(1.2, 6, 1.2, M.gold || M.trim), 0, 5.5, -6)); g.add(at(box(4.4, 1.2, 1.2, M.gold || M.trim), 0, 6.6, -6)); });
sup('assimilator', 'binder', 1.12, (M, g) => pods(M, g, -18, 3, 10.5, 1.6, 6));
sup('parasitepod', 'leech', 1.42, (M, g) => { g.add(at(sphere(6.2, M.flesh, 18, 14), 0, 3.2, -6)); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(at(orb(M, 1.1, M.acid), Math.cos(a) * 5.2, 3.2 + Math.sin(a) * 3.6, -6 + Math.sin(a) * 2)); } });
