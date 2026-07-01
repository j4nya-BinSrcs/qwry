use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;

/// Spawn a minimal HTTP server that returns a small crawlable site.
/// Returns the base URL.
fn spawn_test_site() -> String {
    let site_html = r###"<!DOCTYPE html>
<html><head><title>Home</title><meta name="description" content="Welcome page"></head>
<body>
<h1>Home</h1>
<p>Welcome to our test site for crawling and indexing.</p>
<a href="/page1">Page One</a>
<a href="/page2">Page Two</a>
<a href="/sub/page3">Sub Page</a>
</body></html>"###;

    let page1 = r###"<!DOCTYPE html>
<html><head><title>Page One</title><meta name="description" content="First content page"></head>
<body>
<h1>Page One</h1>
<p>This is the first page with detailed information about Rust programming and systems development.</p>
<a href="/">Home</a>
<a href="/page2">Page Two</a>
</body></html>"###;

    let page2 = r###"<!DOCTYPE html>
<html><head><title>Page Two</title><meta name="description" content="Second content page"></head>
<body>
<h1>Page Two</h1>
<p>This page discusses Python web frameworks and rapid application development.</p>
<a href="/">Home</a>
<a href="/page1">Page One</a>
</body></html>"###;

    let sub_page3 = r###"<!DOCTYPE html>
<html><head><title>Sub Page</title><meta name="description" content="Nested content"></head>
<body>
<h1>Sub Page</h1>
<p>Deep content about distributed systems and database architecture.</p>
<a href="/">Home</a>
</body></html>"###;

    let pages: Arc<Vec<(String, &str)>> = Arc::new(vec![
        ("/".to_string(), site_html),
        ("/page1".to_string(), page1),
        ("/page2".to_string(), page2),
        ("/sub/page3".to_string(), sub_page3),
    ]);

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let base = format!("http://127.0.0.1:{port}");
    let pages_clone = Arc::clone(&pages);

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let mut stream = match stream {
                Ok(s) => s,
                Err(_) => break,
            };
            let pages = Arc::clone(&pages_clone);
            std::thread::spawn(move || {
                use std::io::{Read, Write};
                let mut buf = [0; 4096];
                if stream.read(&mut buf).is_err() {
                    return;
                }
                let request = String::from_utf8_lossy(&buf);
                let path = request
                    .lines()
                    .next()
                    .and_then(|l| l.split_whitespace().nth(1))
                    .unwrap_or("/");

                let (body, status) = pages
                    .iter()
                    .find(|(p, _)| p == path)
                    .map(|(_, b)| (*b, "200 OK"))
                    .unwrap_or(("<html><body>404</body></html>", "404 Not Found"));

                let response = format!(
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
            });
        }
    });

    base
}

