/* ===== audio.js ===== */
'use strict';
/* =====================================================================
   TON – alle Geräusche werden mit WebAudio erzeugt (keine Dateien). Übernommen aus RTS, Klänge neu für den Weltraum:
   Strahlen summen, Autokanonen poppen, Railguns knallen mit Nachhall, Torpedos zischen, Schilde klingen gläsern.
   Runde 18 (Klangregie): Stereolage über fünf feste Kanäle (statt eines Panners je Ton), Stimmenbegrenzung nach
   Klasse (Waffen, Explosionen) mit gleichzeitig klingenden Tönen, leichte Tonhöhenstreuung gegen Gleichförmigkeit,
   Absenken (duck) während einer Sprachmeldung. Die Zuordnung Ereignis → Klang steht in sfx.js.
   ===================================================================== */
const SND = { ctx: null, master: null, noise: null, on: true, vol: 0.7, last: {}, voices: 0, vT: 0, hold: false, duck: 1, bus: null, dst: null, pf: 1, act: [] };
SND.gain = function () { return SND.on ? 0.5 * Math.pow(SND.vol / 0.7, 1.6) * SND.duck : 0; };
/* Absenken für Sprachmeldungen: d 0 … 1, weich */
SND.setDuck = function (d) { SND.duck = d; if (SND.master && SND.ctx) try { SND.master.gain.setTargetAtTime(SND.gain(), SND.ctx.currentTime, 0.12); } catch (e) { /* egal */ } };
SND.init = function () {
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = SND.ctx = new AC();
    SND.master = c.createGain(); SND.master.gain.value = SND.gain();
    const comp = c.createDynamicsCompressor();
    SND.master.connect(comp); comp.connect(c.destination);
    SND.comp = comp;
    /* fünf Stereokanäle von links nach rechts; ohne StereoPanner alles in die Mitte */
    SND.bus = [-0.75, -0.38, 0, 0.38, 0.75].map(p => { if (!p || !c.createStereoPanner) return SND.master; const pn = c.createStereoPanner(); pn.pan.value = p; pn.connect(SND.master); return pn; });
    SND.dst = SND.master;
    MUS.init(c, comp);
    const len = Math.floor(c.sampleRate * 1.6), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    SND.noise = buf;
    MUS.resume();
  } catch (e) { SND.ctx = null; }
};
SND.setVol = function (v) { SND.vol = clamp(v, 0, 1); SND.on = SND.vol > 0; if (SND.master) SND.master.gain.value = SND.gain(); };
SND.sleep = function () { try { if (SND.ctx && SND.ctx.state === 'running') { SND.slept = true; SND.ctx.suspend().catch(() => {}); } } catch (e) { /* egal */ } };
SND.wake = function () { try { if (SND.ctx && SND.slept) { SND.slept = false; SND.ctx.resume().catch(() => {}); } } catch (e) { /* egal */ } };
function sndNoise(t0, dur, f0, f1, gain, type, q) {
  const c = SND.ctx, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  src.buffer = SND.noise; src.loop = true;
  fl.type = type || 'bandpass'; fl.Q.value = q || 0.9;
  f0 *= SND.pf; f1 *= SND.pf;
  fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(fl); fl.connect(g); g.connect(SND.dst || SND.master);
  src.start(t0, Math.random() * 0.8);
  src.stop(t0 + dur + 0.05);
}
function sndTone(t0, dur, f0, f1, gain, type) {
  const c = SND.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine';
  f0 *= SND.pf; f1 *= SND.pf;
  o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(SND.dst || SND.master);
  o.start(t0); o.stop(t0 + dur + 0.03);
}
const SND_MIN = { ability: 0.25, lance: 0.4, board: 0.3, warp: 0.1, super: 1, beam: 0.3, auto: 0.11, cannon: 0.14, rail: 0.3, torp: 0.2, pd: 0.15, bite: 0.12, acid: 0.16, shield: 0.22, shdown: 0.3, hit: 0.12, sizzle: 0.25, crunch: 0.14, tpop: 0.12, flank: 0.35, cloak: 0.3, decloak: 0.3, salvage: 0.5, sboom: 0.08, boom: 0.12, bigboom: 0.3, bboom: 0.5, vwarn: 1, vinfo: 1 };
/* Klasse je Klang: w Waffen und Treffer, x Explosionen, sonst Bedienung (unbegrenzt); Dauer grob für die Stimmenzählung */
const SND_CLS = { beam: 'w', auto: 'w', cannon: 'w', rail: 'w', torp: 'w', pd: 'w', bite: 'w', acid: 'w', shield: 'w', shdown: 'w', hit: 'w', sizzle: 'w', crunch: 'w', tpop: 'w', flank: 'w', cloak: 'w', decloak: 'w', salvage: 'w', sboom: 'x', boom: 'x', bigboom: 'x', bboom: 'x', lance: 'x', board: 'w', warp: 'w', ability: 'w' };
const SND_DUR = { rail: 0.5, torp: 0.45, shdown: 0.45, sizzle: 0.35, cloak: 0.6, decloak: 0.6, sboom: 0.4, boom: 0.6, bigboom: 1.3, bboom: 1.9, lance: 0.7, warp: 0.5 };
const SND_CAP = { w: 12, x: 8 };
SND.play = function (name, x, y, vol) {
  const c = SND.ctx;
  if (!c || !SND.on || name === 'none' || c.state !== 'running' || (typeof UI !== 'undefined' && UI.attract) || SND.hold) return;
  let v = vol === undefined ? 0.7 : vol, bus = 2;
  if (x !== undefined && R.g) {
    const cam = R.cam, q = R.w2s(x, y), W2 = R.cssW / 2, H2 = R.cssH / 2;
    const dx = Math.max(0, Math.abs(q.x - W2) - W2), dy = Math.max(0, Math.abs(q.y - H2) - H2), d = Math.hypot(dx, dy) / cam.z;
    const far = name === 'bigboom' || name === 'bboom' ? 2600 : 600;
    v *= clamp(1 - d / far, 0, 1) * clamp(0.55 + cam.z * 0.45, 0.5, 1.1);
    if (!(v >= 0.05)) return;
    bus = clamp(Math.round(2 + clamp((q.x - W2) / (W2 || 1), -1, 1) * 2), 0, 4);
  }
  const now = c.currentTime, cls = SND_CLS[name];
  /* gleichzeitig klingende Töne je Klasse: Waffen höchstens 12, Explosionen 8; volle Kanäle verlängern den Mindestabstand */
  let busy = 0;
  if (cls) { const A = SND.act; for (let i = A.length - 1; i >= 0; i--) { if (A[i][0] <= now) A.splice(i, 1); else if (A[i][1] === cls) busy++; } if (busy >= SND_CAP[cls]) return; }
  const mi = (SND_MIN[name] || 0.03) * (cls ? 1 + busy / 5 : 1);
  if (now - (SND.last[name] || 0) < mi) return;
  if (now - SND.vT > 0.1) { SND.vT = now; SND.voices = 0; }
  if (++SND.voices > 9) return;
  SND.last[name] = now;
  if (cls) { SND.act.push([now + (SND_DUR[name] || 0.25), cls]); v *= 1 - busy * 0.03; }
  const t = now + 0.001;
  SND.dst = SND.bus ? SND.bus[bus] : SND.master;
  SND.pf = cls ? 0.94 + Math.random() * 0.12 : 1;
  try { sndVoice(name, t, v); } finally { SND.dst = SND.master; SND.pf = 1; }
};
function sndVoice(name, t, v) {
  switch (name) {
    /* Waffen: kurz und weich, kein Dauerton */
    case 'beam': sndNoise(t, 0.22, 2600, 700, 0.05 * v, 'bandpass', 1.6); sndTone(t, 0.26, 880, 440, 0.045 * v, 'sine'); sndTone(t, 0.12, 1760, 1320, 0.02 * v, 'triangle'); break;
    case 'auto': sndNoise(t, 0.07, 700, 220, 0.11 * v, 'lowpass'); sndTone(t, 0.05, 160, 90, 0.06 * v, 'sine'); break;
    case 'cannon': sndNoise(t, 0.16, 500, 120, 0.2 * v, 'lowpass'); sndTone(t, 0.14, 110, 50, 0.18 * v, 'sine'); break;
    case 'rail': sndNoise(t, 0.05, 5000, 2000, 0.16 * v, 'highpass'); sndTone(t, 0.42, 1600, 160, 0.1 * v, 'sine'); sndNoise(t + 0.03, 0.45, 600, 80, 0.22 * v, 'lowpass'); break;
    case 'torp': sndNoise(t, 0.45, 300, 1600, 0.12 * v, 'bandpass', 1.2); sndTone(t, 0.25, 80, 55, 0.08 * v, 'sine'); break;
    case 'pd': sndNoise(t, 0.035, 2200, 1200, 0.04 * v, 'bandpass', 2); break;
    case 'bite': sndNoise(t, 0.08, 900, 300, 0.1 * v, 'lowpass'); sndTone(t, 0.09, 220, 90, 0.07 * v, 'sawtooth'); break;
    case 'acid': sndNoise(t, 0.18, 1800, 400, 0.07 * v, 'bandpass', 1.4); sndTone(t, 0.16, 520, 260, 0.04 * v, 'sine'); break;
    case 'shield': sndTone(t, 0.14, 1500, 1300, 0.035 * v, 'sine'); sndTone(t, 0.1, 2250, 2000, 0.015 * v, 'sine'); break;
    case 'hit': sndNoise(t, 0.09, 600, 200, 0.09 * v, 'lowpass'); break;
    case 'boom': sndNoise(t, 0.6, 500, 60, 0.32 * v, 'lowpass'); sndTone(t, 0.45, 70, 30, 0.3 * v, 'sine'); break;
    case 'bigboom': sndNoise(t, 1.3, 400, 40, 0.5 * v, 'lowpass'); sndTone(t, 1.0, 60, 24, 0.5 * v, 'sine'); sndNoise(t + 0.05, 0.4, 1400, 300, 0.12 * v, 'bandpass'); break;
    case 'bboom': sndNoise(t, 1.9, 350, 30, 0.6 * v, 'lowpass'); sndTone(t, 1.5, 52, 20, 0.55 * v, 'sine'); sndNoise(t + 0.1, 0.6, 1800, 300, 0.16 * v, 'bandpass'); sndTone(t + 0.2, 0.8, 200, 60, 0.08 * v, 'triangle'); break;
    /* Runde 18: Treffer je Waffenart, Explosion nach Größe, Tarnung, Bergung, Flanke */
    case 'sizzle': sndNoise(t, 0.32, 4200, 2400, 0.05 * v, 'highpass'); sndNoise(t + 0.02, 0.26, 1300, 700, 0.045 * v, 'bandpass', 3); break;
    case 'crunch': sndNoise(t, 0.06, 1500, 400, 0.12 * v, 'bandpass', 0.8); sndNoise(t + 0.045, 0.08, 700, 160, 0.11 * v, 'lowpass'); sndTone(t, 0.07, 140, 70, 0.06 * v, 'square'); break;
    case 'tpop': sndNoise(t, 0.12, 1900, 500, 0.08 * v, 'bandpass', 1.5); sndTone(t, 0.08, 620, 300, 0.04 * v, 'triangle'); break;
    case 'shdown': sndTone(t, 0.42, 1900, 420, 0.05 * v, 'sine'); sndTone(t, 0.3, 2870, 900, 0.025 * v, 'sine'); sndNoise(t, 0.4, 5000, 900, 0.05 * v, 'bandpass', 2.5); break;
    case 'flank': sndNoise(t, 0.05, 6500, 3000, 0.12 * v, 'highpass'); sndTone(t, 0.16, 440, 220, 0.06 * v, 'square'); sndTone(t + 0.02, 0.2, 180, 90, 0.07 * v, 'sine'); break;
    case 'cloak': sndTone(t, 0.6, 1500, 260, 0.045 * v, 'sine'); sndTone(t + 0.03, 0.55, 1530, 280, 0.03 * v, 'sine'); sndNoise(t, 0.5, 3200, 500, 0.04 * v, 'bandpass', 4); break;
    case 'decloak': sndTone(t, 0.45, 260, 1500, 0.045 * v, 'sine'); sndNoise(t, 0.4, 500, 3200, 0.04 * v, 'bandpass', 4); sndTone(t + 0.42, 0.08, 1800, 1700, 0.04 * v, 'triangle'); break;
    case 'salvage': [310, 847, 1290].forEach((f, i) => sndTone(t + i * 0.012, 0.16 - i * 0.03, f, f * 0.97, (0.05 - i * 0.012) * v, 'triangle')); sndNoise(t, 0.05, 2600, 1800, 0.05 * v, 'bandpass', 3); break;
    case 'sboom': sndNoise(t, 0.36, 900, 110, 0.22 * v, 'lowpass'); sndTone(t, 0.22, 120, 45, 0.15 * v, 'sine'); sndNoise(t, 0.08, 2400, 900, 0.06 * v, 'bandpass'); break;
    /* Signale vor Sprachmeldungen: Warnung (fallend, zweimal) und Hinweis (steigend) */
    case 'vwarn': [[880, 660], [880, 660]].forEach(([a, b], i) => { sndTone(t + i * 0.26, 0.11, a, a, 0.085 * v, 'triangle'); sndTone(t + i * 0.26 + 0.12, 0.12, b, b, 0.085 * v, 'triangle'); }); break;
    case 'vinfo': sndTone(t, 0.12, 660, 660, 0.06 * v, 'sine'); sndTone(t + 0.11, 0.2, 990, 990, 0.06 * v, 'sine'); break;
    /* Bedienung und Meldungen */
    case 'click': sndTone(t, 0.03, 900, 700, 0.06 * v, 'sine'); break;
    case 'order': sndTone(t, 0.05, 560, 760, 0.06 * v, 'sine'); break;
    case 'err': sndTone(t, 0.14, 200, 140, 0.08 * v, 'triangle'); break;
    case 'place': sndNoise(t, 0.14, 400, 150, 0.16 * v, 'lowpass'); sndTone(t, 0.1, 260, 190, 0.07 * v, 'sine'); break;
    case 'built': [523, 659, 784].forEach((f, i) => sndTone(t + i * 0.085, 0.16, f, f, 0.08 * v, 'sine')); break;
    case 'upgrade': [392, 523, 659, 784, 1047].forEach((f, i) => sndTone(t + i * 0.08, 0.18, f, f, 0.07 * v, 'sine')); break;
    case 'ready': sndTone(t, 0.08, 700, 700, 0.07 * v, 'sine'); sndTone(t + 0.09, 0.14, 930, 930, 0.07 * v, 'sine'); break;
    case 'lowpower': sndTone(t, 0.3, 240, 140, 0.09 * v, 'triangle'); break;
    case 'alert': sndTone(t, 0.13, 740, 740, 0.09 * v, 'triangle'); sndTone(t + 0.17, 0.13, 740, 740, 0.09 * v, 'triangle'); break;
    case 'alarm': for (let i = 0; i < 6; i++) sndTone(t + i * 0.2, 0.19, i % 2 ? 830 : 620, i % 2 ? 830 : 620, 0.08 * v, 'triangle'); break;
    case 'rank': sndTone(t, 0.1, 880, 880, 0.08 * v, 'sine'); sndTone(t + 0.1, 0.16, 1175, 1175, 0.08 * v, 'sine'); break;
    case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => sndTone(t + i * 0.14, 0.26, f, f, 0.09 * v, 'sine')); break;
    case 'lose': [392, 349, 311, 233].forEach((f, i) => sndTone(t + i * 0.24, 0.4, f, f, 0.09 * v, 'sine')); break;
    /* Runde 2: Fähigkeiten, Entern, Superwaffen */
    case 'ability': sndTone(t, 0.12, 620, 980, 0.06 * v, 'sine'); sndTone(t + 0.06, 0.18, 1240, 1240, 0.04 * v, 'triangle'); break;
    case 'lance': sndNoise(t, 0.12, 3000, 800, 0.14 * v, 'bandpass', 1.4); sndTone(t, 0.7, 1200, 180, 0.14 * v, 'sawtooth'); sndNoise(t + 0.1, 0.6, 500, 60, 0.2 * v, 'lowpass'); break;
    case 'board': sndNoise(t, 0.2, 1200, 400, 0.08 * v, 'bandpass', 2); sndTone(t, 0.08, 300, 420, 0.06 * v, 'square'); sndTone(t + 0.1, 0.08, 300, 420, 0.05 * v, 'square'); break;
    case 'warp': sndTone(t, 0.5, 300, 1800, 0.07 * v, 'sine'); sndNoise(t, 0.4, 800, 3000, 0.06 * v, 'bandpass', 1.2); break;
    case 'radio': sndNoise(t, 0.16, 2600, 1400, 0.05 * v, 'bandpass', 1.2); sndTone(t + 0.02, 0.06, 1320, 1320, 0.05 * v, 'square'); sndTone(t + 0.1, 0.07, 1760, 1760, 0.04 * v, 'square'); break;
    case 'super': sndTone(t, 1.2, 90, 40, 0.35 * v, 'sine'); sndNoise(t, 0.9, 200, 2500, 0.18 * v, 'bandpass', 0.8); [330, 415, 554].forEach((f, i) => sndTone(t + i * 0.12, 0.3, f, f, 0.06 * v, 'triangle')); break;
  }
}
