import logging
from uuid import UUID

from server.src.api.schemas import (
    WorkspaceComparisonResponse,
    WorkspaceHighlightResponse,
    WorkspaceImageResponse,
    WorkspaceNoteResponse,
    WorkspacePinResponse,
    WorkspaceReadResponse,
    WorkspaceSearchResult,
    WorkspaceStatsResponse,
    WorkspaceTagResponse,
    WorkspaceTimelineEventResponse,
    WorkspaceVideoResponse,
)
from server.src.db.models import (
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
from server.src.db.repository import (
    WorkspaceComparisonRepo,
    WorkspaceHighlightRepo,
    WorkspaceImageRepo,
    WorkspaceItemRepo,
    WorkspaceNoteRepo,
    WorkspacePinRepo,
    WorkspaceReadRepo,
    WorkspaceRepo,
    WorkspaceTagRepo,
    WorkspaceTaggingRepo,
    WorkspaceTimelineRepo,
    WorkspaceVideoRepo,
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


# ── Reads ────────────────────────────────────────────────────────────────


async def list_reads(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceReadResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceReadRepo(db)
    return [_read_to_response(r) for r in await repo.list_by_workspace(ws_id)]


async def create_read(
    db: AsyncSession, session_id: str, ws_id: UUID, item_id: UUID, status: str,
) -> WorkspaceReadResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceReadRepo(db)
    obj = await repo.create(ws_id, item_id, status)
    await _record_timeline(db, ws_id, "created", "read", obj.id)
    return _read_to_response(obj)


async def update_read_status(
    db: AsyncSession, session_id: str, entry_id: UUID, status: str,
) -> WorkspaceReadResponse:
    repo = WorkspaceReadRepo(db)
    obj = await repo.update_status(entry_id, status)
    if not obj:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Read entry not found")
    return _read_to_response(obj)


async def delete_read(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspaceReadRepo(db).delete(entry_id)


def _read_to_response(r: WorkspaceRead) -> WorkspaceReadResponse:
    return WorkspaceReadResponse(
        id=r.id, workspace_id=r.workspace_id, item_id=r.item_id,
        status=r.status, started_at=r.started_at, completed_at=r.completed_at,
        created_at=r.created_at,
    )


# ── Highlights ───────────────────────────────────────────────────────────


async def list_highlights(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceHighlightResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceHighlightRepo(db)
    return [_highlight_to_response(h) for h in await repo.list_by_workspace(ws_id)]


async def create_highlight(
    db: AsyncSession, session_id: str, ws_id: UUID, item_id: UUID,
    text: str, color: str | None = None, note: str | None = None,
    page_url: str | None = None,
) -> WorkspaceHighlightResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceHighlightRepo(db)
    obj = await repo.create(ws_id, item_id, text, color, note, page_url)
    await _record_timeline(db, ws_id, "created", "highlight", obj.id)
    return _highlight_to_response(obj)


async def delete_highlight(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspaceHighlightRepo(db).delete(entry_id)


def _highlight_to_response(h: WorkspaceHighlight) -> WorkspaceHighlightResponse:
    return WorkspaceHighlightResponse(
        id=h.id, workspace_id=h.workspace_id, item_id=h.item_id,
        text=h.text, color=h.color, note=h.note, page_url=h.page_url,
        created_at=h.created_at,
    )


# ── Notes ────────────────────────────────────────────────────────────────


async def list_notes(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceNoteResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceNoteRepo(db)
    return [_note_to_response(n) for n in await repo.list_by_workspace(ws_id)]


async def create_note(
    db: AsyncSession, session_id: str, ws_id: UUID, title: str, content: str = "",
) -> WorkspaceNoteResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceNoteRepo(db)
    obj = await repo.create(ws_id, title, content)
    await _record_timeline(db, ws_id, "created", "note", obj.id)
    return _note_to_response(obj)


async def update_note(
    db: AsyncSession, session_id: str, entry_id: UUID, title: str | None = None, content: str | None = None,
) -> WorkspaceNoteResponse:
    repo = WorkspaceNoteRepo(db)
    obj = await repo.update(entry_id, title, content)
    if not obj:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Note not found")
    return _note_to_response(obj)


async def delete_note(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspaceNoteRepo(db).delete(entry_id)


def _note_to_response(n: WorkspaceNote) -> WorkspaceNoteResponse:
    return WorkspaceNoteResponse(
        id=n.id, workspace_id=n.workspace_id, title=n.title, content=n.content,
        created_at=n.created_at, updated_at=n.updated_at,
    )


# ── Pins ─────────────────────────────────────────────────────────────────


async def list_pins(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspacePinResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspacePinRepo(db)
    return [_pin_to_response(p) for p in await repo.list_by_workspace(ws_id)]


async def create_pin(
    db: AsyncSession, session_id: str, ws_id: UUID, pinnable_type: str, pinnable_id: UUID,
) -> WorkspacePinResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspacePinRepo(db)
    obj = await repo.create(ws_id, pinnable_type, pinnable_id)
    await _record_timeline(db, ws_id, "created", "pin", obj.id)
    return _pin_to_response(obj)


async def reorder_pins(
    db: AsyncSession, session_id: str, ws_id: UUID, pin_ids: list[UUID],
) -> list[WorkspacePinResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspacePinRepo(db)
    pins = await repo.reorder(ws_id, pin_ids)
    return [_pin_to_response(p) for p in pins]


async def delete_pin(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspacePinRepo(db).delete(entry_id)


def _pin_to_response(p: WorkspacePin) -> WorkspacePinResponse:
    return WorkspacePinResponse(
        id=p.id, workspace_id=p.workspace_id, pinnable_type=p.pinnable_type,
        pinnable_id=p.pinnable_id, order_index=p.order_index, created_at=p.created_at,
    )


# ── Images ───────────────────────────────────────────────────────────────


async def list_images(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceImageResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceImageRepo(db)
    return [_image_to_response(i) for i in await repo.list_by_workspace(ws_id)]


async def create_image(
    db: AsyncSession, session_id: str, ws_id: UUID, url: str,
    item_id: UUID | None = None, caption: str | None = None,
    resolution_w: int | None = None, resolution_h: int | None = None,
    license: str | None = None,
) -> WorkspaceImageResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceImageRepo(db)
    obj = await repo.create(ws_id, url, item_id, caption, resolution_w, resolution_h, license)
    await _record_timeline(db, ws_id, "created", "image", obj.id)
    return _image_to_response(obj)


async def delete_image(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspaceImageRepo(db).delete(entry_id)


def _image_to_response(i: WorkspaceImage) -> WorkspaceImageResponse:
    return WorkspaceImageResponse(
        id=i.id, workspace_id=i.workspace_id, item_id=i.item_id, url=i.url,
        caption=i.caption, resolution_w=i.resolution_w, resolution_h=i.resolution_h,
        license=i.license, created_at=i.created_at,
    )


# ── Videos ───────────────────────────────────────────────────────────────


async def list_videos(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceVideoResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceVideoRepo(db)
    return [_video_to_response(v) for v in await repo.list_by_workspace(ws_id)]


async def create_video(
    db: AsyncSession, session_id: str, ws_id: UUID, url: str,
    item_id: UUID | None = None, title: str | None = None,
    thumbnail: str | None = None, duration_secs: int | None = None,
    creator: str | None = None, platform: str | None = None,
    transcript: str | None = None, summary: str | None = None,
) -> WorkspaceVideoResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceVideoRepo(db)
    obj = await repo.create(ws_id, url, item_id, title, thumbnail, duration_secs, creator, platform, transcript, summary)
    await _record_timeline(db, ws_id, "created", "video", obj.id)
    return _video_to_response(obj)


async def update_video(
    db: AsyncSession, session_id: str, entry_id: UUID, **kwargs: object,
) -> WorkspaceVideoResponse:
    repo = WorkspaceVideoRepo(db)
    obj = await repo.update(entry_id, **kwargs)
    if not obj:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Video not found")
    return _video_to_response(obj)


async def delete_video(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspaceVideoRepo(db).delete(entry_id)


def _video_to_response(v: WorkspaceVideo) -> WorkspaceVideoResponse:
    return WorkspaceVideoResponse(
        id=v.id, workspace_id=v.workspace_id, item_id=v.item_id, url=v.url,
        title=v.title, thumbnail=v.thumbnail, duration_secs=v.duration_secs,
        creator=v.creator, platform=v.platform, transcript=v.transcript,
        summary=v.summary, created_at=v.created_at,
    )


# ── Comparisons ──────────────────────────────────────────────────────────


async def list_comparisons(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceComparisonResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceComparisonRepo(db)
    return [_comparison_to_response(c) for c in await repo.list_by_workspace(ws_id)]


async def create_comparison(
    db: AsyncSession, session_id: str, ws_id: UUID, title: str, data: dict | None = None,
) -> WorkspaceComparisonResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceComparisonRepo(db)
    obj = await repo.create(ws_id, title, data)
    await _record_timeline(db, ws_id, "created", "comparison", obj.id)
    return _comparison_to_response(obj)


async def update_comparison(
    db: AsyncSession, session_id: str, entry_id: UUID, title: str | None = None, data: dict | None = None,
) -> WorkspaceComparisonResponse:
    repo = WorkspaceComparisonRepo(db)
    obj = await repo.update(entry_id, title, data)
    if not obj:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Comparison not found")
    return _comparison_to_response(obj)


async def delete_comparison(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspaceComparisonRepo(db).delete(entry_id)


def _comparison_to_response(c: WorkspaceComparison) -> WorkspaceComparisonResponse:
    return WorkspaceComparisonResponse(
        id=c.id, workspace_id=c.workspace_id, title=c.title, data=c.data,
        created_at=c.created_at, updated_at=c.updated_at,
    )


# ── Timeline ─────────────────────────────────────────────────────────────


async def list_timeline(
    db: AsyncSession, session_id: str, ws_id: UUID, limit: int = 200,
) -> list[WorkspaceTimelineEventResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceTimelineRepo(db)
    return [_timeline_to_response(e) for e in await repo.list_by_workspace(ws_id, limit)]


def _timeline_to_response(e: WorkspaceTimelineEvent) -> WorkspaceTimelineEventResponse:
    return WorkspaceTimelineEventResponse(
        id=e.id, workspace_id=e.workspace_id, action_type=e.action_type,
        object_type=e.object_type, object_id=e.object_id, event_metadata=e.event_metadata,
        created_at=e.created_at,
    )


async def _record_timeline(
    db: AsyncSession, ws_id: UUID, action_type: str, object_type: str, object_id: UUID,
) -> None:
    repo = WorkspaceTimelineRepo(db)
    await repo.create(ws_id, action_type, object_type, object_id)


# ── Tags ─────────────────────────────────────────────────────────────────


async def list_tags(db: AsyncSession, session_id: str, ws_id: UUID) -> list[WorkspaceTagResponse]:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceTagRepo(db)
    return [_tag_to_response(t) for t in await repo.list_by_workspace(ws_id)]


async def create_tag(db: AsyncSession, session_id: str, ws_id: UUID, name: str, color: str | None = None) -> WorkspaceTagResponse:
    await _require_workspace(db, session_id, ws_id)
    repo = WorkspaceTagRepo(db)
    obj = await repo.create(ws_id, name, color)
    return _tag_to_response(obj)


async def delete_tag(db: AsyncSession, session_id: str, entry_id: UUID) -> bool:
    return await WorkspaceTagRepo(db).delete(entry_id)


async def assign_tag(
    db: AsyncSession, session_id: str, ws_id: UUID, tag_id: UUID,
    object_type: str, object_id: UUID,
) -> dict:
    await _require_workspace(db, session_id, ws_id)
    tagging_repo = WorkspaceTaggingRepo(db)
    await tagging_repo.assign(tag_id, object_type, object_id)
    return {"status": "assigned"}


async def unassign_tag(
    db: AsyncSession, session_id: str, ws_id: UUID, tag_id: UUID,
    object_type: str, object_id: UUID,
) -> dict:
    await _require_workspace(db, session_id, ws_id)
    tagging_repo = WorkspaceTaggingRepo(db)
    ok = await tagging_repo.unassign(tag_id, object_type, object_id)
    if not ok:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Tagging not found")
    return {"status": "unassigned"}


async def list_tagged_objects(
    db: AsyncSession, session_id: str, ws_id: UUID, tag_id: UUID,
) -> list[WorkspaceSearchResult]:
    await _require_workspace(db, session_id, ws_id)
    tagging_repo = WorkspaceTaggingRepo(db)
    taggings = await tagging_repo.list_by_object(tag_id)
    results: list[WorkspaceSearchResult] = []
    item_repo = WorkspaceItemRepo(db)
    for t in taggings:
        if t.taggable_type == "item":
            item = await item_repo.get_by_id(t.taggable_id)
            if item:
                results.append(WorkspaceSearchResult(
                    object_type="item", object_id=item.id,
                    title=item.title or "", snippet=item.snippet, url=item.url,
                ))
    return results


def _tag_to_response(t: WorkspaceTag) -> WorkspaceTagResponse:
    return WorkspaceTagResponse(
        id=t.id, workspace_id=t.workspace_id, name=t.name,
        color=t.color, created_at=t.created_at,
    )


# ── Stats ────────────────────────────────────────────────────────────────


async def get_stats(db: AsyncSession, session_id: str, ws_id: UUID) -> WorkspaceStatsResponse:
    await _require_workspace(db, session_id, ws_id)
    return WorkspaceStatsResponse(
        sources=await _count(db, WorkspaceItem, ws_id),
        reads=await _count(db, WorkspaceRead, ws_id),
        summaries=0,
        notes=await _count(db, WorkspaceNote, ws_id),
        pins=await _count(db, WorkspacePin, ws_id),
        images=await _count(db, WorkspaceImage, ws_id),
        videos=await _count(db, WorkspaceVideo, ws_id),
        comparisons=await _count(db, WorkspaceComparison, ws_id),
        highlights=await _count(db, WorkspaceHighlight, ws_id),
        tags=await _count(db, WorkspaceTag, ws_id),
    )


async def _count(db: AsyncSession, model: type, ws_id: UUID) -> int:
    from sqlalchemy import func, select
    result = await db.execute(
        select(func.count()).select_from(model).where(model.workspace_id == ws_id),
    )
    return result.scalar() or 0


# ── Search ───────────────────────────────────────────────────────────────


async def search_workspace(
    db: AsyncSession, session_id: str, ws_id: UUID, q: str,
) -> list[WorkspaceSearchResult]:
    await _require_workspace(db, session_id, ws_id)
    results: list[WorkspaceSearchResult] = []
    q_lower = q.lower()

    items = await WorkspaceItemRepo(db).list_by_workspace(ws_id)
    for item in items:
        if (item.title and q_lower in item.title.lower()) or (item.snippet and q_lower in item.snippet.lower()):
            results.append(WorkspaceSearchResult(
                object_type="item", object_id=item.id,
                title=item.title or "", snippet=item.snippet, url=item.url,
            ))

    notes = await WorkspaceNoteRepo(db).list_by_workspace(ws_id)
    for note in notes:
        if q_lower in note.title.lower() or q_lower in note.content.lower():
            results.append(WorkspaceSearchResult(
                object_type="note", object_id=note.id,
                title=note.title, snippet=note.content[:200],
            ))

    return results


# ── Bulk Load ────────────────────────────────────────────────────────────


async def load_all(
    db: AsyncSession, session_id: str, ws_id: UUID,
) -> dict:
    await _require_workspace(db, session_id, ws_id)
    return {
        "reads": await list_reads(db, session_id, ws_id),
        "highlights": await list_highlights(db, session_id, ws_id),
        "notes": await list_notes(db, session_id, ws_id),
        "pins": await list_pins(db, session_id, ws_id),
        "images": await list_images(db, session_id, ws_id),
        "videos": await list_videos(db, session_id, ws_id),
        "comparisons": await list_comparisons(db, session_id, ws_id),
        "tags": await list_tags(db, session_id, ws_id),
        "timeline": await list_timeline(db, session_id, ws_id),
        "stats": await get_stats(db, session_id, ws_id),
    }
