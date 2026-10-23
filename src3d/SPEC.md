# Rift Armada – 3D-Renderer (src3d) – Schnittstelle und Regeln

Der 3D-Renderer ersetzt die Zeichnung der Spielwelt (Hintergrund, Kartenobjekte, Stationen, Schiffe, Waffen, Effekte).
Die Simulation (sim.js, combat.js …) bleibt unverändert und sprachfrei; die 2D-Leinwand zeichnet nur noch Bildschirm-
Überlagerungen (Lebensbalken, Texte, Auswahlrahmen, Minikarte, HUD). Die alte 2D-Weltdarstellung bleibt als Schalter
»Grafik: 2D« für schwache Geräte erhalten.

## Dateien
- `src3d/index.js` – Einstieg, setzt `window.RA3D` (IIFE-Bündel, gebaut mit `bash tools/build3d.sh` → `src/render3d.js`).
- `src3d/models/` – Kopie des Baukastens aus /home/claude/probe3d: `kit.js`, `factions/*.js` (Schiffe, BUILD),
  `stations/*.js` (BUILDB), `world/*.js` (BUILDW), `ships.json`, `stations.json`. Nur hier ändern, nicht in probe3d.
- `src3d/scene.js`, `camera.js`, `world.js`, `entities.js`, `overlay.js`, `fog.js` – Kern (Agent »Kern«).
- `src3d/effects/*.js` – Waffen und Effekte (Agent »Effekte«), Schnittstelle unten.
- Three.js r170 aus `tools/node_modules` (esbuild 0.24), alles prozedural, keine Dateien zur Laufzeit.

## Koordinaten
- Spielwelt: x nach rechts, y nach unten (Bildschirm), Winkel `ang` in rad, 0 = +x, wächst im Uhrzeigersinn auf dem Bildschirm.
- 3D: Welt-x → X, Welt-y → Z, oben +Y. Boden ist die Ebene Y = 0. Alle Modelle: Bug +Z, Mitte im Ursprung.
- Ein Schiff mit Kurs `ang` bekommt `rotation.y = Math.PI / 2 - ang` (Bug zeigt dann in Richtung (cos ang, 0, sin ang)).
- Längen: 1 Spieleinheit = 1 Three-Einheit. Schiffsmodelle sind `len` lang (ships.json), Stationen füllen den Kreis `r`.

## Kamera (camera.js)
- Die Spiel-UI kennt nur `R.cam = { x, y, z }`: (x, y) = Weltpunkt links oben, z = Zoom (Pixel je Einheit, 0,35…3).
  Der 3D-Renderer bekommt `setCam(cx, cy, zoom, cssW, cssH, dpr)` mit dem Weltpunkt in der Bildschirmmitte.
- Perspektivkamera, FOV 35°, Neigung fest TILT = 0,95 rad über der Bodenebene (wie die Spielansicht im Hangar), Blick
  von »unten« nach »oben« auf dem Bildschirm (Kamera steht bei größerem Welt-y als der Zielpunkt). Der Abstand ist so zu
  wählen, dass der Boden in der Bildschirmmitte `zoom` Pixel je Einheit misst: dist = cssH / (2 · tan(fov/2) · zoom) · k.
- `project(x, y)` → `{ x, y, s }` in CSS-Pixeln (s = Pixel je Einheit an dieser Stelle, für Balkenbreiten) oder `null`
  hinter der Kamera; `unproject(sx, sy)` → Weltpunkt auf Y = 0 (Strahl mit der Bodenebene schneiden; zeigt der Strahl
  über den Horizont, auf den Horizont klammern).
- Kamerawackeln: `shake(k)` lässt die Kamera kurz zittern (Explosionen), klingt in ~0,5 s ab.

