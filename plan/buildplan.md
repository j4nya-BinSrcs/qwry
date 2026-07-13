# Qwry Engine — Build Plan

13 phases, ~45 incremental steps from an empty folder to a hybrid search engine
with inverted-index sharding, vector embeddings, and BM25+vector fusion.

---

## Phase 0 — Scaffolding & Data Layer

### 0.1 Scaffold workspace with shared, crawler, indexer crates

**Implementation:**
- Create `engine/Cargo.toml` with `[workspace]`, members `["shared", "crawler", "indexer"]`, `resolver = "2"`
- Run `cargo new shared --lib`, `cargo new crawler`, `cargo new indexer` inside `engine/`
- Remove any auto-generated root `src/` from `cargo init` if present
- Verify with `cargo build` in `engine/`

**Testable result:** `cargo build` succeeds with three empty crates.

### 0.2 Implement SQLite database layer

**Implementation:**
- In `shared/Cargo.toml`: add `rusqlite = { version = "0.31", features = ["bundled"] }`, `r2d2 = "0.8"`, `r2d2_sqlite = "0.24"`, `chrono = { version = "0.4", features = ["serde"] }`, `serde = { version = "1", features = ["derive"] }`, `anyhow = "1"`
- In `shared/src/lib.rs`:
  - Define `CrawledPage` struct (`id: Option<i64>`, `url: String`, `title: Option<String>`, `description: Option<String>`, `content: String`, `crawled_at: NaiveDateTime`, `indexed: bool`) with `Serialize, Deserialize`
  - Define `pub type DbPool = Pool<SqliteConnectionManager>`
  - Implement `get_db_path()` — parse `DATABASE_URL` env var (`sqlite:///...` style), handle relative/absolute paths
  - Implement `init_db() -> Result<DbPool>` — create pool (max_size=50, connection_timeout=10s), set pragmas (`WAL`, `synchronous=NORMAL`, `temp_store=MEMORY`, `busy_timeout=5000`), create `crawled_pages` table with all columns + indexes on `url` and `indexed`
  - Implement `save_page(pool, page) -> Result<()>` — upsert via `ON CONFLICT(url) DO UPDATE`
  - Implement `is_url_crawled(pool, url) -> Result<bool>`
  - Implement `are_urls_crawled(pool, urls) -> Result<HashSet<String>>` — single query with `WHERE url IN (?1,?2,...)`, dynamic placeholders
  - Implement `get_page_count(pool) -> Result<i64>` and `get_indexed_page_count(pool) -> Result<i64>`

**Testable result:** Write a small test binary or integration that calls `init_db()`, saves a page, checks it exists, verifies upsert updates content.

---

## Phase 1 — Crawler Core

### 1.1 Implement crawl config, job queue, and data structures

**Implementation:**
- In `crawler/Cargo.toml`: add `tokio = { version = "1.35", features = ["full"] }`, `clap = { version = "4.4", features = ["derive"] }`, `tracing = "0.1"`, `tracing-subscriber = "0.3"`, `shared = { path = "../shared" }`, `anyhow = "1"`, `chrono = { version = "0.4", features = ["serde"] }`, `dotenvy = "0.15"`, `url = "2.5"`, `reqwest = { version = "0.11", features = ["rustls-tls", "cookies", "gzip"] }`, `scraper = "0.18"`, `ego-tree = "0.6"`, `futures = "0.3"`
- In `crawler/src/crawler.rs`:
  - Define `CrawlerConfig` with all 10 fields (max_depth, max_pages, concurrency, politeness_delay, user_agent, external_domains, max_retries, retry_base_delay, skip_politeness, batch_db_check_size)
  - Define `CrawlJob { url: String, depth: usize, retry_count: u32 }`
  - Define `CrawlResult { url, title: Option<String>, description: Option<String>, content: String, outgoing_links: Vec<String> }`
  - Define `RobotsRules { disallows: Vec<String>, crawl_delay: Option<Duration> }`
  - Implement `ShardedSet` (even though we start with `Mutex<HashSet>`, structure the ShardedSet now for later swap):
    - `new(num_shards)` — round up to power of 2, create Vec of `Mutex<HashSet<String>>`
    - `shard_idx(key)` — `DefaultHasher::new().hash(key) & mask`
    - `contains(key) -> bool` — lock shard, check contains
    - `insert(key: String) -> bool` — lock shard, insert, return whether newly inserted
  - Implement `JobQueue`:
    - Fields: `inner: Mutex<VecDeque<CrawlJob>>`, `sema: tokio::sync::Semaphore`
    - `new()` — semaphore with 0 permits
    - `push(job)` — lock deque, push_back, `sema.add_permits(1)`
    - `push_batch(jobs)` — lock once, extend, `sema.add_permits(n)`
    - `pop_or_wait() -> Option<CrawlJob>` — loop: `timeout(1s, sema.acquire())`, if Ok → forget permit, pop from deque; if Err (timeout) → return None
    - `len()` — lock deque, return length

**Key design decision:** Use `std::sync::Mutex` for the deque (sub-microsecond critical sections, no `.await` inside) rather than `tokio::sync::Mutex`. Use `tokio::sync::Semaphore` for parking/unparking workers — `Notify` can lose wakeups when no waiter is registered.

- In `crawler/src/main.rs`:
  - Define `Args` struct with clap `Parser` derive — all CLI flags with defaults
  - `#[tokio::main]` async main: `dotenv()`, parse args, set up tracing subscriber (default INFO), call `shared::init_db()`, build `CrawlerConfig`, create empty `Crawler::new(config, db_pool)`, handle errors

**Testable result:** `cargo run --package crawler -- --help` prints help. `cargo run` shows "Initializing Qwry database..." logs, creates `qwry.db`.

### 1.2 Implement HTTP fetch and HTML parsing

