/* Ringkarten als Bogen: node tools/ringshots.js [ids…] → tools/shots/ring-<id>.png (2, 3, 4, 5, 6, 8 Spieler nebeneinander) */
const { chromium } = require('playwright'); const path = require('path');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['expanse', 'bastions', 'maelstrom'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1900, height: 340 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'build', 'rift-armada.html')); await p.waitForTimeout(800);
  for (const id of ids) {
    await p.evaluate(id => { document.body.innerHTML = ''; document.body.style.background = '#000'; for (const np of [2, 3, 4, 5, 6, 8]) { if (MAPS[id].np.indexOf(np) < 0) continue; const cv = document.createElement('canvas'); cv.width = cv.height = 310; cv.style.margin = '4px'; document.body.appendChild(cv); mapLayout(cv, generateMap(id, np, 7), {}); } }, id);
    await p.screenshot({ path: path.join(__dirname, 'shots', 'ring-' + id + '.png') });
  }
  console.log(errs.join('\n') || 'ok'); await b.close();
})();
