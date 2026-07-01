#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d server/.venv ]; then
    echo "Creating virtual environment..."
    python3 -m venv server/.venv
    server/.venv/bin/pip install --upgrade pip
    server/.venv/bin/pip install -e server/
fi

source server/.venv/bin/activate

export ENVIRONMENT="${ENVIRONMENT:-development}"
export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-8000}"

echo "Starting QWRY server on $HOST:$PORT ($ENVIRONMENT)"
exec uvicorn server.src.main:app --host "$HOST" --port "$PORT" --reload
