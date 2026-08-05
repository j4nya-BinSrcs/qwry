# Troubleshooting

> **Audience:** users & ops | **Status:** complete

Common issues and fixes. If your problem isn't here, check the service logs or
[known-issues](known-issues.md).

---

## Startup / environment

### `launch.sh` — SearXNG upstream engines unreachable

SearXNG is up but every engine times out. Almost always DNS inside the container.

```bash
docker logs $(docker ps -q --filter name=searxng)
```

Fix: give the container working DNS (`--dns 1.1.1.1 --dns 8.8.8.8`) or check host resolution with
`curl https://www.google.com`. See [searxng](searxng.md#common-failure-upstream-engines-unreachable).

### Port already in use

`launch.sh` kills whatever listens on ports 8000/8001/5173/6379/8080 before starting. If another
process you need is on one of those ports, change the port via env vars (`PORT`, `ENGINE_PORT`,
`FRONTEND_PORT`, `SEARXNG_PORT`).

### Server starts but `/api/health` fails

Check Postgres is reachable (`DATABASE_URL`) — the lifespan connects before serving. Also confirm
`server/.venv` was created (`./launch.sh` does this automatically).

### `DATABASE_URL` must be set

The Rust engine exits with this error if `DATABASE_URL` isn't in the environment. Export it (e.g.
from `.env`) before launching the engine, or start via `./launch.sh` which inherits your shell env.

## Search problems

### Search returns no results

- **SearXNG** down → `/api/stats` shows it unreachable; start it with `./launch.sh --searxng`.
- **Engine empty** → the local index has no crawled pages yet. Run the crawler and `indexer index`,
  then check `http://127.0.0.1:8001/status` for `indexed_pages`.
- **Both providers fail** → hybrid mode returns an empty 200 with `provider=hybrid`; check provider
  health via `/api/stats`.

### Vector/hybrid search errors or empty results

Vector search requires the engine started with `--embed` (downloads BGE-small-en-v1.5 on first
use). If embeddings were never generated, vector mode returns nothing — run
`indexer ... index` after enabling `--embed`.

### Suggestions empty

Suggestions try SearXNG autocompleter, then search suggestions, then result titles, then the
engine. If all are empty, the upstream engines are likely unreachable (see above).

## UI problems

### Blank home screen

StrictMode + state timing issues have been seen in dev. Hard-refresh (Ctrl+Shift+R) or check the
browser console. If the frontend can't reach `/api`, confirm the Vite proxy target (port 8000) is
running.

### Image cards show broken thumbnails

`/api/image-proxy` can fail on sites that block the request (502). The card then shows a broken
image; the source URL itself may still be fine.

### Reader shows "javascript is required" boilerplate

The reader rejects JS-required pages by design (`reader.py` `_is_boilerplate_error`). Not a bug —
the page has no static content.

## Chat / LLM

### "Unknown summary_provider" at startup

`SUMMARY_PROVIDER` must be `ollama` (the only supported backend). Any other value crashes startup
by design.

### Chat/overview hangs or errors

Confirm Ollama is running and the model is pulled:

```bash
curl http://localhost:11434/api/tags   # lists models
ollama pull gemma3:1b
```

Overviews are cached (TTL 1800s); a cached failure can persist — restarting the server doesn't clear
Valkey, use `redis-cli FLUSHDB` (or `valkey-cli`) if needed.

## Related documentation

- [Getting Started](getting-started.md) — verification steps
- [SearXNG](searxng.md) — provider specifics
- [Known Issues](known-issues.md) — acknowledged bugs and workarounds
