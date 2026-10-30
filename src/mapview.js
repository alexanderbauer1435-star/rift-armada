/* ===== mapview.js ===== */
'use strict';
/* =====================================================================
   KARTENVORSCHAU – zeichnet das Layout einer Karte (ohne Partie) auf eine Leinwand: Aschenebel am Rand, Nebelzonen,
   Asteroidengürtel, Felsen, Vorkommen, Stätten, Tore und Startplätze. Für das Menü (vor dem Start) und den Ladebildschirm.
   mapLayout(canvas, map, opts): opts.legend zeigt eine Legende, opts.starts = Farben je Startplatz.
   ===================================================================== */
const MV_COL = { ice: '#9fd8ff', ore: '#d49a5a', rock: '#6c655d', field: 'rgba(140,130,118,0.75)', ion: 'rgba(120,110,255,0.42)', ash: 'rgba(255,90,60,0.5)', edge: 'rgba(160,60,40,0.55)', site: '#9ff0c0', gate: '#7fe0a8', start: ['#4fa3ff', '#ff6a3d', '#f2c14e', '#c9a0ff'], deb: 'rgba(150,170,200,0.28)', plug: '#e0a050', op: '#8fe3ff' };   /* Fassung 22: deb, plug, op */
function mapLayout(cv, map, opts) {
  opts = opts || {};
  const W = cv.width, H = cv.height, pad = 6, sc = Math.min((W - pad * 2) / map.w, (H - pad * 2) / map.h), ox = (W - map.w * sc) / 2, oy = (H - map.h * sc) / 2;
  const x = cv.getContext('2d'), X = v => ox + v * sc, Y = v => oy + v * sc;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
  x.fillStyle = '#070b18'; x.fillRect(ox, oy, map.w * sc, map.h * sc);
  /* Aschenebel am Rand */
  x.fillStyle = MV_COL.edge; x.fillRect(ox, oy, map.w * sc, EDGE * sc); x.fillRect(ox, Y(map.h - EDGE), map.w * sc, EDGE * sc); x.fillRect(ox, oy, EDGE * sc, map.h * sc); x.fillRect(X(map.w - EDGE), oy, EDGE * sc, map.h * sc);
  /* Nebel */
  for (const n of map.nebs || []) { const g = x.createRadialGradient(X(n.x), Y(n.y), 0, X(n.x), Y(n.y), n.r * sc); const c = n.kind === 'ash' ? MV_COL.ash : MV_COL.ion; g.addColorStop(0, c); g.addColorStop(0.75, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(X(n.x), Y(n.y), n.r * sc, 0, TAU); x.fill(); }
  /* Felder und Felsen */
  x.fillStyle = MV_COL.field; for (const f of map.fields) { x.beginPath(); x.arc(X(f.x), Y(f.y), f.r * sc, 0, TAU); x.fill(); }
  /* Fassung 22: Trümmerfelder (Deckung) gepunktet, Felspfropfen bernsteinfarben */
  for (const d of map.debris || []) { x.fillStyle = MV_COL.deb; x.beginPath(); x.arc(X(d.x), Y(d.y), d.r * sc, 0, TAU); x.fill(); x.strokeStyle = 'rgba(190,210,235,0.6)'; x.setLineDash([2, 3]); x.lineWidth = 1; x.stroke(); x.setLineDash([]); }
  for (const o of map.rocks) { if (o.gone) continue; x.fillStyle = o.plug ? MV_COL.plug : MV_COL.rock; x.beginPath(); x.arc(X(o.x), Y(o.y), Math.max(o.plug ? 1.4 : 0.8, o.r * sc), 0, TAU); x.fill(); }
  /* Vorkommen */
  for (const n of map.nodes) { x.fillStyle = n.kind === 'ice' ? MV_COL.ice : MV_COL.ore; x.beginPath(); x.arc(X(n.x), Y(n.y), Math.max(2, n.r * sc), 0, TAU); x.fill(); }
  /* Stätten: Raute, große Stätten größer; Tore: Ring */
  for (const s of map.sites) { const r = Math.max(3, s.r * sc * 0.9), px = X(s.x), py = Y(s.y); if (OUTPOST[s.kind]) { const q = Math.max(3.5, r); x.fillStyle = MV_COL.op; x.fillRect(px - q, py - q, q * 2, q * 2); x.strokeStyle = '#ffffff'; x.lineWidth = 1; x.strokeRect(px - q, py - q, q * 2, q * 2); continue; } x.fillStyle = MV_COL.site; x.beginPath(); x.moveTo(px, py - r); x.lineTo(px + r, py); x.lineTo(px, py + r); x.lineTo(px - r, py); x.closePath(); x.fill(); if (s.kind !== 'ruin') { x.strokeStyle = '#ffffff'; x.lineWidth = 1; x.stroke(); } }
  for (const g of map.gates) { x.strokeStyle = MV_COL.gate; x.lineWidth = Math.max(1.2, 6 * sc); x.beginPath(); x.arc(X(g.x), Y(g.y), Math.max(3, g.r * sc), 0, TAU); x.stroke(); }
  /* Piratenfestung: rotes Bollwerk mit Zinnen */
  if (map.fort) { const px = X(map.fort.x), py = Y(map.fort.y), r = Math.max(6, map.fort.r * sc); x.fillStyle = 'rgba(200,50,74,0.35)'; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); x.fillStyle = '#c8324a'; x.fillRect(px - r * 0.45, py - r * 0.3, r * 0.9, r * 0.6); for (let k = 0; k < 3; k++) x.fillRect(px - r * 0.45 + k * r * 0.35, py - r * 0.5, r * 0.2, r * 0.22); x.strokeStyle = '#ffd36b'; x.lineWidth = 1; x.strokeRect(px - r * 0.45, py - r * 0.3, r * 0.9, r * 0.6); }
  /* Fassung 22: Bahnen der wandernden Gefahren (mittlerer Abstand zur Mitte, Band = Schwankung) */
  if (opts.haz) { const k = HAZ_MAPS[map.id] || 'both', Rh = Math.min(map.w, map.h) / 2; for (const [kind, A0, A1, col] of [['storm', 0.5, 0.17, 'rgba(180,160,255,'], ['well', 0.33, 0.13, 'rgba(255,170,100,']]) { if (k !== 'both' && k !== kind) continue; x.strokeStyle = col + '0.35)'; x.lineWidth = 1; for (const s of [-1, 1]) { x.beginPath(); x.arc(X(map.w / 2), Y(map.h / 2), (A0 + s * A1) * Rh * sc, 0, TAU); x.stroke(); } x.strokeStyle = col + '0.8)'; x.lineWidth = 1.2; x.setLineDash([5, 4]); x.beginPath(); x.arc(X(map.w / 2), Y(map.h / 2), A0 * Rh * sc, 0, TAU); x.stroke(); x.setLineDash([]); } }
  /* Startplätze */
  map.starts.forEach((s, i) => { const c = (opts.starts && opts.starts[i]) || MV_COL.start[i % 4], r = Math.max(5, 64 * sc); x.fillStyle = c; x.beginPath(); x.arc(X(s.x), Y(s.y), r, 0, TAU); x.fill(); x.strokeStyle = '#ffffff'; x.lineWidth = 1.5; x.stroke(); x.fillStyle = '#071018'; x.font = 'bold ' + Math.round(r * 1.3) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), X(s.x), Y(s.y) + 0.5); });
  /* eigener Startplatz: weißer Ring mit »DU« */
  if (opts.mine >= 0 && map.starts[opts.mine]) { const s = map.starts[opts.mine], r = Math.max(5, 64 * sc) + 5; x.strokeStyle = '#ffffff'; x.lineWidth = 2.5; x.beginPath(); x.arc(X(s.x), Y(s.y), r, 0, TAU); x.stroke(); x.fillStyle = '#ffffff'; x.font = 'bold 11px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillText(L('DU'), X(s.x), Y(s.y) - r - 2); }
  x.strokeStyle = '#2c4a7a'; x.lineWidth = 1; x.strokeRect(ox + 0.5, oy + 0.5, map.w * sc - 1, map.h * sc - 1);
}
/* Legende als Text (für die Beschreibung unter der Vorschau) */
function mapLegend(map) {
  const n = map.nebs || [], ion = n.some(o => o.kind === 'ion'), ash = n.some(o => o.kind === 'ash');
  const parts = [L('Blau: Eis'), L('Braun: Erz'), L('Grau: Asteroidengürtel'), L('Grün: Stätten und Tore')];
  if (ion) parts.push(L('Violett: Ionennebel (Schilde aus, nur Nahsicht)'));
  if (ash) parts.push(L('Rot: Aschewolke (Hüllenschaden)'));
  if (map.fort) parts.push(L('Rotes Bollwerk: Piratenfestung'));
  /* Fassung 22 */
  if ((map.debris || []).length) parts.push(L('Gepunktet: Trümmerfeld (Deckung)'));
  if (map.sites.some(s => OUTPOST[s.kind])) parts.push(L('Quadrat: neutrale Station (übernehmen)'));
  if (map.rocks.some(o => o.plug)) parts.push(L('Bernstein: sprengbarer Felspfropfen'));
  return parts.join(' · ');
}
/* Startplatz unter einem Punkt der Vorschau (Leinwandkoordinaten), −1 wenn keiner nah genug */
function mapStartAt(cv, map, px, py, tol) {
  const W = cv.width, H = cv.height, pad = 6, sc = Math.min((W - pad * 2) / map.w, (H - pad * 2) / map.h), ox = (W - map.w * sc) / 2, oy = (H - map.h * sc) / 2;
  let best = -1, bd = tol || 24; map.starts.forEach((s, i) => { const d = Math.hypot(ox + s.x * sc - px, oy + s.y * sc - py); if (d < bd) { bd = d; best = i; } }); return best;
}
