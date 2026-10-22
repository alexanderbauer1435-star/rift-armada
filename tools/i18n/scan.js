/* Laufzeitprüfung der englischen Fassung im Browser: Seite auf Englisch, I18N.miss sammelt jeden Text ohne Eintrag,
   dazu sucht ein Blick auf die sichtbaren Texte nach deutschen Resten. Durchläuft Hauptmenü, Einstellungen, Hilfe,
   Aufstellung (alle Spielarten und Fraktionen), Kampagne mit allen Besprechungen, jede Mission einige Minuten mit
   Funk, Zielen und Ende, Gefecht und Übungsplatz je Fraktion (Baumenü, Auswahl, Meldungen, Pause, Ende), Wellen mit
   Belohnung, Mehrspieler-Seiten, Conquest (Auswahl, ganze Feldzüge mit Fenstern, Schlachten, Enden).
   node tools/i18n/scan.js build/Rift-Armada-11.html [--shots]   → Code 1, wenn etwas fehlt */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const file = path.resolve(process.argv[2] || 'build/Rift-Armada-11.html');
const SHOTS = process.argv.includes('--shots'), OUT = path.resolve(__dirname, '..', 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'en-GB' });
  const page = await ctx.newPage();
  const errors = [], miss = {}, german = {};
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  await page.addInitScript(() => { window.__RA_TEST = 1; try { localStorage.clear(); localStorage.setItem('ra.prefs', JSON.stringify({ set: { lang: 'en' } })); } catch (e) { /* egal */ } });
  await page.goto('file://' + file);
  await page.waitForTimeout(800);
  const shot = async n => { if (SHOTS) await page.screenshot({ path: path.join(OUT, 'en-' + n + '.png') }); };
  /* sichtbare Texte auf deutsche Reste prüfen und fehlende Einträge einsammeln */
  const look = async where => {
    const r = await page.evaluate(() => {
      const de = /[äöüÄÖÜß»«]|\b(und|oder|der|die|das|den|dem|nicht|mit|ist|sind|eine?n?|für|auf|zum|zur|noch|Schiffe?|Werft|Stufe|Welle|Ziele?|Runde|Zurück|Weiter|Gegner|Feind|Hülle|Schilde?|Station|Basis|Spieler|Sieg|Niederlage|Kampagne|Einstellungen|Hilfe|Fortsetzen|Abbrechen|Leicht|Mittel|Schwer|Zufall|Eis|Erz)\b/;
      const ok = /New Tharsis|Neu-Tharsis|Ägis|Deutsch|Sprache/;
      const out = [];
      const vis = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { if (e.hidden || e.hasAttribute('data-nol')) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.nodeValue.trim();
        if (!t || t.length <= 2 || !de.test(t) || ok.test(t)) continue;
        const p = n.parentElement;
        if (!p || p.closest('script,style') || !vis(p)) continue;
        out.push((p.id || (p.parentElement && p.parentElement.id) || p.tagName) + ': ' + t.slice(0, 120));
      }
      const m = I18N.miss || {}; I18N.miss = {};
      return { out, miss: Object.keys(m) };
    });
    for (const s of r.out) if (!german[s]) german[s] = where;
    for (const s of r.miss) if (!miss[s]) miss[s] = where;
  };
  await page.evaluate(() => { I18N.miss = {}; });
  const ev = (fn, arg) => page.evaluate(fn, arg).catch(e => errors.push('EVAL ' + e.message.split('\n')[0]));
  console.log('lang', await page.evaluate(() => I18N.lang + ' ' + document.documentElement.lang));
  /* Hauptmenü, Einstellungen, Hilfe */
  await look('home'); await shot('home');
  await ev(() => document.getElementById('mSettings').click()); await page.waitForTimeout(100); await look('settings'); await shot('settings');
  await ev(() => document.getElementById('sClose').click());
  await ev(() => { document.getElementById('help').hidden = false; }); await look('help'); await shot('help');
  await ev(() => { document.getElementById('help').hidden = true; });
  /* Aufstellung */
  for (const mode of ['skirmish', 'survival', 'quarantine']) for (const f of ['alliance', 'mars', 'legion', 'nexus', 'brood']) {
    await ev(([mode, f]) => { MENU.mode = mode; MENU.faction = f; menuPage('setup'); }, [mode, f]); await look('setup ' + mode + ' ' + f);
  }
  await shot('setup');
  /* Kampagne: Seite und alle Besprechungen */
  await ev(() => menuPage('camp')); await look('campaign'); await shot('campaign');
  const misIds = await page.evaluate(() => CAMPAIGN.reduce((a, c) => a.concat(c.ms), []));
  for (const id of misIds) { await ev(id => openBrief(id), id); await look('brief ' + id); }
  await shot('brief'); await ev(() => closeBrief());
  /* Mehrspieler-Seiten */
  await ev(() => { menuPage('home'); document.getElementById('mMp').click(); }); await page.waitForTimeout(150); await look('mp home'); await shot('mp');
  for (const pane of ['host', 'join', 'show', 'own']) await ev(p => { try { mpPane(p); } catch (e) { /* egal */ } }, pane).then(() => look('mp ' + pane));
  await ev(() => { try { NET.role = 'host'; mpPane('lobby'); mpLobbyRender(); } catch (e) { /* egal */ } }); await look('mp lobby'); await shot('mp-lobby');
  await ev(() => { try { NET.role = ''; document.getElementById('mp').hidden = true; } catch (e) { /* egal */ } });
  /* Missionen: je einige Minuten mit Funk und Zielen, dann Ende */
  for (const id of misIds) {
    await ev(id => { menuPage('home'); RA.misStart(id); RA.UI.speed = 0.001; }, id);
    await page.waitForTimeout(250);
    for (let k = 0; k < 6; k++) { await ev(() => RA.step(30 * 30)); await page.waitForTimeout(60); await look('mission ' + id); }
    await ev(() => { const g = RA.UI.g; if (g && g.mis && g.mis.ask) openAsk(); }); await look('mission ask ' + id);
    await ev(() => setPaused(true)); await look('pause ' + id); await ev(() => setPaused(false));
    await ev(k => { const g = RA.UI.g; if (k % 2) misWin(g); else misLose(g, 'Die Basis ist gefallen'); RA.step(30); }, misIds.indexOf(id));
    await page.waitForTimeout(2100); await look('mission end ' + id);
    if (id === 'a1m2') await shot('mission-end');
  }
  /* Gefecht und Übungsplatz je Fraktion: Baumenü, Auswahl, Befehle, Meldungen */
  for (const f of ['alliance', 'mars', 'legion', 'nexus', 'brood']) {
    await ev(f => { menuPage('home'); MENU.faction = f; MENU.mode = 'skirmish'; MENU.oppF = 'random'; startSandbox(); RA.UI.speed = 0.001; }, f);
    await page.waitForTimeout(200);
    await ev(() => RA.step(60));
    const roles = await page.evaluate(() => Object.keys(BLDG[RA.UI.P.faction]));
    /* Bauschiff: alle Reiter und Tooltips */
    await ev(() => { const g = RA.UI.g, b = g.ships.find(u => u.owner === g.human && u.def.build); if (b) setSel([b]); hudBuild(true); hudCmds(true); });
    await ev(() => { for (const t of document.querySelectorAll('#tabs [data-k]')) { t.click(); hudBuild(true); } });
    await look('builder ' + f);
    await ev(() => { const P = RA.UI.P; for (const d of Object.values(BLDG[P.faction])) document.getElementById('tip').innerHTML = bldgTip(d); for (const d of Object.values(SHIPS)) if (d.f === P.faction) document.getElementById('tip').innerHTML = shipTip(d); document.getElementById('tip').hidden = false; });
    await look('tips ' + f); await ev(() => { document.getElementById('tip').hidden = true; });
    /* jede Station einmal bauen und anwählen */
    await ev(roles => { const g = RA.UI.g, pi = g.human, s = g.players[pi].start; let i = 0; for (const r of roles) { if (g.bldgs.some(b => b.owner === pi && b.role === r)) continue; const a = i++ * 0.6; try { misBldg(g, pi, r, s.x + Math.cos(a) * 700, s.y + Math.sin(a) * 700, 2); } catch (e) { /* Platz */ } } }, roles);
    for (const r of roles) { await ev(r => { const g = RA.UI.g, b = g.bldgs.find(x => !x.dead && x.owner === g.human && x.role === r); if (b) { selBldg(b); hudBuild(true); hudCmds(true); if (b.lv < 3) document.getElementById('tip').innerHTML = upgradeText(b); } }, r); await look('station ' + f + ' ' + r); }
    /* Schiffe anwählen */
    await ev(() => { const g = RA.UI.g, pi = g.human, s = g.players[pi].start; const seen = new Set(); for (const d of Object.values(SHIPS)) if (d.f === g.players[pi].faction && !seen.has(d.id) && d.role !== 'fighter') { seen.add(d.id); try { addShip(g, d.id, pi, s.x + 300 + seen.size * 30, s.y + 300, 0); } catch (e) { /* egal */ } } });
    const types = await page.evaluate(() => [...new Set(RA.UI.g.ships.filter(u => u.owner === RA.UI.g.human).map(u => u.type))]);
    for (const t of types) { await ev(t => { const g = RA.UI.g, us = g.ships.filter(u => u.owner === g.human && u.type === t); setSel(us.slice(0, 2)); hudCmds(true); }, t); await look('ship ' + f + ' ' + t); }
    await ev(() => { const g = RA.UI.g; setSel(g.ships.filter(u => u.owner === g.human).slice(0, 12)); hudCmds(true); }); await look('mixed ' + f);
    await shot('sandbox-' + f);
    /* Doktrin, Archiv, Meldungen */
    await ev(() => { try { RA.UI.P.docAsk = 1; openDoctrine(); } catch (e) { /* egal */ } }); await look('doctrine ' + f); await ev(() => closeDoctrine());
    await ev(() => { try { RA.UI.P.etechAsk = 1; openEtech(); } catch (e) { /* egal */ } }); await look('etech ' + f); await ev(() => closeDoctrine());
    await ev(() => {
      const g = RA.UI.g, me = RA.UI.me, P = g.players[me], foe = g.players.find(q => q.id !== me && !q.neutral) || P;
      const T0 = TECH[P.faction][0], A = Object.keys(ABIL)[0], s = P.start;
      const evs = [{ t: 'research', owner: me, id: T0.id }, { t: 'built', owner: me, role: 'yard', x: s.x, y: s.y }, { t: 'bdie', owner: me, role: 'reactor', x: s.x, y: s.y },
        { t: 'supercharged', owner: me, x: s.x, y: s.y }, { t: 'supercharged', owner: foe.id, x: s.x, y: s.y }, { t: 'captured', to: me, from: foe.id, name: 'Lancer', x: s.x, y: s.y },
        { t: 'derelict', owner: me, name: 'Lancer', x: s.x, y: s.y }, { t: 'lowpower', owner: me }, { t: 'elim', owner: foe.id }, { t: 'ruin', owner: me, result: 'trap', x: s.x, y: s.y },
        { t: 'ability', owner: me, id: A, x: s.x, y: s.y }, { t: 'upgrade', owner: me, lv: 2, x: s.x, y: s.y }, { t: 'rank', owner: me, rank: 2, x: s.x, y: s.y }];
      for (const e of evs) { try { RA.UI.consume([e]); R.consume([e]); } catch (err) { /* nicht jede Meldung passt zu jeder Fraktion */ } }
    });
    await look('events ' + f);
    await ev(() => setPaused(true)); await look('pause ' + f); await ev(() => setPaused(false));
    await ev(() => { const g = RA.UI.g; g.over = true; g.winner = g.human; g.winTeam = g.tm[g.human]; showEnd(); }); await page.waitForTimeout(1900); await look('end ' + f);
  }
  /* Wellen mit Belohnung */
  await ev(() => { menuPage('home'); MENU.mode = 'survival'; MENU.faction = 'mars'; startSkirmish(); RA.UI.speed = 0.001; }); await page.waitForTimeout(200);
  await ev(() => RA.step(30 * 60)); await look('survival');
  await ev(() => { const P = RA.UI.P; P.rewardAsk = 1; P.rewardOpts = REWARDS.slice(0, 3).map(r => r.id); RA.UI.g.wave.cleared = 3; openReward(); }); await look('reward');
  await ev(() => { const g = RA.UI.g; g.over = true; g.winner = -1; showEnd(); }); await page.waitForTimeout(1900); await look('survival end');
  await ev(() => { menuPage('home'); MENU.mode = 'quarantine'; startSkirmish(); RA.UI.speed = 0.001; }); await page.waitForTimeout(200); await ev(() => RA.step(30 * 90)); await look('quarantine');
  /* Conquest: Auswahl, Feldzüge über die Oberfläche (berechnete Schlachten), alle Fenster, Enden */
  await ev(() => { toMenu(); cqOpen(); }); await page.waitForTimeout(200); await look('cq setup'); await shot('cq-setup');
  const drain = async where => {
    for (let i = 0; i < 20; i++) {
      const st = await page.evaluate(() => document.getElementById('cqEv').hidden ? 0 : document.getElementById('cqEvOpts').children.length ? 2 : 1);
      if (!st) break;
      await look(where);
      if (st === 2) await ev(i => { const o = document.querySelectorAll('#cqEvOpts .dcard'); o[i % o.length].click(); }, i); else await ev(() => document.getElementById('cqEvGo').click());
      await page.waitForTimeout(40);
    }
  };
  for (const f of ['alliance', 'mars', 'legion', 'nexus']) {
    await ev(f => { CQS.fac = f; CQS.lvl = 1; cqNewCampaign(); }, f); await page.waitForTimeout(100);
    await drain('cq ' + f);
    for (let turn = 0; turn < 40; turn++) {
      const over = await page.evaluate(() => !CQS.C || !!CQS.C.over);
      if (over) break;
      await ev(() => {
        const C = CQS.C, th = C.threats.find(x => C.sys[x.sys].owner === C.fac);
        if (th) { CQS.sel = th.sys; cqPanel(); const b = document.querySelector('#cqSel [data-a="adef"]'); if (b) { b.click(); return; } }
        const tg = cqTargets(C).map(id => C.sys[id]).sort((a, b) => cqChance(C, b) - cqChance(C, a));
        const t = tg.find(s => s.type === 'core' || s.type === 'secret') || tg[0];
        if (t) { CQS.sel = t.id; cqPanel(); }
        const a = t && (t.type === 'core' || t.type === 'secret') ? null : document.querySelector('#cqSel [data-a="auto"]');
        if (a) { a.click(); return; }
        if (t && (t.type === 'core' || t.type === 'secret')) { const R = { win: true, vets: C.vets, flagKills: C.flag.kills + 2, flagAlive: true }; const sp = cqSpec(C, 'attack', t.id); cqResult(C, sp, R); cqSave(C); cqAfterTurn(); return; }
        const m = cqMine(C).find(s => s.fort < 3); if (m) { CQS.sel = m.id; cqPanel(); const b = document.querySelector('#cqSel [data-a="fort"]'); if (b) b.click(); }
      });
      await page.waitForTimeout(30);
      if (turn % 4 === 0) { await look('cq map ' + f); for (const k of [0, 5, 10, 15]) await ev(k => { CQS.sel = k % CQS.C.sys.length; cqPanel(); }, k).then(() => look('cq panel ' + f)); }
      await drain('cq ' + f);
    }
    await drain('cq end ' + f);
    if (f === 'legion') await shot('cq-map');
  }
  /* jedes Ende */
  for (const f of ['alliance', 'mars', 'legion', 'nexus']) for (const e of ['dom', 'seal', 'open', 'lost']) {
    await ev(([f, e]) => { CQS.C = cqNew(f, 2, 77); CQS.C.over = e === 'lost' ? -1 : 1; CQS.C.ending = e; document.getElementById('cqEv').hidden = true; cqShowMap(); document.getElementById('cqEv').hidden = true; cqEnding(); }, [f, e]);
    await look('cq ending ' + f + ' ' + e);
  }
  await shot('cq-end');
  /* Ereignisse und Kapitel aller Fraktionen direkt */
  await ev(() => {
    for (const f of CQ_FACS) { const C = cqNew(f, 2, 5); for (let n = 1; n <= 5; n++) C.queue.push({ k: 'chap', n }); C.queue.push({ k: 'event', id: 'refugee' }, { k: 'event', id: 'weapon' }, { k: 'event', id: 'surrender', f: CQ_FACS.find(x => x !== f), sys: 3 }, { k: 'log', n: 0 }, { k: 'final' }); CQS.C = C; }
  });
  /* Schlachten des Feldzugs: jede Art kurz anspielen */
  for (const kind of ['attack', 'defend', 'core', 'secret']) {
    await ev(kind => {
      const C = cqNew('nexus', 2, 31); C.crisis = 1; C.chap = 5; CQS.C = C;
      let sp;
      if (kind === 'defend') sp = Object.assign(cqSpec(C, 'defend', cqCap(C, 'nexus').id, 'mars'), { waves: 2, nem: { who: 'tarn', name: 'Major Ilka Tarn', lvl: 2 } });
      else if (kind === 'core') sp = Object.assign(cqSpec(C, 'attack', C.sys.find(s => s.type === 'core').id), { allies: ['mars', 'legion'] });
      else if (kind === 'secret') { C.sys.push({ id: C.sys.length, name: 'Archiv der Erbauer', x: 600, y: 100, type: 'secret', owner: 'guard', gar: 3, fort: 0, log: -1, links: [] }); sp = cqSpec(C, 'attack', C.sys.length - 1); }
      else sp = Object.assign(cqSpec(C, 'attack', cqTargets(C)[0]), { foe: 'legion', type: 'relic', nem: { who: 'varo', name: 'Inquisitor Varo', lvl: 1 } });
      C.pending = sp; cqSave(C);
      toMenu(); beginGame(cqBattleOpts(sp), 'cq'); RA.UI.speed = 0.001;
    }, kind);
    await page.waitForTimeout(200);
    for (let k = 0; k < 4; k++) { await ev(() => RA.step(30 * 40)); await page.waitForTimeout(50); await look('cq battle ' + kind); }
    await ev(() => { const g = RA.UI.g; misWin(g); RA.step(30); }); await page.waitForTimeout(1700); await look('cq battle end ' + kind);
    if (kind === 'attack') await shot('cq-battle-end');
  }
  /* Sprachwechsel zurück: deutsch, ohne Reste der englischen Texte im Menü */
  await ev(() => { toMenu(); RA.setLang('de'); RA.langRefresh(); });
  const back = await page.evaluate(() => [document.getElementById('mCamp').textContent, document.getElementById('mSettings').textContent]);
  await ev(() => { RA.setLang('en'); RA.langRefresh(); });
  const fwd = await page.evaluate(() => [document.getElementById('mCamp').textContent, document.getElementById('mSettings').textContent]);
  console.log('switch de→', back.join(' / '), '| en→', fwd.join(' / '));
  const okSwitch = back[0] === 'Kampagne' && back[1] === 'Einstellungen' && fwd[0] === 'Campaign' && fwd[1] === 'Settings';
  /* Bericht */
  const mk = Object.keys(miss), gk = Object.keys(german);
  console.log('\n== fehlende Einträge (' + mk.length + ')');
  for (const k of mk) console.log('  ' + miss[k].padEnd(26) + JSON.stringify(k));
  console.log('\n== deutsche Reste auf dem Bildschirm (' + gk.length + ')');
  for (const k of gk) console.log('  ' + german[k].padEnd(26) + k);
  console.log('\n== Fehler (' + errors.length + ')');
  for (const e of errors.slice(0, 30)) console.log('  ' + e);
  fs.writeFileSync(path.join(__dirname, 'scan-result.json'), JSON.stringify({ miss: mk, german: gk, errors }, null, 1));
  console.log(okSwitch ? 'OK   Sprachwechsel hin und zurück' : 'FAIL Sprachwechsel');
  console.log(!mk.length && !gk.length && !errors.length && okSwitch ? 'ALL OK' : 'OFFEN');
  await browser.close();
  process.exit(!mk.length && !gk.length && !errors.length && okSwitch ? 0 : 1);
})();
