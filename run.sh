#!/usr/bin/env bash
set -e

cd backend
python combined_router.py &
backend_pid=$!

cleanup() {
  kill "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd ../frontend
HOST=0.0.0.0 \
PORT=5000 \
DANGEROUSLY_DISABLE_HOST_CHECK=true \
npm start