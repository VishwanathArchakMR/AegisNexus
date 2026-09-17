import asyncio
import httpx
import json
from datetime import datetime, timezone

BASE_URL = "http://127.0.0.1:8000/api/v1/agents"

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Register
        print("Registering Live Agent...")
        reg_payload = {
            "name": "Finance Agent (Live Test)",
            "agent_type": "finance",
            "description": "A live-connected finance agent for demo purposes.",
            "owner_team": "Finance Automation",
            "trust_level": "HIGH",
            "capabilities": [
                {
                    "name": "approve_refund",
                    "resource_type": "PAYMENT",
                    "permission": "EXECUTE",
                    "is_sensitive": True,
                    "description": "Allows approval of customer refunds"
                }
            ]
        }
        resp = await client.post(f"{BASE_URL}/register", json=reg_payload)
        if resp.status_code != 200:
            print(f"Registration failed: {resp.text}")
            return
            
        data = resp.json()
        agent_id = data["agent_id"]
        api_key = data["api_key"]
        print(f"Registered! Agent ID: {agent_id}, API Key: {api_key}")
        
        headers = {"Authorization": f"Bearer {api_key}"}
        
        # 2. Heartbeat loop (run a few times)
        print("Starting heartbeat...")
        for i in range(3):
            await asyncio.sleep(2)
            hb_payload = {
                "status": "ACTIVE",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            hb_resp = await client.post(f"{BASE_URL}/{agent_id}/heartbeat", json=hb_payload, headers=headers)
            print(f"Heartbeat {i+1}: {hb_resp.status_code}")
            
        # 3. Simulate an event
        print("Simulating event...")
        event_payload = {
            "event_type": "TOOL_EXECUTION",
            "tool": "payment_gateway",
            "action": "approve_refund",
            "status": "SUCCESS",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": json.dumps({"amount": 500, "currency": "USD", "target": "customer_123"})
        }
        ev_resp = await client.post(f"{BASE_URL}/{agent_id}/events", json=event_payload, headers=headers)
        print(f"Event Response: {ev_resp.status_code} - {ev_resp.text}")
        
        print("Live agent simulation complete. Please check the UI.")

if __name__ == "__main__":
    asyncio.run(main())
