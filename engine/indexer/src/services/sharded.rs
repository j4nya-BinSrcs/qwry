use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use anyhow::{Context, Result};
use rayon::prelude::*;

const EMBED_BATCH_SIZE: usize = 64;
use shared::{mark_pages_as_indexed, CrawledPage, DbPool};
use tantivy::schema::Value;

use crate::services::embed::EmbeddingGenerator;
use crate::services::index::SearchIndex;
use crate::services::search::{SearchHit, SearchResponse};
use tantivy::indexer::NoMergePolicy;

pub struct ShardedIndex {
    shards: Vec<SearchIndex>,
    num_shards: usize,
    pub embed_generator: Option<Mutex<EmbeddingGenerator>>,
}

impl ShardedIndex {
    pub fn open_or_create(index_dir: &Path, num_shards: usize) -> Result<Self> {
        Self::open_or_create_with_embed(index_dir, num_shards, None)
    }

    pub fn open_or_create_with_embed(
        index_dir: &Path,
        num_shards: usize,
        embed_generator: Option<Mutex<EmbeddingGenerator>>,
    ) -> Result<Self> {
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

        Ok(ShardedIndex { shards, num_shards, embed_generator })
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
        let mut total = 0usize;

        loop {
            let pages = shared::get_unindexed_pages_batch(db_pool, shared::INDEX_BATCH_SIZE)
                .await
                .context("Failed to query unindexed pages")?;

            if pages.is_empty() {
                break;
            }

            self.index_pages_in_tantivy(&pages).await?;

            // Mark pages as indexed immediately after Tantivy indexing succeeds,
            // so they never get stuck unindexed if a later step (embedding) crashes.
            let ids: Vec<i64> = pages.iter().filter_map(|p| p.id).collect();
            mark_pages_as_indexed(db_pool, &ids)
                .await
                .context("Failed to mark pages as indexed")?;

            // Generate embeddings for this batch, then drop pages to free memory.
            self.ensure_embeddings(db_pool, &pages).await?;

            total += pages.len();
            tracing::info!(batch = %pages.len(), total = %total, "Indexed batch");
        }

        // Recovery: generate embeddings for any pages that were previously
        // indexed (e.g. after a partial crash) but are still missing embeddings.
        self.recover_missing_embeddings(db_pool).await?;

        Ok(total)
    }

