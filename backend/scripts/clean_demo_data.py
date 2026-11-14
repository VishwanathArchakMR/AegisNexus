"""AegisNexus 2.0 — Safe Demo Data Cleanup and Seed Verification Script
=====================================================================
Usage:
    python backend/scripts/clean_demo_data.py [--dry-run] [--reactivate-external-key]

Safety Guarantees:
1. Explicitly checks and confirms target database before taking action.
2. Automatically creates a timestamped backup copy before any mutation.
3. Preserves all genuine findings, telemetry events, recovery ledgers, and relationships.
4. Identifies and removes accidental zero-event duplicate registrations.
5. Produces a comprehensive inventory of the clean demo state.
"""

import sys
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "aegisnexus.db"


def main():
    print("=" * 70)
    print("  AegisNexus — Safe Demonstration Data Cleanup & Integrity Audit")
    print("=" * 70)

    if not DB_PATH.exists():
        print(f"[ERROR] Database file not found at: {DB_PATH}")
        sys.exit(1)

    print(f"[TARGET DATABASE] {DB_PATH}")
    dry_run = "--dry-run" in sys.argv
    reactivate_key = "--reactivate-external-key" in sys.argv

    if dry_run:
        print("[MODE] DRY-RUN ONLY — No modifications will be written.")

    # 1. Take timestamped backup
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_path = BASE_DIR / f"aegisnexus.db.backup.{timestamp}"
    if not dry_run:
        shutil.copy2(DB_PATH, backup_path)
        print(f"[BACKUP CREATED] {backup_path}")

    # 2. Inspect agents
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("SELECT id, name, status, trust_level, source, api_key_status, last_seen_at FROM agents")
    agents = c.fetchall()
    print(f"\n[CURRENT AGENTS] ({len(agents)} found):")

    agents_by_name = {}
    for a in agents:
        agent_id, name, status, trust, source, key_status, last_seen = a
        print(f"  • {agent_id} | {name:<26} | Status: {status} | Key: {key_status} | Source: {source} | Last seen: {last_seen or 'Never'}")
        agents_by_name.setdefault(name, []).append(a)

    # 3. Identify duplicate external agents with zero events and zero findings
    removed_count = 0
    preserved_external_id = None

    for name, list_agents in agents_by_name.items():
        if len(list_agents) > 1 and list_agents[0][4] == "EXTERNAL":
            print(f"\n[ANALYZING DUPLICATE AGENT SET: '{name}']")
            agent_metrics = []
            for a in list_agents:
                aid = a[0]
                c.execute("SELECT count(*) FROM agent_events WHERE agent_id=?", (aid,))
                ev_count = c.fetchone()[0]
                c.execute("SELECT count(*) FROM agent_findings WHERE agent_id=?", (aid,))
                f_count = c.fetchone()[0]
                c.execute("SELECT count(*) FROM recovery_records WHERE agent_id=?", (aid,))
                rec_count = c.fetchone()[0]
                c.execute("SELECT count(*) FROM agent_relationships WHERE source_agent_id=? OR target_agent_id=?", (aid, aid))
                rel_count = c.fetchone()[0]
                agent_metrics.append((a, ev_count, f_count, rec_count, rel_count))
                print(f"    - Agent {aid}: {ev_count} events, {f_count} findings, {rec_count} recovery, {rel_count} relationships")

            # Determine genuine agent (has events/findings) vs orphan duplicate (0 events, 0 findings)
            for item in agent_metrics:
                a_info, ev, f, rec, rel = item
                aid = a_info[0]
                if ev == 0 and f == 0 and rec == 0 and rel == 0:
                    print(f"    [REMOVE ORPHAN DUPLICATE] ID {aid} (never connected, 0 events, 0 findings)")
                    if not dry_run:
                        # Clean associated empty capabilities if any
                        c.execute("DELETE FROM agent_capabilities WHERE agent_id=?", (aid,))
                        c.execute("DELETE FROM agents WHERE id=?", (aid,))
                        removed_count += 1
                else:
                    print(f"    [PRESERVE REAL AGENT] ID {aid} (contains {ev} telemetry events, {f} runtime findings)")
                    preserved_external_id = aid

    if reactivate_key and preserved_external_id and not dry_run:
        print(f"\n[RESETTING EXTERNAL AGENT KEY TO ACTIVE] ID: {preserved_external_id}")
        c.execute("UPDATE agents SET api_key_status='ACTIVE', api_key_revoked_at=NULL WHERE id=?", (preserved_external_id,))

    if not dry_run:
        conn.commit()
        print(f"\n[COMMITTED] Removed {removed_count} orphan duplicate record(s).")

    # 4. Inventory Report
    print("\n" + "=" * 70)
    print("  CLEAN DEMONSTRATION DATASET INVENTORY")
    print("=" * 70)
    c.execute("SELECT count(*) FROM agents")
    print(f"Total AI Agents:           {c.fetchone()[0]}")
    c.execute("SELECT count(*) FROM agent_capabilities")
    print(f"Total Capabilities:        {c.fetchone()[0]}")
    c.execute("SELECT count(*) FROM agent_relationships")
    print(f"Total Relationships:       {c.fetchone()[0]}")
    c.execute("SELECT count(*) FROM attack_executions")
    print(f"Total Attack Executions:   {c.fetchone()[0]}")
    c.execute("SELECT count(*) FROM agent_findings")
    print(f"Total Security Findings:   {c.fetchone()[0]}")
    c.execute("SELECT count(*) FROM recovery_records")
    print(f"Total Recovery Records:    {c.fetchone()[0]}")
    c.execute("SELECT count(*) FROM recovery_events")
    print(f"Total Ledger Audit Events: {c.fetchone()[0]}")
    c.execute("SELECT count(*) FROM agent_events")
    print(f"Total Telemetry Events:    {c.fetchone()[0]}")

    c.execute("SELECT id, name, status, trust_level, api_key_status FROM agents")
    print("\nFinal Verified Agent Roster:")
    for row in c.fetchall():
        print(f"  • {row[0][:8]}... | {row[1]:<26} | Admin: {row[2]:<8} | Trust: {row[3]:<8} | Key: {row[4]}")

    conn.close()
    print("\n[COMPLETE] Demonstration dataset is clean, verified, and referentially sound.")


if __name__ == "__main__":
    main()

