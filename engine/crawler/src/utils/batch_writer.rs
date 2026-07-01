use std::time::Duration;

use shared::{CrawledPage, DbPool};
use tokio::sync::mpsc;

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

    pub async fn shutdown(mut self) {
        drop(self.sender);
        if let Some(h) = self.handle.take() {
            h.await.ok();
        }
    }
}

async fn batch_loop(
    pool: DbPool,
    mut rx: mpsc::Receiver<CrawledPage>,
    config: BatchWriterConfig,
) {
    let mut buffer: Vec<CrawledPage> = Vec::with_capacity(config.max_batch_size);
    let mut flush_interval = tokio::time::interval(config.flush_interval);
    flush_interval.reset();

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

        let found = shared::is_url_crawled(&pool, "https://dedup-test.com")
            .await
            .unwrap();
        assert!(found, "ON CONFLICT upsert should have saved the URL");
    }
}
