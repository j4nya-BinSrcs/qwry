use crate::core::types::CrawlJob;
use shared::DbPool;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub struct DbJobQueue {
    pool: DbPool,
    worker_id: String,
}

impl DbJobQueue {
    pub fn new(pool: DbPool) -> Self {
        let worker_id = format!(
            "{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        );
        Self { pool: pool.clone(), worker_id }
    }

    pub async fn ensure_table(pool: &DbPool) {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS crawl_jobs (
                id          BIGSERIAL PRIMARY KEY,
                url         TEXT NOT NULL UNIQUE,
                depth       INTEGER NOT NULL DEFAULT 0,
                status      TEXT NOT NULL DEFAULT 'pending',
                claimed_by  TEXT,
                claimed_at  TIMESTAMP,
                retry_count INTEGER NOT NULL DEFAULT 0,
                created_at  TIMESTAMP NOT NULL DEFAULT NOW()
            )
            "#,
        )
        .execute(pool)
        .await
        .ok();

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status)")
            .execute(pool)
            .await
            .ok();
    }

    pub async fn new_with_table(pool: DbPool) -> Self {
        Self::ensure_table(&pool).await;
        Self::new(pool)
    }

    pub fn worker_id(&self) -> &str {
        &self.worker_id
    }

    pub async fn push(&self, job: CrawlJob) {
        sqlx::query(
            "INSERT INTO crawl_jobs (url, depth, retry_count) VALUES ($1, $2, $3) ON CONFLICT (url) DO NOTHING",
        )
        .bind(&job.url)
        .bind(job.depth as i32)
        .bind(job.retry_count as i32)
        .execute(&self.pool)
        .await
        .ok();
    }

    pub async fn push_batch(&self, jobs: Vec<CrawlJob>) {
        if jobs.is_empty() {
            return;
        }
        for chunk in jobs.chunks(100) {
            let mut qb = sqlx::QueryBuilder::new(
                "INSERT INTO crawl_jobs (url, depth, retry_count) ",
            );
            qb.push_values(chunk, |mut b, job| {
                b.push_bind(&job.url)
                    .push_bind(job.depth as i32)
                    .push_bind(job.retry_count as i32);
            });
            qb.push(" ON CONFLICT (url) DO NOTHING");
            qb.build().execute(&self.pool).await.ok();
        }
    }

    pub async fn pop_or_wait(&self) -> Option<CrawlJob> {
        for _ in 0..60 {
            let result = sqlx::query_as::<_, (String, i32, i32)>(
                "WITH next_job AS ( \
                 SELECT id FROM crawl_jobs \
                 WHERE status = 'pending' \
                 ORDER BY id \
                 LIMIT 1 \
                 FOR UPDATE SKIP LOCKED \
                 ) \
                 UPDATE crawl_jobs \
                 SET status = 'claimed', claimed_by = $1, claimed_at = NOW() \
                 WHERE id = (SELECT id FROM next_job) \
                 RETURNING url, depth, retry_count",
            )
            .bind(&self.worker_id)
            .fetch_optional(&self.pool)
            .await
            .ok()
            .flatten();

            if let Some((url, depth, retry_count)) = result {
                return Some(CrawlJob {
                    url,
                    depth: depth as usize,
                    retry_count: retry_count as u32,
                });
            }

            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        None
    }
}
