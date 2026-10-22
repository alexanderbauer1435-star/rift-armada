/* ===== portrait.js ===== */
'use strict';
/* =====================================================================
   PORTRÄTS – Funkbilder der Kampagnenfiguren, ganz aus Formen gezeichnet (keine Bilddateien). Gezeichnet wird auf
   einer Fläche von 100×100, die auf die Größe der Leinwand skaliert wird. t (Sekunden) bewegt Augen, Halos, Kristalle,
   Rauschen. Menschen: Kopf, Haar, Uniform je Fraktion; Legion: goldene Masken; Nexus: Kristallgesichter;
   die Stimme: ein Auge im Fleisch; das Echo: Hologramm eines Erbauers.
   ===================================================================== */
const PORTRAIT = {
  voss: { k: 'human', skin: '#e0b592', hair: '#2b2128', style: 'bun', uni: '#24456e', trim: '#e2c06a', collar: 'mil', brow: 'stern', eye: '#4b7396' },
  vossY: { k: 'human', skin: '#e9c4a4', hair: '#2b2128', style: 'short', uni: '#e8dcbb', trim: '#8e5bd6', collar: 'legion', brow: 'calm', eye: '#4b7396', young: 1 },
  dal: { k: 'human', skin: '#d6a989', hair: '#b4b4ba', style: 'bald', beard: '#a4a4aa', uni: '#27354b', trim: '#c9d3df', collar: 'council', brow: 'stern', eye: '#55606b', old: 1 },
  kessler: { k: 'human', skin: '#c8906f', hair: '#b4432a', style: 'crop', uni: '#4b2a24', trim: '#ff7a4a', collar: 'armor', brow: 'stern', eye: '#5a3a2a', cyber: 1, scar: 'brow' },
  bricks: { k: 'human', skin: '#6a4531', hair: '#1c1412', style: 'helmet', uni: '#4d535c', trim: '#ff7a4a', collar: 'armor', brow: 'calm', eye: '#2a1a12', wide: 1, grin: 1 },
  vex: { k: 'human', skin: '#d1a083', hair: '#151018', style: 'long', uni: '#6a1620', trim: '#d6a640', collar: 'coat', brow: 'sly', eye: '#3f6a45', patch: 1, scar: 'cheek', ring: 1, grin: 1 },
  marr: { k: 'human', skin: '#c08867', hair: '#d9d3cc', style: 'bun', uni: '#2b4a70', trim: '#e2c06a', collar: 'council', brow: 'calm', eye: '#5a4636' },
  hale: { k: 'human', skin: '#dcb08e', hair: '#77777d', style: 'short', uni: '#1d3858', trim: '#e2c06a', collar: 'mil', brow: 'stern', eye: '#4f6377', scar: 'cheek', old: 1 },
  kesslerA: { k: 'human', skin: '#c8906f', hair: '#b4432a', style: 'crop', uni: '#4b2a24', trim: '#ff7a4a', collar: 'armor', brow: 'stern', eye: '#5a3a2a', cyber: 1, scar: 'brow' },
  calder: { k: 'human', skin: '#d9ae8e', hair: '#3a2a1e', style: 'short', uni: '#1f3550', trim: '#9fb0c3', collar: 'mil', brow: 'sly', eye: '#4b6a8a', scar: 'brow', grin: 1 },
  tarn: { k: 'human', skin: '#b7805f', hair: '#231814', style: 'crop', uni: '#3d2420', trim: '#ff7a4a', collar: 'armor', brow: 'stern', eye: '#3a2a1a', scar: 'cheek' },
  varo: { k: 'mask', gold: '#7a6230', eye: '#ff5b47', crest: 1, dim: 1 },
  nullf: { k: 'crystal', col: '#6c5aa0', eyes: '#ff5b47' },
  seraph: { k: 'mask', gold: '#f2c14e', eye: '#efe0ff', halo: 1 },
  cassius: { k: 'mask', gold: '#ecd9a2', eye: '#c6ecff', crest: 1, small: 1 },
  emperor: { k: 'mask', gold: '#a8823a', eye: '#c9a0ff', crown: 1, dim: 1 },
  facet: { k: 'crystal', col: '#c9a0ff' },
  node: { k: 'crystal', col: '#a7b8ff', broken: 1 },
  voice: { k: 'voice' },
  echo: { k: 'echo' },
  hq: { k: 'hq' },
  foe: { k: 'foe' }
};
function prgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function phex(r) { return '#' + r.map(v => ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2)).join(''); }
/* k > 0 heller, k < 0 dunkler */
function pshade(h, k) { const c = prgb(h); return phex(c.map(v => k >= 0 ? v + (255 - v) * k : v * (1 + k))); }
function pmix(a, b, k) { const x = prgb(a), y = prgb(b); return phex(x.map((v, i) => v + (y[i] - v) * k)); }
function prgba(h, a) { const c = prgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
/* kleine Zufallsfolge fürs Rauschen, an die Zeit gebunden (nicht die Simulation) */
function prand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

function drawPortrait(cv, who, t) {
  if (!cv) return;
  const c = cv.getContext('2d'), s = cv.width / 100, P = PORTRAIT[who] || PORTRAIT.hq, ch = CHARS[who] || CHARS.hq;
  const F = FACTIONS[ch.f], tint = F ? F.team : P.k === 'foe' ? '#ff5b47' : '#8fe3ff';
  t = t || 0;
  c.setTransform(s, 0, 0, s, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.lineCap = 'round'; c.lineJoin = 'round';
  const bg = c.createRadialGradient(50, 38, 4, 50, 52, 78);
  bg.addColorStop(0, pmix(tint, '#0a1020', 0.62)); bg.addColorStop(0.55, pmix(tint, '#060912', 0.86)); bg.addColorStop(1, '#020309');
  c.fillStyle = bg; c.fillRect(0, 0, 100, 100);
  /* Gitter der Brückenkonsole hinter der Figur */
  c.strokeStyle = prgba(tint, 0.08); c.lineWidth = 0.5;
  c.beginPath(); for (let x = 10; x < 100; x += 10) { c.moveTo(x, 0); c.lineTo(x, 100); } for (let y = 10; y < 100; y += 10) { c.moveTo(0, y); c.lineTo(100, y); } c.stroke();
  c.save();
  if (P.k === 'human') pHuman(c, P, t);
  else if (P.k === 'mask') pMask(c, P, t);
  else if (P.k === 'crystal') pCrystal(c, P, t);
  else if (P.k === 'voice') pVoice(c, t);
  else if (P.k === 'echo') pEcho(c, t);
  else if (P.k === 'foe') pFoe(c, t);
  else pHq(c, t, tint);
  c.restore();
  c.setTransform(s, 0, 0, s, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
  /* Funkbild: Zeilen, wandernder Lichtbalken, Vignette, Eckwinkel */
  c.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < 100; y += 2.4) c.fillRect(0, y, 100, 0.7);
  const by = (t * 24) % 140 - 20, gb = c.createLinearGradient(0, by - 9, 0, by + 9);
  gb.addColorStop(0, 'rgba(210,240,255,0)'); gb.addColorStop(0.5, 'rgba(210,240,255,0.07)'); gb.addColorStop(1, 'rgba(210,240,255,0)');
  c.fillStyle = gb; c.fillRect(0, by - 9, 100, 18);
  const vg = c.createRadialGradient(50, 48, 34, 50, 50, 74); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)');
  c.fillStyle = vg; c.fillRect(0, 0, 100, 100);
  c.strokeStyle = prgba(tint, 0.85); c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(3, 13); c.lineTo(3, 3); c.lineTo(13, 3); c.moveTo(87, 3); c.lineTo(97, 3); c.lineTo(97, 13);
  c.moveTo(97, 87); c.lineTo(97, 97); c.lineTo(87, 97); c.moveTo(13, 97); c.lineTo(3, 97); c.lineTo(3, 87);
  c.stroke();
  /* Sendelampe */
  c.fillStyle = (t % 1.4) < 0.9 ? prgba(tint, 0.95) : prgba(tint, 0.3); c.beginPath(); c.arc(92, 8, 1.6, 0, TAU); c.fill();
}

/* ------------------------------------------------------------------ Menschen */
function pHeadPath(c) {
  c.beginPath();
  c.moveTo(50, 20.5);
  c.bezierCurveTo(60.5, 20.5, 67, 28, 66.5, 38.5);
  c.bezierCurveTo(66.5, 48.5, 64, 55.5, 59, 60.5);
  c.bezierCurveTo(56, 63.5, 53, 65, 50, 65);
  c.bezierCurveTo(47, 65, 44, 63.5, 41, 60.5);
  c.bezierCurveTo(36, 55.5, 33.5, 48.5, 33.5, 38.5);
  c.bezierCurveTo(33, 28, 39.5, 20.5, 50, 20.5);
  c.closePath();
}
function pHuman(c, P, t) {
  const skin = P.skin, dark = pshade(skin, -0.32), W = P.wide ? 1.1 : 1;
  c.translate(50, 100); c.scale(1.1, 1.1); c.translate(-50, -100);
  /* langes Haar hinter Kopf und Schultern */
  if (P.style === 'long') {
    c.fillStyle = P.hair; c.beginPath(); c.moveTo(33, 30); c.bezierCurveTo(24, 46, 26, 70, 22, 84); c.lineTo(78, 84); c.bezierCurveTo(74, 70, 76, 46, 67, 30); c.closePath(); c.fill();
  }
  /* Schultern und Uniform */
  pBody(c, P);
  /* Hals */
  const ng = c.createLinearGradient(0, 56, 0, 74); ng.addColorStop(0, pshade(skin, -0.35)); ng.addColorStop(1, pshade(skin, -0.15));
  c.fillStyle = ng; c.beginPath(); c.moveTo(42.5, 55); c.lineTo(57.5, 55); c.lineTo(58.5, 71); c.quadraticCurveTo(50, 75, 41.5, 71); c.closePath(); c.fill();
  pCollar(c, P);
  if (P.style === 'bun') { c.fillStyle = P.hair; c.beginPath(); c.arc(50, 19, 7.2, 0, TAU); c.fill(); c.strokeStyle = pshade(P.hair, 0.25); c.lineWidth = 0.7; c.beginPath(); c.arc(50, 19, 4.6, 0.4, 2.6); c.stroke(); }
  c.save(); c.translate(50, 0); c.scale(W, 1); c.translate(-50, 0);
  /* Ohren */
  c.fillStyle = pshade(skin, -0.12);
  c.beginPath(); c.ellipse(33.6, 44, 2.7, 4.9, 0.1, 0, TAU); c.fill(); c.beginPath(); c.ellipse(66.4, 44, 2.7, 4.9, -0.1, 0, TAU); c.fill();
  if (P.ring) { c.fillStyle = '#e8c060'; c.beginPath(); c.arc(33.2, 49.6, 1.3, 0, TAU); c.fill(); }
  /* Kopf mit Licht von links oben */
  const hg = c.createRadialGradient(44, 34, 3, 50, 44, 26);
  hg.addColorStop(0, pshade(skin, 0.14)); hg.addColorStop(0.65, skin); hg.addColorStop(1, pshade(skin, -0.28));
  c.fillStyle = hg; pHeadPath(c); c.fill();
  /* Wangen- und Kieferschatten rechts */
  c.save(); pHeadPath(c); c.clip();
  const sg = c.createLinearGradient(44, 0, 68, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = sg; c.fillRect(30, 18, 40, 50);
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(50, 66, 14, 5, 0, 0, TAU); c.fill();
  if (P.old) { c.strokeStyle = prgba(dark, 0.55); c.lineWidth = 0.55; c.beginPath(); c.moveTo(42, 30.5); c.quadraticCurveTo(50, 29, 58, 30.5); c.moveTo(43, 33); c.quadraticCurveTo(50, 31.8, 57, 33); c.moveTo(37.8, 44.5); c.lineTo(36.6, 46); c.moveTo(62.2, 44.5); c.lineTo(63.4, 46); c.moveTo(45, 50.5); c.quadraticCurveTo(43.5, 54, 44, 57); c.moveTo(55, 50.5); c.quadraticCurveTo(56.5, 54, 56, 57); c.stroke(); }
  c.restore();
  /* Bart (unter dem Gesicht, über der Haut) */
  if (P.beard) {
    c.fillStyle = P.beard;
    c.beginPath(); c.moveTo(35, 47); c.bezierCurveTo(36, 55, 40, 62, 50, 67.5); c.bezierCurveTo(60, 62, 64, 55, 65, 47); c.bezierCurveTo(62, 52, 58, 55, 56, 55.5); c.quadraticCurveTo(50, 53.2, 44, 55.5); c.bezierCurveTo(42, 55, 38, 52, 35, 47); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(44, 54.2); c.quadraticCurveTo(50, 51.2, 56, 54.2); c.quadraticCurveTo(50, 53, 44, 54.2); c.fill();
    c.strokeStyle = pshade(P.beard, -0.2); c.lineWidth = 0.4; for (let i = 0; i < 7; i++) { const x = 40 + i * 3.4; c.beginPath(); c.moveTo(x, 57 + Math.abs(i - 3) * -0.8); c.lineTo(x + 0.4, 61 - Math.abs(i - 3) * 0.9); c.stroke(); }
  }
  pFace(c, P, t);
  pHair(c, P, t);
  c.restore();
}
function pBody(c, P) {
  const u = P.uni, g = c.createLinearGradient(0, 66, 0, 100); g.addColorStop(0, pshade(u, 0.22)); g.addColorStop(1, pshade(u, -0.4));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(2, 100); c.bezierCurveTo(4, 82, 22, 72.5, 38, 69.5); c.lineTo(62, 69.5); c.bezierCurveTo(78, 72.5, 96, 82, 98, 100); c.closePath(); c.fill();
  /* Falten und Nähte */
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(28, 82); c.quadraticCurveTo(30, 92, 29, 100); c.moveTo(72, 82); c.quadraticCurveTo(70, 92, 71, 100); c.stroke();
  if (P.collar === 'armor') {
    /* Schulterplatten der Republik mit Warnstreifen */
    for (const sx of [-1, 1]) {
      c.save(); c.translate(50 + sx * 31, 81); c.scale(sx, 1);
      const pg = c.createLinearGradient(-12, -8, 12, 10); pg.addColorStop(0, pshade(u, 0.35)); pg.addColorStop(1, pshade(u, -0.3));
      c.fillStyle = pg; c.beginPath(); c.moveTo(-13, 4); c.quadraticCurveTo(-12, -8, 2, -10); c.quadraticCurveTo(14, -9, 18, 3); c.lineTo(15, 11); c.quadraticCurveTo(0, 7, -13, 4); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.8; c.stroke();
      c.fillStyle = P.trim; c.beginPath(); c.moveTo(-6, -6.6); c.lineTo(10, -6.5); c.lineTo(11.5, -4.2); c.lineTo(-7.5, -4.3); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(4, 1, 1.2, 0, TAU); c.fill();
      c.restore();
    }
  } else if (P.collar === 'mil') {
    /* Alliance: Schulterstücke mit Goldkante, Ordensspange */
    for (const sx of [-1, 1]) { c.save(); c.translate(50 + sx * 27, 76); c.rotate(sx * 0.32); c.fillStyle = pshade(u, -0.2); c.fillRect(-8, -2.4, 16, 4.8); c.fillStyle = P.trim; c.fillRect(-8, -2.4, 16, 1.1); c.fillRect(-8, 1.3, 16, 1.1); c.restore(); }
    const cols = ['#c23e2a', '#e2c06a', '#5fb8ff', '#ffffff'];
    cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(30 + i * 3.1, 86, 2.8, 2.2); });
    c.fillStyle = P.trim; c.beginPath(); c.arc(70, 88, 2.2, 0, TAU); c.fill();
  } else if (P.collar === 'legion') {
    /* imperiale Uniform: Goldborte, violette Schärpe */
    c.strokeStyle = P.trim; c.lineWidth = 3.2; c.beginPath(); c.moveTo(34, 72); c.lineTo(64, 100); c.stroke();
    c.strokeStyle = '#d4af37'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(10, 90); c.quadraticCurveTo(24, 76, 38, 71); c.moveTo(90, 90); c.quadraticCurveTo(76, 76, 62, 71); c.stroke();
  } else if (P.collar === 'council') {
    /* Ratsrobe: Amtskette */
    c.strokeStyle = P.trim; c.lineWidth = 1.1; c.beginPath(); c.moveTo(36, 72); c.quadraticCurveTo(50, 92, 64, 72); c.stroke();
    for (let i = 0; i < 7; i++) { const k = i / 6, x = (1 - k) * (1 - k) * 36 + 2 * (1 - k) * k * 50 + k * k * 64, y = (1 - k) * (1 - k) * 72 + 2 * (1 - k) * k * 92 + k * k * 72; c.fillStyle = P.trim; c.beginPath(); c.arc(x, y, 1, 0, TAU); c.fill(); }
    c.fillStyle = P.trim; c.beginPath(); c.arc(50, 82.5, 3, 0, TAU); c.fill(); c.fillStyle = '#5fb8ff'; c.beginPath(); c.arc(50, 82.5, 1.6, 0, TAU); c.fill();
  } else if (P.collar === 'coat') {
    /* Piratenmantel: Hemd im V, Goldkette */
    c.fillStyle = '#1a1418'; c.beginPath(); c.moveTo(40, 70); c.lineTo(50, 92); c.lineTo(60, 70); c.closePath(); c.fill();
    c.strokeStyle = P.trim; c.lineWidth = 0.9; c.beginPath(); c.moveTo(42, 73); c.quadraticCurveTo(50, 86, 58, 73); c.stroke();
    c.strokeStyle = pshade(P.trim, -0.1); c.lineWidth = 1.2; c.beginPath(); c.moveTo(38, 70); c.lineTo(48, 98); c.moveTo(62, 70); c.lineTo(52, 98); c.stroke();
  }
}
function pCollar(c, P) {
  const u = P.uni;
  if (P.collar === 'mil') {
    c.fillStyle = pshade(u, -0.12); c.beginPath(); c.moveTo(40.5, 64); c.lineTo(42, 72.5); c.lineTo(50, 76); c.lineTo(58, 72.5); c.lineTo(59.5, 64); c.lineTo(57.5, 68.5); c.lineTo(50, 71); c.lineTo(42.5, 68.5); c.closePath(); c.fill();
    c.strokeStyle = P.trim; c.lineWidth = 0.8; c.beginPath(); c.moveTo(40.5, 64); c.lineTo(42, 72.5); c.lineTo(50, 76); c.lineTo(58, 72.5); c.lineTo(59.5, 64); c.stroke();
    c.fillStyle = P.trim; c.fillRect(43.2, 69.5, 2.2, 2.2); c.fillRect(54.6, 69.5, 2.2, 2.2);
  } else if (P.collar === 'legion' || P.collar === 'council') {
    const col = P.collar === 'legion' ? '#f4ead0' : pshade(u, 0.1);
    c.fillStyle = col; c.beginPath(); c.moveTo(39, 60); c.lineTo(41, 73); c.quadraticCurveTo(50, 77, 59, 73); c.lineTo(61, 60); c.lineTo(57.5, 66); c.quadraticCurveTo(50, 69, 42.5, 66); c.closePath(); c.fill();
    c.strokeStyle = P.collar === 'legion' ? '#d4af37' : P.trim; c.lineWidth = 0.9; c.beginPath(); c.moveTo(39, 60); c.lineTo(41, 73); c.quadraticCurveTo(50, 77, 59, 73); c.lineTo(61, 60); c.stroke();
    if (P.collar === 'legion') { c.fillStyle = '#8e5bd6'; c.beginPath(); c.moveTo(50, 70.5); c.lineTo(52, 73); c.lineTo(50, 75.5); c.lineTo(48, 73); c.closePath(); c.fill(); }
  } else if (P.collar === 'armor') {
    /* Halsschutz in Segmenten */
    for (let i = 0; i < 3; i++) { const y = 66 + i * 3.2, w = 9.5 + i * 1.6; c.fillStyle = pshade(u, 0.15 - i * 0.12); c.beginPath(); c.moveTo(50 - w, y); c.quadraticCurveTo(50, y + 3.4, 50 + w, y); c.lineTo(50 + w, y + 2.8); c.quadraticCurveTo(50, y + 6.2, 50 - w, y + 2.8); c.closePath(); c.fill(); }
    c.fillStyle = P.trim; c.fillRect(48.6, 72.2, 2.8, 1.4);
  } else if (P.collar === 'coat') {
    c.fillStyle = pshade(u, 0.12);
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(50 + sx * 7, 69); c.lineTo(50 + sx * 15, 52); c.lineTo(50 + sx * 19, 58); c.lineTo(50 + sx * 14, 76); c.closePath(); c.fill(); c.strokeStyle = P.trim; c.lineWidth = 0.8; c.stroke(); }
  }
}
function pFace(c, P, t) {
  const skin = P.skin, dark = pshade(skin, -0.42), blink = ((t + (P.young ? 1.3 : 0)) % 4.6) < 0.13, look = Math.sin(t * 0.37) * 0.55;
  /* Augen */
  for (const sx of [-1, 1]) {
    const ex = 50 + sx * 7, ey = 43;
    if (P.patch && sx < 0) continue;
    if (P.cyber && sx > 0) continue;
    c.fillStyle = 'rgba(0,0,0,0.13)'; c.beginPath(); c.ellipse(ex, ey - 0.5, 4.6, 2.9, 0, 0, TAU); c.fill();
    if (blink) { c.strokeStyle = dark; c.lineWidth = 0.8; c.beginPath(); c.moveTo(ex - 3.3, ey); c.quadraticCurveTo(ex, ey + 0.9, ex + 3.3, ey); c.stroke(); continue; }
    c.fillStyle = '#f2ece6'; c.beginPath(); c.moveTo(ex - 3.4, ey); c.quadraticCurveTo(ex, ey - 2.4, ex + 3.4, ey); c.quadraticCurveTo(ex, ey + 1.7, ex - 3.4, ey); c.fill();
    c.save(); c.clip();
    c.fillStyle = P.eye; c.beginPath(); c.arc(ex + look, ey - 0.2, 1.55, 0, TAU); c.fill();
    c.fillStyle = '#0c0a0c'; c.beginPath(); c.arc(ex + look, ey - 0.2, 0.75, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(ex + look - 0.5, ey - 0.8, 0.38, 0, TAU); c.fill();
    c.restore();
    c.strokeStyle = dark; c.lineWidth = 0.75; c.beginPath(); c.moveTo(ex - 3.5, ey + 0.1); c.quadraticCurveTo(ex, ey - 2.6, ex + 3.5, ey + 0.1); c.stroke();
  }
  /* Augenbrauen */
  const bc = P.style === 'bald' ? P.beard || P.hair : P.hair;
  c.strokeStyle = pshade(bc, P.style === 'bald' ? -0.05 : 0.05); c.lineWidth = P.wide ? 1.6 : 1.25;
  for (const sx of [-1, 1]) {
    const ox = 50 + sx * 10.8, ix = 50 + sx * 3.4;
    let oy = 38.6, iy = 39.4;
    if (P.brow === 'stern') { oy = 37.9; iy = 40.1; }
    if (P.brow === 'sly' && sx > 0) { oy = 36.6; iy = 38.4; }
    c.beginPath(); c.moveTo(ix, iy); c.quadraticCurveTo((ix + ox) / 2, Math.min(iy, oy) - 1.1, ox, oy); c.stroke();
  }
  /* Nase */
  c.strokeStyle = prgba(dark, 0.75); c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(48.7, 43); c.quadraticCurveTo(47.6, 48.5, 47.4, 50.4); c.quadraticCurveTo(48.6, 52, 50.2, 51.6); c.stroke();
  c.fillStyle = 'rgba(0,0,0,0.14)'; c.beginPath(); c.ellipse(51.6, 49.5, 1.8, 2.6, 0.2, 0, TAU); c.fill();
  c.fillStyle = prgba(dark, 0.5); c.beginPath(); c.arc(47.8, 51, 0.55, 0, TAU); c.arc(52.2, 51, 0.55, 0, TAU); c.fill();
  /* Mund */
  {
    const lip = pmix(skin, '#8a3a3a', 0.35);
    c.strokeStyle = pshade(lip, -0.25); c.lineWidth = 0.9;
    c.beginPath();
    if (P.grin) { c.moveTo(45, 56); c.quadraticCurveTo(50, 57.8, 55.4, 55); }
    else if (P.brow === 'stern') { c.moveTo(45.2, 56.3); c.quadraticCurveTo(50, 56.4, 54.8, 56.3); }
    else { c.moveTo(45.4, 56); c.quadraticCurveTo(50, 57.2, 54.6, 56); }
    c.stroke();
    c.fillStyle = prgba(lip, 0.55); c.beginPath(); c.moveTo(46.5, 56.6); c.quadraticCurveTo(50, 59.3, 53.5, 56.6); c.quadraticCurveTo(50, 57.6, 46.5, 56.6); c.fill();
  }
  /* Narben, Augenklappe, Kybernetik */
  if (P.scar === 'cheek') { c.strokeStyle = 'rgba(255,190,190,0.55)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(57.5, 46.5); c.lineTo(61.5, 55.5); c.moveTo(58.3, 49.2); c.lineTo(60, 48.6); c.moveTo(59.6, 52.2); c.lineTo(61.2, 51.6); c.stroke(); }
  if (P.scar === 'brow') { c.strokeStyle = 'rgba(255,200,190,0.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(40.5, 34.5); c.lineTo(44.5, 45.5); c.stroke(); }
  if (P.patch) {
    c.strokeStyle = '#0d0a0d'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(38.6, 40.8); c.lineTo(33.4, 36.6); c.moveTo(47.6, 40.4); c.lineTo(65.8, 31.5); c.stroke();
    c.fillStyle = '#0d0a0d'; c.beginPath(); c.ellipse(43, 42.8, 4.6, 3.6, -0.08, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(214,166,64,0.6)'; c.lineWidth = 0.5; c.beginPath(); c.ellipse(43, 42.8, 3.4, 2.5, -0.08, 0, TAU); c.stroke();
  }
  if (P.cyber) {
    const ex = 57, ey = 43;
    c.fillStyle = '#4a5260'; c.beginPath(); c.moveTo(52.5, 38.5); c.lineTo(62.5, 37.6); c.lineTo(65.6, 41); c.lineTo(63.6, 47.6); c.lineTo(53.4, 47.4); c.closePath(); c.fill();
    c.strokeStyle = '#8b94a3'; c.lineWidth = 0.5; c.stroke();
    c.strokeStyle = '#2b3038'; c.beginPath(); c.moveTo(62.5, 37.6); c.lineTo(66.3, 34.5); c.moveTo(65.6, 41); c.lineTo(66.6, 41.2); c.stroke();
    const pulse = 0.7 + 0.3 * Math.sin(t * 3.1);
    c.shadowColor = '#ff7a4a'; c.shadowBlur = 6 * pulse;
    c.fillStyle = '#1b0d08'; c.beginPath(); c.arc(ex, ey, 2.6, 0, TAU); c.fill();
    c.fillStyle = prgba('#ff8a50', 0.6 + 0.4 * pulse); c.beginPath(); c.arc(ex + look * 0.4, ey, 1.4, 0, TAU); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#ffe2c0'; c.beginPath(); c.arc(ex + look * 0.4 - 0.4, ey - 0.4, 0.35, 0, TAU); c.fill();
  }
}
function pHair(c, P, t) {
  const h = P.hair, hl = pshade(h, 0.28);
  c.fillStyle = h;
  switch (P.style) {
    case 'bun':
      c.beginPath(); c.moveTo(33.3, 41); c.bezierCurveTo(31.5, 26, 40, 17.5, 50, 17.6); c.bezierCurveTo(60, 17.5, 68.5, 26, 66.7, 41);
      c.bezierCurveTo(65.5, 33, 61, 27.5, 52, 27.8); c.quadraticCurveTo(49.5, 26.5, 47.5, 28); c.bezierCurveTo(40, 28, 35, 33, 33.3, 41); c.closePath(); c.fill();
      c.strokeStyle = prgba(hl, 0.6); c.lineWidth = 0.6; c.beginPath(); c.moveTo(38, 27); c.quadraticCurveTo(45, 21, 50, 20.5); c.moveTo(56, 22); c.quadraticCurveTo(62, 25, 64.5, 32); c.stroke();
      break;
    case 'short':
      c.beginPath(); c.moveTo(33.4, 43); c.bezierCurveTo(31.6, 25, 40.5, 17.2, 50.5, 17.4); c.bezierCurveTo(61, 17.5, 68.6, 26, 66.6, 42);
      c.bezierCurveTo(65.5, 35, 63.5, 31, 60, 29.5); c.bezierCurveTo(53, 31.5, 45, 31, 41, 27.6); c.bezierCurveTo(38.5, 31, 36, 35, 33.4, 43); c.closePath(); c.fill();
      c.strokeStyle = prgba(hl, 0.55); c.lineWidth = 0.6; c.beginPath(); c.moveTo(41, 27.6); c.quadraticCurveTo(46, 20, 54, 19.4); c.moveTo(45, 29.5); c.quadraticCurveTo(52, 26, 59, 28.6); c.stroke();
      break;
    case 'crop':
      /* rasierte Seiten, oben kurz und zur Seite gestrichen */
      c.fillStyle = prgba(pshade(h, -0.35), 0.55); c.beginPath(); c.moveTo(34, 41); c.bezierCurveTo(33.4, 33, 35, 28, 38, 25.5); c.lineTo(39.5, 34); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(66, 41); c.bezierCurveTo(66.6, 33, 65, 28, 62, 25.5); c.lineTo(60.5, 34); c.closePath(); c.fill();
      c.fillStyle = h; c.beginPath(); c.moveTo(37.5, 31); c.bezierCurveTo(37, 20, 46, 15, 54, 16); c.bezierCurveTo(61, 16.8, 66.5, 21, 64.5, 30.5); c.bezierCurveTo(60, 27.5, 52, 28.5, 47, 26.4); c.bezierCurveTo(43, 27.8, 40, 29, 37.5, 31); c.closePath(); c.fill();
      c.strokeStyle = prgba(hl, 0.65); c.lineWidth = 0.7; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(41 + i * 4.2, 26 - i * 0.2); c.quadraticCurveTo(46 + i * 4, 19, 55 + i * 2.5, 18 + i * 0.6); } c.stroke();
      break;
    case 'helmet': {
      const hc = '#5d646e';
      const hg = c.createLinearGradient(30, 14, 70, 40); hg.addColorStop(0, pshade(hc, 0.35)); hg.addColorStop(1, pshade(hc, -0.35));
      c.fillStyle = hg; c.beginPath(); c.moveTo(31.5, 47); c.bezierCurveTo(29, 24, 39, 13.5, 50, 13.5); c.bezierCurveTo(61, 13.5, 71, 24, 68.5, 47); c.lineTo(65.6, 47); c.bezierCurveTo(65.5, 37, 63, 33, 59, 32.5); c.lineTo(41, 32.5); c.bezierCurveTo(37, 33, 34.5, 37, 34.4, 47); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.7; c.stroke();
      /* hochgeklapptes Visier */
      const vg = c.createLinearGradient(0, 24, 0, 32); vg.addColorStop(0, 'rgba(255,160,90,0.65)'); vg.addColorStop(1, 'rgba(120,40,20,0.85)');
      c.fillStyle = vg; c.beginPath(); c.moveTo(37, 31.6); c.quadraticCurveTo(50, 22.5, 63, 31.6); c.lineTo(62, 26.5); c.quadraticCurveTo(50, 18.5, 38, 26.5); c.closePath(); c.fill();
      c.fillStyle = P.trim; c.fillRect(48.8, 14.2, 2.4, 9);
      c.strokeStyle = '#2d3138'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(35, 47); c.quadraticCurveTo(38, 60, 46, 64.5); c.moveTo(65, 47); c.quadraticCurveTo(62, 60, 54, 64.5); c.stroke();
      break;
    }
    case 'long':
      c.beginPath(); c.moveTo(32.5, 52); c.bezierCurveTo(30, 28, 39, 17.6, 50, 17.6); c.bezierCurveTo(61, 17.6, 70, 28, 67.5, 52);
      c.bezierCurveTo(65.5, 41, 63, 33, 56, 28.6); c.quadraticCurveTo(52, 25.4, 50, 22.6); c.quadraticCurveTo(48, 25.4, 44, 28.6); c.bezierCurveTo(37, 33, 34.5, 41, 32.5, 52); c.closePath(); c.fill();
      c.strokeStyle = prgba(hl, 0.5); c.lineWidth = 0.6; c.beginPath(); c.moveTo(48.8, 22); c.quadraticCurveTo(40, 26, 36, 42); c.moveTo(51.2, 22); c.quadraticCurveTo(60, 26, 64, 42); c.stroke();
      break;
    case 'bald':
      c.fillStyle = h;
      for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(50 + sx * 16.6, 46); c.bezierCurveTo(50 + sx * 17.6, 38, 50 + sx * 16.8, 33, 50 + sx * 13.6, 28.6); c.lineTo(50 + sx * 12.8, 33); c.bezierCurveTo(50 + sx * 14.8, 36, 50 + sx * 15.4, 40, 50 + sx * 15.4, 46); c.closePath(); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.ellipse(45.5, 26.5, 6, 2.6, -0.35, 0, TAU); c.fill();
      break;
  }
}

/* ------------------------------------------------------------------ Golden Legion: Masken */
function pMaskPath(c, sc) {
  c.beginPath();
  c.moveTo(50, 16 * sc + 50 * (1 - sc));
  const P = (x, y) => [50 + (x - 50) * sc, 46 + (y - 46) * sc];
  let a = P(62, 17), b = P(67.5, 28), d = P(67, 40); c.bezierCurveTo(a[0], a[1], b[0], b[1], d[0], d[1]);
  a = P(66.5, 52); b = P(61, 64); d = P(50, 72); c.bezierCurveTo(a[0], a[1], b[0], b[1], d[0], d[1]);
  a = P(39, 64); b = P(33.5, 52); d = P(33, 40); c.bezierCurveTo(a[0], a[1], b[0], b[1], d[0], d[1]);
  a = P(32.5, 28); b = P(38, 17); d = P(50, 16); c.bezierCurveTo(a[0], a[1], b[0], b[1], d[0], d[1]);
  c.closePath();
}
function pMask(c, P, t) {
  const sc = P.small ? 0.9 : 1, gold = P.gold, glowA = P.dim ? 0.25 : 0.45;
  /* Licht hinter dem Kopf */
  const lg = c.createRadialGradient(50, 40, 3, 50, 42, 46); lg.addColorStop(0, prgba(gold, glowA)); lg.addColorStop(1, prgba(gold, 0));
  c.fillStyle = lg; c.fillRect(0, 0, 100, 100);
  if (P.halo) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * 0.08; c.strokeStyle = prgba(gold, 0.08 + 0.05 * Math.sin(t * 1.5 + i)); c.lineWidth = 1.6; c.beginPath(); c.moveTo(50 + Math.cos(a) * 30, 40 + Math.sin(a) * 30); c.lineTo(50 + Math.cos(a) * 52, 40 + Math.sin(a) * 52); c.stroke(); }
    for (let i = 0; i < 2; i++) { c.save(); c.translate(50, 24); c.rotate(i ? -0.22 : 0.18); c.strokeStyle = prgba(gold, 0.55 - i * 0.18); c.lineWidth = 1.3 - i * 0.4; c.beginPath(); c.ellipse(0, 0, 25 - i * 5, 6.5 - i * 1.6, 0, 0, TAU); c.stroke(); c.restore(); }
    const ha = t * 1.3; c.fillStyle = '#fff6dc'; c.beginPath(); c.arc(50 + Math.cos(ha) * 25, 24 + Math.sin(ha) * 6.5 * Math.cos(0.18), 1.1, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  /* Rüstung der Schultern: Plattenkragen */
  const ag = c.createLinearGradient(0, 70, 0, 100); ag.addColorStop(0, pshade(gold, 0.1)); ag.addColorStop(1, pshade(gold, -0.6));
  c.fillStyle = ag; c.beginPath(); c.moveTo(4, 100); c.bezierCurveTo(8, 84, 26, 75, 40, 72); c.lineTo(60, 72); c.bezierCurveTo(74, 75, 92, 84, 96, 100); c.closePath(); c.fill();
  c.strokeStyle = prgba('#000000', 0.35); c.lineWidth = 0.8; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(14 + i * 4, 100); c.quadraticCurveTo(26 + i * 3, 84 - i, 40, 75 + i * 1.6); c.moveTo(86 - i * 4, 100); c.quadraticCurveTo(74 - i * 3, 84 - i, 60, 75 + i * 1.6); } c.stroke();
  c.fillStyle = '#8e5bd6'; c.beginPath(); c.moveTo(50, 78); c.lineTo(54, 84); c.lineTo(50, 90); c.lineTo(46, 84); c.closePath(); c.fill();
  c.fillStyle = pshade(gold, -0.45); c.beginPath(); c.moveTo(43, 64); c.lineTo(57, 64); c.lineTo(59, 74); c.lineTo(41, 74); c.closePath(); c.fill();
  if (P.crown) {
    c.fillStyle = pshade(gold, -0.1);
    for (let i = -3; i <= 3; i++) { const x = 50 + i * 5.6, h = 12 - Math.abs(i) * 2.4; c.beginPath(); c.moveTo(x - 2.6, 22 + Math.abs(i) * 1.6); c.lineTo(x, 22 + Math.abs(i) * 1.6 - h); c.lineTo(x + 2.6, 22 + Math.abs(i) * 1.6); c.closePath(); c.fill(); }
    c.fillStyle = '#c9a0ff'; c.beginPath(); c.arc(50, 8.5, 1.4, 0, TAU); c.fill();
  }
  if (P.crest) { c.fillStyle = pshade(gold, -0.15); c.beginPath(); c.moveTo(50, 6); c.quadraticCurveTo(55, 12, 53.5, 22); c.lineTo(50, 26); c.lineTo(46.5, 22); c.quadraticCurveTo(45, 12, 50, 6); c.fill(); c.strokeStyle = '#fff2c8'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(50, 8); c.lineTo(50, 24); c.stroke(); }
  /* Maske */
  const mg = c.createLinearGradient(33, 20, 67, 66); mg.addColorStop(0, pshade(gold, 0.45)); mg.addColorStop(0.45, gold); mg.addColorStop(1, pshade(gold, -0.5));
  c.fillStyle = mg; pMaskPath(c, sc); c.fill();
  c.strokeStyle = pshade(gold, -0.55); c.lineWidth = 0.9; c.stroke();
  c.save(); pMaskPath(c, sc); c.clip();
  /* Glanzlicht und Prägung */
  c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(42.5, 30, 4.5, 11, 0.35, 0, TAU); c.fill();
  c.strokeStyle = prgba(pshade(gold, -0.6), 0.75); c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(50, 17); c.lineTo(50, 34);
  c.moveTo(36.5, 38.5); c.quadraticCurveTo(43, 34.5, 48.4, 38.8); c.moveTo(63.5, 38.5); c.quadraticCurveTo(57, 34.5, 51.6, 38.8);
  c.moveTo(42.6, 46.5); c.lineTo(42, 55); c.moveTo(57.4, 46.5); c.lineTo(58, 55);
  c.moveTo(38, 52); c.lineTo(40.5, 60); c.moveTo(62, 52); c.lineTo(59.5, 60);
  c.moveTo(49, 44); c.lineTo(48.4, 51.5); c.lineTo(51.6, 51.5); c.lineTo(51, 44);
  c.stroke();
  c.strokeStyle = prgba(pshade(gold, -0.7), 0.9); c.lineWidth = 1.1; c.beginPath(); c.moveTo(45.5, 59); c.quadraticCurveTo(50, 58.4, 54.5, 59); c.stroke();
  if (P.dim) { const dg = c.createLinearGradient(40, 0, 70, 0); dg.addColorStop(0, 'rgba(10,4,20,0)'); dg.addColorStop(1, 'rgba(10,4,20,0.65)'); c.fillStyle = dg; c.fillRect(30, 10, 45, 70); }
  c.restore();
  /* Stirnjuwel und Augenschlitze */
  const pulse = 0.65 + 0.35 * Math.sin(t * 2.2);
  c.shadowColor = P.eye; c.shadowBlur = 7 * pulse;
  c.fillStyle = '#c9a0ff'; c.beginPath(); c.moveTo(50, 26.5); c.lineTo(52.2, 29.5); c.lineTo(50, 32.5); c.lineTo(47.8, 29.5); c.closePath(); c.fill();
  c.fillStyle = prgba(P.eye, 0.75 + 0.25 * pulse);
  const scan = Math.sin(t * 0.9) * 0.6;
  for (const sx of [-1, 1]) { const ex = 50 + sx * 7.3; c.beginPath(); c.moveTo(ex - 4.2, 42.4 + (sx < 0 ? 0.2 : 0)); c.quadraticCurveTo(ex + scan, 39.6, ex + 4.2, 42.4); c.quadraticCurveTo(ex + scan, 43.8, ex - 4.2, 42.4); c.fill(); }
  c.shadowBlur = 0;
}

/* ------------------------------------------------------------------ The Nexus: Kristallgesichter */
function pCrystal(c, P, t) {
  const col = P.col, br = P.broken;
  let jx = 0;
  if (br) { const ph = (t * 7) % 9; if (ph < 0.35) jx = (ph < 0.17 ? 1.8 : -1.4); }
  c.translate(jx, 0);
  /* umlaufende Splitter */
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const a = t * (0.35 + i * 0.03) + i * TAU / 7, r = 34 + 4 * Math.sin(t + i), x = 50 + Math.cos(a) * r, y = 46 + Math.sin(a) * r * 0.55;
    c.save(); c.translate(x, y); c.rotate(a * 2); c.fillStyle = prgba(col, 0.35 + 0.25 * Math.sin(t * 2 + i)); c.beginPath(); c.moveTo(0, -3.2); c.lineTo(1.6, 0); c.lineTo(0, 3.2); c.lineTo(-1.6, 0); c.closePath(); c.fill(); c.restore();
  }
  const gl = c.createRadialGradient(50, 44, 2, 50, 46, 40); gl.addColorStop(0, prgba(col, 0.35)); gl.addColorStop(1, prgba(col, 0)); c.fillStyle = gl; c.fillRect(0, 0, 100, 100);
  c.globalCompositeOperation = 'source-over';
  const sc = br ? 0.82 : 1, cx = 50, cy = br ? 48 : 46;
  const pts = [[0, -32], [14, -18], [16, 4], [9, 22], [0, 28], [-9, 22], [-16, 4], [-14, -18]].map(([x, y]) => [cx + x * sc, cy + y * sc]);
  const mid = [cx, cy - 2 * sc];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], k = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.7);
    c.fillStyle = pmix(pshade(col, -0.55), pshade(col, 0.45), (i % 2 ? 0.25 : 0.55) + 0.3 * k);
    c.beginPath(); c.moveTo(mid[0], mid[1]); c.lineTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.closePath(); c.fill();
  }
  /* Kanten */
  c.strokeStyle = prgba(pshade(col, 0.6), 0.85); c.lineWidth = 0.7;
  c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath();
  for (const p of pts) { c.moveTo(mid[0], mid[1]); c.lineTo(p[0], p[1]); }
  c.stroke();
  /* Hals aus Kristallsäulen */
  c.fillStyle = prgba(pshade(col, -0.35), 0.9);
  for (let i = -2; i <= 2; i++) { const x = cx + i * 7 * sc, h = (14 - Math.abs(i) * 3) * sc; c.beginPath(); c.moveTo(x - 3 * sc, 100); c.lineTo(x - 2.4 * sc, 100 - h - 12); c.lineTo(x, 100 - h - 16); c.lineTo(x + 2.4 * sc, 100 - h - 12); c.lineTo(x + 3 * sc, 100); c.closePath(); c.fill(); }
  /* Riss durch den abgetrennten Knoten */
  if (br) {
    c.strokeStyle = 'rgba(10,6,20,0.9)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(cx + 3, cy - 26); c.lineTo(cx - 2, cy - 12); c.lineTo(cx + 4, cy - 2); c.lineTo(cx - 1, cy + 8); c.lineTo(cx + 5, cy + 20); c.stroke();
    c.strokeStyle = 'rgba(255,120,120,0.55)'; c.lineWidth = 0.4; c.stroke();
  }
  /* Augen */
  const pulse = 0.6 + 0.4 * Math.sin(t * 2.6);
  c.shadowColor = P.eyes || '#ffffff'; c.shadowBlur = 8 * pulse; c.fillStyle = P.eyes || '#ffffff';
  for (const sx of [-1, 1]) { if (br && sx > 0 && Math.sin(t * 5) > 0.3) continue; c.beginPath(); c.arc(cx + sx * 6 * sc, cy - 4 * sc, 1.5 + 0.5 * pulse, 0, TAU); c.fill(); }
  c.shadowBlur = 0;
  c.strokeStyle = prgba('#ffffff', 0.25 * pulse); c.lineWidth = 0.5; c.beginPath(); c.moveTo(cx - 6 * sc, cy - 4 * sc); c.lineTo(cx, cy - 12 * sc); c.lineTo(cx + 6 * sc, cy - 4 * sc); c.stroke();
  if (br) { c.fillStyle = prgba(col, 0.9); c.font = '600 8px ' + FONT; c.textAlign = 'center'; c.fillText('K-7', 50, 94); }
}

