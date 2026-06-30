use shared::*;
use chrono::Utc;

async fn setup() -> DbPool {
    let pool = init_db().await.expect("init_db should succeed");
    // Clear any leftover data from previous test runs
    sqlx::query("DELETE FROM crawled_pages")
        .execute(&pool)
        .await
        .expect("cleanup should succeed");
    pool
}

#[tokio::test]
async fn test_init_db_creates_tables() {
    let pool = setup().await;

    // Verify the table exists by describing it
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'crawled_pages'"
    )
    .fetch_all(&pool)
    .await
    .expect("query should succeed");

    assert_eq!(rows.len(), 1, "crawled_pages table must exist");
    assert_eq!(rows[0].0, "crawled_pages");
}

#[tokio::test]
async fn test_save_and_check_url_crawled() {
    let pool = setup().await;

    let page = CrawledPage {
        id: None,
        url: "https://example.com/test".to_string(),
        title: Some("Test Page".to_string()),
        description: Some("A test page".to_string()),
        content: "Hello, world!".to_string(),
        crawled_at: Utc::now().naive_utc(),
        indexed: false,
    };

    save_page(&pool, &page).await.expect("save_page should succeed");

    let crawled = is_url_crawled(&pool, "https://example.com/test")
        .await
        .expect("is_url_crawled should succeed");
    assert!(crawled, "URL should be marked as crawled");

    let not_crawled = is_url_crawled(&pool, "https://example.com/unknown")
        .await
        .expect("is_url_crawled should succeed");
    assert!(!not_crawled, "Unknown URL should not be crawled");
}

#[tokio::test]
async fn test_upsert_updates_existing_page() {
    let pool = setup().await;

    let page = CrawledPage {
        id: None,
        url: "https://example.com/upsert".to_string(),
        title: Some("Original".to_string()),
        description: None,
        content: "original content".to_string(),
        crawled_at: Utc::now().naive_utc(),
        indexed: false,
    };
    save_page(&pool, &page).await.expect("first save should succeed");

    let updated = CrawledPage {
        id: None,
        url: "https://example.com/upsert".to_string(),
        title: Some("Updated".to_string()),
        description: Some("New description".to_string()),
        content: "updated content".to_string(),
        crawled_at: Utc::now().naive_utc(),
        indexed: true,
    };
    save_page(&pool, &updated).await.expect("second save should succeed");

    // Verify the row was updated by checking indexed status
    let row: (String, Option<String>, bool) = sqlx::query_as(
        "SELECT title, description, indexed FROM crawled_pages WHERE url = $1"
    )
    .bind("https://example.com/upsert")
    .fetch_one(&pool)
    .await
    .expect("fetch should succeed");

    assert_eq!(row.0, "Updated", "title should be updated");
    assert_eq!(row.1, Some("New description".to_string()), "description should be set");
    assert!(row.2, "indexed should be true after update");
}

#[tokio::test]
async fn test_are_urls_crawled_batch() {
    let pool = setup().await;

    let urls = vec![
        "https://example.com/a".to_string(),
        "https://example.com/b".to_string(),
        "https://example.com/c".to_string(),
    ];

    // Save two of the three URLs
    for url in &urls[..2] {
        let page = CrawledPage {
            id: None,
            url: url.clone(),
            title: None,
            description: None,
            content: format!("content for {}", url),
            crawled_at: Utc::now().naive_utc(),
            indexed: false,
        };
        save_page(&pool, &page).await.expect("save should succeed");
    }

    let crawled = are_urls_crawled(&pool, &urls)
        .await
        .expect("are_urls_crawled should succeed");

    assert_eq!(crawled.len(), 2, "two URLs should be crawled");
    assert!(crawled.contains("https://example.com/a"));
    assert!(crawled.contains("https://example.com/b"));
    assert!(!crawled.contains("https://example.com/c"));
}

#[tokio::test]
async fn test_are_urls_crawled_empty() {
    let pool = setup().await;
    let crawled = are_urls_crawled(&pool, &[])
        .await
        .expect("empty input should succeed");
    assert!(crawled.is_empty(), "empty input should return empty set");
}

