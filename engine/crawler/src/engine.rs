use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use reqwest::Client;
use shared::DbPool;

use crate::config::CrawlerConfig;
use crate::robots::{fetch_robots_txt, RobotsRules};

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
                    reqwest::header::HeaderValue::from_str(&config.user_agent)
                        .unwrap(),
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

}
