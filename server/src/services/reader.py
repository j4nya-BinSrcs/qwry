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


_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"}
_YT_PATTERN = re.compile(r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([\w-]+)")
_YT_FOOTER_MARKERS = [
    "About Press Copyright",
    "Terms Privacy Policy",
    "© 20",
    "Share your videos with friends, family, and the world",
]


def _clean_youtube_description(desc: str) -> str:
    for marker in _YT_FOOTER_MARKERS:
        idx = desc.find(marker)
        if idx != -1:
            desc = desc[:idx]
    return desc.strip()


_BOILERPLATE_PATTERNS = [
    re.compile(r"javascript\s+is\s+(?:disabled|blocked|required)", re.IGNORECASE),
    re.compile(r"enable\s+javascript", re.IGNORECASE),
    re.compile(r"not\s+compatible\s+with\s+your\s+web\s+browser", re.IGNORECASE),
    re.compile(r"this\s+page\s+will\s+not\s+work\s+without", re.IGNORECASE),
    re.compile(r"peer[-\s]?tube\s+is\s+not\s+compatible", re.IGNORECASE),
]


def _is_boilerplate_error(text: str) -> bool:
    """Check if extracted text is a JS-required / browser-block page instead of real content."""
    short = text[:300]
    return any(p.search(short) for p in _BOILERPLATE_PATTERNS)


def detect_content_type(url: str) -> tuple[str, str | None]:
    """Returns (content_type, extra) where extra is a video_id or image URL."""
    path = url.split("?", 1)[0].lower()
    for ext in _IMAGE_EXTS:
        if path.endswith(ext):
            return "image", url
    m = _YT_PATTERN.search(url)
    if m:
        return "video", m.group(1)
    return "article", None


def _extract_meta_description(html: str) -> str | None:
    m = re.search(
        r'<meta\s+(?:property|name)=["\'](?:og:)?description["\']\s+content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip()
    m = re.search(
        r'<meta\s+content=["\']([^"\']+)["\']\s+(?:property|name)=["\'](?:og:)?description["\']',
        html,
        re.IGNORECASE,
    )
    return m.group(1).strip() if m else None


@dataclass
class ReaderResult:
    url: str
    title: str | None
    content: str
    content_length_chars: int
    reading_time_seconds: int
    success: bool = True
    error: str | None = None
    content_type: str = "article"
    media_url: str | None = None


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

    async def read_url(self, url: str, media_url: str | None = None) -> ReaderResult:
        logger.info("Reading URL", extra={"url": url})

        if self._cache and self._cache.available:
            cached = await self._cache.get(CacheService.NAMESPACE_READER, url)
            if cached:
                logger.debug("Reader cache hit", extra={"url": url})
                return ReaderResult(**cached)

        ctype, extra = detect_content_type(url)

        # ── Image: return immediately with media_url ────────────────
        if ctype == "image":
            result = ReaderResult(
                url=url,
                title=None,
                content="",
                content_length_chars=0,
                reading_time_seconds=0,
                content_type="image",
                media_url=url,
            )
            await self._store_cache(url, result)
            return result

        # ── YouTube / video: fetch page, extract description ────────
        if ctype == "video":
            return await self._read_video(url, extra)

        # ── Article: full extraction via trafilatura ─────────────────
        return await self._read_article(url)

    async def _read_video(self, url: str, video_id: str | None) -> ReaderResult:
        html = await self._fetch(url)
        if html is None:
            return ReaderResult(
                url=url,
                title=None,
                content="",
                content_length_chars=0,
                reading_time_seconds=0,
                success=False,
                error="Failed to fetch video page.",
                content_type="video",
                media_url=video_id and f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" or None,
            )

        title = _legacy_extract_title(html)
        desc = _clean_youtube_description(_extract_meta_description(html) or "")

        result = ReaderResult(
            url=url,
            title=title,
            content=desc,
            content_length_chars=len(desc),
            reading_time_seconds=0,
            content_type="video",
            media_url=video_id and f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" or None,
        )
        await self._store_cache(url, result)
        return result

    async def _read_article(self, url: str) -> ReaderResult:
        html = await self._fetch(url)
        if html is None:
            return ReaderResult(
                url=url,
                title=None,
                content="",
                content_length_chars=0,
                reading_time_seconds=0,
                success=False,
                error="Failed to fetch page.",
            )

        title, content = extract_article(html)

        if content and _is_boilerplate_error(content):
            logger.warning("Boilerplate page (JS required / browser block)", extra={"url": url})
            return ReaderResult(
                url=url,
                title=title,
                content="",
                content_length_chars=0,
                reading_time_seconds=0,
                success=False,
                error="This page requires JavaScript and cannot be read automatically.",
            )

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

        await self._store_cache(url, result)
        return result

    async def _fetch(self, url: str) -> str | None:
        t_start = time.monotonic()
        try:
            resp = await self._http.get(url, timeout=10.0, follow_redirects=True, headers=FETCH_HEADERS)
            resp.raise_for_status()
            logger.info("Page fetched", extra={"url": url, "elapsed_ms": round((time.monotonic() - t_start) * 1000, 1)})
            return resp.text
        except Exception as e:
            logger.warning("Failed to fetch URL", extra={"url": url, "error": str(e)})
            return None

    async def _store_cache(self, url: str, result: ReaderResult) -> None:
        if self._cache and self._cache.available:
            await self._cache.set(
                CacheService.NAMESPACE_READER,
                result,
                settings.cache_reader_ttl_seconds,
                url,
            )
