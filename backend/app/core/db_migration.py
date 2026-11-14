import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger("aegisnexus.migration")

# Table columns to ensure exist on startup for SQLite/PostgreSQL
COLUMNS_TO_ENSURE = [
    # Table, Column, Type and Default
    ("agents", "framework", "VARCHAR(100) DEFAULT 'custom'"),
    ("agents", "environment", "VARCHAR(50) DEFAULT 'development'"),
    ("agents", "deployment_location", "VARCHAR(255)"),
    ("agents", "tags", "JSON"),
    ("agents", "sdk_version", "VARCHAR(50)"),
    ("agents", "api_key_created_at", "DATETIME"),
    ("agents", "api_key_revoked_at", "DATETIME"),
    ("agents", "api_key_status", "VARCHAR(20) DEFAULT 'ACTIVE'"),
    ("agents", "heartbeat_interval_seconds", "INTEGER DEFAULT 30"),
    ("agents", "last_heartbeat_at", "DATETIME"),
    ("agents", "total_events_count", "INTEGER DEFAULT 0"),
    ("agents", "recent_errors_count", "INTEGER DEFAULT 0"),

    ("agent_events", "resource_type", "VARCHAR(50)"),
    ("agent_events", "permission_level", "VARCHAR(20)"),
    ("agent_events", "duration_ms", "FLOAT"),
    ("agent_events", "trace_id", "VARCHAR(64)"),
    ("agent_events", "span_id", "VARCHAR(64)"),
    ("agent_events", "parent_span_id", "VARCHAR(64)"),
    ("agent_events", "target_agent_id", "VARCHAR(36)"),
    ("agent_events", "metadata_json", "JSON"),
    ("agent_events", "sdk_version", "VARCHAR(50)"),
    ("agent_events", "event_source", "VARCHAR(50) DEFAULT 'SDK'"),
    ("agent_events", "server_received_at", "DATETIME"),

    ("agent_capabilities", "provenance", "VARCHAR(50) DEFAULT 'SELF_REPORTED'"),
    ("agent_capabilities", "last_observed_at", "DATETIME"),
    ("agent_capabilities", "call_count", "INTEGER DEFAULT 0"),

    ("agent_relationships", "provenance", "VARCHAR(50) DEFAULT 'SEEDED'"),
    ("agent_relationships", "last_interaction_at", "DATETIME"),
    ("agent_relationships", "interaction_count", "INTEGER DEFAULT 0"),
    ("agent_relationships", "last_event_id", "VARCHAR(36)"),

    ("agent_findings", "source_type", "VARCHAR(50) DEFAULT 'SIMULATION'"),
    ("agent_findings", "event_id", "VARCHAR(36)"),
    ("agent_findings", "detection_rule", "VARCHAR(100)"),

    ("recovery_records", "runtime_revalidation_notes", "TEXT"),

    ("recovery_events", "previous_hash", "VARCHAR(64)"),
    ("recovery_events", "event_hash", "VARCHAR(64)"),
]


async def run_sqlite_safe_migrations(conn: AsyncConnection) -> None:
    """Safely adds missing columns and executes idempotent ASR data normalization."""
    try:
        # Check dialect
        dialect_name = conn.dialect.name
        if "sqlite" in dialect_name:
            for table_name, column_name, col_def in COLUMNS_TO_ENSURE:
                # Check if column exists
                pragma_res = await conn.execute(text(f"PRAGMA table_info({table_name})"))
                columns = [row[1] for row in pragma_res.fetchall()]
                if columns and column_name not in columns:
                    logger.info("Adding missing column %s.%s ...", table_name, column_name)
                    await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {col_def}"))

            # Idempotent Canonical ASR normalization for legacy executions & recovery records
            await conn.execute(text("""
                UPDATE attack_executions
                SET attack_success_rate = ROUND((CAST(successful_attempts AS FLOAT) / total_attempts) * 100.0, 2)
                WHERE total_attempts > 0;
            """))

            await conn.execute(text("""
                UPDATE recovery_records
                SET previous_asr = (
                    SELECT ae.attack_success_rate
                    FROM agent_findings af
                    JOIN attack_executions ae ON af.execution_id = ae.id
                    WHERE af.id = recovery_records.finding_id
                )
                WHERE finding_id IN (
                    SELECT id FROM agent_findings WHERE execution_id IS NOT NULL
                );
            """))

            await conn.execute(text("""
                UPDATE recovery_records
                SET current_asr = (
                    SELECT attack_success_rate
                    FROM attack_executions
                    WHERE id = recovery_records.verification_execution_id
                )
                WHERE verification_execution_id IS NOT NULL;
            """))

            await conn.execute(text("""
                UPDATE recovery_records
                SET previous_asr = NULL
                WHERE finding_id IN (
                    SELECT id FROM agent_findings
                    WHERE source_type = 'RUNTIME_DETECTION' OR execution_id IS NULL
                );
            """))
    except Exception as exc:
        logger.warning("Auto-migration check notice: %s", exc)

