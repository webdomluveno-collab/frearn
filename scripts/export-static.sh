#!/bin/bash
# Build a fully static version of the site (plain HTML/CSS/JS in ./out/)
# for classic static hosting (Netlify Drop, GitHub Pages, Wedos, Endora, ...).
#
# Server-only pieces (API routes, middleware) are moved aside during the
# export and restored afterwards. The waitlist form automatically switches
# to a mailto fallback (see components/faq-waitlist.tsx).
set -e
export PATH="/private/var/folders/wy/wsq501754nx3zc8q2t9wg5cr0000gn/T/opencode/node-v20.19.5-darwin-x64/bin:$PATH"
cd "$(dirname "$0")/.."

restore() {
  [ -d ".export-bak/api" ] && rm -rf app/api && mv .export-bak/api app/api
  [ -f ".export-bak/middleware.ts" ] && mv .export-bak/middleware.ts middleware.ts
  rmdir .export-bak 2>/dev/null || true
}
trap restore EXIT

mkdir -p .export-bak
[ -d "app/api" ] && mv app/api .export-bak/api
[ -f "middleware.ts" ] && mv middleware.ts .export-bak/middleware.ts

STATIC_EXPORT=true NEXT_PUBLIC_STATIC_EXPORT=true npm run build

echo ""
echo "✅ Static site ready in ./out/ — upload its CONTENTS to your hosting."
