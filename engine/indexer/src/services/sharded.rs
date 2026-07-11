use std::collections::HashMap;
use std::path::Path;

use anyhow::{Context, Result};
use rayon::prelude::*;
use shared::{mark_pages_as_indexed, CrawledPage, DbPool};
use tantivy::schema::Value;

use crate::services::index::SearchIndex;
use crate::services::search::{SearchHit, SearchResponse};

pub struct ShardedIndex {
    shards: Vec<SearchIndex>,
    num_shards: usize,
}

impl ShardedIndex {
    pub fn open_or_create(index_dir: &Path, num_shards: usize) -> Result<Self> {
        let num_shards = num_shards.next_power_of_two().max(1);

        let shards: Vec<SearchIndex> = if num_shards == 1 {
            std::fs::create_dir_all(index_dir)?;
            vec![SearchIndex::open_or_create(index_dir)?]
        } else {
            (0..num_shards)
                .map(|i| {
                    let dir = index_dir.join(format!("shard-{i}"));
                    std::fs::create_dir_all(&dir)?;
                    SearchIndex::open_or_create(&dir)
                })
                .collect::<Result<_>>()?
        };

        Ok(ShardedIndex { shards, num_shards })
    }

    fn shard_for(&self, url: &str) -> usize {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        url.hash(&mut hasher);
        let hash = hasher.finish();
        (hash as usize) & (self.num_shards - 1)
    }

    pub fn writer(&self, shard_id: usize) -> Result<tantivy::IndexWriter> {
        self.shards[shard_id].writer()
    }

    pub async fn index_new_pages(&self, db_pool: &DbPool) -> Result<usize> {
        let pages = shared::get_unindexed_pages(db_pool)
            .await
            .context("Failed to query unindexed pages")?;

        if pages.is_empty() {
            return Ok(0);
        }

        let count = pages.len();

        let mut shard_buckets: HashMap<usize, Vec<&CrawledPage>> = HashMap::new();
        for page in &pages {
            let sid = self.shard_for(&page.url);
            shard_buckets.entry(sid).or_default().push(page);
        }

        let ids: Vec<i64> = pages.iter().filter_map(|p| p.id).collect();

        let results: Vec<Result<()>> = (0..self.num_shards)
            .into_par_iter()
            .map(|sid| -> Result<()> {
                let Some(bucket) = shard_buckets.get(&sid) else {
                    return Ok(());
                };
                let mut writer = self.shards[sid].writer()?;
                for page in bucket {
                    let term = tantivy::Term::from_field_text(
                        self.shards[sid].url_field,
                        &page.url,
                    );
                    writer.delete_term(term);
                    let doc = self.shards[sid].page_to_doc(page);
                    writer.add_document(doc)?;
                }
                writer.commit()?;
                Ok(())
            })
            .collect();

        for r in results {
            r?;
        }

        mark_pages_as_indexed(db_pool, &ids)
            .await
            .context("Failed to mark pages as indexed")?;

        Ok(count)
    }

    pub async fn reindex_all_pages(&self, db_pool: &DbPool) -> Result<usize> {
        shared::reset_indexed_flag(db_pool)
            .await
            .context("Failed to reset indexed flag")?;

        let results: Vec<Result<()>> = (0..self.num_shards)
            .into_par_iter()
            .map(|sid| -> Result<()> {
                let mut writer = self.shards[sid].writer()?;
                writer.delete_all_documents()?;
                writer.commit()?;
                Ok(())
            })
            .collect();

        for r in results {
            r?;
        }

        let count = self.index_new_pages(db_pool).await?;
        Ok(count)
    }

