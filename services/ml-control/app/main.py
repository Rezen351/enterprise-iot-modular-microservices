from contextlib import asynccontextmanager
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.rl.agent import SprayRLAgent, DecisionInput
from app.client.control_client import ControlClient
from app.nats.subscriber import NATSSubscriber

rl_agent = SprayRLAgent()
control_client = ControlClient()
nats_subscriber = NATSSubscriber(rl_agent=rl_agent, control_client=control_client)

# In-memory node AI control status toggle
ai_control_status: Dict[str, bool] = {"node-1": True}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[Lifecycle] Starting Spray Automation Service (Python FastAPI)...")
    await nats_subscriber.connect()
    yield
    # Shutdown
    print("[Lifecycle] Shutting down Spray Automation Service...")
    await nats_subscriber.disconnect()

app = FastAPI(
    title="Spray Automation Service",
    version="1.0.0",
    description="AI-driven Aeroponic Misting Controller Microservice",
    lifespan=lifespan,
)

# --- Standard API Envelope Helpers ---
def success_response(data: Any) -> Dict[str, Any]:
    return {"success": True, "data": data}

def error_response(code: str, message: str) -> Dict[str, Any]:
    return {"success": False, "error": {"code": code, "message": message}}

# --- DTO Models ---
class ToggleAIRequest(BaseModel):
    enabled: bool

class AnalyzeRequest(BaseModel):
    root_length_cm: float
    potato_condition: str = "healthy"
    confidence: float = 1.0

# --- REST Endpoints ---
@app.get("/health")
async def health_check():
    return success_response({"status": "ok", "service": "spray-automation"})

@app.get("/spray/status")
async def get_status(node_id: str = "node-1"):
    sched = await control_client.get_active_schedule(node_id)
    enabled = ai_control_status.get(node_id, True)

    data = {
        "node_id": node_id,
        "ai_enabled": enabled,
        "current_schedule": sched or {
            "id": "default",
            "params": {"on_sec": settings.DEFAULT_DURATION_SEC, "off_sec": settings.DEFAULT_INTERVAL_SEC}
        },
        "safety_guardrail": {
            "min_on_sec": settings.MIN_ON_SEC,
            "max_on_sec": settings.MAX_ON_SEC,
            "min_off_sec": settings.MIN_OFF_SEC,
            "max_off_sec": settings.MAX_OFF_SEC,
        }
    }
    return success_response(data)

@app.put("/spray/ai/{node_id}")
async def toggle_ai_control(node_id: str, req: ToggleAIRequest):
    ai_control_status[node_id] = req.enabled
    return success_response({"node_id": node_id, "ai_enabled": req.enabled})

@app.post("/spray/analyze/{node_id}")
async def manual_analyze(node_id: str, req: AnalyzeRequest):
    decision_input = DecisionInput(
        node_id=node_id,
        root_length_cm=req.root_length_cm,
        potato_condition=req.potato_condition,
        confidence=req.confidence,
    )
    decision = rl_agent.predict(decision_input)

    schedule_updated = False
    sched = await control_client.get_active_schedule(node_id)
    if sched and "id" in sched:
        schedule_updated = await control_client.update_schedule(
            sched["id"], decision.recommended_on_sec, decision.recommended_off_sec
        )

    res_data = {
        "node_id": node_id,
        "root_length_cm": req.root_length_cm,
        "potato_condition": req.potato_condition,
        "recommended_on_sec": decision.recommended_on_sec,
        "recommended_off_sec": decision.recommended_off_sec,
        "clamped": decision.clamped,
        "schedule_updated": schedule_updated,
        "reason": decision.reason,
    }
    return success_response(res_data)
