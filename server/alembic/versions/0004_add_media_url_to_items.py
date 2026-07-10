"""add media_url column to workspace_items

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("workspace_items", sa.Column("media_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("workspace_items", "media_url")
