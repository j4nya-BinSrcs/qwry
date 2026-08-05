# Architecture

> **Audience:** developers | **Status:** complete
> **Source of truth:** `server/src`, `engine/*`, `client/src`, `infra/docker-compose.yml`

This document describes the overall system design: components, ports, data flow, and the lifecycle
of a search query. See [server](server.md), [engine](engine.md), and [client](client.md) for the
per-tier internals.

---

## Overview

QWRY is a three-tier system plus supporting infrastructure:

1. **React client** (`client/`, port 5173) — browser UI with search, workspaces, station, canvas,
   reader, and summarizer views.
2. **FastAPI server** (`server/`, port 8000) — orchestrates search, persists data to Postgres,
   caches to Valkey, and calls Ollama for LLM features.
3. **Rust engine** (`engine/`, port 8001) — a polite web crawler plus a Tantivy-based indexer that
   exposes BM25 / vector / hybrid search over crawled pages.
4. **SearXNG** (`infra/`, port 8080) — metasearch aggregator providing live web results, images,
   videos, news, suggestions, and infoboxes.

![Home view](../assets/screenshots/home-view.png)
*<TBD: screenshot>*

## Component diagram

```mermaid
flowchart LR
    subgraph Browser
        C[React client :5173]
    end
    subgraph Backend
        S[FastAPI server :8000]
    end
    subgraph Search
        E[Rust engine :8001]
        X[SearXNG :8080]
    end
    subgraph Data
        P[(Postgres :5432)]
        V[(Valkey :6379)]
        I[(Tantivy index)]
        O[Ollama :11434]
    end

    C -->|HTTP /api| S
    S -->|GET /search| X
    S -->|GET /search, /status| E
    S --> V
    S --> P
    S -->|generate/summarize| O
    E --> P
    E --> I
```

## Ports

| Port | Service | Config |
|---|---|---|
| 5173 | Vite dev server (client) | `FRONTEND_PORT` |
| 8000 | FastAPI server | `HOST` / `PORT` |
| 8001 | Rust engine indexer | `ENGINE_PORT` |
| 8080 | SearXNG | `SEARXNG_PORT` |
| 6379 | Valkey (Redis-compatible) | `VALKEY_PORT` |
| 5432 | PostgreSQL | `DATABASE_URL` |
| 11434 | Ollama | `OLLAMA_BASE_URL` |

## Search data flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant X as SearXNG
    participant E as Engine
    participant V as Valkey
    participant P as Postgres
    participant O as Ollama

    C->>S: GET /api/search?q=...
    S->>V: cache lookup
    alt cache hit
        V-->>S: cached results
    else cache miss
        S->>X: GET /search?q=...&format=json
        X-->>S: web results
        S->>E: GET /search?q=...&mode=hybrid
        E-->>S: local index hits
        S->>S: merge + dedupe by URL
        S->>V: store results (TTL 300s)
    end
    S-->>C: SearchResponse
    C->>S: POST /api/llm/generate (short overview)
    S->>O: generate summary
    O-->>S: overview text
    S->>P: log search / save overview
    S-->>C: overview
```

Provider selection is controlled by the `provider` query param (`searxng` | `engine` | `hybrid` |
`all`) or the `DEFAULT_SEARCH_PROVIDER` env var. The hybrid path runs both providers concurrently and
merges by URL (`server/src/services/search_orch.py`).

## Crawl → index → search lifecycle

```mermaid
flowchart LR
    A[Seeds] --> B[Crawler worker]
    B -->|polite fetch, robots.txt| C[(Postgres crawled_pages)]
    C -->|unindexed pages| D[Tantivy indexer]
    D --> I[(Tantivy index)]
    D -->|embeddings| C
    C -->|embeddings table| E[(page_embeddings)]
    I --> G[Search API :8001]
    E --> G
    G --> H[hybrid fusion / rerank]
```

The crawler writes batches of pages with `indexed = false`; the indexer picks up batches of 500,
indexes them into Tantivy, marks them `indexed`, and generates embeddings for vector search. Search
results then come from BM25 (Tantivy), cosine similarity (vector), or a fused hybrid ranking.
Details in [engine](engine.md).

## Persistence overview

- **Postgres** — workspaces, items, station entities, canvas, chat messages, profiles, history.
- **Valkey** — TTL caches for search results, summaries, reader output, and LLM overviews.
- **Tantivy index** — searchable document index on disk under `engine/data/index`.

See [database](database.md) for the schema and [configuration](configuration.md) for cache TTLs.

## Related documentation

- [Server](server.md) · [Engine](engine.md) · [Client](client.md) · [Database](database.md) ·
  [Configuration](configuration.md)
