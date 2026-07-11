"""create profile, search_history, reading_list, summary_list, activity_log tables

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("session_id", sa.String(255), primary_key=True),
        sa.Column("username", sa.String(100), nullable=True),
        sa.Column("theme", sa.String(20), nullable=False, server_default="light"),
        sa.Column("search_provider", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_active", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "search_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.String(255), nullable=False),
        sa.Column("query", sa.String(500), nullable=False),
        sa.Column("provider", sa.String(50), nullable=True),
        sa.Column("searched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_search_history_session_id", "search_history", ["session_id"])
    op.create_table(
        "reading_list",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.String(255), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("saved_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_reading_list_session_id", "reading_list", ["session_id"])
    op.create_table(
        "summary_list",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.String(255), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("saved_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_summary_list_session_id", "summary_list", ["session_id"])
    op.create_table(
        "activity_log",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.String(255), nullable=False),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("details", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_activity_log_session_id", "activity_log", ["session_id"])


def downgrade() -> None:
    op.drop_table("activity_log")
    op.drop_table("summary_list")
    op.drop_table("reading_list")
    op.drop_table("search_history")
    op.drop_table("profiles")
