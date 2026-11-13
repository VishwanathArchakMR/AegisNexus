"""Initial database schema baseline

Revision ID: 001_initial_schema
Revises: None
Create Date: 2026-09-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Baseline schema was created via SQLAlchemy metadata models
    # This migration anchors the initial schema revision in the Alembic chain.
    pass


def downgrade() -> None:
    pass
