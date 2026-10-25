/* ===== sfx.js ===== */
'use strict';
/* =====================================================================
   KLANGREGIE (Runde 18) – Ereignisse der Simulation → Geräusche, Sprachmeldungen und Kampfdichte für die Musik.
   Aufgerufen aus UI.consume (eine Zeile in ui.js) und musMood (Kampfdichte). Die Klänge selbst stehen in audio.js.

   Geräusche: jeder Waffenart ihr Schuss (aus data.js: beam, auto, cannon, rail, torp, pd, acid, bite) und ihr Treffer
   (Railgun knallt, Säure zischt, Bisse knirschen, abgeschossene Torpedos ploppen), Explosionen nach Größenklasse
   (klein, mittel, groß, Station), Schildtreffer und Schildzusammenbruch, Tarnen und Enttarnen, Bergung, Heck-Treffer.
   Nur was der Spieler sieht (oder was ihm gehört); Lautstärke und Stereolage nach Lage zum Bildschirm, Begrenzung der
   gleichzeitigen Stimmen in SND.play.

   Sprachmeldungen (VOX): Web Speech API in der Sprache der Oberfläche, vorher ein kurzes Signal; ohne Sprachausgabe
   (oder unter webdriver, in Prüfläufen) bleibt es beim Signal. Dieselbe Meldung höchstens alle 20 s. Einstellung
   »Sprachmeldungen« (SET.voice, Vorgabe an). Während der Ansage werden Geräusche und Musik abgesenkt.

   Kampfdichte: gewichtete Kampfereignisse des eigenen Teams (Verluste, Schildtreffer, Angriffe auf Stationen,
   sichtbare Schüsse) der letzten 10 s. Daraus MUS.want (Stufe) und MUS.heat (stufenloses Anschwellen); 16 s nach dem
   letzten Gefecht fällt die Musik in die Ruhe zurück (drei Takte Nachlauf in music.js, zusammen etwa 20 s).
   ===================================================================== */
const SFX = { win: [], last: -99, heat: 0, ht: 0, g: null };
const VOX = { last: {}, cur: null, prio: 0, timer: 0, voice: null, vl: '', next: null };

function sfxFight(g, w) { SFX.win.push(g.time, w); SFX.last = g.time; }
const sfxCls = type => (SHIPS[type] && SHIPS[type].cls) || 's';

