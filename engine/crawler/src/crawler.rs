use anyhow::{Context, Result};
use reqwest::Client;
use scraper::{Html, Selector};
use shared::DbPool;
use std::{
    collections::{HashSet, VecDeque},
    hash::{DefaultHasher, Hash, Hasher},
    sync::{Mutex, OnceLock},
    time::Duration,
};
use url::Url;

// ---------------------------------------------------------------------------
// CrawlerConfig
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct CrawlerConfig {
    pub max_depth: usize,
    pub max_pages: usize,
    pub concurrency: usize,
    pub politeness_delay: Duration,
    pub user_agent: String,
    pub external_domains: bool,
    pub max_retries: u32,
    pub retry_base_delay: Duration,
    pub skip_politeness: bool,
    pub batch_db_check_size: usize,
}

// ---------------------------------------------------------------------------
// CrawlJob / CrawlResult
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct CrawlJob {
    pub url: String,
    pub depth: usize,
    pub retry_count: u32,
}

#[derive(Debug, Clone)]
pub struct CrawlResult {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub content: String,
    pub outgoing_links: Vec<String>,
}

// ---------------------------------------------------------------------------
// RobotsRules
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct RobotsRules {
    pub disallows: Vec<String>,
    pub crawl_delay: Option<Duration>,
}

impl RobotsRules {
    pub fn is_allowed_by_robots(&self, path: &str) -> bool {
        for disallow in &self.disallows {
            if disallow.is_empty() {
                continue;
            }
            if path.starts_with(disallow) {
                return false;
            }
        }
        true
    }
}

// ---------------------------------------------------------------------------
// ShardedSet – concurrent visited-url set sharded by hash
// ---------------------------------------------------------------------------

pub struct ShardedSet {
    shards: Vec<Mutex<HashSet<String>>>,
    mask: usize,
}

impl ShardedSet {
    pub fn new(num_shards: usize) -> Self {
        let num_shards = num_shards.max(1).next_power_of_two();
        let mut shards = Vec::with_capacity(num_shards);
        for _ in 0..num_shards {
            shards.push(Mutex::new(HashSet::new()));
        }
        Self {
            shards,
            mask: num_shards - 1,
        }
    }

    fn shard_idx(&self, key: &str) -> usize {
        let mut hasher = DefaultHasher::new();
        key.hash(&mut hasher);
        hasher.finish() as usize & self.mask
    }

    pub fn contains(&self, key: &str) -> bool {
        let idx = self.shard_idx(key);
        self.shards[idx].lock().unwrap().contains(key)
    }

    pub fn insert(&self, key: String) -> bool {
        let idx = self.shard_idx(&key);
        self.shards[idx].lock().unwrap().insert(key)
    }

    pub fn len(&self) -> usize {
        self.shards
            .iter()
            .map(|s| s.lock().unwrap().len())
            .sum()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn shard_count(&self) -> usize {
        self.shards.len()
    }
}

// ---------------------------------------------------------------------------
// JobQueue – bounded deque with semaphore-based blocking pop
// ---------------------------------------------------------------------------

pub struct JobQueue {
    inner: Mutex<VecDeque<CrawlJob>>,
    sema: tokio::sync::Semaphore,
}

impl JobQueue {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(VecDeque::new()),
            sema: tokio::sync::Semaphore::new(0),
        }
    }

    pub fn push(&self, job: CrawlJob) {
        self.inner.lock().unwrap().push_back(job);
        self.sema.add_permits(1);
    }

    pub fn push_batch(&self, jobs: Vec<CrawlJob>) {
        let n = jobs.len();
        self.inner.lock().unwrap().extend(jobs);
        self.sema.add_permits(n);
    }

    /// Pop the front job, waiting up to 1 second for one to become available.
    /// Returns `None` on timeout — caller should re-check termination conditions.
    pub async fn pop_or_wait(&self) -> Option<CrawlJob> {
        match tokio::time::timeout(Duration::from_secs(1), self.sema.acquire()).await {
            Ok(Ok(permit)) => {
                permit.forget();
                self.inner.lock().unwrap().pop_front()
            }
            _ => None,
        }
    }

    pub fn len(&self) -> usize {
        self.inner.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

// ---------------------------------------------------------------------------
// Selector helpers (lazily initialised once)
// ---------------------------------------------------------------------------

fn sel_a_href() -> &'static Selector {
    static SEL: OnceLock<Selector> = OnceLock::new();
    SEL.get_or_init(|| Selector::parse("a[href]").expect("a[href] selector"))
}

