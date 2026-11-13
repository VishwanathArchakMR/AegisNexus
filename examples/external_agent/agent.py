"""AegisNexus 2.0 Reference External AI Agent
===========================================
This is a runnable standalone external AI agent that connects to AegisNexus
using the official Python SDK (`aegisnexus_sdk`).

Features demonstrated:
1. Environment-based SDK initialization.
2. Capability registration and synchronization.
3. Automatic background heartbeat (marking agent ONLINE in the dashboard).
4. Tool call instrumentation using @client.instrument_tool decorator.
5. Tool call instrumentation using with client.track_tool_call context manager.
6. Safe data redaction (PII/secrets automatically masked).
7. Inter-agent communication tracking (delegation to another agent).
8. Simulating an undeclared sensitive tool call to trigger AegisNexus runtime security detection.
9. Graceful shutdown with event flush.
"""

import os
import sys
import time
import logging
from pathlib import Path

# Add SDK to sys.path if running directly from monorepo
SDK_PATH = Path(__file__).resolve().parent.parent.parent / "sdks" / "python"
if str(SDK_PATH) not in sys.path:
    sys.path.insert(0, str(SDK_PATH))

from aegisnexus_sdk import AegisNexusClient, CapabilityDeclaration

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ExternalBillingAgent")


def main():
    print("=" * 70)
    print("  AegisNexus 2.0 — Reference External Agent Simulation")
    print("=" * 70)

    # 1. Initialize SDK from environment variables or fallbacks
    endpoint = os.getenv("AEGISNEXUS_ENDPOINT", "http://localhost:8000/api/v1")
    agent_id = os.getenv("AEGISNEXUS_AGENT_ID")
    api_key = os.getenv("AEGISNEXUS_API_KEY")

    if not agent_id or not api_key:
        logger.warning(
            "AEGISNEXUS_AGENT_ID or AEGISNEXUS_API_KEY not found in environment.\n"
            "Please onboard an agent via the AegisNexus Dashboard ('Add External Agent')\n"
            "and set your environment variables, or pass them in a .env file.\n"
            "Exiting demonstration."
        )
        sys.exit(1)

    logger.info(f"Connecting to AegisNexus at {endpoint} as Agent ID: {agent_id}")

    client = AegisNexusClient(
        endpoint=endpoint,
        agent_id=agent_id,
        api_key=api_key,
        heartbeat_interval=10,  # 10s for responsive live demo
        flush_interval=2.0,
        fail_open=True,
    )

    # 2. Start the client (starts background heartbeat & telemetry thread)
    client.start()
    logger.info("AegisNexus client started. Heartbeat running in background.")

    try:
        # 3. Synchronize declared capabilities with AegisNexus
        logger.info("Synchronizing declared security capabilities...")
        declared_capabilities = [
            CapabilityDeclaration(
                name="lookup_customer",
                resource_type="DATABASE",
                permission_level="READ",
                is_sensitive=False,
                description="Queries customer account profile and subscription status",
            ),
            CapabilityDeclaration(
                name="calculate_tax",
                resource_type="API",
                permission_level="EXECUTE",
                is_sensitive=False,
                description="Calculates jurisdictional sales tax via external API",
            ),
            CapabilityDeclaration(
                name="process_subscription_refund",
                resource_type="PAYMENT",
                permission_level="WRITE",
                is_sensitive=True,
                description="Issues approved subscription refunds up to policy limit",
            ),
        ]
        client.report_capabilities(declared_capabilities)
        logger.info("Capabilities synchronized successfully with AegisNexus.")

        # Give dashboard a moment to show agent ONLINE
        time.sleep(2)

        # 4. Instrument a tool call using the DECORATOR pattern
        @client.instrument_tool(
            tool="tax_engine",
            action="calculate_tax",
            resource_type="API",
            permission_level="EXECUTE",
        )
        def compute_invoice_tax(subtotal: float, state: str) -> float:
            logger.info(f"Computing tax for ${subtotal} in {state}...")
            time.sleep(0.3)
            return round(subtotal * 0.0825, 2)

        tax_amt = compute_invoice_tax(120.0, "CA")
        logger.info(f"Tax computed: ${tax_amt}")

        # 5. Instrument a tool call using the CONTEXT MANAGER pattern
        logger.info("Executing customer profile lookup tool...")
        with client.track_tool_call(
            tool="customer_db",
            action="lookup_customer",
            resource_type="DATABASE",
            permission_level="READ",
            metadata={"customer_id": "cust_9942", "sanitized_region": "us-west"},
        ):
            time.sleep(0.4)
            logger.info("Customer retrieved: Enterprise Tier account")

        # 6. Instrument a sensitive PAYMENT tool call
        logger.info("Executing sensitive refund operation...")
        with client.track_tool_call(
            tool="payment_gateway",
            action="process_subscription_refund",
            resource_type="PAYMENT",
            permission_level="WRITE",
            metadata={"invoice_id": "inv_8812", "amount": 120.0, "currency": "USD"},
        ):
            time.sleep(0.5)
            logger.info("Refund issued successfully via gateway.")

        # 7. Record an Agent-to-Agent Delegation (updates Blast Radius with OBSERVED provenance)
        # Using the standard Customer Support or Finance demo agent target
        target_agent_id = os.getenv("AEGISNEXUS_TARGET_AGENT_ID", "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")
        logger.info(f"Delegating verification task to peer agent {target_agent_id}...")
        client.track_agent_delegation(
            target_agent_id=target_agent_id,
            action="verify_customer_satisfaction",
            metadata={"workflow": "post_refund_check", "priority": "normal"},
        )
        logger.info("Delegation event recorded.")

        # 8. Simulate an UNDECLARED TOOL CALL to demonstrate Runtime Security Detection!
        # The agent attempts to call a tool that was never declared in its security profile.
        logger.warning("Simulating an UNDECLARED sensitive tool call: 'dump_database_backup'...")
        try:
            with client.track_tool_call(
                tool="database_admin",
                action="dump_database_backup",
                resource_type="DATABASE",
                permission_level="ADMIN",
                metadata={"target_table": "all_users", "format": "sql.gz"},
            ):
                time.sleep(0.2)
                logger.warning("Undeclared database dump operation simulated.")
        except Exception as e:
            logger.error(f"Operation failed: {e}")

        logger.info("All simulated operations finished. Telemetry has been buffered and dispatched.")
        logger.info("Check the AegisNexus Dashboard to inspect:")
        logger.info("  1. Agent Inventory (Status: ONLINE)")
        logger.info("  2. Agent Detail -> Live Activity Timeline (all events logged)")
        logger.info("  3. Security Findings -> New Runtime Finding for Undeclared Tool Access")
        logger.info("  4. Blast Radius Graph -> Inter-agent edge with 'OBSERVED' badge")

        # Keep alive briefly for demonstration
        print("\nPress Ctrl+C to stop the agent, or wait 10 seconds for automatic shutdown...")
        time.sleep(10)

    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received.")
    finally:
        # 9. Cleanly stop client (flushes remaining events and sends SHUTDOWN event)
        logger.info("Stopping AegisNexus client and flushing telemetry...")
        client.stop()
        logger.info("AegisNexus client shut down cleanly.")


if __name__ == "__main__":
    main()

