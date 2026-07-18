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
    WorkspaceComparison,
    WorkspaceHighlight,
    WorkspaceImage,
    WorkspaceItem,
    WorkspaceNote,
    WorkspacePin,
    WorkspaceRead,
    WorkspaceTag,
    WorkspaceTagging,
    WorkspaceTimelineEvent,
    WorkspaceVideo,
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


# ── Workspace Station Repos ─────────────────────────────────────────────


class WorkspaceStationRepoBase:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _list_by_workspace(self, model: type, ws_id: UUID, order_by: object | None = None) -> list:
        stmt = select(model).where(model.workspace_id == ws_id)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def _get_by(self, model: type, entry_id: UUID) -> object | None:
        return await self._session.get(model, entry_id)

    async def _delete(self, model: type, entry_id: UUID) -> bool:
        obj = await self._session.get(model, entry_id)
        if not obj:
            return False
        await self._session.delete(obj)
        await self._session.commit()
        return True


class WorkspaceReadRepo(WorkspaceStationRepoBase):
    async def list_by_workspace(self, ws_id: UUID) -> list[WorkspaceRead]:
        return await self._list_by_workspace(WorkspaceRead, ws_id)

    async def get_by_id(self, entry_id: UUID) -> WorkspaceRead | None:
        return await self._get_by(WorkspaceRead, entry_id)

    async def create(self, ws_id: UUID, item_id: UUID, status: str = "unread") -> WorkspaceRead:
        obj = WorkspaceRead(workspace_id=ws_id, item_id=item_id, status=status)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def update_status(self, entry_id: UUID, status: str) -> WorkspaceRead | None:
        obj = await self.get_by_id(entry_id)
        if not obj:
            return None
        obj.status = status
        if status == "reading" and obj.started_at is None:
            obj.started_at = func.now()
        elif status == "completed" and obj.completed_at is None:
            obj.completed_at = func.now()
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def delete(self, entry_id: UUID) -> bool:
        return await self._delete(WorkspaceRead, entry_id)


class WorkspaceHighlightRepo(WorkspaceStationRepoBase):
    async def list_by_workspace(self, ws_id: UUID) -> list[WorkspaceHighlight]:
        return await self._list_by_workspace(WorkspaceHighlight, ws_id)

    async def get_by_id(self, entry_id: UUID) -> WorkspaceHighlight | None:
        return await self._get_by(WorkspaceHighlight, entry_id)

    async def create(self, ws_id: UUID, item_id: UUID, text: str, color: str | None = None,
                     note: str | None = None, page_url: str | None = None) -> WorkspaceHighlight:
        obj = WorkspaceHighlight(workspace_id=ws_id, item_id=item_id, text=text,
                                 color=color, note=note, page_url=page_url)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def delete(self, entry_id: UUID) -> bool:
        return await self._delete(WorkspaceHighlight, entry_id)


class WorkspaceNoteRepo(WorkspaceStationRepoBase):
    async def list_by_workspace(self, ws_id: UUID) -> list[WorkspaceNote]:
        return await self._list_by_workspace(WorkspaceNote, ws_id)

    async def get_by_id(self, entry_id: UUID) -> WorkspaceNote | None:
        return await self._get_by(WorkspaceNote, entry_id)

    async def create(self, ws_id: UUID, title: str, content: str = "") -> WorkspaceNote:
        obj = WorkspaceNote(workspace_id=ws_id, title=title, content=content)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def update(self, entry_id: UUID, title: str | None = None,
                     content: str | None = None) -> WorkspaceNote | None:
        obj = await self.get_by_id(entry_id)
        if not obj:
            return None
        if title is not None:
            obj.title = title
        if content is not None:
            obj.content = content
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def delete(self, entry_id: UUID) -> bool:
        return await self._delete(WorkspaceNote, entry_id)


class WorkspacePinRepo(WorkspaceStationRepoBase):
    async def list_by_workspace(self, ws_id: UUID) -> list[WorkspacePin]:
        return await self._list_by_workspace(WorkspacePin, ws_id, WorkspacePin.order_index)

    async def get_by_id(self, entry_id: UUID) -> WorkspacePin | None:
        return await self._get_by(WorkspacePin, entry_id)

    async def create(self, ws_id: UUID, pinnable_type: str, pinnable_id: UUID) -> WorkspacePin:
        result = await self._session.execute(
            select(func.count()).select_from(WorkspacePin).where(WorkspacePin.workspace_id == ws_id),
        )
        next_index = (result.scalar() or 0) + 1
        obj = WorkspacePin(workspace_id=ws_id, pinnable_type=pinnable_type,
                           pinnable_id=pinnable_id, order_index=next_index)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def reorder(self, ws_id: UUID, pin_ids: list[UUID]) -> list[WorkspacePin]:
        pins = {p.id: p for p in await self.list_by_workspace(ws_id)}
        for idx, pin_id in enumerate(pin_ids, start=1):
            if pin_id in pins:
                pins[pin_id].order_index = idx
        await self._session.commit()
        return await self.list_by_workspace(ws_id)

    async def delete(self, entry_id: UUID) -> bool:
        return await self._delete(WorkspacePin, entry_id)


class WorkspaceImageRepo(WorkspaceStationRepoBase):
    async def list_by_workspace(self, ws_id: UUID) -> list[WorkspaceImage]:
        return await self._list_by_workspace(WorkspaceImage, ws_id)

    async def get_by_id(self, entry_id: UUID) -> WorkspaceImage | None:
        return await self._get_by(WorkspaceImage, entry_id)

    async def create(self, ws_id: UUID, url: str, item_id: UUID | None = None,
                     caption: str | None = None, resolution_w: int | None = None,
                     resolution_h: int | None = None, license: str | None = None) -> WorkspaceImage:
        obj = WorkspaceImage(workspace_id=ws_id, item_id=item_id, url=url, caption=caption,
                             resolution_w=resolution_w, resolution_h=resolution_h, license=license)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def delete(self, entry_id: UUID) -> bool:
        return await self._delete(WorkspaceImage, entry_id)


