/* ===== net.js ===== */
'use strict';
/* =====================================================================
   MEHRSPIELER – zwei Geräte, direkt miteinander verbunden (WebRTC-Datenkanal, ohne Server). Übernommen aus RTS – Rapid
   Tactical Strike und an Rift Armada angepasst.
   Verbindung: Das eröffnende Gerät zeigt einen Code, das beitretende antwortet mit einem eigenen; beide als QR-Code und
   als Text zum Kopieren. Ein Code enthält nur, was die Geräte zum Finden brauchen (Adressen im lokalen Netz,
   Zugangsdaten, Prüfsumme des Schlüssels), kompakt verpackt. Ohne STUN finden sich die Geräte nur im selben WLAN oder
   Hotspot; mit »Über das Internet« fragen beide öffentliche Adressdienste, ein eigener TURN-Server leitet notfalls weiter.
   Gleichschritt: Beide Geräte rechnen dieselbe Partie. Ein Befehl wirkt D Runden später (Vorlauf 4 bis 15 Runden je nach
   Laufzeit), auf beiden Geräten in derselben Runde und Reihenfolge (kleinerer Sitz zuerst). Mit jeder Runde t schickt
   jedes Gerät sein Befehlspaket für t+D, auch ein leeres; Runde t wird erst gerechnet, wenn das Paket des anderen da ist.
   Alle fünf Sekunden vergleichen die Geräte eine Prüfsumme; weicht sie ab, übernimmt das beitretende Gerät den Spielstand
   des eröffnenden (Abgleich).
   Spielarten: 1 gegen 1, Gemeinsam (beide gegen zwei KI), 2 gegen 2 (jeder mit einem KI-Partner), Quarantine Line
   (beide halten das Siegel, dazu bis zu zwei KI-Verbündete).
   Nur in der Offline-Datei: Die Artefakt-Fassung im Browser darf keine direkten Verbindungen aufbauen.
   ===================================================================== */
const MP_PROTO = 1, MP_HASH = 150, MP_CHUNK = 16000, MP_CODE_V = 2, MP_PFX = 'RIFT';
const MP_STUN = ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'];
const MP_TYP = ['host', 'srflx', 'relay', 'prflx'], NET_KEY = 'ra.net';
const MP_KINDS = { vs: '1 gegen 1', coop: 'Gemeinsam', duo: '2 gegen 2', waves: 'Quarantine' };
const NET = {
  pc: null, dc: null, role: '', open: false, hello: false, beat: 0, connT: 0, lastRx: 0, rtt: [],
  peer: { f: 'mars', in: false },
  live: false, seat: -1, pseat: -1, D: 6, D0: 6, ep: 0, base: 0, nx: 6, out: [], mine: new Map(), theirs: new Map(), pmax: -1, pd: 6,
  hs: new Map(), rhs: new Map(), wait: '', rx: null, stall: 0, syncs: 0, soft: false, inet: false, okHash: 0
};
/* Wahl in der Lobby; bestimmt vom eröffnenden Gerät */
const MPL = { kind: 'vs', map: 'haven', lvl: 2, res: 'normal', allies: 0, seed: 1 };
const MPU = { pane: 'home', own: '', ownType: '', stream: null, scanT: 0, scanFor: '', canScan: false, busy: false, prevKey: '', inet: false, turn: { url: '', user: '', pass: '' } };
function mpBuildId() { return String(window.RA_BUILD || window.RA_VERSION || 'dev'); }

