import logging
from uuid import UUID

from server.src.api.schemas import (
    CanvasConnectionResponse,
    CanvasNodeResponse,
)
from server.src.db.models import (
    CanvasConnection,
    CanvasNode,
    Workspace,
)
from server.src.db.repository import (
    CanvasConnectionRepo,
    CanvasNodeRepo,
    WorkspaceRepo,
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def _require_workspace(db: AsyncSession, session_id: str, ws_id: UUID) -> Workspace:
    repo = WorkspaceRepo(db)
    ws = await repo.get_by_session(ws_id, session_id)
    if not ws:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


# ── Nodes ──────────────────────────────────────────────────────────────────


async def list_nodes(db: AsyncSession, session_id: str, ws_id: UUID) -> list[CanvasNodeResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = CanvasNodeRepo(db)
    return [_node_to_response(n) for n in await repo.list_by_workspace(ws_id)]


async def get_node(db: AsyncSession, session_id: str, node_id: UUID) -> CanvasNodeResponse:
    repo = CanvasNodeRepo(db)
    obj = await repo.get_by_id(node_id)
    if not obj:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Canvas node not found")
    return _node_to_response(obj)


async def create_node(
    db: AsyncSession, session_id: str, ws_id: UUID, object_type: str, object_id: UUID,
    x: float = 0.0, y: float = 0.0, width: float | None = None, height: float | None = None,
    z_index: int = 0, pinned: bool = False, label: str | None = None, color: str | None = None,
) -> CanvasNodeResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = CanvasNodeRepo(db)
    obj = await repo.create(ws_id, object_type, object_id, x, y, width, height, z_index, pinned, label, color)
    return _node_to_response(obj)


async def update_node(
    db: AsyncSession, session_id: str, node_id: UUID, **kwargs: object,
) -> CanvasNodeResponse:
    repo = CanvasNodeRepo(db)
    obj = await repo.update(node_id, **kwargs)
    if not obj:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Canvas node not found")
    return _node_to_response(obj)


async def delete_node(db: AsyncSession, session_id: str, node_id: UUID) -> bool:
    return await CanvasNodeRepo(db).delete(node_id)


def _node_to_response(n: CanvasNode) -> CanvasNodeResponse:
    return CanvasNodeResponse(
        id=n.id, workspace_id=n.workspace_id, object_type=n.object_type,
        object_id=n.object_id, x=n.x, y=n.y, width=n.width, height=n.height,
        z_index=n.z_index, pinned=n.pinned, label=n.label, color=n.color,
        created_at=n.created_at, updated_at=n.updated_at,
    )


# ── Connections ────────────────────────────────────────────────────────────


async def list_connections(db: AsyncSession, session_id: str, ws_id: UUID) -> list[CanvasConnectionResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = CanvasConnectionRepo(db)
    return [_connection_to_response(c) for c in await repo.list_by_workspace(ws_id)]


async def create_connection(
    db: AsyncSession, session_id: str, ws_id: UUID, source_node_id: UUID, target_node_id: UUID,
    label: str | None = None, style: str = "solid", color: str | None = None,
) -> CanvasConnectionResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = CanvasConnectionRepo(db)
    obj = await repo.create(ws_id, source_node_id, target_node_id, label, style, color)
    return _connection_to_response(obj)


async def delete_connection(db: AsyncSession, session_id: str, conn_id: UUID) -> bool:
    return await CanvasConnectionRepo(db).delete(conn_id)


def _connection_to_response(c: CanvasConnection) -> CanvasConnectionResponse:
    return CanvasConnectionResponse(
        id=c.id, workspace_id=c.workspace_id, source_node_id=c.source_node_id,
        target_node_id=c.target_node_id, label=c.label, style=c.style,
        color=c.color, created_at=c.created_at,
    )
