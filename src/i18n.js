/* ===== i18n.js ===== */
'use strict';
/* =====================================================================
   SPRACHE – Deutsch ist die Quellsprache. L('deutscher Text') liefert im englischen Modus die Übersetzung aus EN
   (i18n_en.js), sonst den Text selbst. Platzhalter {0}, {1}, {2} werden mit den weiteren Argumenten gefüllt.
   Zusammengesetzte Meldungen der Simulation (»Benötigt Werft Stufe II«) übersetzen die Muster in EN_PAT.
   T(x) zeigt Texte aus der Simulation an: ein Text oder ['Vorlage {0}', Argument, …]; die Argumente werden selbst
   übersetzt (Namen, eingeschachtelte Vorlagen), ['%list', a, b] wird zur Aufzählung »a, b«. So bleibt die Simulation sprachfrei und im Mehrspieler gleich.
   Die festen Texte der Seite übersetzt applyLang() direkt in den Textknoten (der deutsche Text bleibt am Knoten).
   ===================================================================== */
const I18N = { lang: 'de', miss: null };
/* Sprachen der App (Fassung 22): Deutsch ist die Quelle, Englisch die Rückfallsprache für fehlende Einträge.
   Die Wörterbücher fr/es/it/pt/pl erzeugt tools/i18n/merge.py nach src/i18n_more.js (LANGS). */