/* ------------------------------------------------------------------ Verbindungscode (Aufbau wie im RTS, Kennung »RIFT«) */
const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64S = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MP_FPA = ['sha-256', 'sha-384', 'sha-512', 'sha-1', 'sha-224'];
const MP_SETUP = ['actpass', 'active', 'passive'];
function b64enc(bytes, abc) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0), left = bytes.length - i;
    s += abc[(n >> 18) & 63] + abc[(n >> 12) & 63] + (left > 1 ? abc[(n >> 6) & 63] : '') + (left > 2 ? abc[n & 63] : '');
  }
  return s;
}
function b64dec(s, abc) {
  const out = [];
  let acc = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const v = abc.indexOf(s[i]);
    if (v < 0) return null;
    acc = ((acc << 6) | v) & 0xffffff; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
  }
  return out;
}
function mpBuild() { let h = 2166136261; const s = mpBuildId(); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function ip6bytes(s) {
  if (!/^[0-9a-f:]+$/i.test(s)) return null;
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const a = parts[0] ? parts[0].split(':') : [], b = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  if (parts.length === 1 && a.length !== 8) return null;
  const fill = 8 - a.length - b.length;
  if (fill < 0) return null;
  const words = a.concat(Array(parts.length === 2 ? fill : 0).fill('0'), b), out = [];
  for (const w of words) { if (!/^[0-9a-f]{1,4}$/i.test(w)) return null; const v = parseInt(w, 16); out.push(v >> 8, v & 255); }
  return out.length === 16 ? out : null;
}
const hex2 = v => (v < 16 ? '0' : '') + v.toString(16);
function mpPack(sdp, type, build, inet) {
  const get = k => { const m = new RegExp('^a=' + k + ':(.*)$', 'm').exec(sdp); return m ? m[1].trim() : ''; };
  const ufrag = get('ice-ufrag'), pwd = get('ice-pwd'), fpl = /^(\S+)\s+([0-9A-Fa-f:]+)$/.exec(get('fingerprint'));
  const setup = MP_SETUP.indexOf(get('setup') || 'actpass'), mid = get('mid') || '0', port = parseInt(get('sctp-port'), 10) || 5000;
  if (!ufrag || !pwd || !fpl || setup < 0) return null;
  const alg = MP_FPA.indexOf(fpl[1].toLowerCase()), fp = fpl[2].split(':').map(h => parseInt(h, 16));
  if (alg < 0 || !fp.length || fp.length > 64 || fp.some(v => !(v >= 0 && v < 256))) return null;
  const cands = [], re = /^a=candidate:\S+ 1 udp (\d+) (\S+) (\d+) typ (host|srflx|relay|prflx)(.*)$/gim;
  let m;
  while ((m = re.exec(sdp))) { const c = /network-cost (\d+)/.exec(m[5]); cands.push({ pri: +m[1], addr: m[2], port: +m[3], typ: MP_TYP.indexOf(m[4].toLowerCase()), cost: c ? +c[1] : 50 }); }
  cands.sort((a, b) => a.typ - b.typ || a.cost - b.cost || b.pri - a.pri);
  const o = [MP_CODE_V, (type === 'answer' ? 4 : 0) | (inet ? 8 : 0) | setup];
  const u16 = v => o.push((v >>> 8) & 255, v & 255), u32 = v => o.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const str = s => {
    const raw = /^[A-Za-z0-9+/]+$/.test(s) && s.length % 4 === 0 && s.length <= 168 ? b64dec(s, B64S) : null;
    if (raw) { o.push(128 | raw.length); o.push(...raw); return true; }
    if (s.length > 127 || !/^[\x21-\x7e]+$/.test(s)) return false;
    o.push(s.length); for (let i = 0; i < s.length; i++) o.push(s.charCodeAt(i));
    return true;
  };
  u32(build >>> 0);
  if (!str(ufrag) || !str(pwd)) return null;
  o.push(alg, fp.length); o.push(...fp);
  if (!str(mid)) return null;
  u16(port);
  const list = [], per = inet ? [3, 2, 2, 0] : [4, 0, 0, 0], used = [0, 0, 0, 0];
  for (const c of cands) {
    if (c.typ < 0 || used[c.typ] >= per[c.typ] || !(c.port > 0 && c.port < 65536)) continue;
    const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(c.addr), v6 = v4 ? null : ip6bytes(c.addr);
    const md = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/.exec(c.addr);
    const n0 = list.length;
    if (v4 && v4.slice(1).every(x => +x < 256)) list.push([1, c, v4.slice(1).map(Number)]);
    else if (v6) list.push([2, c, v6]);
    else if (md) list.push([3, c, md.slice(1).join('').match(/../g).map(h => parseInt(h, 16))]);
    else if (/^[A-Za-z0-9.:-]{1,100}$/.test(c.addr)) list.push([4, c, null]);
    if (list.length > n0) used[c.typ]++;
  }
  o.push(list.length);
  for (const [kind, c, bytes] of list) {
    o.push(kind | (c.typ << 4)); u32(c.pri); u16(c.port);
    if (bytes) o.push(...bytes); else str(c.addr);
  }
  return MP_PFX + b64enc(o, B64U);
}
function mpUnpack(code) {
  const s = String(code || '').replace(/\s+/g, ''), at = s.indexOf(MP_PFX);
  if (at < 0) return { err: 'code' };
  const b = b64dec(s.slice(at + MP_PFX.length), B64U);
  if (!b || b.length < 12) return { err: 'code' };
  let i = 0;
  const take = n => { if (i + n > b.length) throw new Error('kurz'); const r = b.slice(i, i + n); i += n; return r; };
  const u8 = () => take(1)[0], u16 = () => (u8() << 8) | u8(), u32 = () => ((u8() << 24) | (u8() << 16) | (u8() << 8) | u8()) >>> 0;
  const str = () => { const h = u8(); return h & 128 ? b64enc(take(h & 127), B64S) : String.fromCharCode(...take(h)); };
  try {
    if (u8() !== MP_CODE_V) return { err: 'ver' };
    const fl = u8(), type = fl & 4 ? 'answer' : 'offer', setup = MP_SETUP[fl & 3], inet = !!(fl & 8), build = u32();
    const ufrag = str(), pwd = str(), alg = MP_FPA[u8()], fp = take(u8()), mid = str(), port = u16(), n = u8(), cands = [];
    for (let k = 0; k < n; k++) {
      const kb = u8(), kind = kb & 15, typ = MP_TYP[kb >> 4], pri = u32(), cport = u16();
      if (!typ) return { err: 'code' };
      let addr;
      if (kind === 1) addr = take(4).join('.');
      else if (kind === 2) { const w = take(16), p = []; for (let j = 0; j < 16; j += 2) p.push(((w[j] << 8) | w[j + 1]).toString(16)); addr = p.join(':'); }
      else if (kind === 3) { const h = take(16).map(hex2).join(''); addr = h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20) + '.local'; }
      else addr = str();
      if (!/^[A-Za-z0-9.:-]+$/.test(addr)) return { err: 'code' };
      cands.push({ pri, addr, port: cport, typ });
    }
    if (!setup || !alg || !fp.length || !/^[A-Za-z0-9+/]+$/.test(ufrag) || !/^[A-Za-z0-9+/]+$/.test(pwd) || !/^[A-Za-z0-9_.-]+$/.test(mid)) return { err: 'code' };
    const sid = String(1e15 + Math.floor(Math.random() * 8e15));
    const lines = ['v=0', 'o=- ' + sid + ' 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE ' + mid, 'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0'];
    cands.forEach((c, k) => lines.push('a=candidate:' + (k + 1) + ' 1 udp ' + c.pri + ' ' + c.addr + ' ' + c.port + ' typ ' + c.typ + (c.typ !== 'host' ? ' raddr 0.0.0.0 rport 0' : '')));
    lines.push('a=ice-ufrag:' + ufrag, 'a=ice-pwd:' + pwd, 'a=fingerprint:' + alg + ' ' + fp.map(v => hex2(v).toUpperCase()).join(':'),
      'a=setup:' + setup, 'a=mid:' + mid, 'a=sctp-port:' + port, 'a=max-message-size:262144');
    return { type, build, inet, n: cands.length, ext: cands.filter(c => c.typ !== 'host').length, sdp: lines.join('\r\n') + '\r\n' };
  } catch (e) { return { err: 'code' }; }
}

