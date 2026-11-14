/* Klangmessung Fassung 27: rendert die Geräusche ohne Lautsprecher (OfflineAudioContext) aus zwei Fassungen und
   vergleicht Spitzenpegel, Lautheit (RMS) und Dauer je Klang; dazu eine Belastungsprobe (alles gleichzeitig) auf
   Übersteuerung. Schreibt Hörproben als WAV. node tools/snd27.js <alt.html> <neu.html> <ordner> */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const [A, B, OUT] = [process.argv[2], process.argv[3], process.argv[4] || 'tools/shots/snd27'];
const NAMES = ['beam', 'auto', 'cannon', 'rail', 'torp', 'pd', 'bite', 'acid', 'shield', 'shdown', 'hit', 'sboom', 'boom', 'bigboom', 'bboom', 'lance', 'warp', 'super'];
const STRESS = ['bboom', 'bigboom', 'boom', 'boom', 'sboom', 'rail', 'rail', 'cannon', 'cannon', 'torp', 'beam', 'beam', 'lance'];
async function render(b, file, plan) {
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + path.resolve(file), { timeout: 180000 }); await p.waitForTimeout(1200);
  const r = await p.evaluate(async plan => {
    const sr = 44100, T = plan[plan.length - 1][1] + 3.2, c = new OfflineAudioContext(2, Math.ceil(T * sr), sr);
    SND.ctx = c; SND.on = true; SND.master = c.createGain(); SND.master.gain.value = 0.5;
    const comp = c.createDynamicsCompressor(); SND.master.connect(comp); comp.connect(c.destination);
    SND.bus = [0, 0, 0, 0, 0].map(() => SND.master); SND.dst = SND.master; SND.sends = null;
    const len = Math.floor(sr * 1.6), nb = c.createBuffer(1, len, sr), d = nb.getChannelData(0); let s = 12345;
    for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; } SND.noise = nb;
    if (typeof sndReverb === 'function') sndReverb(c);
    const rnd = Math.random; let q = 777; Math.random = () => { q = (q * 16807) % 2147483647; return q / 2147483647; };
    for (const [n, t, v] of plan) { SND.pf = 1; SND.dst = SND.master; SND.send = SND.sends && typeof SND_REV !== 'undefined' ? SND.sends[SND_REV[n] || 0] : null; sndVoice(n, t, v); SND.send = null; }
    Math.random = rnd;
    const buf = await c.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), o = new Int16Array(L.length * 2);
    let clip = 0; for (let i = 0; i < L.length; i++) { if (Math.abs(L[i]) > 0.999 || Math.abs(R[i]) > 0.999) clip++; o[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; o[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
    let bin = ''; const u8 = new Uint8Array(o.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { sr, clip, b64: btoa(bin), rev: !!SND.sends };
  }, plan);
  await p.close(); if (errs.length) throw new Error(errs[0]);
  return r;
}
function wav(pcm, sr, file) { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); fs.writeFileSync(file, Buffer.concat([h, pcm])); }
function stats(pcm, sr, t0, t1) { let pk = 0, sq = 0, n = 0, last = t0; for (let i = Math.floor(t0 * sr); i < Math.floor(t1 * sr); i++) { const v = pcm.readInt16LE(i * 4) / 32767; const a = Math.abs(v); if (a > pk) pk = a; sq += v * v; n++; if (a > 0.004) last = i / sr; } return { pk, rms: 10 * Math.log10(sq / n + 1e-12), dur: last - t0 }; }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const plan = []; let t = 0.3; for (const n of NAMES) { plan.push([n, t, 0.8]); t += 3.0; }
  const stress = STRESS.map((n, i) => [n, 0.3 + i * 0.012, 0.8]);
  const res = {};
  for (const [tag, f] of [['vorher', A], ['nachher', B]]) {
    const r = await render(b, f, plan), pcm = Buffer.from(r.b64, 'base64'); wav(pcm, r.sr, path.join(OUT, 'Hoerprobe-' + tag + '.wav'));
    const s = await render(b, f, stress), sp = Buffer.from(s.b64, 'base64'); wav(sp, s.sr, path.join(OUT, 'Belastung-' + tag + '.wav'));
    res[tag] = { per: plan.map(([n, t0]) => [n, stats(pcm, r.sr, t0, t0 + 2.9)]), clip: r.clip, stress: stats(sp, s.sr, 0.3, 3.3), sclip: s.clip, rev: r.rev };
  }
  let bad = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) bad++; };
  console.log('Klang        Spitze alt→neu   RMS dB alt→neu   Dauer s alt→neu');
  res.vorher.per.forEach(([n, a], i) => { const z = res.nachher.per[i][1]; console.log(n.padEnd(9), a.pk.toFixed(2), '→', z.pk.toFixed(2), '   ', a.rms.toFixed(1), '→', z.rms.toFixed(1), '   ', a.dur.toFixed(2), '→', z.dur.toFixed(2)); });
  ok(res.nachher.rev && !res.vorher.rev, 'neue Fassung hat Raumhall, alte nicht');
  ok(res.nachher.per.every(([, z]) => z.pk < 0.9) && res.nachher.clip === 0, 'kein Einzelklang übersteuert (größte Spitze ' + Math.max(...res.nachher.per.map(([, z]) => z.pk)).toFixed(2) + ')');
  ok(res.nachher.sclip === 0 && res.nachher.stress.pk < 0.99, 'Belastungsprobe (13 Klänge gleichzeitig) übersteuert nicht: Spitze ' + res.nachher.stress.pk.toFixed(2) + ' (alt ' + res.vorher.stress.pk.toFixed(2) + ')');
  ok(res.vorher.per.every(([n, a], i) => Math.abs(res.nachher.per[i][1].rms - a.rms) < 6), 'Lautheit je Klang bleibt nah an der alten (höchstens 6 dB Unterschied)');
  ok(['boom', 'bigboom', 'bboom', 'rail'].every(n => { const i = NAMES.indexOf(n); return res.nachher.per[i][1].dur > res.vorher.per[i][1].dur + 0.2; }), 'Explosionen und Railgun klingen länger aus (Hall)');
  console.log(bad ? bad + ' FEHLER' : 'ALL OK'); await b.close(); process.exit(bad ? 1 : 0);
})();
