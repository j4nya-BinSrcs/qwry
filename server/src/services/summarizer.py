import logging
import re
import time
from dataclasses import dataclass
from html.parser import HTMLParser

import httpx
from server.src.services.llm import LLMBackend

logger = logging.getLogger(__name__)


@dataclass
class SummarizeResult:
    url: str
    title: str | None
    summary: str
    provider: str
    model: str


class _TextExtractor(HTMLParser):
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


def _extract_text(html: str) -> str:
    parser = _TextExtractor()
    parser.feed(html)
    return parser.get_text()


def _extract_title(html: str) -> str | None:
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    return m.group(1).strip() if m else None


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
    ) -> None:
        self._llm = llm
        self._http = http_client
        self._max_content_length = max_content_length

    async def summarize_url(self, url: str) -> SummarizeResult:
        logger.info("Summarizing URL", extra={"url": url})
        t_start = time.monotonic()

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        }
        try:
            resp = await self._http.get(url, timeout=10.0, follow_redirects=True, headers=headers)
            resp.raise_for_status()
        except Exception as e:
            logger.warning("Failed to fetch URL for summary", extra={"url": url, "error": str(e)})
            return SummarizeResult(
                url=url,
                title=None,
                summary=f"Failed to fetch page: {e}",
                provider=self._llm.__class__.__name__.replace("Backend", "").lower(),
                model=getattr(self._llm, "_model", "unknown"),
            )

        t_fetch = time.monotonic()
        logger.info("Page fetched", extra={"url": url, "elapsed_ms": round((t_fetch - t_start) * 1000, 1)})

        html = resp.text
        title = _extract_title(html)
        text = _extract_text(html)

        if not text:
            return SummarizeResult(
                url=url,
                title=title,
                summary="No readable content found on the page.",
                provider=self._llm.__class__.__name__.replace("Backend", "").lower(),
                model=getattr(self._llm, "_model", "unknown"),
            )

        if len(text) > self._max_content_length:
            text = text[: self._max_content_length] + "..."

        prompt = SUMMARIZE_PROMPT.format(text=text)

        try:
            summary = await self._llm.generate(prompt, SUMMARIZE_SYSTEM_PROMPT)
        except Exception as e:
            t_llm = time.monotonic()
            logger.error(
                "LLM generation failed",
                extra={"url": url, "error": str(e), "elapsed_ms": round((t_llm - t_fetch) * 1000, 1)},
            )
            summary = f"Summary generation failed: {e}" if str(e) else "Summary generation failed."

        t_llm = time.monotonic()
        logger.info(
            "Summary generated",
            extra={"url": url, "elapsed_ms": round((t_llm - t_fetch) * 1000, 1)},
        )

        return SummarizeResult(
            url=url,
            title=title,
            summary=summary.strip() or "No summary generated.",
            provider=self._llm.__class__.__name__.replace("Backend", "").lower(),
            model=getattr(self._llm, "_model", "unknown"),
        )
