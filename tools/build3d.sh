#!/bin/bash
# Bündelt den 3D-Renderer: src3d/index.js (+ Three.js, Modelle) → src/render3d.js als IIFE, das window.RA3D setzt.
cd "$(dirname "$0")/.."
NODE_PATH=tools/node_modules tools/node_modules/.bin/esbuild src3d/index.js --bundle --minify --format=iife --loader:.json=json --outfile=src/render3d.js --log-level=warning || exit 1
echo "src/render3d.js $(du -k src/render3d.js | cut -f1) KB"
