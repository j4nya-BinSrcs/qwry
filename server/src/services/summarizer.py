import logging
import time
from dataclasses import dataclass

import httpx
from server.src.core.config import settings
from server.src.services.cache import CacheService
from server.src.services.llm import LLMBackend
from server.src.services.reader import FETCH_HEADERS, extract_text, extract_title

logger = logging.getLogger(__name__)


@dataclass
class SummarizeResult:
    url: str
    title: str | None
    summary: str
    provider: str
    model: str
    success: bool = True


SUMMARIZE_SYSTEM_PROMPT = (
    "You are a helpful assistant that summarizes web pages. "
    "Be objective, thorough, and cover the full breadth of the page content."
)

SUMMARIZE_PROMPT = (
    "Given the extracted text content of a webpage, produce a structured summary:\n\n"
    "**What this page is about** — one or two sentences describing the website or page's purpose and overall topic.\n\n"
    "**Main content** — a paragraph covering the key subjects, sections, and information presented on the page. "
    "Cover the full scope, not just one section.\n\n"
    "**Key points** — 3-6 bullet points of the most important takeaways.\n\n"
    "Be thorough and comprehensive. Cover the full breadth of content on the page.\n\n"
    "PAGE CONTENT:\n{text}"
)


class Summarizer:
    def __init__(
        self,
        llm: LLMBackend,
        http_client: httpx.AsyncClient,
        max_content_length: int = 8000,
        cache: CacheService | None = None,
    ) -> None:
        self._llm = llm
        self._http = http_client
        self._max_content_length = max_content_length
        self._cache = cache

    async def summarize_url(self, url: str) -> SummarizeResult:
        logger.info("Summarizing URL", extra={"url": url})

        if self._cache and self._cache.available:
            cached = await self._cache.get(CacheService.NAMESPACE_SUMMARY, url)
            if cached:
                logger.debug("Summary cache hit", extra={"url": url})
                return SummarizeResult(**cached)

        t_start = time.monotonic()

        try:
            resp = await self._http.get(url, timeout=10.0, follow_redirects=True, headers=FETCH_HEADERS)
            resp.raise_for_status()
        except Exception as e:
            logger.warning("Failed to fetch URL for summary", extra={"url": url, "error": str(e)})
            return SummarizeResult(
                url=url,
                title=None,
                summary=f"Failed to fetch page: {e}",
                provider=self._llm.__class__.__name__.replace("Backend", "").lower(),
                model=getattr(self._llm, "_model", "unknown"),
                success=False,
            )

        t_fetch = time.monotonic()
        logger.info("Page fetched", extra={"url": url, "elapsed_ms": round((t_fetch - t_start) * 1000, 1)})

        html = resp.text
        title = extract_title(html)
        text = extract_text(html)

        if not text:
            return SummarizeResult(
                url=url,
                title=title,
                summary="No readable content found on the page.",
                provider=self._llm.__class__.__name__.replace("Backend", "").lower(),
                model=getattr(self._llm, "_model", "unknown"),
                success=False,
            )

        if len(text) > self._max_content_length:
            text = text[: self._max_content_length] + "..."

        prompt = SUMMARIZE_PROMPT.format(text=text)

        try:
            summary = await self._llm.generate(prompt, SUMMARIZE_SYSTEM_PROMPT)
            t_llm = time.monotonic()
            logger.info(
                "Summary generated",
                extra={"url": url, "elapsed_ms": round((t_llm - t_fetch) * 1000, 1)},
            )
            result = SummarizeResult(
                url=url,
                title=title,
                summary=summary.strip() or "No summary generated.",
                provider=self._llm.__class__.__name__.replace("Backend", "").lower(),
                model=getattr(self._llm, "_model", "unknown"),
            )
            if self._cache and self._cache.available:
                await self._cache.set(
                    CacheService.NAMESPACE_SUMMARY,
                    result,
                    settings.cache_summary_ttl_seconds,
                    url,
                )
            return result
        except Exception as e:
            t_llm = time.monotonic()
            logger.error(
                "LLM generation failed",
                extra={"url": url, "error": repr(e), "elapsed_ms": round((t_llm - t_fetch) * 1000, 1)},
                exc_info=True,
            )
            return SummarizeResult(
                url=url,
                title=title,
                summary=f"Summary generation failed: {e!r}",
                provider=self._llm.__class__.__name__.replace("Backend", "").lower(),
                model=getattr(self._llm, "_model", "unknown"),
                success=False,
            )