function sfxEvents(g, me, evs) {
  if (!g || me < 0 || !g.players[me]) return;
  if (SFX.g !== g) { SFX.g = g; SFX.win.length = 0; SFX.last = -99; SFX.heat = 0; SFX.ht = g.time; VOX.last = {}; }
  const team = o => o >= 0 && g.tm[o] === g.tm[me];
  const foe = o => o >= 0 && !team(o) && g.players[o] && !g.players[o].neutral;
  for (const e of evs) {
    const vis = e.x !== undefined && visAt(g, me, e.x, e.y), own = team(e.owner);
    switch (e.t) {
      /* Waffen und Treffer */
      case 'shot': if (vis) { SND.play(e.snd, e.x, e.y, own ? 0.7 : 0.6); sfxFight(g, 0.04); } break;
      case 'pd': if (vis && (g.tick + (e.x | 0)) % 2 === 0) SND.play('pd', e.x, e.y, 0.45); break;
      case 'hit':
        if (!vis) break;
        if (e.kind === 'torp') SND.play('boom', e.x, e.y, 0.5);
        else if (e.kind === 'torpdie') SND.play('tpop', e.x, e.y, 0.6);
        else if (e.kind === 'rail') SND.play('hit', e.x, e.y);
        else if (e.kind === 'acid') SND.play('sizzle', e.x, e.y, 0.6);
        else if (e.kind === 'bite') SND.play('crunch', e.x, e.y, 0.6);
        else if ((g.tick + (e.x | 0)) % 4 === 0) SND.play('hit', e.x, e.y, e.kind === 'rock' ? 0.3 : 0.5);
        break;
      case 'shield': if (vis && (g.tick + (e.x | 0)) % 3 === 0) SND.play('shield', e.x, e.y, 0.5); if (own) sfxFight(g, 0.2); break;
      case 'shdown': if (vis) SND.play('shdown', e.x, e.y, 0.6); break;
      case 'flank': if (own && vis) SND.play('flank', e.x, e.y, 0.7); break;
      /* Explosionen nach Größe */
      case 'die': {
        if (e.quiet) break;
        const c = sfxCls(e.type);
        if (vis || own) SND.play(c === 'l' ? 'bigboom' : c === 'm' ? 'boom' : 'sboom', e.x, e.y, c === 'f' ? 0.45 : 0.8);
        if (own) sfxFight(g, c === 'f' ? 0.5 : c === 'l' ? 4 : 3); else if (vis) sfxFight(g, c === 'f' ? 0.3 : 1.5);
        break;
      }
      case 'bdie': SND.play('bboom', e.x, e.y); if (own) { sfxFight(g, 4); if (e.owner === me) VOX.say('bdie', 'Station verloren', { prio: 2, tone: 'vwarn' }); } else if (vis) sfxFight(g, 2); break;
      /* Tarnung, Bergung, Sprünge */
      case 'cloak': if (vis || own) SND.play('cloak', e.x, e.y, own ? 0.8 : 0.6); break;
      case 'decloak': if (vis || own) SND.play('decloak', e.x, e.y, own ? 0.8 : 0.6); break;
      case 'salvage': if (vis) SND.play('salvage', e.x, e.y, 0.5); break;
      case 'jump': if (vis && !e.from) SND.play('warp', e.x, e.y, 0.35); break;
      /* Warnungen: UI.consume spielt bei manchen schon ein Signal (alert, alarm, lowpower, upgrade) – dann nur die Ansage danach */
      case 'attack': if (e.owner === me) { sfxFight(g, 3); VOX.say('attack', 'Basis wird angegriffen', { prio: 3, wait: 0.45 }); } break;
      case 'flareWarn': VOX.say('flareWarn', 'Sonneneruption in 25 Sekunden', { prio: 3, wait: 1.25 }); break;
      case 'flareStart': VOX.say('flareStart', 'Sonneneruption! Sofort in Deckung', { prio: 3, tone: 'vwarn' }); break;
      case 'superfire': if (foe(e.owner)) VOX.say('superfire', 'Feindliche Superwaffe abgefeuert', { prio: 4, wait: 0.45 }); break;
      case 'supercharged': if (foe(e.owner)) VOX.say('supercharged', 'Feindliche Superwaffe geladen', { prio: 2, tone: 'vwarn' }); break;
      case 'lowpower': if (e.owner === me) VOX.say('lowpower', 'Energiemangel', { prio: 1, wait: 0.4 }); break;
      case 'gateWarn': if (e.owner !== me) VOX.say('gateWarn', 'Torlanze lädt', { prio: 3, wait: 0.45 }); break;
      case 'wave': VOX.say('wave', 'Feindliche Welle im Anmarsch', { prio: 3, wait: 1.25 }); break;
      case 'research': if (e.owner === me) VOX.say('research', 'Forschung abgeschlossen', { prio: 1, wait: 0.6 }); break;
      case 'upgrade': if (e.owner === me) VOX.say('upgrade', 'Ausbau abgeschlossen', { prio: 1, wait: 0.6 }); break;
    }
  }
}

/* Kampfdichte → Stufe (Rückgabe für MUS.want) und MUS.heat; aus musMood (ui.js, etwa alle 130 ms) */
function sfxCombat(g) {
  const W = SFX.win, t = g.time;
  if (SFX.g !== g) return 0;
  let i = 0;
  while (i < W.length && W[i] < t - 10) i += 2;
  if (i) W.splice(0, i);
  let s = 0;
  for (let k = 1; k < W.length; k += 2) s += W[k];
  const dt = clamp(t - SFX.ht, 0, 2), tgt = clamp(s / 10, 0, 1);
  SFX.ht = t;
  SFX.heat += (tgt - SFX.heat) * (1 - Math.exp(-dt / (tgt > SFX.heat ? 1.5 : 5)));
  MUS.heat = SFX.heat;
  return s >= 6 ? 1 : s >= 1.5 ? 0.6 : t - SFX.last < 16 ? 0.4 : 0;
}

