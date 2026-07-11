use anyhow::{Context, Result};
use reqwest::Client;
use scraper::{Html, Selector};
use std::sync::OnceLock;
use url::Url;

use crate::core::types::CrawlResult;

fn sel_a_href() -> &'static Selector {
    static SEL: OnceLock<Selector> = OnceLock::new();
    SEL.get_or_init(|| Selector::parse("a[href]").expect("a[href] selector"))
}

fn sel_title() -> &'static Selector {
    static SEL: OnceLock<Selector> = OnceLock::new();
    SEL.get_or_init(|| Selector::parse("title").expect("title selector"))
}

fn sel_description() -> &'static Selector {
    static SEL: OnceLock<Selector> = OnceLock::new();
    SEL.get_or_init(|| {
        Selector::parse("meta[name='description']").expect("meta description selector")
    })
}

fn sel_content_root() -> &'static Selector {
    static SEL: OnceLock<Selector> = OnceLock::new();
    SEL.get_or_init(|| {
        Selector::parse("main, article, body").expect("content root selector")
    })
}

const SKIP_TAGS: &[&str] = &[
    "script", "style", "nav", "footer", "header", "noscript", "iframe",
    "svg", "form", "button", "aside", "select", "option", "input",
    "textarea", "label", "canvas",
];

const EXTENSION_BLOCKLIST: &[&str] = &[
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".css", ".js", ".json", ".xml", ".rss", ".atom",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv",
    ".woff", ".woff2", ".ttf", ".eot",
];

fn is_block_tag(tag: &str) -> bool {
    matches!(
        tag,
        "address"
            | "article"
            | "aside"
            | "blockquote"
            | "dd"
            | "details"
            | "dialog"
            | "div"
            | "dl"
            | "dt"
            | "figcaption"
            | "figure"
            | "footer"
            | "form"
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6"
            | "header"
            | "hr"
            | "li"
            | "main"
            | "nav"
            | "ol"
            | "p"
            | "pre"
            | "section"
            | "table"
            | "tfoot"
            | "ul"
    )
}

pub fn normalize_url(href: &str, base_url: &Url) -> Result<String> {
    let parsed = base_url.join(href).context("URL join failed")?;

    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        anyhow::bail!("Unsupported scheme: {scheme}");
    }

    let mut result = Url::parse(&parsed.as_str().trim_end_matches('#')).unwrap();
    result.set_fragment(None);
    Ok(result.into())
}

