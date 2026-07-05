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

SERVER_PID=""
ENGINE_PID=""
SEARXNG_PID=""

cleanup() {
    info "Shutting down services ..."
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
  --all         Start all services (SearXNG + Rust engine + FastAPI)
  --searxng     Start SearXNG via Docker Compose
  --engine      Start the Rust indexer server on port 8001
  --server      Start the FastAPI server (default)
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
    local index_dir="${INDEX_DIR:-./data/index}"

    info "Starting Rust engine indexer on port $port"
    cd engine
    ./target/release/indexer --index-dir "$index_dir" serve --port "$port" &
    ENGINE_PID=$!
    cd "$OLDPWD"
}

# ---------------------------------------------------------------------------
# SearXNG via Docker Compose
# ---------------------------------------------------------------------------
start_searxng() {
    if ! command -v docker &>/dev/null; then
        error "Docker not found. Cannot start SearXNG."
        exit 1
    fi

    info "Starting SearXNG via Docker Compose ..."
    sudo docker compose -f infra/docker-compose.yml --profile searxng up -d
    warn "SearXNG may take a moment to become ready on http://127.0.0.1:${SEARXNG_PORT:-8080}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
START_ALL=false
START_SEARXNG=false
START_ENGINE=false
START_SERVER=false

if [[ $# -eq 0 ]]; then
    START_SERVER=true
else
    for arg in "$@"; do
        case "$arg" in
            --all)     START_ALL=true ;;
            --searxng) START_SEARXNG=true ;;
            --engine)  START_ENGINE=true ;;
            --server)  START_SERVER=true ;;
            --help|-h) usage ;;
            *)         error "Unknown option: $arg"; usage ;;
        esac
    done
fi

if $START_ALL; then
    START_SEARXNG=true
    START_ENGINE=true
    START_SERVER=true
fi

$START_SEARXNG && start_searxng
$START_ENGINE && start_engine
$START_SERVER && start_server

if $START_SERVER; then
    info "FastAPI server running — press Ctrl+C to stop"
    wait $SERVER_PID
else
    info "All requested services started — press Ctrl+C to stop"
    wait
fi
