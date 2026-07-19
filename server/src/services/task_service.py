import logging
from uuid import UUID

from server.src.api.schemas import WorkspaceTaskResponse
from server.src.db.models import Workspace, WorkspaceTask
from server.src.db.repository import WorkspaceRepo, WorkspaceTaskRepo
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def _require_workspace(db: AsyncSession, session_id: str, ws_id: UUID) -> Workspace:
    repo = WorkspaceRepo(db)
    ws = await repo.get_by_session(ws_id, session_id)
    if not ws:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


async def list_tasks(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceTaskResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceTaskRepo(db)
    return [_task_to_response(t) for t in await repo.list_by_workspace(ws_id)]


async def create_task(
    db: AsyncSession, session_id: str, ws_id: UUID, title: str,
    description: str | None = None, status: str = "pending", priority: str = "medium",
    due_date: object = None, assignee: str | None = None,
) -> WorkspaceTaskResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceTaskRepo(db)
    from datetime import datetime
    due = due_date if isinstance(due_date, datetime) else None
    obj = await repo.create(ws_id, title, description, status, priority, due, assignee)
    return _task_to_response(obj)


async def update_task(
    db: AsyncSession, session_id: str, entry_id: UUID, **kwargs: object,
) -> WorkspaceTaskResponse:
    repo = WorkspaceTaskRepo(db)
    obj = await repo.update(entry_id, **kwargs)
    if not obj:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_to_response(obj)


async def delete_task(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspaceTaskRepo(db).delete(entry_id)


def _task_to_response(t: WorkspaceTask) -> WorkspaceTaskResponse:
    return WorkspaceTaskResponse(
        id=t.id, workspace_id=t.workspace_id, title=t.title,
        description=t.description, status=t.status, priority=t.priority,
        due_date=t.due_date, assignee=t.assignee,
        created_at=t.created_at, updated_at=t.updated_at, completed_at=t.completed_at,
    )
