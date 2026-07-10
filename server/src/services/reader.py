import logging
import re
import time
from dataclasses import dataclass
from html.parser import HTMLParser

import httpx
import trafilatura
from server.src.core.config import settings
from server.src.services.cache import CacheService

logger = logging.getLogger(__name__)

WORDS_PER_MINUTE = 200


@dataclass
class ReaderResult:
    url: str
    title: str | None
    content: str
    content_length_chars: int
    reading_time_seconds: int
    success: bool = True
    error: str | None = None


# ── Legacy fallback extractors ──────────────────────────────────────


class _LegacyTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []
        self._skip = False
        self._skip_tags = {"script", "style", "nav", "footer", "noscript"}
        self._block_tags = {
            "p",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "li",
            "div",
            "br",
            "tr",
            "blockquote",
            "section",
        }
        self._current = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._skip_tags:
            self._skip = True
        if self._current and tag in self._block_tags:
            self._flush()

    def handle_endtag(self, tag: str) -> None:
        if tag in self._skip_tags:
            self._skip = False
        if self._current and tag in self._block_tags:
            self._flush()

    def handle_data(self, data: str) -> None:
        if not self._skip:
            text = data.strip()
            if text:
                self._current += text + " "

    def _flush(self) -> None:
        t = self._current.strip()
        if t:
            self._parts.append(t)
        self._current = ""

    def get_text(self) -> str:
        self._flush()
        return "\n\n".join(self._parts)


def _legacy_extract_title(html: str) -> str | None:
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    return m.group(1).strip() if m else None


def _legacy_extract_text(html: str) -> str:
    parser = _LegacyTextExtractor()
    parser.feed(html)
    return parser.get_text()


# ── Primary extraction (trafilatura + legacy fallback) ──────────────


def extract_article(html: str) -> tuple[str | None, str]:
    """Extract (title, text) from HTML using trafilatura, falling back to legacy parser."""
    try:
        doc = trafilatura.bare_extraction(
            html,
            include_comments=False,
            include_tables=False,
            include_links=False,
            include_images=False,
        )
        if doc and doc.text:
            title = doc.title or _legacy_extract_title(html)
            return title, doc.text
    except Exception:
        pass
    return _legacy_extract_title(html), _legacy_extract_text(html)


def extract_text(html: str) -> str:
    _, text = extract_article(html)
    return text


def extract_title(html: str) -> str | None:
    title, _ = extract_article(html)
    return title


def estimate_reading_time(text: str, wpm: int = WORDS_PER_MINUTE) -> int:
    word_count = len(text.split())
    minutes = max(1, round(word_count / wpm))
    return minutes * 60


FETCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        " AppleWebKit/537.36 (KHTML, like Gecko)"
        " Chrome/127.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip",
    "Cache-Control": "no-cache",
}


class ReaderService:
    def __init__(self, http_client: httpx.AsyncClient, cache: CacheService | None = None) -> None:
        self._http = http_client
        self._cache = cache

    async def read_url(self, url: str) -> ReaderResult:
        logger.info("Reading URL", extra={"url": url})

        if self._cache and self._cache.available:
            cached = await self._cache.get(CacheService.NAMESPACE_READER, url)
            if cached:
                logger.debug("Reader cache hit", extra={"url": url})
                return ReaderResult(**cached)

        t_start = time.monotonic()

        try:
            resp = await self._http.get(url, timeout=10.0, follow_redirects=True, headers=FETCH_HEADERS)
            resp.raise_for_status()
        except Exception as e:
            logger.warning("Failed to fetch URL for reading", extra={"url": url, "error": str(e)})
            return ReaderResult(
                url=url,
                title=None,
                content="",
                content_length_chars=0,
                reading_time_seconds=0,
                success=False,
                error=f"Failed to fetch page: {e}",
            )

        t_fetch = time.monotonic()
        logger.info("Page fetched for reading", extra={"url": url, "elapsed_ms": round((t_fetch - t_start) * 1000, 1)})

        html = resp.text
        title, content = extract_article(html)

        if not content:
            return ReaderResult(
                url=url,
                title=title,
                content="",
                content_length_chars=0,
                reading_time_seconds=0,
                success=False,
                error="No readable content found on the page.",
            )

        reading_time = estimate_reading_time(content)

        result = ReaderResult(
            url=url,
            title=title,
            content=content,
            content_length_chars=len(content),
            reading_time_seconds=reading_time,
        )

        if self._cache and self._cache.available:
            await self._cache.set(
                CacheService.NAMESPACE_READER,
                result,
                settings.cache_reader_ttl_seconds,
                url,
            )

        return result