class WorkspaceVideoRepo(WorkspaceStationRepoBase):
    async def list_by_workspace(self, ws_id: UUID) -> list[WorkspaceVideo]:
        return await self._list_by_workspace(WorkspaceVideo, ws_id)

    async def get_by_id(self, entry_id: UUID) -> WorkspaceVideo | None:
        return await self._get_by(WorkspaceVideo, entry_id)

    async def create(self, ws_id: UUID, url: str, item_id: UUID | None = None,
                     title: str | None = None, thumbnail: str | None = None,
                     duration_secs: int | None = None, creator: str | None = None,
                     platform: str | None = None, transcript: str | None = None,
                     summary: str | None = None) -> WorkspaceVideo:
        obj = WorkspaceVideo(workspace_id=ws_id, item_id=item_id, url=url, title=title,
                             thumbnail=thumbnail, duration_secs=duration_secs,
                             creator=creator, platform=platform, transcript=transcript,
                             summary=summary)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def update(self, entry_id: UUID, **kwargs: object) -> WorkspaceVideo | None:
        obj = await self.get_by_id(entry_id)
        if not obj:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(obj, key):
                setattr(obj, key, value)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def delete(self, entry_id: UUID) -> bool:
        return await self._delete(WorkspaceVideo, entry_id)


class WorkspaceComparisonRepo(WorkspaceStationRepoBase):
    async def list_by_workspace(self, ws_id: UUID) -> list[WorkspaceComparison]:
        return await self._list_by_workspace(WorkspaceComparison, ws_id)

    async def get_by_id(self, entry_id: UUID) -> WorkspaceComparison | None:
        return await self._get_by(WorkspaceComparison, entry_id)

    async def create(self, ws_id: UUID, title: str, data: dict | None = None) -> WorkspaceComparison:
        obj = WorkspaceComparison(workspace_id=ws_id, title=title, data=data)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def update(self, entry_id: UUID, title: str | None = None,
                     data: dict | None = None) -> WorkspaceComparison | None:
        obj = await self.get_by_id(entry_id)
        if not obj:
            return None
        if title is not None:
            obj.title = title
        if data is not None:
            obj.data = data
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def delete(self, entry_id: UUID) -> bool:
        return await self._delete(WorkspaceComparison, entry_id)


class WorkspaceTimelineRepo(WorkspaceStationRepoBase):
    async def list_by_workspace(self, ws_id: UUID, limit: int = 200) -> list[WorkspaceTimelineEvent]:
        result = await self._session.execute(
            select(WorkspaceTimelineEvent)
            .where(WorkspaceTimelineEvent.workspace_id == ws_id)
            .order_by(WorkspaceTimelineEvent.created_at.desc())
            .limit(limit),
        )
        return list(result.scalars().all())

    async def create(self, ws_id: UUID, action_type: str, object_type: str,
                     object_id: UUID, event_metadata: dict | None = None) -> WorkspaceTimelineEvent:
        obj = WorkspaceTimelineEvent(workspace_id=ws_id, action_type=action_type,
                                     object_type=object_type, object_id=object_id, event_metadata=event_metadata)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj


class WorkspaceTagRepo(WorkspaceStationRepoBase):
    async def list_by_workspace(self, ws_id: UUID) -> list[WorkspaceTag]:
        return await self._list_by_workspace(WorkspaceTag, ws_id)

    async def get_by_id(self, entry_id: UUID) -> WorkspaceTag | None:
        return await self._get_by(WorkspaceTag, entry_id)

    async def create(self, ws_id: UUID, name: str, color: str | None = None) -> WorkspaceTag:
        obj = WorkspaceTag(workspace_id=ws_id, name=name, color=color)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def delete(self, entry_id: UUID) -> bool:
        return await self._delete(WorkspaceTag, entry_id)


class WorkspaceTaggingRepo(WorkspaceStationRepoBase):
    async def list_by_object(self, tag_id: UUID) -> list[WorkspaceTagging]:
        result = await self._session.execute(
            select(WorkspaceTagging).where(WorkspaceTagging.tag_id == tag_id),
        )
        return list(result.scalars().all())

    async def list_by_taggable(self, taggable_type: str, taggable_id: UUID) -> list[WorkspaceTagging]:
        result = await self._session.execute(
            select(WorkspaceTagging).where(
                WorkspaceTagging.taggable_type == taggable_type,
                WorkspaceTagging.taggable_id == taggable_id,
            ),
        )
        return list(result.scalars().all())

    async def assign(self, tag_id: UUID, taggable_type: str, taggable_id: UUID) -> WorkspaceTagging:
        obj = WorkspaceTagging(tag_id=tag_id, taggable_type=taggable_type, taggable_id=taggable_id)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)
        return obj

    async def unassign(self, tag_id: UUID, taggable_type: str, taggable_id: UUID) -> bool:
        result = await self._session.execute(
            select(WorkspaceTagging).where(
                WorkspaceTagging.tag_id == tag_id,
                WorkspaceTagging.taggable_type == taggable_type,
                WorkspaceTagging.taggable_id == taggable_id,
            ),
        )
        obj = result.scalar_one_or_none()
        if not obj:
            return False
        await self._session.delete(obj)
        await self._session.commit()
        return True