const LANG_LIST = [['de', 'Deutsch'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['it', 'Italiano'], ['pt', 'Português (BR)'], ['pl', 'Polski']];
const LANG_LOC = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-BR', pl: 'pl-PL' };
function langOk(l) { return LANG_LIST.some(q => q[0] === l) && (l === 'de' || l === 'en' || (typeof LANGS !== 'undefined' && !!LANGS[l])); }
function langLoc() { return LANG_LOC[I18N.lang] || 'en-GB'; }
function L(s, ...args) {
  let t = s;
  const lg = I18N.lang;
  if (lg !== 'de' && typeof s === 'string' && s) {
    const D = lg === 'en' ? null : (typeof LANGS !== 'undefined' && LANGS[lg]) || null;
    let e = D ? D[s] : undefined;
    if (e === undefined && D && PAT_X[lg]) { const h = patHit(PAT_X[lg], s); if (h !== null) e = h; }
    if (e === undefined) e = EN[s];
    if (e !== undefined) t = e;
    else {
      const h = patHit(EN_PAT, s);
      if (h !== null) t = h;
      else if (lg === 'en' && I18N.miss && /[A-Za-zÄÖÜäöü]{2}/.test(s) && !enVal(s)) I18N.miss[s] = 1;
    }
  }
  if (args.length && typeof t === 'string') for (let i = 0; i < args.length; i++) if (args[i] !== undefined) t = t.split('{' + i + '}').join(args[i]);
  /* Fraktionsnamen mitten im englischen Satz: »falls to the Alliance« statt »The Alliance« */
  if (I18N.lang === 'en' && args.length && typeof t === 'string' && t.indexOf('The ') > 0) t = t.replace(/([a-z,’'] )The (Alliance|Nexus|Brood)\b/g, '$1the $2');
  return t;
}
/* Anführungszeichen der Sprache: »…« oder “…” */
const QT = { de: ['»', '«'], en: ['“', '”'], fr: ['« ', ' »'], es: ['«', '»'], it: ['«', '»'], pt: ['“', '”'], pl: ['„', '”'] };
function qt(s) { const q = QT[I18N.lang] || QT.en; return q[0] + s + q[1]; }
function patHit(P, s) { for (let i = 0; i < P.length; i++) { const m = P[i][0].exec(s); if (m) return P[i][1](m); } return null; }
/* schon englisch? (für die Prüfung auf fehlende Einträge) */
let _enVal = null;
function enVal(s) { if (!_enVal) _enVal = new Set(Object.values(EN)); return _enVal.has(s); }
function T(x) {
  if (Array.isArray(x)) return x[0] === '%list' ? x.slice(1).map(T).join(', ') : L(x[0], ...x.slice(1).map(T));
  if (typeof x === 'number') return String(x);
  return x == null ? '' : L(x);
}
/* zusammengesetzte Meldungen der Simulation und feste Muster */
const EN_PAT = [
  [/^Benötigt (.+) Stufe ([IVX]+)$/, m => 'Requires ' + L(m[1]) + ' level ' + m[2]],
  [/^Benötigt Doktrin (.+)$/, m => 'Requires doctrine ' + L(m[1])],
  [/^Benötigt (.+)$/, m => 'Requires ' + L(m[1])],
  [/^Rift Armada · Fassung (\d+)$/, m => 'Rift Armada · Build ' + m[1]],
  [/^Runde (\d+) · Vorabfassung$/, m => 'Round ' + m[1] + ' · Preview'],
  [/^Runde (\d+)$/, m => 'Round ' + m[1]],
  [/^Ausbau ([IVX]+)$/, m => 'Upgrade ' + m[1]],
  [/^Akt (\d+): (.+)$/, m => 'Act ' + m[1] + ': ' + L(m[2])],
  [/^Akt (\d+)$/, m => 'Act ' + m[1]],
  [/^(Prolog|Bonus): (.+)$/, m => L(m[1]) + ': ' + L(m[2])]
];
/* dieselben Muster für die weiteren Sprachen */
const PAT_W = {
  fr: { req: 'Nécessite', lvl: 'niveau', doc: 'doctrine', build: 'Version', round: 'Manche', pre: 'Préversion', up: 'Amélioration', act: 'Acte' },
  es: { req: 'Requiere', lvl: 'nivel', doc: 'doctrina', build: 'Versión', round: 'Ronda', pre: 'Versión previa', up: 'Mejora', act: 'Acto' },
  it: { req: 'Richiede', lvl: 'livello', doc: 'dottrina', build: 'Versione', round: 'Round', pre: 'Anteprima', up: 'Potenziamento', act: 'Atto' },
  pt: { req: 'Requer', lvl: 'nível', doc: 'doutrina', build: 'Versão', round: 'Rodada', pre: 'Prévia', up: 'Melhoria', act: 'Ato' },
  pl: { req: 'Wymaga', lvl: 'poziom', doc: 'doktryna', build: 'Wersja', round: 'Runda', pre: 'Wersja zapoznawcza', up: 'Ulepszenie', act: 'Akt' }
};
const PAT_X = {};
for (const lg in PAT_W) {
  const w = PAT_W[lg];
  PAT_X[lg] = [
    [/^Benötigt (.+) Stufe ([IVX]+)$/, m => w.req + ': ' + L(m[1]) + ' ' + w.lvl + ' ' + m[2]],
    [/^Benötigt Doktrin (.+)$/, m => w.req + ': ' + w.doc + ' ' + L(m[1])],
    [/^Benötigt (.+)$/, m => w.req + ': ' + L(m[1])],
    [/^Rift Armada · Fassung (\d+)$/, m => 'Rift Armada · ' + w.build + ' ' + m[1]],
    [/^Runde (\d+) · Vorabfassung$/, m => w.round + ' ' + m[1] + ' · ' + w.pre],
    [/^Runde (\d+)$/, m => w.round + ' ' + m[1]],
    [/^Ausbau ([IVX]+)$/, m => w.up + ' ' + m[1]],
    [/^Akt (\d+): (.+)$/, m => w.act + ' ' + m[1] + ': ' + L(m[2])],
    [/^Akt (\d+)$/, m => w.act + ' ' + m[1]],
    [/^(Prolog|Bonus): (.+)$/, m => L(m[1]) + ': ' + L(m[2])]
  ];
}
/* feste Texte der Seite: alle Textknoten und einige Attribute; Bereiche mit data-nol bleiben unberührt */
const I18N_ATTR = ['placeholder', 'aria-label', 'title'];
function applyLang(root) {
  if (typeof document === 'undefined') return;
  root = root || document.body;
  const skip = n => { for (let e = n.parentElement; e; e = e.parentElement) { if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.hasAttribute('data-nol')) return true; } return false; };
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) nodes.push(n);
  for (const n of nodes) {
    const v = n.nodeValue;
    if (n._i18n !== v) { if (!/[A-Za-zÄÖÜäöü]{2}/.test(v) || skip(n)) continue; n._de = v; }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(n._de);
    const out = m[1] + L(m[2]) + m[3];
    n._i18n = out;
    if (n.nodeValue !== out) n.nodeValue = out;
  }
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el => {
    for (const a of I18N_ATTR) {
      if (!el.hasAttribute(a)) continue;
      const k = '_de_' + a, cur = el.getAttribute(a);
      if (el[k + 'o'] !== cur) el[k] = cur;
      const out = L(el[k]); el[k + 'o'] = out;
      if (cur !== out) el.setAttribute(a, out);
    }
  });
}
/* Sprache wählen: ohne gespeicherte Einstellung die des Geräts, falls vorhanden, sonst Englisch (Prüfläufe Deutsch) */
function langDefault() {
  try { if (navigator.webdriver) return 'de'; for (const l of (navigator.languages || [navigator.language || ''])) { const c = String(l).slice(0, 2).toLowerCase(); if (langOk(c)) return c; } } catch (e) { /* kein Browser */ }
  return 'en';
}   // Prüfläufe (Playwright) in Deutsch, Spieler ohne Einstellung Englisch
function setLang(l) {
  I18N.lang = langOk(l) ? l : 'de';
  if (typeof document !== 'undefined') { document.documentElement.lang = I18N.lang; applyLang(); }
}
