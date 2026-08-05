# Configuration

> **Audience:** users & ops | **Status:** complete
> **Source of truth:** `server/src/core/config.py`, `.env.example`, `engine/qwry.toml`, CLI args

QWRY is configured through environment variables (server + engine), CLI flags (engine binaries),
and a settings file that is currently not parsed. Everything below.

---

## Server environment variables

Loaded by `server/src/core/config.py` (pydantic-settings). Copy `.env.example` to `.env` and adjust.

### General

| Variable | Default | Description |
|---|---|---|
| `ENVIRONMENT` | `development` | Runtime environment label |
| `HOST` | `127.0.0.1` | Server bind host |
| `PORT` | `8000` | Server bind port |
| `LOG_LEVEL` | `INFO` | Logging level |
| `DATABASE_URL` | `postgresql://localhost:5432/qwry` | Postgres connection string |
| `CORS_ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Comma-separated allowed origins |

### Search providers

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_SEARCH_PROVIDER` | `searxng` | `searxng` \| `engine` \| `hybrid` \| `all` |
| `SEARXNG_ENABLED` | `true` | Whether SearXNG is expected to be running |
| `SEARXNG_BASE_URL` | `http://127.0.0.1:8080/` | SearXNG instance URL |
| `SEARXNG_TIMEOUT_SECONDS` | `5.0` | SearXNG request timeout |
| `ENGINE_BASE_URL` | `http://127.0.0.1:8001/` | Rust engine URL |
| `ENGINE_TIMEOUT_SECONDS` | `5.0` | Engine request timeout |
| `CRAWLER_ENABLED` | `true` | Whether a crawler is expected (stats only) |

### AI (Ollama)

| Variable | Default | Description |
|---|---|---|
| `SUMMARY_PROVIDER` | `ollama` | Only `ollama` is supported (startup fails otherwise) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `SUMMARY_MODEL` | `gemma3:1b` | Model used for overviews/summaries/chat |
| `SUMMARY_MAX_CONTENT_LENGTH` | `8000` | Max article chars sent to the LLM |
| `SUMMARY_TIMEOUT_SECONDS` | `30.0` | LLM request timeout |

### Cache (Valkey)

| Variable | Default | Description |
|---|---|---|
| `CACHE_ENABLED` | `true` | Master switch; disabled → all cache ops no-op |
| `VALKEY_HOST` | `127.0.0.1` | Valkey host |
| `VALKEY_PORT` | `6379` | Valkey port |
| `CACHE_SEARCH_TTL_SECONDS` | `300` | Search results TTL |
| `CACHE_SUMMARY_TTL_SECONDS` | `3600` | Summaries TTL |
| `CACHE_READER_TTL_SECONDS` | `3600` | Reader output TTL |
| `CACHE_LLM_TTL_SECONDS` | `1800` | LLM overview TTL |

## Engine CLI flags

The engine binary takes CLI args; the shipped `qwry.toml` is **not read by any crate** (see
[known-issues](known-issues.md)) — the values below mirror its defaults.

```
indexer --index-dir <PATH> [--shards N] [--embed] [--rerank] <command>
```

| Flag | Default | Description |
|---|---|---|
| `--index-dir` | `./data/index` | Tantivy index location |
| `--shards` | `1` | Number of index shards |
| `--embed` | off | Load BGE-small-en-v1.5 for vector search |
| `--rerank` | off | Load BGE-reranker-base for reranking |

Crawler flags (`crawler` binary, `--help` for the full list): `--seeds`, `--max-depth`,
`--max-pages`, `--concurrency`, `--politeness-delay-secs`, `--user-agent`, `--external-domains`,
`--max-retries`, `--retry-base-delay-secs`, `--skip-politeness`, `--batch-db-check-size`,
`--lightweight`, `--adaptive-concurrency`, `--distributed`.

## qwry.toml

Present in the repo but **unparsed** — a documentation-only reference of intended defaults:

```toml
[crawler]
max_depth = 3
max_pages = 100
concurrency = 10
politeness_delay_secs = 1.0
user_agent = "QwryBot/0.1"
external_domains = false
max_retries = 3
retry_base_delay_secs = 5.0
batch_db_check_size = 100
lightweight = false

[indexer]
port = 8001
embed = false
shards = 1

[index_dir]
path = "./data/index"
```

## Docker / SearXNG

`infra/docker-compose.yml` reads `SEARXNG_PORT`, `SEARXNG_SECRET`, `SEARXNG_VERSION`, and
`SEARXNG_WORKERS` from the environment. See [searxng](searxng.md).

## Related documentation

- [Getting Started](getting-started.md) — first run
- [Deployment](deployment.md) — production environment checklist
- [SearXNG](searxng.md) — SearXNG-specific configuration
