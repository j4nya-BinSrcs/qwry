use std::path::Path;

use anyhow::{Context, Result};
use shared::{mark_pages_as_indexed, CrawledPage, DbPool};
use tantivy::directory::MmapDirectory;
use tantivy::schema::*;
use tantivy::{doc, Index, IndexReader, IndexWriter, Term};

pub struct SearchIndex {
    pub index: Index,
    pub reader: IndexReader,
    pub url_field: Field,
    pub title_field: Field,
    pub desc_field: Field,
    pub content_field: Field,
}

impl SearchIndex {
    pub fn open_or_create(index_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(index_dir)?;

        let mut schema_builder = Schema::builder();

        let url_field = schema_builder.add_text_field("url", STRING | STORED);
        let title_field = schema_builder.add_text_field("title", TEXT | STORED);
        let desc_field = schema_builder.add_text_field("description", TEXT | STORED);
        let content_field = schema_builder.add_text_field("content", TEXT | STORED);

        let schema = schema_builder.build();
        let dir = MmapDirectory::open(index_dir)?;
        let index = Index::open_or_create(dir, schema)?;

        let reader = index
            .reader_builder()
            .reload_policy(tantivy::ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        Ok(SearchIndex {
            index,
            reader,
            url_field,
            title_field,
            desc_field,
            content_field,
        })
    }

    pub fn writer(&self) -> Result<IndexWriter> {
        Ok(self.index.writer(100_000_000)?)
    }

    fn page_to_doc(&self, page: &CrawledPage) -> tantivy::TantivyDocument {
        let mut doc = doc!(
            self.url_field => page.url.clone(),
        );
        if let Some(ref title) = page.title {
            doc.add_text(self.title_field, title);
        }
        if let Some(ref desc) = page.description {
            doc.add_text(self.desc_field, desc);
        }
        doc.add_text(self.content_field, page.content.clone());
        doc
    }

    pub async fn index_new_pages(&self, db_pool: &DbPool) -> Result<usize> {
        let pages = shared::get_unindexed_pages(db_pool)
            .await
            .context("Failed to query unindexed pages")?;

        if pages.is_empty() {
            return Ok(0);
        }

        let count = pages.len();

        {
            let mut writer = self.writer()?;
            for page in &pages {
                let term = Term::from_field_text(self.url_field, &page.url);
                writer.delete_term(term);
                let doc = self.page_to_doc(page);
                writer.add_document(doc)?;
            }
            writer.commit()?;
        }

        let ids: Vec<i64> = pages.iter().filter_map(|p| p.id).collect();
        mark_pages_as_indexed(db_pool, &ids)
            .await
            .context("Failed to mark pages as indexed")?;

        Ok(count)
    }

    pub async fn reindex_all_pages(&self, db_pool: &DbPool) -> Result<usize> {
        shared::reset_indexed_flag(db_pool)
            .await
            .context("Failed to reset indexed flag")?;

        {
            let mut writer = self.writer()?;
            writer.delete_all_documents()?;
            writer.commit()?;
        }

        let count = self.index_new_pages(db_pool).await?;
        Ok(count)
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
        let dir = std::env::temp_dir().join(format!("qwry-test-{}-{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    async fn test_pool() -> DbPool {
        dotenvy::dotenv().ok();
        init_db().await.unwrap()
    }

    async fn insert_page(pool: &DbPool, url: &str, content: &str) {
        let page = CrawledPage {
            id: None,
            url: url.into(),
            title: Some("test title".into()),
            description: Some("test desc".into()),
            content: content.into(),
            crawled_at: chrono::Utc::now().naive_utc(),
            indexed: false,
        };
        shared::save_page(pool, &page).await.unwrap();
    }

    #[tokio::test]
    async fn test_open_or_create_creates_new_index() {
        let dir = temp_index_dir();
        let idx = SearchIndex::open_or_create(&dir).unwrap();
        assert!(dir.join("meta.json").exists());
        let _reader = idx.reader;
    }

    #[tokio::test]
    async fn test_open_or_create_reopens_existing() {
        let dir = temp_index_dir();
        SearchIndex::open_or_create(&dir).unwrap();
        let idx = SearchIndex::open_or_create(&dir).unwrap();
        assert!(dir.join("meta.json").exists());
        let _reader = idx.reader;
    }

    #[tokio::test]
    async fn test_index_new_pages_indexes_unindexed_pages() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = SearchIndex::open_or_create(&dir).unwrap();

        insert_page(&pool, "https://index-test-1.example", "page one content").await;
        insert_page(&pool, "https://index-test-2.example", "page two content").await;

        let count = idx.index_new_pages(&pool).await.unwrap();
        assert!(count >= 2, "should index at least our 2 unindexed pages, got {count}");

        let found1 = shared::is_url_crawled(&pool, "https://index-test-1.example")
            .await
            .unwrap();
        let found2 = shared::is_url_crawled(&pool, "https://index-test-2.example")
            .await
            .unwrap();
        assert!(found1);
        assert!(found2);
    }

    #[tokio::test]
    async fn test_index_new_pages_with_no_db_pages_does_not_panic() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = SearchIndex::open_or_create(&dir).unwrap();
        idx.index_new_pages(&pool).await.unwrap();
    }

    #[tokio::test]
    async fn test_index_new_pages_idempotent() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = SearchIndex::open_or_create(&dir).unwrap();

        insert_page(&pool, "https://index-dup-test.example", "original").await;

        let count = idx.index_new_pages(&pool).await.unwrap();
        assert!(count >= 1, "should index at least the inserted page");

        insert_page(&pool, "https://index-dup-test.example", "updated content").await;

        let count = idx.index_new_pages(&pool).await.unwrap();
        assert!(count >= 1, "should index the updated page");

        assert!(
            shared::is_url_crawled(&pool, "https://index-dup-test.example")
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn test_reindex_all_pages_rebuilds_index() {
        let dir = temp_index_dir();
        let pool = test_pool().await;
        let idx = SearchIndex::open_or_create(&dir).unwrap();

        insert_page(&pool, "https://reindex-test-a.example", "alpha").await;
        insert_page(&pool, "https://reindex-test-b.example", "beta").await;

        idx.index_new_pages(&pool).await.unwrap();

        assert!(
            shared::is_url_crawled(&pool, "https://reindex-test-a.example")
                .await
                .unwrap()
        );

        idx.reindex_all_pages(&pool).await.unwrap();

        assert!(
            shared::is_url_crawled(&pool, "https://reindex-test-a.example")
                .await
                .unwrap(),
            "reindexed page should still be in DB"
        );
        assert!(
            shared::is_url_crawled(&pool, "https://reindex-test-b.example")
                .await
                .unwrap(),
            "reindexed page should still be in DB"
        );
    }
}
