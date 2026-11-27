#!/bin/bash
# Packs BoltSpec for upload to cPanel (Setup Node.js App).
# Result: deploy/boltspec-upload.zip — without .env, node_modules, Docker files or local data.
set -e
cd "$(dirname "$0")/.."
OUT="deploy/boltspec-upload.zip"
rm -f "$OUT"
zip -rq "$OUT" package.json package-lock.json server.js src views public \
  -x "*.DS_Store" -x "*/node_modules/*"
echo "Gata: $(pwd)/$OUT ($(du -h "$OUT" | cut -f1))"
echo "Urcă-l în cPanel → File Manager → /home/vaqjugmd/boltspec, apoi Extract."
