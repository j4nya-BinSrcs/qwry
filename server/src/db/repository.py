from uuid import UUID

from server.src.db.models import User, Workspace, WorkspaceItem
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
