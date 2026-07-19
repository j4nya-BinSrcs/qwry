import logging
from uuid import UUID

from server.src.api.schemas import WorkspaceAIResponseResponse
from server.src.db.models import Workspace, WorkspaceAIResponse
from server.src.db.repository import WorkspaceAIResponseRepo, WorkspaceRepo
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def _require_workspace(db: AsyncSession, session_id: str, ws_id: UUID) -> Workspace:
    repo = WorkspaceRepo(db)
    ws = await repo.get_by_session(ws_id, session_id)
    if not ws:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


async def list_ai_responses(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceAIResponseResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceAIResponseRepo(db)
    return [_resp_to_response(r) for r in await repo.list_by_workspace(ws_id)]


async def create_ai_response(
    db: AsyncSession, session_id: str, ws_id: UUID, title: str, prompt: str = "",
    response_text: str = "", model: str | None = None, provider: str | None = None,
    tokens_in: int | None = None, tokens_out: int | None = None,
) -> WorkspaceAIResponseResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceAIResponseRepo(db)
    obj = await repo.create(ws_id, title, prompt, response_text, model, provider, tokens_in, tokens_out)
    return _resp_to_response(obj)


async def update_ai_response(
    db: AsyncSession, session_id: str, entry_id: UUID, **kwargs: object,
) -> WorkspaceAIResponseResponse:
    repo = WorkspaceAIResponseRepo(db)
    obj = await repo.update(entry_id, **kwargs)
    if not obj:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="AI response not found")
    return _resp_to_response(obj)


async def delete_ai_response(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspaceAIResponseRepo(db).delete(entry_id)


def _resp_to_response(r: WorkspaceAIResponse) -> WorkspaceAIResponseResponse:
    return WorkspaceAIResponseResponse(
        id=r.id, workspace_id=r.workspace_id, title=r.title, prompt=r.prompt,
        response_text=r.response_text, model=r.model, provider=r.provider,
        tokens_in=r.tokens_in, tokens_out=r.tokens_out,
        created_at=r.created_at, updated_at=r.updated_at,
    )