/* ------------------------------------------------------------------ Verbindung */
function mpAvail() { return !!window.RA_OFFLINE && typeof RTCPeerConnection === 'function'; }
function mpIce(inet) {
  if (!inet) return [];
  const out = [{ urls: Array.isArray(window.RA_STUN) ? window.RA_STUN : MP_STUN }], t = MPU.turn;
  if (t.url && /^turns?:[^\s]+$/i.test(t.url)) out.push({ urls: t.url, username: t.user || '', credential: t.pass || '' });
  return out;
}
function mpNew(role, inet) {
  mpDrop();
  let pc;
  try { pc = new RTCPeerConnection({ iceServers: mpIce(inet) }); } catch (e) { pc = new RTCPeerConnection({ iceServers: mpIce(inet).slice(0, 1) }); }
  NET.inet = !!inet;
  const dc = pc.createDataChannel('ra', { negotiated: true, id: 0, ordered: true });
  NET.pc = pc; NET.dc = dc; NET.role = role; NET.open = false; NET.hello = false; NET.rtt = [];
  dc.onopen = () => { if (NET.dc === dc) mpOnOpen(); };
  dc.onclose = () => { if (NET.dc === dc) mpLost('drop'); };
  dc.onmessage = e => { if (NET.dc === dc) mpRecv(e.data); };
  pc.onconnectionstatechange = () => { if (NET.pc === pc && NET.open && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) mpLost('drop'); };
  return pc;
}
function mpDrop() {
  const pc = NET.pc, dc = NET.dc;
  NET.pc = null; NET.dc = null; NET.open = false; NET.hello = false;
  clearInterval(NET.beat); NET.beat = 0; clearTimeout(NET.connT);
  try { if (dc) dc.close(); } catch (e) { /* schon zu */ }
  try { if (pc) pc.close(); } catch (e) { /* schon zu */ }
}
function mpLeave() {
  const pc = NET.pc, dc = NET.dc;
  mpSend({ k: 'bye' });
  NET.pc = null; NET.dc = null; NET.open = false; NET.hello = false; NET.live = false; NET.seat = -1;
  clearInterval(NET.beat); NET.beat = 0;
  setTimeout(() => { try { if (dc) dc.close(); if (pc) pc.close(); } catch (e) { /* schon zu */ } }, 250);
  mpMenuSub();
}
function mpGather(pc) {
  return new Promise(res => {
    let done = false;
    const fin = () => { if (!done) { done = true; res(); } };
    if (pc.iceGatheringState === 'complete') { fin(); return; }
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') fin(); });
    pc.addEventListener('icecandidate', e => { if (!e.candidate) fin(); });
    setTimeout(fin, NET.inet ? 8000 : 3500);
  });
}
function mpSend(o) {
  const dc = NET.dc;
  if (!dc || dc.readyState !== 'open') return false;
  try { dc.send(JSON.stringify(o)); return true; } catch (e) { return false; }
}
async function mpHostStart() {
  if (MPU.busy || !mpAvail()) return;
  MPU.busy = true;
  MPU.own = ''; MPU.ownType = ''; $('mpOwn').value = '';
  mpMsg(L('Code wird erstellt …'));
  try {
    const pc = mpNew('host', MPU.inet);
    if (MPU.inet) mpMsg(L('Code wird erstellt, die Adresse von außen wird erfragt …'));
    await pc.setLocalDescription(await pc.createOffer());
    await mpGather(pc);
    if (NET.pc !== pc) return;
    const code = mpPack(pc.localDescription.sdp, 'offer', mpBuild(), NET.inet), d = code && mpUnpack(code);
    if (!d || d.err) throw new Error('code');
    if (!d.n) { mpDrop(); mpPane('home'); mpMsg(L('Kein Netzwerk gefunden. WLAN oder Hotspot einschalten und noch einmal versuchen.'), 'bad'); return; }
    mpShowCode(code, 'offer');
    if (NET.inet && !d.ext) mpMsg(L('Keine Adresse von außen gefunden: Ist das Gerät online? Im selben WLAN klappt es trotzdem.'), 'warn');
  } catch (e) {
    mpDrop(); mpPane('home'); mpMsg(L('Die Verbindung ließ sich nicht vorbereiten.'), 'bad');
  } finally { MPU.busy = false; }
}
function mpCodeErr(d, want) {
  if (!d || d.err === 'code') return L('Das ist kein gültiger Code.');
  if (d.err === 'ver' || d.build !== mpBuild()) return L('Das andere Gerät hat eine andere Fassung des Spiels. Bitte auf beiden Geräten dieselbe Datei öffnen.');
  if (d.type !== want) return want === 'offer' ? L('Das ist ein Antwort-Code. Hier gehört der Code des eröffnenden Geräts hin.') : L('Das ist der eigene Code. Hier gehört der Antwort-Code des anderen Geräts hin.');
  if (!d.n) return L('Der Code enthält keine Adresse. Das andere Gerät braucht WLAN oder einen Hotspot.');
  return null;
}
async function mpJoinCode(code) {
  if (MPU.busy || !mpAvail()) return;
  const d = mpUnpack(code), why = mpCodeErr(d, 'offer');
  if (why) { mpMsg(why, 'bad'); SND.play('err'); return; }
  MPU.busy = true;
  MPU.own = ''; MPU.ownType = ''; $('mpOwn').value = '';
  mpMsg(L('Antwort wird erstellt …'));
  try {
    const pc = mpNew('guest', d.inet || MPU.inet);
    await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await mpGather(pc);
    if (NET.pc !== pc) return;
    const ans = mpPack(pc.localDescription.sdp, 'answer', mpBuild(), NET.inet), a = ans && mpUnpack(ans);
    if (!a || a.err) throw new Error('code');
    if (!a.n) { mpDrop(); mpPane('enter'); mpMsg(L('Kein Netzwerk gefunden. WLAN oder Hotspot einschalten und noch einmal versuchen.'), 'bad'); return; }
    mpShowCode(ans, 'answer');
  } catch (e) {
    mpDrop(); mpPane('enter'); mpMsg(L('Mit diesem Code klappt es nicht. Bitte auf dem eröffnenden Gerät neu eröffnen.'), 'bad');
  } finally { MPU.busy = false; }
}
async function mpAnswerCode(code) {
  const pc = NET.pc;
  if (MPU.busy || !pc || NET.role !== 'host') return;
  const d = mpUnpack(code), why = mpCodeErr(d, 'answer');
  if (why) { mpMsg(why, 'bad'); SND.play('err'); return; }
  if (pc.signalingState !== 'have-local-offer') { mpMsg(L('Verbinde …')); return; }
  MPU.busy = true;
  try {
    await pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
    mpMsg(L('Verbinde …'));
    clearTimeout(NET.connT);
    NET.connT = setTimeout(() => { if (NET.pc === pc && !NET.open) mpMsg(NET.inet ? L('Noch keine Verbindung. Strenge Netze (Firma, manche Mobilfunknetze) brauchen einen eigenen TURN-Server.') : L('Noch keine Verbindung. Sind beide Geräte im selben WLAN oder Hotspot?'), 'warn'); }, NET.inet ? 20000 : 12000);
  } catch (e) { mpMsg(L('Dieser Antwort-Code passt nicht. Bitte neu eröffnen.'), 'bad'); }
  finally { MPU.busy = false; }
}
function mpOnOpen() {
  NET.open = true; NET.lastRx = performance.now();
  clearTimeout(NET.connT);
  clearInterval(NET.beat);
  NET.beat = setInterval(mpBeat, 1000);
  mpSend({ k: 'hi', v: MP_PROTO, b: mpBuildId() });
}
function mpBeat() {
  if (!NET.open) return;
  mpSend({ k: 'p', t: performance.now() });
  const quiet = performance.now() - NET.lastRx;
  if (NET.live) mpAdapt();
  if (NET.live && UI.kind === 'mp' && !UI.paused && !UI.endShown && quiet > 15000 && $('mpLost').hidden) mpLost('quiet');
  if (!$('mp').hidden && MPU.pane === 'lobby') mpLobbyState();
}
function mpRtt() { if (!NET.rtt.length) return -1; const a = NET.rtt.slice().sort((x, y) => x - y); return a[a.length >> 1]; }
function mpRecv(data) {
  NET.lastRx = performance.now();
  let m;
  try { m = JSON.parse(data); } catch (e) { return; }
  if (!m || typeof m.k !== 'string') return;
  if (NET.soft) mpUnlost();
  switch (m.k) {
    case 'hi':
      if (m.v !== MP_PROTO || m.b !== mpBuildId()) { mpDrop(); mpPane('home'); mpMsg(L('Das andere Gerät hat eine andere Fassung des Spiels. Bitte auf beiden Geräten dieselbe Datei öffnen.'), 'bad'); return; }
      NET.hello = true;
      if (NET.role === 'host') { MPL.seed = 1 + ((Math.random() * 999999) | 0); if (MENU.mode === 'skirmish' && MAPS[MENU.map] && !MAPS[MENU.map].waves) MPL.map = MENU.map; }
      SND.play('upgrade'); buzz(30);
      mpLobbyEnter();
      break;
    case 'p': mpSend({ k: 'q', t: m.t }); break;
    case 'q': { const r = performance.now() - m.t; if (r >= 0 && r < 60000) { NET.rtt.push(r); if (NET.rtt.length > 9) NET.rtt.shift(); } break; }
    case 'st': if (PLAYABLE.indexOf(m.f) >= 0) NET.peer.f = m.f; NET.peer.in = !!m.in; mpLobbyRender(); break;
    case 'cfg': if (NET.role === 'guest' && m.s) { mpCfgApply(m.s); mpLobbyRender(); } break;
    case 'go': if (NET.role === 'guest') mpGo(m); break;
    case 'no': if (NET.role === 'host') mpRefused(); break;
    case 'b': mpRxBatch(m); break;
    case 'h': if (NET.live && m.e === NET.ep && typeof m.x === 'number') { NET.rhs.set(m.x, m.h >>> 0); mpCheckHash(m.x); } break;
    case 'ds': if (NET.role === 'host' && NET.live && m.e === NET.ep) mpSyncSend(); break;
    case 'sy': if (NET.role === 'guest' && NET.live) mpRxSync(m); break;
    case 'pz': if (NET.live && UI.kind === 'mp' && !UI.endShown && !!m.on !== UI.paused) setPaused(!!m.on, true); break;
    case 'bye': mpLost('bye'); break;
  }
}