pub fn extract_title(doc: &Html) -> Option<String> {
    let title = doc.select(sel_title()).next()?;
    let text = title.text().collect::<String>();
    let trimmed = text.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub fn extract_description(doc: &Html) -> Option<String> {
    let meta = doc.select(sel_description()).next()?;
    let content = meta.value().attr("content")?;
    let trimmed = content.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn collect_text(node: ego_tree::NodeRef<'_, scraper::node::Node>, buf: &mut String) {
    match node.value() {
        scraper::node::Node::Text(t) => {
            let text = t.text.trim();
            if !text.is_empty() {
                if !buf.is_empty() && !buf.ends_with(' ') && !buf.ends_with('\n') {
                    buf.push(' ');
                }
                buf.push_str(text);
            }
        }
        scraper::node::Node::Element(e) => {
            let tag = e.name();
            if SKIP_TAGS.contains(&tag) {
                return;
            }
            let block = is_block_tag(tag);
            if block && !buf.is_empty() && !buf.ends_with('\n') {
                buf.push('\n');
            }
            for child in node.children() {
                collect_text(child, buf);
            }
            if block && !buf.is_empty() && !buf.ends_with('\n') {
                buf.push('\n');
            }
        }
        _ => {}
    }
}

fn collapse_whitespace(s: &str) -> String {
    let s = s.trim();
    let mut result = String::with_capacity(s.len());
    let mut prev_was_space = false;

    for ch in s.chars() {
        match ch {
            '\n' => {
                if !result.ends_with('\n') {
                    result.push('\n');
                }
                prev_was_space = false;
            }
            c if c.is_whitespace() => {
                if !prev_was_space && !result.ends_with('\n') {
                    result.push(' ');
                    prev_was_space = true;
                }
            }
            c => {
                result.push(c);
                prev_was_space = false;
            }
        }
    }

    result
}

pub fn extract_clean_text(doc: &Html) -> String {
    let root_sel = sel_content_root();
    let root_node = match doc.select(root_sel).next() {
        Some(el) => doc.tree.get(el.id()),
        None => doc.tree.root().children().next(),
    };

    let Some(root) = root_node else {
        return String::new();
    };

    let mut buf = String::new();
    for child in root.children() {
        collect_text(child, &mut buf);
    }
    collapse_whitespace(&buf)
}

const MAX_LIGHTWEIGHT_CONTENT: usize = 32_768;

/// Strips HTML tags from raw HTML using a simple state machine.
/// Much faster than full DOM parsing — O(n), no allocations per tag.
/// Handles `<script>` / `<style>` blocks by skipping until the closing tag.
pub fn strip_html_tags(html: &str) -> String {
    let mut result = String::with_capacity(html.len().min(MAX_LIGHTWEIGHT_CONTENT));
    let bytes = html.as_bytes();
    let max = bytes.len();
    let mut pos = 0;
    let mut in_script = false;
    let mut in_style = false;

    while pos < max && result.len() < MAX_LIGHTWEIGHT_CONTENT {
        if bytes[pos] == b'<' {
            pos += 1;
            if pos >= max {
                break;
            }

            // Check if this starts a script or style tag
            if !in_script && !in_style {
                if max - pos >= 6 && bytes[pos..pos+6].eq_ignore_ascii_case(b"script") && !is_tag_char(bytes, pos + 6, max) {
                    in_script = true;
                    skip_tag(&bytes, &mut pos, max);
                    continue;
                }
                if max - pos >= 5 && bytes[pos..pos+5].eq_ignore_ascii_case(b"style") && !is_tag_char(bytes, pos + 5, max) {
                    in_style = true;
                    skip_tag(&bytes, &mut pos, max);
                    continue;
                }
            }

            // Check for closing script/style tags
            if in_script && max - pos >= 7 && bytes[pos..pos+7].eq_ignore_ascii_case(b"/script") {
                in_script = false;
                skip_tag(&bytes, &mut pos, max);
                continue;
            }
            if in_style && max - pos >= 6 && bytes[pos..pos+6].eq_ignore_ascii_case(b"/style") {
                in_style = false;
                skip_tag(&bytes, &mut pos, max);
                continue;
            }

            if in_script || in_style {
                skip_tag(&bytes, &mut pos, max);
                continue;
            }

            // Regular tag — skip until >
            skip_tag(&bytes, &mut pos, max);
            continue;
        }

        if in_script || in_style {
            pos += 1;
            continue;
        }

        // Character between tags — append to result
        let ch = bytes[pos] as char;
        if ch.is_whitespace() {
            if !result.ends_with(' ') {
                result.push(' ');
            }
        } else {
            result.push(ch);
        }
        pos += 1;
    }

    result.trim().to_string()
}

#[inline]
fn is_tag_char(bytes: &[u8], pos: usize, max: usize) -> bool {
    if pos >= max { return false; }
    let b = bytes[pos];
    b.is_ascii_alphanumeric()
}

#[inline]
fn skip_tag(bytes: &[u8], pos: &mut usize, max: usize) {
    while *pos < max && bytes[*pos] != b'>' {
        *pos += 1;
    }
    if *pos < max && bytes[*pos] == b'>' {
        *pos += 1;
    }
}

pub fn extract_links(doc: &Html, base_url: &Url, allow_external: bool) -> Vec<String> {
    let mut links: Vec<String> = Vec::new();

    for el in doc.select(sel_a_href()) {
        let href = match el.value().attr("href") {
            Some(h) => h,
            None => continue,
        };

        let normalized = match normalize_url(href, base_url) {
            Ok(u) => u,
            Err(_) => continue,
        };

        if !allow_external {
            let parsed = match Url::parse(&normalized) {
                Ok(u) => u,
                Err(_) => continue,
            };
            let base_host = base_url.host_str().unwrap_or("");
            let link_host = parsed.host_str().unwrap_or("");
            let same_host = link_host == base_host
                || link_host.ends_with(&format!(".{}", base_host));
            if !same_host {
                continue;
            }
        }

        let parsed_url = match Url::parse(&normalized) {
            Ok(u) => u,
            Err(_) => continue,
        };
        let path = parsed_url.path();
        if EXTENSION_BLOCKLIST
            .iter()
            .any(|ext| path.ends_with(ext) || path.to_lowercase().ends_with(ext))
        {
            continue;
        }

        links.push(normalized);
    }

    links.sort();
    links.dedup();
    links
}

/// Extract title from raw HTML via simple substring search.
/// Works on the raw HTML bytes with case-insensitive matching.
fn extract_title_lightweight(html: &str) -> Option<String> {
    let bytes = html.as_bytes();
    let n = bytes.len();

    // Find <title or <TITLE (case-insensitive)
    let mut start_pos = None;
    let mut i = 0;
    while i + 6 < n {
        if bytes[i] == b'<' {
            let rest = &bytes[i + 1..];
            if rest.len() >= 5 && rest[..5].eq_ignore_ascii_case(b"title") {
                start_pos = Some(i);
                break;
            }
        }
        i += 1;
    }
    let tag_start = start_pos?;

    // Find > after <title
    let content_start = bytes[tag_start..].iter().position(|&b| b == b'>')? + tag_start + 1;

    // Find </title> (case-insensitive)
    let remaining = &bytes[content_start..];
    let mut j = 0;
    while j + 8 < remaining.len() {
        if remaining[j] == b'<' && remaining[j + 1] == b'/' {
            if remaining[j + 2..].len() >= 5 && remaining[j + 2..j + 7].eq_ignore_ascii_case(b"title") {
                let end_pos = content_start + j;
                let title = html[content_start..end_pos].trim();
                if title.is_empty() {
                    return None;
                }
                return Some(title.to_string());
            }
        }
        j += 1;
    }
    None
}

/// Extract links from raw HTML by scanning for `href="..."` patterns.
/// Much faster than full DOM parsing — O(n), single pass.
fn extract_links_lightweight(html: &str, base_url: &Url, allow_external: bool) -> Vec<String> {
    let mut links: Vec<String> = Vec::new();
    let href = "href=";
    let bytes = html.as_bytes();

    let mut pos = 0;
    while pos < bytes.len() {
        // Find next href=
        match bytes[pos..].windows(href.len()).position(|w| w.eq_ignore_ascii_case(href.as_bytes())) {
            Some(offset) => {
                pos += offset + href.len();
            }
            None => break,
        }

        // Skip whitespace and expect quote
        while pos < bytes.len() && bytes[pos].is_ascii_whitespace() {
            pos += 1;
        }
        if pos >= bytes.len() || (bytes[pos] != b'"' && bytes[pos] != b'\'') {
            continue;
        }
        let quote = bytes[pos];
        pos += 1;

        // Extract URL value
        let start = pos;
        while pos < bytes.len() && bytes[pos] != quote {
            pos += 1;
        }
        if pos <= start {
            continue;
        }
        let href_val = &html[start..pos];
        pos += 1; // skip closing quote

        // Normalize and validate
        let normalized = match normalize_url(href_val, base_url) {
            Ok(u) => u,
            Err(_) => continue,
        };

        // Filter by domain
        if !allow_external {
            let parsed = match Url::parse(&normalized) {
                Ok(u) => u,
                Err(_) => continue,
            };
            let base_host = base_url.host_str().unwrap_or("");
            let link_host = parsed.host_str().unwrap_or("");
            let same_host = link_host == base_host
                || link_host.ends_with(&format!(".{}", base_host));
            if !same_host {
                continue;
            }
        }

        // Filter extensions
        let parsed_url = match Url::parse(&normalized) {
            Ok(u) => u,
            Err(_) => continue,
        };
        let path = parsed_url.path();
        if EXTENSION_BLOCKLIST
            .iter()
            .any(|ext| path.ends_with(ext) || path.to_lowercase().ends_with(ext))
        {
            continue;
        }

        links.push(normalized);
    }

    links.sort();
    links.dedup();
    links
}

pub async fn fetch_page(
    client: &Client,
    url_str: &str,
    allow_external: bool,
    lightweight: bool,
) -> Result<CrawlResult> {
    let resp = client.get(url_str).send().await?;
    resp.error_for_status_ref().context("HTTP error status")?;

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !content_type.contains("text/html") {
        anyhow::bail!("Non-HTML content type: {content_type}");
    }

    let body = resp.text().await?;

    if lightweight {
        let content = strip_html_tags(&body);
        let base_url = Url::parse(url_str)?;
        let title = extract_title_lightweight(&body);
        let outgoing_links = extract_links_lightweight(&body, &base_url, allow_external);

        return Ok(CrawlResult {
            url: url_str.to_string(),
            title,
            description: None,
            content,
            outgoing_links,
        });
    }

    let doc = Html::parse_document(&body);
    let base_url = Url::parse(url_str)?;

    let title = extract_title(&doc);
    let description = extract_description(&doc);
    let content = extract_clean_text(&doc);
    let outgoing_links = extract_links(&doc, &base_url, allow_external);

    Ok(CrawlResult {
        url: url_str.to_string(),
        title,
        description,
        content,
        outgoing_links,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_url_relative() {
        let base = Url::parse("https://example.com/dir/").unwrap();
        let result = normalize_url("/page", &base).unwrap();
        assert_eq!(result, "https://example.com/page");
    }

    #[test]
    fn test_normalize_url_absolute() {
        let base = Url::parse("https://example.com/dir/").unwrap();
        let result = normalize_url("https://other.com/page", &base).unwrap();
        assert_eq!(result, "https://other.com/page");
    }

    #[test]
    fn test_normalize_url_strips_fragment() {
        let base = Url::parse("https://example.com/").unwrap();
        let result = normalize_url("/page#section", &base).unwrap();
        assert_eq!(result, "https://example.com/page");
    }

    #[test]
    fn test_normalize_url_rejects_javascript() {
        let base = Url::parse("https://example.com/").unwrap();
        let result = normalize_url("javascript:void(0)", &base);
        assert!(result.is_err());
    }

    #[test]
    fn test_normalize_url_rejects_mailto() {
        let base = Url::parse("https://example.com/").unwrap();
        let result = normalize_url("mailto:user@example.com", &base);
        assert!(result.is_err());
    }

    #[test]
    fn test_normalize_url_preserves_query_params() {
        let base = Url::parse("https://example.com/").unwrap();
        let result = normalize_url("/page?q=hello&n=1", &base).unwrap();
        assert_eq!(result, "https://example.com/page?q=hello&n=1");
    }

    #[test]
    fn test_normalize_url_protocol_relative() {
        let base = Url::parse("https://example.com/").unwrap();
        let result = normalize_url("//other.com/path", &base).unwrap();
        assert_eq!(result, "https://other.com/path");
    }

    #[test]
    fn test_normalize_url_relative_no_leading_slash() {
        let base = Url::parse("https://example.com/dir/page.html").unwrap();
        let result = normalize_url("other", &base).unwrap();
        assert_eq!(result, "https://example.com/dir/other");
    }

    #[test]
    fn test_normalize_url_relative_up_dir() {
        let base = Url::parse("https://example.com/a/b/c.html").unwrap();
        let result = normalize_url("../other", &base).unwrap();
        assert_eq!(result, "https://example.com/a/other");
    }

    #[test]
    fn test_extract_title_basic() {
        let html = r#"<html><head><title>Hello World</title></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_title(&doc), Some("Hello World".into()));
    }

    #[test]
    fn test_extract_title_none() {
        let html = r#"<html><head></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_title(&doc), None);
    }

    #[test]
    fn test_extract_title_with_whitespace() {
        let html = r#"<html><head><title>   Spaced Title   </title></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_title(&doc), Some("Spaced Title".into()));
    }

    #[test]
    fn test_extract_title_nested_tags() {
        let html = r#"<html><head><title>Hello <b>World</b></title></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        let title = extract_title(&doc);
        assert!(title.is_some());
        let t = title.unwrap();
        assert!(t.contains("Hello"), "title should contain 'Hello', got: {t:?}");
        assert!(t.contains("World"), "title should contain 'World', got: {t:?}");
    }

    #[test]
    fn test_extract_title_empty() {
        let html = r#"<html><head><title>  </title></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_title(&doc), None);
    }

    #[test]
    fn test_extract_description_basic() {
        let html = r#"<html><head><meta name="description" content="A test page"></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), Some("A test page".into()));
    }

    #[test]
    fn test_extract_description_none() {
        let html = r#"<html><head></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), None);
    }

    #[test]
    fn test_extract_description_with_whitespace() {
        let html = r#"<html><head><meta name="description" content="   Desc with spaces   "></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), Some("Desc with spaces".into()));
    }

    #[test]
    fn test_extract_description_other_meta_ignored() {
        let html = r#"<html><head><meta name="keywords" content="kw1,kw2"><meta name="description" content="real desc"></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), Some("real desc".into()));
    }

    #[test]
    fn test_extract_description_empty_content() {
        let html = r#"<html><head><meta name="description" content="   "></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), None);
    }

    #[test]
    fn test_extract_description_missing_content_attr() {
        let html = r#"<html><head><meta name="description"></head><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_description(&doc), None);
    }

    #[test]
    fn test_clean_text_basic_paragraph() {
        let html = r#"<html><body><p>Hello World</p></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "Hello World");
    }

    #[test]
    fn test_clean_text_removes_script() {
        let html = r#"<html><body><p>Visible</p><script>alert("hidden")</script><p>Also visible</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert!(text.contains("Visible"));
        assert!(text.contains("Also visible"));
        assert!(!text.contains("hidden"), "script content should be removed");
    }

    #[test]
    fn test_clean_text_removes_style() {
        let html = r#"<html><head><style>body { color: red; }</style></head><body><p>Visible</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Visible");
        assert!(!text.contains("color: red"), "style content should be removed");
    }

    #[test]
    fn test_clean_text_removes_nav() {
        let html = r#"<html><body><nav><a href="/">Home</a><a href="/about">About</a></nav><main><p>Content</p></main></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert!(text.contains("Content"));
        assert!(!text.contains("Home"), "nav content should be removed");
        assert!(!text.contains("About"), "nav content should be removed");
    }

    #[test]
    fn test_clean_text_removes_footer() {
        let html = r#"<html><body><main><p>Main content</p></main><footer><p>Footer</p></footer></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Main content");
    }

    #[test]
    fn test_clean_text_block_elements_produce_newlines() {
        let html = r#"<html><body><p>First paragraph</p><p>Second paragraph</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "First paragraph\nSecond paragraph");
    }

    #[test]
    fn test_clean_text_collapses_whitespace() {
        let html = r#"<html><body><p>Hello    World</p></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "Hello World");
    }

    #[test]
    fn test_clean_text_multiple_paragraphs() {
        let html = r#"<html><body><h1>Title</h1><p>First</p><p>Second</p><p>Third</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Title\nFirst\nSecond\nThird");
    }

    #[test]
    fn test_clean_text_nested_elements() {
        let html = r#"<html><body><div><p>Nested <b>text</b> here</p></div></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "Nested text here");
    }

    #[test]
    fn test_clean_text_empty_body() {
        let html = r#"<html><body></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "");
    }

    #[test]
    fn test_clean_text_uses_main_over_body() {
        let html = r#"<html><body><nav>nav text</nav><main>main content</main><footer>footer text</footer></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "main content");
    }

    #[test]
    fn test_clean_text_removes_sidebar_aside() {
        let html = r#"<html><body><main><p>Article content</p></main><aside><p>Sidebar</p></aside></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Article content");
    }

    #[test]
    fn test_clean_text_multiple_headings() {
        let html = r#"<html><body><h1>Heading 1</h1><p>Text 1</p><h2>Heading 2</h2><p>Text 2</p></body></html>"#;
        let doc = Html::parse_document(html);
        let text = extract_clean_text(&doc);
        assert_eq!(text, "Heading 1\nText 1\nHeading 2\nText 2");
    }

    #[test]
    fn test_clean_text_heading_with_inline_elements() {
        let html = r#"<html><body><h1>Hello <em>World</em></h1><p>Content</p></body></html>"#;
        let doc = Html::parse_document(html);
        assert_eq!(extract_clean_text(&doc), "Hello World\nContent");
    }

    #[test]
    fn test_extract_links_basic() {
        let html = r#"<html><body><a href="/page1">Page 1</a><a href="/page2">Page 2</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0], "https://example.com/page1");
        assert_eq!(links[1], "https://example.com/page2");
    }

    #[test]
    fn test_extract_links_relative_resolved() {
        let html = r#"<html><body><a href="page">Link</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/dir/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/dir/page"]);
    }

    #[test]
    fn test_extract_links_filters_external_when_disallowed() {
        let html = r#"<html><body><a href="https://external.com/page">External</a><a href="/internal">Internal</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/internal"]);
    }

    #[test]
    fn test_extract_links_includes_external_when_allowed() {
        let html = r#"<html><body><a href="https://external.com/page">External</a><a href="/internal">Internal</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, true);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0], "https://example.com/internal");
        assert_eq!(links[1], "https://external.com/page");
    }

    #[test]
    fn test_extract_links_filters_extension_blocklist() {
        let html = r#"<html><body>
            <a href="/page">Page</a>
            <a href="/image.png">Image</a>
            <a href="/doc.pdf">PDF</a>
            <a href="/style.css">CSS</a>
            <a href="/script.js">JS</a>
        </body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/page"]);
    }

    #[test]
    fn test_extract_links_filters_case_insensitive_extension() {
        let html = r#"<html><body>
            <a href="/image.PNG">Image</a>
            <a href="/page">Page</a>
        </body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/page"]);
    }

    #[test]
    fn test_extract_links_dedup() {
        let html = r#"<html><body>
            <a href="/page">Page 1</a>
            <a href="/page">Page 2</a>
            <a href="/other">Other</a>
        </body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec![
            "https://example.com/other",
            "https://example.com/page",
        ]);
    }

    #[test]
    fn test_extract_links_sorted() {
        let html = r#"<html><body>
            <a href="/z">Z</a>
            <a href="/a">A</a>
            <a href="/m">M</a>
        </body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec![
            "https://example.com/a",
            "https://example.com/m",
            "https://example.com/z",
        ]);
    }

    #[test]
    fn test_extract_links_none() {
        let html = r#"<html><body><p>No links here</p></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert!(links.is_empty());
    }

    #[test]
    fn test_extract_links_no_href_ignored() {
        let html = r#"<html><body><a>No href</a><a href="/ok">OK</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/ok"]);
    }

    #[test]
    fn test_extract_links_filters_javascript_href() {
        let html = r#"<html><body><a href="javascript:void(0)">JS</a><a href="/real">Real</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links, vec!["https://example.com/real"]);
    }

    #[test]
    fn test_extract_links_subdomain_same_host() {
        let html = r#"<html><body><a href="https://sub.example.com/page">Sub</a><a href="/internal">Internal</a></body></html>"#;
        let doc = Html::parse_document(html);
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links(&doc, &base, false);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0], "https://example.com/internal");
        assert_eq!(links[1], "https://sub.example.com/page");
    }

    // -----------------------------------------------------------------------
    // strip_html_tags tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_strip_html_tags_basic() {
        let html = "<html><body><p>Hello World</p></body></html>";
        assert_eq!(strip_html_tags(html), "Hello World");
    }

    #[test]
    fn test_strip_html_tags_removes_script() {
        let html = r#"<html><body><p>Visible</p><script>alert("x")</script><p>Also</p></body></html>"#;
        let result = strip_html_tags(html);
        assert!(result.contains("Visible"));
        assert!(result.contains("Also"));
        assert!(!result.contains("alert"), "script content should be removed");
    }

    #[test]
    fn test_strip_html_tags_removes_style() {
        let html = r#"<html><head><style>body{color:red}</style></head><body><p>Text</p></body></html>"#;
        let result = strip_html_tags(html);
        assert_eq!(result, "Text");
        assert!(!result.contains("color"), "style content should be removed");
    }

    #[test]
    fn test_strip_html_tags_collapses_whitespace() {
        let html = r#"<html><body><p>Hello    World</p></body></html>"#;
        assert_eq!(strip_html_tags(html), "Hello World");
    }

    #[test]
    fn test_strip_html_tags_empty() {
        assert_eq!(strip_html_tags(""), "");
    }

    #[test]
    fn test_strip_html_tags_no_html() {
        assert_eq!(strip_html_tags("just plain text"), "just plain text");
    }

    #[test]
    fn test_strip_html_tags_with_attributes() {
        let html = r#"<div class="content"><a href="/link">click here</a></div>"#;
        assert_eq!(strip_html_tags(html), "click here");
    }

    #[test]
    fn test_strip_html_tags_truncates_at_max_size() {
        let long = format!("<p>{}</p>", "a".repeat(40_000));
        let result = strip_html_tags(&long);
        assert!(result.len() <= 32_768);
        assert!(result.contains("aaaa"));
    }

    #[test]
    fn test_strip_html_tags_self_closing() {
        let html = r#"<br/><p>Text</p><img src="x.png"/>"#;
        assert_eq!(strip_html_tags(html), "Text");
    }

    // -----------------------------------------------------------------------
    // extract_title_lightweight tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_title_lightweight_basic() {
        let html = "<html><head><title>Hello World</title></head><body></body></html>";
        assert_eq!(extract_title_lightweight(html), Some("Hello World".into()));
    }

    #[test]
    fn test_extract_title_lightweight_none() {
        let html = "<html><head></head><body></body></html>";
        assert_eq!(extract_title_lightweight(html), None);
    }

    #[test]
    fn test_extract_title_lightweight_empty() {
        let html = "<html><head><title>  </title></head><body></body></html>";
        assert_eq!(extract_title_lightweight(html), None);
    }

    #[test]
    fn test_extract_title_lightweight_with_whitespace() {
        let html = "<html><head><title>   Spaced Title   </title></head><body></body></html>";
        assert_eq!(extract_title_lightweight(html), Some("Spaced Title".into()));
    }

    // -----------------------------------------------------------------------
    // extract_links_lightweight tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_links_lightweight_basic() {
        let html = r#"<html><body><a href="/page1">Page 1</a><a href="/page2">Page 2</a></body></html>"#;
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links_lightweight(html, &base, false);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0], "https://example.com/page1");
        assert_eq!(links[1], "https://example.com/page2");
    }

    #[test]
    fn test_extract_links_lightweight_filters_external() {
        let html = r#"<html><body><a href="https://external.com/page">External</a><a href="/internal">Internal</a></body></html>"#;
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links_lightweight(html, &base, false);
        assert_eq!(links, vec!["https://example.com/internal"]);
    }

    #[test]
    fn test_extract_links_lightweight_allows_external() {
        let html = r#"<html><body><a href="https://external.com/page">External</a><a href="/internal">Internal</a></body></html>"#;
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links_lightweight(html, &base, true);
        assert_eq!(links.len(), 2);
    }

    #[test]
    fn test_extract_links_lightweight_filters_extensions() {
        let html = r#"<html><body>
            <a href="/page">Page</a>
            <a href="/image.png">Image</a>
            <a href="/doc.pdf">PDF</a>
        </body></html>"#;
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links_lightweight(html, &base, false);
        assert_eq!(links, vec!["https://example.com/page"]);
    }

    #[test]
    fn test_extract_links_lightweight_none() {
        let html = r#"<html><body><p>No links here</p></body></html>"#;
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links_lightweight(html, &base, false);
        assert!(links.is_empty());
    }

    #[test]
    fn test_extract_links_lightweight_dedup() {
        let html = r#"<html><body>
            <a href="/page">Page 1</a>
            <a href="/page">Page 2</a>
        </body></html>"#;
        let base = Url::parse("https://example.com/").unwrap();
        let links = extract_links_lightweight(html, &base, false);
        assert_eq!(links, vec!["https://example.com/page"]);
    }
}
