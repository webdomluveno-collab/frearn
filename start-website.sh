#!/bin/bash
# Spustí Project web lokálně (Node.js je stažený v TMPDIR, není potřeba instalace).
export PATH="/private/var/folders/wy/wsq501754nx3zc8q2t9wg5cr0000gn/T/opencode/node-v20.19.5-darwin-x64/bin:$PATH"
cd "$(dirname "$0")"
npm run dev -- -p 3000
