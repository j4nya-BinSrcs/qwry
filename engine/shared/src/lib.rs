use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, QueryBuilder};
use std::collections::HashSet;

pub type DbPool = PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;

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

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_crawled_pages_indexed ON crawled_pages(indexed)",
    )
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

pub async fn is_url_crawled(pool: &DbPool, url: &str) -> Result<bool> {
    let row: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM crawled_pages WHERE url = $1")
            .bind(url)
            .fetch_optional(pool)
            .await?;

    Ok(row.is_some())
}

pub async fn are_urls_crawled(pool: &DbPool, urls: &[String]) -> Result<HashSet<String>> {
    if urls.is_empty() {
        return Ok(HashSet::new());
    }

    let mut query_builder: QueryBuilder<'_, sqlx::Postgres> = QueryBuilder::new(
        "SELECT url FROM crawled_pages WHERE url IN (",
    );

    let mut separated = query_builder.separated(", ");
    for url in urls {
        separated.push_bind(url);
    }
    separated.push_unseparated(")");

    let rows: Vec<(String,)> = query_builder
        .build_query_as()
        .fetch_all(pool)
        .await?;

    Ok(rows.into_iter().map(|(url,)| url).collect())
}

pub async fn get_page_count(pool: &DbPool) -> Result<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM crawled_pages")
        .fetch_one(pool)
        .await?;

    Ok(row.0)
}

pub async fn get_indexed_page_count(pool: &DbPool) -> Result<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM crawled_pages WHERE indexed = TRUE",
    )
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}
