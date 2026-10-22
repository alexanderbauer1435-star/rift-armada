'use strict';
/* Sprachprüfung ohne Browser: Jeder deutsche Text der Module und der Seite hat einen englischen Eintrag, Platzhalter
   und HTML-Tags stimmen überein, Vorlagen aus der Simulation (T) werden samt Argumenten übersetzt, und die Simulation
   läuft auf Deutsch und Englisch Schritt für Schritt gleich (sie kennt keine Sprache).
   node tests/i18n.js */
const { execFileSync } = require('child_process');
const path = require('path');
const { loadSim } = require('./harness');
const X = loadSim();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
/* 1. Abdeckung: tools/i18n/extract.py --missing (nur die Versionszeilen der Seite laufen über Muster) */
const out = execFileSync('python3', [path.join(__dirname, '..', 'tools', 'i18n', 'extract.py'), '--missing'], { encoding: 'utf8' });
const lines = out.trim().split('\n'), last = lines.pop();
const miss = lines.filter(l => !/Fassung %V%|Vorabfassung/.test(l));
ok(!miss.length, 'alle Texte übersetzt (' + last + ')' + (miss.length ? '\n' + miss.slice(0, 20).join('\n') : ''));
/* 2. Platzhalter und Tags */
const EN = X.EN, ph = s => (s.match(/\{\d\}/g) || []).sort().join(), tags = s => (s.match(/<\/?[a-z0-9]+/g) || []).sort().join();
const bad = Object.keys(EN).filter(k => ph(k) !== ph(EN[k]) || tags(k) !== tags(EN[k]));
ok(!bad.length, Object.keys(EN).length + ' Einträge, Platzhalter und Tags gleich' + (bad.length ? ': ' + bad.slice(0, 5).join(' | ') : ''));
const de = Object.keys(EN).filter(k => /[äöüÄÖÜß]/.test(EN[k]) && !/Tharsis|Ägis|Deutsch|Sprache/.test(EN[k]));
ok(!de.length, 'keine Umlaute in englischen Texten' + (de.length ? ': ' + de.slice(0, 5).map(k => EN[k]).join(' | ') : ''));
/* 3. L, T, Muster */
X.I18N.lang = 'en';
const t1 = X.T(['{0} fällt an {1}.', 'Neu-Tharsis', 'Piraten']);
const t2 = X.T(['Zerstöre {0}', ['die Kommandobasis von {0}', 'The Nexus']]);
const t3 = X.T(['Waffenstillstand mit {0}. Gemeinsam gegen die Brood.', ['%list', 'The Alliance', 'Golden Legion']]);
const t4 = X.L('Benötigt Werft Stufe II'), t5 = X.L('Akt 2: The Long Burn'), t6 = X.L('Ausbau III');
console.log('     ' + [t1, t2, t3, t4, t5, t6].join(' · '));
ok(t1 === 'New Tharsis falls to Pirates.' || /^New Tharsis falls to /.test(t1), 'Vorlage mit übersetzten Namen: ' + t1);
ok(/the Nexus/.test(t2) && !/Zerstöre|Kommandobasis/.test(t2), 'eingeschachtelte Vorlage: ' + t2);
ok(/the Alliance, Golden Legion/.test(t3) && !/Waffenstillstand/.test(t3), 'Aufzählung: ' + t3);
ok(t4 === 'Requires Shipyard level II' && t5 === 'Act 2: The Long Burn' && t6 === 'Upgrade III', 'Muster für Meldungen, Akte und Ausbau');
X.I18N.lang = 'de';
ok(X.T(['{0} fällt an {1}.', 'Neu-Tharsis', 'Piraten']) === 'Neu-Tharsis fällt an Piraten.', 'Deutsch bleibt Deutsch');
/* 4. Simulation unabhängig von der Sprache */
function run(lang) {
  X.I18N.lang = lang;
  const g = X.createGame({ map: 'haven', seed: 4242, players: [{ faction: 'mars', ai: 2 }, { faction: 'nexus', ai: 2 }] });
  for (let i = 0; i < 30 * 120; i++) { X.stepGame(g); g.ev.length = 0; }
  return JSON.stringify(g.ships.map(u => [u.type, Math.round(u.x), Math.round(u.y), Math.round(u.hull)])) + g.players.map(p => p.ice + ':' + p.ore).join();
}
ok(run('de') === run('en'), 'Partie auf Deutsch und Englisch gleich (120 s)');
const C1 = X.cqNew('legion', 2, 99), C2 = X.cqNew('legion', 2, 99);
const turns = C => { for (let i = 0; i < 8; i++) { const t = X.cqTargets(C)[0]; X.cqResult(C, X.cqSpec(C, 'attack', t), X.cqAuto(C, X.cqSpec(C, 'attack', t))); } };
X.I18N.lang = 'de'; turns(C1);
X.I18N.lang = 'en'; turns(C2);
ok(JSON.stringify(C1) === JSON.stringify(C2), 'Feldzug auf Deutsch und Englisch gleich');
X.I18N.lang = 'de';
console.log(fails ? 'FAILS ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
