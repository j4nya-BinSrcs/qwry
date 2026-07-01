use crate::core::types::CrawlJob;
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
    time::Duration,
};

#[derive(Clone, Debug)]
pub struct JobQueue {
    inner: Arc<Mutex<JobQueueInner>>,
}

#[derive(Debug)]
struct JobQueueInner {
    queue: VecDeque<CrawlJob>,
}

impl JobQueue {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(JobQueueInner {
                queue: VecDeque::new(),
            })),
        }
    }

    pub fn push(&self, job: CrawlJob) {
        self.inner.lock().unwrap().queue.push_back(job);
    }

    pub fn push_batch(&self, jobs: Vec<CrawlJob>) {
        let mut inner = self.inner.lock().unwrap();
        for job in jobs {
            inner.queue.push_back(job);
        }
    }

    pub fn pop(&self) -> Option<CrawlJob> {
        self.inner.lock().unwrap().queue.pop_front()
    }

    pub fn len(&self) -> usize {
        self.inner.lock().unwrap().queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub async fn pop_or_wait(&self) -> Option<CrawlJob> {
        loop {
            if let Some(job) = self.pop() {
                return Some(job);
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    pub fn drain(&self) -> Vec<CrawlJob> {
        let mut inner = self.inner.lock().unwrap();
        inner.queue.drain(..).collect()
    }
}

impl Default for JobQueue {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_job(url: &str) -> CrawlJob {
        CrawlJob {
            url: url.to_string(),
            depth: 0,
            retry_count: 0,
        }
    }

    #[test]
    fn test_job_queue_push_and_pop() {
        let queue = JobQueue::new();
        assert!(queue.is_empty());
        queue.push(make_job("https://example.com"));
        assert_eq!(queue.len(), 1);
        let job = queue.pop();
        assert!(job.is_some());
        assert_eq!(job.unwrap().url, "https://example.com");
        assert!(queue.is_empty());
    }

    #[test]
    fn test_job_queue_fifo_order() {
        let queue = JobQueue::new();
        queue.push(make_job("https://first.com"));
        queue.push(make_job("https://second.com"));
        queue.push(make_job("https://third.com"));

        assert_eq!(queue.pop().unwrap().url, "https://first.com");
        assert_eq!(queue.pop().unwrap().url, "https://second.com");
        assert_eq!(queue.pop().unwrap().url, "https://third.com");
        assert!(queue.pop().is_none());
    }

    #[test]
    fn test_job_queue_multiple_push_and_drain() {
        let queue = JobQueue::new();
        queue.push(make_job("https://a.com"));
        queue.push(make_job("https://b.com"));
        queue.push(make_job("https://c.com"));

        let drained = queue.drain();
        assert_eq!(drained.len(), 3);
        assert!(queue.is_empty());
    }

    #[test]
    fn test_job_queue_push_batch() {
        let queue = JobQueue::new();
        let jobs = vec![
            make_job("https://x.com"),
            make_job("https://y.com"),
        ];
        queue.push_batch(jobs);
        assert_eq!(queue.len(), 2);
    }

    #[test]
    fn test_job_queue_len_empty_after_drain() {
        let queue = JobQueue::new();
        queue.push(make_job("https://test.com"));
        let _ = queue.pop();
        assert_eq!(queue.len(), 0);
    }

    #[tokio::test]
    async fn test_job_queue_pop_or_wait_timeout_on_empty() {
        let queue = JobQueue::new();
        let result = queue.pop_or_wait().await;
        assert!(result.is_none());
    }
}
