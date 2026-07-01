#[derive(Debug, Clone)]
pub struct CrawlJob {
    pub url: String,
    pub depth: usize,
    pub retry_count: u32,
}

#[derive(Debug, Clone)]
pub struct CrawlResult {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub content: String,
    pub outgoing_links: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
#[test]
fn test_crawl_job_construction() {
    let job = CrawlJob {
        url: "https://example.com".into(),
        depth: 0,
        retry_count: 0,
    };
    assert_eq!(job.url, "https://example.com");
    assert_eq!(job.depth, 0);
    assert_eq!(job.retry_count, 0);
}

#[test]
fn test_crawl_result_construction() {
    let result = CrawlResult {
        url: "https://example.com".into(),
        title: Some("Example".into()),
        description: None,
        content: "page body".into(),
        outgoing_links: vec!["https://example.com/a".into()],
    };
    assert_eq!(result.title.unwrap(), "Example");
    assert!(result.description.is_none());
    assert_eq!(result.outgoing_links.len(), 1);
}

}
