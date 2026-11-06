/* =====================================================================
   Rift Armada 3D – Einstieg. Bündelt Three.js, den Baukasten mit allen Modellen (Schiffe, Stationen, Karte) und
   die Kernmodule (scene, camera, world, entities, overlay, fog) und setzt window.RA3D mit der Schnittstelle aus
   src3d/SPEC.md. Die Effekte (src3d/effects/index.js, eigener Agent) werden eingebunden, aber nur genutzt, wenn
   ihre Funktionen vorhanden sind (typeof-Prüfung) – ein Platzhalter stört nicht.
   Reihenfolge je Frame (RA3D.frame): Kamera (Wackeln) → Karte (Stätten, Tore, Abbau-Ringe) → Wracks, Stationen,
   Schiffe → Effekte → Sofort-Primitive hochladen → Nebel → Bild (Bloom nur bei Detail 2) → Primitive leeren.
   Aufrufreihenfolge für die Integration: supported() → init(canvas) → resize(w, h, Geräte-DPR) → setDetail(d) →
   setGame(g, vp) → je Frame setCam(...) [ring/line/disc/ghost beliebig] → event(e, g) je Ereignis → frame(g, dt,
   time, view). project/unproject sind nach setCam gültig. view = { vp, seen(x, y), visible(e), pcol(owner),
   fog: Leinwand | null, detail }.
   ===================================================================== */
import * as THREE from 'three';
import './models/factions/alliance.js'; import './models/factions/mars.js'; import './models/factions/legion.js'; import './models/factions/nexus.js'; import './models/factions/brood.js'; import './models/factions/guardian.js'; import './models/factions/siege.js'; import './models/factions/support.js';
import './models/stations/alliance.js'; import './models/stations/mars.js'; import './models/stations/legion.js'; import './models/stations/nexus.js'; import './models/stations/brood.js'; import './models/stations/seal.js'; import './models/stations/extra22.js';
import './models/world/nature.js'; import './models/world/sites.js';
import { mats, BUILD, BUILDB, BUILDW, bake, drawCount, farGeometry, keepFor, setFine } from './models/kit.js';
import { S, Q, supported, initScene, resize, setDetail, render, disposeScene, adapt, sceneChanged, setQuality, quality, gfxApply } from './scene.js';
import { CAM, setCam, updateCamera, project, unproject, shake } from './camera.js';
import { buildWorld, updateWorld, disposeWorld } from './world.js';
import { initEntities, updateEntities, clearEntities, disposeEntities, ghost, hideGhost, setEffects, shipEvent, entityStats, _E, queuePrebuild, prebuild, warm, pending, warmWait } from './entities.js';
import { initOverlay, ring, line, disc, flushOverlay } from './overlay.js';
import { initFog, updateFog, disposeFog } from './fog.js';
import * as effects from './effects/index.js';

