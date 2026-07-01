use std::time::Duration;

use shared::{CrawledPage, DbPool};
use tokio::sync::mpsc;

// ---------------------------------------------------------------------------
// BatchWriterConfig
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct BatchWriterConfig {
    pub max_batch_size: usize,
    pub flush_interval: Duration,
    pub channel_capacity: usize,
}

impl Default for BatchWriterConfig {
    fn default() -> Self {
        Self {
            max_batch_size: 100,
            flush_interval: Duration::from_secs(5),
            channel_capacity: 256,
        }
    }
}

// ---------------------------------------------------------------------------
// BatchWriter
// ---------------------------------------------------------------------------

/// Background batch-writer that collects [`CrawledPage`] items sent by
/// workers and flushes them to PostgreSQL in bulk INSERTs.
///
/// # Lifecycle
///
/// 1. Create with [`BatchWriter::new`] or [`BatchWriter::with_config`].
/// 2. Obtain a sender via [`BatchWriter::sender`] and clone it for each worker.
/// 3. After all workers have finished, call [`BatchWriter::shutdown`] (or
///    simply drop the writer) to flush any remaining buffered pages and wait
///    for the background task to exit.
pub struct BatchWriter {
    sender: mpsc::Sender<CrawledPage>,
    handle: Option<tokio::task::JoinHandle<()>>,
}

impl BatchWriter {
    pub fn new(pool: DbPool) -> Self {
        Self::with_config(pool, BatchWriterConfig::default())
    }

    pub fn with_config(pool: DbPool, config: BatchWriterConfig) -> Self {
        let (tx, rx) = mpsc::channel(config.channel_capacity);
        let handle = tokio::spawn(batch_loop(pool, rx, config));
        Self {
            sender: tx,
            handle: Some(handle),
        }
    }

    pub fn sender(&self) -> mpsc::Sender<CrawledPage> {
        self.sender.clone()
    }

    /// Gracefully shut down, flushing all buffered pages.
    ///
    /// Drop the original sender so the channel closes once all worker-held
    /// clones are also dropped, then wait for the background loop to exit.
    pub async fn shutdown(mut self) {
        drop(self.sender);
        if let Some(h) = self.handle.take() {
            h.await.ok();
        }
    }
}

// ---------------------------------------------------------------------------
// Background loop
// ---------------------------------------------------------------------------

async fn batch_loop(
    pool: DbPool,
    mut rx: mpsc::Receiver<CrawledPage>,
    config: BatchWriterConfig,
) {
    let mut buffer: Vec<CrawledPage> = Vec::with_capacity(config.max_batch_size);
    let mut flush_interval = tokio::time::interval(config.flush_interval);
    flush_interval.reset(); // don't fire immediately

    loop {
        tokio::select! {
            _ = flush_interval.tick() => {
                flush(&pool, &mut buffer).await;
            }
            msg = rx.recv() => {
                match msg {
                    Some(page) => {
                        buffer.push(page);
                        if buffer.len() >= config.max_batch_size {
                            flush(&pool, &mut buffer).await;
                        }
                    }
                    None => break,
                }
            }
        }
    }

    flush(&pool, &mut buffer).await;
}

async fn flush(pool: &DbPool, buffer: &mut Vec<CrawledPage>) {
    let batch = std::mem::take(buffer);
    if batch.is_empty() {
        return;
    }
    let n = batch.len();
    match shared::save_pages_batch(pool, &batch).await {
        Ok(inserted) => {
            tracing::debug!("flushed {} pages to db ({} rows affected)", n, inserted);
        }
        Err(e) => {
            tracing::warn!("batch save failed after {} pages: {:#}", n, e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::init_db;

    async fn test_pool() -> DbPool {
        dotenvy::dotenv().ok();
        init_db().await.unwrap()
    }

    fn make_page(url: &str) -> CrawledPage {
        CrawledPage {
            id: None,
            url: url.into(),
            title: Some("test".into()),
            description: None,
            content: "hello".into(),
            crawled_at: chrono::Utc::now().naive_utc(),
            indexed: false,
        }
    }

    #[tokio::test]
    async fn test_batch_writer_sends_and_flushes() {
        let pool = test_pool().await;
        let writer = BatchWriter::with_config(
            pool.clone(),
            BatchWriterConfig {
                max_batch_size: 10,
                flush_interval: Duration::from_secs(60),
                channel_capacity: 64,
            },
        );
        let sender = writer.sender();

        for i in 0..5 {
            sender
                .send(make_page(&format!("https://batch-{i}.com")))
                .await
                .unwrap();
        }

        drop(sender);
        writer.shutdown().await;

        for i in 0..5 {
            let url = format!("https://batch-{i}.com");
            let found = shared::is_url_crawled(&pool, &url).await.unwrap();
            assert!(found, "{url} should exist in db");
        }
    }

    #[tokio::test]
    async fn test_batch_writer_flushes_on_batch_size() {
        let pool = test_pool().await;
        let writer = BatchWriter::with_config(
            pool.clone(),
            BatchWriterConfig {
                max_batch_size: 3,
                flush_interval: Duration::from_secs(60),
                channel_capacity: 64,
            },
        );
        let sender = writer.sender();

        for i in 0..3 {
            sender
                .send(make_page(&format!("https://batchsize-{i}.com")))
                .await
                .unwrap();
        }

        // Give the background task a moment to flush
        tokio::time::sleep(Duration::from_millis(100)).await;

        for i in 0..3 {
            let url = format!("https://batchsize-{i}.com");
            let found = shared::is_url_crawled(&pool, &url).await.unwrap();
            assert!(found, "{url} should have been flushed on batch size");
        }

        drop(sender);
        writer.shutdown().await;
    }

    #[tokio::test]
    async fn test_batch_writer_zero_pages_does_not_panic() {
        let pool = test_pool().await;
        let writer = BatchWriter::new(pool);
        writer.shutdown().await;
    }

    #[tokio::test]
    async fn test_batch_writer_dedup_via_on_conflict() {
        let pool = test_pool().await;
        let writer = BatchWriter::with_config(
            pool.clone(),
            BatchWriterConfig {
                max_batch_size: 10,
                ..Default::default()
            },
        );
        let sender = writer.sender();

        // Send the same URL twice
        sender
            .send(make_page("https://dedup-test.com"))
            .await
            .unwrap();
        sender
            .send(make_page("https://dedup-test.com"))
            .await
            .unwrap();

        drop(sender);
        writer.shutdown().await;

        // The URL should exist (ON CONFLICT upsert handled the duplicate)
        let found = shared::is_url_crawled(&pool, "https://dedup-test.com")
            .await
            .unwrap();
        assert!(found, "ON CONFLICT upsert should have saved the URL");
    }
}
