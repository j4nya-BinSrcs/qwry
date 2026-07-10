import logging
from dataclasses import dataclass, field

from server.src.services.llm import LLMBackend
from server.src.services.reader import ReaderService, detect_content_type

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a research assistant. Answer the user's question based ONLY on the provided sources. "
    "Be concise and factual. Reference source numbers like [1] when using information from a source. "
    "If the sources don't contain enough information to answer, say so."
)

_PROMPT_TEMPLATE = """Answer the question based on these sources.

SOURCES:
{formatted_sources}

QUESTION: {question}

Provide a clear answer. Reference source numbers like [1] when using information from a source."""

_MAX_SOURCES = 5
_MAX_SOURCE_CHARS = 500


@dataclass
class ChatSource:
    url: str
    title: str | None = None


@dataclass
class ChatResult:
    answer: str
    sources: list[ChatSource] = field(default_factory=list)


class ChatService:
    def __init__(
        self,
        reader: ReaderService,
        llm: LLMBackend,
    ) -> None:
        self._reader = reader
        self._llm = llm

    async def answer(self, question: str, items: list[dict]) -> ChatResult:
        if not items:
            return ChatResult(answer="No items in this workspace to analyze.")

        used_sources: list[ChatSource] = []
        source_texts: list[str] = []

        for idx, item in enumerate(items[:_MAX_SOURCES]):
            url = item.get("url", "")
            title = item.get("title") or "Untitled"
            ctype, _ = detect_content_type(url)

            if ctype == "image":
                label = f"[Image] {title}"
                source_texts.append(f"[{idx + 1}] {label} ({url})\n(Image — visual content, no text available)")
                used_sources.append(ChatSource(url=url, title=label))

            elif ctype == "video":
                snippet = item.get("snippet") or title
                label = f"[Video] {title}"
                source_texts.append(f"[{idx + 1}] {label} ({url})\n{snippet}")
                used_sources.append(ChatSource(url=url, title=label))

            else:
                result = await self._reader.read_url(url)
                if not result.success or not result.content:
                    source_texts.append(f"[{idx + 1}] {title} ({url})\n(Content not available)")
                else:
                    content = result.content[:_MAX_SOURCE_CHARS]
                    if len(result.content) > _MAX_SOURCE_CHARS:
                        content += "..."
                    source_texts.append(f"[{idx + 1}] {title} ({url})\n{content}")
                used_sources.append(ChatSource(url=url, title=title))

        if not used_sources:
            return ChatResult(answer="Could not fetch content from any sources.")

        formatted = "\n\n".join(source_texts)
        prompt = _PROMPT_TEMPLATE.format(formatted_sources=formatted, question=question)

        logger.info("Chat prompt", extra={"source_count": len(used_sources), "question": question})
        try:
            answer = await self._llm.generate(prompt, _SYSTEM_PROMPT)
        except Exception as e:
            logger.error("Chat LLM generation failed", extra={"error": repr(e)})
            return ChatResult(answer=f"Failed to generate answer: {e}", sources=used_sources)

        return ChatResult(answer=answer.strip(), sources=used_sources)