/* ------------------------------------------------------------------ Die Stimme: ein Auge im Fleisch */
function pVoice(c, t) {
  const rnd = prand(Math.floor(t * 10) + 7);
  c.fillStyle = 'rgba(20,40,10,0.5)'; c.fillRect(0, 0, 100, 100);
  /* Ranken vom Rand */
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + 0.3, x0 = 50 + Math.cos(a) * 75, y0 = 50 + Math.sin(a) * 75, w = Math.sin(t * 0.9 + i * 1.3) * 9;
    const mx = 50 + Math.cos(a + 0.35) * 38 + w, my = 50 + Math.sin(a + 0.35) * 38 - w;
    c.strokeStyle = i % 2 ? '#3a1c4a' : '#24401a'; c.lineWidth = 7 - (i % 3); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, 50 + Math.cos(a) * 18, 47 + Math.sin(a) * 16); c.stroke();
    c.strokeStyle = 'rgba(180,255,60,0.22)'; c.lineWidth = 0.8; c.stroke();
  }
  /* Fleisch */
  c.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, r = 25 + 2.6 * Math.sin(a * 5 + t * 1.4) + 1.8 * Math.sin(a * 3 - t * 0.9); const x = 50 + Math.cos(a) * r, y = 47 + Math.sin(a) * r * 0.9; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  c.closePath();
  const fg = c.createRadialGradient(46, 40, 3, 50, 47, 28); fg.addColorStop(0, '#5a3a6a'); fg.addColorStop(0.6, '#2c1838'); fg.addColorStop(1, '#120818');
  c.fillStyle = fg; c.fill(); c.strokeStyle = 'rgba(139,224,74,0.5)'; c.lineWidth = 1; c.stroke();
  /* Adern */
  c.strokeStyle = 'rgba(139,224,74,0.35)'; c.lineWidth = 0.6; c.beginPath();
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.2; c.moveTo(50 + Math.cos(a) * 9, 47 + Math.sin(a) * 9); c.quadraticCurveTo(50 + Math.cos(a + 0.4) * 16, 47 + Math.sin(a + 0.4) * 16, 50 + Math.cos(a) * 23, 47 + Math.sin(a) * 21); }
  c.stroke();
  /* das Auge: senkrechter Spalt, der atmet */
  const open = 0.75 + 0.25 * Math.sin(t * 0.8), slit = 1 + 1.4 * (0.5 + 0.5 * Math.sin(t * 1.9));
  c.fillStyle = '#0a0410'; c.beginPath(); c.moveTo(50, 47 - 15 * open); c.quadraticCurveTo(58.5, 47, 50, 47 + 15 * open); c.quadraticCurveTo(41.5, 47, 50, 47 - 15 * open); c.fill();
  const ig = c.createRadialGradient(50, 47, 1, 50, 47, 12); ig.addColorStop(0, '#f4ff9a'); ig.addColorStop(0.5, '#b4ff3c'); ig.addColorStop(1, '#3a7a10');
  c.shadowColor = '#b4ff3c'; c.shadowBlur = 10;
  c.fillStyle = ig; c.beginPath(); c.moveTo(50, 47 - 13 * open); c.quadraticCurveTo(57, 47, 50, 47 + 13 * open); c.quadraticCurveTo(43, 47, 50, 47 - 13 * open); c.fill();
  c.shadowBlur = 0;
  c.fillStyle = '#050208'; c.beginPath(); c.ellipse(50, 47, slit, 11 * open, 0, 0, TAU); c.fill();
  /* Rauschen */
  for (let i = 0; i < 40; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(180,255,60,0.35)' : 'rgba(255,255,255,0.18)'; c.fillRect(rnd() * 100, rnd() * 100, 0.8, 0.8); }
  if (rnd() < 0.18) { const y = rnd() * 100; c.fillStyle = 'rgba(180,255,60,0.12)'; c.fillRect(0, y, 100, 1.5 + rnd() * 3); }
}

