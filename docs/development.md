# Development

> **Audience:** developers | **Status:** complete
> **Source of truth:** `server/pyproject.toml`, `server/test/*`, `engine/**/Cargo.toml`,
> `client/eslint.config.js`

How to set up the dev environment, run tests and linters, and contribute.

---

## Server (Python)

### Setup

```bash
python3 -m venv server/.venv
server/.venv/bin/pip install -e "server/[dev]"
```

### Run the server

```bash
cd server
.venv/bin/uvicorn server.src.main:app --reload --port 8000
```

### Tests

```bash
server/.venv/bin/pytest server/test
```

Test files: `test_health.py`, `test_search.py`, `test_stats.py`, `test_suggest.py`,
`test_workspace.py`, `test_workspace_station.py`, `test_workspace_canvas.py`. Config lives in
`server/pyproject.toml` (`testpaths = ["test"]`).

### Lint & format

```bash
server/.venv/bin/ruff check server
server/.venv/bin/ruff format server
```

Ruff rules: `E, F, I, N, W, UP, B`, line length 120, double quotes (`server/pyproject.toml`).

### Migrations

```bash
server/.venv/bin/alembic -c server/alembic.ini revision --autogenerate -m "describe change"
server/.venv/bin/alembic -c server/alembic.ini upgrade head
```

> ⚠️ Several tables are not yet covered by migrations — they're created at startup via
> `Base.metadata.create_all`. See [database](database.md) and [known-issues](known-issues.md).

## Engine (Rust)

### Build

```bash
cargo build --release --manifest-path engine/Cargo.toml --bin indexer
cargo build --manifest-path engine/Cargo.toml -p crawler
```

### Test

```bash
cargo test --manifest-path engine/Cargo.toml --workspace
```

Tests that need the embedding model (network download of BGE weights) are marked `#[ignore]` and run
with `cargo test -- --ignored`. The e2e test in `engine/shared/tests/full_pipeline.rs` spins up a
local HTTP server and exercises crawl → index → search.

### Run

```bash
# CLI search
engine/target/release/indexer --index-dir engine/data/index search "query" --mode hybrid

# HTTP API
engine/target/release/indexer --index-dir engine/data/index serve --port 8001
```

## Client (React)

```bash
cd client
npm install
npm run dev          # Vite dev server on :5173
npm run build        # production build
npm run lint         # eslint (config: eslint.config.js)
```

## Contributing checklist

1. Branch off `main`; keep commits small and focused.
2. Run the affected test suite + linters before pushing.
3. Update or add documentation under `docs/` when behavior changes (see
   [templates/doc-template.md](templates/doc-template.md)).
4. Cross-link related docs from the [docs index](README.md).
5. When adding tables, create an Alembic migration (don't rely on `create_all`).

## Related documentation

- [docs index](README.md) — every doc
- [Database](database.md) — migration workflow context
- [Known Issues](known-issues.md) — outstanding work to pick up
