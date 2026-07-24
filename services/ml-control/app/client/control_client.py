import httpx
from typing import Optional, Dict, Any
from app.config import settings

class ControlClient:
    def __init__(self, base_url: str = settings.CONTROL_URL):
        self.base_url = base_url.rstrip("/")

    async def get_active_schedule(self, node_id: str, output_name: str = "mister") -> Optional[Dict[str, Any]]:
        """
        Queries Control Service REST API to find the active schedule for node output.
        GET /control/schedules?node_id={node_id}&output_name={output_name}&enabled=true
        """
        async with httpx.AsyncClient(timeout=5.0) as client:
            url = f"{self.base_url}/control/schedules"
            params = {"node_id": node_id, "output_name": output_name, "enabled": "true"}
            try:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    body = res.json()
                    data = body.get("data", [])
                    if isinstance(data, list) and len(data) > 0:
                        return data[0]
                    elif isinstance(data, dict):
                        return data
                return None
            except Exception as e:
                print(f"[ControlClient] Error fetching schedule: {e}")
                return None

    async def update_schedule(self, schedule_id: str, on_sec: float, off_sec: float) -> bool:
        """
        Sends HTTP PUT request to Control Service to overwrite schedule parameters.
        PUT /control/schedules/{schedule_id}
        """
        async with httpx.AsyncClient(timeout=5.0) as client:
            url = f"{self.base_url}/control/schedules/{schedule_id}"
            payload = {
                "params": {
                    "on_sec": int(on_sec),
                    "off_sec": int(off_sec),
                    "value_on": 1,
                    "value_off": 0,
                }
            }
            try:
                res = await client.put(url, json=payload)
                return res.status_code in [200, 201, 204]
            except Exception as e:
                print(f"[ControlClient] Error updating schedule {schedule_id}: {e}")
                return False

    async def create_schedule(self, node_id: str, output_name: str, on_sec: float, off_sec: float) -> Optional[Dict[str, Any]]:
        """
        Creates a new interval schedule in Control Service if none exists.
        POST /control/schedules
        """
        async with httpx.AsyncClient(timeout=5.0) as client:
            url = f"{self.base_url}/control/schedules"
            payload = {
                "node_id": node_id,
                "output_name": output_name,
                "type": "interval",
                "params": {
                    "on_sec": int(on_sec),
                    "off_sec": int(off_sec),
                    "value_on": 1,
                    "value_off": 0,
                },
                "enabled": True,
            }
            try:
                res = await client.post(url, json=payload)
                if res.status_code in [200, 201]:
                    return res.json().get("data")
                return None
            except Exception as e:
                print(f"[ControlClient] Error creating schedule: {e}")
                return None
