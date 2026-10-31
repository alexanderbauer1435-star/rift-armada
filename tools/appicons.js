/* App-Symbole, Startbilder und Store-Grafiken für die Android-App, gerendert mit Chromium (Vorbild: RTS).
   node tools/appicons.js   → app/android/app/src/main/res/… und store/graphics/…
   Gestaltung: tiefer Weltraum mit Nebel und Sternen, ein Sprungtor als leuchtender Ring (der Riss), durch den ein
   heller Pfeilkreuzer fliegt; vier Punkte in den Farben der spielbaren Fraktionen. Adaptive Symbole halten das
   Motiv im sicheren Kreis (66 %). */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..'), res = path.join(root, 'app/android/app/src/main/res'), store = path.join(root, 'store/graphics');
const C = { bg0: '#16204a', bg1: '#04060d', neb: '#5b2f8f', ring: '#8fe3ff', hot: '#ffb86b', hull: '#eef3fb', hullLo: '#93a5b6', ink: '#e8eef8', facs: ['#4fa3ff', '#ff6a3d', '#f2c14e', '#c9a0ff', '#7ddc6b'] };
let uid = 0;
/* Sterne, fest verteilt */
function stars(W, H, n, seed) {
  let s = seed || 7, out = '';
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, a = 0.25 + r() * 0.7, rr = (0.4 + r() * 1.1) * Math.max(W, H) / 512; out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(2)}" fill="#dfe8ff" fill-opacity="${a.toFixed(2)}"/>`; }
  return out;
}
/* Hintergrund: Verlauf, violetter Nebel, Sterne */
function ground(W, H) {
  const id = 'g' + (uid++), m = Math.max(W, H);
  return `<defs><radialGradient id="${id}" cx="50%" cy="42%" r="78%"><stop offset="0" stop-color="${C.bg0}"/><stop offset="1" stop-color="${C.bg1}"/></radialGradient>
    <radialGradient id="${id}n" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${C.neb}" stop-opacity=".55"/><stop offset="1" stop-color="${C.neb}" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${id})"/>
    <ellipse cx="${W * 0.3}" cy="${H * 0.72}" rx="${m * 0.45}" ry="${m * 0.28}" fill="url(#${id}n)"/>
    <ellipse cx="${W * 0.78}" cy="${H * 0.22}" rx="${m * 0.3}" ry="${m * 0.2}" fill="url(#${id}n)" opacity=".7"/>
    ${stars(W, H, Math.round(60 * W * H / (512 * 512)) + 20, W + H)}`;
}
/* Motiv in einem Feld der Größe 200 × 200 um (0, 0): Ring, Riss, Kreuzer, Fraktionspunkte */
function motif(white) {
  const id = 'm' + (uid++), ring = white ? '#fff' : C.ring, hot = white ? '#fff' : C.hot;
  const ship = 'M0 -54 L11 -16 L13 -4 L30 22 L31 33 L11 25 L7 37 L-7 37 L-11 25 L-31 33 L-30 22 L-13 -4 L-11 -16 Z';
  const ell = (part) => `<path d="${part}" fill="none" stroke="${ring}" stroke-width="9" stroke-linecap="round"/>`;
  /* Ellipse rx 78, ry 30, um -18° gedreht: hintere Hälfte oben, vordere Hälfte unten */
  const back = 'M-78 0 A78 30 0 0 1 78 0', front = 'M78 0 A78 30 0 0 1 -78 0';
  let s = `<defs>
    <radialGradient id="${id}r" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".35" stop-color="${C.ring}" stop-opacity=".75"/><stop offset=".75" stop-color="${C.neb}" stop-opacity=".5"/><stop offset="1" stop-color="${C.neb}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}h" x1="0" y1="-54" x2="0" y2="37" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="${C.hull}"/><stop offset="1" stop-color="${C.hullLo}"/></linearGradient>
    <filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs>`;
  s += `<g transform="rotate(-18)">`;
  if (!white) s += `<ellipse rx="74" ry="26" fill="url(#${id}r)"/><g filter="url(#${id}b)" opacity=".9">${ell(back)}${ell(front)}</g>`;
  s += ell(back) + (white ? '' : `<path d="M-40 -25.5 A78 30 0 0 1 30 -27.6" fill="none" stroke="${hot}" stroke-width="4" stroke-linecap="round"/>`) + `</g>`;
  /* Kreuzer: fliegt von unten links nach oben rechts durch den Ring */
  s += `<g transform="translate(2 2) rotate(32) scale(1.14)">`;
  if (!white) s += `<circle cx="-7" cy="44" r="7" fill="${C.ring}" filter="url(#${id}b)"/><circle cx="7" cy="44" r="7" fill="${C.ring}" filter="url(#${id}b)"/><path d="M-9 37 L0 78 L9 37 Z" fill="${C.ring}" opacity=".55" filter="url(#${id}b)"/>`;
  s += `<path d="${ship}" fill="${white ? '#fff' : `url(#${id}h)`}" stroke="${white ? '#fff' : '#44586c'}" stroke-width="2" stroke-linejoin="round"/>`;
  if (!white) s += `<path d="M0 -40 L5 -12 L0 6 L-5 -12 Z" fill="${C.hot}"/><path d="M-26 27 L-12 21 M26 27 L12 21" stroke="${C.ring}" stroke-width="3" stroke-linecap="round"/>`;
  s += `</g>`;
  s += `<g transform="rotate(-18)">${ell(front)}</g>`;
  /* Fraktionen */
  C.facs.forEach((c, i) => { s += `<circle cx="${-36 + i * 18}" cy="80" r="5.5" fill="${white ? '#fff' : c}"/>`; });
  return s;
}
const mark = (cx, cy, size, white) => `<g transform="translate(${cx} ${cy}) scale(${size / 200})">${motif(white)}</g>`;
/* Schrift des Spiels (Barlow Condensed) für Startbild und Feature-Grafik */
const FONT = fs.readFileSync(path.join(root, 'src/font.css'), 'utf8');
const word = (x, y, size, txt, col, anchor, spacing) => `<text x="${x}" y="${y}" text-anchor="${anchor || 'middle'}" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="600" font-size="${size}" letter-spacing="${spacing === undefined ? size * 0.18 : spacing}" fill="${col}">${txt}</text>`;
const svg = (W, H, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
const ASSETS = [];
const add = (file, W, H, body, transparent) => ASSETS.push({ file, W, H, html: svg(W, H, body), transparent });
/* Launcher-Symbole */
const DPI = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DPI)) {
  const L = 48 * k, F = 108 * k;
  add(`${res}/mipmap-${d}/ic_launcher.png`, L, L, `<clipPath id="c"><rect width="${L}" height="${L}" rx="${L * 0.18}"/></clipPath><g clip-path="url(#c)">${ground(L, L)}${mark(L / 2, L / 2, L * 0.86)}</g>`, true);
  add(`${res}/mipmap-${d}/ic_launcher_round.png`, L, L, `<clipPath id="c"><circle cx="${L / 2}" cy="${L / 2}" r="${L / 2}"/></clipPath><g clip-path="url(#c)">${ground(L, L)}${mark(L / 2, L / 2, L * 0.8)}</g>`, true);
  add(`${res}/mipmap-${d}/ic_launcher_foreground.png`, F, F, mark(F / 2, F / 2, F * 0.62), true);
  add(`${res}/mipmap-${d}/ic_launcher_monochrome.png`, F, F, mark(F / 2, F / 2, F * 0.62, true), true);
}
/* Startbilder (ältere Android-Fassungen; ab Android 12 zeigt das System das Symbol auf der Grundfarbe) */
const splash = (w, h) => { const m = Math.min(w, h); return ground(w, h) + mark(w / 2, h / 2 - m * 0.08, m * 0.62) + word(w / 2, h / 2 + m * 0.36, m * 0.085, 'RIFT ARMADA', C.ink); };
const SPL = { mdpi: [480, 320], hdpi: [800, 480], xhdpi: [1280, 720], xxhdpi: [1600, 960], xxxhdpi: [1920, 1280] };
for (const [d, [w, h]] of Object.entries(SPL)) {
  add(`${res}/drawable-land-${d}/splash.jpg`, w, h, splash(w, h));
  add(`${res}/drawable-port-${d}/splash.jpg`, h, w, splash(h, w));
}
add(`${res}/drawable/splash.jpg`, 480, 320, splash(480, 320));
/* Store: Symbol 512 (vollflächig, Google rundet selbst) und Feature-Grafik 1024 × 500 */
add(`${store}/icon-512.png`, 512, 512, ground(512, 512) + mark(256, 256, 440));
/* lange Untertitel (fr, es, pl …) auf zwei Zeilen: erster Teil, dann der Rest */
const feature = sub => { const parts = sub.split(' · '), two = sub.length > 46, l1 = two ? parts[0] : sub, l2 = two ? parts.slice(1).join(' · ') : '';
  return ground(1024, 500) + mark(250, 250, 380) + word(470, 220, 76, 'RIFT ARMADA', C.ink, 'start', 12) +
  word(474, 268, 28, l1, '#a9b8d6', 'start', 1) + (two ? word(474, 304, 28, l2, '#a9b8d6', 'start', 1) : '') + `<rect x="474" y="${two ? 332 : 296}" width="320" height="3" fill="${C.hot}"/>`; };
