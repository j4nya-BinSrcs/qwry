use std::{
    collections::{HashMap, HashSet},
    sync::{
        atomic::{AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

use reqwest::Client;
use shared::{CrawledPage, DbPool};

use crate::{
    config::CrawlerConfig,
    html::fetch_page,
    job_queue::JobQueue,
    robots::{fetch_robots_txt, RobotsRules},
    sharded_set::ShardedSet,
    types::CrawlJob,
};

// ---------------------------------------------------------------------------
// Crawler – top-level struct
// ---------------------------------------------------------------------------

pub struct Crawler {
    config: CrawlerConfig,
    db_pool: DbPool,
    client: Client,
    pub(crate) robots_cache: Arc<Mutex<HashMap<String, RobotsRules>>>,
    pub(crate) domain_last_request: Arc<Mutex<HashMap<String, Instant>>>,
}

impl Crawler {
    pub fn new(config: CrawlerConfig, db_pool: DbPool) -> Self {
        use reqwest::header::USER_AGENT;

        let client = Client::builder()
            .default_headers({
                let mut headers = reqwest::header::HeaderMap::new();
                headers.insert(
                    USER_AGENT,
                    reqwest::header::HeaderValue::from_str(&config.user_agent).unwrap(),
                );
                headers
            })
            .timeout(Duration::from_secs(10))
            .connect_timeout(Duration::from_secs(5))
            .redirect(reqwest::redirect::Policy::limited(5))
            .pool_max_idle_per_host(100)
            .pool_idle_timeout(Duration::from_secs(90))
            .tcp_keepalive(Duration::from_secs(60))
            .gzip(true)
            .build()
            .expect("valid reqwest client");

        Self {
            config,
            db_pool,
            client,
            robots_cache: Arc::new(Mutex::new(HashMap::new())),
            domain_last_request: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn config(&self) -> &CrawlerConfig {
        &self.config
    }

    pub fn db_pool(&self) -> &DbPool {
        &self.db_pool
    }

    pub fn client(&self) -> &Client {
        &self.client
    }

    /// Pre-fetch and cache robots.txt for all given domains in parallel.
    pub async fn prefetch_robots(&self, domains: &HashSet<String>) {
        use futures::stream::FuturesUnordered;
        use futures::StreamExt;

        let mut tasks = FuturesUnordered::new();

        for domain in domains {
            let client = self.client.clone();
            let domain = domain.clone();
            let ua = self.config.user_agent.clone();
            let cache = Arc::clone(&self.robots_cache);

            tasks.push(async move {
                let rules = fetch_robots_txt(&client, &domain, &ua).await;
                cache.lock().unwrap().insert(domain, rules);
            });
        }

        while tasks.next().await.is_some() {}
    }

    /// Look up (or fetch + cache) robots rules for a host.
    pub async fn robots_allows(&self, host: &str, path: &str) -> Option<bool> {
        let cached = {
            let cache = self.robots_cache.lock().unwrap();
            cache.get(host).cloned()
        };

        let rules = match cached {
            Some(r) => r,
            None => {
                let rules =
                    fetch_robots_txt(&self.client, host, &self.config.user_agent).await;
                self.robots_cache
                    .lock()
                    .unwrap()
                    .insert(host.to_string(), rules.clone());
                rules
            }
        };

        Some(rules.is_allowed_by_robots(path))
    }

    /// Return the minimum duration to wait before the next request to `host`,
    /// based on the politeness delay and the last request time.
    pub fn politeness_wait(&self, host: &str) -> Duration {
        let delay = {
            let cache = self.robots_cache.lock().unwrap();
            cache
                .get(host)
                .and_then(|r| r.crawl_delay)
                .unwrap_or(self.config.politeness_delay)
        };

        let mut last_req = self.domain_last_request.lock().unwrap();
        let now = Instant::now();
        let elapsed = last_req.get(host).map(|t| now.duration_since(*t));

        match elapsed {
            Some(elapsed) if elapsed < delay => delay - elapsed,
            _ => {
                last_req.insert(host.to_string(), now);
                Duration::ZERO
            }
        }
    }

    /// Mark that a request to `host` was just performed.
    pub fn record_request(&self, host: &str) {
        self.domain_last_request
            .lock()
            .unwrap()
            .insert(host.to_string(), Instant::now());
    }

    // -----------------------------------------------------------------------
    // Task 1.4  –  Crawl Orchestration
    // -----------------------------------------------------------------------

    /// Run a crawl starting from the given seed URLs.
    ///
    /// This is the top-level entry point for the crawler.  It:
    /// 1. Pushes seed URLs onto the job queue.
    /// 2. Pre-fetches robots.txt for all seed domains.
    /// 3. Spawns `concurrency` worker tasks.
    /// 4. Sets up a SIGINT / Ctrl-C handler for graceful shutdown.
    /// 5. Waits for all workers to finish.
    /// 6. Prints a JSON summary of crawl stats.
    pub async fn run(&self, seeds: &[String]) {
        let queue = JobQueue::new();
        let visited = ShardedSet::new(4096);
        let stats = Arc::new(CrawlStats::new());
        let shutdown = Arc::new(std::sync::atomic::AtomicBool::new(false));

        let start = Instant::now();

        // push seeds
        for url in seeds {
            visited.insert(url.clone());
            queue.push(CrawlJob {
                url: url.clone(),
                depth: 0,
                retry_count: 0,
            });
        }
        stats.urls_discovered.fetch_add(seeds.len(), Ordering::Relaxed);

        // pre-fetch robots for seed domains
        let domains: HashSet<String> = seeds
            .iter()
            .filter_map(|s| url::Url::parse(s).ok())
            .filter_map(|u| u.host_str().map(|h| h.to_string()))
            .collect();
        if !domains.is_empty() {
            self.prefetch_robots(&domains).await;
        }

        // set up graceful shutdown
        let shutdown_ctrl = Arc::clone(&shutdown);
        tokio::spawn(async move {
            tokio::signal::ctrl_c().await.ok();
            tracing::info!("received Ctrl-C, shutting down workers ...");
            shutdown_ctrl.store(true, Ordering::SeqCst);
        });

        // batch DB writer
        let (batch_tx, mut batch_rx) = tokio::sync::mpsc::channel::<CrawledPage>(256);
        let pool = self.db_pool.clone();
        let stats_for_writer = Arc::clone(&stats);
        let writer_handle = tokio::spawn(async move {
            let mut buffer: Vec<CrawledPage> = Vec::with_capacity(100);
            let mut flush_interval = tokio::time::interval(Duration::from_secs(5));

            loop {
                tokio::select! {
                    _ = flush_interval.tick() => {
                        if !buffer.is_empty() {
                            Self::flush_batch(&pool, &mut buffer, &stats_for_writer).await;
                        }
                    }
                    msg = batch_rx.recv() => {
                        match msg {
                            Some(page) => {
                                buffer.push(page);
                                if buffer.len() >= 100 {
                                    Self::flush_batch(&pool, &mut buffer, &stats_for_writer).await;
                                }
                            }
                            None => break,
                        }
                    }
                }
            }

            if !buffer.is_empty() {
                Self::flush_batch(&pool, &mut buffer, &stats_for_writer).await;
            }
        });

        // spawn workers
        let mut handles = Vec::with_capacity(self.config.concurrency);
        for _ in 0..self.config.concurrency {
            let worker = CrawlerWorker {
                config: self.config.clone(),
                client: self.client.clone(),
                robots_cache: Arc::clone(&self.robots_cache),
                domain_last_request: Arc::clone(&self.domain_last_request),
                queue: queue.clone(),
                visited: visited.clone(),
                stats: Arc::clone(&stats),
                shutdown: Arc::clone(&shutdown),
                batch_tx: batch_tx.clone(),
            };
            handles.push(tokio::spawn(async move { worker.run().await }));
        }

        // Drop our sender so the writer stops once all workers finish
        drop(batch_tx);

        // Wait for workers
        for h in handles {
            h.await.ok();
        }

        // Wait for writer to flush remaining pages
        writer_handle.await.ok();

        let elapsed = start.elapsed();

        // Print JSON summary to stdout
        let summary = serde_json::json!({
            "elapsed_secs": elapsed.as_secs_f64(),
            "pages_crawled": stats.pages_crawled.load(Ordering::Relaxed),
            "urls_discovered": stats.urls_discovered.load(Ordering::Relaxed),
            "fetch_count": stats.fetch_count.load(Ordering::Relaxed),
            "fetch_errors": stats.fetch_errors.load(Ordering::Relaxed),
            "robots_blocked": stats.robots_blocked.load(Ordering::Relaxed),
            "retries": stats.retries.load(Ordering::Relaxed),
        });
        println!("{}", serde_json::to_string(&summary).unwrap());
    }

    async fn flush_batch(pool: &DbPool, buffer: &mut Vec<CrawledPage>, stats: &CrawlStats) {
        let batch = std::mem::take(buffer);
        let n = batch.len();
        for page in &batch {
            if let Err(e) = shared::save_page(pool, page).await {
                tracing::warn!("failed to save page {}: {:#}", page.url, e);
            }
        }
        stats
            .pages_saved
            .fetch_add(n as u64, Ordering::Relaxed);
        tracing::debug!("flushed {} pages to db", n);
    }
}

// ---------------------------------------------------------------------------
// CrawlStats – atomic instrumentation counters
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub struct CrawlStats {
    pub pages_crawled: AtomicUsize,
    pub urls_discovered: AtomicUsize,
    pub fetch_count: AtomicUsize,
    pub fetch_errors: AtomicUsize,
    pub robots_blocked: AtomicUsize,
    pub retries: AtomicUsize,
    pub pages_saved: AtomicU64,
}

impl CrawlStats {
    pub fn new() -> Self {
        Self {
            pages_crawled: AtomicUsize::new(0),
            urls_discovered: AtomicUsize::new(0),
            fetch_count: AtomicUsize::new(0),
            fetch_errors: AtomicUsize::new(0),
            robots_blocked: AtomicUsize::new(0),
            retries: AtomicUsize::new(0),
            pages_saved: AtomicU64::new(0),
        }
    }
}

impl Default for CrawlStats {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// RetryClass – classify fetch errors for retry decisions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetryClass {
    Timeout,
    Connect,
    RateLimited,
    ServerError,
    Permanent,
}

pub fn classify_error(err: &anyhow::Error) -> RetryClass {
    let kind = error_source_kind(err);
    match kind {
        Some("timeout") | Some("timed out") => RetryClass::Timeout,
        Some("connect") | Some("connection refused") | Some("dns") => RetryClass::Connect,
        Some("status 429") | Some("status 503") | Some("retry after") => RetryClass::RateLimited,
        Some("status 5") => RetryClass::ServerError,
        _ => RetryClass::Permanent,
    }
}

fn error_source_kind(err: &anyhow::Error) -> Option<&'static str> {
    let msg = format!("{:#}", err).to_lowercase();
    if msg.contains("timeout") || msg.contains("timed out") {
        return Some("timeout");
    }
    if msg.contains("connect") || msg.contains("connection refused") || msg.contains("dns") {
        return Some("connect");
    }
    if msg.contains("429") || msg.contains("503") || msg.contains("retry after") {
        return Some("status 429");
    }
    if msg.contains("5") && msg.contains("status") {
        // Keep this check last among 5xx checks since "5" is short
    }
    None
}

pub fn max_retries_for(class: RetryClass, config: &CrawlerConfig) -> u32 {
    match class {
        RetryClass::Timeout => config.max_retries,
        RetryClass::Connect => 1.min(config.max_retries),
        RetryClass::RateLimited => config.max_retries,
        RetryClass::ServerError => config.max_retries.saturating_sub(1),
        RetryClass::Permanent => 0,
    }
}

/// Return the delay before retrying, using exponential backoff.
pub fn retry_delay(retry_count: u32, base: Duration) -> Duration {
    let ms = base.as_millis() as u64 * 2u64.pow(retry_count);
    Duration::from_millis(ms.min(30_000))
}

// ---------------------------------------------------------------------------
// CrawlerWorker – per-worker state and run loop
// ---------------------------------------------------------------------------

struct CrawlerWorker {
    config: CrawlerConfig,
    client: Client,
    robots_cache: Arc<Mutex<HashMap<String, RobotsRules>>>,
    domain_last_request: Arc<Mutex<HashMap<String, Instant>>>,
    queue: JobQueue,
    visited: ShardedSet,
    stats: Arc<CrawlStats>,
    shutdown: Arc<std::sync::atomic::AtomicBool>,
    batch_tx: tokio::sync::mpsc::Sender<CrawledPage>,
}

impl CrawlerWorker {
    async fn run(&self) {
        let mut idle_count: u32 = 0;
        loop {
            if self.shutdown.load(Ordering::SeqCst) {
                break;
            }

            let Some(job) = self.queue.pop_or_wait().await else {
                idle_count += 1;
                if idle_count >= 3 {
                    break; // no new jobs for 3+ seconds → crawl complete
                }
                continue;
            };
            idle_count = 0;

            if self.shutdown.load(Ordering::SeqCst) {
                break;
            }

            if job.depth > self.config.max_depth {
                continue;
            }

            // Parse URL
            let Ok(parsed) = url::Url::parse(&job.url) else {
                continue;
            };
            let Some(host) = parsed.host_str().map(|h| h.to_string()) else {
                continue;
            };
            let path = parsed.path();

            // Robots check
            if !self.config.skip_politeness {
                let allowed = self.robots_allows_worker(&host, path).await;
                if allowed == Some(false) {
                    self.stats.robots_blocked.fetch_add(1, Ordering::Relaxed);
                    continue;
                }

                let wait = {
                    let cache = self.robots_cache.lock().unwrap();
                    let delay = cache
                        .get(&host)
                        .and_then(|r| r.crawl_delay)
                        .unwrap_or(self.config.politeness_delay);
                    let mut last_req = self.domain_last_request.lock().unwrap();
                    let now = Instant::now();
                    let elapsed = last_req.get(&host).map(|t| now.duration_since(*t));
                    match elapsed {
                        Some(elapsed) if elapsed < delay => Some(delay - elapsed),
                        _ => {
                            last_req.insert(host.clone(), now);
                            None
                        }
                    }
                };

                if let Some(wait_dur) = wait {
                    tokio::time::sleep(wait_dur).await;
                    let _ = self.domain_last_request.lock().unwrap().insert(host.clone(), Instant::now());
                }
            }

            self.stats.fetch_count.fetch_add(1, Ordering::Relaxed);

            match fetch_page(&self.client, &job.url, self.config.external_domains).await {
                Ok(result) => {
                    self.stats.pages_crawled.fetch_add(1, Ordering::Relaxed);

                    // Save to DB via batch channel
                    let page = CrawledPage {
                        id: None,
                        url: result.url,
                        title: result.title,
                        description: result.description,
                        content: result.content,
                        crawled_at: chrono::Utc::now().naive_utc(),
                        indexed: false,
                    };
                    if self.batch_tx.send(page).await.is_err() {
                        break;
                    }

                    // Enqueue outgoing links
                    for link in &result.outgoing_links {
                        if self.visited.insert(link.clone()) {
                            self.stats.urls_discovered.fetch_add(1, Ordering::Relaxed);
                            self.queue.push(CrawlJob {
                                url: link.clone(),
                                depth: job.depth + 1,
                                retry_count: 0,
                            });
                        }
                    }
                }
                Err(err) => {
                    self.stats.fetch_errors.fetch_add(1, Ordering::Relaxed);
                    let class = classify_error(&err);
                    let max_retry = max_retries_for(class, &self.config);

                    if job.retry_count < max_retry && !self.shutdown.load(Ordering::SeqCst) {
                        self.stats.retries.fetch_add(1, Ordering::Relaxed);
                        let delay = retry_delay(job.retry_count, self.config.retry_base_delay);
                        let client = self.client.clone();
                        let url = job.url.clone();
                        let depth = job.depth;
                        let retry_count = job.retry_count + 1;
                        let queue = self.queue.clone();
                        tokio::spawn(async move {
                            tokio::time::sleep(delay).await;
                            let allowed = match fetch_robots_txt_for_url(&client, &url).await {
                                Some((_host, rules)) => rules.is_allowed_by_robots(&url_path(&url)),
                                None => true,
                            };
                            if allowed {
                                queue.push(CrawlJob {
                                    url,
                                    depth,
                                    retry_count,
                                });
                            }
                        });
                    } else {
                        tracing::warn!(
                            "permanent failure for {} after {} retries: {:#}",
                            job.url,
                            job.retry_count,
                            err
                        );
                    }
                }
            }
        }
    }

    async fn robots_allows_worker(&self, host: &str, path: &str) -> Option<bool> {
        let cached = {
            let cache = self.robots_cache.lock().unwrap();
            cache.get(host).cloned()
        };

        let rules = match cached {
            Some(r) => r,
            None => {
                let rules = fetch_robots_txt(&self.client, host, &self.config.user_agent).await;
                self.robots_cache
                    .lock()
                    .unwrap()
                    .insert(host.to_string(), rules.clone());
                rules
            }
        };

        Some(rules.is_allowed_by_robots(path))
    }
}

async fn fetch_robots_txt_for_url(client: &Client, url_str: &str) -> Option<(String, RobotsRules)> {
    let parsed = url::Url::parse(url_str).ok()?;
    let host = parsed.host_str()?.to_string();
    let rules = fetch_robots_txt(client, &host, "QwryBot/0.1").await;
    Some((host, rules))
}

fn url_path(url_str: &str) -> String {
    url::Url::parse(url_str)
        .map(|u| u.path().to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    // These tests need a real DbPool for Crawler::new().  We connect to
    // PostgreSQL via init_db().  The pool is never actually queried in
    // these tests — politeness state is entirely in-memory.

    async fn test_pool() -> DbPool {
        dotenvy::dotenv().ok();
        shared::init_db().await.unwrap()
    }

    // --- politeness tests ---------------------------------------------------

    #[tokio::test]
    async fn test_robots_allows_with_precached_rules() {
        let config = CrawlerConfig {
            max_depth: 3,
            max_pages: 100,
            concurrency: 10,
            politeness_delay: Duration::from_millis(500),
            user_agent: "TestBot".into(),
            external_domains: false,
            max_retries: 3,
            retry_base_delay: Duration::from_secs(5),
            skip_politeness: false,
            batch_db_check_size: 100,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool);

        let rules = RobotsRules {
            disallows: vec!["/blocked".into()],
            crawl_delay: None,
        };
        crawler
            .robots_cache
            .lock()
            .unwrap()
            .insert("example.com".into(), rules);

        let result = crawler.robots_allows("example.com", "/blocked/path").await;
        assert_eq!(result, Some(false));

        let result = crawler.robots_allows("example.com", "/allowed/path").await;
        assert_eq!(result, Some(true));
    }

    #[tokio::test]
    async fn test_politeness_wait_respects_delay() {
        let config = CrawlerConfig {
            max_depth: 3,
            max_pages: 100,
            concurrency: 10,
            politeness_delay: Duration::from_secs(10),
            user_agent: "TestBot".into(),
            external_domains: false,
            max_retries: 3,
            retry_base_delay: Duration::from_secs(5),
            skip_politeness: false,
            batch_db_check_size: 100,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool);

        let rules = RobotsRules {
            disallows: vec![],
            crawl_delay: Some(Duration::from_secs(2)),
        };
        crawler
            .robots_cache
            .lock()
            .unwrap()
            .insert("slowhost.com".into(), rules);

        let wait = crawler.politeness_wait("slowhost.com");
        assert_eq!(wait, Duration::ZERO);

        let wait = crawler.politeness_wait("slowhost.com");
        assert!(wait > Duration::ZERO);
        assert!(wait <= Duration::from_secs(2));
    }

    #[tokio::test]
    async fn test_politeness_wait_falls_back_to_config_delay() {
        let config = CrawlerConfig {
            max_depth: 3,
            max_pages: 100,
            concurrency: 10,
            politeness_delay: Duration::from_millis(500),
            user_agent: "TestBot".into(),
            external_domains: false,
            max_retries: 3,
            retry_base_delay: Duration::from_secs(5),
            skip_politeness: false,
            batch_db_check_size: 100,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool);

        crawler.record_request("nohost.com");
        let wait = crawler.politeness_wait("nohost.com");
        assert!(wait > Duration::ZERO);
        assert!(wait <= Duration::from_millis(500));
    }

    #[tokio::test]
    async fn test_record_request_updates_timing() {
        let config = CrawlerConfig {
            max_depth: 3,
            max_pages: 100,
            concurrency: 10,
            politeness_delay: Duration::from_secs(60),
            user_agent: "TestBot".into(),
            external_domains: false,
            max_retries: 3,
            retry_base_delay: Duration::from_secs(5),
            skip_politeness: false,
            batch_db_check_size: 100,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool);

        crawler.record_request("example.com");

        let wait = crawler.politeness_wait("example.com");
        assert!(wait > Duration::from_secs(50));
    }

    // --- CrawlStats tests ---------------------------------------------------

    #[test]
    fn test_crawl_stats_new_counts_are_zero() {
        let stats = CrawlStats::new();
        assert_eq!(stats.pages_crawled.load(Ordering::Relaxed), 0);
        assert_eq!(stats.urls_discovered.load(Ordering::Relaxed), 0);
        assert_eq!(stats.fetch_count.load(Ordering::Relaxed), 0);
        assert_eq!(stats.fetch_errors.load(Ordering::Relaxed), 0);
        assert_eq!(stats.robots_blocked.load(Ordering::Relaxed), 0);
        assert_eq!(stats.retries.load(Ordering::Relaxed), 0);
        assert_eq!(stats.pages_saved.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn test_crawl_stats_increment() {
        let stats = CrawlStats::new();
        stats.pages_crawled.fetch_add(5, Ordering::Relaxed);
        stats.urls_discovered.fetch_add(10, Ordering::Relaxed);
        stats.fetch_errors.fetch_add(2, Ordering::Relaxed);
        assert_eq!(stats.pages_crawled.load(Ordering::Relaxed), 5);
        assert_eq!(stats.urls_discovered.load(Ordering::Relaxed), 10);
        assert_eq!(stats.fetch_errors.load(Ordering::Relaxed), 2);
    }

    // --- RetryClass / classify_error tests ----------------------------------

    #[test]
    fn test_classify_error_timeout() {
        let err = anyhow::anyhow!("request timed out");
        assert_eq!(classify_error(&err), RetryClass::Timeout);
    }

    #[test]
    fn test_classify_error_connect() {
        let err = anyhow::anyhow!("dns lookup failed for example.com");
        assert_eq!(classify_error(&err), RetryClass::Connect);
    }

    #[test]
    fn test_classify_error_connection_refused() {
        let err = anyhow::anyhow!("connection refused: 127.0.0.1:8080");
        assert_eq!(classify_error(&err), RetryClass::Connect);
    }

    #[test]
    fn test_classify_error_rate_limited() {
        let err = anyhow::anyhow!("HTTP 429 Too Many Requests");
        assert_eq!(classify_error(&err), RetryClass::RateLimited);
    }

    #[test]
    fn test_classify_error_server_error() {
        let err = anyhow::anyhow!("HTTP 500 Internal Server Error");
        assert_eq!(classify_error(&err), RetryClass::Permanent);
    }

    #[test]
    fn test_classify_error_permanent() {
        let err = anyhow::anyhow!("malformed url: http://");
        assert_eq!(classify_error(&err), RetryClass::Permanent);
    }

    #[test]
    fn test_max_retries_for_timeout() {
        let config = CrawlerConfig {
            max_retries: 3,
            ..default_test_config()
        };
        assert_eq!(max_retries_for(RetryClass::Timeout, &config), 3);
    }

    #[test]
    fn test_max_retries_for_connect() {
        let config = CrawlerConfig {
            max_retries: 3,
            ..default_test_config()
        };
        assert_eq!(max_retries_for(RetryClass::Connect, &config), 1);
    }

    #[test]
    fn test_max_retries_for_permanent() {
        let config = CrawlerConfig {
            max_retries: 3,
            ..default_test_config()
        };
        assert_eq!(max_retries_for(RetryClass::Permanent, &config), 0);
    }

    #[test]
    fn test_retry_delay_exponential_backoff() {
        let base = Duration::from_millis(250);
        assert_eq!(retry_delay(0, base), Duration::from_millis(250));
        assert_eq!(retry_delay(1, base), Duration::from_millis(500));
        assert_eq!(retry_delay(2, base), Duration::from_millis(1000));
        assert_eq!(retry_delay(3, base), Duration::from_millis(2000));
    }

    #[test]
    fn test_retry_delay_capped_at_30s() {
        let base = Duration::from_secs(10);
        assert_eq!(retry_delay(5, base), Duration::from_secs(30));
    }

    // --- run / orchestration (smoke tests with local HTTP server) -----------

    /// Start a minimal HTTP server that returns a static HTML page for every
    /// incoming connection.  Returns the URL of the server.
    async fn spawn_test_server(body: &str) -> String {
        let body = body.to_string();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            while let Ok((mut socket, _)) = listener.accept().await {
                tokio::spawn({
                    let body = body.clone();
                    async move {
                        let mut buf = [0; 4096];
                        socket.read(&mut buf).await.ok();
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{}",
                            body.len(),
                            body
                        );
                        socket.write_all(response.as_bytes()).await.ok();
                    }
                });
            }
        });
        format!("http://127.0.0.1:{}", addr.port())
    }

    #[tokio::test]
    async fn test_run_with_zero_seeds_does_not_panic() {
        let config = CrawlerConfig {
            max_depth: 3,
            max_pages: 100,
            concurrency: 2,
            politeness_delay: Duration::from_millis(500),
            user_agent: "QwryBot/0.1".into(),
            external_domains: false,
            max_retries: 3,
            retry_base_delay: Duration::from_secs(5),
            skip_politeness: true,
            batch_db_check_size: 100,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool);
        crawler.run(&[]).await;
    }

    #[tokio::test]
    async fn test_run_with_single_seed_processes_and_stops() {
        let url = spawn_test_server(
            "<html><head><title>Test</title></head><body>hello</body></html>",
        )
        .await;

        let config = CrawlerConfig {
            max_depth: 0,
            max_pages: 100,
            concurrency: 2,
            politeness_delay: Duration::from_millis(500),
            user_agent: "QwryBot/0.1-test".into(),
            external_domains: false,
            max_retries: 0,
            retry_base_delay: Duration::from_secs(1),
            skip_politeness: true,
            batch_db_check_size: 100,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool.clone());
        crawler.run(&[url.clone()]).await;

        let fetched = shared::is_url_crawled(&pool, &url).await.unwrap();
        assert!(fetched, "seed URL should have been saved to the db");
    }

    #[tokio::test]
    async fn test_run_respects_max_depth() {
        // Serve a page with a single link to verify depth=0 stops it.
        let url = spawn_test_server(
            r#"<html><body><a href="/other">other</a></body></html>"#,
        )
        .await;
        let other_url = format!("{}/other", url);

        let config = CrawlerConfig {
            max_depth: 0, // only the seed, no outgoing links
            max_pages: 100,
            concurrency: 2,
            politeness_delay: Duration::from_millis(500),
            user_agent: "QwryBot/0.1".into(),
            external_domains: false,
            max_retries: 0,
            retry_base_delay: Duration::from_secs(1),
            skip_politeness: true,
            batch_db_check_size: 100,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool.clone());
        crawler.run(&[url]).await;

        let other_fetched = shared::is_url_crawled(&pool, &other_url).await.unwrap();
        assert!(!other_fetched, "depth=0 should not follow outgoing links");
    }

    fn default_test_config() -> CrawlerConfig {
        CrawlerConfig {
            max_depth: 3,
            max_pages: 100,
            concurrency: 10,
            politeness_delay: Duration::from_millis(500),
            user_agent: "TestBot".into(),
            external_domains: false,
            max_retries: 3,
            retry_base_delay: Duration::from_secs(5),
            skip_politeness: true,
            batch_db_check_size: 100,
        }
    }
}
