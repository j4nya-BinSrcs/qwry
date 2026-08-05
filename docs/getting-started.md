# Getting Started

> **Audience:** users | **Status:** complete
> **Source of truth:** `launch.sh`, `launch.bat`, `infra/docker-compose.yml`, `.env.example`

This guide walks through prerequisites, first run, and verifying that every service is healthy.
Follow the [usage guide](usage.md) for how to actually use QWRY afterwards.

---

## Prerequisites

| Tool | Version | Used for |
|---|---|---|
| Python | ≥ 3.13, < 3.14 | FastAPI server (`server/pyproject.toml`) |
| Rust toolchain (cargo) | stable | Engine build (`engine/Cargo.toml`) |
| Docker + Docker Compose | recent | SearXNG + Valkey containers |
| Ollama | latest | LLM overviews, summaries, chat |
| PostgreSQL | ≥ 14 | Main database |
| Node.js (optional) | ≥ 20 | Frontend via Vite |

Optional extras that enable vector search and reranking (the engine downloads BGE models the first
time they are used):

- `fastembed`-compatible ONNX models — used by the Rust engine with `--embed` / `--rerank`.

## 1. Clone and configure

```bash
git clone <repo-url> qwry
cd qwry
cp .env.example .env
```

Open `.env` and review at least:

- `DATABASE_URL` — must point at a reachable Postgres instance (e.g. `postgres://user@localhost:5432/qwry`).
- `OLLAMA_BASE_URL` / `SUMMARY_MODEL` — defaults to `http://localhost:11434` / `gemma3:1b`.
- `SEARXNG_ENABLED` — set `true` if SearXNG will be started.

## 2. Prepare the database

The server creates missing tables automatically at startup
(`Base.metadata.create_all` in `server/src/db/__init__.py`), so an empty schema is fine. For a clean
migration-based setup, run Alembic instead (see [database](database.md)):

```bash
server/.venv/bin/alembic upgrade head   # after step 3 creates the venv
```

## 3. Start everything

```bash
./launch.sh --all
```

This starts, in order: SearXNG (Docker), the Rust engine indexer, the FastAPI server, and the Vite
frontend. On Windows use `launch.bat --all`. Individual services can be started with
`./launch.sh --searxng|--engine|--server|--frontend` (default: server only).

The first engine build compiles the Rust workspace in release mode — allow several minutes.

## 4. Verify the stack

| Service | URL | Expected |
|---|---|---|
| Frontend | http://127.0.0.1:5173 | Home screen loads |
| Server health | http://127.0.0.1:8000/api/health | `{"status":"ok"}` |
| Server stats | http://127.0.0.1:8000/api/stats | JSON with service status |
| Engine health | http://127.0.0.1:8001/health | `{"status":"ok"}` |
| Engine status | http://127.0.0.1:8001/status | Index/page counts |
| SearXNG | http://127.0.0.1:8080/ | Search page renders |

```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok"}
```

## 5. First search

1. Open http://127.0.0.1:5173.
2. Type a query in the search bar and press **Enter**.
3. Results appear from SearXNG (web) and, once pages have been crawled, the local engine.
4. Click **+** on any result (or drag it) to save it into the active workspace.

![Home view](../assets/screenshots/home-view.png)
*<TBD: screenshot>*

## What's next?

- [Usage guide](usage.md) — how to use every feature.
- [Configuration](configuration.md) — tune providers, cache, and models.
- [Troubleshooting](troubleshooting.md) — if something above did not work.