## RA3D-Schnittstelle (window.RA3D)
```
RA3D.supported()                       // WebGL2 vorhanden
RA3D.init(canvas)                      // WebGL-Leinwand (#view3d, liegt unter der 2D-Leinwand #view); false bei Fehler
RA3D.resize(cssW, cssH, dpr)
RA3D.setDetail(d)                      // 0 niedrig, 1 mittel, 2 hoch (Schatten nur bei 2, Partikelmengen, Bloom nur bei 2)
RA3D.setGame(g, vp)                    // statische Welt aufbauen (Karte), Zwischenspeicher leeren; vp = Spielerindex oder -1
RA3D.setCam(cx, cy, zoom, cssW, cssH, dpr)
RA3D.project(x, y) / RA3D.unproject(sx, sy)
RA3D.ring(x, y, r, color, width, opts)  // Sofort-Primitive für diesen Frame: Kreis/Bogen am Boden; opts { dash, alpha, a0, a1 }
RA3D.line(x0, y0, x1, y1, color, width, opts)   // opts { alpha, dash }
RA3D.disc(x, y, r, color, alpha)       // gefüllte Scheibe am Boden (Auren, Zielkreise)
RA3D.ghost(f, role, lv, x, y, ok)      // Bauvorschau: Stationsmodell halbdurchsichtig, grün/rot
RA3D.event(e, g)                       // Ereignis der Simulation (siehe Liste) → Effekt
RA3D.frame(g, dt, time, view)          // alles zeichnen; view = { vp, seen(x, y), visible(e), pcol(owner), fog: HTMLCanvas | null, detail }
RA3D.dispose()
```
`frame` zeichnet in dieser Reihenfolge: Hintergrund (Sterne/Nebel-Himmel), Kartenobjekte, Wracks, Stationen, Schiffe,
Effekte (effects.frame), Sofort-Primitive, Nebel des Krieges (fog.js), danach Bloom (nur Detail 2).

## Spieldaten, die der Renderer liest (nie schreibt!)
- `g.map`: `w, h, rocks[{x,y,r,ang,seed}], fields[{x,y,r}], nebs[{x,y,r,kind:'ion'|'ash'}], nodes` (Vorkommen stehen
  in `g.nodes` als Objekte `{k:3, x,y,r,kind:'ice'|'ore', amount, max, miners, seed, ang}`), `sites` siehe `g.sites`,
  `gates` siehe `g.gates`, `starts`, `rifts` (Quarantine).
- `g.sites[]`: `{ kind:'ruin'|'citadel'|'archive'|'warden'|'forge', x, y, r, scanned, seed? }` (seed fehlt → Index).
- `g.gates[]`: `{ k:5, x, y, r, state:'dead'|'flicker'|'active', mode:'bridge'|'lock'|'lance', charge 0…1, owner }`.
- `g.bldgs[]`: `{ k:2, id, x, y, role, def (BLDG-Eintrag: f, id=role, r, lv[]), f? (= def.f), owner, lv 1…3, done,
  prog 0…1 (Bau), bld (Bauschiff dran), off (Nexus ohne Netz), q[] (Werft-Warteschlange, q[0].id = Schiffstyp), qp 0…1
  (Baufortschritt des Schiffs), give (Zusatzschild), charge 0…1 (Superwaffe), upg {prog} (Ausbau läuft), aimA (Zielwinkel
  der Geschütze, rad wie ang), hull, hullMax, shield, shieldMax, dead, boarding }`. Rolle `seal` = Das Siegel (Fraktion guardian).
- `g.ships[]`: `{ k:1, id, x, y, ang, v (Geschwindigkeit), type (= def.id), def (SHIPS-Eintrag: id, f, len, r, role,
  speed, swarm, cls), owner, hull, hullMax, shield, shieldMax, dead, derelict, dormant, ion (im Ionennebel), acid, para
  {n}, dome > 0 (Schildkuppel), abT { invuln, grush, … }, sprint, truce, marked (Zeit), boarding, boardBy, hangar {n},
  o { t:'move'|'harvest'|'build'|…, bid, … }, mine (Vorkommen-Id beim Abbau), beams[] (siehe Effekte), fr (Zeit der
  letzten Heilung), cloak? }`. Jäger (`def.role === 'fighter'`) und Schwärme (`def.swarm`) sind viele und klein.
- `g.wrecks[]`: `{ x, y, ang, type, owner, until (Spielzeit), id }` – Wrack verblasst zur `until` hin.
- `g.proj[]`: `{ kind:'kin'|'rail'|'torp'|'acid'|'beam'|'rock'|'torpdie', x, y, ang, sp, r, col, owner, tid, life, para }`.
- `g.flares[]` `{x,y,r,t,t0}` (Sunbreaker-Eruption), `g.spores[]` `{x,y,r,t}` (Sporenteppich), `g.wave.open[]` `{x,y}`
  Risse (Quarantine), `g.wave.phase`.
