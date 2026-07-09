import logging
from uuid import UUID

from server.src.api.schemas import WorkspaceItemResponse, WorkspaceResponse
from server.src.db.models import Workspace, WorkspaceItem
from server.src.db.repository import WorkspaceItemRepo, WorkspaceRepo
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


MAX_ITEMS_PER_WORKSPACE = 100


def _ws_to_response(ws: Workspace, item_count: int = 0) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=ws.id,
        name=ws.name,
        description=ws.description,
        item_count=item_count,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


def _item_to_response(item: WorkspaceItem) -> WorkspaceItemResponse:
    return WorkspaceItemResponse(
        id=item.id,
        workspace_id=item.workspace_id,
        url=item.url,
        title=item.title,
        snippet=item.snippet,
        source=item.source,
        summary=item.summary,
        notes=item.notes,
        order_index=item.order_index,
        created_at=item.created_at,
    )


async def list_workspaces(session: AsyncSession, session_id: str) -> list[WorkspaceResponse]:
    repo = WorkspaceRepo(session)
    workspaces = await repo.list_by_session(session_id)
    result: list[WorkspaceResponse] = []
    for ws in workspaces:
        count = await repo.item_count(ws.id)
        result.append(_ws_to_response(ws, count))
    return result


async def create_workspace(
    session: AsyncSession,
    session_id: str,
    name: str,
    description: str | None,
) -> WorkspaceResponse:
    repo = WorkspaceRepo(session)
    ws = await repo.create(session_id, name, description)
    return _ws_to_response(ws)


async def get_workspace(session: AsyncSession, session_id: str, ws_id: UUID) -> WorkspaceResponse | None:
    repo = WorkspaceRepo(session)
    ws = await repo.get_by_session(ws_id, session_id)
    if not ws:
        return None
    count = await repo.item_count(ws.id)
    return _ws_to_response(ws, count)


async def update_workspace(
    session: AsyncSession,
    session_id: str,
    ws_id: UUID,
    name: str | None,
    description: str | None,
) -> WorkspaceResponse | None:
    repo = WorkspaceRepo(session)
    ws = await repo.update(ws_id, session_id, name, description)
    if not ws:
        return None
    count = await repo.item_count(ws.id)
    return _ws_to_response(ws, count)


async def delete_workspace(session: AsyncSession, session_id: str, ws_id: UUID) -> bool:
    repo = WorkspaceRepo(session)
    return await repo.delete(ws_id, session_id)


async def list_items(session: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceItemResponse]:
    ws_repo = WorkspaceRepo(session)
    ws = await ws_repo.get_by_session(ws_id, session_id)
    if not ws:
        return []
    item_repo = WorkspaceItemRepo(session)
    items = await item_repo.list_by_workspace(ws_id)
    return [_item_to_response(it) for it in items]


async def add_item(
    session: AsyncSession,
    session_id: str,
    ws_id: UUID,
    url: str,
    title: str | None,
    snippet: str | None,
    source: str | None,
) -> WorkspaceItemResponse | None:
    ws_repo = WorkspaceRepo(session)
    ws = await ws_repo.get_by_session(ws_id, session_id)
    if not ws:
        return None
    count = await ws_repo.item_count(ws_id)
    if count >= MAX_ITEMS_PER_WORKSPACE:
        raise ValueError(f"Workspace limit of {MAX_ITEMS_PER_WORKSPACE} items reached")
    item_repo = WorkspaceItemRepo(session)
    item = await item_repo.create(ws_id, url, title, snippet, source)
    return _item_to_response(item)


async def update_item(
    session: AsyncSession,
    session_id: str,
    item_id: UUID,
    ws_id: UUID | None,
    **kwargs: object,
) -> WorkspaceItemResponse | None:
    item_repo = WorkspaceItemRepo(session)
    item = await item_repo.get_by_id(item_id)
    if not item:
        return None
    ws_repo = WorkspaceRepo(session)
    ws = await ws_repo.get_by_session(item.workspace_id, session_id)
    if not ws:
        return None
    updated = await item_repo.update(item_id, **kwargs)
    if not updated:
        return None
    return _item_to_response(updated)


async def delete_item(session: AsyncSession, session_id: str, item_id: UUID) -> bool:
    item_repo = WorkspaceItemRepo(session)
    item = await item_repo.get_by_id(item_id)
    if not item:
        return False
    ws_repo = WorkspaceRepo(session)
    ws = await ws_repo.get_by_session(item.workspace_id, session_id)
    if not ws:
        return False
    return await item_repo.delete(item_id)