/* ------------------------------------------------------------------ Lobby */
function mpKindNp(kind) { return kind === 'vs' ? 2 : kind === 'waves' ? 2 + (MPL.allies | 0) : 4; }
function mpMaps(kind) { if (kind === 'waves') return ['quarantine']; const np = mpKindNp(kind); return MAP_ORDER.filter(k => MAPS[k].np.indexOf(np) >= 0).concat(edMapIds(np)); }   /* KARTENEDITOR: eigene Karten */
function mpCfgApply(s) {
  if (MP_KINDS[s.kind]) MPL.kind = s.kind;
  if (s.custom && typeof s.map === 'string') edPeerMap(s.map, s.custom);   /* KARTENEDITOR: Karte des eröffnenden Geräts eintragen */
  if (MAPS[s.map]) MPL.map = s.map;
  if (AI_LEVELS[s.lvl]) MPL.lvl = s.lvl;
  if (s.res === 'low' || s.res === 'normal' || s.res === 'rich') MPL.res = s.res;
  if (s.allies >= 0 && s.allies <= 2) MPL.allies = s.allies | 0;
  if (s.seed > 0 && s.seed < 1e7) MPL.seed = s.seed | 0;
}
function mpCfgSend() { if (NET.role === 'host') mpSend({ k: 'cfg', s: Object.assign({}, MPL, { custom: edLayoutOf(MPL.map) }) }); }   /* KARTENEDITOR: Layout mitschicken */
function mpSendSt() { mpSend({ k: 'st', f: MENU.faction, in: !$('mp').hidden && MPU.pane === 'lobby' }); }
function mpLobbyEnter() {
  mpScanStop();
  $('mp').hidden = false;
  mpPane('lobby');
  mpMsg('');
  mpFixMap();
  mpCfgSend(); mpSendSt();
  mpLobbyRender();
  mpMenuSub();
}
function mpFixMap() { const ok = mpMaps(MPL.kind); if (ok.indexOf(MPL.map) < 0) MPL.map = ok[0]; }
/* Sitze aus der Karte: bei vier Plätzen ist der Partner der nächstgelegene Start. 1 gegen 1: Sitze 0 und 1. Gemeinsam:
   beide Menschen auf einer Seite gegen zwei KI. 2 gegen 2: jeder Mensch mit einem KI-Partner. Quarantine: alle in Team 0. */
