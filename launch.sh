#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
cmd()   { echo -e "${CYAN}[CMD]${NC}   $*"; }

kill_port() {
    local port="$1"
    local pid
    pid=$(lsof -ti ":$port" 2>/dev/null) || true
    if [[ -n "$pid" ]]; then
        warn "Port $port in use by PID $pid — killing ..."
        kill "$pid" 2>/dev/null || true
        sleep 1
    fi
}

SERVER_PID=""
ENGINE_PID=""
SEARXNG_PID=""
FRONTEND_PID=""

cleanup() {
    info "Shutting down services ..."
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && wait "$FRONTEND_PID" 2>/dev/null
    [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null && wait "$SERVER_PID" 2>/dev/null
    [[ -n "$ENGINE_PID" ]] && kill "$ENGINE_PID" 2>/dev/null && wait "$ENGINE_PID" 2>/dev/null
    if [[ -n "$SEARXNG_PID" ]]; then
        kill "$SEARXNG_PID" 2>/dev/null
        docker compose -f infra/docker-compose.yml down 2>/dev/null || true
        wait "$SEARXNG_PID" 2>/dev/null
    fi
    info "All services stopped"
}
trap cleanup EXIT INT TERM

usage() {
    cat <<EOF
Usage:  $(basename "$0") [options]

Options:
  --all         Start all services (SearXNG + Rust engine + FastAPI + frontend)
  --searxng     Start SearXNG via Docker Compose
  --engine      Start the Rust indexer server on port 8001
  --server      Start the FastAPI server (default)
  --frontend    Start the Vite dev server for the frontend
  --help        Show this help

If no option is given, only the FastAPI server starts.
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Python / uvicorn
# ---------------------------------------------------------------------------
ensure_python_env() {
    if [ ! -d server/.venv ]; then
        info "Creating Python virtual environment ..."
        python3 -m venv server/.venv
    fi
    if [ ! -f server/.venv/bin/pip3 ]; then
        info "Installing pip in virtual environment ..."
        server/.venv/bin/python3 -m ensurepip --upgrade
    fi
    info "Installing / updating Python dependencies ..."
    server/.venv/bin/pip3 install --quiet -e server/
}

start_server() {
    ensure_python_env
    source server/.venv/bin/activate

    local host="${HOST:-127.0.0.1}"
    local port="${PORT:-8000}"
    local env="${ENVIRONMENT:-development}"

    kill_port "$port"
    info "Starting FastAPI server on $host:$port ($env)"
    uvicorn server.src.main:app --host "$host" --port "$port" --reload &
    SERVER_PID=$!
}

# ---------------------------------------------------------------------------
# Rust engine indexer
# ---------------------------------------------------------------------------
ensure_engine_bin() {
    if [ ! -f engine/target/release/indexer ]; then
        info "Building Rust engine (release) ..."
        cargo build --release --manifest-path engine/Cargo.toml --bin indexer
    fi
}

start_engine() {
    ensure_engine_bin
    local port="${ENGINE_PORT:-8001}"
    kill_port "$port"
    local index_dir="${INDEX_DIR:-./data/index}"

    info "Starting Rust engine indexer on port $port"
    cd engine
    ./target/release/indexer --index-dir "$index_dir" serve --port "$port" &
    ENGINE_PID=$!
    cd "$OLDPWD"
}

# ---------------------------------------------------------------------------
# Frontend Vite dev server
# ---------------------------------------------------------------------------
start_frontend() {
    local host="${FRONTEND_HOST:-127.0.0.1}"
    local port="${FRONTEND_PORT:-5173}"

    kill_port "$port"
    info "Starting Vite dev server on $host:$port"
    cd client
    npx vite --host "$host" --port "$port" &
    FRONTEND_PID=$!
    cd "$OLDPWD"
}

# ---------------------------------------------------------------------------
# SearXNG via Docker Compose
# ---------------------------------------------------------------------------
_docker() {
    if docker "$@" 2>/dev/null; then
        return 0
    fi
    if sg docker -c "docker $*" 2>/dev/null; then
        return 0
    fi
    sudo docker "$@"
}

start_searxng() {
    if ! command -v docker &>/dev/null; then
        error "Docker not found. Cannot start SearXNG."
        exit 1
    fi

    kill_port "${SEARXNG_PORT:-8080}"
    kill_port "6379"
    info "Starting SearXNG via Docker Compose ..."
    _docker compose -f infra/docker-compose.yml --profile searxng up -d
    sleep 4
    if curl -s -o /dev/null -w "" "http://127.0.0.1:${SEARXNG_PORT:-8080}/" 2>/dev/null; then
        info "SearXNG is running on http://127.0.0.1:${SEARXNG_PORT:-8080}"
    else
        warn "SearXNG may still be starting — check logs: _docker logs \$(_docker ps -q --filter name=searxng)"
    fi
    _health_searxng
}

_health_searxng() {
    local searxng_cid
    searxng_cid=$(_docker ps -q --filter name=searxng 2>/dev/null || true)
    if [[ -n "$searxng_cid" ]]; then
        local engines
        engines=$(curl -s --max-time 5 "http://127.0.0.1:${SEARXNG_PORT:-8080}/search?q=test&format=json" 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    for e in d.get('unresponsive_engines', []):
        print(f'  {e[0]}: {e[1]}')
except: pass
" 2>/dev/null)
        if [[ -n "$engines" ]]; then
            warn "SearXNG upstream engines unreachable:"
            echo "$engines"
            warn "This is often a DNS/networking issue in the Docker container."
            warn "See logs: _docker logs $searxng_cid"
        else
            info "SearXNG upstream engines are responding"
        fi
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
START_ALL=false
START_SEARXNG=false
START_ENGINE=false
START_SERVER=false
START_FRONTEND=false

if [[ $# -eq 0 ]]; then
    START_SERVER=true
else
    for arg in "$@"; do
        case "$arg" in
            --all)      START_ALL=true ;;
            --searxng)  START_SEARXNG=true ;;
            --engine)   START_ENGINE=true ;;
            --server)   START_SERVER=true ;;
            --frontend) START_FRONTEND=true ;;
            --help|-h)  usage ;;
            *)          error "Unknown option: $arg"; usage ;;
        esac
    done
fi

if $START_ALL; then
    START_SEARXNG=true
    START_ENGINE=true
    START_SERVER=true
    START_FRONTEND=true
fi

$START_SEARXNG && start_searxng
$START_ENGINE && start_engine
$START_SERVER && start_server
$START_FRONTEND && start_frontend

if $START_SERVER || $START_FRONTEND; then
    info "Services running — press Ctrl+C to stop"
    if $START_SEARXNG; then
        searxng_container=$(docker ps -q --filter name=searxng 2>/dev/null || true)
        if [[ -n "$searxng_container" ]]; then
            warn "Check SearXNG errors:  docker logs $searxng_container"
        fi
    fi
    info "Stop everything:   ./shutdown.sh"
    wait
fi
