import logging

from server.src.db.repository import (
    ActivityLogRepo,
    OverviewRepo,
    ProfileRepo,
    ReadingListRepo,
    SearchHistoryRepo,
    SummaryListRepo,
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class ProfileService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._profile_repo = ProfileRepo(session)
        self._search_history_repo = SearchHistoryRepo(session)
        self._reading_list_repo = ReadingListRepo(session)
        self._summary_list_repo = SummaryListRepo(session)
        self._activity_log_repo = ActivityLogRepo(session)
        self._overview_repo = OverviewRepo(session)

    # ── Profile ──────────────────────────────────────────────────────

    async def get_or_create_profile(self, session_id: str):
        profile = await self._profile_repo.get(session_id)
        if not profile:
            profile = await self._profile_repo.create(session_id)
            logger.info("Created profile", extra={"session_id": session_id})
        else:
            await self._profile_repo.touch(session_id)
        return profile

    async def update_profile(self, session_id: str, username: str | None = None, theme: str | None = None, search_provider: str | None = None):
        profile = await self._profile_repo.update(session_id, username, theme, search_provider)
        if profile:
            await self.log_activity(session_id, "profile_update", {"username": username, "theme": theme, "search_provider": search_provider})
        return profile

    # ── Search History ───────────────────────────────────────────────

    async def log_search(self, session_id: str, query: str, provider: str | None = None):
        await self._profile_repo.touch(session_id)
        entry = await self._search_history_repo.add(session_id, query, provider)
        await self.log_activity(session_id, "search", {"query": query, "provider": provider})
        return entry

    async def get_search_history(self, session_id: str, limit: int = 50):
        return await self._search_history_repo.list_by_session(session_id, limit)

    # ── Reading List ─────────────────────────────────────────────────

    async def log_read(
        self, session_id: str, url: str, title: str | None = None, source: str | None = None,
        content: str | None = None, content_type: str | None = None, media_url: str | None = None,
    ):
        await self._profile_repo.touch(session_id)
        entry = await self._reading_list_repo.upsert(
            session_id, url, title=title, source=source,
            content=content, content_type=content_type, media_url=media_url,
        )
        await self.log_activity(session_id, "read", {"url": url, "title": title, "source": source})
        return entry

    async def get_reading_list(self, session_id: str, limit: int = 50):
        return await self._reading_list_repo.list_by_session(session_id, limit)

    # ── Summary List ─────────────────────────────────────────────────

    async def log_summary(
        self, session_id: str, url: str, title: str | None = None, source: str | None = None,
        summary: str | None = None, model: str | None = None,
    ):
        await self._profile_repo.touch(session_id)
        entry = await self._summary_list_repo.upsert(
            session_id, url, title=title, source=source,
            summary=summary, model=model,
        )
        await self.log_activity(session_id, "summarize", {"url": url, "title": title, "source": source})
        return entry

    async def get_summary_list(self, session_id: str, limit: int = 50):
        return await self._summary_list_repo.list_by_session(session_id, limit)

    # ── LLM Overviews ────────────────────────────────────────────────

    async def save_overview(self, session_id: str, query: str, overview: str):
        await self._profile_repo.touch(session_id)
        entry = await self._overview_repo.upsert(session_id, query, overview)
        await self.log_activity(session_id, "overview", {"query": query})
        return entry

    async def get_overview(self, session_id: str, query: str):
        return await self._overview_repo.get_by_query(session_id, query)

    # ── Activity Log ─────────────────────────────────────────────────

    async def log_activity(self, session_id: str, action_type: str, details: dict | None = None):
        return await self._activity_log_repo.add(session_id, action_type, details)

    async def get_activity_log(self, session_id: str, limit: int = 100):
        return await self._activity_log_repo.list_by_session(session_id, limit)
