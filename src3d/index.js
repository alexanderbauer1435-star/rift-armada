/* =====================================================================
   Rift Armada 3D – Einstieg. Bündelt Three.js, den Baukasten mit allen Modellen (Schiffe, Stationen, Karte) und
   die Kernmodule (scene, camera, world, entities, overlay, fog) und setzt window.RA3D mit der Schnittstelle aus
   src3d/SPEC.md. Die Effekte (src3d/effects/index.js, eigener Agent) werden eingebunden, aber nur genutzt, wenn
   ihre Funktionen vorhanden sind (typeof-Prüfung) – ein Platzhalter stört nicht.
   Reihenfolge je Frame (RA3D.frame): Kamera (Wackeln) → Karte (Stätten, Tore, Abbau-Ringe) → Wracks, Stationen,
   Schiffe → Effekte → Sofort-Primitive hochladen → Nebel → Bild (Bloom nur bei Detail 2) → Primitive leeren.
   Aufrufreihenfolge für die Integration: supported() → init(canvas) → resize(w, h, dpr) → setDetail(d) →
   setGame(g, vp) → je Frame setCam(...) [ring/line/disc/ghost beliebig] → event(e, g) je Ereignis → frame(g, dt,
   time, view). project/unproject sind nach setCam gültig. view = { vp, seen(x, y), visible(e), pcol(owner),
   fog: Leinwand | null, detail }.
   ===================================================================== */
import * as THREE from 'three';
import './models/factions/alliance.js'; import './models/factions/mars.js'; import './models/factions/legion.js'; import './models/factions/nexus.js'; import './models/factions/brood.js'; import './models/factions/guardian.js';
import './models/stations/alliance.js'; import './models/stations/mars.js'; import './models/stations/legion.js'; import './models/stations/nexus.js'; import './models/stations/brood.js'; import './models/stations/seal.js';
import './models/world/nature.js'; import './models/world/sites.js';
import { mats, BUILD, BUILDB, BUILDW, bake, drawCount } from './models/kit.js';
import { S, supported, initScene, resize, setDetail, render, disposeScene } from './scene.js';
import { CAM, setCam, updateCamera, project, unproject, shake } from './camera.js';
import { buildWorld, updateWorld, disposeWorld } from './world.js';
import { initEntities, updateEntities, clearEntities, disposeEntities, ghost, hideGhost, setEffects, entityStats, _E } from './entities.js';
import { initOverlay, ring, line, disc, flushOverlay } from './overlay.js';
import { initFog, updateFog, disposeFog } from './fog.js';
import * as effects from './effects/index.js';

const FX = { ok: false, err: 0 };
const RA3D = {
  supported,
  init(canvas, opts) {
    if (!supported()) return false;
    if (!initScene(canvas, opts || {})) return false;
    initOverlay(); initEntities();
    FX.ok = typeof effects.frame === 'function';
    if (FX.ok && typeof effects.init === 'function') { try { effects.init(S.scene, THREE, mats, S.detail); } catch (e) { console.warn('RA3D: effects.init', e); FX.ok = false; } }
    setEffects(FX.ok ? effects : null);
    return true;
  },
  resize(cssW, cssH, dpr) { resize(cssW, cssH, dpr); },
  setDetail(d) {
    const before = S.detail; setDetail(d);
    if (FX.ok && typeof effects.setDetail === 'function') effects.setDetail(S.detail);
    /* Vorlagen und Karte hängen an der Detailstufe (Kennzeichen, die lebendig bleiben) → neu aufbauen */
    if (S.ok && S.detail !== before && S.g) { clearEntities(); buildWorld(S.g); }
  },
  setGame(g, vp) {
    if (!S.ok) return;
    S.g = g; S.vp = vp === undefined ? -1 : vp; S.time = 0;
    clearEntities(); buildWorld(g); initFog(g);
    if (FX.ok && typeof effects.clear === 'function') effects.clear();
  },
  setCam(cx, cy, zoom, cssW, cssH, dpr) { setCam(cx, cy, zoom, cssW, cssH, dpr); },
  project(x, y) { return project(x, y); },
  unproject(sx, sy) { return unproject(sx, sy); },
  ring, line, disc,
  ghost(f, role, lv, x, y, ok) { ghost(f, role, lv, x, y, ok, S.view && S.vp >= 0 ? S.view.pcol(S.vp) : undefined); },
  shake,
  event(e, g) {
    if (!S.ok) return;
    /* Kamerawackeln wie in render.js; Effekte bekommen jedes Ereignis */
    if (e.t === 'die' && e.big && !e.quiet) shake(6); else if (e.t === 'bdie') shake(9); else if (e.t === 'strike') shake(16); else if (e.t === 'gateLance') shake(12); else if (e.t === 'superfire' && e.kind !== 'exodus') shake(8); else if (e.t === 'lance') shake(5); else if (e.t === 'breach') shake(7); else if (e.t === 'wake') shake(8);
    if (FX.ok && typeof effects.event === 'function') { try { effects.event(e, g, S.view); } catch (err) { console.warn('RA3D: effects.event', err); } }
  },
  frame(g, dt, time, view) {
    if (!S.ok || !g) return;
    S.g = g; S.view = view; S.time = time; S.vp = view.vp;
    if (view.detail !== undefined && view.detail !== S.detail) RA3D.setDetail(view.detail);
    updateCamera(dt);
    updateWorld(g, dt, time, view);
    updateEntities(g, dt, time, view);
    if (FX.ok) { try { effects.frame(g, dt, time, view, S.camera); FX.err = 0; } catch (err) { console.warn('RA3D: effects.frame', err); if (++FX.err > 3) FX.ok = false; } }
    flushOverlay();
    updateFog(view);
    render();
    hideGhost();
  },
  dispose() { disposeFog(); disposeWorld(); disposeEntities(); if (FX.ok && typeof effects.clear === 'function') effects.clear(); disposeScene(); },
  /* Messwerte und Zugriff für Tests (nicht Teil der Spec) */
  stats() { return Object.assign({ calls: S.info.calls, tris: S.info.tris, detail: S.detail, dist: CAM.dist }, entityStats()); },
  _: { S, CAM, THREE, BUILD, BUILDB, BUILDW, mats, bake, drawCount, effects, E: _E }
};
window.RA3D = RA3D;
export default RA3D;
