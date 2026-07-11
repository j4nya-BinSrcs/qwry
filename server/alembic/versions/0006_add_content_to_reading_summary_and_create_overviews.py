"""add content to reading_list/summary_list, create llm_overviews

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add content columns to reading_list
    op.add_column("reading_list", sa.Column("content", sa.Text(), nullable=True))
    op.add_column("reading_list", sa.Column("content_type", sa.String(20), nullable=True))
    op.add_column("reading_list", sa.Column("media_url", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_reading_list_session_url", "reading_list", ["session_id", "url"])

    # Add summary columns to summary_list
    op.add_column("summary_list", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("summary_list", sa.Column("model", sa.String(50), nullable=True))
    op.create_unique_constraint("uq_summary_list_session_url", "summary_list", ["session_id", "url"])

    # Create llm_overviews table
    op.create_table(
        "llm_overviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.String(255), nullable=False),
        sa.Column("query", sa.String(500), nullable=False),
        sa.Column("overview", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_llm_overviews_session_id", "llm_overviews", ["session_id"])
    op.create_unique_constraint("uq_llm_overviews_session_query", "llm_overviews", ["session_id", "query"])


def downgrade() -> None:
    op.drop_table("llm_overviews")
    op.drop_constraint("uq_summary_list_session_url", "summary_list")
    op.drop_column("summary_list", "model")
    op.drop_column("summary_list", "summary")
    op.drop_constraint("uq_reading_list_session_url", "reading_list")
    op.drop_column("reading_list", "media_url")
    op.drop_column("reading_list", "content_type")
    op.drop_column("reading_list", "content")