**Implementation:**
- In `crawler/src/crawler.rs`:
  - Define `OnceLock` static selectors: `sel_a_href()`, `sel_title()`, `sel_description()`, `sel_content_root()` (parses "main, article, body")
  - Define `SKIP_TAGS` const array: `["script", "style", "nav", "footer", "header", "noscript", "iframe", "svg", "form", "button", "aside"]`
  - Define `EXTENSION_BLOCKLIST`: 17 asset extensions (`.png`, `.jpg`, `.pdf`, `.css`, `.js`, etc.)
  - Implement `normalize_url(href, base_url) -> Result<String>` — join relative URLs, strip fragment, validate scheme is http/https
  - Implement `fetch_page(client, url_str, external_domains) -> Result<CrawlResult>`:
    - `client.get(url_str).send().await`
    - Check status via `resp.error_for_status()` — if error, create `anyhow!` error from it
    - Validate `Content-Type` contains `text/html` — if not, return `Err(anyhow!("Non-HTML content type: ..."))`
    - `resp.text().await` → body string
    - `Html::parse_document(&body)`
    - Call extraction functions
    - Return `CrawlResult`
  - Implement `extract_title(doc) -> Option<String>` — query `sel_title()`, join text, trim
  - Implement `extract_description(doc) -> Option<String>` — query `sel_description()`, read `content` attribute, trim
  - Implement `extract_clean_text(doc) -> String`:
    - Get root via `sel_content_root()` (fallback to `doc.root_element()`)
    - `walk_text(node, &mut buf)` — recursive: for element nodes, skip `SKIP_TAGS`, add `\n` for block elements, ` ` for inline, recurse children; for text nodes, append trimmed text
    - `collapse_whitespace()` — collapse all whitespace runs to single space, trim
  - Implement `extract_links(doc, base_url_str, allow_external) -> Vec<String>`:
    - Iterate `doc.select(sel_a_href())`, read `href` attr
    - `normalize_url(href, base_url)`
    - Parse normalized URL, filter external domains if `!allow_external`
    - Filter `EXTENSION_BLOCKLIST` by path
    - Collect, sort, dedup
  - Build `reqwest::Client` in `Crawler::new()`:
    - `default_headers(USER_AGENT)`, `timeout(10s)`, `connect_timeout(5s)`, `redirect(Policy::limited(5))`, `pool_max_idle_per_host(100)`, `pool_idle_timeout(90s)`, `tcp_keepalive(60s)`, `gzip(true)`

**Testable result:** `fetch_page()` returns correct `CrawlResult` for a test URL with known content. Text extraction yields clean output with no script/style noise.

### 1.3 Implement polite crawling (robots.txt, domain delays)

**Implementation:**
- Implement `fetch_robots_txt(client, host, user_agent) -> RobotsRules`:
  - GET `https://{host}/robots.txt`
  - If success, `resp.text()` → `parse_robots_txt()`
  - Otherwise return default empty rules
- Implement `parse_robots_txt(content, user_agent) -> RobotsRules`:
  - Split lines, trim, skip comments/empty
  - `splitn(2, ':')` → key/value
  - Match `user-agent` (case-insensitive, wildcard `*` match, substring match)
  - Match `disallow` when matched → add to disallows list
  - Match `crawl-delay` when matched → parse float seconds
- Implement `is_allowed_by_robots(rules, path) -> bool` — check path doesn't start with any disallow prefix (non-empty)
- In `Crawler`:
  - Add fields: `robots_cache: Arc<Mutex<HashMap<String, RobotsRules>>>`, `domain_last_request: Arc<Mutex<HashMap<String, Instant>>>`
  - Implement `prefetch_robots(domains: HashSet<String>)` — parallel fetch via `FuturesUnordered` for seed domains before workers start
- In `worker_loop()` — the politeness block (skipped when `skip_politeness` is true):
  - Check `robots_cache` for host (lock, clone, drop guard before any await)
  - If not cached, `fetch_robots_txt()` → cache it
  - Compute delay = `rules.crawl_delay.unwrap_or(config.politeness_delay)`
  - Check `domain_last_request` for host: get `Instant::now()`, if enough time passed, update and proceed; if not, spawn delayed re-push and `continue`
  - Check `is_allowed_by_robots(rules, path)` → if blocked, increment `robots_blocked` counter, `continue`

**Key design:** All `Mutex` locks are held for sub-microsecond lookups; the guard is dropped before any `.await` call. The delayed re-push uses `tokio::spawn(async move { sleep(wait); q.push(job); })` — never blocks the worker.

**Testable result:** Crawl `https://example.com` — robots.txt is fetched and cached, delay is applied, page is fetched only after delay.

### 1.4 Implement concurrent worker pool with full loop

**Implementation:**
- In `Crawler::run(seeds)`:
  - Create `BatchWriter` (stub — just wraps an mpsc sender for now)
  - Create `JobQueue`, `ShardedSet` (or `Mutex<HashSet>`), `AtomicUsize` for pages_crawled
  - Create `CrawlStats` (all atomic counters)
  - Create `AtomicBool` for shutdown
  - Push seed URLs as `CrawlJob { depth: 0, retry_count: 0 }`
  - `self.prefetch_robots(seed_domains).await`
  - Spawn N workers (`config.concurrency`), each as `tokio::spawn(worker_loop(...))`
  - Await all handles
  - Flush batch writer
  - Print JSON summary
- Implement `worker_loop()`:
  - Loop:
    1. Check `shutdown.load(SeqCst)` — break if true
    2. Check `pages_crawled >= max_pages` — set shutdown, break
    3. `queue.pop_or_wait().await` → if None (timeout), continue
    4. Re-check termination (a race may have filled quota while we waited)
    5. Check depth > max_depth → continue
    6. Parse URL, extract host
    7. Politeness block (from 1.3)
    8. Re-check termination before fetch
    9. `fetch_page(&client, &job.url, config.external_domains).await`
    10. On success:
        - Try to increment `pages_crawled` atomically (check against max_pages)
        - If over limit, push job back, set shutdown, break
        - Log progress: `"Worker {id}: Processed ({count}/{max}): {url}"`
        - Build `CrawledPage` from `CrawlResult`
        - Send to `BatchWriter` via mpsc channel
        - Enqueue new links: filter against visited set, push jobs
    11. On failure:
        - Log error
        - If retriable and retry_count < max_retries: spawn delayed re-push
        - Otherwise: log as permanent failure

**Link enqueue logic:**
```
let fresh: Vec<String> = result.outgoing_links
    .filter(|l| !visited.contains(l))
    .collect();

for url in fresh {
    if visited.insert(url.clone()) {          // TOCTOU race is benign
        queued.push(CrawlJob { url, depth: job.depth + 1, retry_count: 0 });
    }
}
```

