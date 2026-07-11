from uuid import UUID

from server.src.db.models import (
    ActivityLog,
    LLMOverview,
    Profile,
    ReadingListItem,
    SearchHistory,
    SummaryListItem,
    User,
    Workspace,
    WorkspaceItem,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


class UserRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, email: str, display_name: str) -> User:
        user = User(email=email, display_name=display_name)
        self._session.add(user)
        await self._session.commit()
        await self._session.refresh(user)
        return user

    async def get_by_id(self, user_id: UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def list_all(self) -> list[User]:
        result = await self._session.execute(select(User).order_by(User.created_at.desc()))
        return list(result.scalars().all())

    async def delete(self, user_id: UUID) -> bool:
        user = await self.get_by_id(user_id)
        if not user:
            return False
        await self._session.delete(user)
        await self._session.commit()
        return True


class WorkspaceRepo:
    MAX_ITEMS = 100

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_session(self, session_id: str) -> list[Workspace]:
        stmt = select(Workspace).where(Workspace.session_id == session_id).order_by(Workspace.updated_at.desc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_session(self, ws_id: UUID, session_id: str) -> Workspace | None:
        result = await self._session.execute(
            select(Workspace).where(Workspace.id == ws_id, Workspace.session_id == session_id),
        )
        return result.scalar_one_or_none()

    async def create(self, session_id: str, name: str, description: str | None = None) -> Workspace:
        ws = Workspace(session_id=session_id, name=name, description=description)
        self._session.add(ws)
        await self._session.commit()
        await self._session.refresh(ws)
        return ws

    async def update(self, ws_id: UUID, session_id: str, name: str | None, description: str | None) -> Workspace | None:
        ws = await self.get_by_session(ws_id, session_id)
        if not ws:
            return None
        if name is not None:
            ws.name = name
        if description is not None:
            ws.description = description
        ws.updated_at = func.now()
        await self._session.commit()
        await self._session.refresh(ws)
        return ws

    async def delete(self, ws_id: UUID, session_id: str) -> bool:
        ws = await self.get_by_session(ws_id, session_id)
        if not ws:
            return False
        await self._session.delete(ws)
        await self._session.commit()
        return True

    async def item_count(self, ws_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count()).select_from(WorkspaceItem).where(WorkspaceItem.workspace_id == ws_id),
        )
        return result.scalar() or 0


class WorkspaceItemRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_workspace(self, ws_id: UUID) -> list[WorkspaceItem]:
        result = await self._session.execute(
            select(WorkspaceItem)
            .where(WorkspaceItem.workspace_id == ws_id)
            .order_by(WorkspaceItem.order_index, WorkspaceItem.created_at.desc()),
        )
        return list(result.scalars().all())

    async def get_by_id(self, item_id: UUID) -> WorkspaceItem | None:
        return await self._session.get(WorkspaceItem, item_id)

    async def create(
        self,
        ws_id: UUID,
        url: str,
        media_url: str | None = None,
        title: str | None = None,
        snippet: str | None = None,
        source: str | None = None,
    ) -> WorkspaceItem:
        item = WorkspaceItem(
            workspace_id=ws_id, url=url, media_url=media_url, title=title, snippet=snippet, source=source
        )
        self._session.add(item)
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def update(self, item_id: UUID, **kwargs: object) -> WorkspaceItem | None:
        item = await self.get_by_id(item_id)
        if not item:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(item, key):
                setattr(item, key, value)
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def delete(self, item_id: UUID) -> bool:
        item = await self.get_by_id(item_id)
        if not item:
            return False
        await self._session.delete(item)
        await self._session.commit()
        return True


# ── Profile ─────────────────────────────────────────────────────────────


class ProfileRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, session_id: str) -> Profile | None:
        return await self._session.get(Profile, session_id)

    async def create(self, session_id: str) -> Profile:
        profile = Profile(session_id=session_id)
        self._session.add(profile)
        await self._session.commit()
        await self._session.refresh(profile)
        return profile

    async def update(
        self, session_id: str, username: str | None = None, theme: str | None = None, search_provider: str | None = None
    ) -> Profile | None:
        profile = await self.get(session_id)
        if not profile:
            return None
        if username is not None:
            profile.username = username
        if theme is not None:
            profile.theme = theme
        if search_provider is not None:
            profile.search_provider = search_provider
        profile.last_active = func.now()
        await self._session.commit()
        await self._session.refresh(profile)
        return profile

    async def touch(self, session_id: str) -> None:
        profile = await self.get(session_id)
        if profile:
            profile.last_active = func.now()
            await self._session.commit()


# ── Search History ──────────────────────────────────────────────────────


class SearchHistoryRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, session_id: str, query: str, provider: str | None = None) -> SearchHistory:
        entry = SearchHistory(session_id=session_id, query=query, provider=provider)
        self._session.add(entry)
        await self._session.commit()
        await self._session.refresh(entry)
        return entry

    async def list_by_session(self, session_id: str, limit: int = 50) -> list[SearchHistory]:
        result = await self._session.execute(
            select(SearchHistory)
            .where(SearchHistory.session_id == session_id)
            .order_by(SearchHistory.searched_at.desc())
            .limit(limit),
        )
        return list(result.scalars().all())


# ── Reading List ────────────────────────────────────────────────────────


class ReadingListRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(
        self, session_id: str, url: str, title: str | None = None, source: str | None = None,
        content: str | None = None, content_type: str | None = None, media_url: str | None = None,
    ) -> ReadingListItem:
        stmt = (
            select(ReadingListItem)
            .where(ReadingListItem.session_id == session_id, ReadingListItem.url == url)
        )
        result = await self._session.execute(stmt)
        item = result.scalar_one_or_none()
        if item:
            if title is not None:
                item.title = title
            if source is not None:
                item.source = source
            if content is not None:
                item.content = content
            if content_type is not None:
                item.content_type = content_type
            if media_url is not None:
                item.media_url = media_url
        else:
            item = ReadingListItem(
                session_id=session_id, url=url, title=title, source=source,
                content=content, content_type=content_type, media_url=media_url,
            )
            self._session.add(item)
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def add(self, session_id: str, url: str, title: str | None = None, source: str | None = None) -> ReadingListItem:
        return await self.upsert(session_id, url, title=title, source=source)

    async def list_by_session(self, session_id: str, limit: int = 50) -> list[ReadingListItem]:
        result = await self._session.execute(
            select(ReadingListItem)
            .where(ReadingListItem.session_id == session_id)
            .order_by(ReadingListItem.saved_at.desc())
            .limit(limit),
        )
        return list(result.scalars().all())


# ── Summary List ────────────────────────────────────────────────────────


class SummaryListRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(
        self, session_id: str, url: str, title: str | None = None, source: str | None = None,
        summary: str | None = None, model: str | None = None,
    ) -> SummaryListItem:
        stmt = (
            select(SummaryListItem)
            .where(SummaryListItem.session_id == session_id, SummaryListItem.url == url)
        )
        result = await self._session.execute(stmt)
        item = result.scalar_one_or_none()
        if item:
            if title is not None:
                item.title = title
            if source is not None:
                item.source = source
            if summary is not None:
                item.summary = summary
            if model is not None:
                item.model = model
        else:
            item = SummaryListItem(
                session_id=session_id, url=url, title=title, source=source,
                summary=summary, model=model,
            )
            self._session.add(item)
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def add(self, session_id: str, url: str, title: str | None = None, source: str | None = None) -> SummaryListItem:
        return await self.upsert(session_id, url, title=title, source=source)

    async def list_by_session(self, session_id: str, limit: int = 50) -> list[SummaryListItem]:
        result = await self._session.execute(
            select(SummaryListItem)
            .where(SummaryListItem.session_id == session_id)
            .order_by(SummaryListItem.saved_at.desc())
            .limit(limit),
        )
        return list(result.scalars().all())


# ── Activity Log ────────────────────────────────────────────────────────


class ActivityLogRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, session_id: str, action_type: str, details: dict | None = None) -> ActivityLog:
        entry = ActivityLog(session_id=session_id, action_type=action_type, details=details)
        self._session.add(entry)
        await self._session.commit()
        await self._session.refresh(entry)
        return entry

    async def list_by_session(self, session_id: str, limit: int = 100) -> list[ActivityLog]:
        result = await self._session.execute(
            select(ActivityLog)
            .where(ActivityLog.session_id == session_id)
            .order_by(ActivityLog.created_at.desc())
            .limit(limit),
        )
        return list(result.scalars().all())


# ── LLM Overviews ───────────────────────────────────────────────────────


class OverviewRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(self, session_id: str, query: str, overview: str) -> LLMOverview:
        stmt = (
            select(LLMOverview)
            .where(LLMOverview.session_id == session_id, LLMOverview.query == query)
        )
        result = await self._session.execute(stmt)
        entry = result.scalar_one_or_none()
        if entry:
            entry.overview = overview
        else:
            entry = LLMOverview(session_id=session_id, query=query, overview=overview)
            self._session.add(entry)
        await self._session.commit()
        await self._session.refresh(entry)
        return entry

    async def get_by_query(self, session_id: str, query: str) -> LLMOverview | None:
        result = await self._session.execute(
            select(LLMOverview)
            .where(LLMOverview.session_id == session_id, LLMOverview.query == query)
        )
        return result.scalar_one_or_none()
