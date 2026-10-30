/* Mehrspieler-Test: bis zu vier Browser (getrennte Speicher) verbinden sich über WebRTC mit den echten Codes (Stern: jeder
   Mitspieler tauscht zwei Codes mit dem Gastgeber), spielen im Gleichschritt, vergleichen Prüfsummen, pausieren gemeinsam.
   [1] zwei Menschen mit zwei KI (2 gegen 2), Befehle beider Seiten, Pause, erzwungene Abweichung, Gastgeber verlässt
   [2] Quarantine zu zweit mit einem KI-Verbündeten
   [3] drei Menschen und eine KI: Namen, Startplatzwahl, Funksignal, ein Mitspieler verlässt -> KI auf allen Geräten
   [4] vier Menschen und zwei KI in zwei Teams, einige Minuten mit Befehlen aller, dann verlässt einer -> KI, Prüfsummen gleich
   Aufruf: node tools/mp.js build/Rift-Armada-20.html [Sekunden für Teil 4, Vorgabe 150] */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/rift-armada.html');
const LONG = +(process.argv[3] || 150);
const OUT = path.resolve(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const mk = async () => { const c = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'de-DE' }); return c.newPage(); };
  const errors = [], fails = [];
  /* Seiten erst bei Bedarf öffnen: Jede wartende Seite rechnet im Menü ein Hintergrundgefecht und bremst die anderen */
  const open = async n => { const p = await mk(); p.on('pageerror', e => errors.push(n + ' PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n'))); p.on('console', m => { if (m.type() === 'error') errors.push(n + ' CONSOLE ' + m.text()); }); await p.goto('file://' + file); await p.evaluate(() => { window.__RA_TEST = 1; }); await p.waitForTimeout(500); return p; };
  const A = await open('A'), B = await open('B');
  const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails.push(name); };
  const shot = async (p, n) => { await p.waitForTimeout(200); await p.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  const wait = async (p, fn, ms, arg) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } };
  const btn = (p, sel, re) => p.evaluate(([s, r]) => { const b = [...document.querySelectorAll(s)].find(x => new RegExp(r).test(x.textContent)); if (b) b.click(); return !!b; }, [sel, re]);
  const state = p => p.evaluate(() => ({ t: RA.UI.g ? RA.UI.g.tick : -1, ok: RA.NET.okHash, sy: RA.NET.syncs, live: RA.NET.live, kind: RA.UI.kind }));
  /* Code austauschen: Gastgeber H zeigt einen Code (eröffnen oder einladen), G tritt bei, H fügt die Antwort ein */
  async function join(H, G, tag, first) {
    if (first) { await H.click('#mMp'); await H.waitForTimeout(200); check(tag + ' host and join available', await H.evaluate(() => !document.getElementById('mpHost').disabled)); await H.click('#mpHost'); }
    else await H.click('#mpInvite');
    check(tag + ' offer code shown', await wait(H, () => document.getElementById('mpOwn').value.startsWith('RIFT') && RA.MPU.ownType === 'offer' && RA.MPU.pane === 'show', 15000));
    const offer = await H.evaluate(() => document.getElementById('mpOwn').value);
    await G.click('#mMp'); await G.waitForTimeout(200); await G.click('#mpJoin'); await G.waitForTimeout(150);
    await G.fill('#mpIn1', offer);
    check(tag + ' answer code shown', await wait(G, () => document.getElementById('mpOwn').value.startsWith('RIFT') && RA.MPU.ownType === 'answer', 15000));
    const ans = await G.evaluate(() => document.getElementById('mpOwn').value);
    const n0 = await H.evaluate(() => RA.NET.peers.length);
    await H.fill('#mpIn2', ans);
    const okH = await wait(H, n => RA.NET.peers.filter(P => P.hello).length === n + 1 && RA.MPU.pane === 'lobby', 20000, n0), okG = await wait(G, () => RA.NET.hello && RA.MPU.pane === 'lobby' && RA.MPL.slots.length === 8, 20000);
    check(tag + ' connected, both in lobby (' + (n0 + 1) + ' guests)', okH && okG);
    if (!(okH && okG)) for (const [n, p] of [['H', H], ['G', G]]) console.log('     ', n, await p.evaluate(() => JSON.stringify({ open: RA.NET.open, hello: RA.NET.hello, role: RA.NET.role, pane: RA.MPU.pane, peers: RA.NET.peers.map(P => [P.id, P.open, P.hello, P.pc.connectionState]), msg: document.getElementById('mpMsg').textContent })));
  }
  async function startAll(H, guests, tag) {
    check(tag + ' start enabled when all guests are in the lobby', await wait(H, () => !document.getElementById('mpStart').disabled, 8000));
    await H.click('#mpStart');
    let ok = await wait(H, () => RA.UI.kind === 'mp' && RA.UI.g && RA.UI.g.tick > 30, 20000);
    for (const G of guests) ok = await wait(G, () => RA.UI.kind === 'mp' && RA.UI.g && RA.UI.g.tick > 30, 20000) && ok;
    check(tag + ' everyone in the game', ok);
  }
  async function toMenuAll(list) { for (const p of list) await p.evaluate(() => { if (RA.NET.role) mpLeave(); document.getElementById('mpLost').hidden = true; document.getElementById('mp').hidden = true; toMenu(); }); await A.waitForTimeout(1500); }
  async function hashesAgree(list, tag, minOk) {
    const s = []; for (const p of list) s.push(await state(p));
    console.log('     ' + tag + ' ' + s.map(x => 't' + x.t + ' ok' + x.ok + ' sy' + x.sy).join(' | '));
    const ts = s.map(x => x.t);
    check(tag + ' lockstep runs, hashes agree without resync', Math.max(...ts) - Math.min(...ts) < 90 && s.every(x => x.ok >= minOk && x.sy === 0));
    return s;
  }

  /* ---------------------------------------------------------------- [1] 2 Menschen + 2 KI */
  await join(A, B, '[1]', true);
  await B.evaluate(() => { [...document.querySelectorAll('#mpFac button')].find(x => /Brood/.test(x.textContent)).click(); });
  check('[1] host sees guest faction in the slot list', await wait(A, () => RA.NET.peers[0].f === 'brood' && /Brood/.test(document.getElementById('mpSlots').textContent), 5000));
  await btn(A, '#mpSlots button', 'KI hinzufügen'); await btn(A, '#mpSlots button', 'KI hinzufügen');
  await btn(A, '#mpPreset button', 'Zwei Teams');
  check('[1] guest sees 4 slots with two teams, read-only', await wait(B, () => RA.MPL.slots.filter(q => q.t !== 'off').length === 4 && RA.MPL.slots[0].team === 1 && RA.MPL.slots[1].team === 2 && document.getElementById('mpKind').classList.contains('ro') && [...document.querySelectorAll('#mpSlots button')].every(b => b.disabled), 5000));
  await shot(A, '130-mp-lobby-host'); await shot(B, '131-mp-lobby-guest');
  await startAll(A, [B], '[1]');
  const sa = await A.evaluate(() => ({ me: RA.UI.me, n: RA.UI.g.players.filter(p => !p.neutral).length, team: RA.UI.P.team, teams: RA.UI.g.players.map(p => p.team) }));
  const sb = await B.evaluate(() => ({ me: RA.UI.me, team: RA.UI.P.team, f: RA.UI.P.faction }));
  check('[1] four players, host and guest on different seats and teams (' + JSON.stringify(sa) + ' / ' + JSON.stringify(sb) + ')', sa.n === 4 && sa.me !== sb.me && sa.team !== sb.team && sb.f === 'brood');
  /* Fassung 22: keine Pause mit Befehlen und keine Zeitlupe im Mehrspieler (Taste Q wirkt nicht, Menütaste bleibt ❚❚) */
  await B.keyboard.press('q'); await B.waitForTimeout(100);
  check('[1] no active pause or slow motion in multiplayer', await B.evaluate(() => document.getElementById('bQPause').hidden && !RA.UI.apause && !plApOk() && !plSlowOk() && (RA.UI.slowmo || 1) === 1 && document.getElementById('bPause').textContent === '❚❚'));
  check('[1] roster and signal button shown in game', await B.evaluate(() => !document.getElementById('mpRoster').hidden && !document.getElementById('mpSig').hidden && document.getElementById('mpRoster').children.length === 1));
  /* Befehl auf B: Kampfschiff zur Mitte; Befehl auf A: Werft bauen */
  const target = await B.evaluate(() => { const g = RA.UI.g, u = g.ships.find(s => s.owner === RA.UI.me && s.def.wpn.length); RA.issue({ t: 'move', u: [u.id], x: g.map.w / 2, y: g.map.h / 2 }); return u.id; });
  const built = await A.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'), bs = g.ships.find(s => s.owner === me && s.def.build); for (let r = 200; r < 500; r += 40) for (let a = 0; a < 6.28; a += 0.4) { const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r; if (!canPlace(g, me, 'yard', x, y)) return RA.issue({ t: 'build', u: [bs.id], role: 'yard', x, y }); } return 'no spot'; });
  check('[1] host build order accepted locally', built === null);
  await A.waitForTimeout(12000);
  const mvA = await A.evaluate(id => { const g = RA.UI.g, u = g.byId.get(id); return u ? Math.round(Math.hypot(u.x - g.map.w / 2, u.y - g.map.h / 2)) : -1; }, target);
  const mvB = await B.evaluate(id => { const g = RA.UI.g, u = g.byId.get(id); return u ? Math.round(Math.hypot(u.x - g.map.w / 2, u.y - g.map.h / 2)) : -1; }, target);
  const st0 = await B.evaluate(id => { const g = RA.UI.g, u = g.byId.get(id); return Math.round(Math.hypot(u.x - g.map.w / 2, u.y - g.map.h / 2)); }, target);
  console.log('     guest ship distance to centre: on A', mvA, 'on B', mvB, st0);
  check('[1] guest move order runs on both devices', mvA >= 0 && mvB >= 0 && Math.abs(mvA - mvB) < 300);
  check('[1] host build order appears on guest device', await B.evaluate(() => RA.UI.g.bldgs.some(b => b.role === 'yard' && b.owner !== RA.UI.me)));
  const h1 = await hashesAgree([A, B], '[1]', 1);
  /* gemeinsame Pause */
  await A.evaluate(() => setPaused(true));
  check('[1] pause reaches the guest', await wait(B, () => RA.UI.paused && !document.getElementById('pause').hidden, 5000));
  const tP = await B.evaluate(() => RA.UI.g.tick); await B.waitForTimeout(1500);
  check('[1] guest game stands still while paused', await B.evaluate(t => RA.UI.g.tick === t, tP));
  await B.evaluate(() => setPaused(false));
  check('[1] resume from guest resumes host', await wait(A, () => !RA.UI.paused, 5000));
  /* Abweichung erzwingen: auf B bekommt der Gastgeber 1234 Eis extra; die Prüfsumme weicht ab, alle übernehmen den Stand von A */
  await B.evaluate(() => { RA.UI.g.players[0].ice += 1234; });
  const desync = await wait(B, () => RA.NET.syncs >= 1 && !RA.NET.wait && RA.NET.ep >= 1, 15000);
  check('[1] desync message shown', await wait(B, () => /Abweichung bei/.test(document.getElementById('toasts').textContent), 3000) || await A.evaluate(() => /Abweichung bei/.test(document.getElementById('toasts').textContent)));
  await wait(B, ok => RA.NET.okHash > ok, 20000, h1[1].ok);
  const ia = await A.evaluate(() => ({ s: RA.NET.syncs, ok: RA.NET.okHash, ep: RA.NET.ep })), ib = await B.evaluate(() => ({ s: RA.NET.syncs, ok: RA.NET.okHash, w: RA.NET.wait, ep: RA.NET.ep }));
  console.log('     after forced desync A', JSON.stringify(ia), 'B', JSON.stringify(ib));
  check('[1] forced desync detected and repaired by resync, hashes agree again', desync && ia.s === 1 && ib.s === 1 && ia.ep === 1 && ib.ep === 1 && ib.ok > h1[1].ok);
  await shot(B, '132-mp-duo-guest');
  /* Gastgeber verlässt: Mitspieler sieht die Karte, KI übernimmt */
  await A.evaluate(() => { document.getElementById('pQuit').click(); });
  check('[1] guest gets the connection-lost card', await wait(B, () => !document.getElementById('mpLost').hidden, 8000));
  await shot(B, '135-mp-lost');
  await B.click('#mpAi');
  const t0 = await B.evaluate(() => RA.UI.g.tick);
  await B.waitForTimeout(2500);
  check('[1] AI took over the host seat and the game runs on alone', await B.evaluate(t => { const g = RA.UI.g, o = g.players[0]; return g.tick > t + 20 && !!o.ai && !o.human && document.getElementById('mpLost').hidden && RA.UI.kind === 'skirmish'; }, t0));
  await toMenuAll([A, B]);

  /* ---------------------------------------------------------------- [2] Quarantine zu zweit mit einem KI-Verbündeten */
  await join(A, B, '[2]', true);
  await btn(A, '#mpKind button', 'Quarantine');
  await btn(A, '#mpSlots button', 'KI hinzufügen');
  check('[2] guest sees Quarantine with one AI ally', await wait(B, () => RA.MPL.kind === 'waves' && RA.MPL.slots.filter(q => q.t === 'ai').length === 1 && document.getElementById('mpSizeRow').hidden, 5000));
  await shot(A, '136-mp-lobby-waves');
  await startAll(A, [B], '[2]');
  const q = await B.evaluate(() => { const g = RA.UI.g; return { mode: g.opts.mode, seal: g.bldgs.some(b => b.role === 'seal'), team0: g.players.filter(p => !p.neutral && !p.threat && p.team === 0).length, humans: g.players.filter(p => p.human).length, wave: !document.getElementById('resWave').hidden }; });
  check('[2] seal, three players in one team, two humans, wave counter (' + JSON.stringify(q) + ')', q.mode === 'quarantine' && q.seal && q.team0 === 3 && q.humans === 2 && q.wave);
  await A.waitForTimeout(8000);
  await hashesAgree([A, B], '[2]', 1);
  await shot(B, '137-mp-waves-guest');
  await toMenuAll([A, B]);

  /* ---------------------------------------------------------------- [3] drei Menschen + eine KI, jeder für sich */
  const C = await open('C');
  await join(A, B, '[3]', true);
  await join(A, C, '[3b]', false);
  await B.fill('#mpName', 'Berta'); await B.press('#mpName', 'Enter'); await B.evaluate(() => document.getElementById('mpName').dispatchEvent(new Event('change')));
  await btn(A, '#mpSlots button', 'KI hinzufügen');
  check('[3] host shows three humans plus AI and the guest name', await wait(A, () => RA.MPL.slots.filter(q => q.t === 'h').length === 3 && RA.MPL.slots.filter(q => q.t === 'ai').length === 1 && /Berta/.test(document.getElementById('mpSlots').textContent), 5000));
  check('[3] third device sees the same slots', await wait(C, () => RA.MPL.slots.filter(q => q.t === 'h').length === 3 && /Berta/.test(document.getElementById('mpSlots').textContent), 5000));
  /* C wählt Startplatz 3 durch Tippen in die Vorschau */
  const pt = await C.evaluate(() => { const cv = document.getElementById('mpPrev'), m = RA.MPU.prevMap, r = cv.getBoundingClientRect(), W = cv.width, H = cv.height, pad = 6, sc = Math.min((W - pad * 2) / m.w, (H - pad * 2) / m.h), ox = (W - m.w * sc) / 2, oy = (H - m.h * sc) / 2, s = m.starts[2]; return { x: r.left + (ox + s.x * sc) * r.width / W, y: r.top + (oy + s.y * sc) * r.height / H }; });
  await C.mouse.click(pt.x, pt.y);
  check('[3] start pick reaches the host', await wait(A, () => { const q = RA.MPL.slots.find(x => x.t === 'h' && x.id === 2); return q && q.s === 2; }, 5000));
  check('[3] own start marked on the guest', await wait(C, () => /Startplatz: 3/.test(document.getElementById('mpStartNote').textContent), 5000));
  await shot(C, '138-mp-lobby-3');
  await startAll(A, [B, C], '[3]');
  const s3 = await C.evaluate(() => { const g = RA.UI.g, P = RA.UI.P; return { np: g.players.filter(p => !p.neutral).length, humans: g.players.filter(p => p.human).length, start: P.start.x === g.map.starts[2].x && P.start.y === g.map.starts[2].y, teams: g.players.filter(p => !p.neutral).map(p => p.team), names: g.players.map(p => p.name) }; });
  check('[3] four players, three humans, free for all, picked start used (' + JSON.stringify(s3) + ')', s3.np === 4 && s3.humans === 3 && s3.start && new Set(s3.teams).size === 4 && s3.names.indexOf('Berta') >= 0);
  check('[3] roster on host names Berta in her colour', await A.evaluate(() => { const el = [...document.getElementById('mpRoster').children].find(x => /Berta/.test(x.textContent)); return !!el && el.style.color !== ''; }));
  /* Funksignal von B an alle */
  await B.click('#mpSig'); await B.waitForTimeout(150);
  await btn(B, '#mpSigBox button', 'Hilfe');
  check('[3] signal from Berta reaches host and third player', await wait(A, () => /Berta: Hilfe!/.test(document.getElementById('toasts').textContent), 5000) && await wait(C, () => /Berta: Hilfe!/.test(document.getElementById('toasts').textContent), 5000));
  await shot(C, '139-mp-signal');
  await wait(C, () => RA.NET.okHash >= 2, 20000);
  await hashesAgree([A, B, C], '[3]', 2);
  /* C verlässt das Gefecht: auf A und B übernimmt die KI in derselben Runde */
  const seatC = await C.evaluate(() => RA.UI.me);
  await C.evaluate(() => { document.getElementById('pQuit').click(); });
  check('[3] others get the leave toast, seat is AI on host and guest', await wait(A, s => !!RA.UI.g.players[s].ai && /hat das Gefecht verlassen/.test(document.getElementById('toasts').textContent), 10000, seatC) && await wait(B, s => !!RA.UI.g.players[s].ai && !RA.UI.g.players[s].human, 10000, seatC));
  const okBefore = await B.evaluate(() => RA.NET.okHash);
  await wait(B, ok => RA.NET.okHash > ok, 20000, okBefore);
  const s3b = await hashesAgree([A, B], '[3] after leave', 3);
  check('[3] hashes keep agreeing after the leave', s3b[1].ok > okBefore);
  check('[3] roster marks the leaver as AI', await A.evaluate(() => /\(KI\)/.test(document.getElementById('mpRoster').textContent)));
  await toMenuAll([A, B, C]);
  const D = await open('D');

  /* ---------------------------------------------------------------- [4] vier Menschen + zwei KI, zwei Teams, einige Minuten */
  await join(A, B, '[4]', true);
  await join(A, C, '[4c]', false);
  await join(A, D, '[4d]', false);
  await btn(A, '#mpSlots button', 'KI hinzufügen'); await btn(A, '#mpSlots button', 'KI hinzufügen');
  await btn(A, '#mpPreset button', 'Zwei Teams');
  await A.evaluate(() => { [...document.querySelectorAll('#mpPace button')].find(b => /Schnell/.test(b.textContent)).click(); });
  check('[4] maps offered support six players', await A.evaluate(() => [...document.querySelectorAll('#mpMap button')].length > 0 && RA.MPL.slots.filter(q => q.t !== 'off').length === 6 && MAPS[RA.MPL.map].np.indexOf(6) >= 0));
  check('[4] all guests see six slots and fast pace', await wait(D, () => RA.MPL.slots.filter(q => q.t !== 'off').length === 6 && RA.MPL.pace === 'fast', 5000));
  await shot(A, '140-mp-lobby-6');
  await startAll(A, [B, C, D], '[4]');
  const s4 = await D.evaluate(() => { const g = RA.UI.g; return { np: g.players.filter(p => !p.neutral && !p.pirate).length, humans: g.players.filter(p => p.human).length, teams: g.players.filter(p => !p.neutral && !p.pirate).map(p => p.team), pace: g.opts.pace }; });
  check('[4] six players, four humans, two teams, fast pace (' + JSON.stringify(s4) + ')', s4.np === 6 && s4.humans === 4 && new Set(s4.teams).size === 2 && s4.pace === 'fast');
  /* alle geben laufend Befehle: Kampfschiffe fliegen zu Zufallspunkten, Frachter und Werften bleiben, wie die KI es will */
  const order = p => p.evaluate(() => { const g = RA.UI.g; if (!g || RA.UI.kind !== 'mp') return; const us = g.ships.filter(s => !s.dead && s.owner === RA.UI.me && s.def.wpn.length); if (!us.length) return; const u = us[(Math.random() * us.length) | 0]; RA.issue({ t: 'move', u: [u.id], x: 400 + Math.random() * (g.map.w - 800), y: 400 + Math.random() * (g.map.h - 800) }); });
  const tStart = Date.now();
  while (Date.now() - tStart < LONG * 1000) { for (const p of [A, B, C, D]) await order(p); await A.waitForTimeout(4000); }
  const s4b = await hashesAgree([A, B, C, D], '[4] after ' + LONG + ' s', Math.floor(LONG / 5 * 0.6));
  check('[4] game time advanced close to real time', s4b[0].t > LONG * 30 * 0.7);
  await shot(B, '141-mp-4humans');
  /* D verlässt: auf A, B, C übernimmt die KI */
  const seatD = await D.evaluate(() => RA.UI.me);
  await D.evaluate(() => { document.getElementById('pQuit').click(); });
  let ai4 = true;
  for (const p of [A, B, C]) ai4 = await wait(p, s => !!RA.UI.g.players[s].ai && !RA.UI.g.players[s].human, 10000, seatD) && ai4;
  check('[4] leaving peer replaced by AI on all remaining devices', ai4);
  const okB4 = await C.evaluate(() => RA.NET.okHash);
  await wait(C, ok => RA.NET.okHash > ok, 20000, okB4);
  const s4c = await hashesAgree([A, B, C], '[4] after leave', 1);
  check('[4] hashes keep agreeing after the leave', s4c[2].ok > okB4);
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  console.log(fails.length ? 'FAILS: ' + fails.join('; ') : 'ALL OK');
  await browser.close();
  process.exit(errors.length || fails.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
