/* Fassung 21: Belagerungsartillerie – Rumpf eines verwandten Schiffs (vergrößert), darauf ein schwerer Mörser auf
   Drehkranz mit langem, leicht angehobenem Lauf. Bug +Z, oben +Y (wie alle Schiffsmodelle). */
import * as THREE from 'three';
import { register, BUILD, cyl, at } from '../kit.js';
function siege(id, base, k, z0, len, r, y0) {
  register(id, (M, def) => {
    const g = new THREE.Group();
    const b = BUILD[base] ? BUILD[base](M, def) : new THREE.Mesh(new THREE.BoxGeometry(8, 4, 30), M.hull2);
    b.scale.setScalar(k); g.add(b);
    const gun = new THREE.Group();
    gun.add(at(cyl(r * 2.1, r * 2.3, r * 1.4, M.dark, 18), 0, 0, 0, Math.PI / 2, 0, 0));        /* Drehkranz */
    gun.add(at(cyl(r * 1.5, r * 1.5, r * 2.2, M.hull2, 14), 0, r * 0.9, 0));                    /* Lafette */
    const barrel = new THREE.Group();
    barrel.add(at(cyl(r, r * 0.8, len, M.dark, 14), 0, 0, len / 2));
    barrel.add(at(cyl(r * 1.25, r * 1.25, len * 0.12, M.trim, 14), 0, 0, len * 0.35));
    barrel.add(at(cyl(r * 1.15, r * 1.25, len * 0.1, M.hull, 14), 0, 0, len * 0.95));
    barrel.add(at(cyl(r * 0.55, r * 0.55, 0.3, M.glow, 10), 0, 0, len + 0.1));
    barrel.position.y = r * 1.4; barrel.rotation.x = -0.32;
    gun.add(barrel);
    gun.position.set(0, y0, z0); g.add(gun);
    return g;
  });
}
siege('catapult', 'lancer', 1.25, -4, 26, 1.7, 3.2);
siege('mortar', 'hedgehog', 1.2, -6, 22, 2.1, 3.6);
siege('ballista', 'paladin', 1.15, -4, 28, 1.6, 3.2);
siege('lodestar', 'prism', 1.05, -6, 26, 1.7, 3.4);
siege('boomer', 'spitter', 1.4, -4, 12, 2.6, 3.0);
