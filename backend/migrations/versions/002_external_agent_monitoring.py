"""Add external agent monitoring and runtime intelligence fields

Revision ID: 002_external_agent_monitoring
Revises: 001_initial_schema
Create Date: 2026-11-13
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_external_agent_monitoring"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_tables = set(insp.get_table_names())

    # 1. agents table additions
    if "agents" in existing_tables:
        agent_cols = {c["name"] for c in insp.get_columns("agents")}
        with op.batch_alter_table("agents", schema=None) as batch_op:
            if "framework" not in agent_cols:
                batch_op.add_column(sa.Column("framework", sa.String(length=100), nullable=False, server_default="custom"))
            if "environment" not in agent_cols:
                batch_op.add_column(sa.Column("environment", sa.String(length=50), nullable=False, server_default="development"))
            if "deployment_location" not in agent_cols:
                batch_op.add_column(sa.Column("deployment_location", sa.String(length=255), nullable=True))
            if "tags" not in agent_cols:
                batch_op.add_column(sa.Column("tags", sa.JSON(), nullable=True))
            if "sdk_version" not in agent_cols:
                batch_op.add_column(sa.Column("sdk_version", sa.String(length=50), nullable=True))
            if "api_key_created_at" not in agent_cols:
                batch_op.add_column(sa.Column("api_key_created_at", sa.DateTime(), nullable=True))
            if "api_key_revoked_at" not in agent_cols:
                batch_op.add_column(sa.Column("api_key_revoked_at", sa.DateTime(), nullable=True))
            if "api_key_status" not in agent_cols:
                batch_op.add_column(sa.Column("api_key_status", sa.String(length=20), nullable=False, server_default="ACTIVE"))
            if "heartbeat_interval_seconds" not in agent_cols:
                batch_op.add_column(sa.Column("heartbeat_interval_seconds", sa.Integer(), nullable=False, server_default="30"))
            if "last_heartbeat_at" not in agent_cols:
                batch_op.add_column(sa.Column("last_heartbeat_at", sa.DateTime(), nullable=True))
            if "total_events_count" not in agent_cols:
                batch_op.add_column(sa.Column("total_events_count", sa.Integer(), nullable=False, server_default="0"))
            if "recent_errors_count" not in agent_cols:
                batch_op.add_column(sa.Column("recent_errors_count", sa.Integer(), nullable=False, server_default="0"))

    # 2. agent_events table additions
    if "agent_events" in existing_tables:
        event_cols = {c["name"] for c in insp.get_columns("agent_events")}
        with op.batch_alter_table("agent_events", schema=None) as batch_op:
            if "resource_type" not in event_cols:
                batch_op.add_column(sa.Column("resource_type", sa.String(length=50), nullable=True))
            if "permission_level" not in event_cols:
                batch_op.add_column(sa.Column("permission_level", sa.String(length=20), nullable=True))
            if "duration_ms" not in event_cols:
                batch_op.add_column(sa.Column("duration_ms", sa.Float(), nullable=True))
            if "trace_id" not in event_cols:
                batch_op.add_column(sa.Column("trace_id", sa.String(length=64), nullable=True))
            if "span_id" not in event_cols:
                batch_op.add_column(sa.Column("span_id", sa.String(length=64), nullable=True))
            if "parent_span_id" not in event_cols:
                batch_op.add_column(sa.Column("parent_span_id", sa.String(length=64), nullable=True))
            if "target_agent_id" not in event_cols:
                batch_op.add_column(sa.Column("target_agent_id", sa.String(length=36), nullable=True))
            if "metadata_json" not in event_cols:
                batch_op.add_column(sa.Column("metadata_json", sa.JSON(), nullable=True))
            if "sdk_version" not in event_cols:
                batch_op.add_column(sa.Column("sdk_version", sa.String(length=50), nullable=True))
            if "event_source" not in event_cols:
                batch_op.add_column(sa.Column("event_source", sa.String(length=50), nullable=False, server_default="SDK"))
            if "server_received_at" not in event_cols:
                batch_op.add_column(sa.Column("server_received_at", sa.DateTime(), nullable=True))

    # 3. agent_capabilities table additions
    if "agent_capabilities" in existing_tables:
        cap_cols = {c["name"] for c in insp.get_columns("agent_capabilities")}
        with op.batch_alter_table("agent_capabilities", schema=None) as batch_op:
            if "provenance" not in cap_cols:
                batch_op.add_column(sa.Column("provenance", sa.String(length=50), nullable=False, server_default="SELF_REPORTED"))
            if "last_observed_at" not in cap_cols:
                batch_op.add_column(sa.Column("last_observed_at", sa.DateTime(), nullable=True))
            if "call_count" not in cap_cols:
                batch_op.add_column(sa.Column("call_count", sa.Integer(), nullable=False, server_default="0"))

    # 4. agent_relationships table additions
    if "agent_relationships" in existing_tables:
        rel_cols = {c["name"] for c in insp.get_columns("agent_relationships")}
        with op.batch_alter_table("agent_relationships", schema=None) as batch_op:
            if "provenance" not in rel_cols:
                batch_op.add_column(sa.Column("provenance", sa.String(length=50), nullable=False, server_default="SEEDED"))
            if "last_interaction_at" not in rel_cols:
                batch_op.add_column(sa.Column("last_interaction_at", sa.DateTime(), nullable=True))
            if "interaction_count" not in rel_cols:
                batch_op.add_column(sa.Column("interaction_count", sa.Integer(), nullable=False, server_default="0"))
            if "last_event_id" not in rel_cols:
                batch_op.add_column(sa.Column("last_event_id", sa.String(length=36), nullable=True))

    # 5. agent_findings table additions
    if "agent_findings" in existing_tables:
        find_cols = {c["name"] for c in insp.get_columns("agent_findings")}
        with op.batch_alter_table("agent_findings", schema=None) as batch_op:
            if "source_type" not in find_cols:
                batch_op.add_column(sa.Column("source_type", sa.String(length=50), nullable=False, server_default="SIMULATION"))
            if "event_id" not in find_cols:
                batch_op.add_column(sa.Column("event_id", sa.String(length=36), nullable=True))
            if "detection_rule" not in find_cols:
                batch_op.add_column(sa.Column("detection_rule", sa.String(length=100), nullable=True))


def downgrade() -> None:
    pass

