/* =====================================================================
   Fassung 22 – neue Stationen aller fünf Fraktionen und Turmzweige, aus den vorhandenen Stationsmodellen gebaut.
   Schildwall (wall): verkleinertes Kommandorelais der Fraktion mit schwebendem Emitterkristall und vier Feldspulen.
     Das Feld selbst (die leuchtende Wand zwischen Emitter und Anker) zeichnet entities.js je Bild.
   Frühwarnstation (radar): Relais als Sockel, darauf ein Mast mit großer drehender Radarschüssel und Antennen.
   Reparaturdock (dock): verkleinerte Raffinerie als Kern, zwei Ausleger als Wiege, Kräne mit grünen Schweißlichtern.
   Turmzweige (turret:flak | turret:heavy | turret:jam): der Turm der Fraktion, am Geschützkopf (userData.aim) ergänzt –
     Flak: Vierlingsläufe und Munitionstrommel; Schwergeschütz: ein langer dicker Lauf mit Mündungsbremse;
     Störsender: Schüssel mit pulsierendem Störring statt Läufen.
   Mitte im Ursprung, oben +Y, Bug der Geschütze +Z (wie kit.turret). Wird nach den Stationsdateien geladen.
   ===================================================================== */
import * as THREE from 'three';
import { registerB, BUILDB, mesh, at, cyl, dish, antenna } from '../kit.js';
import SDATA from '../stations.json';

const FACS = ['alliance', 'mars', 'legion', 'nexus', 'brood'];
const PI = Math.PI;
const dOf = (f, role) => SDATA.bldgs.find(d => d.f === f && d.id === role) || SDATA.bldgs.find(d => d.id === role);
/* Fremdes Modell der Fraktion, auf Radius r skaliert */
function scaled(f, role, M, lv, r) {
  const fn = BUILDB[f + ':' + role], d = dOf(f, role), g = new THREE.Group();
  if (!fn || !d) return g;
  const m = fn(M, d, lv), k = r / d.r; m.scale.setScalar(k); g.add(m);
  return g;
}
const accent = (f, M) => f === 'brood' ? (M.acid || M.glow) : f === 'nexus' ? (M.core || M.glow) : M.glow;

