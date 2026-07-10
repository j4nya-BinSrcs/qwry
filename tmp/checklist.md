# QWRY Development Checklist

## Phase 0 — Project Foundation

* [x] Repository structure
* [x] Python FastAPI server
* [x] React client
* [x] Rust engine project
* [x] Docker infrastructure
* [x] SearXNG integration
* [x] CLI prototype
* [ ] CI/CD pipeline
* [ ] Pre-commit hooks
* [x] Logging system
* [x] Configuration management
* [ ] Environment validation

---

# Phase 1 — Search Core (MVP)

## Search API

* [x] Search endpoint (`GET /api/search`)
* [x] SearXNG client (`server/src/services/searxng.py`)
* [x] Result normalization (shared `SearchResultItem` schema)
* [x] Query validation (Pydantic / min_length on `q` param)
* [x] Error handling (HTTP 404/502, try/except in all services)
* [x] Search timeout handling (configurable per-provider)
* [x] Retry mechanism (3 attempts, exponential backoff in SearxngClient + EngineClient)

## Search Experience

* [ ] Homepage
* [ ] Search page (search happens via Sources panel — no dedicated search page)
* [x] Search suggestions (debounced dropdown in TopBar via `/api/suggest`)
* [ ] Recent searches
* [ ] Search history
* [ ] Instant search
* [ ] Query correction
* [x] Empty state (shown when no query / no results)
* [ ] No-result suggestions

## Result Cards

* [x] Website card (`DraggableResultCard` in SourcesPanel)
* [x] Domain favicon (Google favicons API)
* [ ] Reading time
* [x] Metadata (hostname, source badge, category badge, relevance)
* [x] Open externally
* [ ] Copy URL
* [ ] Quick preview
* [x] Trust indicator (source badge "engine" / "searxng")
* [x] Save to workspace (Plus button + drag-and-drop)

---

# Phase 2 — Workspace Foundation

## Workspace

* [x] Create workspace
* [x] Rename workspace (inline edit in WorkspaceHeader)
* [x] Delete workspace
* [ ] Archive workspace
* [ ] Workspace settings
* [ ] Workspace colors
* [ ] Workspace icons

## Workspace Items

* [x] Add webpage (button + drag-and-drop)
* [x] Remove webpage
* [x] Reorder items (drag-to-reorder via SortableContext)
* [ ] Multi-select
* [ ] Duplicate detection
* [ ] Favorite items
* [ ] Search inside workspace

## Organization

* [ ] Tags
* [ ] Collections
* [ ] Groups
* [ ] Filters
* [ ] Sort by date
* [ ] Sort by relevance
* [ ] Sort by source

---

# Phase 3 — Reader

## Reader View

* [x] Reader mode (ReaderService + /api/read + ReaderModal overlay)
* [x] Clean article extraction (extract_text with HTMLParser)
* [ ] Reading progress
* [ ] Highlight text
* [ ] Notes
* [ ] Bookmark position
* [x] Estimated reading time (~200 wpm calculation)
* [x] Source metadata (hostname, char count, reading time)

---

# Phase 4 — AI Features

## Summarizer

* [x] Summarize webpage (`POST /api/summarize` + `POST .../items/{id}/summarize`)
* [x] Auto-retry on failure (3 retries with exponential backoff)
* [ ] Summarize PDF
* [ ] Summarize multiple sources
* [ ] Bullet summary (LLM prompt requests structured output, rendered as plain text)
* [ ] Detailed summary
* [ ] Timeline generation

## Comparison

* [ ] Compare webpages
* [ ] Compare products
* [ ] Compare specifications
* [ ] Similarities
* [ ] Differences
* [ ] Source citations

## Workspace AI

* [ ] Chat with workspace
* [ ] Ask questions about saved items
* [ ] Source-grounded responses
* [ ] Suggested follow-up searches
* [ ] Detect conflicting information

---

# Phase 5 — Canvas

## Canvas

