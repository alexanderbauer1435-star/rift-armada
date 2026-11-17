/* Fassung 30: Samples werden geladen und statt der errechneten Klänge gespielt. node tools/smp30.js build/rift-armada.html */
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.seen', '1'); }); await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => { SND.init(); await new Promise(r => setTimeout(r, 2500)); const o = {}; let n = 0, want = 0; for (const k in window.RA_SMP) { want += window.RA_SMP[k].f.length; o[k] = SND.smp[k] ? SND.smp[k].b.length : 0; n += o[k]; }
    let played = 0; const cs = SND.ctx.createBufferSource.bind(SND.ctx); SND.ctx.createBufferSource = () => { const s = cs(); if (window.__cnt) played++; return s; }; window.__cnt = 1; SND.dst = SND.master; const ok = sndSample('beam', SND.ctx.currentTime, 0.7), no = sndSample('click', SND.ctx.currentTime, 0.7); return { n, want, played, ok, no, state: SND.ctx.state }; });
  let bad = 0; const chk = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) bad++; };
  chk(r.want > 40 && r.n === r.want, 'alle Samples dekodiert (' + r.n + '/' + r.want + ')'); chk(r.ok === true && r.played === 1, 'Strahl spielt ein Sample'); chk(r.no === false, 'Klang ohne Sample bleibt errechnet'); chk(!errs.length, 'keine Seitenfehler ' + errs.join(' / '));
  console.log(bad ? bad + ' FEHLER' : 'ALL OK'); await b.close(); process.exit(bad ? 1 : 0); })();
