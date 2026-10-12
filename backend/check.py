import collections
import pandas as pd
from decision_engine import DecisionEngine

e = DecisionEngine()
n = lambda s: pd.to_numeric(s, errors="coerce")
s = e.tables["sales"]
s["disc"], s["gross"], s["net"] = n(s["Discount_Pct"]), n(s["Gross_Sales_EGP"]), n(s["Net_Sales_EGP"])
for col in ["Channel", "Customer_Type"]:
    print(s.groupby(col).agg(rows=("net", "size"), gross=("gross", "sum"), net=("net", "sum"), avg_disc=("disc", "mean")).round(2), "\n")
print(e.tables["production_orders"][["Planned_Qty", "Produced_Qty", "Good_Qty", "Rejected_Qty"]].apply(n).sum(), "\n")
print("median unit cost:", round(e.econ["unit_cost_egp"].median(), 1), "\n")
print(pd.DataFrame(e.supply_readiness()["suppliers"])[["supplier_id", "on_time_pct", "quality_pct"]].round(1), "\n")
print(collections.Counter(d["decision_id"].split("-")[0] for d in e.decisions()), "\n")
seen = set()
for d in e.decisions():
    k = d["decision_id"].split("-")[0]
    if k not in seen:
        seen.add(k)
        print(k, d["title"], "|", d["expected_impact"], "|", d["evidence"]["metrics"])
print(e.kpis())