**Testable result:** `cargo run --package crawler --release -- --max-pages 10` crawls 10 pages, prints progress, exits cleanly. Pages appear in `qwry.db`.

### 1.5 Add BatchWriter for batched SQLite writes

**Implementation:**
- Define `BatchWriter` struct:
  - `tx: mpsc::Sender<BatchMessage>`
- Define `BatchMessage` enum:
  - `Page(CrawledPage)`
  - `Shutdown(oneshot::Sender<Result<()>>)`
- Implement `BatchWriter::new(db: DbPool) -> (Self, JoinHandle)`:
  - Create `mpsc::channel(1024)`
  - Spawn task:
    - `batch: Vec<CrawledPage>` with capacity 100
    - `timer: tokio::time::interval(Duration::from_secs(5))` with `MissedTickBehavior::Delay`
    - `tokio::select!` loop:
      - `timer.tick()` → if batch non-empty, flush, clear
      - `msg = rx.recv()` → match on Page (push, flush if ≥100), Shutdown (flush, send response, break), None (flush, break)
- Implement `write_batch(pool, batch)`:
  - Get connection from pool
  - `BEGIN IMMEDIATE TRANSACTION`
  - For each page: `INSERT ... ON CONFLICT(url) DO UPDATE`
  - `COMMIT`
- Implement `flush_batch_async(pool, batch)` — wraps `write_batch` in `tokio::task::spawn_blocking`
- Implement `BatchWriter::send(page)` — `tx.send(BatchMessage::Page(page)).await`
- Implement `BatchWriter::shutdown(self)` — create oneshot, send Shutdown, await response

**Key decision:** All SQLite writes go through `spawn_blocking` because `rusqlite` is synchronous. Running it directly in a tokio task blocks the tokio worker thread, which with 200 workers and a full mpsc channel causes a complete freeze.

**Testable result:** After crawl completes, all crawled pages are in `qwry.db` with correct content. No "channel closed" errors.

---

## Phase 2 — Inverted Index (BM25 Full-Text Search)

### 2.1 Add Tantivy dependency and define schema

**Implementation:**
- In `indexer/Cargo.toml`: add `tantivy = "0.22"`, `serde = { version = "1", features = ["derive"] }`, `serde_json = "1"`, `axum = "0.7"`, `tower-http = { version = "0.5", features = ["cors", "trace"] }`, `tokio = { version = "1.35", features = ["full"] }`, `clap = { version = "4.4", features = ["derive"] }`, `shared = { path = "../shared" }`, `anyhow = "1"`, `rusqlite = { version = "0.31", features = ["bundled"] }`, `chrono = { version = "0.4", features = ["serde"] }`
- In `indexer/src/index.rs`:
  - Define `SearchIndex` struct with fields: `index: Index`, `reader: IndexReader`, `url_field`, `title_field`, `desc_field`, `content_field`
  - Implement `open_or_create(index_dir: P)`:
    - `create_dir_all(index_dir)`
    - Build schema:
      - `url`: `STRING | STORED`
      - `title`: `TEXT, en_stem, WithFreqsAndPositions, STORED`
      - `description`: `TEXT, en_stem, WithFreqsAndPositions, STORED`
      - `content`: `TEXT, en_stem, WithFreqsAndPositions, STORED`
    - Open `MmapDirectory`
    - `Index::open_or_create(dir, schema)`
    - Create reader: `reader_builder().reload_policy(OnCommitWithDelay).try_into()`
    - Return `SearchIndex`

**Testable result:** `cargo run --package indexer -- --index-dir ./data/test-index serve` starts without crashing, creates index directory.

### 2.2 Implement index pipeline — SQLite to Tantivy

**Implementation:**
- In `indexer/src/index.rs`, implement `SearchIndex::index_new_pages(db_pool) -> Result<usize>`:
  - Get connection, prepare: `SELECT id, url, title, description, content FROM crawled_pages WHERE indexed = 0`
  - Collect all unindexed pages into Vec
  - If empty, return Ok(0)
  - Create `IndexWriter` with 100MB buffer
  - For each page:
    - `delete_term(Term::from_field_text(url_field, &page.url))` — upsert semantics
    - Build Tantivy document with all fields (title/description optional)
    - `writer.add_document(doc)`
  - `writer.commit()`
  - In a single transaction: `UPDATE crawled_pages SET indexed = 1 WHERE id = ?` for each page
  - Return count
- Implement `reindex_all_pages(db_pool) -> Result<usize>`:
  - `UPDATE crawled_pages SET indexed = 0`
  - `writer.delete_all_documents()`, commit
  - Delegate to `index_new_pages()`

**Testable result:** Crawl some pages, then run `cargo run --package indexer -- index` — unindexed pages are indexed. Run again — "No new pages to index."

### 2.3 Implement BM25 search with field boosts and snippets

**Implementation:**
- In `indexer/src/search.rs`:
  - Define `SearchHit { url, title: Option<String>, description: Option<String>, snippet: String, score: f32 }` with `Serialize, Deserialize`
  - Define `SearchResponse { total_hits: usize, hits: Vec<SearchHit>, query, limit, offset }` with `Serialize, Deserialize`
  - On `SearchIndex`, implement `search(query_str, limit, offset) -> Result<SearchResponse>`:
    - Get `searcher = self.reader.searcher()`
    - Create `QueryParser::for_index(&self.index, vec![title, desc, content])`
    - Set field boosts: title×2.5, desc×1.5, content×1.0
    - `query_parser.parse_query(query_str)`
    - Collector: `(TopDocs::with_limit(limit + offset), Count)` — tuple collector for ranked docs + total count
    - `searcher.search(&query, &collector)`
    - Slice paginated docs from `top_docs[offset..offset+limit]`
    - Create `SnippetGenerator::create(&searcher, &query, content_field)`
    - For each result: look up stored fields, generate snippet HTML
    - Return `SearchResponse`

**Key decision:** Use the `(TopDocs, Count)` tuple collector so `total_hits` reflects the true matching document count, not just the returned page size.

**Testable result:** `cargo run --package indexer -- search "rust" --limit 5` returns ranked results with titles, snippets, and scores.

### 2.4 Implement Axum REST API server

