# API Reference

> **Audience:** developers | **Status:** complete
> **Source of truth:** `server/src/api/router.py`, `server/src/api/endpoints.py`,
> `server/src/api/schemas.py`

All endpoints live under the FastAPI server on port 8000. The client authenticates nothing — it
sends a session id in the `X-Session-Id` header. Interactive docs are available at
`http://127.0.0.1:8000/docs` when the server is running.

> Note: The engine exposes its own small API (port 8001) — see [engine](engine.md#http-api-port-8001).

---

## Health & system

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness probe → `{"status":"ok"}` |
| GET | `/api/stats` | Service + request stats (collects from engine/SearXNG) |

## Search

| Method | Path | Description |
|---|---|---|
| GET | `/api/search` | Search. Query params: `q` (required), `page`, `page_size`, `provider` (`searxng`\|`engine`\|`hybrid`\|`all`), `categories` (comma-separated), `mode` (`bm25`\|`vector`\|`hybrid`), `rerank`, `alpha`, `beta` |
| GET | `/api/suggest` | Query suggestions. Params: `q`, `provider` |
| GET | `/api/image-proxy` | Proxy an image URL. Params: `url` |

### Search response shape

```json
{
  "query": "rust",
  "page": 1,
  "page_size": 10,
  "total_results": 8,
  "results": [{ "title": "...", "url": "...", "snippet": "...", "source": "searxng" }],
  "provider": "searxng"
}
```

## AI / LLM

| Method | Path | Description |
|---|---|---|
| POST | `/api/llm/generate` | Generate an overview. Body: `{ query, mode: "short"\|"elaborate"\|"study", results?: [{title,url}] }` |
| GET | `/api/history/overviews` | Cached overview for a query. Params: `q` |

## Reader & summarizer

| Method | Path | Description |
|---|---|---|
| GET | `/api/read` | Extract readable content. Params: `url`, `media_url` |
| POST | `/api/summarize` | LLM summary of a URL. Body: `{ url }` |

## Workspaces

| Method | Path | Description |
|---|---|---|
| GET | `/api/workspaces` | List workspaces for the session |
| POST | `/api/workspaces` | Create (body: `{ name, description? }`) |
| GET | `/api/workspaces/{ws_id}` | Get one |
| PATCH | `/api/workspaces/{ws_id}` | Update name/description |
| DELETE | `/api/workspaces/{ws_id}` | Delete + cascade |

### Workspace items

| Method | Path | Description |
|---|---|---|
| GET | `/api/workspaces/{ws_id}/items` | List items |
| POST | `/api/workspaces/{ws_id}/items` | Add one item |
| POST | `/api/workspaces/{ws_id}/items/bulk` | Bulk add; body: `{ items: [{url,title,snippet,source,media_url?}] }` → `{ created, duplicates, rejected }` |
| PATCH | `/api/workspaces/items/{item_id}` | Update title/snippet/notes/order_index |
| DELETE | `/api/workspaces/items/{item_id}` | Delete item |
| POST | `/api/workspaces/items/{item_id}/summarize` | Generate + persist item summary |

### Workspace chat

| Method | Path | Description |
|---|---|---|
| POST | `/api/workspaces/{ws_id}/chat` | Ask a question about the workspace (body: `{ question }`) |
| GET | `/api/workspaces/{ws_id}/chat/history` | Chat history with sources |

## Station (per workspace)

Prefix: `/api/workspaces/{ws_id}/station`

| Entity | List | Create | Update | Delete |
|---|---|---|---|---|
| reads | GET `/reads` | POST `/reads` | PATCH `/reads/{id}` | DELETE `/reads/{id}` |
| highlights | GET `/highlights` | POST `/highlights` | — | DELETE `/highlights/{id}` |
| notes | GET `/notes` | POST `/notes` | PATCH `/notes/{id}` | DELETE `/notes/{id}` |
| pins | GET `/pins` | POST `/pins` | PUT `/pins/reorder` | DELETE `/pins/{id}` |
| images | GET `/images` | POST `/images` | — | DELETE `/images/{id}` |
| videos | GET `/videos` | POST `/videos` | PATCH `/videos/{id}` | DELETE `/videos/{id}` |
| comparisons | GET `/comparisons` | POST `/comparisons` | PATCH `/comparisons/{id}` | DELETE `/comparisons/{id}` |
| tags | GET `/tags` | POST `/tags` | — | DELETE `/tags/{id}` |

Additional station routes:

| Method | Path | Description |
|---|---|---|
| GET | `/station/timeline?limit=` | Activity timeline (default 200, max 1000) |
| POST | `/station/tags/{tag_id}/assign` | Tag an object (body: `{ object_type, object_id }`) |
| POST | `/station/tags/{tag_id}/unassign` | Untag an object |
| GET | `/station/tags/{tag_id}/objects` | List tagged objects |
| GET | `/station/stats` | Entity counts for the workspace |
| GET | `/station/search?q=` | Search items + notes (substring match) |
| GET | `/station/load-all` | Bulk hydration of all station data |

## Canvas (per workspace)

Prefix: `/api/workspaces/{ws_id}/canvas`

| Entity | List | Create | Update | Delete |
|---|---|---|---|---|
| nodes | GET `/nodes` | POST `/nodes` | PATCH `/nodes/{id}` | DELETE `/nodes/{id}` |
| connections | GET `/connections` | POST `/connections` | — | DELETE `/connections/{id}` |

Nodes are polymorphic over station objects (`object_type` + `object_id`), positioned by `x`, `y`,
`width`, `height`, with `z_index`, `pinned`, `label`, and `color`.

## AI responses & tasks (per workspace)

Prefix: `/api/workspaces/{ws_id}`

| Entity | List | Create | Update | Delete |
|---|---|---|---|---|
| ai/responses | GET `/ai/responses` | POST `/ai/responses` | PATCH `/ai/responses/{id}` | DELETE `/ai/responses/{id}` |
| tasks | GET `/tasks` | POST `/tasks` | PATCH `/tasks/{id}` | DELETE `/tasks/{id}` |

## Profiles & history

| Method | Path | Description |
|---|---|---|
| GET | `/api/profile` | Get (or create) the session profile |
| PUT | `/api/profile` | Update username/theme/search_provider |
| GET | `/api/profiles` | List all profiles |
| POST | `/api/profiles` | Create a new profile → returns new `session_id` |
| POST | `/api/profiles/delete` | Delete a profile (body: `{ session_id }`) |
| GET | `/api/history/search` | Search history |
| GET | `/api/history/reads` | Reading list |
| GET | `/api/history/summaries` | Summary list |
| GET | `/api/history/activity` | Activity log |

## Related documentation

- [Server](server.md) — implementation notes
- [Database](database.md) — models behind the endpoints
- [Client](client.md) — how the frontend consumes the API
