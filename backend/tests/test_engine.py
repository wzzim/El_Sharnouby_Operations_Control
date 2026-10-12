import math
from pathlib import Path
import sys

import pandas as pd
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import main  # noqa: E402
from decision_engine import DecisionEngine  # noqa: E402


@pytest.fixture(autouse=True)
def reset_demo_store():
    main.store.reset()
    yield
    main.store.reset()


def test_inventory_model_uses_latest_snapshot_only():
    eng = DecisionEngine()
    assert eng.data_as_of is not None
    assert "_month" in eng.model.columns
    months = pd.to_datetime(eng.model["_month"], errors="coerce").dropna().dt.strftime("%Y-%m-%d").unique()
    assert len(months) == 1
    assert months[0] == eng.data_as_of


def test_leakage_conservative_components_sum_to_total():
    eng = DecisionEngine()
    leakage = eng.leakage()
    item_sum = sum(
        item["value_egp"]
        for item in leakage["items"]
        if item["available"] and item["included_in_conservative"]
    )
    assert math.isclose(item_sum, leakage["conservative_total_egp"], rel_tol=0, abs_tol=0.01)
    assert leakage["including_quality_losses_total_egp"] >= leakage["conservative_total_egp"]


def test_wholesale_is_excluded_from_discount_leakage():
    eng = DecisionEngine()
    sales = eng.tables["sales"].copy()
    disc = pd.to_numeric(sales["Discount_Pct"], errors="coerce").fillna(0)
    if disc.max() > 1:
        disc = disc / 100
    retail_online = sales["Channel"].astype(str).str.lower().isin(["retail", "online"])
    expected = float(
        (pd.to_numeric(sales["Gross_Sales_EGP"], errors="coerce").fillna(0)
         * (disc - eng.DISCOUNT_CAP_PCT).clip(lower=0)
         * retail_online.astype(float)).sum()
    )
    leakage_item = next(item for item in eng.leakage()["items"] if item["key"] == "discount_leakage")
    assert math.isclose(expected, leakage_item["value_egp"], rel_tol=0, abs_tol=0.01)
    assert leakage_item["components"]["excluded_wholesale_rows"] > 0


def test_supplier_classification_thresholds():
    eng = DecisionEngine()
    supply = eng.supply_readiness()
    assert supply["available"] is True
    for supplier in supply["suppliers"]:
        on_time = supplier["on_time_pct"]
        quality = supplier["quality_pct"]
        status = supplier["status"]
        if on_time < 50 or quality < 95:
            assert status == "critical"
        elif on_time < 70 or quality < 97:
            assert status == "watchlist"
        else:
            assert status == "stable"


def test_wrong_role_gets_403_on_department_transition():
    client = TestClient(main.app)
    decision = next(d for d in main.engine.decisions() if d["department"] != "Marketing")
    res = client.post(
        f"/api/decisions/{decision['decision_id']}/transition",
        json={"status": "approved", "role": "Marketing Manager", "note": "should fail"},
    )
    assert res.status_code == 403


def test_invalid_transition_gets_409():
    client = TestClient(main.app)
    decision = main.engine.decisions()[0]
    res = client.post(
        f"/api/decisions/{decision['decision_id']}/transition",
        json={"status": "in_progress", "role": "CEO", "note": "invalid jump"},
    )
    assert res.status_code == 409


def test_transition_persists_to_sqlite_and_appears_in_audit():
    client = TestClient(main.app)
    decision = main.engine.decisions()[0]
    res = client.post(
        f"/api/decisions/{decision['decision_id']}/transition",
        json={"status": "approved", "role": "CEO", "note": "test approval"},
    )
    assert res.status_code == 200

    board = client.get("/api/decisions").json()["decisions"]
    updated = next(d for d in board if d["decision_id"] == decision["decision_id"])
    assert updated["status"] == "approved"
    assert updated["updated_by"] == "CEO"

    audit = client.get("/api/audit").json()["events"]
    assert any(e["decision_id"] == decision["decision_id"] and e["to_status"] == "approved" for e in audit)


def test_decision_ids_are_stable_across_reload():
    client = TestClient(main.app)
    before = [d["decision_id"] for d in client.get("/api/decisions").json()["decisions"]]
    assert client.post("/api/reload").status_code == 200
    after = [d["decision_id"] for d in client.get("/api/decisions").json()["decisions"]]
    assert before == after
