# Database

> **Audience:** developers | **Status:** complete
> **Source of truth:** `server/src/db/models.py`, `server/alembic/versions/*`

QWRY uses PostgreSQL. The server schema is defined in SQLAlchemy models and applied with Alembic
migrations — plus a runtime `Base.metadata.create_all` that auto-creates any missing tables at
startup. This doc covers the models, the migration state, and the caveat that the two paths are out
of sync.

---

## Models overview

```mermaid
erDiagram
    USER ||--o{ WORKSPACE : owns
    WORKSPACE ||--o{ WORKSPACE_ITEM : has
    WORKSPACE ||--o{ WORKSPACE_CHAT_MESSAGE : has
    WORKSPACE ||--o{ WORKSPACE_READ : has
    WORKSPACE ||--o{ WORKSPACE_HIGHLIGHT : has
    WORKSPACE ||--o{ WORKSPACE_NOTE : has
    WORKSPACE ||--o{ WORKSPACE_PIN : has
    WORKSPACE ||--o{ WORKSPACE_IMAGE : has
    WORKSPACE ||--o{ WORKSPACE_VIDEO : has
    WORKSPACE ||--o{ WORKSPACE_COMPARISON : has
    WORKSPACE ||--o{ WORKSPACE_TIMELINE_EVENT : has
    WORKSPACE ||--o{ WORKSPACE_TAG : has
    WORKSPACE ||--o{ WORKSPACE_AI_RESPONSE : has
    WORKSPACE ||--o{ WORKSPACE_TASK : has
    WORKSPACE_ITEM ||--o{ WORKSPACE_READ : refers_to
    WORKSPACE_ITEM ||--o{ WORKSPACE_IMAGE : refers_to
    WORKSPACE_ITEM ||--o{ WORKSPACE_VIDEO : refers_to
    WORKSPACE_TAG ||--o{ WORKSPACE_TAGGING : applies
    WORKSPACE ||--o{ CANVAS_NODE : has
    WORKSPACE ||--o{ CANVAS_CONNECTION : has
    CANVAS_NODE ||--o{ CANVAS_CONNECTION : connects
    PROFILE ||--o{ SEARCH_HISTORY : has
    PROFILE ||--o{ READING_LIST_ITEM : has
    PROFILE ||--o{ SUMMARY_LIST_ITEM : has
    PROFILE ||--o{ ACTIVITY_LOG : has
    PROFILE ||--o{ LLM_OVERVIEW : has

    WORKSPACE {
        uuid id PK
        uuid user_id FK "nullable"
        text session_id "nullable"
        text name
        text description
    }
    WORKSPACE_ITEM {
        uuid id PK
        uuid workspace_id FK
        text url
        text media_url
        text title
        text snippet
        text source
        text summary
        text notes
        int order_index
    }
    PROFILE {
        text session_id PK
        text username
        text theme
        text search_provider
    }
    WORKSPACE_PIN {
        uuid id PK
        text pinnable_type
        uuid pinnable_id
        int order_index
    }
    CANVAS_NODE {
        uuid id PK
        text object_type
        uuid object_id
        float x, y, w, h
        int z_index
        boolean pinned
    }
```

### Domain model

- **Workspace graph** — `Workspace` → `WorkspaceItem` (saved sources) and `WorkspaceChatMessage`.
  `Workspace.user_id` is nullable and never set by the API today; ownership is by `session_id`.
- **Session-scoped history** — `Profile` (keyed by `session_id`) plus `SearchHistory`,
  `ReadingListItem` (unique `session_id,url`), `SummaryListItem` (unique `session_id,url`),
  `ActivityLog` (JSONB `details`), and `LLMOverview` (unique `session_id,query`).
- **Station entities** — `WorkspaceRead` (status `unread/reading/completed` with timestamps),
  `WorkspaceHighlight`, `WorkspaceNote`, `WorkspacePin` (polymorphic `pinnable_type`/`pinnable_id`,
  ordered by `order_index`), `WorkspaceImage`, `WorkspaceVideo`, `WorkspaceComparison` (JSONB
  `data`), `WorkspaceTimelineEvent`, `WorkspaceTag` → `WorkspaceTagging` (polymorphic, unique
  `(tag_id, taggable_type, taggable_id)`).
- **Canvas** — `CanvasNode` (polymorphic over station objects, x/y/w/h/z/pinned) and
  `CanvasConnection` (source/target node FKs).
- **AI & tasks** — `WorkspaceAIResponse` (prompt/response/tokens) and `WorkspaceTask`
  (status/priority/due_date).

## Migration state

Alembic lives in `server/alembic` with a linear chain of numeric revisions:

| Revision | Contents |
|---|---|
| `0001` | `users` table |
| `0002` | `workspaces` |
| `0003` | `workspace_items` |
| `0004` | `media_url` on items |
| `0005` | profile tables (profiles, search_history, reading_list, summary_list, activity_log) |
| `0006` | content/content_type/media_url on reading+summary lists; `llm_overviews` |
| `0007` | `workspace_chat_messages` |

**Gap:** there are **no migrations** for the station, canvas, AI, and task tables
(`workspace_reads`, highlights, notes, pins, images, videos, comparisons, timeline, tags, taggings,
`canvas_nodes`, `canvas_connections`, `workspace_ai_responses`, `workspace_tasks`). They are created
at startup because `init_db` runs `Base.metadata.create_all`
(`server/src/db/__init__.py:34`). This means Alembic is effectively bypassed for those tables —
`alembic upgrade head` alone would produce a schema missing them, and they are invisible in
`alembic history`. Tracked in [known-issues](known-issues.md).

## Engine tables (managed by Rust, not Alembic)

The Rust engine creates its own tables via `shared/src/lib.rs`:

- `crawled_pages` — `id`, `url` (unique), `title`, `description`, `content`, `crawled_at`,
  `indexed`. Handoff contract: crawler writes with `indexed=false`, indexer marks `indexed=true`.
- `page_embeddings` — `page_id` FK, `chunk_index`, `model` (default `BGE-small-en-v1.5`),
  `dimension` (default 384), `embedding REAL[]`; unique `(page_id, chunk_index)`.
- `crawl_jobs` — created by the crawler only in distributed mode.

## Related documentation

- [Server](server.md) — services that read/write these tables
- [API Reference](api-reference.md) — endpoints exposing the data
- [Known Issues](known-issues.md) — migration gap and ownership gaps