* [ ] Infinite canvas
* [ ] Drag cards
* [ ] Resize cards
* [ ] Zoom
* [ ] Pan
* [ ] Snap to grid
* [ ] Mini-map

## Connections

* [ ] Connect items
* [ ] Relationship labels
* [ ] Color-coded links
* [ ] Auto-layout
* [ ] Group nodes

---

# Phase 6 — Search Modes

## Modes

* [ ] Explore
* [ ] Research
* [ ] Discussions
* [ ] Additional modes
* [ ] Mode-specific ranking
* [ ] Mode-specific source selection

---

# Phase 7 — Media Panel

## Images

* [x] Image grid (Discovery panel, MediaCard components)
* [x] Image preview (via thumbnail in Sources/Discovery)
* [x] Save image (Plus button → active workspace)

## Videos

* [x] Video preview (Discovery panel, MediaCard with thumbnail)
* [x] Video metadata (engine badge, title)
* [x] Save video (Plus button → active workspace)

## Other Widgets

* [ ] News
* [ ] Shopping
* [ ] Reddit
* [ ] GitHub
* [ ] Research papers
* [ ] Books
* [ ] Podcasts

---

# Phase 8 — Rust Search Engine

## Crawler

* [x] URL queue
* [x] Robots.txt
* [x] Rate limiting
* [x] Concurrent crawling
* [x] HTML extraction
* [x] Duplicate detection

## Indexer

* [x] Tantivy schema
* [x] BM25 ranking
* [x] Incremental indexing
* [x] Re-indexing
* [x] Metadata extraction

## Search

* [x] Local search API (Axum server at port 8001)
* [x] Snippet generation
* [x] Highlighting
* [x] Ranking pipeline

---

# Phase 9 — Hybrid Search

* [x] Merge local + SearXNG results (hybrid provider)
* [x] Duplicate merging (URL dedup in search_orch.py)
* [ ] Domain scoring
* [ ] Freshness scoring
* [ ] Personal ranking
* [ ] Hybrid ranking algorithm

---

# Phase 10 — Browser Extension

* [ ] Save page
* [ ] Save selection
* [ ] Quick summary
* [ ] Send to workspace
* [ ] Open in QWRY

---

# Phase 11 — Local Profiles

* [ ] User profile
* [x] Multiple workspaces (per session)
* [ ] Preferences
* [ ] Theme
* [ ] Local storage
* [ ] Import/Export profile

---

# Phase 12 — Personalization

* [ ] Search preferences
* [ ] Favorite domains
* [ ] Block domains
* [ ] Custom ranking
* [ ] Default search mode

---

# Phase 13 — Performance

* [x] Valkey cache (CacheService + search cache + AI/summary cache)
* [x] Search caching
* [x] AI caching
* [ ] Database optimization
* [ ] Async optimization
* [ ] Lazy loading
* [ ] Virtual scrolling

---

# Phase 14 — Security

* [x] Input validation (Pydantic schemas)
* [ ] API rate limiting
* [x] CORS (CORSMiddleware with configurable origins)
* [ ] CSP (Content-Security-Policy header)
* [ ] Secure headers (X-Content-Type-Options, X-Frame-Options, etc.)
* [x] SQL injection protection (SQLAlchemy ORM with parameterized queries)

---

# Phase 15 — Polish

* [ ] Keyboard shortcuts
* [ ] Command palette
* [ ] Context menus
* [ ] Toast notifications
* [x] Animations (CSS transitions, spinner)
* [ ] Loading skeletons
* [ ] Error pages
* [ ] Accessibility
* [x] Responsive layout (resizable panels)
* [ ] Light theme
* [x] Dark theme

---

# Phase 16 — Documentation

* [ ] Project Charter
* [ ] SRS
* [ ] Architecture Document
* [ ] Database Design
* [ ] API Documentation
* [ ] Build Guide
* [ ] Developer Guide
* [ ] User Guide
* [ ] Deployment Guide
