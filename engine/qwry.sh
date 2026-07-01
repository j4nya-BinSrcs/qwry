#!/usr/bin/env bash
set -euo pipefail

QWRY_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="${QWRY_DIR}/qwry.toml"

# ---------------------------------------------------------------
# Read a string value from the TOML config file.
# Usage:  get_cfg SECTION KEY DEFAULT
# ---------------------------------------------------------------
get_cfg() {
    local section="$1" key="$2" default="$3"

    if [[ ! -f "$CONFIG" ]]; then
        printf '%s' "$default"
        return
    fi

    # Find the [section] marker, then look for key = value on
    # subsequent lines until the next section or EOF.
    local val
    val=$(
        awk -v sec="$section" -v k="$key" '
            $0 ~ "^\\[" sec "\\]"  { in_sec = 1; next }
            in_sec && /^\[/         { exit }
            in_sec && $1 == k       { sub(/^[^=]*= */, ""); gsub(/^"|"$/, ""); print; exit }
        ' "$CONFIG"
    )

    if [[ -n "$val" ]]; then
        printf '%s' "$val"
    else
        printf '%s' "$default"
    fi
}

# ---------------------------------------------------------------
# Build crawler args from config + user overrides ($@).
#
# The script accepts the same long flags as the crawler binary,
# so any --flag passed by the user takes precedence over config.
# ---------------------------------------------------------------
build_crawl_args() {
    # Config-based defaults
    local max_depth       concurrency       max_pages
    local politeness_delay_secs  user_agent  external_domains
    local max_retries     retry_base_delay_secs  skip_politeness
    local batch_size

    max_depth=$(get_cfg crawler max_depth 3)
    concurrency=$(get_cfg crawler concurrency 10)
    max_pages=$(get_cfg crawler max_pages 100)
    politeness_delay_secs=$(get_cfg crawler politeness_delay_secs 1.0)
    user_agent=$(get_cfg crawler user_agent "QwryBot/0.1")
    external_domains=$(get_cfg crawler external_domains false)
    max_retries=$(get_cfg crawler max_retries 3)
    retry_base_delay_secs=$(get_cfg crawler retry_base_delay_secs 5.0)
    skip_politeness=$(get_cfg crawler skip_politeness false)
    batch_size=$(get_cfg crawler batch_db_check_size 100)

    # Forward all user flags; --seeds is handled separately.
    printf -- '--max-depth %s --concurrency %s --max-pages %s ' \
        "$max_depth" "$concurrency" "$max_pages"
    printf -- '--politeness-delay-secs %s --user-agent %s ' \
        "$politeness_delay_secs" "$user_agent"
    printf -- '--max-retries %s --retry-base-delay-secs %s ' \
        "$max_retries" "$retry_base_delay_secs"
    printf -- '--batch-db-check-size %s ' "$batch_size"

    if [[ "$skip_politeness" == "true" ]]; then
        printf -- '--skip-politeness '
    fi
    if [[ "$external_domains" == "true" ]]; then
        printf -- '--external-domains '
    fi
}

usage() {
    cat <<EOF
Usage:  $(basename "$0") <command> [options] [--seeds URL...|args]

Commands:
  crawl    --seeds URL...   Crawl pages from the given seed URLs
  index                      Index unindexed pages into Tantivy
  reindex                    Rebuild the Tantivy index from scratch
  search QUERY               Search the index
  serve                      Start the search API server
  pipeline --seeds URL...    crawl + index in one shot

Run 'cargo run --bin crawler -- --help' or 'cargo run --bin indexer -- --help'
for available flags.  This script reads sensible defaults from qwry.toml.
EOF
    exit 0
}

CMD="${1:-}"
[[ -z "$CMD" ]] && usage
shift

# Dynamically locate the built binaries.
# Prefer Cargo, then release, then debug.
find_bin() {
    local name="$1"
    local bin
    bin="$(cargo metadata --format-version=1 --manifest-path "$QWRY_DIR/Cargo.toml" 2>/dev/null \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['target_directory'])" 2>/dev/null)" || true
    if [[ -z "$bin" ]]; then
        bin="$QWRY_DIR/target"
    fi
    # Check release first, then debug
    for dir in "$bin/release" "$bin/debug"; do
        if [[ -x "$dir/$name" ]]; then
            echo "$dir/$name"
            return
        fi
    done
    echo ""
}