**Implementation:**
- In `indexer/src/api.rs`:
  - Define `ApiState { index: SearchIndex, db_pool: DbPool }` with `Clone`
  - Define `SearchQueryParams { q, limit(10), offset(0) }` with `Deserialize`
  - Define response types: `ErrorResponse`, `IndexResponse`, `StatusResponse`
  - `handle_search(state, Query(params))`:
    - Validate `q` is non-empty → 400 if empty
    - Call `state.index.search()` → 200 with JSON or 500 with error
  - `handle_trigger_index(state)`:
    - `spawn_blocking(move || state.index.index_new_pages(&state.db_pool))` — Tantivy writes are CPU-bound/synchronous
    - Return `IndexResponse` or 500
  - `handle_status(state)`:
    - `spawn_blocking` for `get_page_count` + `get_indexed_page_count`
    - `reader.searcher().num_docs()` for Tantivy doc count
    - Return `StatusResponse`
  - `start_server(port, state)`:
    - `CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any)`
    - `Router::new().route("/search", get(...)).route("/index", post(...)).route("/status", get(...)).layer(cors).with_state(Arc::new(state))`
    - Bind, `axum::serve(listener, app).await`

- In `indexer/src/main.rs`:
  - Define `Cli` struct with subcommands: `Index`, `Reindex`, `Search { query, limit }`, `Serve { port }`
  - `#[tokio::main]`: init DB, open index, match subcommand
  - Index/Reindex/Search → run once and exit
  - Serve → start Axum server

**Testable result:** `cargo run --package indexer -- serve --port 8001 &` → `curl 'http://localhost:8001/search?q=rust'` returns JSON results. `curl -X POST http://localhost:8001/index` triggers indexing.

### 2.5 Test index+search round-trip

**Implementation:**
- Create a simple integration test script or Rust test:
  - Insert test pages into SQLite
  - Run indexing
  - Verify search returns correct hits with expected field boosts
  - Verify `total_hits` is accurate (higher than `hits.len()`)
  - Verify snippet highlights query terms
  - Verify reindex wipes and rebuilds

**Testable result:** All assertions pass.

---

## Phase 3 — Crawler Optimization & Instrumentation

### 3.1 Replace Mutex<HashSet> with ShardedSet

**Implementation:**
- The `ShardedSet` from 1.1 is already structured for this swap. Replace the `Mutex<HashSet<String>>` visited field in `worker_loop` with `Arc<ShardedSet>` with 64 shards.
- Shard 0–63, selected by `DefaultHasher::hash(key) & 63` (mask = next_power_of_two - 1 = 63)
- Each shard holds a `Mutex<HashSet<String>>`
- `contains()` and `insert()` each lock exactly one shard for microseconds
- No more single-mutex contention when 200 workers check/insert visited URLs

**Testable result:** Benchmark at 200 concurrency shows no `Mutex` contention in flamegraph. Throughput unchanged on external domains but improves on internal/localhost test.

### 3.2 Move SQLite writes to spawn_blocking

**Implementation:**
- This was already done in 1.5 (`flush_batch_async` uses `spawn_blocking`). Verify:
  - `write_batch()` is only called from inside `spawn_blocking`
  - No `conn` operations happen inside `tokio::spawn` tasks
  - The mpsc channel sender/receiver is pure async, the blocking write is moved to a dedicated blocking thread

**The bug this fixes:** When `write_batch()` runs inside `tokio::spawn`, it blocks the tokio worker thread. With 200 workers filling the 1024-capacity mpsc channel, the writer can't drain (its thread is blocked), workers block on `writer.send().await`, and the entire crawl freezes. `spawn_blocking` dedicates a thread-pool thread for the blocking SQLite I/O.

**Testable result:** Crawl with `--concurrency 200 --max-pages 1000` completes without freezing. All pages are persisted.

### 3.3 Add CrawlStats with performance instrumentation

**Implementation:**
- Define `CrawlStats` struct (already in structure from 1.1):
  - `pages_crawled: AtomicUsize`, `urls_discovered: AtomicUsize`, `total_retries: AtomicUsize`
  - `errors_timeout`, `errors_connect`, `errors_http`, `errors_other`, `robots_blocked: AtomicUsize`
  - `inflight: AtomicUsize` — current concurrent HTTP requests
  - `peak_inflight: AtomicUsize` — peak observed concurrency
  - `fetch_count: AtomicUsize` — total fetch attempts
  - `fetch_latency_ns: AtomicU64` — sum of fetch latencies
- Instrument the worker loop:
  - Before fetch: `stats.inflight.fetch_add(1)`
  - After fetch: `stats.inflight.fetch_sub(1)`
  - Track peak: load cur, loop compare-exchange to update peak if `cur > peak`
  - Before fetch: start timer; after fetch: record elapsed into `fetch_latency_ns`
  - Increment `fetch_count` on every fetch attempt
- On crawl completion, print `info!` summary with req/s, avg latency, peak inflight
- Print JSON summary line as last stdout: `{"event":"crawl_complete","pages_crawled":N,...}`

**Testable result:** Final log line shows performance metrics. JSON line is parseable and valid.

### 3.4 Add per-error-type retry with FetchHttpError

**Implementation:**
- Define `FetchHttpError { status: StatusCode, retry_after: Option<Duration> }` with `Display + Error`
- In `fetch_page()`: when status is not success:
  - For 429: extract `Retry-After` header, parse as seconds or HTTP-date
  - Return `Err(anyhow!(FetchHttpError { status, retry_after }))`
  - (Non-HTML content-type already returns plain `anyhow!` — will be classified as Permanent)
- Define `RetryClass` enum: `Timeout`, `Connect`, `RateLimited`, `ServerError`, `Permanent`
- Constants: `MAX_RETRIES_TIMEOUT=2`, `MAX_RETRIES_CONNECT=2`, `MAX_RETRIES_RATE_LIMITED=2`, `MAX_RETRIES_SERVER_ERROR=3`
- `classify_error(err) -> RetryClass`:
  - Try `downcast_ref<FetchHttpError>` → 429 → RateLimited, server_error → ServerError, other 4xx → Permanent
  - Try `downcast_ref<reqwest::Error>` → `is_timeout()` → Timeout, `is_connect()` → Connect
  - Everything else → Permanent