#[tokio::test]
async fn test_full_crawl_index_search_pipeline() -> Result<()> {
    dotenvy::dotenv().ok();

    // 1. Start a local test site
    let base_url = spawn_test_site();
    eprintln!("test server running at {base_url}");

    // 2. Initialise DB connection (creates the table if not exists)
    let pool = shared::init_db().await?;

    // 3. Create a temp directory for the Tantivy index
    let index_dir = std::env::temp_dir()
        .join(format!("qwry-e2e-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&index_dir);

    // 4. Configure and run the crawler
    let config = crawler::core::config::CrawlerConfig {
        max_depth: 2,
        max_pages: 20,
        concurrency: 4,
        politeness_delay: Duration::from_millis(10),
        user_agent: "QwryE2ETest/0.1".into(),
        external_domains: false,
        max_retries: 1,
        retry_base_delay: Duration::from_millis(50),
        skip_politeness: true,
        batch_db_check_size: 10,
    };
    let crawler = crawler::core::engine::Crawler::new(config, pool.clone());
    crawler.run(&[base_url.clone()]).await;

    // 5. Verify pages were crawled and saved to DB
    let home_crawled = shared::is_url_crawled(&pool, &base_url).await?;
    assert!(home_crawled, "home page should be in the database");

    let page1_url = format!("{base_url}/page1");
    let page1_crawled = shared::is_url_crawled(&pool, &page1_url).await?;
    assert!(page1_crawled, "page1 should be in the database");

    let page2_url = format!("{base_url}/page2");
    let page2_crawled = shared::is_url_crawled(&pool, &page2_url).await?;
    assert!(page2_crawled, "page2 should be in the database");

    // 6. Open a Tantivy index and index the crawled pages
    let search_index = indexer::services::index::SearchIndex::open_or_create(&index_dir)?;
    let count = search_index.index_new_pages(&pool).await?;
    assert!(count >= 4, "should have indexed at least 4 pages, got {count}");

    // 7. Search for content from page1
    let result = search_index.search("Rust programming", 10, 0)?;
    assert!(
        result.total_hits >= 1,
        "should find at least 1 match for 'Rust', got {}",
        result.total_hits
    );
    let hits: Vec<&str> = result.hits.iter().map(|h| h.url.as_str()).collect();
    assert!(
        hits.iter().any(|u| u.contains("/page1")),
        "page1 should appear in Rust search results, got: {hits:?}"
    );

    // 8. Search for content from page2
    let result = search_index.search("Python web frameworks", 10, 0)?;
    assert!(
        result.total_hits >= 1,
        "should find at least 1 match for 'Python', got {}",
        result.total_hits
    );
    let hits: Vec<&str> = result.hits.iter().map(|h| h.url.as_str()).collect();
    assert!(
        hits.iter().any(|u| u.contains("/page2")),
        "page2 should appear in Python search results, got: {hits:?}"
    );

    // 9. Search for content from sub/page3
    let result = search_index.search("distributed systems", 10, 0)?;
    assert!(
        result.total_hits >= 1,
        "should find at least 1 match for 'distributed', got {}",
        result.total_hits
    );
    let hits: Vec<&str> = result.hits.iter().map(|h| h.url.as_str()).collect();
    assert!(
        hits.iter().any(|u| u.contains("/sub/page3")),
        "sub/page3 should appear in distributed search results, got: {hits:?}"
    );

    // 10. Verify snippet highlighting works
    let result = search_index.search("Rust", 10, 0)?;
    let snippet = &result.hits[0].snippet;
    assert!(
        snippet.contains("<b>Rust</b>"),
        "snippet should highlight the search term: {snippet}"
    );

    // 11. Verify title and description are stored
    let hit = &result.hits[0];
    assert!(
        hit.title.as_deref() == Some("Page One"),
        "title should be 'Page One', got {:?}",
        hit.title
    );
    assert!(
        hit.description.as_deref() == Some("First content page"),
        "description should be 'First content page', got {:?}",
        hit.description
    );

    // 12. Verify pagination
    let limit = 100; // large enough to return all matches
    let all = search_index.search("page", limit, 0)?;
    assert!(
        all.total_hits >= 2,
        "should find multiple 'page' matches"
    );
    let limited = search_index.search("page", 1, 0)?;
    assert_eq!(
        limited.hits.len(),
        1,
        "limit=1 should return exactly 1 hit"
    );
    let offset = search_index.search("page", limit, 1)?;
    assert!(
        offset.hits.len() < all.hits.len(),
        "offset should reduce hit count relative to no-offset: {} vs {}",
        offset.hits.len(),
        all.hits.len()
    );
    if !offset.hits.is_empty() && all.hits.len() > 1 {
        assert_eq!(
            offset.hits[0].url,
            all.hits[1].url,
            "offset=1 should start from the second result"
        );
    }

    // 13. Search for non-existent content
    let result = search_index.search("xyznonexistentkeyword", 10, 0)?;
    assert_eq!(
        result.total_hits, 0,
        "should find 0 matches for non-existent content"
    );

    // 14. Clean up
    let _ = std::fs::remove_dir_all(&index_dir);
    eprintln!("all e2e pipeline tests passed");

    Ok(())
}