- `g.players[i]`: `color || F.team` = Spielerfarbe (`view.pcol(owner)` liefert sie), `faction`.
- Sichtbarkeit: `view.visible(e)` (sichtbar jetzt), `view.seen(x, y)` (erkundet). Nicht sichtbare Schiffe werden nicht
  gezeichnet; Stationen auf erkundetem Grund gedämpft (zuletzt bekannter Stand).

## Stationen und Schiffe darstellen (entities.js)
- Ein Modell je Entität (`BUILD[def.id](mats(f, teamcolor), def)` bzw. `BUILDB[f + ':' + role](M, d, lv)`), Geometrien
  teilen, Materialsätze je (Fraktion, Spielerfarbe) zwischenspeichern (`mats(f, color)`). Beim Stufenwechsel (lv) oder
  Rollenwechsel Modell neu bauen. Objekte entfernen, wenn `dead`.
- Bau (`!done`): Modell halbdurchsichtig und von unten wachsend (Skalierung Y mit prog) oder als Drahtgitter mit
  Fortschrittsring (`ring`), Teamfarbe am Ring. `upg` läuft: weißer gestrichelter Bogen.
- `aimA`: Köpfe mit `userData.aim` auf `rotation.y = Math.PI / 2 - aimA` setzen (`userData.aimHold = true`, damit
  animate() nicht schwenkt). Superwaffe: `setCharge(root, b.charge)`. Werft: im `berth` liegt das entstehende Schiff
  (q[0].id) mit Deckkraft 0,15 + 0,6·qp. Raffinerie: Frachter am Dock nur, wenn tatsächlich einer dort andockt (sonst leer).
- Schiffe: Position/Kurs je Frame, leichtes Schweben/Rollen in Kurven ist erlaubt; Triebwerksflammen (`userData.flame`)
  skalieren mit `v / def.speed`; derelict = dunkel, keine Flammen, Funken; dormant = goldener Schimmer; invuln =
  goldener Ring; dome = Schildkuppel (Ellipsoid, blau, Fresnel); ion = leichtes violettes Flackern; marked, truce,
  para, boarding wie in render.js (kleine Marker über dem Schiff). Schildtreffer-Kuppel aufblitzen lassen (Ereignis
  'shield'). Trefferschaden: ab 60 % Schaden Rauchfahnen, ab 30 % Funken (Effekte liefern spawn-Funktionen).
- Jäger/Schwärme: vereinfachte Darstellung erlaubt (InstancedMesh des Modells oder Sprite), Hunderte möglich.
- Leistung: Ziel 60 fps auf Mittelklasse-Handys bei ~150 Schiffen und ~60 Stationen. Pro Modell wenige Draw-Calls (bake:
  unbewegte Teile je Material zusammenfassen – bewegte Teile mit aim/spin/flame/charge/berth/dock bleiben eigene Knoten).
  Frustum-Culling an, Schatten nur Detail 2 (eine Richtungsleuchte, Schattenkarte folgt der Kamera).
- Felsen: InstancedMesh je Grundform; Felder: bei vielen Feldern (> 60) nur noch Staubsprites, keine Splitterwolken.

## Nebel des Krieges (fog.js)
`view.fog` ist die 2D-Leinwand der Spielsicht (ein Pixel je VIS = 64 Einheiten: schwarz undurchsichtig = unbekannt,
halbdurchsichtig = erkundet, durchsichtig = sichtbar; siehe render.js fogUpdate). Als Textur auf eine Ebene knapp über
dem Boden legen (NearestFilter aus, Textur bei Änderung needsUpdate), über der Karte; die Ränder außerhalb der Karte
dunkel. Objekte unter unbekanntem Nebel werden nicht gezeichnet (Renderer prüft seen/visible).

