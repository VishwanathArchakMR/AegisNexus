"""Add external agent monitoring and runtime intelligence fields

Revision ID: 002_external_agent_monitoring
Revises: 001_initial_schema
Create Date: 2026-11-13
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_external_agent_monitoring"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. agents table additions
    with op.batch_alter_table("agents", schema=None) as batch_op:
        batch_op.add_column(sa.Column("framework", sa.String(length=100), nullable=False, server_default="custom"))
        batch_op.add_column(sa.Column("environment", sa.String(length=50), nullable=False, server_default="development"))
        batch_op.add_column(sa.Column("deployment_location", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("tags", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("sdk_version", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("api_key_created_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("api_key_revoked_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("api_key_status", sa.String(length=20), nullable=False, server_default="ACTIVE"))
        batch_op.add_column(sa.Column("heartbeat_interval_seconds", sa.Integer(), nullable=False, server_default="30"))
        batch_op.add_column(sa.Column("last_heartbeat_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("total_events_count", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("recent_errors_count", sa.Integer(), nullable=False, server_default="0"))

    # 2. agent_events table additions
    with op.batch_alter_table("agent_events", schema=None) as batch_op:
        batch_op.add_column(sa.Column("resource_type", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("permission_level", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("duration_ms", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("trace_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("span_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("parent_span_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("target_agent_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("metadata_json", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("sdk_version", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("event_source", sa.String(length=50), nullable=False, server_default="SDK"))
        batch_op.add_column(sa.Column("server_received_at", sa.DateTime(), nullable=True))

    # 3. agent_capabilities table additions
    with op.batch_alter_table("agent_capabilities", schema=None) as batch_op:
        batch_op.add_column(sa.Column("provenance", sa.String(length=50), nullable=False, server_default="SELF_REPORTED"))
        batch_op.add_column(sa.Column("last_observed_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("call_count", sa.Integer(), nullable=False, server_default="0"))

    # 4. agent_relationships table additions
    with op.batch_alter_table("agent_relationships", schema=None) as batch_op:
        batch_op.add_column(sa.Column("provenance", sa.String(length=50), nullable=False, server_default="SEEDED"))
        batch_op.add_column(sa.Column("last_interaction_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("interaction_count", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("last_event_id", sa.String(length=36), nullable=True))

    # 5. agent_findings table additions
    with op.batch_alter_table("agent_findings", schema=None) as batch_op:
        batch_op.add_column(sa.Column("source_type", sa.String(length=50), nullable=False, server_default="SIMULATION"))
        batch_op.add_column(sa.Column("event_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("detection_rule", sa.String(length=100), nullable=True))


def downgrade() -> None:
    pass