/* ------------------------------------------------------------------ Sprachmeldungen */
VOX.ok = function () {
  try { return SET.voice !== false && !navigator.webdriver && !!window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined'; } catch (e) { return false; }
};
/* key: Sperre (20 s), de: deutscher Text (L übersetzt), o: { prio, tone: Signal davor, wait: Sekunden bis zur Ansage } */
VOX.say = function (key, de, o) {
  if (typeof UI !== 'undefined' && UI.attract) return;
  const now = performance.now();
  if (now - (VOX.last[key] || -1e9) < 20000) return;
  VOX.last[key] = now;
  if (o.tone) SND.play(o.tone);
  if (!VOX.ok() || !SND.on) return;
  const text = L(de), wait = o.wait !== undefined ? o.wait : o.tone ? 0.55 : 0;
  setTimeout(() => VOX.speak(text, o.prio || 1), wait * 1000);
};
VOX.pick = function (lang) {
  if (VOX.vl === lang) return VOX.voice;
  let vs = [];
  try { vs = window.speechSynthesis.getVoices() || []; } catch (e) { /* keine Stimmen */ }
  const m = vs.filter(v => (v.lang || '').toLowerCase().replace('_', '-').indexOf(lang) === 0);
  const pref = lang === 'de' ? 'de-de' : 'en-gb';
  VOX.voice = m.find(v => v.localService && v.lang.toLowerCase().replace('_', '-') === pref) || m.find(v => v.localService) || m[0] || null;
  if (vs.length) VOX.vl = lang;
  return VOX.voice;
};
VOX.unduck = function () {
  clearTimeout(VOX.timer); VOX.cur = null; VOX.prio = 0; SND.setDuck(1); MUS.duck = 1;
  /* eine wartende Meldung (die wichtigste, höchstens 6 s alt) folgt kurz danach */
  const n = VOX.next; VOX.next = null;
  if (n && performance.now() - n.at < 6000) setTimeout(() => VOX.speak(n.text, n.prio), 250);
};
VOX.speak = function (text, prio, any) {
  try {
    const ss = window.speechSynthesis;
    if (!VOX.ok() || !SND.on || (!any && typeof UI !== 'undefined' && (UI.attract || !UI.g))) return;
    if (VOX.cur || ss.speaking || ss.pending) {
      if (prio <= VOX.prio) { if (!VOX.next || prio >= VOX.next.prio) VOX.next = { text, prio, at: performance.now() }; return; }
      VOX.cur = null; ss.cancel();
    }
    const lang = I18N.lang === 'en' ? 'en' : 'de', u = new SpeechSynthesisUtterance(text), v = VOX.pick(lang);
    u.lang = lang === 'en' ? 'en-GB' : 'de-DE';
    if (v) u.voice = v;
    u.rate = 1.08; u.pitch = 0.9; u.volume = clamp(0.4 + SND.vol, 0, 1);
    const done = () => { if (VOX.cur === u) VOX.unduck(); };
    u.onend = done; u.onerror = done;
    VOX.cur = u; VOX.prio = prio;
    SND.setDuck(0.55); MUS.duck = 0.45;
    clearTimeout(VOX.timer); VOX.timer = setTimeout(done, 7000);   // manche Geräte melden das Ende nie
    ss.speak(u);
  } catch (e) { VOX.unduck(); }
};
VOX.stop = function () { VOX.next = null; try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* egal */ } VOX.unduck(); };
/* Einstellung eingeschaltet: kurze Probe, oder Hinweis, wenn das Gerät nicht spricht */
VOX.test = function () {
  if (!VOX.ok()) { if (typeof navigator !== 'undefined' && !navigator.webdriver) toast(L('Dieses Gerät hat keine Sprachausgabe – es bleibt beim Signalton.'), 'warn', 3500); return; }
  SND.play('vinfo');
  setTimeout(() => VOX.speak(L('Sprachmeldungen an'), 9, true), 450);
};
try { if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', () => { VOX.vl = ''; }); } catch (e) { /* egal */ }
