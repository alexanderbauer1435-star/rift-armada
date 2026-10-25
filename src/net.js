/* ===== net.js ===== */
'use strict';
/* =====================================================================
   MEHRSPIELER – zwei bis acht Geräte, direkt verbunden (WebRTC-Datenkanal, ohne Server). Ursprung: RTS – Rapid Tactical
   Strike; seit Fassung 20 als Stern: Ein Gerät eröffnet (Gastgeber), jedes weitere verbindet sich nur mit ihm.
   Verbindung: Für jeden Mitspieler zeigt der Gastgeber einen eigenen Code (»Mitspieler einladen«), das beitretende Gerät
   antwortet mit einem Code; beide als QR-Code und als Text zum Kopieren. Ein Code enthält nur, was die Geräte zum Finden
   brauchen (Adressen im lokalen Netz, Zugangsdaten, Prüfsumme des Schlüssels), kompakt verpackt. Ohne STUN finden sich die
   Geräte nur im selben WLAN oder Hotspot; mit »Über das Internet« fragen sie öffentliche Adressdienste, ein eigener
   TURN-Server leitet notfalls weiter.
   Lobby: acht Plätze, jeder Mensch, KI (Fraktion, Stärke) oder aus; Team je Platz; jeder Mensch wählt Fraktion, Name und
   Startplatz auf dem eigenen Gerät, der Gastgeber Spielart, Karte, Größe, Kampftempo und Startmittel.
   Gleichschritt: Alle Geräte rechnen dieselbe Partie. Jedes Gerät schickt mit jeder Runde t sein Befehlspaket für t+D an
   den Gastgeber (auch ein leeres). Der Gastgeber bündelt die Pakete aller Menschen für eine Runde in Sitzreihenfolge und
   verteilt das Bündel; eine Runde wird erst gerechnet, wenn ihr Bündel da ist. Verlässt jemand die Partie, setzt der
   Gastgeber den Sitz ins nächste Bündel: Ab dieser Runde spielt dort auf allen Geräten die KI.
   Alle fünf Sekunden vergleichen Gastgeber und Mitspieler eine Prüfsumme; weicht sie ab, verteilt der Gastgeber seinen
   Spielstand an alle (Abgleich) und sagt, bei wem es abwich.
   Funksignale: einige feste Meldungen (Angriff, Hilfe …) an alle Mitspieler, über den Gastgeber weitergereicht.
   Nur in der Offline-Datei: Die Artefakt-Fassung im Browser darf keine direkten Verbindungen aufbauen.
   ===================================================================== */
