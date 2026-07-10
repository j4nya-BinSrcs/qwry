import logging
import time
from dataclasses import dataclass

import httpx
from server.src.core.config import settings
from server.src.services.cache import CacheService
from server.src.services.llm import LLMBackend
from server.src.services.reader import (
    FETCH_HEADERS,
    _extract_meta_description,
    _is_boilerplate_error,
    _legacy_extract_title,
    detect_content_type,
    extract_article,
)

logger = logging.getLogger(__name__)


@dataclass
class SummarizeResult:
    url: str
    title: str | None
    summary: str
    provider: str
    model: str
    success: bool = True


_SUMMARY_SYSTEM = "Summarize the content provided. Output only the summary, nothing else."

_SUMMARY_PROMPT_ARTICLE = (
    "Summarize this webpage in a structured format.\n\n"
    "## What this page is about\n"
    "One or two sentences describing the overall topic and purpose.\n\n"
    "## Main content\n"
    "A paragraph covering the key subjects and information in detail.\n\n"
    "## Key points\n"
    "3-6 bullet points of the most important takeaways.\n\n"
    "OUTPUT ONLY THE SUMMARY. DO NOT include introductions, explanations, or meta-commentary.\n\n"
    "WEBPAGE CONTENT:\n{text}"
)

_SUMMARY_PROMPT_VIDEO = (
    "Summarize this video based on its title and description.\n\n"
    "## What this video is about\n"
    "One or two sentences describing the video's topic and purpose.\n\n"
    "## Main content\n"
    "A paragraph describing the key content and information presented.\n\n"
    "## Key points\n"
    "3-6 bullet points of the most important takeaways.\n\n"
    "OUTPUT ONLY THE SUMMARY. DO NOT include introductions, explanations, or meta-commentary.\n\n"
    "VIDEO:\n{text}"
)

_SUMMARY_PROMPT_IMAGE = (
    "Describe this image based on its title and any available metadata.\n\n"
    "## What this image is\n"
    "One or two sentences identifying the subject.\n\n"
    "## Details\n"
    "A paragraph describing what can be inferred about the image.\n\n"
    "## Key points\n"
    "Any notable elements visible or inferred from the image.\n\n"
    "OUTPUT ONLY THE SUMMARY. If no meaningful description is available, state that.\n\n"
    "IMAGE CONTEXT:\n{text}"
)

