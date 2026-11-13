/* ===== errlog.js ===== (Fassung 26)
   FEHLERPROTOKOLL – läuft als erstes Skript, noch vor dem Spiel, damit auch Fehler beim Laden erfasst werden.
   Fehler bleiben nur auf diesem Gerät (localStorage ra.errors, höchstens 20, gleiche werden gezählt); gesendet wird
   nichts. Das Rückmeldungsfenster hängt das Protokoll an, wenn der Spieler selbst einen Bericht schickt.
   Pfade werden entfernt (bei einer lokalen Datei stünde sonst der Ordnername des Nutzers im Bericht). */
(function () {
  var K = 'ra.errors', n = 0;
  function clean(s, max) { return String(s == null ? '' : s).replace(/(?:file|https?|capacitor):\/\/[^\s)]*\//g, '').replace(/\s*\n\s*/g, ' | ').slice(0, max); }
  function list() { try { var l = JSON.parse(localStorage.getItem(K) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function put(msg, stack) {
    try {
      if (++n > 40) return;   // ein Fehler in jedem Bild soll den Speicher nicht fluten
      var m = clean(msg, 240), s = clean(stack, 420), l = list(), e = null, i;
      for (i = 0; i < l.length; i++) if (l[i].m === m && l[i].s === s) e = l[i];
      if (e) { e.n++; e.t = Date.now(); } else l.push({ m: m, s: s, n: 1, t: Date.now(), v: String(window.RA_BUILD || '') });
      localStorage.setItem(K, JSON.stringify(l.slice(-20)));
      if (window.__raErrNew) window.__raErrNew(m);
    } catch (x) { /* Protokoll darf nie selbst stören */ }
  }
  window.addEventListener('error', function (e) {
    if (!e || !e.message) return;   // Ladefehler von Bildern u. Ä. haben keine Meldung
    put(e.message, (e.error && e.error.stack) || ((e.filename || '') + ':' + e.lineno + ':' + e.colno));
  });
  window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; put('promise: ' + ((r && r.message) || r), r && r.stack); });
  window.__raErr = { put: put, list: list, clear: function () { try { localStorage.removeItem(K); } catch (e) { /* egal */ } } };
})();