const MP_PROTO = 2, MP_HASH = 150, MP_CHUNK = 16000, MP_CODE_V = 2, MP_PFX = 'RIFT', MP_MAX = 8;
const MP_STUN = ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'];
const MP_TYP = ['host', 'srflx', 'relay', 'prflx'], NET_KEY = 'ra.net';
const MP_KINDS = { free: 'Gefecht', waves: 'Quarantine' };
/* Funksignale (Index wird verschickt, jedes Gerät zeigt sie in seiner Sprache) */
const MP_SIGNALS = ['Angriff!', 'Verteidigen!', 'Hilfe!', 'Rückzug!', 'Sammeln!', 'Gut gemacht', 'Ja', 'Nein'];
const NET = {
  role: '', open: false, hello: false, inet: false, id: 0, nextId: 1, peers: [], pend: null, lobby: false, beat: 0, connT: 0,
  live: false, seat: -1, D: 6, D0: 6, ep: 0, base: 0, nx: 6, out: [], mine: new Map(), inb: new Map(), bund: new Map(), bx: 6,
  need: new Set(), dropQ: [], seats: [], rmax: 0, pmax: -1, pd: 6,
  hs: new Map(), rhs: new Map(), wait: '', rx: null, stall: 0, syncs: 0, okHash: 0, soft: false, sigT: 0
};
/* Wahl in der Lobby; bestimmt vom Gastgeber. slots: { t: 'h' (Mensch, id) | 'ai' (f, lvl) | 'off', team, s (Startplatz) } */
const MPL = { kind: 'free', map: 'haven', size: 'normal', pace: 'tactical', res: 'normal', seed: 1, slots: [] };
const MPU = { pane: 'home', own: '', ownType: '', stream: null, scanT: 0, scanFor: '', canScan: false, busy: false, prevKey: '', inet: false, name: '', roster: [], turn: { url: '', user: '', pass: '' } };
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
/* Eine Verbindung (Gastgeber: je Mitspieler eine, Mitspieler: eine zum Gastgeber) */
function mpPeerNew(inet) {
  let pc;
  try { pc = new RTCPeerConnection({ iceServers: mpIce(inet) }); } catch (e) { pc = new RTCPeerConnection({ iceServers: mpIce(inet).slice(0, 1) }); }
  const dc = pc.createDataChannel('ra', { negotiated: true, id: 0, ordered: true });
  const P = { id: 0, pc, dc, open: false, hello: false, gone: false, n: '', f: 'mars', in: false, lastRx: 0, rtt: [] };
  dc.onopen = () => { if (!P.gone) mpOnOpen(P); };
  dc.onclose = () => { if (!P.gone) mpPeerLost(P, 'drop'); };
  dc.onmessage = e => { if (!P.gone) mpRecv(P, e.data); };
  pc.onconnectionstatechange = () => { if (!P.gone && P.open && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) mpPeerLost(P, 'drop'); };
  return P;
}
function mpPeerClose(P, later) {
  if (!P) return;
  P.gone = true; P.open = false;
  const fin = () => { try { P.dc.close(); } catch (e) { /* schon zu */ } try { P.pc.close(); } catch (e) { /* schon zu */ } };
  if (later) setTimeout(fin, 250); else fin();
}
function mpFlags() {
  const h = NET.peers[0];
  NET.open = NET.hello = NET.role === 'host' ? NET.lobby : NET.role === 'guest' && !!(h && h.open && h.hello);
}
/* alles schließen (Gastgeber: alle Mitspieler) */
function mpDrop() {
  for (const P of NET.peers) mpPeerClose(P);
  mpPeerClose(NET.pend);
  NET.peers = []; NET.pend = null; NET.lobby = false; NET.role = ''; NET.id = 0;
  clearInterval(NET.beat); NET.beat = 0; clearTimeout(NET.connT);
  mpFlags();
}
function mpLeave() {
  mpSend({ k: 'bye' });
  for (const P of NET.peers) mpPeerClose(P, true);
  mpPeerClose(NET.pend);
  NET.peers = []; NET.pend = null; NET.lobby = false; NET.role = ''; NET.live = false; NET.seat = -1;
  clearInterval(NET.beat); NET.beat = 0;
  mpFlags();
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
function mpSendTo(P, o) {
  const dc = P && P.dc;
  if (!dc || P.gone || dc.readyState !== 'open') return false;
  try { dc.send(typeof o === 'string' ? o : JSON.stringify(o)); return true; } catch (e) { return false; }
}
/* an alle: Gastgeber an jeden Mitspieler (außer »not«), Mitspieler an den Gastgeber */
function mpSend(o, not) {
  const s = JSON.stringify(o);
  let ok = false;
  for (const P of NET.peers) if (P !== not && P.open && mpSendTo(P, s)) ok = true;
  return ok;
}
/* Gastgeber: »Spiel eröffnen« – Rolle übernehmen und den ersten Mitspieler einladen */
function mpHostStart() {
  if (MPU.busy || !mpAvail()) return;
  mpDrop();
  NET.role = 'host'; NET.id = 0; NET.nextId = 1;
  mpInvite();
}
async function mpInvite() {
  if (MPU.busy || !mpAvail() || NET.role !== 'host') return;
  if (mpFreeSlot() < 0 && NET.lobby) { mpMsg(L('Alle acht Plätze sind besetzt.'), 'warn'); return; }
  MPU.busy = true;
  MPU.own = ''; MPU.ownType = ''; $('mpOwn').value = '';
  mpMsg(L('Code wird erstellt …'));
  try {
    mpPeerClose(NET.pend);
    NET.inet = !!MPU.inet;
    const P = mpPeerNew(MPU.inet), pc = P.pc;
    P.id = NET.nextId++;
    NET.pend = P;
    if (MPU.inet) mpMsg(L('Code wird erstellt, die Adresse von außen wird erfragt …'));
    await pc.setLocalDescription(await pc.createOffer());
    await mpGather(pc);
    if (NET.pend !== P) return;
    const code = mpPack(pc.localDescription.sdp, 'offer', mpBuild(), NET.inet), d = code && mpUnpack(code);
    if (!d || d.err) throw new Error('code');
    if (!d.n) { mpInviteEnd(); mpMsg(L('Kein Netzwerk gefunden. WLAN oder Hotspot einschalten und noch einmal versuchen.'), 'bad'); return; }
    mpShowCode(code, 'offer');
    if (NET.inet && !d.ext) mpMsg(L('Keine Adresse von außen gefunden: Ist das Gerät online? Im selben WLAN klappt es trotzdem.'), 'warn');
  } catch (e) {
    mpInviteEnd(); mpMsg(L('Die Verbindung ließ sich nicht vorbereiten.'), 'bad');
  } finally { MPU.busy = false; }
}
/* Einladung abbrechen: zurück in die Lobby, ohne Lobby ganz zurück */
function mpInviteEnd() {
  mpPeerClose(NET.pend); NET.pend = null;
  if (NET.role === 'host' && NET.lobby) mpLobbyEnter(); else { mpDrop(); mpPane('home'); }
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
    mpDrop();
    NET.role = 'guest'; NET.inet = !!(d.inet || MPU.inet);
    const P = mpPeerNew(NET.inet), pc = P.pc;
    NET.peers = [P];
    await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await mpGather(pc);
    if (NET.peers[0] !== P) return;
    const ans = mpPack(pc.localDescription.sdp, 'answer', mpBuild(), NET.inet), a = ans && mpUnpack(ans);
    if (!a || a.err) throw new Error('code');
    if (!a.n) { mpDrop(); mpPane('enter'); mpMsg(L('Kein Netzwerk gefunden. WLAN oder Hotspot einschalten und noch einmal versuchen.'), 'bad'); return; }
    mpShowCode(ans, 'answer');
  } catch (e) {
    mpDrop(); mpPane('enter'); mpMsg(L('Mit diesem Code klappt es nicht. Bitte auf dem eröffnenden Gerät neu eröffnen.'), 'bad');
  } finally { MPU.busy = false; }
}
async function mpAnswerCode(code) {
  const P = NET.pend, pc = P && P.pc;
  if (MPU.busy || !pc || NET.role !== 'host') return;
  const d = mpUnpack(code), why = mpCodeErr(d, 'answer');
  if (why) { mpMsg(why, 'bad'); SND.play('err'); return; }
  if (pc.signalingState !== 'have-local-offer') { mpMsg(L('Verbinde …')); return; }
  MPU.busy = true;
  try {
    await pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
    mpMsg(L('Verbinde …'));
    clearTimeout(NET.connT);
    NET.connT = setTimeout(() => { if (NET.pend === P && !P.open) mpMsg(NET.inet ? L('Noch keine Verbindung. Strenge Netze (Firma, manche Mobilfunknetze) brauchen einen eigenen TURN-Server.') : L('Noch keine Verbindung. Sind beide Geräte im selben WLAN oder Hotspot?'), 'warn'); }, NET.inet ? 20000 : 12000);
  } catch (e) { mpMsg(L('Dieser Antwort-Code passt nicht. Bitte neu eröffnen.'), 'bad'); }
  finally { MPU.busy = false; }
}
function mpOnOpen(P) {
  P.open = true; P.lastRx = performance.now();
  if (NET.role === 'host') {
    clearTimeout(NET.connT);
    if (NET.pend === P) NET.pend = null;
    if (NET.peers.indexOf(P) < 0) NET.peers.push(P);
  }
  if (!NET.beat) NET.beat = setInterval(mpBeat, 1000);
  mpSendTo(P, { k: 'hi', v: MP_PROTO, b: mpBuildId(), id: P.id });
}
function mpBeat() {
  const now = performance.now(), host = NET.role === 'host', game = NET.live && UI.kind === 'mp' && !UI.endShown;
  for (const P of NET.peers.slice()) {
    if (!P.open) continue;
    mpSendTo(P, { k: 'p', t: now });
    const quiet = now - P.lastRx;
    /* Gastgeber: ein stummer Mitspieler hält alle auf – nach 30 s (in der Lobby 45 s) übernimmt die KI bzw. der Platz wird frei */
    if (host && quiet > (game ? 30000 : 45000) && !(game && UI.paused)) mpPeerLost(P, 'quiet');
    else if (!host && game && !UI.paused && quiet > 15000 && $('mpLost').hidden) mpLost('quiet');
  }
  if (NET.live) mpAdapt();
  if (!$('mp').hidden && MPU.pane === 'lobby') mpLobbyState();
}
function mpRtt(P) { const r = P ? P.rtt : null; if (!r || !r.length) return -1; const a = r.slice().sort((x, y) => x - y); return a[a.length >> 1]; }
function mpRttMax() { let m = -1; for (const P of NET.peers) m = Math.max(m, mpRtt(P)); return m; }
function mpRecv(P, data) {
  P.lastRx = performance.now();
  let m;
  try { m = JSON.parse(data); } catch (e) { return; }
  if (!m || typeof m.k !== 'string') return;
  const host = NET.role === 'host';
  if (!host && NET.soft) mpUnlost();
  switch (m.k) {
    case 'hi':
      if (m.v !== MP_PROTO || m.b !== mpBuildId()) { if (host) { mpPeerLost(P, 'ver'); mpMsg(L('Ein Gerät mit einer anderen Fassung des Spiels wurde abgewiesen. Bitte überall dieselbe Datei öffnen.'), 'bad'); } else { mpDrop(); mpPane('home'); mpMsg(L('Das andere Gerät hat eine andere Fassung des Spiels. Bitte auf beiden Geräten dieselbe Datei öffnen.'), 'bad'); } return; }
      P.hello = true;
      if (host) {
        if (NET.live) { mpSendTo(P, { k: 'full', live: 1 }); mpPeerLost(P, 'full'); return; }
        if (!NET.lobby) mpLobbyNew();
        if (mpSlotFor(P.id) < 0) { mpSendTo(P, { k: 'full' }); mpPeerLost(P, 'full'); return; }
        NET.lobby = true;
      } else NET.id = m.id | 0;
      mpFlags();
      SND.play('upgrade'); buzz(30);
      mpLobbyEnter();
      break;
    case 'p': mpSendTo(P, { k: 'q', t: m.t }); break;
    case 'q': { const r = performance.now() - m.t; if (r >= 0 && r < 60000) { P.rtt.push(r); if (P.rtt.length > 9) P.rtt.shift(); } break; }
    case 'st':
      if (!host) break;
      if (PLAYABLE.indexOf(m.f) >= 0) P.f = m.f;
      P.in = !!m.in; P.n = mpCleanName(m.n);
      if (typeof m.s === 'number') mpStartWish(P.id, m.s | 0);
      mpLobbySend();
      break;
    case 'lob': if (!host && m.s) { mpCfgApply(m.s); if (Array.isArray(m.r)) MPU.roster = m.r.filter(r => r && typeof r.id === 'number').slice(0, MP_MAX).map(r => ({ id: r.id, n: mpCleanName(r.n), f: PLAYABLE.indexOf(r.f) >= 0 ? r.f : 'mars', in: !!r.in })); mpLobbyRender(); } break;
    case 'full': if (!host) { mpDrop(); mpPane('home'); mpMsg(m.live ? L('Das Gefecht läuft schon. Bitte warten, bis der Gastgeber zurück in der Lobby ist.') : L('Alle acht Plätze sind besetzt.'), 'bad'); } break;
    case 'go': if (!host) mpGo(m); break;
    case 'no': if (host) { toast(L('{0} ist gerade in einem eigenen Gefecht.', mpPeerName(P)), 'warn'); mpPeerLost(P, 'busy'); } break;
    case 'b': if (host) mpRxBatch(P, m); break;
    case 'B': if (!host) mpRxBundle(m); break;
    case 'h':
      if (!NET.live || m.e !== NET.ep || typeof m.x !== 'number') break;
      if (host) { const s = mpSeatOf(P.id); if (s < 0) break; if (!NET.rhs.has(m.x)) NET.rhs.set(m.x, new Map()); NET.rhs.get(m.x).set(s, m.h >>> 0); }
      else NET.rhs.set(m.x, m.h >>> 0);
      mpCheckHash(m.x);
      break;
    case 'ds': if (host && NET.live && m.e === NET.ep) mpSyncSend(mpSeatName(mpSeatOf(P.id))); break;
    case 'sy': if (!host && NET.live) mpRxSync(m); break;
    case 'pz':
      if (!NET.live || UI.kind !== 'mp' || UI.endShown) break;
      if (host) mpSend({ k: 'pz', on: !!m.on }, P);
      if (!!m.on !== UI.paused) setPaused(!!m.on, true);
      break;
    case 'ch': {
      if (!NET.live || UI.kind !== 'mp') break;
      const i = m.m | 0, s = host ? mpSeatOf(P.id) : m.s | 0;
      if (!(i >= 0 && i < MP_SIGNALS.length) || s < 0) break;
      if (host) mpSend({ k: 'ch', m: i, s }, P);
      mpSigShow(s, i);
      break;
    }
    case 'bye': if (host) mpPeerLost(P, 'bye'); else mpLost('bye'); break;
  }
}
/* Gastgeber: ein Mitspieler ist weg – Lobby: Platz frei; Gefecht: Sitz an die KI (im nächsten Bündel, auf allen Geräten gleich) */
function mpPeerLost(P, why) {
  if (NET.role !== 'host') { mpLost(why); return; }
  if (P.gone) return;
  const wasOpen = P.open;
  mpPeerClose(P, why === 'bye');
  if (NET.pend === P) { NET.pend = null; return; }
  const i = NET.peers.indexOf(P);
  if (i >= 0) NET.peers.splice(i, 1);
  if (!wasOpen && i < 0) return;
  const name = mpPeerName(P), seat = mpSeatOf(P.id);
  if (NET.live && seat >= 0 && NET.need.has(seat)) { NET.need.delete(seat); NET.dropQ.push([seat, 2]); mpPump(); }
  mpSlotFree(P.id);
  if (P.hello && why !== 'full' && why !== 'ver') {
    if (!NET.live && !$('mp').hidden && MPU.pane === 'lobby') mpMsg(L('{0} hat die Lobby verlassen.', name), 'warn');
    if (!NET.live && UI.kind === 'mp' && UI.endShown) toast(L('{0} hat die Verbindung getrennt.', name), 'warn');
  }
  mpLobbySend();
  mpMenuSub();
}