/* ------------------------------------------------------------------ Das Echo: Hologramm eines Erbauers */
function pEcho(c, t) {
  const col = '#9ff0c0', rnd = prand(Math.floor(t * 8) + 3);
  let jx = 0; if ((t * 3) % 5 < 0.12) jx = (rnd() - 0.5) * 4;
  c.translate(jx, 0);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { const r = ((t * 9 + i * 18) % 54) + 8; c.strokeStyle = prgba(col, 0.25 * (1 - r / 62)); c.lineWidth = 0.8; c.beginPath(); c.ellipse(50, 92, r, r * 0.22, 0, 0, TAU); c.stroke(); }
  /* Projektionskegel */
  const pg = c.createLinearGradient(0, 100, 0, 10); pg.addColorStop(0, prgba(col, 0.22)); pg.addColorStop(1, prgba(col, 0));
  c.fillStyle = pg; c.beginPath(); c.moveTo(38, 100); c.lineTo(14, 10); c.lineTo(86, 10); c.lineTo(62, 100); c.closePath(); c.fill();
  /* Gestalt: hoher Schädel, schmaler Hals, kantiges Gewand */
  const fill = prgba(col, 0.16), line = prgba(col, 0.8);
  c.fillStyle = fill; c.strokeStyle = line; c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(8, 100); c.lineTo(24, 76); c.lineTo(42, 70); c.lineTo(58, 70); c.lineTo(76, 76); c.lineTo(92, 100); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(42, 70); c.lineTo(50, 92); c.lineTo(58, 70); c.stroke();
  c.beginPath(); c.moveTo(46, 58); c.lineTo(54, 58); c.lineTo(55, 71); c.lineTo(45, 71); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(50, 34, 12.5, 26, 0, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(50, 9); c.lineTo(50, 24); c.moveTo(39, 22); c.quadraticCurveTo(50, 14, 61, 22); c.moveTo(40, 50); c.quadraticCurveTo(50, 56, 60, 50); c.stroke();
  for (let i = 0; i < 4; i++) { c.strokeStyle = prgba(col, 0.3); c.beginPath(); c.moveTo(38 + i * 1.2, 30 + i * 6); c.lineTo(44, 30 + i * 6); c.moveTo(62 - i * 1.2, 30 + i * 6); c.lineTo(56, 30 + i * 6); c.stroke(); }
  /* drei Augen */
  const pulse = 0.6 + 0.4 * Math.sin(t * 2);
  c.shadowColor = '#e8fff2'; c.shadowBlur = 6 * pulse; c.fillStyle = '#e8fff2';
  for (const [x, y] of [[45, 38], [55, 38], [50, 29]]) { c.beginPath(); c.ellipse(x, y, 1.9, 1.1 + 0.3 * pulse, 0, 0, TAU); c.fill(); }
  c.shadowBlur = 0;
  c.globalCompositeOperation = 'source-over';
  /* Bildstörung: verschobene Streifen */
  for (let i = 0; i < 3; i++) { if (rnd() < 0.5) continue; const y = rnd() * 100; c.fillStyle = prgba(col, 0.1); c.fillRect(0, y, 100, 1 + rnd() * 2); }
}

/* ------------------------------------------------------------------ Leitstelle und Feindfunk */
function pHq(c, t, tint) {
  const cx = 50, cy = 50;
  c.strokeStyle = prgba(tint, 0.35); c.lineWidth = 0.8;
  for (const r of [12, 24, 36]) { c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke(); }
  c.beginPath(); c.moveTo(cx - 40, cy); c.lineTo(cx + 40, cy); c.moveTo(cx, cy - 40); c.lineTo(cx, cy + 40); c.stroke();
  const a = t * 1.6;
  c.save(); c.translate(cx, cy); c.rotate(a);
  const sg = c.createLinearGradient(0, 0, 36, 0); sg.addColorStop(0, prgba(tint, 0.05)); sg.addColorStop(1, prgba(tint, 0.45));
  c.fillStyle = sg; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 36, -0.5, 0); c.closePath(); c.fill();
  c.strokeStyle = prgba(tint, 0.9); c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(36, 0); c.stroke();
  c.restore();
  const rnd = prand(5);
  for (let i = 0; i < 5; i++) { const ba = rnd() * TAU, br = 8 + rnd() * 26, age = ((a - ba) % TAU + TAU) % TAU; c.fillStyle = prgba(tint, Math.max(0, 1 - age / 3)); c.beginPath(); c.arc(cx + Math.cos(ba) * br, cy + Math.sin(ba) * br, 1.4, 0, TAU); c.fill(); }
  c.fillStyle = prgba(tint, 0.9); c.font = '700 9px ' + FONT; c.textAlign = 'center'; c.fillText('HQ', cx, 95);
}
function pFoe(c, t) {
  const rnd = prand(Math.floor(t * 14) + 11);
  for (let i = 0; i < 260; i++) { const v = rnd(); c.fillStyle = v < 0.5 ? 'rgba(255,91,71,' + (0.1 + v * 0.4) + ')' : 'rgba(255,255,255,' + (v - 0.5) * 0.25 + ')'; c.fillRect(rnd() * 100, rnd() * 100, 1.4, 1.4); }
  c.fillStyle = 'rgba(10,2,2,0.85)';
  c.beginPath(); c.moveTo(6, 100); c.bezierCurveTo(8, 80, 26, 72, 40, 70); c.lineTo(60, 70); c.bezierCurveTo(74, 72, 92, 80, 94, 100); c.closePath(); c.fill();
  pHeadPath(c); c.fill();
  c.fillStyle = 'rgba(255,91,71,0.85)'; c.fillRect(39, 41, 9, 2.2); c.fillRect(52, 41, 9, 2.2);
  for (let i = 0; i < 4; i++) { const y = rnd() * 100; c.fillStyle = 'rgba(255,91,71,0.15)'; c.fillRect(0, y, 100, 1 + rnd() * 2.5); }
}
