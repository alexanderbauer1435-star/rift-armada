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
function L(s, ...args) {
  let t = s;
  if (I18N.lang === 'en' && typeof s === 'string' && s) {
    const e = EN[s];
    if (e !== undefined) t = e;
    else {
      let hit = false;
      for (let i = 0; i < EN_PAT.length && !hit; i++) { const m = EN_PAT[i][0].exec(s); if (m) { t = EN_PAT[i][1](m); hit = true; } }
      if (!hit && I18N.miss && /[A-Za-zÄÖÜäöü]{2}/.test(s) && !enVal(s)) I18N.miss[s] = 1;
    }
  }
  if (args.length && typeof t === 'string') for (let i = 0; i < args.length; i++) if (args[i] !== undefined) t = t.split('{' + i + '}').join(args[i]);
  /* Fraktionsnamen mitten im englischen Satz: »falls to the Alliance« statt »The Alliance« */
  if (I18N.lang === 'en' && args.length && typeof t === 'string' && t.indexOf('The ') > 0) t = t.replace(/([a-z,’'] )The (Alliance|Nexus|Brood)\b/g, '$1the $2');
  return t;
}
/* Anführungszeichen der Sprache: »…« oder “…” */
function qt(s) { return I18N.lang === 'en' ? '“' + s + '”' : '»' + s + '«'; }
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
  [/^Ausbau ([IVX]+)$/, m => 'Upgrade ' + m[1]],
  [/^Akt (\d+): (.+)$/, m => 'Act ' + m[1] + ': ' + L(m[2])],
  [/^Akt (\d+)$/, m => 'Act ' + m[1]],
  [/^(Prolog|Bonus): (.+)$/, m => L(m[1]) + ': ' + L(m[2])]
];
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
/* Sprache wählen: ohne Einstellung die des Geräts (Deutsch, sonst Englisch) */
function langDefault() { try { return /^de\b/i.test(navigator.language || 'de') ? 'de' : 'en'; } catch (e) { return 'de'; } }
function setLang(l) {
  I18N.lang = l === 'en' ? 'en' : 'de';
  if (typeof document !== 'undefined') { document.documentElement.lang = I18N.lang; applyLang(); }
}
