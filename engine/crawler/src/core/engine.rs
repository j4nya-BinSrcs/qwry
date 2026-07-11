use std::{
    collections::{HashMap, HashSet},
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, RwLock,
    },
    time::{Duration, Instant},
};

use reqwest::Client;
use shared::{CrawledPage, DbPool};

use crate::{
    core::config::CrawlerConfig,
    utils::retry::{classify_error, max_retries_for, retry_delay},
    core::types::CrawlJob,
    parser::html::parse_page,
    parser::robots::{fetch_robots_txt, RobotsRules},
    utils::batch_writer::BatchWriter,
    utils::job_queue::JobQueue,
    utils::sharded_set::ShardedSet,
};

pub struct Crawler {
    config: CrawlerConfig,
    db_pool: DbPool,
    client: Client,
    pub(crate) robots_cache: Arc<RwLock<HashMap<String, RobotsRules>>>,
    pub(crate) domain_last_request: Arc<RwLock<HashMap<String, Instant>>>,
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
            robots_cache: Arc::new(RwLock::new(HashMap::new())),
            domain_last_request: Arc::new(RwLock::new(HashMap::new())),
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
                cache.write().unwrap().insert(domain, rules);
            });
        }

        while tasks.next().await.is_some() {}
    }

    pub async fn robots_allows(&self, host: &str, path: &str) -> Option<bool> {
        let cached = {
            let cache = self.robots_cache.read().unwrap();
            cache.get(host).cloned()
        };

        let rules = match cached {
            Some(r) => r,
            None => {
                let rules =
                    fetch_robots_txt(&self.client, host, &self.config.user_agent).await;
                self.robots_cache
                    .write()
                    .unwrap()
                    .insert(host.to_string(), rules.clone());
                rules
            }
        };

        Some(rules.is_allowed_by_robots(path))
    }

    pub fn politeness_wait(&self, host: &str) -> Duration {
        let delay = {
            let cache = self.robots_cache.read().unwrap();
            cache
                .get(host)
                .and_then(|r| r.crawl_delay)
                .unwrap_or(self.config.politeness_delay)
        };

        let mut last_req = self.domain_last_request.write().unwrap();
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

    pub fn record_request(&self, host: &str) {
        self.domain_last_request
            .write()
            .unwrap()
            .insert(host.to_string(), Instant::now());
    }

    pub async fn run(&self, seeds: &[String]) {
        let queue = JobQueue::new();
        let visited = ShardedSet::new(4096);
        let stats = Arc::new(CrawlStats::new());
        let shutdown = Arc::new(std::sync::atomic::AtomicBool::new(false));

        let start = Instant::now();

        for url in seeds {
            visited.insert(url.clone());
            queue.push(CrawlJob {
                url: url.clone(),
                depth: 0,
                retry_count: 0,
            });
        }
        stats.urls_discovered.fetch_add(seeds.len(), Ordering::Relaxed);

        let domains: HashSet<String> = seeds
            .iter()
            .filter_map(|s| url::Url::parse(s).ok())
            .filter_map(|u| u.host_str().map(|h| h.to_string()))
            .collect();
        if !domains.is_empty() {
            self.prefetch_robots(&domains).await;
        }

        let shutdown_ctrl = Arc::clone(&shutdown);
        tokio::spawn(async move {
            tokio::signal::ctrl_c().await.ok();
            tracing::info!("received Ctrl-C, shutting down workers ...");
            shutdown_ctrl.store(true, Ordering::SeqCst);
        });

        // Periodic progress reporter (every 500ms)
        {
            let stats = Arc::clone(&stats);
            let shutdown = Arc::clone(&shutdown);
            let max = self.config.max_pages;
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_millis(500));
                let start = Instant::now();
                loop {
                    interval.tick().await;
                    if shutdown.load(Ordering::Relaxed) {
                        break;
                    }
                    let elapsed = start.elapsed().as_secs_f64();
                    let count = stats.pages_crawled.load(Ordering::Relaxed);
                    let errors = stats.fetch_errors.load(Ordering::Relaxed);
                    if elapsed > 0.5 && count > 0 {
                        tracing::info!(
                            count,
                            max,
                            pps = format_args!("{:.0}", count as f64 / elapsed),
                            errors,
                            "Progress"
                        );
                    }
                }
            });
        }

        let batch_writer = BatchWriter::new(self.db_pool.clone());
        let batch_tx = batch_writer.sender();

        let mut handles = Vec::with_capacity(self.config.concurrency);
        for _ in 0..self.config.concurrency {
            let mut worker = CrawlerWorker {
                config: self.config.clone(),
                client: self.client.clone(),
                robots_cache: Arc::clone(&self.robots_cache),
                domain_last_request: Arc::clone(&self.domain_last_request),
                queue: queue.clone(),
                visited: visited.clone(),
                stats: Arc::clone(&stats),
                shutdown: Arc::clone(&shutdown),
                batch_tx: batch_tx.clone(),
                pending_links: Vec::new(),
            };
            handles.push(tokio::spawn(async move { worker.run().await }));
        }

        drop(batch_tx);

        for h in handles {
            h.await.ok();
        }

        batch_writer.shutdown().await;

        let elapsed = start.elapsed();

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
        }
    }
}