/* ------------------------------------------------------------------ Lobby */
function mpCleanName(s) { return String(s || '').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 16); }
function mpFacShort(f) { return f === 'random' ? L('Zufall') : FACTIONS[f] ? FACTIONS[f].name.replace('The ', '').replace('Martian ', '').replace('Golden ', '') : '?'; }
/* Teilnehmer: Gastgeber (id 0) und verbundene Mitspieler; beim Mitspieler die Liste vom Gastgeber */
function mpRoster() {
  if (NET.role !== 'host') return MPU.roster;
  return [{ id: 0, n: MPU.name, f: MENU.faction, in: true }].concat(NET.peers.filter(P => P.hello && P.open).map(P => ({ id: P.id, n: P.n, f: P.f, in: P.in })));
}
function mpWho(id) { return mpRoster().find(r => r.id === id) || null; }
function mpNameOf(r) { return r ? r.n || L(FACTIONS[r.f] ? FACTIONS[r.f].name : 'Mitspieler') : L('Mitspieler'); }
function mpPeerName(P) { return P.n || L(FACTIONS[P.f] ? FACTIONS[P.f].name : 'Mitspieler'); }
function mpLobbyNew() {
  MPL.slots = [{ t: 'h', id: 0, f: 'random', lvl: 2, team: 0, s: -1 }];
  for (let i = 1; i < MP_MAX; i++) MPL.slots.push({ t: 'off', id: 0, f: 'random', lvl: 2, team: 0, s: -1 });
  MPL.kind = 'free'; MPL.seed = 1 + ((Math.random() * 999999) | 0);
  if (MAPS[MENU.map] && !MAPS[MENU.map].waves) MPL.map = MENU.map;
  MPL.size = MENU.size || 'normal'; MPL.pace = MENU.pace || 'tactical'; MPL.res = MENU.res || 'normal';
}
function mpFreeSlot() { let i = MPL.slots.findIndex(q => q.t === 'off'); if (i < 0) i = MPL.slots.findIndex(q => q.t === 'ai'); return i; }
function mpSlotFor(id) {
  if (MPL.slots.some(q => q.t === 'h' && q.id === id)) return MPL.slots.findIndex(q => q.t === 'h' && q.id === id);
  const i = mpFreeSlot();
  if (i >= 0) Object.assign(MPL.slots[i], { t: 'h', id, s: -1 });
  return i;
}
function mpSlotFree(id) { for (const q of MPL.slots) if (q.t === 'h' && q.id === id) { q.t = 'off'; q.s = -1; } }
/* Spielerliste aus den Plätzen (Reihenfolge = Sitz in der Partie) */
function mpPlayers() {
  const out = [];
  MPL.slots.forEach((q, i) => {
    if (q.t === 'off') return;
    if (q.t === 'h') { const r = mpWho(q.id); out.push({ slot: i, human: true, id: q.id, f: r ? r.f : 'mars', n: r ? r.n : '', team: q.team, s: q.s, r }); }
    else out.push({ slot: i, human: false, f: q.f, lvl: q.lvl, team: q.team, s: -1 });
  });
  return out;
}
/* Farben wie im Gefecht: Fraktionsfarbe, solange jede Fraktion nur einmal vorkommt und höchstens vier spielen, sonst feste Platzfarben */
function mpColors(facs) { const dup = facs.length > 4 || facs.some((f, i) => f === 'random' || facs.indexOf(f) !== i); return facs.map((f, i) => dup ? SLOT_COLS[i] : null); }
function mpMaps() { if (MPL.kind === 'waves') return ['quarantine']; const np = Math.max(2, mpPlayers().length); return MAP_ORDER.filter(k => MAPS[k].np.indexOf(np) >= 0).concat(edMapIds(np)); }   /* KARTENEDITOR: eigene Karten */
function mpFixMap() {
  const ok = mpMaps();
  if (ok.indexOf(MPL.map) < 0) MPL.map = ok[0];
  const np = mpPlayers().length;
  for (const q of MPL.slots) if (q.s >= np) q.s = -1;
}
function mpStartWish(id, s) {
  const q = MPL.slots.find(x => x.t === 'h' && x.id === id), np = mpPlayers().length;
  if (!q) return;
  if (s < 0 || s >= np) { q.s = -1; return; }
  if (!MPL.slots.some(x => x !== q && x.t === 'h' && x.s === s)) q.s = s;
}
function mpCfgApply(s) {
  if (MP_KINDS[s.kind]) MPL.kind = s.kind;
  if (s.custom && typeof s.map === 'string') edPeerMap(s.map, s.custom);   /* KARTENEDITOR: Karte des eröffnenden Geräts eintragen */
  if (MAPS[s.map]) MPL.map = s.map;
  if (MAP_SIZES[s.size]) MPL.size = s.size;
  if (PACE[s.pace]) MPL.pace = s.pace;
  if (s.res === 'low' || s.res === 'normal' || s.res === 'rich') MPL.res = s.res;
  if (s.seed > 0 && s.seed < 1e7) MPL.seed = s.seed | 0;
  if (Array.isArray(s.slots) && s.slots.length === MP_MAX) {
    MPL.slots = s.slots.map(q => ({ t: q && (q.t === 'h' || q.t === 'ai') ? q.t : 'off', id: q ? q.id | 0 : 0, f: q && (q.f === 'random' || PLAYABLE.indexOf(q.f) >= 0) ? q.f : 'random', lvl: q && AI_LEVELS[q.lvl] ? q.lvl : 2, team: q ? clamp(q.team | 0, 0, 4) : 0, s: q && q.s >= 0 && q.s < MP_MAX ? q.s | 0 : -1 }));
  }
}
/* Gastgeber: Wahl an alle */
function mpLobbySend() {
  if (NET.role !== 'host' || !NET.lobby) return;
  mpFixMap();
  mpSend({ k: 'lob', s: Object.assign({}, MPL, { custom: edLayoutOf(MPL.map) }), r: mpRoster() });   /* KARTENEDITOR: Layout mitschicken */
  mpLobbyRender();
}
function mpSendSt() { mpSend({ k: 'st', f: MENU.faction, in: !$('mp').hidden && MPU.pane === 'lobby', n: MPU.name, s: mpMySlot() ? mpMySlot().s : -1 }); }
function mpMySlot() { return MPL.slots.find(q => q.t === 'h' && q.id === NET.id) || null; }
function mpLobbyEnter() {
  mpScanStop();
  $('mp').hidden = false;
  mpPane('lobby');
  mpMsg('');
  $('mpName').value = MPU.name;
  if (NET.role === 'host') mpLobbySend(); else mpSendSt();
  mpLobbyRender();
  mpMenuSub();
}
/* Vorlagen für die Teams */
function mpPreset(v) {
  const on = MPL.slots.filter(q => q.t !== 'off');
  on.forEach((q, i) => { q.team = v === 'ffa' ? 0 : v === 'hvai' ? (q.t === 'h' ? 1 : 2) : 1 + (i % 2); });
}
function mpLobbyRender() {
  if ($('mp').hidden || MPU.pane !== 'lobby') return;
  const host = NET.role === 'host', ro = !host, waves = MPL.kind === 'waves';
  mpFixMap();
  segInit('mpFac', PLAYABLE.map(f => [f, mpFacShort(f)]), () => MENU.faction, v => { MENU.faction = v; savePrefs(); if (host) mpLobbySend(); else { mpSendSt(); mpLobbyRender(); } });
  const seg = (id, opts, key) => { segInit(id, opts, () => MPL[key], v => { MPL[key] = v; mpLobbySend(); }); $(id).classList.toggle('ro', ro); if (ro) $(id).querySelectorAll('button').forEach(b => { b.disabled = true; }); };
  seg('mpKind', Object.keys(MP_KINDS).map(k => [k, MP_KINDS[k]]), 'kind');
  seg('mpMap', mpMaps().map(k => [k, MAPS[k].name]), 'map');
  seg('mpSize', [['small', 'Klein'], ['normal', 'Mittel'], ['large', 'Groß']], 'size');
  seg('mpPace', [['tactical', 'Taktisch'], ['normal', 'Normal'], ['fast', 'Schnell']], 'pace');
  seg('mpRes', [['low', 'Knapp'], ['normal', 'Normal'], ['rich', 'Reich']], 'res');
  segInit('mpPreset', [['ffa', 'Jeder für sich'], ['hvai', 'Menschen gegen KI'], ['two', 'Zwei Teams']], () => '', v => { mpPreset(v); mpLobbySend(); });
  $('mpPresetRow').hidden = ro || waves;
  $('mpSizeRow').hidden = waves; $('mpResRow').hidden = waves;
  $('mpRoll').hidden = ro || waves;
  $('mpInvite').hidden = ro;
  setText('mpKindInfo', waves ? L('Ihr haltet gemeinsam das Siegel gegen 20 Wellen der Brood.') + ' ' + L('KI-Plätze sind Verbündete, höchstens vier Spieler.') : L('Gleiches Team = Verbündete; »–« spielt für sich.'));
  mpSlotsRender();
  mpPreview();
  mpLobbyState();
}
function mpSlotsRender() {
  const box = $('mpSlots'), host = NET.role === 'host', waves = MPL.kind === 'waves', list = mpPlayers(), cols = mpColors(list.map(q => q.f));
  box.textContent = '';
  let shownOff = false;
  MPL.slots.forEach((q, i) => {
    if (q.t === 'off' && (!host || shownOff)) return;
    if (q.t === 'off') shownOff = true;
    const el = document.createElement('div'); el.className = 'slot' + (q.t === 'off' ? ' off' : '');
    const li = list.findIndex(x => x.slot === i), col = li >= 0 ? cols[li] || FACTIONS[list[li].f === 'random' ? 'guardian' : list[li].f].team : '';
    const add = (cls, txt, fn) => {
      const b = document.createElement('button'); b.className = cls; b.textContent = txt;
      if (host && fn) b.addEventListener('click', () => { fn(); SND.play('click'); mpLobbySend(); }); else b.disabled = true;
      el.appendChild(b); return b;
    };
    add(q.t === 'h' && q.id === NET.id ? 'me' : '', String(li >= 0 ? li + 1 : '+'));
    if (q.t === 'h') {
      const r = mpWho(q.id);
      add('fac', (r && r.n ? r.n + ' · ' : '') + mpFacShort(r ? r.f : 'mars')).style.color = col;
      add('lvl', q.id === 0 ? L('Gastgeber') : r && r.in ? L('bereit') : L('nicht in der Lobby'));
    } else if (q.t === 'ai') {
      add('fac', L('KI') + ' · ' + mpFacShort(q.f), () => { const o = SLOT_FACS; q.f = o[(o.indexOf(q.f) + 1) % o.length]; }).style.color = col;
      add('lvl', L(['', 'Leicht', 'Mittel', 'Schwer'][q.lvl]), () => { q.lvl = q.lvl % 3 + 1; });
    } else add('fac', L('KI hinzufügen'), () => { q.t = 'ai'; q.f = 'random'; q.s = -1; });
    if (q.t !== 'off' && !waves) add('tm', q.team ? L('Team') + ' ' + q.team : '–', () => { q.team = (q.team + 1) % 5; });
    if (q.t === 'ai' && host) add('x', '✕', () => { q.t = 'off'; });
    box.appendChild(el);
  });
}
/* Vorschau: Karte mit Startplätzen in den Spielerfarben (frei: grau), eigener Platz mit »DU«; Tippen wählt den eigenen Startplatz */
function mpPrevMap() {
  const np = Math.max(MPL.kind === 'waves' ? 1 : 2, mpPlayers().length);
  try { return MPL.kind === 'waves' ? generateMap('quarantine', np, MPL.seed) : generateMap(mapFor(MPL.map, np), np, MPL.seed, MPL.size); } catch (e) { return null; }
}
function mpPreview() {
  const list = mpPlayers(), cols = mpColors(list.map(q => q.f)), me = mpMySlot();
  const key = JSON.stringify([MPL.kind, MPL.map, MPL.size, MPL.seed, list.map(q => [q.f, q.s, q.id]), NET.id]);
  if (MPU.prevKey === key) return;
  MPU.prevKey = key;
  const cv = $('mpPrev'), m = mpPrevMap();
  MPU.prevMap = m;
  if (!m) return;
  const starts = m.starts.map(() => '#5d6b80');
  list.forEach((q, i) => { if (q.s >= 0 && q.s < starts.length) starts[q.s] = cols[i] || FACTIONS[q.f === 'random' ? 'guardian' : q.f].team; });
  mapLayout(cv, m, { starts, mine: me && me.s >= 0 ? me.s : -1 });
  setText('mpMapInfo', L(MAPS[MPL.map] ? MAPS[MPL.map].name : MAPS[m.id] ? MAPS[m.id].name : MPL.map) + ' · ' + L('{0} Spieler', list.length) + ' · ' + m.w + ' × ' + m.h);
  setText('mpStartNote', me && me.s >= 0 ? L('Dein Startplatz: {0}. Erneut antippen für Zufall.', me.s + 1) : L('Startplatz: Zufall. Tippe in der Vorschau auf einen Startplatz, um ihn zu wählen.'));
}
function mpPrevPick(ev) {
  const m = MPU.prevMap, cv = $('mpPrev'), me = mpMySlot();
  if (!m || !me || MPU.pane !== 'lobby') return;
  const r = cv.getBoundingClientRect(), px = (ev.clientX - r.left) * cv.width / r.width, py = (ev.clientY - r.top) * cv.height / r.height;
  const i = mapStartAt(cv, m, px, py, 28);
  if (i < 0) return;
  const want = me.s === i ? -1 : i;
  if (want >= 0 && MPL.slots.some(x => x !== me && x.t === 'h' && x.s === want)) { SND.play('err'); mpMsg(L('Diesen Startplatz hat schon ein Mitspieler gewählt.'), 'warn'); return; }
  SND.play('click');
  if (NET.role === 'host') { mpStartWish(0, want); mpLobbySend(); } else { me.s = want; MPU.prevKey = ''; mpPreview(); mpSendSt(); }
}
function mpLobbyState() {
  const host = NET.role === 'host', ok = NET.open && NET.hello, guests = NET.peers.filter(P => P.hello && P.open);
  const r = host ? mpRttMax() : mpRtt(NET.peers[0]);
  setText('mpStateT', !ok ? L('Getrennt') : host ? L('Gastgeber · {0} Mitspieler verbunden', guests.length) : L('Verbunden') + (r >= 0 ? ' · ' + Math.round(r) + ' ms' : ''));
  $('mpState').classList.toggle('on', ok);
  const list = mpPlayers(), np = list.length, ready = guests.length > 0 && guests.every(P => P.in);
  const bad = MPL.kind === 'waves' ? np > 4 : np < 2;
  $('mpStart').hidden = !host;
  $('mpStart').disabled = !ready || bad;
  $('mpInvite').disabled = MPU.busy || mpFreeSlot() < 0;
  setText('mpLobbyNote', !host ? L('Der Gastgeber wählt Spielart, Plätze und Karte und startet.') : !guests.length ? L('»Mitspieler einladen« zeigt einen Code für das nächste Gerät.') : bad ? L('Quarantine: höchstens vier Spieler.') : ready ? L('Alle bereit. Du startest für alle.') : L('Warte, bis alle Mitspieler in der Lobby sind.'));
}
/* Start durch den Gastgeber: Aufstellung festlegen, an alle verteilen */
function mpStart() {
  if (NET.role !== 'host' || !NET.lobby) return;
  mpFixMap();
  const list = mpPlayers(), waves = MPL.kind === 'waves', guests = NET.peers.filter(P => P.hello && P.open);
  if (!guests.length || !guests.every(P => P.in) || (waves ? list.length > 4 : list.length < 2)) return;
  const used = list.filter(q => q.human).map(q => q.f);
  const facs = list.map(q => { if (q.f !== 'random') return q.f; const free = PLAYABLE.filter(f => used.indexOf(f) < 0), pool = free.length ? free : PLAYABLE, f = pool[(Math.random() * pool.length) | 0]; used.push(f); return f; });
  const cols = mpColors(list.map(q => q.f === 'random' ? 'random' : q.f));
  /* Startplätze: gewählte bleiben, die übrigen werden zufällig verteilt */
  const np = list.length, taken = list.map(q => q.s).filter(s => s >= 0 && s < np), free = [];
  for (let i = 0; i < np; i++) if (taken.indexOf(i) < 0) free.push(i);
  for (let i = free.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [free[i], free[j]] = [free[j], free[i]]; }
  const players = list.map((q, i) => ({ faction: facs[i], human: q.human, ai: q.human ? 0 : q.lvl, team: waves ? 0 : q.team ? q.team : 10 + i, color: cols[i], name: q.human && q.n ? q.n : null, start: q.s >= 0 && q.s < np && taken.indexOf(q.s) === taken.lastIndexOf(q.s) ? q.s : free.shift() }));
  const res = waves ? undefined : MPL.res === 'low' ? { ice: 700, ore: 300 } : MPL.res === 'rich' ? { ice: 2500, ore: 1400 } : undefined;
  const opts = JSON.parse(JSON.stringify({ map: waves ? 'quarantine' : mapFor(MPL.map, np), size: waves ? undefined : MPL.size, seed: MPL.seed, players, res, pace: MPL.pace, mode: waves ? 'quarantine' : undefined, mp: 1, custom: waves ? undefined : edLayoutOf(MPL.map) }));   /* KARTENEDITOR: custom */
  const seats = list.map((q, i) => q.human ? { seat: i, id: q.id, n: q.n || '' } : null).filter(Boolean);
  const D = clamp(Math.ceil((Math.max(0, mpRttMax()) + 120) / (STEP * 1000)), 5, 12);
  for (const P of guests) { const s = seats.find(x => x.id === P.id); if (s) mpSendTo(P, { k: 'go', opts, seat: s.seat, D, seats }); P.in = false; }
  const me = seats.find(x => x.id === 0).seat;
  mpLockstep(me, D, seats);
  $('mp').hidden = true;
  SND.init();
  launch(() => beginGame(opts, 'mp', null, me));
}
function mpGo(m) {
  const o = m.opts, seats = Array.isArray(m.seats) ? m.seats.filter(s => s && s.seat >= 0 && o && Array.isArray(o.players) && s.seat < o.players.length).map(s => ({ seat: s.seat | 0, id: s.id | 0, n: mpCleanName(s.n) })) : [];
  const bad = !o || !Array.isArray(o.players) || o.players.length < 1 || o.players.length > MP_MAX || !(MAPS[o.map] || o.custom) || !(o.seed > 0) ||
    o.players.some(p => !p || PLAYABLE.indexOf(p.faction) < 0) || !(m.seat >= 0 && m.seat < o.players.length) || !o.players[m.seat].human || !seats.length;
  if (bad) { mpMsg(L('Das andere Gerät hat unbekannte Einstellungen geschickt.'), 'bad'); return; }
  if (UI.g && !UI.attract && !UI.endShown && UI.kind !== 'mp') { mpSend({ k: 'no' }); return; }
  mpLockstep(m.seat, m.D, seats);
  mpScanStop();
  $('mp').hidden = true;
  SND.init();
  launch(() => beginGame(o, 'mp', null, m.seat));
}