function mpSeats(kind, map, seed) {
  const np = mpKindNp(kind);
  if (kind === 'vs') return { np, host: 0, guest: 1, team: [0, 1], ai: [] };
  if (kind === 'waves') { const ai = []; for (let i = 2; i < np; i++) ai.push(i); return { np, host: 0, guest: 1, team: Array(np).fill(0), ai }; }
  const st = generateMap(map, np, seed).starts, mate = i => { let b = -1, bd = 1e9; for (let j = 0; j < np; j++) if (j !== i) { const d = hyp(st[j].x - st[i].x, st[j].y - st[i].y); if (d < bd) { bd = d; b = j; } } return b; };
  const m0 = mate(0), rest = [0, 1, 2, 3].filter(i => i !== 0 && i !== m0), team = [];
  for (let i = 0; i < 4; i++) team[i] = i === 0 || i === m0 ? 0 : 1;
  if (kind === 'coop') return { np, host: 0, guest: m0, team, ai: rest };
  return { np, host: 0, guest: rest[0], team, ai: [m0, rest[1]] };
}
function mpLobbyRender() {
  if ($('mp').hidden || MPU.pane !== 'lobby') return;
  const host = NET.role === 'host', ro = !host;
  mpFixMap();
  segInit('mpFac', PLAYABLE.map(f => [f, FACTIONS[f].name.replace('The ', '').replace('Martian ', '').replace('Golden ', '')]), () => MENU.faction, v => { MENU.faction = v; savePrefs(); mpSendSt(); mpLobbyRender(); });
  const pf = FACTIONS[NET.peer.f] || FACTIONS.mars;
  $('mpPeerN').textContent = L(pf.name); $('mpPeerN').style.color = pf.team;
  const seg = (id, opts, key) => { segInit(id, opts, () => MPL[key], v => { MPL[key] = v; mpFixMap(); mpCfgSend(); mpLobbyRender(); }); $(id).classList.toggle('ro', ro); if (ro) $(id).querySelectorAll('button').forEach(b => { b.disabled = true; }); };
  seg('mpKind', Object.keys(MP_KINDS).map(k => [k, MP_KINDS[k]]), 'kind');
  seg('mpMap', mpMaps(MPL.kind).map(k => [k, MAPS[k].name]), 'map');
  seg('mpLvl', [[1, 'Leicht'], [2, 'Mittel'], [3, 'Schwer']], 'lvl');
  seg('mpRes', [['low', 'Knapp'], ['normal', 'Normal'], ['rich', 'Reich']], 'res');
  seg('mpAllies', [[0, '0'], [1, '1'], [2, '2']], 'allies');
  $('mpLvlRow').hidden = MPL.kind === 'vs' || (MPL.kind === 'waves' && !MPL.allies);
  $('mpAlliesRow').hidden = MPL.kind !== 'waves';
  $('mpResRow').hidden = MPL.kind === 'waves';
  $('mpRoll').hidden = ro || MPL.kind === 'waves';
  setText('mpKindInfo', L(MPL.kind === 'vs' ? 'Ihr spielt gegeneinander.' : MPL.kind === 'coop' ? 'Ihr seid ein Team gegen zwei KI-Gegner.' : MPL.kind === 'duo' ? 'Ihr spielt gegeneinander, jeder mit einem KI-Partner.' : 'Ihr haltet gemeinsam das Siegel gegen 20 Wellen der Brood.'));
  mpPreview();
  mpLobbyState();
}
/* Vorschau: Karte mit Startplätzen (du, Verbündete, Gegner) */
function mpPreview() {
  const key = [MPL.kind, MPL.map, MPL.seed, MPL.allies, NET.role].join('/');
  if (MPU.prevKey === key) return;
  MPU.prevKey = key;
  const cv = $('mpPrev'), x = cv.getContext('2d'), st = mpSeats(MPL.kind, MPL.map, MPL.seed), me = NET.role === 'host' ? st.host : st.guest;
  let m = null;
  try { m = generateMap(MPL.map, st.np, MPL.seed); } catch (e) { m = null; }
  x.fillStyle = '#05070f'; x.fillRect(0, 0, cv.width, cv.height);
  if (!m) return;
  const k = cv.width / Math.max(m.w, m.h), ox = (cv.width - m.w * k) / 2, oy = (cv.height - m.h * k) / 2;
  x.strokeStyle = 'rgba(120,40,20,0.8)'; x.lineWidth = Math.max(2, EDGE * k); x.strokeRect(ox, oy, m.w * k, m.h * k);
  for (const f of m.fields) { x.fillStyle = 'rgba(110,100,90,0.35)'; x.beginPath(); x.arc(ox + f.x * k, oy + f.y * k, f.r * k, 0, TAU); x.fill(); }
  for (const o of m.rocks) { x.fillStyle = '#5a554f'; x.beginPath(); x.arc(ox + o.x * k, oy + o.y * k, Math.max(1, o.r * k), 0, TAU); x.fill(); }
  for (const n of m.nodes) { x.fillStyle = n.kind === 'ice' ? '#8fc3e6' : '#c89050'; x.beginPath(); x.arc(ox + n.x * k, oy + n.y * k, Math.max(1.5, n.r * k), 0, TAU); x.fill(); }
  for (const s of m.sites) { x.strokeStyle = '#9ff0c0'; x.lineWidth = 1.5; x.strokeRect(ox + s.x * k - 3, oy + s.y * k - 3, 6, 6); }
  if (MPL.kind === 'waves') { x.strokeStyle = '#9ff0c0'; x.lineWidth = 2; x.beginPath(); x.arc(ox + m.w / 2 * k, oy + m.h / 2 * k, 6, 0, TAU); x.stroke(); }
  m.starts.forEach((s, i) => { const col = i === me ? '#ffffff' : st.team[i] === st.team[me] ? '#7ddc6b' : '#ff5b47'; x.fillStyle = col; x.beginPath(); x.arc(ox + s.x * k, oy + s.y * k, 6, 0, TAU); x.fill(); x.fillStyle = '#05070f'; x.font = 'bold 9px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(i === st.host ? 'H' : i === st.guest ? 'G' : 'KI'.slice(0, 1), ox + s.x * k, oy + s.y * k + 0.5); });
  setText('mpMapInfo', L(MAPS[MPL.map].name) + ' · ' + L('{0} Plätze', st.np) + ' · ' + L('weiß: du, grün: Verbündete, rot: Gegner'));
}
function mpLobbyState() {
  const host = NET.role === 'host', r = mpRtt(), ok = NET.open && NET.hello;
  setText('mpStateT', ok ? L('Verbunden') + (r >= 0 ? ' · ' + Math.round(r) + ' ms' : '') : L('Getrennt'));
  $('mpState').classList.toggle('on', ok);
  const peerIn = ok && NET.peer.in;
  setText('mpPeerS', peerIn ? L('bereit') : L('nicht in der Lobby'));
  $('mpStart').hidden = !host;
  $('mpStart').disabled = !peerIn;
  setText('mpLobbyNote', host ? (peerIn ? L('Ihr seid bereit. Du startest für beide.') : L('Warte, bis dein Mitspieler in der Lobby ist.')) : L('Das eröffnende Gerät wählt Spielart und Karte und startet.'));
}
/* Start durch das eröffnende Gerät: Aufstellung festlegen, an beide verteilen */
function mpStart() {
  if (NET.role !== 'host' || !NET.open || !NET.peer.in) return;
  const st = mpSeats(MPL.kind, MPL.map, MPL.seed), players = [], used = [MENU.faction, NET.peer.f];
  const rnd = () => { const free = PLAYABLE.filter(f => used.indexOf(f) < 0), list = free.length ? free : PLAYABLE, f = list[(Math.random() * list.length) | 0]; used.push(f); return f; };
  for (let i = 0; i < st.np; i++) {
    const team = st.team[i];
    if (i === st.host) players.push({ faction: MENU.faction, human: true, team });
    else if (i === st.guest) players.push({ faction: NET.peer.f, human: true, team });
    else players.push({ faction: rnd(), ai: MPL.lvl, team });
  }
  const res = MPL.res === 'low' ? { ice: 700, ore: 300 } : MPL.res === 'rich' ? { ice: 2500, ore: 1400 } : undefined;
  const opts = JSON.parse(JSON.stringify({ map: MPL.map, seed: MPL.seed, players, res, mode: MPL.kind === 'waves' ? 'quarantine' : undefined, mp: 1, custom: edLayoutOf(MPL.map) }));   /* KARTENEDITOR: custom */
  const D = clamp(Math.ceil(((Math.max(0, mpRtt()) / 2) + 120) / (STEP * 1000)), 5, 12);
  if (!mpSend({ k: 'go', opts, seat: st.guest, hs: st.host, D })) return;
  mpLockstep(st.host, st.guest, D);
  $('mp').hidden = true;
  SND.init();
  launch(() => beginGame(opts, 'mp', null, st.host));
}
function mpGo(m) {
  const o = m.opts;
  const bad = !o || !Array.isArray(o.players) || o.players.length < 2 || o.players.length > 4 || !(MAPS[o.map] || o.custom) || !(o.seed > 0) ||
    o.players.some(p => !p || PLAYABLE.indexOf(p.faction) < 0) || !(m.seat >= 0 && m.seat < o.players.length) || !o.players[m.seat].human;
  if (bad) { mpMsg(L('Das andere Gerät hat unbekannte Einstellungen geschickt.'), 'bad'); return; }
  if (UI.g && !UI.attract && !UI.endShown && UI.kind !== 'mp') { mpSend({ k: 'no' }); return; }
  mpLockstep(m.seat, m.hs | 0, m.D);
  mpScanStop();
  $('mp').hidden = true;
  SND.init();
  launch(() => beginGame(o, 'mp', null, m.seat));
}
function mpRefused() {
  if (UI.kind !== 'mp' || !UI.g || UI.g.tick > 30 * 30) return;
  NET.live = false; NET.seat = -1;
  toMenu();
  mpLobbyEnter();
  mpMsg(L('Dein Mitspieler ist gerade in einem eigenen Gefecht.'), 'warn');
}

/* ------------------------------------------------------------------ Gleichschritt */
function mpLockstep(seat, pseat, D) {
  NET.seat = seat; NET.pseat = pseat; NET.D = NET.D0 = NET.pd = clamp(D | 0, 2, 20); NET.ep = 0; NET.base = 0; NET.nx = NET.D0;
  NET.out = []; NET.mine.clear(); NET.theirs.clear(); NET.pmax = -1; NET.hs.clear(); NET.rhs.clear();
  NET.wait = ''; NET.rx = null; NET.stall = 0; NET.syncs = 0; NET.okHash = 0; NET.soft = false; NET.live = false; NET.peer.in = false;
}
function mpGameStart(g) { g.net = mpCmd; NET.live = true; NET.lastRx = performance.now(); }
/* Vorprüfung: Was sicher scheitert, meldet die Bedienung sofort; alles andere entscheidet die Ausführung D Runden später */
function mpPre(g, c) {
  const p = g.players[c.p];
  if (!p || !p.alive) return 'Nicht möglich';
  switch (c.t) {
    case 'train': {
      const d = SHIPS[c.id];
      if (!d) return 'Nicht möglich';
      const r = trainReq(g, c.p, c.id);
      if (r) return r;
      if (p.cpUse + p.queued + d.cp > p.cpMax) return 'Kommandopunkte reichen nicht';
      return canPay(p, shipCost(p, d)) ? null : 'Nicht genug Rohstoffe';
    }
    case 'build': {
      const d = BLDG[p.faction][c.role];
      if (!d) return 'Nicht möglich';
      const r = buildReq(g, c.p, c.role) || canPlace(g, c.p, c.role, c.x, c.y);
      return r || (canPay(p, bcost(p, d)) ? null : 'Nicht genug Rohstoffe');
    }
  }
  return null;
}
function mpCmd(c) {
  const g = UI.g;
  if (!NET.live || NET.seat < 0) return 'Nicht möglich';
  const why = mpPre(g, c);
  if (why) return why;
  NET.out.push(JSON.parse(JSON.stringify(c)));
  return null;
}
function mpRxBatch(m) {
  if (NET.seat < 0 || m.e !== NET.ep || typeof m.x !== 'number' || !Array.isArray(m.c) || m.x < NET.base + NET.D0) return;
  const list = [];
  for (const c of m.c) if (c && typeof c === 'object' && typeof c.t === 'string') { c.p = NET.pseat; list.push(c); }
  NET.theirs.set(m.x, list);
  if (m.x > NET.pmax) { NET.pmax = m.x; NET.pd = m.d > 0 ? m.d : NET.D0; }
}
function mpReady(g) { return !NET.wait && (g.tick < NET.base + NET.D0 || NET.theirs.has(g.tick)); }
function mpBehind(g) { return NET.pmax < 0 ? 0 : NET.pmax - NET.pd - g.tick; }
function mpAdapt() {
  const a = NET.rtt.slice(-6);
  if (!a.length) return;
  const want = clamp(Math.ceil((Math.max(...a) / 2 + 70) / (STEP * 1000)), 4, 15);
  if (want > NET.D) NET.D = want; else if (want < NET.D) NET.D--;
}
function mpStep(g) {
  const T = g.tick, target = T + NET.D;
  if (NET.nx <= target) {
    while (NET.nx < target) { NET.mine.set(NET.nx, []); mpSend({ k: 'b', e: NET.ep, x: NET.nx, d: NET.D, c: [] }); NET.nx++; }
    const own = NET.out;
    NET.out = [];
    NET.mine.set(target, own);
    mpSend({ k: 'b', e: NET.ep, x: target, d: NET.D, c: own });
    NET.nx = target + 1;
  }
  const early = T < NET.base + NET.D0, a = early ? null : NET.mine.get(T), b = early ? null : NET.theirs.get(T);
  NET.mine.delete(T); NET.theirs.delete(T);
  const lists = NET.seat < NET.pseat ? [a, b] : [b, a];
  for (const l of lists) {
    if (!l) continue;
    for (const c of l) {
      g.log.push(T, c);
      const r = execCmd(g, c);
      if (c.p === NET.seat && typeof r === 'string') { toast(L(r), 'warn'); SND.play('err'); }
    }
  }
  stepGame(g);
  if (g.tick % MP_HASH === 0) mpHash(g);
}
function mpHash(g) {
  const x = g.tick, h = stateHash(g);
  NET.hs.set(x, h);
  mpSend({ k: 'h', e: NET.ep, x, h });
  for (const k of NET.hs.keys()) if (k < x - MP_HASH * 12) NET.hs.delete(k);
  for (const k of NET.rhs.keys()) if (k < x - MP_HASH * 12) NET.rhs.delete(k);
  mpCheckHash(x);
}
function mpCheckHash(x) {
  if (!NET.hs.has(x) || !NET.rhs.has(x)) return;
  const same = NET.hs.get(x) === NET.rhs.get(x);
  NET.hs.delete(x); NET.rhs.delete(x);
  if (same) { NET.okHash++; return; }
  NET.syncs++;
  toast(L('Abgleich mit dem Mitspieler …'), 'warn');
  if (NET.role === 'host') mpSyncSend();
  else { NET.wait = 'sync'; mpSend({ k: 'ds', e: NET.ep, x }); }
}
function mpSyncSend() {
  const g = UI.g;
  if (!g || !NET.live) return;
  let txt;
  try { txt = JSON.stringify(saveGame(g)); } catch (e) { return; }
  NET.ep++;
  const n = Math.ceil(txt.length / MP_CHUNK);
  for (let i = 0; i < n; i++) mpSend({ k: 'sy', e: NET.ep, i, n, d: txt.slice(i * MP_CHUNK, (i + 1) * MP_CHUNK) });
  const g2 = loadGame(JSON.parse(txt));
  if (g2) mpSwap(g2);
  mpPipeReset(UI.g.tick);
}
function mpRxSync(m) {
  if (!(m.e > NET.ep) || !(m.n > 0) || !(m.i >= 0 && m.i < m.n) || typeof m.d !== 'string') return;
  if (!NET.rx || NET.rx.e !== m.e) NET.rx = { e: m.e, n: m.n, got: 0, parts: [] };
  NET.wait = 'sync';
  if (NET.rx.parts[m.i] === undefined) { NET.rx.parts[m.i] = m.d; NET.rx.got++; }
  if (NET.rx.got < NET.rx.n) return;
  const txt = NET.rx.parts.join('');
  NET.rx = null;
  let g2 = null;
  try { g2 = loadGame(JSON.parse(txt)); } catch (e) { g2 = null; }
  if (!g2) { mpLost('sync'); return; }
  NET.ep = m.e;
  mpSwap(g2);
  mpPipeReset(g2.tick);
  toast(L('Abgleich fertig'), 'good');
}
function mpPipeReset(base) { NET.base = base; NET.nx = base + NET.D0; NET.mine.clear(); NET.theirs.clear(); NET.pmax = -1; NET.hs.clear(); NET.rhs.clear(); NET.wait = ''; }
function mpSwap(g2) {
  const cam = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
  g2.net = mpCmd;
  UI.g = g2; UI.P = g2.players[UI.me];
  R.setGame(g2, UI.me);
  R.cam.x = cam.x; R.cam.y = cam.y; R.cam.z = cam.z; R.clampCam();
  if (UI.selB && !g2.byId.get(UI.selB)) UI.selB = 0;
  for (const id of [...UI.sel]) if (!g2.byId.get(id)) UI.sel.delete(id);
}
function mpStallTick(starved, dt) {
  NET.stall = starved ? NET.stall + dt : 0;
  const show = NET.wait === 'sync' || NET.stall > 1.2;
  const el = $('mpWait');
  if (el.hidden === show) el.hidden = !show;
  if (show) setText('mpWaitT', NET.wait === 'sync' ? L('Abgleich mit dem Mitspieler …') : L('Warte auf Mitspieler … {0} s', Math.floor(NET.stall)));
}

/* ------------------------------------------------------------------ Verbindung weg */
function mpLost(why) {
  if (why !== 'quiet') mpDrop();
  const g = UI.g;
  if (UI.kind === 'mp' && NET.live && !UI.endShown && g && !g.over) {
    NET.soft = why === 'quiet';
    setText('mpLostT', why === 'bye' ? L('Mitspieler hat das Gefecht verlassen') : why === 'quiet' ? L('Keine Antwort vom Mitspieler') : L('Verbindung abgebrochen'));
    setText('mpLostB', why === 'quiet' ? L('Seit einigen Sekunden kommt nichts mehr an. Kommt die Verbindung zurück, geht es von selbst weiter.') : L('Du kannst weiterspielen: Die KI übernimmt die Seite deines Mitspielers.'));
    $('mpLost').hidden = false;
    $('pause').hidden = true; UI.paused = false;
    if (!NET.soft) SND.play('alarm');
    mpMenuSub();
    return;
  }
  if (why === 'quiet') return;
  NET.live = false; NET.seat = -1;
  if (UI.kind === 'mp' && UI.endShown) { $('eAgain').hidden = true; toast(L('Die Verbindung zum Mitspieler ist getrennt.'), 'warn'); }
  if (!$('mp').hidden) { mpScanStop(); mpPane('home'); mpMsg(why === 'bye' ? L('Dein Mitspieler hat die Verbindung getrennt.') : L('Die Verbindung ist abgebrochen.'), 'bad'); }
  mpMenuSub();
}
function mpUnlost() { NET.soft = false; if (!$('mpLost').hidden && NET.open) $('mpLost').hidden = true; }
/* Die KI übernimmt den Sitz des Mitspielers; eigene, noch nicht ausgeführte Befehle werden jetzt ausgeführt */
function mpTakeover() {
  const g = UI.g;
  if (!g || UI.kind !== 'mp' || NET.seat < 0) return;
  const ps = NET.pseat, pend = [];
  mpDrop();
  NET.live = false; NET.soft = false; NET.wait = '';
  [...NET.mine.keys()].sort((a, b) => a - b).forEach(x => { if (x >= g.tick) pend.push(...NET.mine.get(x)); });
  pend.push(...NET.out);
  NET.mine.clear(); NET.theirs.clear(); NET.out = [];
  g.net = null;
  for (const c of pend) issueCmd(g, c);
  const p = g.players[ps];
  if (p && p.alive) { p.ai = aiInit(AI_LEVELS[MPL.lvl] ? MPL.lvl : 2); p.human = false; }
  NET.seat = -1;
  UI.kind = 'skirmish';
  $('mpLost').hidden = true; $('mpWait').hidden = true;
  UI.paused = false; $('pause').hidden = true;
  toast(L('Die KI übernimmt die Seite deines Mitspielers.'), 'warn');
  mpMenuSub();
}
function mpToLobby() {
  NET.live = false; NET.seat = -1;
  toMenu();
  if (NET.open && NET.hello) mpLobbyEnter(); else mpOpen();
}

/* ------------------------------------------------------------------ Fenster »Mehrspieler« */
const MP_PANES = { home: 'mpHome', show: 'mpShow', enter: 'mpEnter', cam: 'mpCam', lobby: 'mpLobby' };
function mpPane(p) {
  MPU.pane = p;
  for (const k in MP_PANES) $(MP_PANES[k]).hidden = k !== p;
  setText('mpTitle', p === 'lobby' ? L('Mehrspieler: Lobby') : L('Mehrspieler'));
}
function mpMsg(s, cls) { const el = $('mpMsg'); el.hidden = !s; el.className = 'mpMsg' + (cls ? ' ' + cls : ''); el.textContent = s || ''; }
function mpOpen() {
  $('mp').hidden = false;
  mpMsg('');
  if (NET.open && NET.hello) { mpLobbyEnter(); return; }
  mpPane('home');
  const ok = mpAvail();
  $('mpHost').disabled = !ok; $('mpJoin').disabled = !ok;
  $('mpNet').hidden = !ok; mpNetRender();
  const off = $('mpOff');
  off.hidden = ok;
  if (!ok) off.textContent = !window.RA_OFFLINE ? L('Mehrspieler gibt es nur in der Offline-Datei: auf beide Geräte laden und dort öffnen.') : L('Dieser Browser kann keine direkte Verbindung zwischen Geräten aufbauen.');
}
function mpClose() {
  mpScanStop();
  $('mp').hidden = true;
  if (NET.open && NET.hello) mpSendSt();
  else if (NET.pc && !NET.open) mpDrop();
  menuRender();
}
function mpShowCode(code, type) {
  MPU.own = code; MPU.ownType = type;
  const q = qrMake(code, 'M') || qrMake(code, 'L');
  const cv = $('mpQr');
  if (q) {
    const n = q.size + 8, want = Math.max(150, Math.min(250, innerWidth * (innerWidth < 640 ? 0.72 : 0.4), innerHeight * 0.52));
    cv.hidden = false; qrDraw(cv, q, n * 6);
    cv.style.width = n * Math.max(2, Math.floor(want / n)) + 'px';
  } else cv.hidden = true;
  $('mpOwn').value = code;
  const host = type === 'offer';
  setText('mpShowStep', host ? L('Schritt 1 von 2') : L('Schritt 2 von 2'));
  setText('mpShowText', host ? L('Auf dem anderen Gerät »Beitreten« wählen und diesen Code scannen. Ohne Kamera: Code kopieren und hinüberschicken.') : L('Jetzt scannt das eröffnende Gerät diesen Antwort-Code oder fügt ihn ein. Danach verbinden sich die Geräte von selbst.'));
  $('mpAns').hidden = !host;
  $('mpIn2').value = '';
  $('mpShare').hidden = !((navigator.share && typeof navigator.share === 'function') || appPlugin('Share'));
  mpScanBtns();
  mpPane('show');
  mpMsg(host ? L('Warte auf den Antwort-Code …') : L('Warte auf das eröffnende Gerät …'));
}
function mpScanBtns() {
  for (const id of ['mpScan1', 'mpScan2']) $(id).hidden = !MPU.canScan;
  for (const id of ['mpPaste1', 'mpPaste2']) $(id).hidden = !(navigator.clipboard && navigator.clipboard.readText);
}
function mpCopy() {
  const t = MPU.own, ok = () => mpMsg(L('Code kopiert. Jetzt zum anderen Gerät schicken, etwa per Messenger.'), 'good');
  const fb = () => { const ta = $('mpOwn'); ta.focus(); ta.select(); let r = false; try { r = document.execCommand('copy'); } catch (e) { r = false; } if (r) ok(); else mpMsg(L('Code markiert: jetzt kopieren.'), 'warn'); };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, fb); else fb(); } catch (e) { fb(); }
}
/* Teilen: in der App über das Share-Plugin (Android-Teilen-Menü), sonst über den Browser */
function mpShare() { try { const S = appPlugin('Share'), p = S && S.share ? S.share({ text: MPU.own }) : navigator.share({ text: MPU.own }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* abgebrochen */ } }
function mpPaste(id, then) {
  const ta = $(id);
  try { navigator.clipboard.readText().then(t => { ta.value = t || ''; then(); }, () => { ta.focus(); mpMsg(L('Einfügen ging nicht: lange auf das Feld drücken und »Einfügen« wählen.'), 'warn'); }); } catch (e) { ta.focus(); }
}
function mpScanInit() {
  MPU.canScan = false;
  try {
    if (typeof BarcodeDetector === 'function' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && BarcodeDetector.getSupportedFormats) {
      BarcodeDetector.getSupportedFormats().then(f => { MPU.canScan = f.indexOf('qr_code') >= 0; mpScanBtns(); }, () => {});
    }
  } catch (e) { MPU.canScan = false; }
}
async function mpScanStart(forWhat) {
  const back = MPU.pane, v = $('mpVideo');
  MPU.scanFor = forWhat; MPU.scanBack = back;
  mpPane('cam');
  mpMsg(L('Kamera auf den Code des anderen Geräts richten.'));
  let st;
  try { st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
  catch (e) { mpPane(back); mpMsg(L('Die Kamera ist nicht verfügbar. Code bitte kopieren und einfügen.'), 'warn'); return; }
  if (MPU.pane !== 'cam') { st.getTracks().forEach(t => t.stop()); return; }
  MPU.stream = st;
  v.srcObject = st;
  try { await v.play(); } catch (e) { /* stumm */ }
  let det;
  try { det = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { mpScanStop(); mpPane(back); return; }
  const re = new RegExp(MP_PFX + '[A-Za-z0-9_-]{16,}');
  const loop = async () => {
    if (MPU.stream !== st) return;
    try {
      const r = await det.detect(v), hit = r.find(x => re.test(x.rawValue || ''));
      if (hit && MPU.stream === st) {
        mpScanStop(); buzz(25); SND.play('click');
        mpPane(MPU.scanBack);
        if (MPU.scanFor === 'offer') { $('mpIn1').value = hit.rawValue; mpJoinCode(hit.rawValue); } else { $('mpIn2').value = hit.rawValue; mpAnswerCode(hit.rawValue); }
        return;
      }
    } catch (e) { /* nächstes Bild */ }
    MPU.scanT = setTimeout(loop, 200);
  };
  loop();
}
function mpScanStop() {
  clearTimeout(MPU.scanT);
  if (MPU.stream) { try { MPU.stream.getTracks().forEach(t => t.stop()); } catch (e) { /* schon aus */ } MPU.stream = null; }
  const v = $('mpVideo');
  if (v) v.srcObject = null;
}
function mpMenuSub() {
  const el = $('mMp');
  if (!el) return;
  el.classList.toggle('on', NET.open && NET.hello);
  el.textContent = L(NET.open && NET.hello ? 'Mehrspieler · verbunden' : 'Mehrspieler');
}
function mpInputCode(id, fn) {
  const ta = $(id), re = new RegExp('^' + MP_PFX + '[A-Za-z0-9_-]{40,}$');
  ta.addEventListener('input', () => { const s = ta.value.replace(/\s+/g, ''); if (re.test(s) && !mpUnpack(s).err) fn(s); });
}
function mpNetLoad() { try { const s = JSON.parse(localStorage.getItem(NET_KEY) || 'null'); if (s) { MPU.inet = !!s.inet; MPU.turn.url = String(s.url || '').slice(0, 200); MPU.turn.user = String(s.user || '').slice(0, 100); } } catch (e) { /* ohne Speicher */ } }
function mpNetSave() { try { localStorage.setItem(NET_KEY, JSON.stringify({ inet: MPU.inet, url: MPU.turn.url, user: MPU.turn.user })); } catch (e) { /* ohne Speicher */ } }
function mpNetRender() {
  $('mpInet').classList.toggle('on', MPU.inet);
  $('mpInetNote').hidden = !MPU.inet; $('mpTurn').hidden = !MPU.inet;
  $('mpTurnUrl').value = MPU.turn.url; $('mpTurnUser').value = MPU.turn.user; $('mpTurnPass').value = MPU.turn.pass;
  $('mpTurnUrl').classList.toggle('bad', !!MPU.turn.url && !/^turns?:[^\s]+$/i.test(MPU.turn.url));
}
function initMp() {
  mpScanInit();
  mpNetLoad();
  $('mpInet').addEventListener('click', () => { MPU.inet = !MPU.inet; mpNetSave(); mpNetRender(); SND.play('click'); });
  for (const [id, k] of [['mpTurnUrl', 'url'], ['mpTurnUser', 'user'], ['mpTurnPass', 'pass']]) $(id).addEventListener('input', () => { MPU.turn[k] = $(id).value.trim(); if (k !== 'pass') mpNetSave(); mpNetRender(); });
  $('mMp').addEventListener('click', () => { SND.init(); SND.play('click'); mpOpen(); });
  $('mpX').addEventListener('click', mpClose);
  $('mpHost').addEventListener('click', () => { SND.play('click'); mpHostStart(); });
  $('mpJoin').addEventListener('click', () => { SND.play('click'); $('mpIn1').value = ''; mpScanBtns(); mpPane('enter'); mpMsg(''); });
  $('mpGo1').addEventListener('click', () => mpJoinCode($('mpIn1').value));
  $('mpGo2').addEventListener('click', () => mpAnswerCode($('mpIn2').value));
  mpInputCode('mpIn1', mpJoinCode);
  mpInputCode('mpIn2', mpAnswerCode);
  $('mpScan1').addEventListener('click', () => mpScanStart('offer'));
  $('mpScan2').addEventListener('click', () => mpScanStart('answer'));
  $('mpPaste1').addEventListener('click', () => mpPaste('mpIn1', () => mpJoinCode($('mpIn1').value)));
  $('mpPaste2').addEventListener('click', () => mpPaste('mpIn2', () => mpAnswerCode($('mpIn2').value)));
  $('mpCamX').addEventListener('click', () => { mpScanStop(); mpPane(MPU.scanBack || 'home'); mpMsg(''); });
  $('mpCopy').addEventListener('click', mpCopy);
  $('mpShare').addEventListener('click', mpShare);
  $('mpBack').addEventListener('click', () => { mpDrop(); mpPane('home'); mpMsg(''); });
  $('mpBack1').addEventListener('click', () => { mpPane('home'); mpMsg(''); });
  $('mpRoll').addEventListener('click', () => { MPL.seed = 1 + ((Math.random() * 999999) | 0); SND.play('click'); mpCfgSend(); mpLobbyRender(); });
  $('mpStart').addEventListener('click', () => { SND.play('click'); mpStart(); });
  $('mpLeave').addEventListener('click', () => { mpLeave(); mpPane('home'); mpMsg(L('Verbindung getrennt.')); SND.play('click'); });
  $('mpAi').addEventListener('click', () => { SND.play('click'); mpTakeover(); });
  $('mpLostMenu').addEventListener('click', () => { mpLeave(); $('mpLost').hidden = true; toMenu(); });
  mpMenuSub();
}
