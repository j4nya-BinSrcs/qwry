use anyhow::Result;
use serde::{Deserialize, Serialize};
use tantivy::collector::{Count, TopDocs};
use tantivy::query::QueryParser;
use tantivy::schema::Value;
use tantivy::snippet::SnippetGenerator;
use tantivy::TantivyDocument;

use crate::index::SearchIndex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub snippet: String,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub total_hits: usize,
    pub hits: Vec<SearchHit>,
    pub query: String,
    pub limit: usize,
    pub offset: usize,
}

impl SearchIndex {
    pub fn search(
        &self,
        query_str: &str,
        limit: usize,
        offset: usize,
    ) -> Result<SearchResponse> {
        self.reader.reload()?;
        let searcher = self.reader.searcher();

        let mut query_parser = QueryParser::for_index(
            &self.index,
            vec![self.title_field, self.desc_field, self.content_field],
        );
        query_parser.set_field_boost(self.title_field, 2.5);
        query_parser.set_field_boost(self.desc_field, 1.5);
        query_parser.set_field_boost(self.content_field, 1.0);

        let query = query_parser.parse_query(query_str)?;

        let collector = (TopDocs::with_limit(limit + offset), Count);
        let (top_docs, total_hits) = searcher.search(&query, &collector)?;

        let snippet_generator =
            SnippetGenerator::create(&searcher, &query, self.content_field)?;

        let fetch_limit = std::cmp::min(offset + limit, top_docs.len());
        let hits: Vec<SearchHit> = top_docs[offset..fetch_limit]
            .iter()
            .filter_map(|(score, doc_address)| {
                let doc: TantivyDocument = searcher.doc(*doc_address).ok()?;
                let snippet = snippet_generator.snippet_from_doc(&doc);
                let url = doc
                    .get_first(self.url_field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let title = doc
                    .get_first(self.title_field)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let description = doc
                    .get_first(self.desc_field)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                Some(SearchHit {
                    url,
                    title,
                    description,
                    snippet: snippet.to_html(),
                    score: *score,
                })
            })
            .collect();

        Ok(SearchResponse {
            total_hits,
            hits,
            query: query_str.to_string(),
            limit,
            offset,
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::index::SearchIndex;
    use shared::{init_db, CrawledPage, DbPool};
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU32, Ordering};

    static TEST_COUNTER: AtomicU32 = AtomicU32::new(0);

    fn temp_index_dir() -> PathBuf {
        let n = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir()
            .join(format!("qwry-search-test-{}-{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    async fn test_pool() -> DbPool {
        dotenvy::dotenv().ok();
        init_db().await.unwrap()
    }

    async fn insert_page(pool: &DbPool, url: &str, title: &str, content: &str) {
        let page = CrawledPage {
            id: None,
            url: url.into(),
            title: Some(title.into()),
            description: None,
            content: content.into(),
            crawled_at: chrono::Utc::now().naive_utc(),
            indexed: false,
        };
        shared::save_page(pool, &page).await.unwrap();
    }

    #[tokio::test]
    async fn test_search_returns_matching_results() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = SearchIndex::open_or_create(&dir).unwrap();

        insert_page(&pool, "https://rust-lang.org", "Rust Programming", "Rust is a systems programming language focused on safety and performance.").await;
        insert_page(&pool, "https://python.org", "Python Language", "Python is a high-level programming language.").await;

        idx.index_new_pages(&pool).await.unwrap();

        let response = idx.search("rust", 10, 0).unwrap();
        assert!(response.total_hits >= 1, "should find at least 'rust' page");
        assert!(
            response.hits.iter().any(|h| h.url.contains("rust-lang")),
            "rust-lang should be in results"
        );
    }

    #[tokio::test]
    async fn test_search_returns_empty_for_no_match() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = SearchIndex::open_or_create(&dir).unwrap();

        insert_page(&pool, "https://example.com/zebra", "Zebra Animal", "Zebras are African equines.").await;
        idx.index_new_pages(&pool).await.unwrap();

        let response = idx.search("quantum", 10, 0).unwrap();
        assert_eq!(response.total_hits, 0);
        assert!(response.hits.is_empty());
    }

    #[tokio::test]
    async fn test_search_respects_limit() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = SearchIndex::open_or_create(&dir).unwrap();

        for i in 0..10 {
            let url = format!("https://limit-test-{i}.example");
            insert_page(&pool, &url, "Limit Test", "testing pagination feature with multiple pages").await;
        }
        idx.index_new_pages(&pool).await.unwrap();

        let response = idx.search("testing", 3, 0).unwrap();
        assert_eq!(response.hits.len(), 3, "limit=3 should return 3 hits");
    }

    #[tokio::test]
    async fn test_search_respects_offset() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = SearchIndex::open_or_create(&dir).unwrap();

        for i in 0..5 {
            let url = format!("https://offset-test-{i}.example");
            insert_page(&pool, &url, "Offset Test", "same body text for all offset test pages").await;
        }
        idx.index_new_pages(&pool).await.unwrap();

        let all = idx.search("offset", 10, 0).unwrap();
        let offset = idx.search("offset", 10, 3).unwrap();

        assert_eq!(offset.hits.len(), all.hits.len().saturating_sub(3));
        if !offset.hits.is_empty() {
            assert_eq!(offset.hits[0].url, all.hits[3].url, "offset should skip first 3");
        }
    }

    #[tokio::test]
    async fn test_search_snippet_highlights_match() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = SearchIndex::open_or_create(&dir).unwrap();

        insert_page(
            &pool,
            "https://snippet-test.example",
            "Snippet Test",
            "The quick brown fox jumps over the lazy dog near the riverbank.",
        )
        .await;
        idx.index_new_pages(&pool).await.unwrap();

        let response = idx.search("fox", 10, 0).unwrap();
        assert!(
            !response.hits.is_empty(),
            "should find the snippet test page"
        );
        let snippet = &response.hits[0].snippet;
        assert!(
            snippet.contains("fox"),
            "snippet should contain the search term: {snippet}"
        );
    }
}
