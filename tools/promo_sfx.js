/* Werbefilm: rendert Spielgeräusche ohne Lautsprecher in eine WAV-Datei (je Klang 3 s Abstand), tools/promo28.py
   schneidet sie heraus. node tools/promo_sfx.js build/rift-armada.html tools/promo/sfx.wav */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const NAMES = ['beam', 'cannon', 'rail', 'torp', 'shdown', 'sboom', 'boom', 'bigboom', 'bboom', 'lance', 'warp', 'super', 'acid', 'auto'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); await p.addInitScript(() => { window.__RA_TEST = true; localStorage.setItem('ra.seen', '1'); });
  await p.goto('file://' + path.resolve(process.argv[2]), { timeout: 180000 }); await p.waitForTimeout(1200);
  const b64 = await p.evaluate(async names => {
    const sr = 48000, c = new OfflineAudioContext(2, Math.ceil((names.length * 3 + 1) * sr), sr);
    SND.ctx = c; SND.on = true; SND.master = c.createGain(); SND.master.gain.value = 0.9; SND.master.connect(c.destination);
    SND.bus = [0, 0, 0, 0, 0].map(() => SND.master); SND.dst = SND.master; SND.sends = null;
    const len = Math.floor(sr * 1.6), nb = c.createBuffer(1, len, sr), d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; SND.noise = nb;
    sndReverb(c);
    names.forEach((n, i) => { SND.pf = 1; SND.dst = SND.master; SND.send = SND.sends ? SND.sends[SND_REV[n] || 0] : null; sndVoice(n, 0.05 + i * 3, 0.9); SND.send = null; });
    const buf = await c.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), o = new Int16Array(L.length * 2);
    for (let i = 0; i < L.length; i++) { o[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; o[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
    let bin = ''; const u8 = new Uint8Array(o.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(bin);
  }, NAMES);
  const pcm = Buffer.from(b64, 'base64'), h = Buffer.alloc(44), sr = 48000;
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(process.argv[3], Buffer.concat([h, pcm])); fs.writeFileSync(process.argv[3] + '.json', JSON.stringify(NAMES)); console.log('ok', NAMES.length); await b.close();
})();
