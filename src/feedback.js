/* ===== feedback.js ===== */
'use strict';
/* RÜCKMELDUNG – kleines Fenster aus Pause und Hauptmenü: Art (Fehler/Balance/Bedienung/Idee), freier Text, dazu der
   Spielkontext (Fassung, Modus, Karte, Fraktion, Spielzeit, Tempo, Gerät). Einträge bleiben lokal (ra.feedback) und
   lassen sich kopieren, teilen (Teilen-Menü des Geräts, sonst E-Mail) oder gesammelt exportieren. Nichts wird ungefragt gesendet. */
const FB = { kind: 'bug', key: 'ra.feedback', mail: 'rtsgame2026@gmail.com' };
const FB_KINDS = [['bug', 'Fehler'], ['bal', 'Balance'], ['ui', 'Bedienung'], ['idea', 'Idee']];
function fbLoad() { try { return JSON.parse(localStorage.getItem(FB.key) || '[]') || []; } catch (e) { return []; } }
function fbStore(list) { try { localStorage.setItem(FB.key, JSON.stringify(list.slice(-50))); return true; } catch (e) { return false; } }
function fbContext() {
  const g = UI.g, live = g && !UI.attract, me = live && UI.P;
  const c = { v: window.RA_VERSION || 'dev', build: window.RA_BUILD || '', lang: I18N.lang, at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
  if (live) {
    c.mode = UI.kind; c.map = (UI.opts && UI.opts.map) || (g.map && g.map.id) || '';
    if (me) c.faction = me.faction;
    c.time = Math.floor(g.time / 60) + ':' + String(Math.floor(g.time % 60)).padStart(2, '0');
    c.players = g.players.length; if (g.pace) c.pace = g.pace;
    if (me && me.stats) c.stats = { earned: Math.round(me.stats.earned || 0), lost: me.stats.lost || 0, killed: me.stats.killed || 0 };
  }
  c.dev = (navigator.userAgent || '').replace(/\s+/g, ' ').slice(0, 140); c.screen = innerWidth + '×' + innerHeight + ' @' + (devicePixelRatio || 1);
  return c;
}
function fbText(e) {
  const c = e.ctx, k = (FB_KINDS.find(q => q[0] === e.kind) || FB_KINDS[0])[1];
  const lines = ['[Rift Armada ' + L('Rückmeldung') + '] ' + L(k), e.text, '—',
    L('Fassung') + ' ' + c.v + (c.build ? ' (' + c.build + ')' : '') + ' · ' + c.at];
  if (c.mode) lines.push(L('Partie') + ': ' + c.mode + ' · ' + c.map + ' · ' + (c.faction || '–') + ' · ' + c.time + ' · ' + c.players + ' ' + L('Parteien') + (c.pace ? ' · ' + c.pace : ''));
  if (c.stats) lines.push(L('Statistik') + ': ' + JSON.stringify(c.stats));
  lines.push(L('Gerät') + ': ' + c.screen + ' · ' + c.dev);
  return lines.join('\n');
}
function fbRender() {
  const seg = $('fbKind'); seg.innerHTML = '';
  for (const [k, lab] of FB_KINDS) { const b = document.createElement('button'); b.textContent = L(lab); b.className = FB.kind === k ? 'on' : ''; b.addEventListener('click', () => { FB.kind = k; fbRender(); }); seg.appendChild(b); }
  const c = fbContext(); $('fbCtx').textContent = fbText({ kind: FB.kind, text: '', ctx: c }).split('\n').slice(3).join(' · ');
  const n = fbLoad().length; $('fbCount').textContent = n === 1 ? L('1 gespeicherte Rückmeldung') : n ? L('{0} gespeicherte Rückmeldungen', n) : '';
  $('fbAll').hidden = !n;
}
function fbOpen() { FB.ctx = fbContext(); $('fbText').value = ''; fbRender(); $('fbWin').hidden = false; if (typeof SND !== 'undefined') SND.play('click'); }
function fbCurrent() {
  const t = $('fbText').value.trim(); if (!t) { toast(L('Bitte kurz beschreiben, was dir aufgefallen ist.'), 'warn'); return null; }
  return { kind: FB.kind, text: t, ctx: FB.ctx || fbContext() };
}
function fbSave(e) { const list = fbLoad(); if (!list.some(q => q.text === e.text && q.ctx.at === e.ctx.at)) { list.push(e); fbStore(list); } }
function fbCopy(txt) {
  const done = () => toast(L('In die Zwischenablage kopiert'));
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fbCopyOld(txt, done)); else fbCopyOld(txt, done);
}
function fbCopyOld(txt, done) { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast(L('Kopieren nicht möglich'), 'warn'); } ta.remove(); }
function fbShare(txt, title) {
  if (navigator.share) { navigator.share({ title, text: txt }).catch(() => {}); return; }
  location.href = 'mailto:' + FB.mail + '?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(txt);
}
function fbInit() {
  $('fbClose').addEventListener('click', () => { $('fbWin').hidden = true; });
  $('fbSaveB').addEventListener('click', () => { const e = fbCurrent(); if (!e) return; fbSave(e); toast(L('Rückmeldung gespeichert')); $('fbText').value = ''; fbRender(); });
  $('fbCopyB').addEventListener('click', () => { const e = fbCurrent(); if (!e) return; fbSave(e); fbCopy(fbText(e)); fbRender(); });
  $('fbShareB').addEventListener('click', () => { const e = fbCurrent(); if (!e) return; fbSave(e); fbShare(fbText(e), ['Rift Armada', L('Rückmeldung')].join(' – ')); fbRender(); });
  $('fbAll').addEventListener('click', () => {
    const list = fbLoad(); if (!list.length) return;
    const txt = list.map(fbText).join('\n\n========\n\n');
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = 'rift-armada-rueckmeldungen.txt';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { fbCopy(txt); }
  });
  $('fbClear').addEventListener('click', () => { fbStore([]); fbRender(); toast(L('Gespeicherte Rückmeldungen gelöscht')); });
  for (const id of ['pFeedback', 'mFeedback']) if ($(id)) $(id).addEventListener('click', fbOpen);
}