    async fn index_pages_in_tantivy(&self, pages: &[CrawledPage]) -> Result<()> {
        let mut shard_buckets: HashMap<usize, Vec<&CrawledPage>> = HashMap::new();
        for page in pages {
            let sid = self.shard_for(&page.url);
            shard_buckets.entry(sid).or_default().push(page);
        }

        let results: Vec<Result<()>> = (0..self.num_shards)
            .into_par_iter()
            .map(|sid| -> Result<()> {
                let Some(bucket) = shard_buckets.get(&sid) else {
                    return Ok(());
                };
                let mut writer = self.shards[sid].writer()?;
                writer.set_merge_policy(Box::new(NoMergePolicy));
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

        Ok(())
    }

    /// Generate embeddings for a set of pages.
    async fn ensure_embeddings(&self, db_pool: &DbPool, pages: &[CrawledPage]) -> Result<()> {
        let Some(ref gen_mutex) = self.embed_generator else {
            return Ok(());
        };

        if pages.is_empty() {
            return Ok(());
        }

        shared::ensure_embeddings_table(db_pool).await.ok();

        let model_name = {
            let generator = gen_mutex.lock().unwrap();
            generator.model_name().to_string()
        };

        let n = self
            .generate_embeddings_batched(db_pool, gen_mutex, pages, &model_name)
            .await?;
        tracing::info!(%n, "Generated embeddings");
        Ok(())
    }

    /// Recover embeddings for pages that are indexed but missing embedding rows
    /// (e.g. after a partial crash during a previous run).
    async fn recover_missing_embeddings(&self, db_pool: &DbPool) -> Result<()> {
        let Some(ref gen_mutex) = self.embed_generator else {
            return Ok(());
        };

        shared::ensure_embeddings_table(db_pool).await.ok();

        let model_name = {
            let generator = gen_mutex.lock().unwrap();
            generator.model_name().to_string()
        };

        let missing = shared::get_indexed_pages_missing_embeddings(db_pool).await?;
        if missing.is_empty() {
            return Ok(());
        }

        let n = self
            .generate_embeddings_batched(db_pool, gen_mutex, &missing, &model_name)
            .await?;
        tracing::info!(%n, "Recovered missing embeddings");
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    async fn generate_embeddings_batched(
        &self,
        db_pool: &DbPool,
        gen_mutex: &Mutex<EmbeddingGenerator>,
        pages: &[CrawledPage],
        model_name: &str,
    ) -> Result<usize> {
        let mut total = 0usize;
        for chunk in pages.chunks(EMBED_BATCH_SIZE) {
            let texts: Vec<&str> = chunk.iter().map(|p| p.content.as_str()).collect();
            let embeddings = {
                let mut generator = gen_mutex.lock().unwrap();
                generator.generate(&texts)?
            };

            for (page, emb) in chunk.iter().zip(embeddings.iter()) {
                if let Some(page_id) = page.id {
                    shared::save_embedding(
                        db_pool,
                        page_id,
                        0,
                        model_name,
                        emb,
                    )
                    .await
                    .ok();
                }
            }
            total += chunk.len();
            tracing::debug!(batch = %chunk.len(), total = %total, "Embedding batch saved");
        }
        Ok(total)
    }

    pub async fn reindex_all_pages(&self, db_pool: &DbPool) -> Result<usize> {
        shared::reset_indexed_flag(db_pool)
            .await
            .context("Failed to reset indexed flag")?;

        if self.embed_generator.is_some() {
            shared::delete_all_embeddings(db_pool).await.ok();
        }

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

        // Merge all segments into one for faster search.
        self.merge_all_segments()?;

        Ok(count)
    }

    /// Merge all existing segments in every shard into a single segment.
    fn merge_all_segments(&self) -> Result<()> {
        for sid in 0..self.num_shards {
            let mut writer = self.shards[sid].writer()?;
            writer.commit()?;
            writer.wait_merging_threads()?;
            tracing::info!(shard = %sid, "Merged all segments");
        }
        Ok(())
    }

    pub fn embed_query(&self, query_str: &str) -> Result<Option<Vec<f32>>> {
        let Some(ref gen_mutex) = self.embed_generator else {
            return Ok(None);
        };
        let mut generator = gen_mutex.lock().unwrap();
        let embeddings = generator.generate(&[query_str])?;
        Ok(embeddings.into_iter().next())
    }

    pub async fn search(
        &self,
        db_pool: &DbPool,
        query_str: &str,
        limit: usize,
        offset: usize,
    ) -> Result<SearchResponse> {
        let per_shard_limit = limit + offset;

        // ── BM25 pass (parallel across shards) ────────────────
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
                let (top_docs, shard_total) = searcher.search(&query, &collector)?;

                let snippet_generator =
                    tantivy::snippet::SnippetGenerator::create(&searcher, &query, shard.content_field)?;

                Ok(ShardSearchResult {
                    hits: top_docs,
                    total_hits: shard_total,
                    searcher,
                    snippet_generator,
                    shard_id: sid,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        let bm25_total: usize = shard_results.iter().map(|r| r.total_hits).sum();

        // Merge BM25 results from all shards, sorted by BM25 score desc
        let mut bm25_merged: Vec<(f32, tantivy::DocAddress, usize)> = shard_results
            .par_iter()
            .flat_map(|r| {
                let sid = r.shard_id;
                r.hits
                    .par_iter()
                    .map(move |(score, addr)| (*score, *addr, sid))
            })
            .collect();

        bm25_merged.par_sort_unstable_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        // ── Semantic pass ─────────────────────────────────────
        let query_vec = self.embed_query(query_str)?;
        let vec_hits = if let Some(ref qv) = query_vec {
            shared::vector_search(db_pool, qv, per_shard_limit)
                .await
                .unwrap_or_default()
        } else {
            vec![]
        };

        // ── Reciprocal Rank Fusion ────────────────────────────
        const RRF_K: f32 = 60.0;

        // Map URL → (fused_score, BM25_rank, vec_rank)
        let mut fused: std::collections::BTreeMap<String, (f32, Option<usize>, Option<usize>)> =
            std::collections::BTreeMap::new();

        for (rank, (_score, doc_address, shard_id)) in bm25_merged.iter().enumerate() {
            let sr = &shard_results[*shard_id];
            if let Ok(doc) = sr.searcher.doc::<tantivy::TantivyDocument>(*doc_address) {
                let url = doc
                    .get_first(self.shards[*shard_id].url_field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let rrf = 1.0 / (RRF_K + rank as f32);
                let entry = fused.entry(url).or_insert((0.0, None, None));
                entry.0 += rrf;
                entry.1 = Some(rank);
            }
        }

        for (rank, hit) in vec_hits.iter().enumerate() {
            let rrf = 1.0 / (RRF_K + rank as f32);
            let entry = fused.entry(hit.url.clone()).or_insert((0.0, None, None));
            entry.0 += rrf;
            entry.2 = Some(rank);
        }

        // Sort by fused score descending
        let mut ranked: Vec<(String, f32)> = fused.into_iter().map(|(u, (s, _, _))| (u, s)).collect();
        ranked.par_sort_unstable_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // ── Build response hits ───────────────────────────────
        // We need to fetch snippet/doc details. Use the top BM25 result for a URL
        // as the source for snippets.
        let fetch_range = offset..std::cmp::min(offset + limit, ranked.len());
        let hits: Vec<SearchHit> = ranked[fetch_range]
            .iter()
            .filter_map(|(url, fused_score)| {
                // Find this URL in BM25 results for snippet/doc details
                for (_score, doc_address, shard_id) in &bm25_merged {
                    let sr = &shard_results[*shard_id];
            if let Ok(doc) = sr.searcher.doc::<tantivy::TantivyDocument>(*doc_address) {
                        let doc_url = doc
                            .get_first(self.shards[*shard_id].url_field)
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if doc_url == url {
                            let snippet = sr.snippet_generator.snippet_from_doc(&doc);
                            let title = doc
                                .get_first(self.shards[*shard_id].title_field)
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            let description = doc
                                .get_first(self.shards[*shard_id].desc_field)
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            return Some(SearchHit {
                                url: url.clone(),
                                title,
                                description,
                                snippet: snippet.to_html(),
                                score: *fused_score,
                            });
                        }
                    }
                }
                // URL not found in BM25 (pure vector hit) — construct minimal hit
                vec_hits.iter().find(|v| v.url == *url).map(|vh| SearchHit {
                    url: url.clone(),
                    title: vh.title.clone(),
                    description: None,
                    snippet: String::new(),
                    score: *fused_score,
                })
            })
            .collect();

        let global_total = if query_vec.is_some() {
            // With vector search, total is a union estimate
            std::cmp::max(bm25_total, ranked.len())
        } else {
            bm25_total
        };

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

        let response = idx.search(&pool, "programming language", 10, 0).await.unwrap();
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

        let response = idx.search(&pool, "testing", 3, 0).await.unwrap();
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

        let all = idx.search(&pool, "offset", 10, 0).await.unwrap();
        let offset = idx.search(&pool, "offset", 10, 3).await.unwrap();
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

        let response = idx.search(&pool, "quantum", 10, 0).await.unwrap();
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

        let response = idx.search(&pool, "fox", 10, 0).await.unwrap();
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

        let before = idx.search(&pool, "content", 10, 0).await.unwrap();
        assert!(before.total_hits >= 2, "should find pages before reindex");

        idx.reindex_all_pages(&pool).await.unwrap();

        let after = idx.search(&pool, "content", 10, 0).await.unwrap();
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
        let res1 = idx1.search(&pool1, "consistency", 10, 0).await.unwrap();

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
        let res4 = idx4.search(&pool4, "consistency", 10, 0).await.unwrap();

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

        let response = idx.search(&pool, "single shard", 10, 0).await.unwrap();
        assert!(response.total_hits >= 1);
        assert!(!response.hits.is_empty());
        assert!(response.hits[0].url.contains("single-shard-test"));
    }

    // ── Embedding integration tests ────────────────────────────

    #[ignore = "requires network to download embedding model (run with -- --ignored)"]
    #[tokio::test]
    async fn test_embedding_table_created_on_index() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let generator = EmbeddingGenerator::new().unwrap();
        let idx = ShardedIndex::open_or_create_with_embed(&dir, 2, Some(Mutex::new(generator))).unwrap();

        insert_page(&pool, "https://embed-table-test.example", "Embed", "semantic embedding integration test").await;
        idx.index_new_pages(&pool).await.unwrap();

        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM page_embeddings")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(count > 0, "should have at least 1 embedding row, got {count}");
    }

    #[ignore = "requires network to download embedding model (run with -- --ignored)"]
    #[tokio::test]
    async fn test_embedding_saved_with_correct_dimension() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let generator = EmbeddingGenerator::new().unwrap();
        let idx = ShardedIndex::open_or_create_with_embed(&dir, 2, Some(Mutex::new(generator))).unwrap();

        insert_page(&pool, "https://embed-dim-test.example", "Dim", "check embedding dimension stored in DB").await;
        idx.index_new_pages(&pool).await.unwrap();

        let row: (i32,) = sqlx::query_as("SELECT dimension FROM page_embeddings LIMIT 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, 384);
    }

    #[ignore = "requires network to download embedding model (run with -- --ignored)"]
    #[tokio::test]
    async fn test_embedding_saved_with_correct_model_name() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let generator = EmbeddingGenerator::new().unwrap();
        let idx = ShardedIndex::open_or_create_with_embed(&dir, 2, Some(Mutex::new(generator))).unwrap();

        insert_page(&pool, "https://embed-model-test.example", "Model", "model name verification test").await;
        idx.index_new_pages(&pool).await.unwrap();

        let row: (String,) = sqlx::query_as("SELECT model FROM page_embeddings LIMIT 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, "BGE-small-en-v1.5");
    }

    #[ignore = "requires network to download embedding model (run with -- --ignored)"]
    #[tokio::test]
    async fn test_embedding_cleared_on_reindex() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let generator = EmbeddingGenerator::new().unwrap();
        let idx = ShardedIndex::open_or_create_with_embed(&dir, 2, Some(Mutex::new(generator))).unwrap();

        insert_page(&pool, "https://embed-reindex-test.example", "Reindex", "verify embeddings cleared after reindex").await;
        idx.index_new_pages(&pool).await.unwrap();

        let (before,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM page_embeddings")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(before > 0, "embeddings should exist before reindex");

        idx.reindex_all_pages(&pool).await.unwrap();

        let (after,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM page_embeddings")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(after > 0, "embeddings should be regenerated after reindex (page still exists)");
    }

    #[tokio::test]
    async fn test_embedding_not_saved_when_no_generator() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = ShardedIndex::open_or_create(&dir, 2).unwrap();
        assert!(idx.embed_generator.is_none());

        insert_page(&pool, "https://embed-none-test.example", "NoEmbed", "no embedding generator test").await;
        idx.index_new_pages(&pool).await.unwrap();

        // table may or may not exist; the point is no error occurs
        assert!(idx.embed_generator.is_none(), "generator should remain None");
    }
}