add(`${store}/feature-1024x500.png`, 1024, 500, feature('Weltraum-Echtzeitstrategie · fünf Fraktionen · offline'));
add(`${store}/feature-1024x500-en.png`, 1024, 500, feature('Space real-time strategy · five factions · offline'));
for (const [lg, sub] of [['fr', 'Stratégie spatiale en temps réel · cinq factions · hors ligne'], ['es', 'Estrategia espacial en tiempo real · cinco facciones · sin conexión'], ['it', 'Strategia spaziale in tempo reale · cinque fazioni · offline'], ['pt', 'Estratégia espacial em tempo real · cinco facções · offline'], ['pl', 'Kosmiczna strategia czasu rzeczywistego · pięć frakcji · offline']])
  add(`${store}/feature-1024x500-${lg}.png`, 1024, 500, feature(sub));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage();
  for (const a of ASSETS) {
    fs.mkdirSync(path.dirname(a.file), { recursive: true });
    await p.setViewportSize({ width: a.W, height: a.H });
    await p.setContent(`<html><head><style>${FONT}</style></head><body style="margin:0;background:transparent">${a.html}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    /* Startbilder als JPEG (Verläufe und Sterne machen PNG groß), alles andere als PNG */
    const jpg = a.file.endsWith('.jpg');
    await p.screenshot(Object.assign({ path: a.file, clip: { x: 0, y: 0, width: a.W, height: a.H } }, jpg ? { type: 'jpeg', quality: 88 } : { omitBackground: !!a.transparent }));
  }
  await b.close();
  console.log(ASSETS.length + ' Bilder');
})();
