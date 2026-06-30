use crate::types::CrawlJob;
use std::{
    collections::VecDeque,
    sync::Mutex,
    time::Duration,
};

// ---------------------------------------------------------------------------
// JobQueue – bounded deque with semaphore-based blocking pop
// ---------------------------------------------------------------------------

pub struct JobQueue {
    inner: Mutex<VecDeque<CrawlJob>>,
    sema: tokio::sync::Semaphore,
}

impl JobQueue {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(VecDeque::new()),
            sema: tokio::sync::Semaphore::new(0),
        }
    }

    pub fn push(&self, job: CrawlJob) {
        self.inner.lock().unwrap().push_back(job);
        self.sema.add_permits(1);
    }

    pub fn push_batch(&self, jobs: Vec<CrawlJob>) {
        let n = jobs.len();
        self.inner.lock().unwrap().extend(jobs);
        self.sema.add_permits(n);
    }

    /// Pop the front job, waiting up to 1 second for one to become available.
    /// Returns `None` on timeout — caller should re-check termination conditions.
    pub async fn pop_or_wait(&self) -> Option<CrawlJob> {
        match tokio::time::timeout(Duration::from_secs(1), self.sema.acquire()).await {
            Ok(Ok(permit)) => {
                permit.forget();
                self.inner.lock().unwrap().pop_front()
            }
            _ => None,
        }
    }

    pub fn len(&self) -> usize {
        self.inner.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
#[tokio::test]
async fn test_job_queue_push_and_pop() {
    let queue = JobQueue::new();
    assert!(queue.is_empty());
    assert_eq!(queue.len(), 0);

    queue.push(CrawlJob {
        url: "https://example.com".into(),
        depth: 0,
        retry_count: 0,
    });

    assert_eq!(queue.len(), 1);

    let job = queue.pop_or_wait().await;
    assert!(job.is_some());
    assert_eq!(job.unwrap().url, "https://example.com");
    assert!(queue.is_empty());
}

#[tokio::test]
async fn test_job_queue_fifo_order() {
    let queue = JobQueue::new();

    for i in 0..5 {
        queue.push(CrawlJob {
            url: format!("https://page-{}.com", i),
            depth: i,
            retry_count: 0,
        });
    }

    for i in 0..5 {
        let job = queue.pop_or_wait().await;
        assert!(job.is_some());
        assert_eq!(job.unwrap().depth, i, "jobs should be dequeued in FIFO order");
    }
}

#[tokio::test]
async fn test_job_queue_push_batch() {
    let queue = JobQueue::new();
    let jobs: Vec<CrawlJob> = (0..10)
        .map(|i| CrawlJob {
            url: format!("https://page-{}.com", i),
            depth: i,
            retry_count: 0,
        })
        .collect();

    queue.push_batch(jobs);
    assert_eq!(queue.len(), 10);

    for i in 0..10 {
        let job = queue.pop_or_wait().await;
        assert!(job.is_some());
        assert_eq!(job.unwrap().depth, i, "batch should preserve order");
    }
}

#[tokio::test]
async fn test_job_queue_pop_or_wait_timeout_on_empty() {
    let queue = JobQueue::new();
    let job = queue.pop_or_wait().await;
    assert!(job.is_none(), "pop from empty queue should return None after timeout");
}

#[tokio::test]
async fn test_job_queue_multiple_push_and_drain() {
    let queue = JobQueue::new();

    queue.push(CrawlJob {
        url: "first".into(),
        depth: 0,
        retry_count: 0,
    });

    let first = queue.pop_or_wait().await;
    assert_eq!(first.unwrap().url, "first");

    // Push after draining
    queue.push(CrawlJob {
        url: "second".into(),
        depth: 0,
        retry_count: 0,
    });

    let second = queue.pop_or_wait().await;
    assert_eq!(second.unwrap().url, "second");
}

#[tokio::test]
async fn test_job_queue_len_empty_after_drain() {
    let queue = JobQueue::new();
    queue.push(CrawlJob {
        url: "url".into(),
        depth: 0,
        retry_count: 0,
    });
    queue.pop_or_wait().await;
    assert!(queue.is_empty());
}

}
