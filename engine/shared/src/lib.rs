use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, QueryBuilder, Row};
use std::collections::HashSet;

pub type DbPool = PgPool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CrawledPage {
    pub id: Option<i64>,
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub content: String,
    pub crawled_at: NaiveDateTime,
    pub indexed: bool,
}

pub async fn init_db() -> Result<DbPool> {
    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;

    let pool = PgPoolOptions::new()
        .max_connections(50)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(&database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS crawled_pages (
            id          BIGSERIAL PRIMARY KEY,
            url         TEXT NOT NULL UNIQUE,
            title       TEXT,
            description TEXT,
            content     TEXT NOT NULL,
            crawled_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            indexed     BOOLEAN NOT NULL DEFAULT FALSE
        )
        "#,
    )
    .execute(&pool)
    .await
    .context("Failed to create crawled_pages table")?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_crawled_pages_url ON crawled_pages(url)")
        .execute(&pool)
        .await
        .context("Failed to create url index")?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_crawled_pages_indexed ON crawled_pages(indexed)")
        .execute(&pool)
        .await
        .context("Failed to create indexed index")?;

    Ok(pool)
}

pub async fn save_page(pool: &DbPool, page: &CrawledPage) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO crawled_pages (url, title, description, content, crawled_at, indexed)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (url) DO UPDATE SET
            title       = EXCLUDED.title,
            description = EXCLUDED.description,
            content     = EXCLUDED.content,
            crawled_at  = EXCLUDED.crawled_at,
            indexed     = EXCLUDED.indexed
        "#,
    )
    .bind(&page.url)
    .bind(&page.title)
    .bind(&page.description)
    .bind(&page.content)
    .bind(page.crawled_at)
    .bind(page.indexed)
    .execute(pool)
    .await?;

    Ok(())
}

/// Bulk-insert a batch of pages in a single statement, using ON CONFLICT
/// to upsert duplicates.  Returns the number of rows inserted/updated.
pub async fn save_pages_batch(pool: &DbPool, pages: &[CrawledPage]) -> Result<u64> {
    if pages.is_empty() {
        return Ok(0);
    }

    // Deduplicate by URL – PostgreSQL's ON CONFLICT DO UPDATE cannot handle
    // duplicate unique keys within a single INSERT statement ("cannot affect
    // row a second time").
    let mut seen = HashSet::new();
    let deduped: Vec<&CrawledPage> = pages
        .iter()
        .filter(|p| seen.insert(p.url.clone()))
        .collect();

    let mut qb = QueryBuilder::new(
        "INSERT INTO crawled_pages (url, title, description, content, crawled_at, indexed) ",
    );

    qb.push_values(deduped, |mut b, page| {
        b.push_bind(&page.url)
            .push_bind(&page.title)
            .push_bind(&page.description)
            .push_bind(&page.content)
            .push_bind(page.crawled_at)
            .push_bind(page.indexed);
    });

    qb.push(
        " ON CONFLICT (url) DO UPDATE SET \
         title       = EXCLUDED.title, \
         description = EXCLUDED.description, \
         content     = EXCLUDED.content, \
         crawled_at  = EXCLUDED.crawled_at, \
         indexed     = EXCLUDED.indexed",
    );

    let result = qb.build().execute(pool).await?;
    Ok(result.rows_affected())
}

pub async fn is_url_crawled(pool: &DbPool, url: &str) -> Result<bool> {
    let row: Option<(i64,)> = sqlx::query_as("SELECT id FROM crawled_pages WHERE url = $1")
        .bind(url)
        .fetch_optional(pool)
        .await?;

    Ok(row.is_some())
}

pub async fn are_urls_crawled(pool: &DbPool, urls: &[String]) -> Result<HashSet<String>> {
    if urls.is_empty() {
        return Ok(HashSet::new());
    }

    let mut query_builder: QueryBuilder<'_, sqlx::Postgres> =
        QueryBuilder::new("SELECT url FROM crawled_pages WHERE url IN (");

    let mut separated = query_builder.separated(", ");
    for url in urls {
        separated.push_bind(url);
    }
    separated.push_unseparated(")");

    let rows: Vec<(String,)> = query_builder.build_query_as().fetch_all(pool).await?;

    Ok(rows.into_iter().map(|(url,)| url).collect())
}

pub async fn get_page_count(pool: &DbPool) -> Result<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM crawled_pages")
        .fetch_one(pool)
        .await?;

    Ok(row.0)
}

pub async fn get_indexed_page_count(pool: &DbPool) -> Result<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM crawled_pages WHERE indexed = TRUE")
        .fetch_one(pool)
        .await?;

    Ok(row.0)
}

pub const INDEX_BATCH_SIZE: usize = 500;