- `max_retries_for(class, config_max) -> u32`: match on class, take `min(per_type_max, config_max)`
- `retry_after_from_error(err) -> Option<Duration>`: downcast `FetchHttpError`, return its `retry_after`
- In worker loop error handler:
  - `classify_error(&e)`, increment appropriate error counter
  - `allowed = max_retries_for(class, config.max_retries)`
  - If `job.retry_count < allowed`: compute delay (Retry-After for 429 capped at 30s, exponential backoff `base * 2^retry_count` for others), spawn delayed re-push
  - If Permanent: `warn!("Non-retriable error: ...")`
  - If exhausted: `warn!("Max retries ({}) for {}: {}", allowed, job.url, e)`

**Testable result:** A 429 response from a real server is retried with the Retry-After delay, counted as `errors_http`. A connection timeout is retried with exponential backoff, counted as `errors_timeout`.

### 3.5 Use fetch_update for precise max_pages

**Implementation:**
- Replace:
  ```rust
  let prev = pages_crawled.fetch_add(1, Ordering::SeqCst);
  if prev >= config.max_pages {
      pages_crawled.fetch_sub(1, Ordering::SeqCst);
      queue.push(job);
      shutdown.store(true, Ordering::SeqCst);
      break;
  }
  ```
- With:
  ```rust
  let claimed = pages_crawled.fetch_update(Ordering::SeqCst, Ordering::SeqCst, |v| {
      (v < config.max_pages).then_some(v + 1)
  });
  let count = match claimed {
      Ok(prev) => prev + 1,  // successfully claimed slot
      Err(_) => {
          queue.push(job);
          shutdown.store(true, Ordering::SeqCst);
          break;
      }
  };
  ```

**Why:** The `fetch_add` + `fetch_sub` undo has a race: multiple workers can pass `prev >= max_pages` check before any sets `shutdown`, then each does `fetch_sub` to undo. This allows up to `concurrency` extra pages. `fetch_update` atomically CAS-es — only increments if the closure succeeds (current value < max), eliminating the race.

**Testable result:** `--max-pages 10` with `--concurrency 200` never exceeds 10 pages crawled. Previously could reach 10+200 = 210.

### 3.6 Remove DB batch dedup from link enqueue

**Implementation:**
- Remove the `are_urls_crawled` `spawn_blocking` call from the link enqueue block
- Remove the `batch_db_check_size` config field usage (field stays for backwards compat but becomes dead code)
- Remove the `db: DbPool` parameter from the enqueue section (rename to `_db` in worker_loop signature if still needed elsewhere)
- Remove unused `use shared::are_urls_crawled` import
- Now dedup is only: filter against `visited.contains()`, then `visited.insert()` — if unique within this run, enqueue
- SQLite's `ON CONFLICT(url) DO UPDATE` in `write_batch` still prevents duplicate rows — re-crawling a previously-crawled URL updates its content

**Why this fixes the stall:** On a re-crawl, every outgoing link from the seed URL is already in the DB. The `are_urls_crawled` batch check returns `true` for all of them → zero jobs enqueued → queue empty → all workers wait on semaphore → freeze at 1 page processed. Removing the DB check means previously-crawled pages get re-fetched and updated.

**Testable result:** Re-crawl with the same seed completes normally. Previously-crawled pages are re-fetched and their content/date is updated in SQLite.

### 3.7 Demote intermediate retry warnings to debug

**Implementation:**
- Change `warn!("{}: Attempt {}/{} for {} failed: {}. Retry in {:?}.", ...)` to `debug!(...)` in the worker loop's error handler
- Keep `warn!` only for terminal conditions: "Max retries" and "Non-retriable error"
- This prevents log flooding when many servers return 429 on a high-concurrency crawl

**Testable result:** Running with default log level (INFO) shows no per-attempt retry logs. Running with `RUST_LOG=debug` shows them. Terminal failures still appear at WARN.

### 3.8 Add graceful SIGINT handler and --quiet mode

**Implementation:**
- In `Crawler::run()`:
  ```rust
  let sd = shutdown.clone();
  tokio::spawn(async move {
      tokio::signal::ctrl_c().await.expect("SIGINT handler");
      info!("Received SIGINT, initiating graceful shutdown...");
      sd.store(true, Ordering::SeqCst);
  });
  ```
- Workers check `shutdown` at top of loop and break within 1s (the `pop_or_wait` timeout)
- Batch writer's periodic flush timer handles remaining pages
- On Ctrl+C, stats are printed normally
- Add `--quiet` / `-q` CLI flag → sets log level to ERROR

**Testable result:** Pressing Ctrl+C during a crawl causes graceful shutdown within ~1s, stats are printed, no pages are lost.

---

## Phase 4 — Inverted Index Sharding

### 4.1 Implement index sharding — N independent Tantivy indices

**Implementation:**
- Define `struct ShardedIndex { shards: Vec<SearchIndex> }` in `indexer/src/index.rs`
- `ShardedIndex::new(index_dir: P, num_shards: usize)`:
  - For each shard `i`: create subdirectory `{index_dir}/shard-{i}` and call `SearchIndex::open_or_create()` on it
  - Store all shards in a Vec
- `ShardedIndex::index_new_pages(db_pool)`:
  - Query unindexed pages from SQLite
  - Assign each page to a shard: `shard_id = hash(url) % num_shards`
  - Create N `IndexWriter` instances (one per shard)
  - For each page, write to the correct shard's writer
  - Commit all writers
  - Mark pages as indexed in DB (single transaction)
- `ShardedIndex::reindex_all_pages(db_pool)`:
  - Reset all pages to `indexed = 0`
  - Delete all documents in all shards
  - Run index_new_pages

**Why shard:** Tantivy's `Index` stores a single inverted index in one directory. For very large collections (>10M docs), a single index becomes unwieldy. Sharding by URL hash enables parallel searching and indexing across CPU cores.

**Testable result:** Pages are evenly distributed across shard directories. A page is found in exactly one shard by URL hash.

### 4.2 Implement shard-aware search — fan-out and merge

**Implementation:**
- `ShardedIndex::search(query_str, limit, offset) -> Result<SearchResponse>`:
  - Get a searcher from each shard's reader
  - Parse the query once (cheap)
  - Fan out search to all shards: for each shard, collect `(TopDocs::with_limit(limit + offset), Count)` — but with `limit + offset` per shard (not global)
  - Wait: since all searchers are `Send` but `search()` is synchronous, use `rayon::par_iter()` or `std::thread::scope` for parallel fan-out
  - Merge: collect all (score, doc, shard_id) tuples, sort by score descending, take top `limit + offset` globally
  - Sum `total_hits` across shards
  - Slice for pagination from merged results
  - Look up stored fields from the correct shard for each result
  - Generate snippets for each result