impl Default for CrawlStats {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// CrawlerWorker – per-worker state and run loop
// ---------------------------------------------------------------------------

const LINK_BATCH_SIZE: usize = 100;

struct PendingLink {
    url: String,
    depth: usize,
}

struct CrawlerWorker {
    config: CrawlerConfig,
    client: Client,
    robots_cache: Arc<RwLock<HashMap<String, RobotsRules>>>,
    domain_last_request: Arc<RwLock<HashMap<String, Instant>>>,
    queue: JobQueue,
    visited: ShardedSet,
    stats: Arc<CrawlStats>,
    shutdown: Arc<std::sync::atomic::AtomicBool>,
    batch_tx: tokio::sync::mpsc::Sender<CrawledPage>,
    pending_links: Vec<PendingLink>,
}

impl CrawlerWorker {
    async fn flush_pending_links(&mut self) {
        if self.pending_links.is_empty() {
            return;
        }
        let batch: Vec<String> = self.pending_links.iter().map(|p| p.url.clone()).collect();
        let fresh = self.visited.insert_batch(&batch);
        let fresh_set: std::collections::HashSet<&str> =
            fresh.iter().map(|s| s.as_str()).collect();
        let mut new_jobs: Vec<CrawlJob> = Vec::with_capacity(fresh.len());
        for pending in self.pending_links.drain(..) {
            if fresh_set.contains(pending.url.as_str()) {
                self.stats.urls_discovered.fetch_add(1, Ordering::Relaxed);
                new_jobs.push(CrawlJob {
                    url: pending.url,
                    depth: pending.depth,
                    retry_count: 0,
                });
            }
        }
        if !new_jobs.is_empty() {
            self.queue.push_batch(new_jobs);
        }
    }

