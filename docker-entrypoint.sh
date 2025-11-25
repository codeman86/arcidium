#!/bin/sh
set -euo pipefail

# Start Yjs collab server in background
node /app/collab-server.js &
COLLAB_PID=$!

cleanup() {
  echo "Shutting down collab server (pid: $COLLAB_PID)"
  kill "$COLLAB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

exec npm start