fn sel_title() -> &'static Selector {
    static SEL: OnceLock<Selector> = OnceLock::new();
    SEL.get_or_init(|| Selector::parse("title").expect("title selector"))
}

fn sel_description() -> &'static Selector {
    static SEL: OnceLock<Selector> = OnceLock::new();
    SEL.get_or_init(|| {
        Selector::parse("meta[name='description']").expect("meta description selector")
    })
}

fn sel_content_root() -> &'static Selector {
    static SEL: OnceLock<Selector> = OnceLock::new();
    SEL.get_or_init(|| {
        Selector::parse("main, article, body").expect("content root selector")
    })
}

// ---------------------------------------------------------------------------
// HTML constants
// ---------------------------------------------------------------------------

const SKIP_TAGS: &[&str] = &[
    "script", "style", "nav", "footer", "header", "noscript", "iframe",
    "svg", "form", "button", "aside", "select", "option", "input",
    "textarea", "label", "canvas",
];

const EXTENSION_BLOCKLIST: &[&str] = &[
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".css", ".js", ".json", ".xml", ".rss", ".atom",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv",
    ".woff", ".woff2", ".ttf", ".eot",
];

fn is_block_tag(tag: &str) -> bool {
    matches!(
        tag,
        "address"
            | "article"
            | "aside"
            | "blockquote"
            | "dd"
            | "details"
            | "dialog"
            | "div"
            | "dl"
            | "dt"
            | "figcaption"
            | "figure"
            | "footer"
            | "form"
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6"
            | "header"
            | "hr"
            | "li"
            | "main"
            | "nav"
            | "ol"
            | "p"
            | "pre"
            | "section"
            | "table"
            | "tfoot"
            | "ul"
    )
}

// ---------------------------------------------------------------------------
// URL normalisation
// ---------------------------------------------------------------------------

/// Resolve `href` against `base_url`, strip fragment, and validate scheme.
pub fn normalize_url(href: &str, base_url: &Url) -> Result<String> {
    let parsed = base_url.join(href).context("URL join failed")?;

    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        anyhow::bail!("Unsupported scheme: {scheme}");
    }

    let mut result = Url::parse(&parsed.as_str().trim_end_matches('#')).unwrap();
    result.set_fragment(None);
    Ok(result.into())
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