    async fn run(&mut self) {
        let mut idle_count: u32 = 0;
        loop {
            if self.shutdown.load(Ordering::SeqCst) {
                self.flush_pending_links().await;
                break;
            }

            let Some(job) = self.queue.pop_or_wait().await else {
                self.flush_pending_links().await;
                idle_count += 1;
                if idle_count >= 3 {
                    break;
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

            let Ok(parsed) = url::Url::parse(&job.url) else {
                continue;
            };
            let Some(host) = parsed.host_str().map(|h| h.to_string()) else {
                continue;
            };
            let path = parsed.path();

            if !self.config.skip_politeness {
                let allowed = self.robots_allows_worker(&host, path).await;
                if allowed == Some(false) {
                    self.stats.robots_blocked.fetch_add(1, Ordering::Relaxed);
                    continue;
                }

                let wait = {
                    let cache = self.robots_cache.read().unwrap();
                    let delay = cache
                        .get(&host)
                        .and_then(|r| r.crawl_delay)
                        .unwrap_or(self.config.politeness_delay);
                    let mut last_req = self.domain_last_request.write().unwrap();
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
                    let _ = self.domain_last_request.write().unwrap().insert(host.clone(), Instant::now());
                }
            }

            self.stats.fetch_count.fetch_add(1, Ordering::Relaxed);

            // Phase 1 — async HTTP fetch
            let fetch_result = self.client.get(&job.url).send().await;
            let fetch_result = match fetch_result {
                Ok(resp) => {
                    if let Err(e) = resp.error_for_status_ref() {
                        Err(anyhow::anyhow!(e))
                    } else if !resp
                        .headers()
                        .get(reqwest::header::CONTENT_TYPE)
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("")
                        .contains("text/html")
                    {
                        Err(anyhow::anyhow!("Non-HTML content type"))
                    } else {
                        match resp.text().await {
                            Ok(body) => Ok(body),
                            Err(e) => Err(anyhow::anyhow!(e)),
                        }
                    }
                }
                Err(e) => Err(anyhow::anyhow!(e)),
            };

            // Phase 2 — CPU-bound parsing on blocking thread pool
            let result = match fetch_result {
                Ok(body) => {
                    let url_str = job.url.clone();
                    let ext = self.config.external_domains;
                    let light = self.config.lightweight;
                    match tokio::task::spawn_blocking(move || {
                        parse_page(&body, &url_str, ext, light)
                    })
                    .await
                    {
                        Ok(r) => r,
                        Err(e) => Err(anyhow::anyhow!("parse task panicked: {e}")),
                    }
                }
                Err(e) => Err(e),
            };

            match result {
                Ok(result) => {
                    if self.stats.pages_crawled.fetch_update(
                        Ordering::SeqCst,
                        Ordering::SeqCst,
                        |v| (v < self.config.max_pages).then_some(v + 1),
                    ).is_err() {
                        self.queue.push(job);
                        self.shutdown.store(true, Ordering::SeqCst);
                        break;
                    }
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

                    for link in &result.outgoing_links {
                        self.pending_links.push(PendingLink {
                            url: link.clone(),
                            depth: job.depth + 1,
                        });
                    }
                    if self.pending_links.len() >= LINK_BATCH_SIZE {
                        self.flush_pending_links().await;
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
            let cache = self.robots_cache.read().unwrap();
            cache.get(host).cloned()
        };

        let rules = match cached {
            Some(r) => r,
            None => {
                let rules = fetch_robots_txt(&self.client, host, &self.config.user_agent).await;
                self.robots_cache
                    .write()
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

    async fn test_pool() -> DbPool {
        dotenvy::dotenv().ok();
        shared::init_db().await.unwrap()
    }

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
            lightweight: false,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool);

        let rules = RobotsRules {
            disallows: vec!["/blocked".into()],
            crawl_delay: None,
        };
        crawler
            .robots_cache
            .write()
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
            lightweight: false,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool);

        let rules = RobotsRules {
            disallows: vec![],
            crawl_delay: Some(Duration::from_secs(2)),
        };
        crawler
            .robots_cache
            .write()
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
            lightweight: false,
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
            lightweight: false,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool);

        crawler.record_request("example.com");

        let wait = crawler.politeness_wait("example.com");
        assert!(wait > Duration::from_secs(50));
    }

    #[test]
    fn test_crawl_stats_new_counts_are_zero() {
        let stats = CrawlStats::new();
        assert_eq!(stats.pages_crawled.load(Ordering::Relaxed), 0);
        assert_eq!(stats.urls_discovered.load(Ordering::Relaxed), 0);
        assert_eq!(stats.fetch_count.load(Ordering::Relaxed), 0);
        assert_eq!(stats.fetch_errors.load(Ordering::Relaxed), 0);
        assert_eq!(stats.robots_blocked.load(Ordering::Relaxed), 0);
        assert_eq!(stats.retries.load(Ordering::Relaxed), 0);
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
            lightweight: false,
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
            lightweight: false,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool.clone());
        crawler.run(&[url.clone()]).await;

        let fetched = shared::is_url_crawled(&pool, &url).await.unwrap();
        assert!(fetched, "seed URL should have been saved to the db");
    }

    #[tokio::test]
    async fn test_run_respects_max_depth() {
        let url = spawn_test_server(
            r#"<html><body><a href="/other">other</a></body></html>"#,
        )
        .await;
        let other_url = format!("{}/other", url);

        let config = CrawlerConfig {
            max_depth: 0,
            max_pages: 100,
            concurrency: 2,
            politeness_delay: Duration::from_millis(500),
            user_agent: "QwryBot/0.1".into(),
            external_domains: false,
            max_retries: 0,
            retry_base_delay: Duration::from_secs(1),
            skip_politeness: true,
            batch_db_check_size: 100,
            lightweight: false,
        };
        let pool = test_pool().await;
        let crawler = Crawler::new(config, pool.clone());
        crawler.run(&[url]).await;

        let other_fetched = shared::is_url_crawled(&pool, &other_url).await.unwrap();
        assert!(!other_fetched, "depth=0 should not follow outgoing links");
    }
}
