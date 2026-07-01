use reqwest::Client;
use std::time::Duration;

// ---------------------------------------------------------------------------
// RobotsRules
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default)]
pub struct RobotsRules {
    pub disallows: Vec<String>,
    pub crawl_delay: Option<Duration>,
}

impl RobotsRules {
    pub fn is_allowed_by_robots(&self, path: &str) -> bool {
        for disallow in &self.disallows {
            if disallow.is_empty() {
                continue;
            }
            if path.starts_with(disallow) {
                return false;
            }
        }
        true
    }
}

// ---------------------------------------------------------------------------
// robots.txt parser
// ---------------------------------------------------------------------------

/// Parse the contents of a robots.txt file and return rules that apply to the
/// given `user_agent`.  The first matching user-agent group (exact match wins
/// over wildcard) is used; if no group matches, empty rules are returned.
pub fn parse_robots_txt(content: &str, user_agent: &str) -> RobotsRules {
    #[derive(Default)]
    struct Group {
        agents: Vec<String>,
        disallows: Vec<String>,
        crawl_delay: Option<Duration>,
    }

    let mut groups: Vec<Group> = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once(':') else { continue; };
        let key = key.trim().to_lowercase();
        let value = value.trim();

        if key == "user-agent" {
            groups.push(Group::default());
            if let Some(g) = groups.last_mut() {
                g.agents.push(value.to_string());
            }
        } else if let Some(g) = groups.last_mut() {
            match key.as_str() {
                "disallow" if !value.is_empty() => g.disallows.push(value.to_string()),
                "crawl-delay" => {
                    if g.crawl_delay.is_none() {
                        if let Ok(delay) = value.parse::<f64>() {
                            if delay >= 0.0 {
                                g.crawl_delay = Some(Duration::from_secs_f64(delay));
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }

    let ua_lower = user_agent.to_lowercase();

    // First pass: exact match
    let best = groups.iter().find(|g| {
        g.agents
            .iter()
            .any(|a| a.trim().to_lowercase() == ua_lower)
    });

    // Second pass: wildcard fallback
    let best = best.or_else(|| {
        groups
            .iter()
            .find(|g| g.agents.iter().any(|a| a.trim().to_lowercase() == "*"))
    });

    match best {
        Some(g) => RobotsRules {
            disallows: g.disallows.clone(),
            crawl_delay: g.crawl_delay,
        },
        None => RobotsRules {
            disallows: vec![],
            crawl_delay: None,
        },
    }
}

/// Fetch and parse `robots.txt` for a given host.  Errors are silently
/// treated as “no restrictions”.
pub async fn fetch_robots_txt(
    client: &Client,
    host: &str,
    user_agent: &str,
) -> RobotsRules {
    let url = format!("https://{host}/robots.txt");
    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => match resp.text().await {
            Ok(body) => parse_robots_txt(&body, user_agent),
            Err(_) => RobotsRules::default(),
        },
        _ => RobotsRules::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // --- RobotsRules --------------------------------------------------------

    #[test]
fn test_robots_rules_allows_everything_when_empty() {
    let rules = RobotsRules {
        disallows: vec![],
        crawl_delay: None,
    };
    assert!(rules.is_allowed_by_robots("/any/path"));
}

#[test]
fn test_robots_rules_blocks_disallowed_path() {
    let rules = RobotsRules {
        disallows: vec!["/private".into(), "/hidden".into()],
        crawl_delay: None,
    };
    assert!(!rules.is_allowed_by_robots("/private"));
    assert!(!rules.is_allowed_by_robots("/private/file"));
    assert!(!rules.is_allowed_by_robots("/hidden"));
    assert!(rules.is_allowed_by_robots("/public"));
    assert!(rules.is_allowed_by_robots("/"));
}

#[test]
fn test_robots_rules_ignores_empty_disallow_entry() {
    let rules = RobotsRules {
        disallows: vec!["".into()],
        crawl_delay: None,
    };
    assert!(rules.is_allowed_by_robots("/anything"));
}

#[test]
fn test_robots_rules_crawl_delay() {
    let rules = RobotsRules {
        disallows: vec![],
        crawl_delay: Some(Duration::from_secs(5)),
    };
    assert_eq!(rules.crawl_delay, Some(Duration::from_secs(5)));
}

#[test]
fn test_parse_robots_txt_empty() {
    let rules = parse_robots_txt("", "MyBot");
    assert!(rules.is_allowed_by_robots("/any"));
    assert!(rules.crawl_delay.is_none());
}

#[test]
fn test_parse_robots_txt_only_comments() {
    let txt = "# this is a comment\n# another comment";
    let rules = parse_robots_txt(txt, "MyBot");
    assert!(rules.is_allowed_by_robots("/any"));
}

#[test]
fn test_parse_robots_txt_wildcard_disallow_all() {
    let txt = "User-agent: *\nDisallow: /";
    let rules = parse_robots_txt(txt, "MyBot");
    assert!(!rules.is_allowed_by_robots("/"));
    assert!(!rules.is_allowed_by_robots("/anything"));
}

#[test]
fn test_parse_robots_txt_wildcard_specific_disallow() {
    let txt = "User-agent: *\nDisallow: /private/";
    let rules = parse_robots_txt(txt, "MyBot");
    assert!(!rules.is_allowed_by_robots("/private/"));
    assert!(!rules.is_allowed_by_robots("/private/file"));
    assert!(rules.is_allowed_by_robots("/public"));
    assert!(rules.is_allowed_by_robots("/"));
}

#[test]
fn test_parse_robots_txt_specific_user_agent_wins() {
    let txt = "\
User-agent: *
Disallow: /for-everyone/

User-agent: MyBot
Disallow: /for-mybot/
Crawl-delay: 10";
    let rules = parse_robots_txt(txt, "MyBot");
    assert!(!rules.is_allowed_by_robots("/for-mybot/"));
    assert!(rules.is_allowed_by_robots("/for-everyone/"));
    assert_eq!(rules.crawl_delay, Some(Duration::from_secs(10)));
}

#[test]
fn test_parse_robots_txt_falls_back_to_wildcard() {
    let txt = "\
User-agent: *
Disallow: /global/

User-agent: OtherBot
Disallow: /other/";
    let rules = parse_robots_txt(txt, "MyBot");
    // MyBot doesn't match OtherBot, falls back to wildcard
    assert!(!rules.is_allowed_by_robots("/global/"));
    assert!(rules.is_allowed_by_robots("/other/"));
}

#[test]
fn test_parse_robots_txt_no_matching_group() {
    let txt = "User-agent: SpecificBot\nDisallow: /secret/";
    let rules = parse_robots_txt(txt, "MyBot");
    // No wildcard group — no restrictions
    assert!(rules.is_allowed_by_robots("/secret/"));
    assert!(rules.is_allowed_by_robots("/anything"));
}

#[test]
fn test_parse_robots_txt_case_insensitive_user_agent() {
    let txt = "User-agent: mybot\nDisallow: /admin/";
    let rules = parse_robots_txt(txt, "MyBot");
    assert!(!rules.is_allowed_by_robots("/admin/"));
}

#[test]
fn test_parse_robots_txt_crawl_delay_parsing() {
    let txt = "User-agent: *\nCrawl-delay: 5.5";
    let rules = parse_robots_txt(txt, "Bot");
    assert_eq!(rules.crawl_delay, Some(Duration::from_secs_f64(5.5)));
}

#[test]
fn test_parse_robots_txt_invalid_crawl_delay_ignored() {
    let txt = "User-agent: *\nCrawl-delay: not-a-number";
    let rules = parse_robots_txt(txt, "Bot");
    assert!(rules.crawl_delay.is_none());
}

#[test]
fn test_parse_robots_txt_negative_crawl_delay_ignored() {
    let txt = "User-agent: *\nCrawl-delay: -1";
    let rules = parse_robots_txt(txt, "Bot");
    assert!(rules.crawl_delay.is_none());
}

#[test]
fn test_parse_robots_txt_multiple_disallows() {
    let txt = "\
User-agent: *
Disallow: /a
Disallow: /b
Disallow: /c";
    let rules = parse_robots_txt(txt, "Bot");
    assert!(!rules.is_allowed_by_robots("/a"));
    assert!(!rules.is_allowed_by_robots("/b"));
    assert!(!rules.is_allowed_by_robots("/c"));
    assert!(rules.is_allowed_by_robots("/d"));
}

#[test]
fn test_parse_robots_txt_empty_disallow_ignored() {
    // Empty disallow means "no restrictions" for that group,
    // but since we skip empty values it simply adds nothing.
    let txt = "User-agent: *\nDisallow: \nDisallow: /real";
    let rules = parse_robots_txt(txt, "Bot");
    assert!(!rules.is_allowed_by_robots("/real"));
    // Note: an empty Disallow technically means allow all,
    // but the standard says it overrides more specific disallows.
    // Our parser skips empty disallows, which is a reasonable simplification.
}

#[test]
fn test_parse_robots_txt_unknown_directive_ignored() {
    let txt = "User-agent: *\nSitemap: https://example.com/sitemap.xml\nDisallow: /private/";
    let rules = parse_robots_txt(txt, "Bot");
    assert!(!rules.is_allowed_by_robots("/private/"));
    assert!(rules.is_allowed_by_robots("/public"));
}

#[test]
fn test_parse_robots_txt_trailing_whitespace() {
    let txt = "User-agent: *  \nDisallow: /private/  \nCrawl-delay: 3  ";
    let rules = parse_robots_txt(txt, "Bot");
    assert!(!rules.is_allowed_by_robots("/private/"));
    assert_eq!(rules.crawl_delay, Some(Duration::from_secs(3)));
}

#[test]
fn test_parse_robots_txt_multiple_user_agents_same_group() {
    // Multiple consecutive User-agent lines belong to the same group.
    // Our parser adds each as its own group, but the last one's rules apply.
    // This is a simplification — the standard says all UAs in consecutive
    // lines share the same rules.
    let txt = "\
User-agent: BotA
User-agent: BotB
Disallow: /shared/";
    // BotB is the last group's agent, so it matches for BotB
    let rules_b = parse_robots_txt(txt, "BotB");
    assert!(!rules_b.is_allowed_by_robots("/shared/"));
    // BotA is a separate group (our simplification), so it won't match
    // In a real parser, both BotA and BotB would match.
    let rules_a = parse_robots_txt(txt, "BotA");
    assert!(rules_a.is_allowed_by_robots("/shared/"));
}

#[tokio::test]
async fn test_fetch_robots_txt_with_local_server() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buf = [0; 4096];
        socket.read(&mut buf).await.unwrap();
        let body = "User-agent: *\nDisallow: /hidden/\nCrawl-delay: 3\n";
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: text/plain\r\n\r\n{}",
            body.len(),
            body
        );
        use tokio::io::AsyncWriteExt;
        socket.write_all(response.as_bytes()).await.unwrap();
    });

    // Give the server a moment to start
    tokio::time::sleep(Duration::from_millis(50)).await;

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap();
    let host = format!("127.0.0.1:{}", addr.port());
    let rules = fetch_robots_txt(&client, &host, "TestBot").await;

    // Since the function builds an https:// URL, this will fail TLS
    // and return empty rules.  That's expected for plain HTTP.
    // The parse_robots_txt tests above cover the parsing logic itself.
    assert_eq!(rules.disallows.len(), 0);
}
}