    pub fn search(
        &self,
        query_str: &str,
        limit: usize,
        offset: usize,
    ) -> Result<SearchResponse> {
        if self.num_shards == 1 {
            return self.shards[0].search(query_str, limit, offset);
        }

        let per_shard_limit = limit + offset;

        struct ShardSearchResult {
            hits: Vec<(f32, tantivy::DocAddress)>,
            total_hits: usize,
            searcher: tantivy::Searcher,
            snippet_generator: tantivy::snippet::SnippetGenerator,
            shard_id: usize,
        }

        let shard_results: Vec<ShardSearchResult> = (0..self.num_shards)
            .into_par_iter()
            .map(|sid| -> Result<ShardSearchResult> {
                let shard = &self.shards[sid];
                let _ = shard.reader.reload();
                let searcher = shard.reader.searcher();

                let mut query_parser = tantivy::query::QueryParser::for_index(
                    &shard.index,
                    vec![shard.title_field, shard.desc_field, shard.content_field],
                );
                query_parser.set_field_boost(shard.title_field, 2.5);
                query_parser.set_field_boost(shard.desc_field, 1.5);
                query_parser.set_field_boost(shard.content_field, 1.0);

                let query = query_parser.parse_query(query_str)?;

                let collector = (
                    tantivy::collector::TopDocs::with_limit(per_shard_limit),
                    tantivy::collector::Count,
                );
                let (top_docs, total_hits) = searcher.search(&query, &collector)?;

                let snippet_generator =
                    tantivy::snippet::SnippetGenerator::create(&searcher, &query, shard.content_field)?;

                Ok(ShardSearchResult {
                    hits: top_docs,
                    total_hits,
                    searcher,
                    snippet_generator,
                    shard_id: sid,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        let global_total: usize = shard_results.iter().map(|r| r.total_hits).sum();

        let mut merged: Vec<(f32, tantivy::DocAddress, usize)> = shard_results
            .par_iter()
            .flat_map(|r| {
                let sid = r.shard_id;
                r.hits
                    .par_iter()
                    .map(move |(score, addr)| (*score, *addr, sid))
            })
            .collect();

        merged.par_sort_unstable_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        let merged_limit = std::cmp::min(per_shard_limit, merged.len());
        let fetch_range = offset..merged_limit;
        let hits: Vec<SearchHit> = merged[fetch_range]
            .iter()
            .filter_map(|(score, doc_address, shard_id)| {
                let sr = &shard_results[*shard_id];
                let doc: tantivy::TantivyDocument = sr.searcher.doc(*doc_address).ok()?;
                let snippet = sr.snippet_generator.snippet_from_doc(&doc);
                let shard = &self.shards[*shard_id];
                let url = doc
                    .get_first(shard.url_field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let title = doc
                    .get_first(shard.title_field)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let description = doc
                    .get_first(shard.desc_field)
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
            total_hits: global_total,
            hits,
            query: query_str.to_string(),
            limit,
            offset,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::init_db;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU32, Ordering};

    static TEST_COUNTER: AtomicU32 = AtomicU32::new(0);

    fn temp_index_dir() -> PathBuf {
        let n = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("qwry-shard-test-{}-{}", std::process::id(), n));
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
    async fn test_sharded_open_or_create_single_shard_flat_path() {
        let dir = temp_index_dir();
        let idx = ShardedIndex::open_or_create(&dir, 1).unwrap();
        assert_eq!(idx.num_shards, 1);
        assert!(dir.join("meta.json").exists(), "single shard should use flat path");
    }

    #[tokio::test]
    async fn test_sharded_open_or_create_creates_shard_dirs() {
        let dir = temp_index_dir();
        let idx = ShardedIndex::open_or_create(&dir, 4).unwrap();
        assert_eq!(idx.num_shards, 4);
        for i in 0..4 {
            let shard_dir = dir.join(format!("shard-{i}"));
            assert!(shard_dir.join("meta.json").exists(), "shard-{i} should have meta.json");
        }
    }

    #[tokio::test]
    async fn test_sharded_open_or_create_rounds_to_power_of_two() {
        let dir = temp_index_dir();
        let idx = ShardedIndex::open_or_create(&dir, 3).unwrap();
        assert!(idx.num_shards == 4, "3 should round up to 4, got {}", idx.num_shards);
    }

    #[tokio::test]
    async fn test_sharded_index_distributes_across_shards() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = ShardedIndex::open_or_create(&dir, 4).unwrap();

        let urls: Vec<String> = (0..20)
            .map(|i| format!("https://shard-dist-{i}.example"))
            .collect();

        for url in &urls {
            insert_page(&pool, url, "Dist Test", "content for distribution testing").await;
        }

        idx.index_new_pages(&pool).await.unwrap();

        let mut shard_counts = vec![0usize; 4];
        for url in &urls {
            let sid = idx.shard_for(url);
            shard_counts[sid] += 1;
        }

        for (i, count) in shard_counts.iter().enumerate() {
            assert!(*count > 0, "shard {i} should have at least 1 page, got {count}");
        }
    }

    #[tokio::test]
    async fn test_sharded_search_aggregates_results() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = ShardedIndex::open_or_create(&dir, 4).unwrap();

        insert_page(&pool, "https://rust-lang.org", "Rust Programming", "Rust is a systems programming language focused on safety.").await;
        insert_page(&pool, "https://python.org", "Python Language", "Python is a high-level programming language.").await;
        insert_page(&pool, "https://golang.org", "Go Language", "Go is a compiled programming language.").await;

        idx.index_new_pages(&pool).await.unwrap();

        let response = idx.search("programming language", 10, 0).unwrap();
        assert!(response.total_hits >= 3, "should find all 3 pages, got {}", response.total_hits);
        assert_eq!(response.hits.len(), 3, "all pages should be in top results");
    }

    #[tokio::test]
    async fn test_sharded_search_respects_limit() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = ShardedIndex::open_or_create(&dir, 4).unwrap();

        for i in 0..10 {
            let url = format!("https://shard-limit-{i}.example");
            insert_page(&pool, &url, "Limit Test", "testing limit with sharded index").await;
        }
        idx.index_new_pages(&pool).await.unwrap();

        let response = idx.search("testing", 3, 0).unwrap();
        assert_eq!(response.hits.len(), 3, "limit=3 should return 3 hits");
    }

    #[tokio::test]
    async fn test_sharded_search_respects_offset() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = ShardedIndex::open_or_create(&dir, 4).unwrap();

        for i in 0..5 {
            let url = format!("https://shard-offset-{i}.example");
            insert_page(&pool, &url, "Offset Test", "same body for offset test").await;
        }
        idx.index_new_pages(&pool).await.unwrap();

        let all = idx.search("offset", 10, 0).unwrap();
        let offset = idx.search("offset", 10, 3).unwrap();
        assert_eq!(offset.hits.len(), all.hits.len().saturating_sub(3));
        if !offset.hits.is_empty() {
            assert_eq!(offset.hits[0].url, all.hits[3].url);
        }
    }

    #[tokio::test]
    async fn test_sharded_search_returns_empty_for_no_match() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = ShardedIndex::open_or_create(&dir, 4).unwrap();

        insert_page(&pool, "https://shard-zebra.example", "Zebra", "Zebras are African equines.").await;
        idx.index_new_pages(&pool).await.unwrap();

        let response = idx.search("quantum", 10, 0).unwrap();
        assert_eq!(response.total_hits, 0);
        assert!(response.hits.is_empty());
    }

    #[tokio::test]
    async fn test_sharded_snippet_highlights_match() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = ShardedIndex::open_or_create(&dir, 4).unwrap();

        insert_page(&pool, "https://shard-snippet.example", "Snippet", "The quick brown fox jumps over the lazy dog.").await;
        idx.index_new_pages(&pool).await.unwrap();

        let response = idx.search("fox", 10, 0).unwrap();
        assert!(!response.hits.is_empty());
        let snippet = &response.hits[0].snippet;
        assert!(snippet.contains("fox"), "snippet should contain search term: {snippet}");
    }

    #[tokio::test]
    async fn test_sharded_reindex_rebuilds() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = ShardedIndex::open_or_create(&dir, 4).unwrap();

        insert_page(&pool, "https://shard-reindex-a.example", "Alpha", "alpha content page one").await;
        insert_page(&pool, "https://shard-reindex-b.example", "Beta", "beta content page two").await;

        idx.index_new_pages(&pool).await.unwrap();

        let before = idx.search("content", 10, 0).unwrap();
        assert!(before.total_hits >= 2, "should find pages before reindex");

        idx.reindex_all_pages(&pool).await.unwrap();

        let after = idx.search("content", 10, 0).unwrap();
        assert!(after.total_hits >= 2, "should find pages after reindex");
    }