run_crawl() {
    local seeds=()
    local user_args=()
    local pass_through=false
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --seeds)
                pass_through=true
                shift
                while [[ $# -gt 0 && "$1" != --* ]]; do
                    seeds+=("$1")
                    shift
                done
                ;;
            --)
                pass_through=true
                shift
                ;;
            *)
                if $pass_through; then
                    seeds+=("$1")
                else
                    user_args+=("$1")
                fi
                shift
                ;;
        esac
    done

    if [[ ${#seeds[@]} -eq 0 && ${#user_args[@]} -eq 0 ]]; then
        echo "ERROR: no seed URLs provided (use --seeds URL...)"

        exit 1
    fi

    echo "=== Starting crawl (${#seeds[@]} seed(s)) ==="

    local bin
    bin=$(find_bin crawler)
    if [[ -n "$bin" ]]; then
        # shellcheck disable=SC2046
        exec "$bin" $(build_crawl_args) "${user_args[@]}" --seeds "${seeds[@]}"
    else
        # shellcheck disable=SC2046
        exec cargo run --release --manifest-path "$QWRY_DIR/Cargo.toml" --bin crawler -- \
            $(build_crawl_args) "${user_args[@]}" --seeds "${seeds[@]}"
    fi
}

run_index() {
    local index_dir
    index_dir=$(get_cfg index_dir path "./data/index")
    echo "=== Indexing unindexed pages ==="
    local bin
    bin=$(find_bin indexer)
    if [[ -n "$bin" ]]; then
        exec "$bin" --index-dir "$index_dir" index "$@"
    else
        exec cargo run --release --manifest-path "$QWRY_DIR/Cargo.toml" --bin indexer -- \
            --index-dir "$index_dir" index "$@"
    fi
}

run_reindex() {
    local index_dir
    index_dir=$(get_cfg index_dir path "./data/index")
    echo "=== Rebuilding index from scratch ==="
    local bin
    bin=$(find_bin indexer)
    if [[ -n "$bin" ]]; then
        exec "$bin" --index-dir "$index_dir" reindex "$@"
    else
        exec cargo run --release --manifest-path "$QWRY_DIR/Cargo.toml" --bin indexer -- \
            --index-dir "$index_dir" reindex "$@"
    fi
}

run_search() {
    if [[ $# -eq 0 ]]; then
        echo "ERROR: search requires a query string"
        exit 1
    fi
    local index_dir
    index_dir=$(get_cfg index_dir path "./data/index")
    echo "=== Searching: $* ==="
    local bin
    bin=$(find_bin indexer)
    if [[ -n "$bin" ]]; then
        exec "$bin" --index-dir "$index_dir" search "$@"
    else
        exec cargo run --release --manifest-path "$QWRY_DIR/Cargo.toml" --bin indexer -- \
            --index-dir "$index_dir" search "$@"
    fi
}

run_serve() {
    local port
    port=$(get_cfg indexer port 8001)
    local index_dir
    index_dir=$(get_cfg index_dir path "./data/index")
    echo "=== Starting search API server on port $port ==="
    local bin
    bin=$(find_bin indexer)
    if [[ -n "$bin" ]]; then
        exec "$bin" --index-dir "$index_dir" serve --port "$port" "$@"
    else
        exec cargo run --release --manifest-path "$QWRY_DIR/Cargo.toml" --bin indexer -- \
            --index-dir "$index_dir" serve --port "$port" "$@"
    fi
}

run_pipeline() {
    # Phase 1: crawl
    echo "========== PIPELINE: CRAWL =========="
    run_crawl "$@"

    # Phase 2: index
    echo "========== PIPELINE: INDEX =========="
    run_index

    echo "========== PIPELINE DONE =========="
}

case "$CMD" in
    crawl)    run_crawl "$@" ;;
    index)    run_index "$@" ;;
    reindex)  run_reindex "$@" ;;
    search)   run_search "$@" ;;
    serve)    run_serve "$@" ;;
    pipeline) run_pipeline "$@" ;;
    help|--help|-h) usage ;;
    *)
        echo "Unknown command: $CMD"
        usage
        ;;
esac
