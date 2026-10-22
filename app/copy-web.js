/* Kopiert die Offline-Fassung des Spiels als www/index.html in die App (vorher im Hauptordner »python3 tools/build.py«). */
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'build', 'rift-armada.html');
if (!fs.existsSync(src)) { console.error('Fehlt: ' + src + ' – zuerst im Hauptordner »python3 tools/build.py« ausführen.'); process.exit(1); }
fs.mkdirSync(path.join(__dirname, 'www'), { recursive: true });
fs.copyFileSync(src, path.join(__dirname, 'www', 'index.html'));
console.log('www/index.html', (fs.statSync(src).size / 1024).toFixed(0) + ' KB');
