#!/bin/bash
# Stops BoltSpec.
cd "$(dirname "$0")"
docker compose down
echo "BoltSpec stopped."
