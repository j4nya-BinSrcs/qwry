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
# Resolve embed mode: explicit user flags take precedence,
# otherwise fall back to config, then default false.
# Modifies POSITIONAL so that --embed / --no-embed are consumed.
# Usage:  resolve_embed POSITIONAL
#   Sets EMBED to "true" or "false" and removes consumed flags.
# ---------------------------------------------------------------
resolve_embed() {
    local -n arr="$1"
    local cfg_val
    cfg_val=$(get_cfg indexer embed false)
    EMBED="$cfg_val"

    local leftovers=()
    for arg in "${arr[@]}"; do
        case "$arg" in
            --embed)   EMBED="true" ;;
            --no-embed) EMBED="false" ;;
            *)         leftovers+=("$arg") ;;
        esac
    done
    arr=("${leftovers[@]}")
}

# ---------------------------------------------------------------
# Build crawler args from config + user overrides ($@).
# ---------------------------------------------------------------
build_crawl_args() {
    local max_depth       concurrency       max_pages
    local politeness_delay_secs  user_agent  external_domains
    local max_retries     retry_base_delay_secs  skip_politeness
    local batch_size      lightweight

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
    lightweight=$(get_cfg crawler lightweight false)

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
    if [[ "$lightweight" == "true" ]]; then
        printf -- '--lightweight '
    fi
}

# ---------------------------------------------------------------
# Build the common indexer prefix flags: --index-dir, --shards,
# and optionally --embed.
# ---------------------------------------------------------------
build_indexer_prefix() {
    local index_dir shards
    index_dir=$(get_cfg index_dir path "./data/index")
    shards=$(get_cfg indexer shards 1)
    printf -- '--index-dir %s --shards %s ' "$index_dir" "$shards"
    if [[ "$EMBED" == "true" ]]; then
        printf -- '--embed '
    fi
}

usage() {
    cat <<EOF
Usage:  $(basename "$0") <command> [options] [--seeds URL...|args]

Commands:
  crawl    --seeds URL...   Crawl pages from the given seed URLs
  index    [--embed|--no-embed]
                            Index unindexed pages into Tantivy
  reindex  [--embed|--no-embed]
                            Rebuild the Tantivy index from scratch
  search   [--embed|--no-embed] QUERY
                            Search the index (hybrid when --embed)
  serve    [--embed|--no-embed]
                            Start the search API server
  pipeline --seeds URL... [--embed|--no-embed]
                            crawl + index in one shot

Embedding options:
  --embed                  Enable semantic embeddings (hybrid search)
  --no-embed               Disable embeddings (BM25 keyword only)
                           Default: read from qwry.toml ([indexer] embed)

Config file: $CONFIG
EOF
    exit 0
}

CMD="${1:-}"
[[ -z "$CMD" ]] && usage
shift

find_bin() {
    local name="$1"
    local bin
    bin="$(cargo metadata --format-version=1 --manifest-path "$QWRY_DIR/Cargo.toml" 2>/dev/null \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['target_directory'])" 2>/dev/null)" || true
    if [[ -z "$bin" ]]; then
        bin="$QWRY_DIR/target"
    fi
    for dir in "$bin/release" "$bin/debug"; do
        if [[ -x "$dir/$name" ]]; then
            echo "$dir/$name"
            return
        fi
    done
    echo ""
}

# ---------------------------------------------------------------
# Run an indexer subcommand.
# Usage: run_indexer SUBCOMMAND [extra args...]
# ---------------------------------------------------------------
run_indexer() {
    local subcommand="$1"
    shift

    local bin
    bin=$(find_bin indexer)
    local prefix
    prefix=$(build_indexer_prefix)

    if [[ -n "$bin" ]]; then
        # shellcheck disable=SC2086
        "$bin" $prefix "$subcommand" "$@"
    else
        # shellcheck disable=SC2086
        cargo run --release --manifest-path "$QWRY_DIR/Cargo.toml" --bin indexer -- \
            $prefix "$subcommand" "$@"
    fi
}

# ---------------------------------------------------------------
# Crawl
# ---------------------------------------------------------------
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

    echo "=== Starting crawl (${#seeds[@]} seed(s)) ===" >&2

    local bin
    bin=$(find_bin crawler)
    if [[ -n "$bin" ]]; then
        # shellcheck disable=SC2046
        "$bin" $(build_crawl_args) "${user_args[@]}" --seeds "${seeds[@]}"
    else
        # shellcheck disable=SC2046
        cargo run --release --manifest-path "$QWRY_DIR/Cargo.toml" --bin crawler -- \
            $(build_crawl_args) "${user_args[@]}" --seeds "${seeds[@]}"
    fi
}

# ---------------------------------------------------------------
# Index
# ---------------------------------------------------------------
run_index() {
    local args=("$@")
    resolve_embed args
    echo "=== Indexing unindexed pages${EMBED:+ (embeddings: $EMBED)} ===" >&2
    run_indexer index "${args[@]}"
}

# ---------------------------------------------------------------
# Reindex
# ---------------------------------------------------------------
run_reindex() {
    local args=("$@")
    resolve_embed args
    echo "=== Rebuilding index from scratch${EMBED:+ (embeddings: $EMBED)} ==="
    run_indexer reindex "${args[@]}"
}

# ---------------------------------------------------------------
# Search
# ---------------------------------------------------------------
run_search() {
    if [[ $# -eq 0 ]]; then
        echo "ERROR: search requires a query string"
        exit 1
    fi
    local args=("$@")
    resolve_embed args
    echo "=== Searching: ${args[*]}${EMBED:+ (embeddings: $EMBED)} ===" >&2
    run_indexer search "${args[@]}"
}

# ---------------------------------------------------------------
# Serve
# ---------------------------------------------------------------
run_serve() {
    local port
    port=$(get_cfg indexer port 8001)
    local args=("$@")
    resolve_embed args
    echo "=== Starting search API server on port $port${EMBED:+ (embeddings: $EMBED)} ===" >&2
    run_indexer serve --port "$port" "${args[@]}"
}

# ---------------------------------------------------------------
# Pipeline: crawl + index
# ---------------------------------------------------------------
run_pipeline() {
    local embed_args=()
    local other_args=()
    for arg in "$@"; do
        case "$arg" in
            --embed|--no-embed) embed_args+=("$arg") ;;
            *)                  other_args+=("$arg") ;;
        esac
    done

    # Phase 1: crawl
    echo "========== PIPELINE: CRAWL =========="
    run_crawl "${other_args[@]}"

    # Phase 2: index
    echo "========== PIPELINE: INDEX =========="
    run_index "${embed_args[@]}"

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