/* ------------------------------------------------------------------ Gleichschritt */
function mpLockstep(seat, D, seats) {
  NET.seat = seat; NET.D = NET.D0 = NET.pd = clamp(D | 0, 2, 20); NET.ep = 0; NET.base = 0; NET.nx = NET.bx = NET.D0;
  NET.seats = seats.map(s => ({ seat: s.seat, id: s.id, n: s.n, gone: false }));
  NET.need = new Set(NET.seats.map(s => s.seat)); NET.dropQ = [];
  NET.out = []; NET.mine.clear(); NET.inb.clear(); NET.bund.clear(); NET.pmax = -1; NET.hs.clear(); NET.rhs.clear(); NET.rmax = 0;
  NET.wait = ''; NET.rx = null; NET.stall = 0; NET.syncs = 0; NET.okHash = 0; NET.soft = false; NET.live = false;
}
function mpGameStart(g) { g.net = mpCmd; NET.live = true; for (const P of NET.peers) P.lastRx = performance.now(); mpHudRender(); }
function mpSeatOf(id) { const s = NET.seats.find(x => x.id === id); return s ? s.seat : -1; }
function mpSeatName(seat) { const s = NET.seats.find(x => x.seat === seat), p = UI.g && UI.g.players[seat]; return s && s.n ? s.n : p ? L(p.F.name) : L('Mitspieler'); }
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
/* eigenes Paket für Runde x: Gastgeber legt es zu den gesammelten, Mitspieler schicken es an den Gastgeber */
function mpOwnBatch(x, c) {
  if (NET.role === 'host') { if (!NET.inb.has(x)) NET.inb.set(x, new Map()); NET.inb.get(x).set(NET.seat, c); }
  else { NET.mine.set(x, c); mpSend({ k: 'b', e: NET.ep, x, d: NET.D, c }); }
}
function mpCleanCmds(list, seat) { const out = []; if (Array.isArray(list)) for (const c of list) if (c && typeof c === 'object' && typeof c.t === 'string') { c.p = seat; out.push(c); } return out; }
function mpRxBatch(P, m) {
  const seat = mpSeatOf(P.id);
  if (!NET.live || seat < 0 || !NET.need.has(seat) || m.e !== NET.ep || typeof m.x !== 'number' || m.x < NET.bx || m.x < NET.base + NET.D0) return;
  if (!NET.inb.has(m.x)) NET.inb.set(m.x, new Map());
  NET.inb.get(m.x).set(seat, mpCleanCmds(m.c, seat));
  if (m.x > NET.pmax) { NET.pmax = m.x; NET.pd = m.d > 0 ? m.d : NET.D0; }
  mpPump();
}
/* Gastgeber: Bündel verteilen, sobald für die nächste Runde alle Pakete da sind */
function mpPump() {
  if (NET.role !== 'host' || !NET.live) return;
  for (;;) {
    const x = NET.bx, got = NET.inb.get(x);
    for (const s of NET.need) if (!got || !got.has(s)) return;
    const c = [];
    for (const s of [...NET.need].sort((a, b) => a - b)) { const l = got.get(s); if (l.length) c.push([s, l]); }
    const B = { c };
    if (NET.dropQ.length) { B.dr = NET.dropQ; NET.dropQ = []; }
    NET.inb.delete(x); NET.bund.set(x, B);
    mpSend(Object.assign({ k: 'B', e: NET.ep, x, d: NET.D, r: Math.round(Math.max(0, mpRttMax())) }, B));
    NET.bx++;
  }
}
function mpRxBundle(m) {
  if (NET.seat < 0 || m.e !== NET.ep || typeof m.x !== 'number' || !Array.isArray(m.c) || m.x < NET.base + NET.D0) return;
  const c = [];
  for (const e of m.c) if (Array.isArray(e) && e[0] >= 0) c.push([e[0] | 0, mpCleanCmds(e[1], e[0] | 0)]);
  const dr = Array.isArray(m.dr) ? m.dr.filter(d => Array.isArray(d) && d[0] >= 0).map(d => [d[0] | 0, AI_LEVELS[d[1]] ? d[1] : 2]) : null;
  NET.bund.set(m.x, dr ? { c, dr } : { c });
  if (m.r >= 0) NET.rmax = m.r;
  if (m.x > NET.pmax) { NET.pmax = m.x; NET.pd = m.d > 0 ? m.d : NET.D0; }
}
function mpReady(g) { return !NET.wait && (g.tick < NET.base + NET.D0 || NET.bund.has(g.tick)); }
function mpBehind(g) { return NET.pmax < 0 ? 0 : NET.pmax - NET.pd - g.tick; }
/* Vorlauf: Mitspieler brauchen den Weg zum Gastgeber und zurück (eigene Laufzeit, dazu die langsamste der anderen) */
function mpAdapt() {
  const host = NET.role === 'host', a = host ? [] : (NET.peers[0] ? NET.peers[0].rtt.slice(-6) : []);
  const r = host ? mpRttMax() : Math.max(a.length ? Math.max(...a) : -1, NET.rmax || 0);
  if (r < 0) return;
  const want = clamp(Math.ceil((r + 70) / (STEP * 1000)), 4, 15);
  if (want > NET.D) NET.D = want; else if (want < NET.D) NET.D--;
}
function mpStep(g) {
  const T = g.tick, target = T + NET.D;
  if (NET.nx <= target) {
    while (NET.nx < target) { mpOwnBatch(NET.nx, []); NET.nx++; }
    const own = NET.out;
    NET.out = [];
    mpOwnBatch(target, own);
    NET.nx = target + 1;
    mpPump();
  }
  const early = T < NET.base + NET.D0, B = early ? null : NET.bund.get(T);
  NET.mine.delete(T); NET.bund.delete(T);
  if (B) {
    if (B.dr) for (const [seat, lvl] of B.dr) mpSeatToAi(g, seat, lvl);
    for (const [seat, list] of B.c) for (const c of list) {
      c.p = seat;
      g.log.push(T, c);
      const r = execCmd(g, c);
      if (seat === NET.seat && typeof r === 'string') { toast(L(r), 'warn'); SND.play('err'); }
    }
  }
  stepGame(g);
  if (g.tick % MP_HASH === 0) mpHash(g);
}
/* Sitz an die KI – auf allen Geräten in derselben Runde */
function mpSeatToAi(g, seat, lvl) {
  const p = g.players[seat], s = NET.seats.find(x => x.seat === seat);
  if (p && !p.ai) { p.ai = aiInit(lvl || 2); p.human = false; g.loadedMid = 1; }
  if (s && !s.gone) {
    s.gone = true;
    if (seat !== NET.seat) { toast(L('{0} hat das Gefecht verlassen – die KI übernimmt.', mpSeatName(seat)), 'warn', 4500); SND.play('click'); }
  }
  mpHudRender();
}
function mpHash(g) {
  const x = g.tick, h = stateHash(g);
  NET.hs.set(x, h);
  mpSend({ k: 'h', e: NET.ep, x, h });
  for (const k of NET.hs.keys()) if (k < x - MP_HASH * 12) NET.hs.delete(k);
  for (const k of NET.rhs.keys()) if (k < x - MP_HASH * 12) NET.rhs.delete(k);
  mpCheckHash(x);
}
/* Prüfsummen vergleichen. Gastgeber: mit jedem Mitspieler; weicht einer ab, Abgleich für alle. Mitspieler: mit dem Gastgeber. */
function mpCheckHash(x) {
  if (!NET.hs.has(x) || !NET.rhs.has(x)) return;
  const mine = NET.hs.get(x);
  if (NET.role === 'host') {
    const got = NET.rhs.get(x), bad = [];
    for (const [s, h] of got) { if (h === mine) NET.okHash++; else bad.push(s); }
    got.clear();
    if (bad.length) { NET.syncs++; mpSyncSend(bad.map(mpSeatName).join(', ')); }
    return;
  }
  const same = NET.rhs.get(x) === mine;
  NET.rhs.delete(x);
  if (same) { NET.okHash++; return; }
  NET.syncs++;
  NET.wait = 'sync';
  mpSend({ k: 'ds', e: NET.ep, x });
}
function mpDesyncNote(who) {
  toast(L('Abweichung bei {0} erkannt – der Spielstand wird abgeglichen.', who), 'warn', 4500);
  if (NET.syncs >= 3) toast(L('Die Geräte laufen wiederholt auseinander. Haben alle dieselbe Datei geöffnet?'), 'bad', 6000);
}
function mpSyncSend(who) {
  const g = UI.g;
  if (!g || !NET.live) return;
  let txt;
  try { txt = JSON.stringify(saveGame(g)); } catch (e) { return; }
  NET.ep++;
  const n = Math.ceil(txt.length / MP_CHUNK);
  for (let i = 0; i < n; i++) mpSend({ k: 'sy', e: NET.ep, i, n, w: i ? undefined : who, d: txt.slice(i * MP_CHUNK, (i + 1) * MP_CHUNK) });
  mpDesyncNote(who);
  const g2 = loadGame(JSON.parse(txt));
  if (g2) mpSwap(g2);
  mpPipeReset(UI.g.tick);
}
function mpRxSync(m) {
  if (!(m.e > NET.ep) || !(m.n > 0) || !(m.i >= 0 && m.i < m.n) || typeof m.d !== 'string') return;
  if (!NET.rx || NET.rx.e !== m.e) NET.rx = { e: m.e, n: m.n, got: 0, parts: [] };
  NET.wait = 'sync';
  if (typeof m.w === 'string') mpDesyncNote(mpCleanName(m.w) || L('Mitspieler'));
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
function mpPipeReset(base) { NET.base = base; NET.nx = NET.bx = base + NET.D0; NET.mine.clear(); NET.inb.clear(); NET.bund.clear(); NET.pmax = -1; NET.hs.clear(); NET.rhs.clear(); NET.wait = ''; }
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
  if (!show) return;
  let who = '';
  if (NET.role === 'host' && NET.wait !== 'sync') { const got = NET.inb.get(NET.bx); who = [...NET.need].filter(s => s !== NET.seat && !(got && got.has(s))).map(mpSeatName).join(', '); }
  setText('mpWaitT', NET.wait === 'sync' ? L('Abgleich mit dem Mitspieler …') : who ? L('Warte auf {0} … {1} s', who, Math.floor(NET.stall)) : L('Warte auf Mitspieler … {0} s', Math.floor(NET.stall)));
}

