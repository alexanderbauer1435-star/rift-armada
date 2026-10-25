/* ===== hudplus.js ===== */
'use strict';
/* ÜBERSICHT UND TEAM – kleine Bedienhilfen ohne Vollbild-Meldungen:
   · Alarmtaste in der Kopfleiste (blinkt nach einem Angriff, springt zur letzten Meldung; Leertaste wie bisher)
   · Folgen: die Kamera bleibt auf der gewählten Flotte, bis man selbst die Karte verschiebt oder erneut tippt
   · Armeeleiste: je Schiffstyp ein Chip mit Anzahl; Tippen wählt alle dieses Typs, zweimal Tippen zeigt sie
   · Gefechte auf der Minikarte: Treffer in Sicht blitzen kurz auf
   · Team: Signale (Angriff/Hilfe/Sammeln) an der Bildmitte und Rohstoffe an Verbündete senden; Verbündete sind auf der
     Minikarte hell umrandet. Alles über Befehle (issue), damit es im Mehrspieler und für KI-Verbündete gleich wirkt. */
const HP = { follow: null, army: false, hits: new Map(), teamOpen: false, lastTap: { k: '', t: 0 }, armyKey: '' };
const PING_COL = { atk: '#ff5b47', help: '#ffd27a', go: '#7ddc6b' };
const PING_TXT = { atk: 'Angriff', help: 'Hilfe', go: 'Sammeln' };
function hpAllies() { const g = UI.g; if (!g || !UI.P) return []; return g.players.filter(q => q !== UI.P && q.alive && !q.neutral && !q.threat && q.team === UI.P.team); }
function hpPname(q) { return q.name || L(FACTIONS[q.faction] ? FACTIONS[q.faction].name : q.faction); }
function hpInit() {
  try { HP.army = localStorage.getItem('ra.army') === '1'; } catch (e) { HP.army = false; }
  $('bAlert').addEventListener('click', () => { jumpAlert(); SND.play('click'); });
  $('bFollow').addEventListener('click', () => {
    if (HP.follow) { HP.follow = null; } else { const us = selShips(); if (!us.length) { toast(L('Erst Schiffe wählen, dann Folgen')); return; } HP.follow = us.map(u => u.id); }
    $('bFollow').classList.toggle('on', !!HP.follow); SND.play('click');
  });
  $('bArmy').addEventListener('click', () => { HP.army = !HP.army; try { localStorage.setItem('ra.army', HP.army ? '1' : '0'); } catch (e) { } HP.armyKey = ''; hpArmy(); SND.play('click'); });
  $('bTeam').addEventListener('click', () => { HP.teamOpen = !HP.teamOpen; hpTeam(); SND.play('click'); });
  for (const k of ['atk', 'help', 'go']) $('ping_' + k).addEventListener('click', () => { const c = hpCenter(); const why = issue({ t: 'ping', k, x: c.x, y: c.y }); if (why) toast(L(why), 'bad'); HP.teamOpen = false; hpTeam(); });
  /* Kamerabewegung durch den Spieler beendet das Folgen */
  const stop = () => { if (HP.follow) { HP.follow = null; $('bFollow').classList.remove('on'); } };
  $('view').addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button === 2 || e.button === 1) HP.pdown = { x: e.clientX, y: e.clientY }; });
  $('view').addEventListener('pointermove', e => { if (HP.pdown && Math.hypot(e.clientX - HP.pdown.x, e.clientY - HP.pdown.y) > 24) { stop(); HP.pdown = null; } });
  $('view').addEventListener('pointerup', () => { HP.pdown = null; });
  $('mini').addEventListener('pointerdown', stop);
  addEventListener('keydown', e => { if (['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.code) >= 0 && !e.target.closest('input,textarea')) stop(); if (e.code === 'KeyF' && !e.target.closest('input,textarea') && !e.ctrlKey && !e.metaKey) $('bFollow').click(); });
  /* Haken in vorhandene Abläufe: Ereignisse, Minikarte, Bildaufbau */
  const cons = UI.consume; UI.consume = function (evs) { hpEvents(evs); return cons.call(this, evs); };
  const mini = R.drawMini; R.drawMini = function () { mini.apply(this, arguments); hpMini(); };
  const fr = R.frame; R.frame = function (dt, sdt) { hpFollow(dt); return fr.apply(this, arguments); };
  const hu = hudUpdate; hudUpdate = function () { hu(); hpHud(); };
}
function hpCenter() { const c = R.cam; return { x: c.x + R.cssW / c.z / 2, y: c.y + (R.cssH - (R.padB || 0) * 0.5 + (R.padT || 0) * 0.5) / c.z / 2 }; }
function hpReset() { if (typeof rpStop === 'function' && RP.view) rpStop(); HP.follow = null; HP.hits.clear(); HP.teamOpen = false; HP.armyKey = ''; if ($('bFollow')) $('bFollow').classList.remove('on'); }
function hpEvents(evs) {
  const g = UI.g, me = UI.me, now = performance.now();
  for (const e of evs) {
    if (e.t === 'hit' && e.x !== undefined && (g.tick & 3) === 0 && visAt(g, me, e.x, e.y)) { const k = ((e.x / 220) | 0) + ',' + ((e.y / 220) | 0); HP.hits.set(k, { x: e.x, y: e.y, t: now }); }
    else if (e.t === 'ping' && UI.P && e.team === UI.P.team) {
      R.ping(e.x, e.y, PING_COL[e.k]); R.ping(e.x, e.y, PING_COL[e.k]);
      if (e.owner !== me) { UI.alertT = g.time; UI.alertPos = { x: e.x, y: e.y }; toast(L('{0}: {1} – Leertaste springt hin', hpPname(g.players[e.owner]), L(PING_TXT[e.k])), 'ping'); SND.play('click'); }
    } else if (e.t === 'gift') {
      if (e.to === me) toast(L('{0} schickt dir {1}', hpPname(g.players[e.owner]), hpAmt(e)), 'good');
      else if (e.owner === me) toast(L('An {0} gesendet: {1}', hpPname(g.players[e.to]), hpAmt(e)));
    }
  }
}
function hpAmt(e) { const a = []; if (e.ice) a.push(e.ice + ' ' + L(UI.P && UI.P.F.bio ? 'Biomasse' : 'Eis')); if (e.ore) a.push(e.ore + ' ' + L('Erz')); return a.join(' + '); }
function hpMini() {
  const g = R.g; if (!g || UI.attract) return;
  const ctx = R.mctx, W = R.mini.width, H = R.mini.height, sx = W / g.map.w, sy = H / g.map.h, now = performance.now();
  for (const [k, h] of HP.hits) { const a = 1 - (now - h.t) / 1600; if (a <= 0) { HP.hits.delete(k); continue; } ctx.globalAlpha = a; ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(h.x * sx, h.y * sy, 2.2 + 2 * a, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  /* Verbündete hell umrandet: auf einen Blick, was das Team sieht und hält */
  const al = new Set(hpAllies().map(q => q.id)); if (!al.size) return;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
  for (const b of g.bldgs) { if (b.dead || !al.has(b.owner)) continue; const r = Math.max(2, b.def.r * sx * 0.9) + 1; ctx.strokeRect(b.x * sx - r, b.y * sy - r, r * 2, r * 2); }
}
function hpFollow(dt) {
  if (!HP.follow || !UI.g || UI.attract) return;
  const g = UI.g; let x = 0, y = 0, n = 0;
  for (const id of HP.follow) { const u = g.byId.get(id); if (u && !u.dead && u.k === 1) { x += u.x; y += u.y; n++; } }
  if (!n) { HP.follow = null; $('bFollow').classList.remove('on'); return; }
  const c = hpCenter(), k = Math.min(1, dt * 4); R.cam.x += (x / n - c.x) * k; R.cam.y += (y / n - c.y) * k; R.clampCam();
}
function hpHud() {
  const g = UI.g; if (!g || !UI.P) return;
  const hot = UI.alertPos && g.time - UI.alertT < 30; $('bAlert').classList.toggle('hot', !!hot);
  $('bTeam').hidden = !hpAllies().length;
  if (HP.teamOpen) hpTeamAmounts();
  if ((g.tick % 20) < 5) hpArmy();
}
/* Armeeleiste: Chips je Schiffstyp mit Anzahl (nur Kampfschiffe und Träger, Frachter gesammelt) */
function hpArmy() {
  const box = $('army'); box.hidden = !HP.army || !UI.g || UI.attract; $('bArmy').classList.toggle('on', HP.army);
  if (box.hidden) return;
  const g = UI.g, cnt = new Map();
  for (const u of g.ships) { if (u.dead || u.derelict || u.owner !== UI.me || u.def.role === 'fighter') continue; const k = u.def.cargo ? '*cargo' : u.def.build ? '*build' : u.type; cnt.set(k, (cnt.get(k) || 0) + 1); }
  const keys = [...cnt.keys()].sort((a, b) => (a[0] === '*') - (b[0] === '*') || (SHIPS[b] ? SHIPS[b].cp : 0) - (SHIPS[a] ? SHIPS[a].cp : 0));
  const sig = keys.map(k => k + cnt.get(k)).join('|'); if (sig === HP.armyKey) return; HP.armyKey = sig;
  box.innerHTML = '';
  for (const k of keys) {
    const b = document.createElement('button'); b.className = 'chip'; b.dataset.k = k;
    const nm = k === '*cargo' ? L('Frachter') : k === '*build' ? L('Bauschiff') : L(SHIPS[k].name);
    b.innerHTML = '<span></span><b></b>'; b.firstChild.textContent = nm; b.lastChild.textContent = cnt.get(k);
    b.addEventListener('click', () => hpArmyTap(k));
    box.appendChild(b);
  }
}
function hpArmyTap(k) {
  const g = UI.g, us = g.ships.filter(u => !u.dead && !u.derelict && u.owner === UI.me && (k === '*cargo' ? u.def.cargo : k === '*build' ? u.def.build : u.type === k));
  if (!us.length) return;
  const now = performance.now(), dbl = HP.lastTap.k === k && now - HP.lastTap.t < 450; HP.lastTap = { k, t: now };
  setSel(us); SND.play('click');
  if (dbl) { let x = 0, y = 0; for (const u of us) { x += u.x; y += u.y; } R.center(x / us.length, y / us.length); }
}
/* Teamfenster: klein, oben rechts, verdeckt das Spielfeld nicht */
function hpTeam() {
  const box = $('teamBox'); box.hidden = !HP.teamOpen; $('bTeam').classList.toggle('on', HP.teamOpen);
  if (!HP.teamOpen) return;
  const list = $('teamGift'); list.innerHTML = '';
  for (const q of hpAllies()) {
    const row = document.createElement('div'); row.className = 'tgRow';
    const nm = document.createElement('span'); nm.textContent = hpPname(q); nm.style.color = q.color || q.F.team; row.appendChild(nm);
    const bio = UI.P.F.bio || q.F.bio;
    const opts = bio ? [[300, 0]] : [[300, 0], [0, 150]];
    for (const [ice, ore] of opts) {
      const b = document.createElement('button'); b.className = 'key'; b.dataset.ice = ice; b.dataset.ore = ore;
      b.textContent = '+' + (ice ? ice + ' ' + L(UI.P.F.bio ? 'Biomasse' : 'Eis') : ore + ' ' + L('Erz'));
      b.addEventListener('click', () => { const why = issue({ t: 'gift', to: q.id, ice, ore }); if (why) toast(L(why), 'bad'); });
      row.appendChild(b);
    }
    list.appendChild(row);
  }
  hpTeamAmounts();
}
function hpTeamAmounts() { const P = UI.P; document.querySelectorAll('#teamGift button').forEach(b => { b.disabled = P.ice < +b.dataset.ice || P.ore < +b.dataset.ore; }); }