const FX = { ok: false, err: 0 };
/* Vorlagen im Leerlauf vorbauen (entities.js prebuild): je Leerlauf-Rückruf so viele, wie Zeit bleibt */
let idleOn = false;
function idlePrebuild() {
  if (idleOn) return; idleOn = true;
  const ric = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 16 }), 50));
  const step = dl => { if (!S.ok) { idleOn = false; return; } const left = prebuild(() => dl.timeRemaining()); if (left) ric(step, { timeout: 1500 }); else idleOn = false; };
  ric(step, { timeout: 1500 });
}
/* Zeiten der Abschnitte des letzten Bildes in ms (für Messungen, tools/perf3d.js) */
const PROF = { world: 0, entities: 0, effects: 0, overlayFog: 0, render: 0 };
const RA3D = {
  supported,
  init(canvas, opts) {
    if (!supported()) return false;
    if (!initScene(canvas, opts || {})) return false;
    initOverlay(); initEntities();
    FX.ok = typeof effects.frame === 'function';
    if (FX.ok && typeof effects.init === 'function') { try { effects.init(S.scene, THREE, mats, S.detail); } catch (e) { console.warn('RA3D: effects.init', e); FX.ok = false; } }
    setEffects(FX.ok ? effects : null);
    if (FX.ok && effects.setGfx) effects.setGfx(S.gfx); gfxApply();
    return true;
  },
  /* dpr = Geräte-Pixelverhältnis (window.devicePixelRatio, ungekürzt); die Render-Skalierung regelt der Renderer */
  resize(cssW, cssH, dpr) { resize(cssW, cssH, dpr); },
  /* Regelung: setAuto(false) hält sie an (Tests); quality() liefert den Zustand; setQuality({ scale, bloom, auto }) */
  setAuto(on) { setQuality({ auto: on }); },
  quality, setQuality,
  setDetail(d) {
    const before = S.detail, ub = S.ultra; setDetail(d); setFine(S.ultra);
    if (FX.ok && typeof effects.setDetail === 'function') effects.setDetail(S.ultra ? 3 : S.detail);
    /* Vorlagen und Karte hängen an der Detailstufe (Kennzeichen, die lebendig bleiben) → neu aufbauen */
    if (S.ok && (S.detail !== before || S.ultra !== ub) && S.g) { clearEntities(); buildWorld(S.g); queuePrebuild(S.g); idlePrebuild(); }
  },
  setGame(g, vp) {
    if (!S.ok) return;
    S.g = g; S.vp = vp === undefined ? -1 : vp; S.time = 0;
    clearEntities(); buildWorld(g); initFog(g); sceneChanged();
    queuePrebuild(g); idlePrebuild();
    if (FX.ok && typeof effects.clear === 'function') effects.clear();
    /* alle schon vorhandenen Shader (Karte, Effekt-Puffer, Nebel, Überlagerung) im Hintergrund übersetzen */
    warm([S.scene]);
  },
  /* Fassung 24: welche Grafikeinheit rechnet? soft = Software-Rasterung (keine Hardwarebeschleunigung im Browser) */
  gpu() {
    if (!S.ok) return null;
    try { const gl = S.renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'), name = String((x && gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || S.gpu || '');
      return { name, low: !!S.low, soft: /swiftshader|llvmpipe|softpipe|basic render|software|microsoft basic/i.test(name) }; } catch (e) { return null; }
  },
  /* Fassung 24: Ladebildschirm vor der Schlacht – alle Vorlagen der Partie in Scheiben zu ~40 ms bauen und auf die
     Übersetzung der Shader warten (höchstens 12 s Bauen + 6 s Shader, der Rest im Leerlauf); onP(0…1) meldet den Fortschritt */
  preload(onP) {
    return new Promise(res => {
      if (!S.ok) { res(); return; }
      const total = Math.max(1, pending()), t0 = performance.now();
      const tick = () => {
        const end = performance.now() + 40; prebuild(() => end - performance.now()); const left = pending();
        if (onP) try { onP(0.9 * (1 - left / total)); } catch (e) { /* Anzeige optional */ }
        if (left && performance.now() - t0 < 12000) requestAnimationFrame(tick);
        else { warm([S.scene]); warmWait(6000).then(() => { if (onP) try { onP(1); } catch (e) { /* nichts */ } idlePrebuild(); res(); }); }
      };
      requestAnimationFrame(tick);
    });
  },
  setCam(cx, cy, zoom, cssW, cssH, dpr) { setCam(cx, cy, zoom, cssW, cssH, dpr); },
  project(x, y) { return project(x, y); },
  unproject(sx, sy) { return unproject(sx, sy); },
  ring, line, disc,
  ghost(f, role, lv, x, y, ok, slot) { ghost(f, role, lv, x, y, ok, S.view && S.vp >= 0 ? S.view.pcol(S.vp) : undefined, slot); }, /* Fassung 22: slot für Reihen */
  shake,
  event(e, g) {
    if (!S.ok) return;
    /* Kamerawackeln wie in render.js; Effekte bekommen jedes Ereignis */
    if (e.t === 'die' && e.big && !e.quiet) shake(6); else if (e.t === 'bdie') shake(9); else if (e.t === 'strike') shake(16); else if (e.t === 'gateLance') shake(12); else if (e.t === 'superfire' && e.kind !== 'exodus') shake(8); else if (e.t === 'lance') shake(5); else if (e.t === 'breach') shake(7); else if (e.t === 'wake') shake(8);
    try { shipEvent(e); } catch (err) { /* nur Optik */ }
    if (FX.ok && typeof effects.event === 'function') { try { effects.event(e, g, S.view); } catch (err) { console.warn('RA3D: effects.event', err); } }
  },
  frame(g, dt, time, view) {
    if (!S.ok || !g) return;
    S.g = g; S.view = view; S.time = time; S.vp = view.vp;
    if (view.detail !== undefined && view.detail !== S.want) RA3D.setDetail(view.detail);
    const P = PROF, now = () => performance.now(); let t0 = now(), t1;
    adapt(t0);
    updateCamera(dt);
    updateWorld(g, dt, time, view); t1 = now(); P.world = t1 - t0; t0 = t1;
    updateEntities(g, dt, time, view); t1 = now(); P.entities = t1 - t0; t0 = t1;
    if (FX.ok && effects.state) effects.state({ bloom: Q.bloom });
    if (FX.ok) { try { effects.frame(g, dt, time, view, S.camera); FX.err = 0; } catch (err) { console.warn('RA3D: effects.frame', err); if (++FX.err > 3) FX.ok = false; } }
    t1 = now(); P.effects = t1 - t0; t0 = t1;
    flushOverlay(); updateFog(view); t1 = now(); P.overlayFog = t1 - t0; t0 = t1;
    render(); P.render = now() - t0;
    hideGhost();
  },
  dispose() { disposeFog(); disposeWorld(); disposeEntities(); if (FX.ok && typeof effects.clear === 'function') effects.clear(); disposeScene(); },
  /* Messwerte und Zugriff für Tests (nicht Teil der Spec) */
  prof: PROF,
  setGfx(o) { Object.assign(S.gfx, o || {}); gfxApply(); if (FX.ok && typeof effects.setGfx === 'function') effects.setGfx(S.gfx); },
  gfx() { return Object.assign({}, S.gfx); },
  stats() { return Object.assign({ calls: S.info.calls, tris: S.info.tris, detail: S.detail, dist: CAM.dist }, entityStats()); },
  _: { S, CAM, THREE, BUILD, BUILDB, BUILDW, mats, bake, drawCount, effects, E: _E, farGeometry, keepFor, sets: () => _E.sets }
};
window.RA3D = RA3D;
export default RA3D;
