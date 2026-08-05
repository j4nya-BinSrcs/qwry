# Known Issues

> **Audience:** developers & ops | **Status:** complete

An honest inventory of current bugs, gaps, and limitations, gathered from a code audit. Items are
grouped by area with severity and, where possible, a workaround. Cross-referenced throughout the
docs.

---

## Data / migrations

| Severity | Issue | Location |
|---|---|---|
| High | **Missing Alembic migrations** for station/canvas/AI/task tables (~14 tables). They are only created at runtime via `Base.metadata.create_all`, so `alembic upgrade head` produces an incomplete schema and these tables are invisible in migration history. | `server/src/db/__init__.py:34` |
| Medium | `WorkspaceRepo.MAX_ITEMS = 100` is dead code; the real limit is `MAX_ITEMS_PER_WORKSPACE = 1000` in the service. | `server/src/db/repository.py:66` |
| Low | `workspace_station_service.get_stats` hardcodes `summaries = 0` — no per-workspace summary counter exists. | `workspace_station_service.py:439` |
| Low | `WorkspaceTaggingRepo.assign` lacks a duplicate guard against the `uq_tagging` unique constraint — double-assign raises `IntegrityError`. | `workspace_station_service.py` |

## Security / ownership

| Severity | Issue | Location |
|---|---|---|
| High | **Update/delete endpoints bypass ownership checks** — canvas node/connection deletes, and station/AI/task update+delete, resolve entries by UUID without verifying the owning workspace/session. Any session that guesses a UUID can mutate it. | `canvas_service.py`, `workspace_station_service.py`, `ai_response_service.py`, `task_service.py` |
| Medium | **No authentication at all** — everything is scoped by a client-supplied `X-Session-Id`. | `server/src/core/session.py` |
| Medium | **Image proxy is an open proxy** — fetches any URL (`/api/image-proxy?url=`), including internal addresses. | `endpoints.py:385` |

## Client

| Severity | Issue | Location |
|---|---|---|
| Medium | **Drag-and-drop ignores the drop target** — dropping a search result anywhere adds it to the active workspace; the `workspace-drop` droppable is never checked. | `client/src/App.jsx:49` |
| Medium | **Reader/Summarizer re-add deleted entries** — deleting the currently-open read/summary removes it from the store, the load effect re-runs and re-fetches it, so deletion appears to do nothing. | `ReaderView.jsx:50`, `SummarizerView.jsx:52` |
| Low | **Canvas node removal** — deleting a node removes it from the canvas only; the underlying station object is kept. Auto-populate now runs only when the canvas is empty, so removed nodes no longer resurrect on reload. | `client/src/context/CanvasView.jsx` |
| Low | N+1 drag-reorder: one PATCH per item in a loop. | `client/src/App.jsx:43` |
| Low | `SummarizerView.jsx:102` calls `.delete` on a ref holding a string (no-op). | `SummarizerView.jsx:102` |
| Low | Search input placeholder is leftover gibberish (`"Cofftset"`). | `client/src/components/TopBar.jsx:125` |
| Low | Home workspace creation uses `prompt()` instead of an inline form. | `HomeView.jsx:62` |

## Dead code

| Severity | Item | Notes |
|---|---|---|
| Low | `client/src/dnd/handlers.js` | never imported; would pass the droppable id as `wsId` |
| Low | `client/src/stores/canvasStore.js` | never imported; CanvasView manages its own state |
| Low | `client/src/components/ReaderModal.jsx`, `MediaCard.jsx` | superseded by ReaderView and panel cards |
| Low | `workspaceStore` chat actions | ChatModal uses `api/chat.js` directly |
| Low | `endpoints.py` `_with_db` decorator | defined, never used |
| Low | `engine` `RetryClass::ServerError` | unreachable: 5xx errors classify as permanent |
| Low | `engine/qwry.toml` | not parsed by any crate; binaries take CLI args only |

## Engine (Rust)

| Severity | Issue | Location |
|---|---|---|
| Medium | **5xx errors classified as permanent** — `error_source_kind` never returns `ServerError`, so server errors get 0 retries. | `crawler/src/utils/retry.rs:36` |
| Medium | **Distributed retries silently dropped** — re-push is `ON CONFLICT DO NOTHING` against a row still `status='claimed'`; stale claimed jobs are never reaped. | `crawler/src/utils/db_job_queue.rs:57` |
| Medium | **Distributed dedup is in-memory** — `visited` is a local `ShardedSet`, so multi-node crawling doesn't dedupe across nodes; `batch_db_check_size` is unused. | `crawler/src/core/engine.rs:154` |
| Medium | **Vector search is brute-force** — loads all embeddings into memory per query. Fine for demos. | `shared/src/lib.rs:351` |
| Low | Robots.txt prefix-matching only (no `*`/`$` wildcards); always fetched over `https` (http-only hosts get allow-all). | `crawler/src/parser/robots.rs` |
| Low | Hardcoded UA (`QwryBot/0.1`) in retry robots check, ignoring the configured UA. | `crawler/src/core/engine.rs:615` |
| Low | Only `chunk_index = 0` embeddings are generated/used; long pages embedded whole. | `indexer/src/services/sharded.rs:234` |
| Low | Embedding save errors are swallowed (`.ok()`). | `sharded.rs:243` |
| Low | Hybrid `total_hits` is approximate (`max(bm25_total, ranked.len())`). | `sharded.rs:627` |
| Low | `flamegraph` is a regular (not dev) dependency of the crawler. | `crawler/Cargo.toml:21` |

## Server (Python)

| Severity | Issue | Location |
|---|---|---|
| Medium | `_search_hybrid` returns an empty 200 `provider=hybrid` when both providers fail. | `search_orch.py:65` |
| Low | `summarizer` imports private helpers from `reader` (`_legacy_extract_title`, etc.) — tight coupling. | `summarizer.py` |
| Low | Repeated in-handler imports (`from ... import X` inside handler bodies). | `endpoints.py` |
| Low | `sources_json` stored as a JSON string in a Text column with manual dumps/loads. | `endpoints.py:504` |
| Low | Only `ollama` supported; any other `SUMMARY_PROVIDER` crashes startup. | `main.py:46` |
| Low | `task_service.create_task` coerces non-datetime `due_date` to `None` silently. | `task_service.py:27` |

## Related documentation

- [Security](security.md) — the ownership/authentication gaps
- [Database](database.md) — the migration gap
- [Troubleshooting](troubleshooting.md) — end-user fixes