#[tokio::test]
async fn test_page_counts() {
    let pool = setup().await;

    // Insert pages with mixed indexed status
    for i in 0..5 {
        let page = CrawledPage {
            id: None,
            url: format!("https://example.com/page{}", i),
            title: None,
            description: None,
            content: format!("content {}", i),
            crawled_at: Utc::now().naive_utc(),
            indexed: i < 3, // first 3 indexed, last 2 not
        };
        save_page(&pool, &page).await.expect("save should succeed");
    }

    let total = get_page_count(&pool).await.expect("get_page_count should succeed");
    let indexed = get_indexed_page_count(&pool)
        .await
        .expect("get_indexed_page_count should succeed");

    assert_eq!(total, 5, "total should be 5");
    assert_eq!(indexed, 3, "indexed should be 3");
}

#[tokio::test]
async fn test_save_page_with_null_title_and_description() {
    let pool = setup().await;

    let page = CrawledPage {
        id: None,
        url: "https://example.com/null-fields".to_string(),
        title: None,
        description: None,
        content: "no title or desc".to_string(),
        crawled_at: Utc::now().naive_utc(),
        indexed: false,
    };

    save_page(&pool, &page).await.expect("save with null fields should succeed");

    let row: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT title, description FROM crawled_pages WHERE url = $1"
    )
    .bind("https://example.com/null-fields")
    .fetch_one(&pool)
    .await
    .expect("fetch should succeed");

    assert!(row.0.is_none(), "title should be NULL");
    assert!(row.1.is_none(), "description should be NULL");
}

#[tokio::test]
async fn test_indexed_default_is_false() {
    let pool = setup().await;

    let page = CrawledPage {
        id: None,
        url: "https://example.com/default-indexed".to_string(),
        title: None,
        description: None,
        content: "check default".to_string(),
        crawled_at: Utc::now().naive_utc(),
        indexed: false,
    };
    save_page(&pool, &page).await.expect("save should succeed");

    let indexed: bool = sqlx::query_scalar(
        "SELECT indexed FROM crawled_pages WHERE url = $1"
    )
    .bind("https://example.com/default-indexed")
    .fetch_one(&pool)
    .await
    .expect("fetch should succeed");

    assert!(!indexed, "indexed should default to false");
}

#[tokio::test]
async fn test_concurrent_saves_same_url() {
    let pool = setup().await;

    let page = CrawledPage {
        id: None,
        url: "https://example.com/concurrent".to_string(),
        title: Some("Original".to_string()),
        description: None,
        content: "original".to_string(),
        crawled_at: Utc::now().naive_utc(),
        indexed: false,
    };
    save_page(&pool, &page).await.expect("first save");

    // Simulate concurrent updates by spawning
    let mut handles = vec![];
    for i in 0..5 {
        let p = pool.clone();
        handles.push(tokio::spawn(async move {
            let page = CrawledPage {
                id: None,
                url: "https://example.com/concurrent".to_string(),
                title: Some(format!("Update {}", i)),
                description: None,
                content: format!("content {}", i),
                crawled_at: Utc::now().naive_utc(),
                indexed: true,
            };
            save_page(&p, &page).await
        }));
    }

    for h in handles {
        h.await.expect("join").expect("upsert should succeed");
    }

    // After concurrent upserts, exactly one row should exist
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM crawled_pages WHERE url = $1")
        .bind("https://example.com/concurrent")
        .fetch_one(&pool)
        .await
        .expect("count should succeed");

    assert_eq!(count, 1, "only one row should exist after upsert");
}

#[tokio::test]
async fn test_multiple_unique_urls() {
    let pool = setup().await;

    for i in 0..100 {
        let page = CrawledPage {
            id: None,
            url: format!("https://example.com/multi-{:04}", i),
            title: Some(format!("Page {}", i)),
            description: None,
            content: "content".to_string(),
            crawled_at: Utc::now().naive_utc(),
            indexed: false,
        };
        save_page(&pool, &page).await.expect("save should succeed");
    }

    let total = get_page_count(&pool).await.expect("get_page_count");
    assert_eq!(total, 100, "all 100 unique URLs should be saved");
}
