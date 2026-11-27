#!/bin/bash
# Starts BoltSpec with Docker and opens it in the browser.
cd "$(dirname "$0")"
if ! docker info >/dev/null 2>&1; then
  open -a Docker; echo "Waiting for Docker..."
  until docker info >/dev/null 2>&1; do sleep 2; done
fi
# local dataset: make it readable for the container user (bind mounts keep the Mac file permissions)
# files must be readable by the container user (the image copies the Mac permissions)
chmod -R a+rX src views public 2>/dev/null; chmod a+r package.json package-lock.json server.js docker-compose.yml 2>/dev/null
[ -d local-data ] && chmod 755 local-data && chmod 644 local-data/*.json 2>/dev/null
docker compose up -d --build
PORT=$(grep -E '^HOST_PORT=' .env | cut -d= -f2); PORT=${PORT:-3090}
until curl -fs "http://localhost:$PORT/healthz" >/dev/null; do sleep 1; done
open "http://localhost:$PORT/"
echo "BoltSpec is running on http://localhost:$PORT (admin: /admin/)"
