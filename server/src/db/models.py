from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    workspaces: Mapped[list["Workspace"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped[User | None] = relationship(back_populates="workspaces")
    items: Mapped[list["WorkspaceItem"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceItem(Base):
    __tablename__ = "workspace_items"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    media_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, server_default=func.cast(0, Integer), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workspace: Mapped["Workspace"] = relationship(back_populates="items")


class Profile(Base):
    __tablename__ = "profiles"

    session_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    theme: Mapped[str] = mapped_column(String(20), default="light")
    search_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_active: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class SearchHistory(Base):
    __tablename__ = "search_history"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    session_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    query: Mapped[str] = mapped_column(String(500), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    searched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReadingListItem(Base):
    __tablename__ = "reading_list"
    __table_args__ = (UniqueConstraint("session_id", "url", name="uq_reading_list_session_url"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    session_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    media_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SummaryListItem(Base):
    __tablename__ = "summary_list"
    __table_args__ = (UniqueConstraint("session_id", "url", name="uq_summary_list_session_url"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    session_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    session_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LLMOverview(Base):
    __tablename__ = "llm_overviews"
    __table_args__ = (UniqueConstraint("session_id", "query", name="uq_llm_overviews_session_query"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    session_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    query: Mapped[str] = mapped_column(String(500), nullable=False)
    overview: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Workspace Station ─────────────────────────────────────────────────────


class WorkspaceRead(Base):
    __tablename__ = "workspace_reads"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspace_items.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="unread")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workspace: Mapped["Workspace"] = relationship()
    item: Mapped["WorkspaceItem"] = relationship()


class WorkspaceHighlight(Base):
    __tablename__ = "workspace_highlights"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspace_items.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkspaceNote(Base):
    __tablename__ = "workspace_notes"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )

    workspace: Mapped["Workspace"] = relationship()


class WorkspacePin(Base):
    __tablename__ = "workspace_pins"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    pinnable_type: Mapped[str] = mapped_column(String(50), nullable=False)
    pinnable_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, server_default=func.cast(0, Integer), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkspaceImage(Base):
    __tablename__ = "workspace_images"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspace_items.id", ondelete="SET NULL"), nullable=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_w: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resolution_h: Mapped[int | None] = mapped_column(Integer, nullable=True)
    license: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workspace: Mapped["Workspace"] = relationship()


class WorkspaceVideo(Base):
    __tablename__ = "workspace_videos"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspace_items.id", ondelete="SET NULL"), nullable=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_secs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    creator: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    workspace: Mapped["Workspace"] = relationship()


class WorkspaceComparison(Base):
    __tablename__ = "workspace_comparisons"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )

    workspace: Mapped["Workspace"] = relationship()


class WorkspaceTimelineEvent(Base):
    __tablename__ = "workspace_timeline"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    object_type: Mapped[str] = mapped_column(String(50), nullable=False)
    object_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkspaceTag(Base):
    __tablename__ = "workspace_tags"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkspaceTagging(Base):
    __tablename__ = "workspace_taggings"
    __table_args__ = (UniqueConstraint("tag_id", "taggable_type", "taggable_id", name="uq_tagging"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    tag_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("workspace_tags.id", ondelete="CASCADE"), nullable=False)
    taggable_type: Mapped[str] = mapped_column(String(50), nullable=False)
    taggable_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