## Effekte (src3d/effects/index.js) – Schnittstelle zum Kern
```
effects.init(scene, THREE, kitMats, detail)     // einmal
effects.event(e, g, view)                       // ein Ereignis (unten)
effects.frame(g, dt, time, view, cam)           // Strahlen (s.beams), Geschosse (g.proj), Flares, Sporen, Risse, Partikel
effects.spawn.smoke(x, y, r, n) / spark(x, y, n, speed, color) / ring(x, y, r, color, dur) / flash(x, y, r, color, dur)
effects.clear()
```
Ereignisse (e.t) und Felder wie in render.js R.consume: `die {x,y,r,big,owner,type,ang,vx,vy,quiet}`, `bdie {x,y,r,owner}`,
`hit {x,y,kind,dmg,owner}`, `shield {x,y,r,ang,owner}`, `shdown {x,y,r}`, `shot {x,y,kind,owner,ang,big,snd}`, `pd {x,y,tx,ty}`,
`built`, `upgrade {x,y,lv}`, `deliver`, `place`, `ability {x,y,r,id,owner}`, `abfx`, `lance {x,y,tx,ty}`, `board {fx,fy,x,y,n}`,
`captured`, `derelict`, `recrew`, `heal`, `exodus {x,y,r,to}`, `superfire {kind:'exodus'|'broodstorm'|'strike', x,y,r,sx,sy}`,
`strike {x,y,r}` (Masseeinschlag), `supercharged`, `jump {x,y,r,from}`, `merge {x,y,r}`, `bound {fx,fy,x,y}`, `dormant`,
`resurrect`, `ruin {x,y,result}`, `siteWon`, `gateOn`, `gateLance {fx,fy,x,y}`, `gateStorm {x,y}`, `wake`, `phase {x,y,r}`,
`burst {x,y,r}`, `hatch`, `devour {x,y,tx,ty,r}`, `breach {x,y,r}`, `gateDark`, `eat`, `morph`, `netoff`, `flareStart`.
Texte (fxText) bleiben in 2D – der Kern meldet dem Spiel nichts zurück.
- Strahlen: `s.beams[i] = { tid, t (Restzeit), extra[] }`, Waffe `wp = (s.k === 2 ? lvOf(s).wpn : s.def.wpn)[i]` mit
  `wp.col`, `wp.w` (Breite), Austritt bei `s.def.r * 0.5` Richtung Ziel; Darstellung: Kern weiß, Hülle in Waffenfarbe
  (additiv), Funken am Ziel. `lvOf(s) = s.def.lv[s.lv - 1]`.
- Geschosse: `kin` kurzer Leuchtstrich in `col`, `rail` lang und hell mit Nachglühen, `torp` Torpedokörper mit
  Rauch/Glutspur, `acid` grüner Tropfen, `rock` Masse-Geschoss (Massetreiber), `torpdie` erlischt.
- Explosionen: Blitz + Feuerball (Sprites, additiv) + Funken + Trümmer + Rauch + Druckring; `big` größer, Wrack bleibt
  (Kern zeichnet `g.wrecks`). Schildtreffer: Kuppelblitz in Teamfarbe am Treffpunkt. Alle Partikel in wenigen
  InstancedMesh/Points-Puffern, keine Einzelmeshes je Partikel; Budget ≤ 4 000 Partikel gleichzeitig (Detail 2), 1 500 (1), 600 (0).
- Superwaffen: Exodus-Tor (blau-weißer Wirbel, Schiffe blitzen weg/an), Massetreiber-Einschlag (Feuerball, Ring,
  Trümmer, Wackeln), Sunbreaker-Eruption (`g.flares`: brennende Scheibe mit Korona, Hitzeflimmern), Brutsturm (grün-
  violetter Ausbruch, Sporen). Tor-Lanze (`gateLance`), Tor-Sturm, Wächter erwacht, Durchbruch (Quarantine).
- Ruhig und lesbar: kein Dauerblinken, Bloom-Schwelle 1,25 beachten (keine weißen Klumpen).

## Prüfen
- `node tools/shot3d.js` (entsteht mit der Integration) rendert Spielszenen mit SwiftShader. Bis dahin: Labor-Seiten in
  /home/claude/probe3d (hangar.html) oder eigene kleine Testseiten im Scratchpad, mit Playwright (Pfad siehe probe3d/sheet.js).
- Kommentare auf Deutsch im Stil des Projekts, Kopfkommentar je Datei.