_TRANSCRIPT_URL = "https://youtubetranscript.com"


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

    async def summarize_url(
        self,
        url: str,
        item_title: str | None = None,
        item_snippet: str | None = None,
        media_url: str | None = None,
    ) -> SummarizeResult:
        logger.info("Summarizing URL", extra={"url": url})

        if self._cache and self._cache.available:
            cached = await self._cache.get(CacheService.NAMESPACE_SUMMARY, url)
            if cached:
                logger.debug("Summary cache hit", extra={"url": url})
                return SummarizeResult(**cached)

        ctype, extra = detect_content_type(media_url or url)

        if ctype == "image":
            return await self._summarize_image(url, item_title, item_snippet)

        if ctype == "video":
            return await self._summarize_video(url, extra, item_title, item_snippet)

        return await self._summarize_article(url)

    async def _fetch_page(self, url: str) -> str | None:
        t_start = time.monotonic()
        try:
            resp = await self._http.get(url, timeout=10.0, follow_redirects=True, headers=FETCH_HEADERS)
            resp.raise_for_status()
            logger.info("Page fetched", extra={"url": url, "elapsed_ms": round((time.monotonic() - t_start) * 1000, 1)})
            return resp.text
        except Exception as e:
            logger.warning("Failed to fetch URL for summary", extra={"url": url, "error": str(e)})
            return None

    def _provider_and_model(self) -> tuple[str, str]:
        return (
            self._llm.__class__.__name__.replace("Backend", "").lower(),
            getattr(self._llm, "_model", "unknown"),
        )

    def _error_result(self, url: str, msg: str) -> SummarizeResult:
        provider, model = self._provider_and_model()
        return SummarizeResult(url=url, title=None, summary=msg, provider=provider, model=model, success=False)

    def _success_result(self, url: str, title: str | None, summary: str) -> SummarizeResult:
        provider, model = self._provider_and_model()
        return SummarizeResult(url=url, title=title, summary=summary, provider=provider, model=model, success=True)

    async def _store_cache(self, url: str, result: SummarizeResult) -> None:
        if self._cache and self._cache.available:
            await self._cache.set(CacheService.NAMESPACE_SUMMARY, result, settings.cache_summary_ttl_seconds, url)

    async def _summarize_image(
        self,
        url: str,
        item_title: str | None,
        item_snippet: str | None,
    ) -> SummarizeResult:
        context = (item_title or "") + (" " + item_snippet if item_snippet else "")
        text = context.strip() or f"An image at {url} (no text description available)."

        prompt = _SUMMARY_PROMPT_IMAGE.format(text=text)
        title = item_title

        try:
            summary = await self._llm.generate(prompt, _SUMMARY_SYSTEM)
            result = self._success_result(url, title, summary.strip() or "Could not describe image.")
            await self._store_cache(url, result)
            return result
        except Exception as e:
            logger.error("Image LLM summary failed", extra={"error": repr(e)})
            return self._error_result(url, f"Summary generation failed: {e}")

    async def _summarize_video(
        self,
        url: str,
        video_id: str | None,
        item_title: str | None,
        item_snippet: str | None,
    ) -> SummarizeResult:
        text_parts: list[str] = []
        title: str | None = item_title

        html = await self._fetch_page(url)
        if html:
            title = _legacy_extract_title(html) or item_title
            desc = _extract_meta_description(html) or ""
            text_parts.append(f"Title: {title}")
            if desc:
                text_parts.append(f"Description: {desc}")
        else:
            text_parts.append(f"Title: {item_title or 'Unknown'}")
            if item_snippet:
                text_parts.append(f"Description: {item_snippet}")

        if video_id:
            transcript = await self._fetch_transcript(video_id)
            if transcript:
                text_parts.append(f"Transcript:\n{transcript[:self._max_content_length]}")

        text = "\n\n".join(text_parts)
        if not text.strip():
            return self._error_result(url, "No video metadata available.")

        prompt = _SUMMARY_PROMPT_VIDEO.format(text=text)

        try:
            summary = await self._llm.generate(prompt, _SUMMARY_SYSTEM)
            result = self._success_result(url, title, summary.strip() or "Could not summarize video.")
            await self._store_cache(url, result)
            return result
        except Exception as e:
            logger.error("Video LLM summary failed", extra={"error": repr(e)})
            return self._error_result(url, f"Summary generation failed: {e}")

    async def _fetch_transcript(self, video_id: str) -> str | None:
        try:
            resp = await self._http.get(
                f"{_TRANSCRIPT_URL}/?v={video_id}&format=txt",
                timeout=5.0,
            )
            if resp.is_success and resp.text.strip():
                return resp.text.strip()
        except Exception:
            pass
        return None

    async def _summarize_article(self, url: str) -> SummarizeResult:
        html = await self._fetch_page(url)
        if html is None:
            return self._error_result(url, "Failed to fetch page.")

        title, text = extract_article(html)

        if text and _is_boilerplate_error(text):
            return self._error_result(url, "This page requires JavaScript and cannot be summarized automatically.")

        if not text:
            return self._error_result(url, "No readable content found on the page.")

        if len(text) > self._max_content_length:
            text = text[: self._max_content_length] + "..."

        prompt = _SUMMARY_PROMPT_ARTICLE.format(text=text)

        try:
            summary = await self._llm.generate(prompt, _SUMMARY_SYSTEM)
            result = self._success_result(url, title, summary.strip() or "No summary generated.")
            await self._store_cache(url, result)
            return result
        except Exception as e:
            logger.error("Article LLM summary failed", extra={"error": repr(e)})
            return self._error_result(url, f"Summary generation failed: {e}")
