/* Mehrspieler-Test: zwei Browser (getrennte Speicher) verbinden sich über WebRTC mit den echten Codes, spielen im
   Gleichschritt, vergleichen Prüfsummen, pausieren gemeinsam; dann verlässt einer das Gefecht und die KI übernimmt.
   Aufruf: node tools/mp.js build/Rift-Armada-07.html */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-07.html');
const OUT = path.resolve(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', '--autoplay-policy=no-user-gesture-required'] });
  const mk = async () => { const c = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'de-DE' }); const p = await c.newPage(); return p; };
  const A = await mk(), B = await mk();
  const errors = [], fails = [];
  for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', e => errors.push(n + ' PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n'))); p.on('console', m => { if (m.type() === 'error') errors.push(n + ' CONSOLE ' + m.text()); }); }
  const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FAIL ') + name); if (!ok) fails.push(name); };
  const shot = async (p, n) => { await p.waitForTimeout(200); await p.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  const wait = async (p, fn, ms, arg) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } };
  for (const p of [A, B]) { await p.goto('file://' + file); await p.evaluate(() => { window.__RA_TEST = 1; }); await p.waitForTimeout(500); }
  async function connect(tag) {
    await A.click('#mMp'); await A.waitForTimeout(200);
    check(tag + ' host and join available', await A.evaluate(() => !document.getElementById('mpHost').disabled));
    await A.click('#mpHost');
    check(tag + ' offer code shown', await wait(A, () => document.getElementById('mpOwn').value.startsWith('RIFT') && RA.MPU.ownType === 'offer', 15000));
    const offer = await A.evaluate(() => document.getElementById('mpOwn').value);
    console.log('     offer length', offer.length, await A.evaluate(c => RA.mpUnpack(c).sdp.split('\r\n').filter(l => l.startsWith('a=candidate')).join(' | '), offer));
    await B.click('#mMp'); await B.waitForTimeout(200); await B.click('#mpJoin'); await B.waitForTimeout(150);
    await B.fill('#mpIn1', offer);
    check(tag + ' answer code shown', await wait(B, () => document.getElementById('mpOwn').value.startsWith('RIFT') && RA.MPU.ownType === 'answer', 15000));
    const ans = await B.evaluate(() => document.getElementById('mpOwn').value);
    console.log('     answer', await B.evaluate(c => RA.mpUnpack(c).sdp.split('\r\n').filter(l => l.startsWith('a=candidate')).join(' | '), ans));
    await A.fill('#mpIn2', ans);
    const okA = await wait(A, () => RA.NET.hello && RA.MPU.pane === 'lobby', 20000), okB = await wait(B, () => RA.NET.hello && RA.MPU.pane === 'lobby', 20000);
    check(tag + ' both connected and in lobby', okA && okB);
    if (!(okA && okB)) for (const [n, p] of [['A', A], ['B', B]]) console.log('     ', n, await p.evaluate(() => JSON.stringify({ open: RA.NET.open, hello: RA.NET.hello, role: RA.NET.role, pane: RA.MPU.pane, pc: RA.NET.pc ? RA.NET.pc.connectionState + '/' + RA.NET.pc.iceConnectionState + '/' + RA.NET.pc.signalingState : null, dc: RA.NET.dc ? RA.NET.dc.readyState : null, msg: document.getElementById('mpMsg').textContent, mpHidden: document.getElementById('mp').hidden })));
  }
  /* --- 1. 2 gegen 2 auf Ashfall: Sitze, Teams, Gleichschritt --- */
  await connect('[1]');
  await B.evaluate(() => { const b = [...document.querySelectorAll('#mpFac button')].find(x => /Brood/.test(x.textContent)); b.click(); });
  await A.evaluate(() => { const b = [...document.querySelectorAll('#mpKind button')].find(x => /2 gegen 2/.test(x.textContent)); b.click(); });
  check('[1] guest sees host choice (2 gegen 2, read-only)', await wait(B, () => RA.MPL.kind === 'duo' && document.getElementById('mpKind').classList.contains('ro'), 5000));
  check('[1] host sees guest faction', await wait(A, () => RA.NET.peer.f === 'brood' && /Brood/.test(document.getElementById('mpPeerN').textContent), 5000));
  check('[1] start enabled when guest is in lobby', await wait(A, () => !document.getElementById('mpStart').disabled, 5000));
  await shot(A, '130-mp-lobby-host'); await shot(B, '131-mp-lobby-guest');
  await A.click('#mpStart');
  const inA = await wait(A, () => RA.UI.kind === 'mp' && RA.UI.g && RA.UI.g.tick > 30, 20000), inB = await wait(B, () => RA.UI.kind === 'mp' && RA.UI.g && RA.UI.g.tick > 30, 20000);
  check('[1] both in the game', inA && inB);
  const sa = await A.evaluate(() => ({ me: RA.UI.me, n: RA.UI.g.players.filter(p => !p.neutral).length, team: RA.UI.P.team, f: RA.UI.P.faction, teams: RA.UI.g.players.map(p => p.team) }));
  const sb = await B.evaluate(() => ({ me: RA.UI.me, team: RA.UI.P.team, f: RA.UI.P.faction }));
  check('[1] four players, host and guest on different seats and teams (' + JSON.stringify(sa) + ' / ' + JSON.stringify(sb) + ')', sa.n === 4 && sa.me !== sb.me && sa.team !== sb.team && sb.f === 'brood');
  await A.waitForTimeout(12000);
  const hA = await A.evaluate(() => ({ t: RA.UI.g.tick, ok: RA.NET.okHash, sy: RA.NET.syncs })), hB = await B.evaluate(() => ({ t: RA.UI.g.tick, ok: RA.NET.okHash, sy: RA.NET.syncs }));
  console.log('     ticks', hA.t, hB.t, 'hash ok', hA.ok, hB.ok, 'syncs', hA.sy, hB.sy);
  check('[1] lockstep runs and hashes agree without resync', hA.t > 200 && Math.abs(hA.t - hB.t) < 60 && hA.ok >= 1 && hA.sy === 0 && hB.sy === 0);
  await shot(B, '132-mp-duo-guest');
  /* Abweichung erzwingen: auf B bekommt der Host 1234 Eis extra; die Prüfsumme weicht ab, B übernimmt den Stand von A */
  await B.evaluate(() => { RA.UI.g.players[0].ice += 1234; });
  const desync = await wait(B, () => RA.NET.syncs >= 1 && !RA.NET.wait, 15000);
  await B.waitForTimeout(6000);
  const ia = await A.evaluate(() => ({ s: RA.NET.syncs, ok: RA.NET.okHash })), ib = await B.evaluate(() => ({ s: RA.NET.syncs, ok: RA.NET.okHash, w: RA.NET.wait }));
  console.log('     after forced desync A', JSON.stringify(ia), 'B', JSON.stringify(ib));
  check('[1] forced desync detected and repaired by resync, hashes agree again', desync && ia.s === 1 && ib.s === 1 && ib.ok > hB.ok);
  /* Abbruch und Rückkehr zur Lobby ist im zweiten Teil; hier verlässt A sauber, beide ins Menü */
  await A.evaluate(() => { mpLeave(); toMenu(); });
  check('[1] guest gets the connection-lost card', await wait(B, () => !document.getElementById('mpLost').hidden, 8000));
  await B.evaluate(() => { document.getElementById('mpLostMenu').click(); });
  await A.waitForTimeout(4000);
  for (const [n, p] of [['A', A], ['B', B]]) console.log('     after leave', n, await p.evaluate(() => JSON.stringify({ pc: !!RA.NET.pc, dc: !!RA.NET.dc, live: RA.NET.live, kind: RA.UI.kind })));
  /* --- 2. 1 gegen 1 auf Haven: Befehle beider Seiten, gemeinsame Pause, KI übernimmt --- */
  await connect('[2]');
  await A.evaluate(() => { const b = [...document.querySelectorAll('#mpKind button')].find(x => /1 gegen 1/.test(x.textContent)); b.click(); });
  await wait(A, () => !document.getElementById('mpStart').disabled, 5000);
  await A.click('#mpStart');
  check('[2] both in the 1v1 game', await wait(A, () => RA.UI.kind === 'mp' && RA.UI.g.tick > 30, 20000) && await wait(B, () => RA.UI.kind === 'mp' && RA.UI.g.tick > 30, 20000));
  /* Befehl auf B: eigenes Kampfschiff fliegt zur Kartenmitte; A sieht es dort */
  const target = await B.evaluate(() => { const g = RA.UI.g, u = g.ships.find(s => s.owner === RA.UI.me && s.def.wpn.length); RA.issue({ t: 'move', u: [u.id], x: g.map.w / 2, y: g.map.h / 2 }); return u.id; });
  /* Befehl auf A: Werft bauen */
  const built = await A.evaluate(() => { const g = RA.UI.g, me = RA.UI.me, b = g.bldgs.find(x => x.owner === me && x.role === 'base'), bs = g.ships.find(s => s.owner === me && s.def.build); for (let r = 200; r < 500; r += 40) for (let a = 0; a < 6.28; a += 0.4) { const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r; if (!canPlace(g, me, 'yard', x, y)) return RA.issue({ t: 'build', u: [bs.id], role: 'yard', x, y }); } return 'no spot'; });
  check('[2] host build order accepted locally', built === null);
  await A.waitForTimeout(9000);
  const seenA = await A.evaluate(id => { const u = RA.UI.g.byId.get(id); return u ? Math.round(Math.hypot(u.x - RA.UI.g.map.w / 2, u.y - RA.UI.g.map.h / 2)) : -1; }, target);
  const seenB = await B.evaluate(id => { const u = RA.UI.g.byId.get(id); return u ? Math.round(Math.hypot(u.x - RA.UI.g.map.w / 2, u.y - RA.UI.g.map.h / 2)) : -1; }, target);
  const yardB = await B.evaluate(() => RA.UI.g.bldgs.some(b => b.role === 'yard' && b.owner !== RA.UI.me));
  console.log('     guest ship distance to centre: on A', seenA, 'on B', seenB);
  check('[2] guest move order runs on both devices', seenA >= 0 && seenA < 1200 && seenB >= 0);
  check('[2] host build order appears on guest device', yardB);
  /* gemeinsame Pause */
  await A.evaluate(() => setPaused(true));
  check('[2] pause reaches the guest', await wait(B, () => RA.UI.paused && !document.getElementById('pause').hidden, 5000));
  const tP = await B.evaluate(() => RA.UI.g.tick); await B.waitForTimeout(1500);
  check('[2] guest game stands still while paused', await B.evaluate(t => RA.UI.g.tick === t, tP));
  await shot(B, '133-mp-pause-guest');
  await B.evaluate(() => setPaused(false));
  check('[2] resume from guest resumes host', await wait(A, () => !RA.UI.paused, 5000));
  await A.waitForTimeout(5000);
  const h2 = await A.evaluate(() => ({ ok: RA.NET.okHash, sy: RA.NET.syncs })), h2b = await B.evaluate(() => ({ ok: RA.NET.okHash, sy: RA.NET.syncs }));
  check('[2] hashes agree after commands and pause (' + JSON.stringify(h2) + ')', h2.ok >= 2 && h2.sy === 0 && h2b.sy === 0);
  await shot(A, '134-mp-vs-host');
  /* Gegner verlässt: KI übernimmt */
  await B.evaluate(() => { document.getElementById('pQuit').click(); });
  check('[2] host sees lost card', await wait(A, () => !document.getElementById('mpLost').hidden, 8000));
  await shot(A, '135-mp-lost');
  await A.click('#mpAi');
  const t0 = await A.evaluate(() => RA.UI.g.tick);
  await A.waitForTimeout(2500);
  check('[2] AI took over and game runs on alone', await A.evaluate(t => { const g = RA.UI.g, o = g.players[1 - RA.UI.me]; return g.tick > t + 20 && !!o.ai && document.getElementById('mpLost').hidden; }, t0));
  /* --- 3. Quarantine Line zu zweit mit einem KI-Verbündeten --- */
  await A.evaluate(() => toMenu()); await A.waitForTimeout(500);
  await connect('[3]');
  await A.evaluate(() => { const b = [...document.querySelectorAll('#mpKind button')].find(x => /Quarantine/.test(x.textContent)); b.click(); });
  await A.waitForTimeout(200);
  await A.evaluate(() => { const b = [...document.querySelectorAll('#mpAllies button')].find(x => x.textContent === '1'); b.click(); });
  check('[3] guest sees Quarantine with one ally', await wait(B, () => RA.MPL.kind === 'waves' && RA.MPL.allies === 1 && RA.MPL.map === 'quarantine', 5000));
  await shot(A, '136-mp-lobby-waves');
  await wait(A, () => !document.getElementById('mpStart').disabled, 5000);
  await A.click('#mpStart');
  check('[3] both in Quarantine Line', await wait(A, () => RA.UI.kind === 'mp' && RA.UI.g.tick > 30, 20000) && await wait(B, () => RA.UI.kind === 'mp' && RA.UI.g.tick > 30, 20000));
  const q = await B.evaluate(() => { const g = RA.UI.g; return { mode: g.opts.mode, seal: g.bldgs.some(b => b.role === 'seal'), team0: g.players.filter(p => !p.neutral && !p.threat && p.team === 0).length, humans: g.players.filter(p => p.human).length, wave: !document.getElementById('resWave').hidden }; });
  check('[3] seal, three players in one team, two humans, wave counter (' + JSON.stringify(q) + ')', q.mode === 'quarantine' && q.seal && q.team0 === 3 && q.humans === 2 && q.wave);
  /* erste Welle vorziehen: auf beiden Geräten über einen gemeinsamen Befehl ist das nicht vorgesehen; stattdessen 8 s laufen lassen und Prüfsummen vergleichen */
  await A.waitForTimeout(8000);
  const qa = await A.evaluate(() => ({ ok: RA.NET.okHash, s: RA.NET.syncs })), qb = await B.evaluate(() => ({ ok: RA.NET.okHash, s: RA.NET.syncs }));
  check('[3] Quarantine lockstep hashes agree (' + JSON.stringify(qa) + ')', qa.ok >= 1 && qa.s === 0 && qb.s === 0);
  await shot(B, '137-mp-waves-guest');
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  console.log(fails.length ? 'FAILS: ' + fails.join('; ') : 'ALL OK');
  await browser.close();
  process.exit(errors.length || fails.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
