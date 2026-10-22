/* ===== app.js ===== */
'use strict';
/* =====================================================================
   APP – Läuft das Spiel als Android-App (Capacitor-Hülle, window.Capacitor), übernimmt dieses Modul die Zurück-Taste,
   pausiert beim Wechsel in den Hintergrund und sperrt das Bild im Gefecht quer. Übernommen aus RTS.
   ===================================================================== */
const APP = { native: false, backT: 0 };
function appNative() { try { const C = window.Capacitor; return !!(C && (typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : C.platform && C.platform !== 'web')); } catch (e) { return false; } }
function appPlugin(n) { try { const C = window.Capacitor; return (C && C.Plugins && C.Plugins[n]) || null; } catch (e) { return null; } }
function appBack() {
  const wins = [['settings', closeSettings], ['help', () => { $('help').hidden = true; }], ['brief', closeBrief], ['cqMenuWin', () => { $('cqMenuWin').hidden = true; }]];
  for (const [id, fn] of wins) if ($(id) && !$(id).hidden) { fn(); SND.play('click'); return; }
  if (UI.cqOpen) { if (!$('cqEv').hidden) return; if (!$('cqSetup').hidden) cqClose(); else $('cqMenuB').click(); return; }
  if (UI.g && !UI.attract && $('menu').hidden) {
    if (UI.endShown) { $('eMenu').click(); return; }
    if (UI.mode !== 'normal') { endMode(); hudCmds(); return; }
    setPaused(!UI.paused);
    return;
  }
  if ((UI.mPage === 'setup' || UI.mPage === 'camp') && !$('menu').hidden) { menuPage('home'); SND.play('click'); return; }
  const now = Date.now(), A = appPlugin('App');
  if (now - APP.backT < 2200 && A && A.exitApp) { A.exitApp(); return; }
  APP.backT = now;
  toast(L('Zum Beenden noch einmal »Zurück«'));
}
function appOrient(game) {
  const SO = appPlugin('ScreenOrientation');
  if (!APP.native || !SO) return;
  try { const r = game ? SO.lock({ orientation: 'landscape' }) : SO.unlock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ohne Sperre weiter */ }
}
function appInit() {
  APP.native = appNative();
  if (!APP.native) return;
  document.documentElement.classList.add('app');
  const A = appPlugin('App');
  try {
    if (A && A.addListener) {
      A.addListener('backButton', () => { try { appBack(); } catch (e) { /* nichts tun */ } });
      A.addListener('appStateChange', s => { if (!s) return; if (!s.isActive) { if (UI.g && !UI.attract && !UI.endShown && !UI.paused) setPaused(true); SND.sleep(); } else SND.wake(); });
    }
  } catch (e) { /* ohne App-Plugin geht es auch */ }
}