pub async fn get_unindexed_pages(pool: &DbPool) -> Result<Vec<CrawledPage>> {
    let rows = sqlx::query_as::<_, CrawledPage>(
        "SELECT id, url, title, description, content, crawled_at, indexed \
         FROM crawled_pages WHERE indexed = FALSE ORDER BY id",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn get_unindexed_pages_batch(pool: &DbPool, limit: usize) -> Result<Vec<CrawledPage>> {
    let rows = sqlx::query_as::<_, CrawledPage>(
        "SELECT id, url, title, description, content, crawled_at, indexed \
         FROM crawled_pages WHERE indexed = FALSE ORDER BY id LIMIT $1",
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn get_indexed_pages_missing_embeddings(pool: &DbPool) -> Result<Vec<CrawledPage>> {
    let rows = sqlx::query_as::<_, CrawledPage>(
        r#"
        SELECT p.id, p.url, p.title, p.description, p.content, p.crawled_at, p.indexed
        FROM crawled_pages p
        WHERE p.indexed = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM page_embeddings e WHERE e.page_id = p.id
          )
        ORDER BY p.id
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn mark_pages_as_indexed(pool: &DbPool, ids: &[i64]) -> Result<u64> {
    if ids.is_empty() {
        return Ok(0);
    }

    let mut qb: QueryBuilder<'_, sqlx::Postgres> =
        QueryBuilder::new("UPDATE crawled_pages SET indexed = TRUE WHERE id IN (");
    let mut separated = qb.separated(", ");
    for id in ids {
        separated.push_bind(id);
    }
    separated.push_unseparated(")");

    let result = qb.build().execute(pool).await?;
    Ok(result.rows_affected())
}

pub async fn reset_indexed_flag(pool: &DbPool) -> Result<u64> {
    let result = sqlx::query("UPDATE crawled_pages SET indexed = FALSE")
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

// ── Embeddings ────────────────────────────────────────────────

pub async fn ensure_embeddings_table(pool: &DbPool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS page_embeddings (
            id           BIGSERIAL PRIMARY KEY,
            page_id      BIGINT NOT NULL REFERENCES crawled_pages(id) ON DELETE CASCADE,
            chunk_index  INTEGER NOT NULL DEFAULT 0,
            model        TEXT NOT NULL DEFAULT 'BGE-small-en-v1.5',
            dimension    INTEGER NOT NULL DEFAULT 384,
            embedding    REAL[] NOT NULL,
            UNIQUE(page_id, chunk_index)
        )
        "#,
    )
    .execute(pool)
    .await
    .context("Failed to create page_embeddings table")?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_page_embeddings_page_id ON page_embeddings(page_id)")
        .execute(pool)
        .await
        .context("Failed to create page_embeddings index")?;

    Ok(())
}

pub async fn save_embedding(
    pool: &DbPool,
    page_id: i64,
    chunk_index: u32,
    model: &str,
    embedding: &[f32],
) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO page_embeddings (page_id, chunk_index, model, dimension, embedding)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (page_id, chunk_index) DO UPDATE SET
            embedding = EXCLUDED.embedding,
            model     = EXCLUDED.model,
            dimension = EXCLUDED.dimension
        "#,
    )
    .bind(page_id)
    .bind(chunk_index as i32)
    .bind(model)
    .bind(embedding.len() as i32)
    .bind(embedding)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_all_embeddings(pool: &DbPool) -> Result<Vec<PageEmbeddingSummary>> {
    let rows = sqlx::query(
        r#"
        SELECT e.page_id, p.url, p.title, e.embedding
        FROM page_embeddings e
        JOIN crawled_pages p ON p.id = e.page_id
        WHERE e.chunk_index = 0
        ORDER BY e.page_id
        "#,
    )
    .fetch_all(pool)
    .await?;

    let result = rows
        .iter()
        .map(|row| {
            let page_id: i64 = row.get("page_id");
            let url: String = row.get("url");
            let title: Option<String> = row.get("title");
            let embedding: Vec<f32> = row.get("embedding");
            PageEmbeddingSummary {
                page_id,
                url,
                title,
                embedding,
            }
        })
        .collect();

    Ok(result)
}

pub async fn delete_all_embeddings(pool: &DbPool) -> Result<u64> {
    let result = sqlx::query("DELETE FROM page_embeddings")
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

#[derive(Debug, Clone, Serialize)]
pub struct VectorSearchHit {
    pub page_id: i64,
    pub url: String,
    pub title: Option<String>,
    /// Cosine similarity in [0, 1], higher = more similar
    pub similarity: f64,
}

pub async fn vector_search(
    pool: &DbPool,
    query_vec: &[f32],
    limit: usize,
) -> Result<Vec<VectorSearchHit>> {
    let all = get_all_embeddings(pool).await?;

    let mut scored: Vec<(f64, &PageEmbeddingSummary)> = all
        .par_iter()
        .map(|entry| {
            let dot: f32 = query_vec.iter().zip(entry.embedding.iter()).map(|(a, b)| a * b).sum();
            let norm_a: f32 = query_vec.iter().map(|x| x * x).sum::<f32>().sqrt();
            let norm_b: f32 = entry.embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
            let similarity = (dot / (norm_a * norm_b)) as f64;
            (similarity, entry)
        })
        .collect();

    scored.par_sort_unstable_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    let result: Vec<VectorSearchHit> = scored
        .into_iter()
        .take(limit)
        .map(|(similarity, entry)| VectorSearchHit {
            page_id: entry.page_id,
            url: entry.url.clone(),
            title: entry.title.clone(),
            similarity,
        })
        .collect();

    Ok(result)
}

pub struct PageEmbeddingSummary {
    pub page_id: i64,
    pub url: String,
    pub title: Option<String>,
    pub embedding: Vec<f32>,
}