/* ------------------------------------------------------------------ Mitspieler im Gefecht: Namen, Farben, Funksignale */
function mpHudRender() {
  const on = UI.kind === 'mp' && NET.live && !!UI.g;
  $('mpRoster').hidden = !on; $('mpSig').hidden = !on;
  if (!on) { $('mpSigBox').hidden = true; return; }
  const box = $('mpRoster'), g = UI.g;
  box.textContent = '';
  for (const s of NET.seats) {
    if (s.seat === NET.seat) continue;
    const p = g.players[s.seat];
    if (!p) continue;
    const el = document.createElement('span');
    el.style.color = pcolor(p);
    el.textContent = '● ' + mpSeatName(s.seat) + (s.gone ? ' (' + L('KI') + ')' : '');
    if (s.gone) el.className = 'gone';
    box.appendChild(el);
  }
}
function mpSigOpen() {
  const box = $('mpSigBox');
  if (!box.hidden) { box.hidden = true; return; }
  box.textContent = '';
  MP_SIGNALS.forEach((t, i) => { const b = document.createElement('button'); b.className = 'key'; b.textContent = L(t); b.addEventListener('click', () => { box.hidden = true; mpSig(i); }); box.appendChild(b); });
  box.hidden = false;
}
function mpSig(i) {
  if (!NET.live || UI.kind !== 'mp') return;
  const now = performance.now();
  if (now - NET.sigT < 1500) { SND.play('err'); return; }
  NET.sigT = now;
  mpSend({ k: 'ch', m: i, s: NET.seat });
  mpSigShow(NET.seat, i);
}
function mpSigShow(seat, i) {
  const g = UI.g, p = g && g.players[seat];
  if (!p) return;
  const box = $('toasts'), el = document.createElement('div'), nm = document.createElement('b');
  el.className = 'toast sig';
  nm.style.color = pcolor(p); nm.textContent = mpSeatName(seat) + ': ';
  el.appendChild(nm); el.appendChild(document.createTextNode(L(MP_SIGNALS[i])));
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 420); }, 4000);
  if (seat !== NET.seat) { SND.play('click'); buzz(20); }
}