/* ------------------------------------------------------------ Schildwall-Emitter */
function wallModel(f, M, d, lv) {
  const g = scaled(f, 'relay', M, lv, 13);
  const top = new THREE.Group(); top.position.y = 12; g.add(top);
  const crys = mesh(new THREE.OctahedronGeometry(3.6 + lv * 0.4, 0), accent(f, M), false); crys.scale.set(1, 1.6, 1); crys.userData.pulse = { amp: 0.12, speed: 3, base: 1 }; top.add(crys);
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2 + PI / 4, coil = new THREE.Group(); coil.rotation.y = a; top.add(coil);
    coil.add(at(cyl(1.1, 1.1, 7, M.dark, 8), 0, -3, 6.5, 0, 0, 0));
    coil.add(at(mesh(new THREE.TorusGeometry(1.6, 0.45, 6, 12), M.trim), 0, -3, 9.6));
    coil.add(at(mesh(new THREE.SphereGeometry(0.8, 8, 6), M.glow, false), 0, -3, 10.4));
  }
  if (lv >= 2) { const ring = mesh(new THREE.TorusGeometry(6.5, 0.5, 6, 24), M.trim); ring.rotation.x = PI / 2; ring.position.y = -1; top.add(ring); }
  if (lv >= 3) { const r2 = mesh(new THREE.TorusGeometry(8.5, 0.35, 6, 28), accent(f, M), false); r2.rotation.x = PI / 2; r2.position.y = 1.5; r2.userData.spin = { axis: 'z', speed: 0.8 }; top.add(r2); }
  return g;
}
/* ------------------------------------------------------------ Frühwarnstation */
function radarModel(f, M, d, lv) {
  const g = scaled(f, 'relay', M, lv, 18);
  g.add(at(cyl(1.6, 2.4, 14, M.dark, 8), 0, 9, 0, -PI / 2));
  const dk = dish(M, 9 + lv); dk.position.y = 14; dk.userData.spin = { axis: 'y', speed: 0.9 };
  g.add(dk);
  dk.add(at(mesh(new THREE.SphereGeometry(0.9, 8, 6), accent(f, M), false), 0, 10 + lv, 0));
  for (let i = 0; i < 2 + lv; i++) { const a = i / (2 + lv) * PI * 2; const an = antenna(M, 8 + i % 2 * 3, 0.3); an.position.set(Math.cos(a) * 11, 2, Math.sin(a) * 11); g.add(an); }
  if (lv >= 3) { const ring = mesh(new THREE.TorusGeometry(15, 0.4, 6, 32), M.glowSoft || M.glow, false); ring.rotation.x = PI / 2; ring.position.y = 3; g.add(ring); }
  return g;
}
/* ------------------------------------------------------------ Reparaturdock */
function dockModel(f, M, d, lv) {
  const g = new THREE.Group();
  const core = scaled(f, 'refinery', M, lv, 16); core.position.set(-14, 0, 0); g.add(core);
  const repl = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fffcf').multiplyScalar(2.6) });
  for (const s of [-1, 1]) {
    g.add(at(mesh(new THREE.BoxGeometry(46, 4, 6), M.hull2), 4, 1, s * 19));
    g.add(at(mesh(new THREE.BoxGeometry(46, 1, 2), M.trim), 4, 3.5, s * 19));
    if (lv >= 2) g.add(at(mesh(new THREE.BoxGeometry(36, 2.5, 3), M.dark), 4, 0, s * 26));
    for (let i = 0; i < 3; i++) g.add(at(mesh(new THREE.SphereGeometry(0.7, 8, 6), M.green, false), -10 + i * 14, 4.2, s * 16.5));
  }
  g.add(at(mesh(new THREE.BoxGeometry(6, 8, 44), M.hull), -24, 2, 0));
  const nC = lv >= 3 ? 3 : 2;
  for (let i = 0; i < nC; i++) {
    const cr = new THREE.Group(), s = i % 2 ? 1 : -1; cr.position.set(-4 + i * 12, 0, s * 19); cr.userData.bob = { amp: 1.2, speed: 0.8 + i * 0.3, y0: 0 };
    cr.add(at(mesh(new THREE.BoxGeometry(2, 12, 2), M.dark), 0, 6, 0));
    cr.add(at(mesh(new THREE.BoxGeometry(2, 2, 14), M.trim), 0, 12, -s * 6));
    const tip = mesh(new THREE.SphereGeometry(1.1, 8, 6), repl, false); tip.position.set(0, 10.5, -s * 12); tip.userData.blink = 2.4; cr.add(tip);
    g.add(cr);
  }
  return g;
}
/* ------------------------------------------------------------ Turmzweige */
function aimNode(root) { let n = null; root.traverse(o => { if (!n && o.userData && o.userData.aim) n = o; }); return n; }
function specTurret(f, spec) {
  return (M, d, lv) => {
    const g = BUILDB[f + ':turret'](M, d, lv), head = aimNode(g) || g;
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(head), wp = new THREE.Vector3(); head.getWorldPosition(wp);
    const y = (isFinite(box.max.y) ? box.max.y : 8) - wp.y + 0.6, k = lv >= 3 ? 1.15 : 1;
    const add = o => { head.add(o); return o; };
    if (spec === 'flak') {
      for (let i = 0; i < 4; i++) add(at(cyl(0.45 * k, 0.4 * k, 11 * k, M.dark, 6), (i - 1.5) * 1.6 * k, y + (i % 2) * 0.9, 6 * k));
      add(at(mesh(new THREE.BoxGeometry(6.5 * k, 2.4 * k, 4 * k), M.hull2), 0, y, 0));
      add(at(cyl(1.6 * k, 1.6 * k, 3 * k, M.trim, 10), 4.6 * k, y, -1, 0, PI / 2, 0));
    } else if (spec === 'heavy') {
      add(at(mesh(new THREE.BoxGeometry(6 * k, 3.2 * k, 9 * k), M.hull2), 0, y + 0.4, -1));
      add(at(cyl(1.5 * k, 1.2 * k, 26 * k, M.dark, 10), 0, y + 0.8, 14 * k));
      add(at(mesh(new THREE.BoxGeometry(3.6 * k, 2.6 * k, 3.2 * k), M.hull), 0, y + 0.8, 27 * k));
      add(at(mesh(new THREE.BoxGeometry(5 * k, 2 * k, 4 * k), M.trim), 0, y + 0.6, -6.5 * k));
    } else {
      const dk = dish(M, 5.5 * k); dk.position.y = y - 1; add(dk);
      const ring = mesh(new THREE.TorusGeometry(8 * k, 0.45, 6, 28), accent(f, M), false); ring.rotation.x = PI / 2; ring.position.y = y + 1; ring.userData.pulse = { amp: 0.25, speed: 2.6, base: 1 }; add(ring);
      const r2 = mesh(new THREE.TorusGeometry(5 * k, 0.35, 6, 24), accent(f, M), false); r2.rotation.x = PI / 2; r2.position.y = y + 2.5; r2.userData.pulse = { amp: 0.3, speed: 3.4, base: 1 }; add(r2);
    }
    return g;
  };
}
for (const f of FACS) {
  /* Fassung 24: eigene Modelle einer Fraktion (z. B. Allianz) haben Vorrang */
  if (!BUILDB[f + ':wall']) registerB(f, 'wall', (M, d, lv) => wallModel(f, M, d, lv));
  if (!BUILDB[f + ':radar']) registerB(f, 'radar', (M, d, lv) => radarModel(f, M, d, lv));
  registerB(f, 'dock', (M, d, lv) => dockModel(f, M, d, lv));
  if (BUILDB[f + ':turret']) for (const sp of ['flak', 'heavy', 'jam']) registerB(f, 'turret:' + sp, specTurret(f, sp));
}
