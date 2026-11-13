"""Canonical ASR normalization and runtime recovery ledger support

Revision ID: 003_canonical_asr_and_runtime_recovery
Revises: 002_external_agent_monitoring
Create Date: 2026-11-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003_canonical_asr_and_runtime_recovery"
down_revision: Union[str, None] = "002_external_agent_monitoring"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_tables = set(insp.get_table_names())

    # 1. Add runtime_revalidation_notes column to recovery_records if not present
    if "recovery_records" in existing_tables:
        rec_cols = {c["name"] for c in insp.get_columns("recovery_records")}
        if "runtime_revalidation_notes" not in rec_cols:
            with op.batch_alter_table("recovery_records", schema=None) as batch_op:
                batch_op.add_column(sa.Column("runtime_revalidation_notes", sa.Text(), nullable=True))

    # 2. Canonical ASR data migration:
    # Recalculate attack_success_rate deterministically as a percentage (0.0 to 100.0)
    # using historical attempt counts, ensuring 100% idempotent normalization.
    if "attack_executions" in existing_tables:
        conn.execute(
            sa.text("""
                UPDATE attack_executions
                SET attack_success_rate = ROUND((CAST(successful_attempts AS FLOAT) / total_attempts) * 100.0, 2)
                WHERE total_attempts > 0;
            """)
        )

    # 3. Synchronize recovery_records previous_asr and current_asr
    if "recovery_records" in existing_tables and "agent_findings" in existing_tables:
        conn.execute(
            sa.text("""
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
            """)
        )

        conn.execute(
            sa.text("""
                UPDATE recovery_records
                SET current_asr = (
                    SELECT attack_success_rate
                    FROM attack_executions
                    WHERE id = recovery_records.verification_execution_id
                )
                WHERE verification_execution_id IS NOT NULL;
            """)
        )

        # Clear ambiguous fallback ASR for runtime detection findings
        conn.execute(
            sa.text("""
                UPDATE recovery_records
                SET previous_asr = NULL
                WHERE finding_id IN (
                    SELECT id FROM agent_findings
                    WHERE source_type = 'RUNTIME_DETECTION' OR execution_id IS NULL
                );
            """)
        )


def downgrade() -> None:
    with op.batch_alter_table("recovery_records", schema=None) as batch_op:
        batch_op.drop_column("runtime_revalidation_notes")