/* ------------------------------------------------------------------ Verbindung weg (Mitspieler: zum Gastgeber) */
function mpLost(why) {
  if (why !== 'quiet') mpDrop();
  const g = UI.g;
  if (UI.kind === 'mp' && NET.live && !UI.endShown && g && !g.over) {
    NET.soft = why === 'quiet';
    setText('mpLostT', why === 'bye' ? L('Der Gastgeber hat das Gefecht verlassen') : why === 'quiet' ? L('Keine Antwort vom Gastgeber') : L('Verbindung abgebrochen'));
    setText('mpLostB', why === 'quiet' ? L('Seit einigen Sekunden kommt nichts mehr an. Kommt die Verbindung zurück, geht es von selbst weiter.') : L('Du kannst weiterspielen: Die KI übernimmt die Seiten der anderen Spieler.'));
    $('mpLost').hidden = false;
    $('pause').hidden = true; UI.paused = false;
    if (!NET.soft) SND.play('alarm');
    mpMenuSub();
    return;
  }
  if (why === 'quiet') return;
  NET.live = false; NET.seat = -1;
  if (UI.kind === 'mp' && UI.endShown) { $('eAgain').hidden = true; toast(L('Die Verbindung zum Gastgeber ist getrennt.'), 'warn'); }
  if (!$('mp').hidden) { mpScanStop(); mpPane('home'); mpMsg(why === 'bye' ? L('Der Gastgeber hat die Verbindung getrennt.') : L('Die Verbindung ist abgebrochen.'), 'bad'); }
  mpMenuSub();
}
function mpUnlost() { NET.soft = false; if (!$('mpLost').hidden && NET.open) $('mpLost').hidden = true; }
/* Die KI übernimmt die Sitze aller anderen Menschen; eigene, noch nicht ausgeführte Befehle werden jetzt ausgeführt */
function mpTakeover() {
  const g = UI.g;
  if (!g || UI.kind !== 'mp' || NET.seat < 0) return;
  const pend = [];
  mpDrop();
  NET.live = false; NET.soft = false; NET.wait = '';
  [...NET.mine.keys()].sort((a, b) => a - b).forEach(x => { if (x >= g.tick) pend.push(...NET.mine.get(x)); });
  pend.push(...NET.out);
  NET.mine.clear(); NET.inb.clear(); NET.bund.clear(); NET.out = [];
  g.net = null;
  for (const c of pend) issueCmd(g, c);
  for (const s of NET.seats) { const p = g.players[s.seat]; if (s.seat !== NET.seat && p && !p.ai) { p.ai = aiInit(2); p.human = false; g.loadedMid = 1; } }
  NET.seat = -1;
  UI.kind = 'skirmish';
  $('mpLost').hidden = true; $('mpWait').hidden = true;
  UI.paused = false; $('pause').hidden = true;
  mpHudRender();
  toast(L('Die KI übernimmt die Seiten der anderen Spieler.'), 'warn');
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
  if (NET.open && NET.hello) { if (NET.role === 'host') { mpPeerClose(NET.pend); NET.pend = null; } else mpSendSt(); }
  else if (NET.role) mpDrop();
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
  setText('mpShowText', (host && NET.lobby ? L('Einladung für den nächsten Mitspieler.') + ' ' : '') + (host ? L('Auf dem anderen Gerät »Beitreten« wählen und diesen Code scannen. Ohne Kamera: Code kopieren und hinüberschicken.') : L('Jetzt scannt das eröffnende Gerät diesen Antwort-Code oder fügt ihn ein. Danach verbinden sich die Geräte von selbst.')));
  setText('mpBack', host && NET.lobby ? L('Zurück zur Lobby') : L('Abbrechen'));
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
function mpNetLoad() { try { const s = JSON.parse(localStorage.getItem(NET_KEY) || 'null'); if (s) { MPU.inet = !!s.inet; MPU.turn.url = String(s.url || '').slice(0, 200); MPU.turn.user = String(s.user || '').slice(0, 100); MPU.name = mpCleanName(s.name); } } catch (e) { /* ohne Speicher */ } }
function mpNetSave() { try { localStorage.setItem(NET_KEY, JSON.stringify({ inet: MPU.inet, url: MPU.turn.url, user: MPU.turn.user, name: MPU.name })); } catch (e) { /* ohne Speicher */ } }
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
  $('mpBack').addEventListener('click', () => { if (NET.role === 'host') mpInviteEnd(); else { mpDrop(); mpPane('home'); } mpMsg(''); });
  $('mpBack1').addEventListener('click', () => { mpPane('home'); mpMsg(''); });
  $('mpRoll').addEventListener('click', () => { MPL.seed = 1 + ((Math.random() * 999999) | 0); SND.play('click'); mpLobbySend(); });
  $('mpInvite').addEventListener('click', () => { SND.play('click'); mpInvite(); });
  $('mpStart').addEventListener('click', () => { SND.play('click'); mpStart(); });
  $('mpLeave').addEventListener('click', () => { mpLeave(); mpPane('home'); mpMsg(L('Verbindung getrennt.')); SND.play('click'); });
  $('mpName').addEventListener('change', () => { MPU.name = mpCleanName($('mpName').value); $('mpName').value = MPU.name; mpNetSave(); if (NET.role === 'host') mpLobbySend(); else { mpSendSt(); mpLobbyRender(); } });
  $('mpPrev').addEventListener('click', mpPrevPick);
  $('mpAi').addEventListener('click', () => { SND.play('click'); mpTakeover(); });
  $('mpLostMenu').addEventListener('click', () => { mpLeave(); $('mpLost').hidden = true; toMenu(); });
  bindHold($('mpSig'), mpSigOpen, () => '<h4>' + L('Funksignal') + '</h4><p>' + L('Kurze Meldung an alle Mitspieler: Angriff, Hilfe, Rückzug …') + '</p>');
  mpMenuSub();
}
