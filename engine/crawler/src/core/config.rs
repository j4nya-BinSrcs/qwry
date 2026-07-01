use std::time::Duration;

#[derive(Debug, Clone)]
pub struct CrawlerConfig {
    pub max_depth: usize,
    pub max_pages: usize,
    pub concurrency: usize,
    pub politeness_delay: Duration,
    pub user_agent: String,
    pub external_domains: bool,
    pub max_retries: u32,
    pub retry_base_delay: Duration,
    pub skip_politeness: bool,
    pub batch_db_check_size: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
#[test]
fn test_crawler_config_defaults() {
    let config = CrawlerConfig {
        max_depth: 3,
        max_pages: 100,
        concurrency: 10,
        politeness_delay: Duration::from_millis(500),
        user_agent: "QwryBot/0.1".into(),
        external_domains: false,
        max_retries: 3,
        retry_base_delay: Duration::from_secs(5),
        skip_politeness: false,
        batch_db_check_size: 100,
    };
    assert_eq!(config.max_depth, 3);
    assert_eq!(config.max_pages, 100);
    assert_eq!(config.concurrency, 10);
    assert!(!config.external_domains);
}

}