pub fn extract_title(doc: &Html) -> Option<String> {
    let title = doc.select(sel_title()).next()?;
    let text = title.text().collect::<String>();
    let trimmed = text.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

// ---------------------------------------------------------------------------
// Meta-description extraction
// ---------------------------------------------------------------------------

pub fn extract_description(doc: &Html) -> Option<String> {
    let meta = doc.select(sel_description()).next()?;
    let content = meta.value().attr("content")?;
    let trimmed = content.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

// ---------------------------------------------------------------------------
// Clean text extraction (recursive DOM walker)
// ---------------------------------------------------------------------------

fn collect_text(node: ego_tree::NodeRef<'_, scraper::node::Node>, buf: &mut String) {
    match node.value() {
        scraper::node::Node::Text(t) => {
            let text = t.text.trim();
            if !text.is_empty() {
                if !buf.is_empty() && !buf.ends_with(' ') && !buf.ends_with('\n') {
                    buf.push(' ');
                }
                buf.push_str(text);
            }
        }
        scraper::node::Node::Element(e) => {
            let tag = e.name();
            if SKIP_TAGS.contains(&tag) {
                return;
            }
            let block = is_block_tag(tag);
            if block && !buf.is_empty() && !buf.ends_with('\n') {
                buf.push('\n');
            }
            for child in node.children() {
                collect_text(child, buf);
            }
            if block && !buf.is_empty() && !buf.ends_with('\n') {
                buf.push('\n');
            }
        }
        _ => {}
    }
}

fn collapse_whitespace(s: &str) -> String {
    let s = s.trim();
    let mut result = String::with_capacity(s.len());
    let mut prev_was_space = false;

    for ch in s.chars() {
        match ch {
            '\n' => {
                if !result.ends_with('\n') {
                    result.push('\n');
                }
                prev_was_space = false;
            }
            c if c.is_whitespace() => {
                if !prev_was_space && !result.ends_with('\n') {
                    result.push(' ');
                    prev_was_space = true;
                }
            }
            c => {
                result.push(c);
                prev_was_space = false;
            }
        }
    }

    result
}

pub fn extract_clean_text(doc: &Html) -> String {
    let root_sel = sel_content_root();
    let root_node = match doc.select(root_sel).next() {
        Some(el) => doc.tree.get(el.id()),
        None => doc.tree.root().children().next(),
    };

    let Some(root) = root_node else {
        return String::new();
    };

    let mut buf = String::new();
    for child in root.children() {
        collect_text(child, &mut buf);
    }
    collapse_whitespace(&buf)
}

// ---------------------------------------------------------------------------
// Link extraction
// ---------------------------------------------------------------------------

pub fn extract_links(doc: &Html, base_url: &Url, allow_external: bool) -> Vec<String> {
    let mut links: Vec<String> = Vec::new();

    for el in doc.select(sel_a_href()) {
        let href = match el.value().attr("href") {
            Some(h) => h,
            None => continue,
        };

        let normalized = match normalize_url(href, base_url) {
            Ok(u) => u,
            Err(_) => continue,
        };

        if !allow_external {
            let parsed = match Url::parse(&normalized) {
                Ok(u) => u,
                Err(_) => continue,
            };
            let base_host = base_url.host_str().unwrap_or("");
            let link_host = parsed.host_str().unwrap_or("");
            let same_host = link_host == base_host
                || link_host.ends_with(&format!(".{}", base_host));
            if !same_host {
                continue;
            }
        }

        let parsed_url = match Url::parse(&normalized) {
            Ok(u) => u,
            Err(_) => continue,
        };
        let path = parsed_url.path();
        if EXTENSION_BLOCKLIST
            .iter()
            .any(|ext| path.ends_with(ext) || path.to_lowercase().ends_with(ext))
        {
            continue;
        }

        links.push(normalized);
    }

    links.sort();
    links.dedup();
    links
}

// ---------------------------------------------------------------------------
// HTTP fetch + HTML parse
// ---------------------------------------------------------------------------

pub async fn fetch_page(
    client: &Client,
    url_str: &str,
    allow_external: bool,
) -> Result<CrawlResult> {
    let resp = client.get(url_str).send().await?;
    resp.error_for_status_ref().context("HTTP error status")?;

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !content_type.contains("text/html") {
        anyhow::bail!("Non-HTML content type: {content_type}");
    }

    let body = resp.text().await?;
    let doc = Html::parse_document(&body);
    let base_url = Url::parse(url_str)?;

    let title = extract_title(&doc);
    let description = extract_description(&doc);
    let content = extract_clean_text(&doc);
    let outgoing_links = extract_links(&doc, &base_url, allow_external);

    Ok(CrawlResult {
        url: url_str.to_string(),
        title,
        description,
        content,
        outgoing_links,
    })
}

// ---------------------------------------------------------------------------
// Crawler – top-level struct
// ---------------------------------------------------------------------------

pub struct Crawler {
    config: CrawlerConfig,
    db_pool: DbPool,
    client: Client,
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
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    // --- CrawlerConfig -----------------------------------------------------

    #[test]
    fn test_crawler_config_defaults() {
        let config = CrawlerConfig {
            max_depth: 3,
            max_pages: 100,
            concurrency: 10,
            politeness_delay: Duration::from_millis(500),
            user_agent: "QwryBot/0.1".into(),
            external_domains: false,
            max_retries: 3,
            retry_base_delay: Duration::from_secs(5),
            skip_politeness: false,
            batch_db_check_size: 100,
        };
        assert_eq!(config.max_depth, 3);
        assert_eq!(config.max_pages, 100);
        assert_eq!(config.concurrency, 10);
        assert!(!config.external_domains);
    }

    // --- CrawlJob -----------------------------------------------------------

    #[test]
    fn test_crawl_job_construction() {
        let job = CrawlJob {
            url: "https://example.com".into(),
            depth: 0,
            retry_count: 0,
        };
        assert_eq!(job.url, "https://example.com");
        assert_eq!(job.depth, 0);
        assert_eq!(job.retry_count, 0);
    }

    // --- CrawlResult --------------------------------------------------------

    #[test]
    fn test_crawl_result_construction() {
        let result = CrawlResult {
            url: "https://example.com".into(),
            title: Some("Example".into()),
            description: None,
            content: "page body".into(),
            outgoing_links: vec!["https://example.com/a".into()],
        };
        assert_eq!(result.title.unwrap(), "Example");
        assert!(result.description.is_none());
        assert_eq!(result.outgoing_links.len(), 1);
    }

    // --- RobotsRules --------------------------------------------------------

    #[test]
    fn test_robots_rules_allows_everything_when_empty() {
        let rules = RobotsRules {
            disallows: vec![],
            crawl_delay: None,
        };
        assert!(rules.is_allowed_by_robots("/any/path"));
    }

    #[test]
    fn test_robots_rules_blocks_disallowed_path() {
        let rules = RobotsRules {
            disallows: vec!["/private".into(), "/hidden".into()],
            crawl_delay: None,
        };
        assert!(!rules.is_allowed_by_robots("/private"));
        assert!(!rules.is_allowed_by_robots("/private/file"));
        assert!(!rules.is_allowed_by_robots("/hidden"));
        assert!(rules.is_allowed_by_robots("/public"));
        assert!(rules.is_allowed_by_robots("/"));
    }

    #[test]
    fn test_robots_rules_ignores_empty_disallow_entry() {
        let rules = RobotsRules {
            disallows: vec!["".into()],
            crawl_delay: None,
        };
        assert!(rules.is_allowed_by_robots("/anything"));
    }

    #[test]
    fn test_robots_rules_crawl_delay() {
        let rules = RobotsRules {
            disallows: vec![],
            crawl_delay: Some(Duration::from_secs(5)),
        };
        assert_eq!(rules.crawl_delay, Some(Duration::from_secs(5)));
    }

    // --- ShardedSet ---------------------------------------------------------

    #[test]
    fn test_sharded_set_new_rounds_to_power_of_two() {
        let set = ShardedSet::new(10);
        assert_eq!(set.shard_count(), 16);

        let set = ShardedSet::new(1);
        assert_eq!(set.shard_count(), 1);

        let set = ShardedSet::new(0);
        assert_eq!(set.shard_count(), 1);
    }

    #[test]
    fn test_sharded_set_insert_and_contains() {
        let set = ShardedSet::new(8);
        assert!(set.insert("https://example.com".into()));
        assert!(set.contains("https://example.com"));
        assert!(!set.contains("https://other.com"));
    }

    #[test]
    fn test_sharded_set_insert_returns_false_for_duplicates() {
        let set = ShardedSet::new(8);
        assert!(set.insert("https://example.com".into()));
        assert!(!set.insert("https://example.com".into()));
    }

    #[test]
    fn test_sharded_set_len() {
        let set = ShardedSet::new(8);
        assert_eq!(set.len(), 0);
        assert!(set.is_empty());

        set.insert("a".into());
        set.insert("b".into());
        set.insert("c".into());
        assert_eq!(set.len(), 3);
        assert!(!set.is_empty());
    }

    #[test]
    fn test_sharded_set_distribution() {
        let set = ShardedSet::new(8);
        // Insert enough keys to exercise all shards
        for i in 0..256 {
            set.insert(format!("https://page-{}.com", i));
        }

        // Every shard should have at least one entry (very unlikely to fail with 256 keys)
        for (i, shard) in set.shards.iter().enumerate() {
            assert!(
                !shard.lock().unwrap().is_empty(),
                "shard {} should not be empty",
                i
            );
        }
    }

    #[tokio::test]
    async fn test_sharded_set_concurrent_inserts() {
        let set = Arc::new(ShardedSet::new(64));
        let mut handles = Vec::new();

        for i in 0..100 {
            let s = Arc::clone(&set);
            handles.push(tokio::spawn(async move {
                s.insert(format!("https://page-{}.com", i));
            }));
        }

        for h in handles {
            h.await.unwrap();
        }

        assert_eq!(set.len(), 100);
        assert!(set.contains("https://page-42.com"));
    }

    #[tokio::test]
    async fn test_sharded_set_no_duplicates_under_concurrency() {
        let set = Arc::new(ShardedSet::new(64));
        let mut handles = Vec::new();

        // 10 writers all try to insert the same 10 URLs
        for _ in 0..10 {
            let s = Arc::clone(&set);
            handles.push(tokio::spawn(async move {
                for i in 0..10 {
                    s.insert(format!("https://page-{}.com", i));
                }
            }));
        }

        for h in handles {
            h.await.unwrap();
        }

        assert_eq!(set.len(), 10, "only 10 unique URLs out of 100 attempts");
    }

    // --- JobQueue -----------------------------------------------------------

    #[tokio::test]
    async fn test_job_queue_push_and_pop() {
        let queue = JobQueue::new();
        assert!(queue.is_empty());
        assert_eq!(queue.len(), 0);

        queue.push(CrawlJob {
            url: "https://example.com".into(),
            depth: 0,
            retry_count: 0,
        });

        assert_eq!(queue.len(), 1);

        let job = queue.pop_or_wait().await;
        assert!(job.is_some());
        assert_eq!(job.unwrap().url, "https://example.com");
        assert!(queue.is_empty());
    }

    #[tokio::test]
    async fn test_job_queue_fifo_order() {
        let queue = JobQueue::new();

        for i in 0..5 {
            queue.push(CrawlJob {
                url: format!("https://page-{}.com", i),
                depth: i,
                retry_count: 0,
            });
        }

        for i in 0..5 {
            let job = queue.pop_or_wait().await;
            assert!(job.is_some());
            assert_eq!(job.unwrap().depth, i, "jobs should be dequeued in FIFO order");
        }
    }

    #[tokio::test]
    async fn test_job_queue_push_batch() {
        let queue = JobQueue::new();
        let jobs: Vec<CrawlJob> = (0..10)
            .map(|i| CrawlJob {
                url: format!("https://page-{}.com", i),
                depth: i,
                retry_count: 0,
            })
            .collect();

        queue.push_batch(jobs);
        assert_eq!(queue.len(), 10);

        for i in 0..10 {
            let job = queue.pop_or_wait().await;
            assert!(job.is_some());
            assert_eq!(job.unwrap().depth, i, "batch should preserve order");
        }
    }

    #[tokio::test]
    async fn test_job_queue_pop_or_wait_timeout_on_empty() {
        let queue = JobQueue::new();
        let job = queue.pop_or_wait().await;
        assert!(job.is_none(), "pop from empty queue should return None after timeout");
    }

    #[tokio::test]
    async fn test_job_queue_multiple_push_and_drain() {
        let queue = JobQueue::new();

        queue.push(CrawlJob {
            url: "first".into(),
            depth: 0,
            retry_count: 0,
        });

        let first = queue.pop_or_wait().await;
        assert_eq!(first.unwrap().url, "first");

        // Push after draining
        queue.push(CrawlJob {
            url: "second".into(),
            depth: 0,
            retry_count: 0,
        });

        let second = queue.pop_or_wait().await;
        assert_eq!(second.unwrap().url, "second");
    }

    #[tokio::test]
    async fn test_job_queue_len_empty_after_drain() {
        let queue = JobQueue::new();
        queue.push(CrawlJob {
            url: "url".into(),
            depth: 0,
            retry_count: 0,
        });
        queue.pop_or_wait().await;
        assert!(queue.is_empty());
    }

    // --- normalize_url -----------------------------------------------------

    #[test]
    fn test_normalize_url_relative() {
        let base = Url::parse("https://example.com/dir/").unwrap();
        let result = normalize_url("/page", &base).unwrap();
        assert_eq!(result, "https://example.com/page");
    }

    #[test]
    fn test_normalize_url_absolute() {
        let base = Url::parse("https://example.com/dir/").unwrap();
        let result = normalize_url("https://other.com/page", &base).unwrap();
        assert_eq!(result, "https://other.com/page");
    }

    #[test]
    fn test_normalize_url_strips_fragment() {
        let base = Url::parse("https://example.com/").unwrap();
        let result = normalize_url("/page#section", &base).unwrap();
        assert_eq!(result, "https://example.com/page");
    }

    #[test]
    fn test_normalize_url_rejects_javascript() {
        let base = Url::parse("https://example.com/").unwrap();
        let result = normalize_url("javascript:void(0)", &base);
        assert!(result.is_err());
    }

    #[test]
    fn test_normalize_url_rejects_mailto() {
        let base = Url::parse("https://example.com/").unwrap();
        let result = normalize_url("mailto:user@example.com", &base);
        assert!(result.is_err());
    }

    #[test]
    fn test_normalize_url_preserves_query_params() {
        let base = Url::parse("https://example.com/").unwrap();
        let result = normalize_url("/page?q=hello&n=1", &base).unwrap();
        assert_eq!(result, "https://example.com/page?q=hello&n=1");
    }

    #[test]
    fn test_normalize_url_protocol_relative() {
        let base = Url::parse("https://example.com/").unwrap();
        // "//other.com/path" resolves against the scheme of the base URL
        let result = normalize_url("//other.com/path", &base).unwrap();
        assert_eq!(result, "https://other.com/path");
    }

    #[test]
    fn test_normalize_url_relative_no_leading_slash() {
        let base = Url::parse("https://example.com/dir/page.html").unwrap();
        let result = normalize_url("other", &base).unwrap();
        assert_eq!(result, "https://example.com/dir/other");
    }

    #[test]
    fn test_normalize_url_relative_up_dir() {
        let base = Url::parse("https://example.com/a/b/c.html").unwrap();
        let result = normalize_url("../other", &base).unwrap();
        assert_eq!(result, "https://example.com/a/other");
    }

    // --- extract_title -----------------------------------------------------

    #[test]
    fn test_extract_title_basic() {
        let html = r#"<html><head><title>Hello World</title></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_title(&doc), Some("Hello World".into()));
    }

    #[test]
    fn test_extract_title_none() {
        let html = r#"<html><head></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_title(&doc), None);
    }

    #[test]
    fn test_extract_title_with_whitespace() {
        let html = r#"<html><head><title>   Spaced Title   </title></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_title(&doc), Some("Spaced Title".into()));
    }

    #[test]
    fn test_extract_title_nested_tags() {
        // scraper resolves nested tags in title.text() by concatenating
        let html = r#"<html><head><title>Hello <b>World</b></title></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        let title = extract_title(&doc);
        assert!(title.is_some());
        let t = title.unwrap();
        assert!(t.contains("Hello"), "title should contain 'Hello', got: {t:?}");
        assert!(t.contains("World"), "title should contain 'World', got: {t:?}");
    }

    #[test]
    fn test_extract_title_empty() {
        let html = r#"<html><head><title>  </title></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_title(&doc), None);
    }

    // --- extract_description ------------------------------------------------

    #[test]
    fn test_extract_description_basic() {
        let html = r#"<html><head><meta name="description" content="A test page"></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), Some("A test page".into()));
    }

    #[test]
    fn test_extract_description_none() {
        let html = r#"<html><head></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), None);
    }

    #[test]
    fn test_extract_description_with_whitespace() {
        let html = r#"<html><head><meta name="description" content="   Desc with spaces   "></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), Some("Desc with spaces".into()));
    }

    #[test]
    fn test_extract_description_other_meta_ignored() {
        let html = r#"<html><head><meta name="keywords" content="kw1,kw2"><meta name="description" content="real desc"></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), Some("real desc".into()));
    }

    #[test]
    fn test_extract_description_empty_content() {
        let html = r#"<html><head><meta name="description" content="   "></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), None);
    }

    #[test]
    fn test_extract_description_missing_content_attr() {
        let html = r#"<html><head><meta name="description"></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), None);
    }

    // --- extract_clean_text ------------------------------------------------

    #[test]
    fn test_clean_text_basic_paragraph() {
        let html = r#"<html><body><p>Hello World</p></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "Hello World");
    }

    #[test]
    fn test_clean_text_removes_script() {
        let html = r#"<html><body><p>Visible</p><script>alert("hidden")</script><p>Also visible</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert!(text.contains("Visible"));
        assert!(text.contains("Also visible"));
        assert!(!text.contains("hidden"), "script content should be removed");
    }

    #[test]
    fn test_clean_text_removes_style() {
        let html = r#"<html><head><style>body { color: red; }</style></head><body><p>Visible</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Visible");
        assert!(!text.contains("color: red"), "style content should be removed");
    }

    #[test]
    fn test_clean_text_removes_nav() {
        let html = r#"<html><body><nav><a href="/">Home</a><a href="/about">About</a></nav><main><p>Content</p></main></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert!(text.contains("Content"));
        assert!(!text.contains("Home"), "nav content should be removed");
        assert!(!text.contains("About"), "nav content should be removed");
    }

    #[test]
    fn test_clean_text_removes_footer() {
        let html = r#"<html><body><main><p>Main content</p></main><footer><p>Footer</p></footer></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Main content");
    }

    #[test]
    fn test_clean_text_block_elements_produce_newlines() {
        let html = r#"<html><body><p>First paragraph</p><p>Second paragraph</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "First paragraph\nSecond paragraph");
    }

    #[test]
    fn test_clean_text_collapses_whitespace() {
        let html = r#"<html><body><p>Hello    World</p></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "Hello World");
    }

    #[test]
    fn test_clean_text_multiple_paragraphs() {
        let html = r#"<html><body><h1>Title</h1><p>First</p><p>Second</p><p>Third</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Title\nFirst\nSecond\nThird");
    }

    #[test]
    fn test_clean_text_nested_elements() {
        let html = r#"<html><body><div><p>Nested <b>text</b> here</p></div></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "Nested text here");
    }

    #[test]
    fn test_clean_text_empty_body() {
        let html = r#"<html><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "");
    }

    #[test]
    fn test_clean_text_uses_main_over_body() {
        let html = r#"<html><body><nav>nav text</nav><main>main content</main><footer>footer text</footer></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        // main is selected as the content root → nav and footer are excluded
        assert_eq!(text, "main content");
    }

    #[test]
    fn test_clean_text_removes_sidebar_aside() {
        let html = r#"<html><body><main><p>Article content</p></main><aside><p>Sidebar</p></aside></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Article content");
    }

    #[test]
    fn test_clean_text_multiple_headings() {
        let html = r#"<html><body><h1>Heading 1</h1><p>Text 1</p><h2>Heading 2</h2><p>Text 2</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Heading 1\nText 1\nHeading 2\nText 2");
    }

    #[test]
    fn test_clean_text_heading_with_inline_elements() {
        let html = r#"<html><body><h1>Hello <em>World</em></h1><p>Content</p></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "Hello World\nContent");
    }

    // --- extract_links -----------------------------------------------------

    #[test]
    fn test_extract_links_basic() {
        let html = r#"<html><body><a href="/page1">Page 1</a><a href="/page2">Page 2</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0], "https://example.com/page1");
        assert_eq!(links[1], "https://example.com/page2");
    }

    #[test]
    fn test_extract_links_relative_resolved() {
        let html = r#"<html><body><a href="page">Link</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/dir/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/dir/page"]);
    }

    #[test]
    fn test_extract_links_filters_external_when_disallowed() {
        let html = r#"<html><body><a href="https://external.com/page">External</a><a href="/internal">Internal</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/internal"]);
    }

    #[test]
    fn test_extract_links_includes_external_when_allowed() {
        let html = r#"<html><body><a href="https://external.com/page">External</a><a href="/internal">Internal</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, true);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0], "https://example.com/internal");
        assert_eq!(links[1], "https://external.com/page");
    }

    #[test]
    fn test_extract_links_filters_extension_blocklist() {
        let html = r#"<html><body>
            <a href="/page">Page</a>
            <a href="/image.png">Image</a>
            <a href="/doc.pdf">PDF</a>
            <a href="/style.css">CSS</a>
            <a href="/script.js">JS</a>
        </body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/page"]);
    }

    #[test]
    fn test_extract_links_filters_case_insensitive_extension() {
        let html = r#"<html><body>
            <a href="/image.PNG">Image</a>
            <a href="/page">Page</a>
        </body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/page"]);
    }

    #[test]
    fn test_extract_links_dedup() {
        let html = r#"<html><body>
            <a href="/page">Page 1</a>
            <a href="/page">Page 2</a>
            <a href="/other">Other</a>
        </body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec![
            "https://example.com/other",
            "https://example.com/page",
        ]);
    }

    #[test]
    fn test_extract_links_sorted() {
        let html = r#"<html><body>
            <a href="/z">Z</a>
            <a href="/a">A</a>
            <a href="/m">M</a>
        </body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec![
            "https://example.com/a",
            "https://example.com/m",
            "https://example.com/z",
        ]);
    }

    #[test]
    fn test_extract_links_none() {
        let html = r#"<html><body><p>No links here</p></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert!(links.is_empty());
    }

    #[test]
    fn test_extract_links_no_href_ignored() {
        let html = r#"<html><body><a>No href</a><a href="/ok">OK</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/ok"]);
    }

    #[test]
    fn test_extract_links_filters_javascript_href() {
        let html = r#"<html><body><a href="javascript:void(0)">JS</a><a href="/real">Real</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/real"]);
    }

    #[test]
    fn test_extract_links_subdomain_same_host() {
        let html = r#"<html><body><a href="https://sub.example.com/page">Sub</a><a href="/internal">Internal</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        // sub.example.com ends with .example.com so it should be included
        assert_eq!(links.len(), 2);
        assert_eq!(links[0], "https://example.com/internal");
        assert_eq!(links[1], "https://sub.example.com/page");
    }

    // --- Crawler top-level --------------------------------------------------
    // Construction with a real DbPool is tested in the integration suite.
}
