from typing import Literal, List, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from decision_engine import DecisionEngine
from store import Store
from analytics import AnalyticsService
from ai import AIService


app = FastAPI(
    title="El-Sharnouby Decision War Room API",
    description="Decision intelligence API: ranked actions, profit leakage, supply readiness, audit trail.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = DecisionEngine()
store = Store()
analytics = AnalyticsService(engine)

Status = Literal["awaiting", "deferred", "approved", "in_progress"]

# Which departments each role may act on. CEO can act on everything.
# NOTE: demo-level access control (role sent by the client), not real authentication.
ROLES = {
    "CEO": ["*"],
    "Inventory Manager": ["Inventory"],
    "Procurement Manager": ["Procurement", "Inventory"],
    "Marketing Manager": ["Marketing"],
    "Quality Manager": ["Quality"],
}

ALLOWED_TRANSITIONS = {
    "awaiting": {"approved", "deferred"},
    "deferred": {"awaiting", "approved"},
    "approved": {"in_progress", "deferred", "awaiting"},
    "in_progress": {"approved"},
}


class TransitionRequest(BaseModel):
    status: Status
    role: str
    note: str = ""


class ScenarioRequest(BaseModel):
    discount_cap_pct: float = 15.0
    markdown_pct: float = 15.0

class AIChatRequest(BaseModel):
    question: str
    history: List[Dict[str, str]] = []

class AIRootCauseRequest(BaseModel):
    problem: str
    history: List[Dict[str, str]] = []

class AIActionAdvisorRequest(BaseModel):
    focus: str = "What should management prioritize next?"
    history: List[Dict[str, str]] = []


def _board():
    states = store.states()
    items = []
    for d in engine.decisions():
        s = states.get(d["decision_id"])
        items.append({
            **d,
            "status": s["status"] if s else "awaiting",
            "updated_at": s["updated_at"] if s else None,
            "updated_by": s["updated_by"] if s else None,
        })
    return items

ai_service = AIService(
    engine=engine,
    analytics=analytics,
    board_provider=_board,
)

@app.get("/")
def root():
    return {"message": "El-Sharnouby Decision War Room API", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return engine.health()


@app.get("/api/overview")
def overview():
    return engine.overview()


@app.get("/api/kpis")
def kpis():
    return engine.kpis()


@app.get("/api/roles")
def roles():
    return {"roles": [{"role": r, "departments": d} for r, d in ROLES.items()]}


@app.get("/api/decisions")
def decisions():
    items = _board()
    return {
        "generated_at": engine.loaded_at,
        "data_as_of": engine.data_as_of,
        "total_decisions": len(items),
        "decisions": items,
    }


@app.post("/api/decisions/{decision_id}/transition")
def transition(decision_id: str, body: TransitionRequest):
    decision = next((d for d in _board() if d["decision_id"] == decision_id), None)
    if decision is None:
        raise HTTPException(404, f"Decision {decision_id} not found")

    allowed_depts = ROLES.get(body.role)
    if allowed_depts is None:
        raise HTTPException(400, f"Unknown role '{body.role}'")
    if "*" not in allowed_depts and decision["department"] not in allowed_depts:
        raise HTTPException(
            403, f"{body.role} cannot act on {decision['department']} decisions")

    current = decision["status"]
    if body.status == current:
        return {"ok": True, "decision_id": decision_id, "status": current}
    if body.status not in ALLOWED_TRANSITIONS[current]:
        raise HTTPException(409, f"Cannot move from '{current}' to '{body.status}'")

    store.transition(decision_id, decision["title"], current, body.status, body.role, body.note)
    return {"ok": True, "decision_id": decision_id, "status": body.status}


@app.get("/api/audit")
def audit(limit: int = 100):
    return {"events": store.audit(limit)}


@app.get("/api/leakage")
def leakage():
    return engine.leakage()


@app.get("/api/supply-readiness")
def supply_readiness():
    return engine.supply_readiness()


@app.get("/api/data-health")
def data_health():
    base = engine.data_health()
    base["checks"].extend(analytics.data_health_extension())
    base["status"] = "pass" if all(c.get("pass") for c in base["checks"]) else "fail"
    return base


@app.get("/api/dashboard")
def dashboard():
    return analytics.endpoint("dashboard")


@app.get("/api/channels")
def channels():
    return analytics.endpoint("channels")


@app.get("/api/customers")
def customers():
    return analytics.endpoint("customers")


@app.get("/api/inventory")
def inventory():
    return analytics.endpoint("inventory")


@app.get("/api/forecast")
def forecast():
    return analytics.endpoint("forecast")


@app.get("/api/marketing")
def marketing():
    return analytics.endpoint("marketing")


@app.get("/api/operations")
def operations():
    return analytics.endpoint("operations")


@app.get("/api/quality")
def quality():
    return analytics.endpoint("quality")


@app.get("/api/supply")
def supply():
    return analytics.endpoint("supply")


@app.get("/api/story")
def story():
    return analytics.endpoint("story")


@app.get("/api/method")
def method():
    return analytics.endpoint("method")


@app.post("/api/scenario")
def scenario(body: ScenarioRequest):
    return analytics.scenario(body.discount_cap_pct, body.markdown_pct)

@app.get("/api/ai/status")
def ai_status():
    return ai_service.status()


@app.post("/api/ai/chat")
def ai_chat(body: AIChatRequest):
    question = body.question.strip()

    if not question:
        raise HTTPException(400, "Question cannot be empty")

    if len(question) > 1000:
        raise HTTPException(400, "Question is too long")

    try:
        return ai_service.chat(question, body.history)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))

@app.post("/api/ai/root-cause")
def ai_root_cause(body: AIRootCauseRequest):
    problem = body.problem.strip()

    if not problem:
        raise HTTPException(400, "Problem cannot be empty")

    try:
        return ai_service.root_cause(problem, body.history)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))


@app.post("/api/ai/action-advisor")
def ai_action_advisor(body: AIActionAdvisorRequest):
    focus = body.focus.strip()

    if not focus:
        raise HTTPException(400, "Focus cannot be empty")

    try:
        return ai_service.action_advisor(focus, body.history)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    
@app.post("/api/reload")


def reload_data():
    """Re-read the CSVs and rebuild decisions (decision states are kept)."""
    engine.refresh()
    analytics.refresh()
    return {"ok": True, "decisions": len(engine.decisions()), "data_as_of": engine.data_as_of}