    #[tokio::test]
    async fn test_sharded_consistency_different_shard_counts() {
        let dir = temp_index_dir();

        let pool1 = test_pool().await;
        let urls1 = vec![
            "https://consistency-a.example",
            "https://consistency-b.example",
            "https://consistency-c.example",
            "https://consistency-d.example",
        ];
        for url in &urls1 {
            insert_page(&pool1, url, "Consistency", "consistency test content across shard counts").await;
        }

        let dir1 = dir.join("shards1");
        let idx1 = ShardedIndex::open_or_create(&dir1, 1).unwrap();
        idx1.index_new_pages(&pool1).await.unwrap();
        let res1 = idx1.search("consistency", 10, 0).unwrap();

        let pool4 = test_pool().await;
        let urls4 = vec![
            "https://consistency-e.example",
            "https://consistency-f.example",
            "https://consistency-g.example",
            "https://consistency-h.example",
        ];
        for url in &urls4 {
            insert_page(&pool4, url, "Consistency", "consistency test content across shard counts").await;
        }

        let dir4 = dir.join("shards4");
        let idx4 = ShardedIndex::open_or_create(&dir4, 4).unwrap();
        idx4.index_new_pages(&pool4).await.unwrap();
        let res4 = idx4.search("consistency", 10, 0).unwrap();

        assert_eq!(res1.total_hits, 4, "1-shard should find all 4 pages");
        assert_eq!(res4.total_hits, 4, "4-shard should find all 4 pages");
        assert_eq!(res1.hits.len(), res4.hits.len(), "hit count should match across shard counts");
    }

    #[tokio::test]
    async fn test_sharded_search_single_shard_matches_original() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = ShardedIndex::open_or_create(&dir, 1).unwrap();

        insert_page(&pool, "https://single-shard-test.example", "Single", "testing single shard mode").await;
        idx.index_new_pages(&pool).await.unwrap();

        let response = idx.search("single shard", 10, 0).unwrap();
        assert!(response.total_hits >= 1);
        assert!(!response.hits.is_empty());
        assert!(response.hits[0].url.contains("single-shard-test"));
    }
}

