/* Testumgebung ohne Bildschirm: lädt die Simulationsmodule in einen eigenen Kontext und liefert createGame/stepGame */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SIM_MODULES = ['core.js', 'data.js', 'i18n.js', 'i18n_en.js', 'map.js', 'terrain.js', 'mapview.js', 'sim.js', 'combat.js', 'ai.js', 'waves.js', 'mission.js', 'missions.js', 'conquest.js'];
function loadSim(extra) {
  const src = (extra ? SIM_MODULES.concat(extra) : SIM_MODULES).map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
  const ctx = { console, Math, performance: { now: () => Date.now() } };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.X = { createGame, stepGame, stateHash, separate, execCmd, SHIPS, BLDG, MAPS, AI_LEVELS, STEP, findPath, generateMap, canPlace, labLevel, addShip, addBldg, removeShip, cmdAbility, cmdDoctrine, cmdSuper, trainReq, buildReq, recalcTech, shipAbils, DOCTRINES, ABIL, cmdMerge, cmdGate, cmdEtech, netCovered, presence, SITE_DEF, ETECH, FACTIONS, TECH, lvOf, damage, captureEntity, cmdReward, REWARDS, updateWaves, hyp, MISSIONS, CAMPAIGN, CAMP_ORDER, misOpts, misChoose, cqNew, cqTargets, cqSpec, cqBattleOpts, cqAuto, cqResult, cqFortify, cqDecide, cqEventDef, cqBattleResult, cqChance, cqMine, CQ_CHAP, CQ_TRUCE, CQ_FINAL, CQ_END, CQ_LOGS, misWin, misLose, cqCap, I18N, EN, EN_PAT, L, T };', ctx, { filename: 'sim.js' });
  ctx.X.ctx = ctx;
  return ctx.X;
}
/* Eine Partie KI gegen KI rechnen; liefert Zusammenfassung */
function runGame(X, opts, maxSec, onTick) {
  const g = X.createGame(opts), maxT = Math.round(maxSec / X.STEP);
  const t0 = Date.now();
  while (!g.over && g.tick < maxT) { X.stepGame(g); if (onTick) onTick(g); g.ev.length = 0; }
  const ms = Date.now() - t0;
  return { g, ms, time: g.time, over: g.over, winner: g.winner, ticks: g.tick,
    players: g.players.map(p => ({ f: p.faction, alive: p.alive, ice: Math.round(p.ice), ore: Math.round(p.ore), ships: g.ships.filter(u => !u.dead && u.owner === p.id).length, bldgs: g.bldgs.filter(b => !b.dead && b.owner === p.id).length, stats: p.stats, lab: X.labLevel(g, p.id) })) };
}
module.exports = { loadSim, runGame };
