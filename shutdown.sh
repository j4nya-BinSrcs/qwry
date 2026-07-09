#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Kill processes by port
for port in 8000 8001 5173 8080; do
    pid=$(lsof -ti ":$port" 2>/dev/null) || true
    if [[ -n "$pid" ]]; then
        warn "Killing PID $pid on port $port"
        kill -9 "$pid" 2>/dev/null || true
    fi
done

# Kill any lingering uvicorn / vite / node processes
for proc in "uvicorn" "vite" "indexer" "node"; do
    pids=$(pgrep -f "$proc" 2>/dev/null) || true
    if [[ -n "$pids" ]]; then
        warn "Killing $proc processes: $pids"
        kill -9 $pids 2>/dev/null || true
    fi
done

# Stop SearXNG Docker containers
if command -v docker &>/dev/null; then
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q searxng; then
        info "Stopping SearXNG Docker containers ..."
        docker compose -f infra/docker-compose.yml --profile searxng down 2>/dev/null || true
    fi
fi

info "All services stopped"