- For efficiency, use `tokio::task::spawn_blocking` per shard or a thread pool

**Key algorithm:** Per-shard top-K with `K = global_limit + global_offset`. Merging requires sorting at most `num_shards * K` items — negligible cost.

**Testable result:** Search across 4 shards returns the same top results as a single-shard search (rank equivalence). Total hit count matches.

### 4.3 Add per-shard parallel search

**Implementation:**
- Create a dedicated thread pool via `rayon` or manual `std::thread::scope` + channels
- For each shard, send a search task to the pool
- Collect results via a channel or join handles
- Merge and return
- The `SearchIndex` (single shard) already uses blocking search; sharded just parallelizes the blocking calls

**Testable result:** Search latency is reduced proportional to `min(num_shards, num_cpus)`. Latency with 4 shards on a 4-core machine is ~1/4 of single-shard latency for the same index size.

### 4.4 Test shard consistency

**Implementation:**
- Write tests to verify:
  - Total docs across all shards = expected count
  - A given URL always goes to the same shard (deterministic hash)
  - Reindex correctly wipes all shards
  - Search results are consistent regardless of shard count (4-shard results = 8-shard results)
  - Pagination works correctly across shard boundaries

**Testable result:** All assertions pass.

---

## Phase 5 — Vector Embedding Pipeline

### 5.1 Add fastembed dependency

**Implementation:**
- Add to `indexer/Cargo.toml`: `fastembed = "5"` (supports BGE-small, all-MiniLM-L6-v2, etc.)
- Test initialization in a small binary:
  ```rust
  use fastembed::{FlagEmbedding, InitOptions, EmbeddingModel};
  let model = FlagEmbedding::new(InitOptions {
      model_name: EmbeddingModel::BGESmallENV15,
      show_download_progress: true,
      ..Default::default()
  })?;
  let embeddings = model.embed(vec!["test text"], 1)?;
  // embeddings[0] is Vec<f32> of length 384
  ```
- The model downloads ONNX weights on first run (~30MB for BGE-small)
- Cache in `~/.cache/fastembed/`

**Key decision:** Use BGE-small-en-v1.5 (384-dim, ~30MB). Good balance of quality vs. size. All-MiniLM-L6-v2 is also fine (384-dim, ~23MB). Both run entirely locally via ONNX runtime — no API calls, no data leaves the machine.

**Testable result:** Model loads, `embed(["hello world"])` returns a 384-dimensional `Vec<f32>`.

### 5.2 Add embeddings table to SQLite schema

**Implementation:**
- In `shared/src/lib.rs`, add to `init_db()`:
  ```sql
  CREATE TABLE IF NOT EXISTS page_embeddings (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id  INTEGER NOT NULL REFERENCES crawled_pages(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      model    TEXT NOT NULL DEFAULT 'BGE-small-en-v1.5',
      dimension INTEGER NOT NULL DEFAULT 384,
      embedding BLOB NOT NULL,
      UNIQUE(page_id, chunk_index)
  );
  CREATE INDEX IF NOT EXISTS idx_page_embeddings_page_id ON page_embeddings(page_id);
  ```
- Define `PageEmbedding` struct: `page_id: i64`, `chunk_index: u32`, `model: String`, `embedding: Vec<f32>`
- Implement `save_embedding(pool, page_embedding)` and `get_embeddings_for_page(pool, page_id) -> Vec<Vec<f32>>`
- Implement `get_all_embeddings(pool) -> Vec<(i64, Vec<f32>)>` for brute-force search

**Testable result:** Embedding can be written as BLOB (serialized f32 bytes) and deserialized correctly.

### 5.3 Implement embedding generator

