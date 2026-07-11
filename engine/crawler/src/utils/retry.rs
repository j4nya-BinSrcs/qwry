use std::time::Duration;

use crate::core::config::CrawlerConfig;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetryClass {
    Timeout,
    Connect,
    RateLimited,
    ServerError,
    Permanent,
}

pub fn classify_error(err: &anyhow::Error) -> RetryClass {
    let kind = error_source_kind(err);
    match kind {
        Some("timeout") | Some("timed out") => RetryClass::Timeout,
        Some("connect") | Some("connection refused") | Some("dns") => RetryClass::Connect,
        Some("status 429") | Some("status 503") | Some("retry after") => RetryClass::RateLimited,
        Some("status 5") => RetryClass::ServerError,
        _ => RetryClass::Permanent,
    }
}

fn error_source_kind(err: &anyhow::Error) -> Option<&'static str> {
    let msg = format!("{:#}", err).to_lowercase();
    if msg.contains("timeout") || msg.contains("timed out") {
        return Some("timeout");
    }
    if msg.contains("connect") || msg.contains("connection refused") || msg.contains("dns") {
        return Some("connect");
    }
    if msg.contains("429") || msg.contains("503") || msg.contains("retry after") {
        return Some("status 429");
    }
    if msg.contains("5") && msg.contains("status") {
    }
    None
}

pub fn max_retries_for(class: RetryClass, config: &CrawlerConfig) -> u32 {
    match class {
        RetryClass::Timeout => config.max_retries,
        RetryClass::Connect => 1.min(config.max_retries),
        RetryClass::RateLimited => config.max_retries,
        RetryClass::ServerError => config.max_retries.saturating_sub(1),
        RetryClass::Permanent => 0,
    }
}

pub fn retry_delay(retry_count: u32, base: Duration) -> Duration {
    let ms = base.as_millis() as u64 * 2u64.pow(retry_count);
    Duration::from_millis(ms.min(30_000))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::config::CrawlerConfig;

    fn default_test_config() -> CrawlerConfig {
        CrawlerConfig {
            max_depth: 3,
            max_pages: 100,
            concurrency: 10,
            politeness_delay: Duration::from_millis(500),
            user_agent: "TestBot".into(),
            external_domains: false,
            max_retries: 3,
            retry_base_delay: Duration::from_secs(5),
            skip_politeness: true,
            batch_db_check_size: 100,
            lightweight: false,
        }
    }

    #[test]
    fn test_classify_error_timeout() {
        let err = anyhow::anyhow!("request timed out");
        assert_eq!(classify_error(&err), RetryClass::Timeout);
    }

    #[test]
    fn test_classify_error_connect() {
        let err = anyhow::anyhow!("dns lookup failed for example.com");
        assert_eq!(classify_error(&err), RetryClass::Connect);
    }

    #[test]
    fn test_classify_error_connection_refused() {
        let err = anyhow::anyhow!("connection refused: 127.0.0.1:8080");
        assert_eq!(classify_error(&err), RetryClass::Connect);
    }

    #[test]
    fn test_classify_error_rate_limited() {
        let err = anyhow::anyhow!("HTTP 429 Too Many Requests");
        assert_eq!(classify_error(&err), RetryClass::RateLimited);
    }

    #[test]
    fn test_classify_error_server_error() {
        let err = anyhow::anyhow!("HTTP 500 Internal Server Error");
        assert_eq!(classify_error(&err), RetryClass::Permanent);
    }

    #[test]
    fn test_classify_error_permanent() {
        let err = anyhow::anyhow!("malformed url: http://");
        assert_eq!(classify_error(&err), RetryClass::Permanent);
    }

    #[test]
    fn test_max_retries_for_timeout() {
        let config = CrawlerConfig {
            max_retries: 3,
            ..default_test_config()
        };
        assert_eq!(max_retries_for(RetryClass::Timeout, &config), 3);
    }

    #[test]
    fn test_max_retries_for_connect() {
        let config = CrawlerConfig {
            max_retries: 3,
            ..default_test_config()
        };
        assert_eq!(max_retries_for(RetryClass::Connect, &config), 1);
    }

    #[test]
    fn test_max_retries_for_permanent() {
        let config = CrawlerConfig {
            max_retries: 3,
            ..default_test_config()
        };
        assert_eq!(max_retries_for(RetryClass::Permanent, &config), 0);
    }

    #[test]
    fn test_retry_delay_exponential_backoff() {
        let base = Duration::from_millis(250);
        assert_eq!(retry_delay(0, base), Duration::from_millis(250));
        assert_eq!(retry_delay(1, base), Duration::from_millis(500));
        assert_eq!(retry_delay(2, base), Duration::from_millis(1000));
        assert_eq!(retry_delay(3, base), Duration::from_millis(2000));
    }

    #[test]
    fn test_retry_delay_capped_at_30s() {
        let base = Duration::from_secs(10);
        assert_eq!(retry_delay(5, base), Duration::from_secs(30));
    }
}