**Implementation:**
- In `indexer/src/embed.rs`:
  - Define `EmbeddingGenerator` struct:
    ```rust
    pub struct EmbeddingGenerator {
        model: FlagEmbedding,
        chunk_size: usize,      // 512 tokens
        chunk_overlap: usize,   // 64 tokens
    }
    ```
  - `new(model_name, chunk_size, chunk_overlap) -> Result<Self>`:
    - Initialize `FlagEmbedding` with chosen model
    - Set chunk parameters
  - `generate(content: &str) -> Result<Vec<Vec<f32>>>`:
    - Split content into chunks of `chunk_size` tokens (use a simple tokenizer: `content.split_whitespace()` is ~token count / 1.3 on average, or use `tantivy`'s tokenizer, or just char count heuristic)
    - For each chunk (with `chunk_overlap` overlap):
      - Call `model.embed(vec![chunk_text], 1)?`
      - Collect embedding
    - Return Vec of embeddings (one per chunk)
  - For short pages (<512 tokens), only one embedding is generated
- Integrate into `SearchIndex::index_new_pages()`:
  - After writing to Tantivy (but before marking `indexed = 1`), generate embeddings
  - In the same `spawn_blocking` task: for each page, generate embedding(s), save to `page_embeddings` table
  - This keeps the index-then-embed pipeline atomic

**Key design:** Generate embeddings during indexing (not during crawling). The crawler's job is speed; the indexer can be slower. Embedding generation is CPU-bound (ONNX inference on CPU).

**Testable result:** After indexing a page with content "Rust is a systems programming language...", the `page_embeddings` table contains 1+ rows with 384-dimensional float vectors.

### 5.4 Integrate embedding into the full pipeline

**Implementation:**
- Make embedding generation optional:
  - CLI flag: `--embed` for indexer
  - API query param: `?embed=true` on POST /index
  - Config: `SearchIndex` stores an `Option<EmbeddingGenerator>`
- Update `index_new_pages()` to check for the generator:
  ```rust
  if let Some(ref gen) = self.embed_generator {
      for page in &pages {
          let embeddings = gen.generate(&page.content)?;
          for (chunk_idx, emb) in embeddings.iter().enumerate() {
              save_embedding(db_pool, PageEmbedding { page.id, chunk_idx, embedding: emb })?;
          }
      }
  }
  ```
- For `reindex_all_pages()`: truncate `page_embeddings` table first

**Testable result:** `indexer --embed index` generates embeddings for all unindexed pages. `reindex` regenerates them.

---

## Phase 6 — Vector (Semantic) Search

### 6.1 Implement brute-force cosine similarity search

**Implementation:**
- In `indexer/src/search.rs` or new `indexer/src/vector.rs`:
  - Define `VectorSearchHit { url, title, description, snippet, score: f32 }`
  - Define `VectorSearchResponse { total_hits, hits, query, ... }`
  - Implement `search_vector(query_str, limit, offset) -> Result<VectorSearchResponse>`:
    - Generate embedding for the query string: `generator.embed(vec![query_str], 1)?`
    - Load all embeddings from `page_embeddings` table: `SELECT page_id, embedding, ... FROM page_embeddings`
    - For rows where chunk_index = 0 (first chunk per page — skip chunked representations for simplicity), load BLOB as `Vec<f32>`
    - Compute cosine similarity: `dot(a, b) / (norm(a) * norm(b))` for each stored embedding vs query embedding
    - Normalize to [0, 1] range
    - Collect all (page_id, score) pairs
    - Sort by score descending
    - Apply pagination
    - Look up URL/title/description from SQLite or Tantivy (Tantivy is faster — search by URL)
    - Return hits

- **Optimization:** For first implementation, load all embeddings into memory and brute-force. At 10K pages × 384 f32 = ~15MB — fits in RAM.

**Testable result:** `vector_search("programming language")` returns semantically relevant pages even if they don't contain the exact words "programming language" (e.g., "Rust is a systems language" would match).

### 6.2 Add optional HNSW index for ANN search

**Implementation:**
- Add dependency: `hnsw` crate (like `instant-distance` or a simple Rust HNSW implementation), or `pgrx`/`pgvector` style approach
- Alternative: use `qdrant` client for vector search if running externally
- For the local-first approach, implement a simple HNSW:
  - Build index from all page embeddings
  - Add vectors incrementally as new pages are embedded
  - Search: query embedding → traverse HNSW graph → return approximate nearest neighbors
  - Compare recall@10 against brute force
- Keep both paths: brute-force (exact, slower for large sets) and ANN (approximate, faster)

**Key decision:** For collections under 50K docs, brute-force is fast enough (<100ms). Only add HNSW if latency becomes an issue. The architecture should be pluggable.

**Testable result:** ANN returns results within 95% recall of brute force, at 10× speed.

### 6.3 Expose /search?mode=vector endpoint

**Implementation:**
- Update `SearchQueryParams` to include `mode: Option<String>` (default `"bm25"`, also `"vector"`, `"hybrid"`)
- Add `handle_search_vector()` or branch within `handle_search()`:
  ```rust
  match params.mode.as_deref() {
      Some("vector") | Some("semantic") => {
          // generate query embedding, search vector index
          // return VectorSearchResponse
      }
      _ => {
          // existing BM25 search
      }
  }
  ```
- The vector search handler uses `EmbeddingGenerator` from state to embed the query, then searches the vector index

**Testable result:** `curl 'http://localhost:8001/search?q=systems+programming&mode=vector'` returns semantically relevant results ranked by cosine similarity.

### 6.4 Expose /search?mode=hybrid endpoint

**Implementation:**
- In the hybrid branch:
  - Run BM25 search (with higher limit, e.g., `limit * 3` to compensate for fusion)
  - Run vector search (same higher limit)
  - Fuse results (see Phase 7 for fusion algorithms)
  - Apply final pagination
  - Return fused results with `score = fused_score`, plus `modes_used: ["bm25", "vector"]`

**Testable result:** `curl 'http://localhost:8001/search?q=rust&mode=hybrid'` returns results from both BM25 and vector search, fused and re-ranked.

### 6.5 Benchmark search recall

**Implementation:**
- Create a benchmark script that:
  - Has a set of queries with known relevant results (or uses MRR/NDCG metrics)
  - Runs BM25, vector, and hybrid search for each query
  - Reports recall@10, precision@10, MRR for each mode
  - Reports average latency for each mode
- Run at various index sizes (100, 1000, 10000 pages) to characterize scaling

**Testable result:** Quantified tradeoffs between modes. Vector search excels at semantic matches, BM25 at exact term matches, hybrid combines both.

---

## Phase 7 — Hybrid Search & Reranking

### 7.1 Implement Reciprocal-Rank Fusion (RRF)

**Implementation:**
- RRF formula: `score(doc) = sum_over_lists( k / (rank_in_list + k) )`
  - `k` = constant (typically 60)
  - `rank_in_list` = position of doc in each result list (1-indexed)
- `fuse_hybrid_results(bm25_results: Vec<SearchHit>, vector_results: Vec<VectorSearchHit>, k: f32, limit: usize, offset: usize) -> Vec<SearchHit>`:
  - Build HashMap<url, (bm25_rank, vector_rank, bm25_score, vector_score, metadata)>
    - For BM25 hits: `bm25_rank = i + 1`, `bm25_score = hit.score`
    - For vector hits: `vector_rank = i + 1`, `vector_score = hit.score`
  - For each doc: `rrf_score = k/(bm25_rank + k) + k/(vector_rank + k)` (if a list lacks the doc, omit that term = 0)
  - Sort by RRF score descending
  - Optionally preserve original scores for debugging
  - Adjust pagination from fused results

**Why RRF over weighted sum:** RRF doesn't require score normalization between BM25 and cosine similarity (which are on different scales). Ranks are inherently dimensionless.

**Testable result:** RRF-fused results are better than either BM25 or vector alone on a test set of diverse queries.

### 7.2 Add optional cross-encoder reranking

**Implementation:**
- `fastembed` 5.x supports cross-encoders like `ms-marco-MiniLM-L-6-v2`:
  ```rust
  use fastembed::CrossEncoder;
  let encoder = CrossEncoder::new(...)?;
  let pairs = vec![("query", "doc1"), ("query", "doc2"), ...];
  let scores = encoder.predict(pairs)?;
  ```
- Reranking loop:
  - Get top 20–50 results from RRF fusion
  - For each, create `(query, doc.title + "\n" + doc.snippet)` pair
  - Score all pairs with the cross-encoder (batch predict)
  - Re-sort by cross-encoder score
  - Return reranked results
- This is expensive (20–50 inference calls) but only on the top candidates
- Make optional: `?rerank=true` query param, default false

**Testable result:** Cross-encoder reranking improves NDCG@10 by ~5-10% on top of RRF, at the cost of 50-200ms additional latency.

### 7.3 Add configurable fusion weights

**Implementation:**
- Extend the hybrid mode to support `alpha` and `beta` weights:
  - `score = alpha * normalized_bm25_score + beta * normalized_vector_score`
  - Normalize scores to [0, 1] per result list before combining
  - Default: `alpha = 0.5, beta = 0.5` (equal weight) or use RRF (no normalization needed)
- CLI flags for indexer: `--fusion-alpha 0.6 --fusion-beta 0.4`
- Query params: `?alpha=0.7&beta=0.3`
- Persist weights in response metadata

**Testable result:** Varying alpha/beta shifts results predictably — higher alpha favors exact term matches, higher beta favors semantic similarity.

---

## Phase 8 — API & Python Orchestrator Integration

### 8.1 Extend search API with mode parameter

**Implementation:**
- Update `SearchQueryParams`:
  ```rust
  pub struct SearchQueryParams {
      pub q: String,
      pub limit: Option<usize>,
      pub offset: Option<usize>,
      pub mode: Option<String>,     // "bm25", "vector", "hybrid"
      pub rerank: Option<bool>,     // enable cross-encoder rerank
      pub alpha: Option<f32>,       // BM25 weight for hybrid
      pub beta: Option<f32>,        // vector weight for hybrid
  }
  ```
- Update `handle_search` to dispatch based on mode:
  - `bm25` → existing BM25 search
  - `vector` → vector search
  - `hybrid` → fused search
- Update response to include mode metadata
- Add error handling for invalid modes

**Testable result:** All mode combinations return reasonable results without crashes.

### 8.2 Extend status endpoint

**Implementation:**
- Update `StatusResponse`:
  ```rust
  pub struct StatusResponse {
      pub total_pages: i64,
      pub indexed_pages: i64,
      pub tantivy_docs: u64,
      pub vector_index_docs: u64,      // pages with embeddings
      pub shard_count: usize,
      pub embedding_model: String,     // "BGE-small-en-v1.5" or "none"
      pub shards: Vec<ShardStatus>,    // per-shard doc counts
  }
  ```

**Testable result:** `curl http://localhost:8001/status` returns complete status including vector and shard info.

### 8.3 Update Python hybrid merge

**Implementation:**
- The Python orchestrator (`server/src/main.py`) currently:
  - Searches local Rust engine (`:8001/search`)
  - Searches SearXNG (`:8080/search`)
  - Merges with score boost ×1.5 for local results
- Update to forward `mode` parameter to Rust engine
- Update hybrid merge logic:
  - If Rust returns hybrid results (BM25+vector fused), still merge with SearXNG
  - The python-level merge is: `rust_results + searxng_results → fused`
  - No need for special handling — just use the scores as returned
- Update `api/search` route to accept `mode`, `rerank`, `alpha`, `beta` params

**Testable result:** `curl 'http://localhost:8000/api/search?q=rust&provider=hybrid&mode=hybrid'` returns results fused from both BM25, vector, and SearXNG.

### 8.4 Add CLI flags for vector search

**Implementation:**
- Add to indexer CLI:
  - `--embed` flag to enable embedding generation during indexing
  - `--vector` flag to enable vector search endpoints
  - `--shards N` flag for shard count (default 1)
  - `--fusion-alpha F`, `--fusion-beta F` for hybrid fusion weights
- Wire through to `SearchIndex` and `ApiState`

**Testable result:** `indexer serve --port 8001 --vector --shards 4` starts a 4-shard, vector-capable search server.

---

## Phase 9 — Documentation & Polish

### 9.1 Update engine.md

**Implementation:**
- Add sections covering:
  - Inverted index sharding architecture
  - Vector embedding pipeline (flow from crawl → embed → store)
  - HNSW index (if implemented)
  - Hybrid search modes: BM25, vector, RRF fusion
  - Cross-encoder reranking
  - Updated CLI reference
  - Updated REST API reference
  - Performance benchmarks (BM25 vs vector vs hybrid)
  - Configuration reference for embedding parameters

**Testable result:** `docs/engine.md` is a complete reference for all engine features.

### 9.2 Add integration tests

**Implementation:**
- End-to-end test:
  1. Create test SQLite DB
  2. Insert sample pages with known content
  3. Run indexing (with embeddings)
  4. Run BM25 search → verify exact matches
  5. Run vector search → verify semantic matches
  6. Run hybrid search → verify fusion
  7. Run with sharding → verify consistency
- Use `#[cfg(test)] mod tests` in each crate or a separate test directory
- For integration tests, use `tempfile` for temp databases and indices

**Testable result:** `cargo test --workspace` passes all tests.

### 9.3 Performance benchmarks

**Implementation:**
- Use `criterion` crate for microbenchmarks:
  - BM25 search latency vs index size
  - Vector search latency vs index size
  - Shard count vs search latency
  - Embedding generation throughput (pages/sec)
  - Batch write throughput
  - Crawler throughput (pages/sec) at various concurrencies
- Record in `docs/benchmarks.md` or as comments in `docs/engine.md`

**Testable result:** Benchmarks show scaling behavior and help identify bottlenecks.

---

## Summary Table

| Phase | Focus | Commits | Dependencies On |
|---|---|---|---|
| 0 | Scaffolding + SQLite | 2 | — |
| 1 | Crawler core | 5 | Phase 0 |
| 2 | BM25 inverted index | 5 | Phase 0 |
| 3 | Crawler optimization | 8 | Phase 1 |
| 4 | Index sharding | 4 | Phase 2 |
| 5 | Vector embeddings | 4 | Phase 0 (schema), Phase 2 (pipeline) |
| 6 | Vector search | 5 | Phase 5 (embeddings) |
| 7 | Hybrid search + reranking | 3 | Phases 2 + 6 |
| 8 | API + Python integration | 4 | Phases 2 + 6 + 7 |
| 9 | Docs + tests | 3 | All |

**Total: ~43 commits across 9 phases (consolidated from the 13-phase original by merging benchmark steps into parent phases).**
