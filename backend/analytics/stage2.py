from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd


def _num(s, default: float = 0.0):
    return pd.to_numeric(s, errors="coerce").fillna(default)


def _dt(s):
    return pd.to_datetime(s, errors="coerce")


def _safe_div(a, b, default: float = 0.0):
    try:
        if b is None or pd.isna(b) or float(b) == 0:
            return default
        return float(a) / float(b)
    except Exception:
        return default


def _clean(v):
    if isinstance(v, dict):
        return {str(k): _clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_clean(x) for x in v]
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        x = float(v)
        if math.isnan(x) or math.isinf(x):
            return None
        return round(x, 4)
    if isinstance(v, (pd.Timestamp,)):
        return v.strftime("%Y-%m-%d")
    try:
        if pd.isna(v):
            return None
    except Exception:
        pass
    return v


def _records(df: pd.DataFrame, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    if limit is not None:
        df = df.head(limit)
    return _clean(df.to_dict(orient="records"))


def _metric(metric_id: str, label: str, formula: str, sources: List[str], assumptions: List[str], status: str = "Modeled training data"):
    return {"metric_id": metric_id, "label": label, "formula": formula, "source_tables": sources, "assumptions": assumptions, "real_vs_modeled": status}


@dataclass
class ScenarioRequest:
    discount_cap_pct: float = 15.0
    markdown_pct: float = 15.0


class AnalyticsService:
    """Stage 2 analytics cache. Uses engine tables only; no database."""

    def __init__(self, engine):
        self.engine = engine
        self.cache: Dict[str, Any] = {}
        self.method_rows: List[Dict[str, Any]] = []
        self.refresh()

    @property
    def t(self) -> Dict[str, pd.DataFrame]:
        return self.engine.tables

    def refresh(self) -> None:
        self.method_rows = self._build_method()
        self.cache = {
            "dashboard": self._dashboard(),
            "channels": self._channels(),
            "customers": self._customers(),
            "inventory": self._inventory(),
            "forecast": self._forecast(),
            "marketing": self._marketing(),
            "operations": self._operations(),
            "quality": self._quality(),
            "supply": self._supply(),
        }
        self.cache["story"] = self._story()
        self.cache["method"] = {"metrics": self.method_rows, "count": len(self.method_rows), "insight": f"{len(self.method_rows)} documented metrics expose formula, source and assumptions."}

    def endpoint(self, name: str):
        return _clean(self.cache[name])

    # ---------- base preparation ----------
    def _sales(self) -> pd.DataFrame:
        s = self.t["sales"].copy()
        s["date"] = _dt(s["Order_Date"])
        s["month"] = s["date"].dt.to_period("M").astype(str)
        for c in ["Quantity", "Gross_Sales_EGP", "Net_Sales_EGP", "Estimated_COGS_EGP", "Gross_Profit_EGP", "Discount_Pct", "Refund_Value_EGP", "List_Price_EGP"]:
            if c in s.columns:
                s[c] = _num(s[c])
        if "Invoice_ID" not in s.columns:
            s["Invoice_ID"] = np.arange(len(s))
        return s

    def _inventory_model(self) -> pd.DataFrame:
        return self.engine.model.copy()

    def _actions(self):
        return self.engine.decisions()

    # ---------- Stage 2 endpoints ----------
    def _dashboard(self):
        s = self._sales()
        monthly = s.groupby("month", as_index=False).agg(
            revenue_egp=("Net_Sales_EGP", "sum"), units=("Quantity", "sum"), gross_profit_egp=("Gross_Profit_EGP", "sum")
        ).sort_values("month")
        monthly["margin_pct"] = monthly["gross_profit_egp"] / monthly["revenue_egp"].replace(0, np.nan) * 100
        monthly["mom_growth_pct"] = monthly["revenue_egp"].pct_change() * 100
        monthly["yoy_growth_pct"] = monthly["revenue_egp"].pct_change(12) * 100

        season = s.assign(month_no=s["date"].dt.month).groupby("month_no", as_index=False).agg(revenue_egp=("Net_Sales_EGP", "sum"), units=("Quantity", "sum"))
        prod = s.groupby(["Product_ID", "Product_Name", "Product_Family"], as_index=False).agg(revenue_egp=("Net_Sales_EGP", "sum"), gross_profit_egp=("Gross_Profit_EGP", "sum"), units=("Quantity", "sum"))
        prod["margin_pct"] = prod["gross_profit_egp"] / prod["revenue_egp"].replace(0, np.nan) * 100
        prod = prod.sort_values("revenue_egp", ascending=False).head(10)

        bins = [-0.001, 0, 0.05, 0.10, 0.15, 0.25, 1]
        labels = ["0%", "0-5%", "5-10%", "10-15%", "15-25%", "25%+"]
        s["discount_band"] = pd.cut(s["Discount_Pct"], bins=bins, labels=labels)
        disc = s.groupby("discount_band", as_index=False, observed=False).agg(units=("Quantity", "sum"), revenue_egp=("Net_Sales_EGP", "sum"), gross_profit_egp=("Gross_Profit_EGP", "sum"))
        disc["margin_pct"] = disc["gross_profit_egp"] / disc["revenue_egp"].replace(0, np.nan) * 100

        channel = s.groupby("Channel", as_index=False).agg(revenue_egp=("Net_Sales_EGP", "sum"), gross_profit_egp=("Gross_Profit_EGP", "sum"), units=("Quantity", "sum"))
        channel["revenue_share_pct"] = channel["revenue_egp"] / channel["revenue_egp"].sum() * 100

        acts = sorted(self._actions(), key=lambda d: d["expected_impact"]["estimated_value_egp"], reverse=True)[:5]
        total_rev, total_gp = float(s["Net_Sales_EGP"].sum()), float(s["Gross_Profit_EGP"].sum())
        insight = f"Net sales are EGP {total_rev/1e6:.1f}M with gross margin {_safe_div(total_gp,total_rev)*100:.1f}%; top action is '{acts[0]['title']}' if approved."
        return {"insight": insight, "data_as_of": self.engine.data_as_of, "monthly": _records(monthly), "seasonality": _records(season), "top_products": _records(prod), "discount_impact": _records(disc), "channel_mix": _records(channel), "top_actions_this_week": acts, "formulas": ["margin = gross profit / revenue", "MoM/YoY growth = percent change in revenue", "discount bands use Discount_Pct from Sales_Transactions"], "sources": ["Sales_Transactions", "DecisionEngine decisions"]}

    def _channels(self):
        s = self._sales()
        s["returned_flag"] = s.get("Returned", "No").astype(str).str.lower().eq("yes")
        ch = s.groupby("Channel", as_index=False).agg(revenue_egp=("Net_Sales_EGP", "sum"), units=("Quantity", "sum"), gross_profit_egp=("Gross_Profit_EGP", "sum"), gross_sales_egp=("Gross_Sales_EGP", "sum"), avg_discount_pct=("Discount_Pct", "mean"), return_rate=("returned_flag", "mean"), refund_egp=("Refund_Value_EGP", "sum"), invoices=("Invoice_ID", "nunique"))
        ch["margin_pct"] = ch["gross_profit_egp"] / ch["revenue_egp"].replace(0, np.nan) * 100
        ch["aov_egp"] = ch["revenue_egp"] / ch["invoices"].replace(0, np.nan)
        ch["revenue_share_pct"] = ch["revenue_egp"] / ch["revenue_egp"].sum() * 100
        ch["gp_share_pct"] = ch["gross_profit_egp"] / ch["gross_profit_egp"].sum() * 100
        ch["avg_discount_pct"] *= 100
        ch["return_rate_pct"] = ch["return_rate"] * 100
        monthly = s.groupby(["month", "Channel"], as_index=False).agg(revenue_egp=("Net_Sales_EGP", "sum"), units=("Quantity", "sum"), gp=("Gross_Profit_EGP", "sum"))
        monthly["monthly_growth_pct"] = monthly.sort_values("month").groupby("Channel")["revenue_egp"].pct_change() * 100
        gov = s[s["Channel"].isin(["Retail", "Online"])].groupby("Customer_Governorate", as_index=False).agg(revenue_egp=("Net_Sales_EGP", "sum"), units=("Quantity", "sum")).sort_values("revenue_egp", ascending=False).head(10)
        exposure = self.engine.leakage().get("wholesale_pricing_exposure", {})
        wh = ch.loc[ch["Channel"].str.lower().eq("wholesale"), "revenue_share_pct"]
        insight = f"Wholesale contributes {float(wh.iloc[0]) if len(wh) else 0:.1f}% of sales; scenario exposure is EGP {exposure.get('value_egp',0)/1e6:.1f}M if wholesale discount falls 5 points."
        return {"insight": insight, "channels": _records(ch), "monthly_growth": _records(monthly), "top_governorates_retail_online": _records(gov), "channel_mix_opportunity": exposure, "formulas": ["AOV = net sales / invoices", "return rate = returned rows / total rows", "wholesale scenario = wholesale gross sales x 5 percentage points"], "sources": ["Sales_Transactions"]}

    def _customers(self):
        s = self._sales()
        today = pd.to_datetime(self.engine.data_as_of) if self.engine.data_as_of else s["date"].max()
        c = s.groupby(["Customer_ID", "Customer_Type"], as_index=False).agg(last_purchase=("date", "max"), frequency=("Invoice_ID", "nunique"), monetary_egp=("Net_Sales_EGP", "sum"))
        c["recency_days"] = (today - c["last_purchase"]).dt.days
        # rank buckets safe fallback
        for col, asc, name in [("recency_days", False, "r_score"), ("frequency", True, "f_score"), ("monetary_egp", True, "m_score")]:
            try:
                c[name] = pd.qcut(c[col].rank(method="first", ascending=asc), 5, labels=[1,2,3,4,5]).astype(int)
            except Exception:
                c[name] = 3
        def seg(r):
            if r.r_score >=4 and r.f_score >=4 and r.m_score >=4: return "Champions"
            if r.f_score >=4 and r.m_score >=3: return "Loyal"
            if r.r_score <=2 and r.m_score >=3: return "At Risk"
            if r.r_score ==1 and r.f_score <=2: return "Lost"
            return "New/Other"
        c["segment"] = c.apply(seg, axis=1)
        segs = c.groupby(["Customer_Type", "segment"], as_index=False).agg(customers=("Customer_ID", "nunique"), revenue_egp=("monetary_egp", "sum"), avg_recency_days=("recency_days", "mean"), avg_frequency=("frequency", "mean"))
        segs["revenue_share_pct"] = segs["revenue_egp"] / segs.groupby("Customer_Type")["revenue_egp"].transform("sum") * 100
        repeat = (c["frequency"] > 1).mean() * 100
        aov = s["Net_Sales_EGP"].sum() / s["Invoice_ID"].nunique()
        freq = c["frequency"].mean()
        top10cut = c["monetary_egp"].quantile(0.9)
        top_share = c.loc[c["monetary_egp"] >= top10cut, "monetary_egp"].sum() / c["monetary_egp"].sum() * 100
        s["cohort"] = s.groupby("Customer_ID")["date"].transform("min").dt.to_period("M").astype(str)
        s["age_m"] = ((s["date"].dt.year - pd.to_datetime(s["cohort"]).dt.year) * 12 + (s["date"].dt.month - pd.to_datetime(s["cohort"]).dt.month)).clip(0, 6)
        cohort = s[s["age_m"].between(0,6)].groupby(["cohort", "age_m"], as_index=False).agg(active_customers=("Customer_ID", "nunique"))
        cohort["cohort_size"] = cohort.groupby("cohort")["active_customers"].transform("first")
        cohort["retention_pct"] = cohort["active_customers"] / cohort["cohort_size"].replace(0, np.nan) * 100
        insight = f"Repeat rate is {repeat:.1f}% and the top 10% customers generate {top_share:.1f}% of customer revenue."
        return {"insight": insight, "segments": _records(segs), "summary": {"repeat_rate_pct": repeat, "aov_egp": aov, "purchase_frequency": freq, "top_10pct_customer_revenue_share_pct": top_share}, "cohorts_m1_m6": _records(cohort), "formulas": ["RFM: recency vs data_as_of, frequency=invoices, monetary=net sales", "retention month n = active customers in cohort month n / cohort size"], "sources": ["Sales_Transactions", "Customers"]}

    def _inventory(self):
        s, inv = self._sales(), self._inventory_model()
        prod_rev = s.groupby("Product_ID", as_index=False).agg(revenue_egp=("Net_Sales_EGP", "sum"), units=("Quantity", "sum"), cogs_egp=("Estimated_COGS_EGP", "sum"))
        prod_rev = prod_rev.sort_values("revenue_egp", ascending=False)
        prod_rev["cum_share"] = prod_rev["revenue_egp"].cumsum() / prod_rev["revenue_egp"].sum()
        prod_rev["abc_class"] = np.select([prod_rev["cum_share"] <= .8, prod_rev["cum_share"] <= .95], ["A", "B"], default="C")
        monthly_units = s.groupby(["Product_ID", "month"], as_index=False).agg(units=("Quantity", "sum"))
        xyz = monthly_units.groupby("Product_ID").agg(avg=("units", "mean"), std=("units", "std")).reset_index()
        xyz["cv"] = xyz["std"].fillna(0) / xyz["avg"].replace(0, np.nan)
        xyz["xyz_class"] = np.select([xyz["cv"] < .5, xyz["cv"] < 1], ["X", "Y"], default="Z")
        matrix = prod_rev.merge(xyz[["Product_ID", "cv", "xyz_class"]], on="Product_ID", how="left")
        matrix["abc_xyz"] = matrix["abc_class"] + matrix["xyz_class"].fillna("Z")
        mat_sum = matrix.groupby(["abc_class", "xyz_class", "abc_xyz"], as_index=False).agg(products=("Product_ID", "nunique"), revenue_egp=("revenue_egp", "sum"))
        avg_inv_value = (inv["current_stock"] * inv["unit_cost_egp"]).sum()
        cogs_12m = s[s["date"] >= s["date"].max() - pd.DateOffset(months=12)]["Estimated_COGS_EGP"].sum()
        stock_turns = _safe_div(cogs_12m, avg_inv_value)
        cover_dist = inv["days_of_cover"].describe(percentiles=[.25,.5,.75,.9]).to_dict()
        over = inv[inv["dead_stock"]].sort_values("trapped_capital_egp", ascending=False)[["Product_ID","Product_Name","Location_Name","current_stock","days_of_cover","trapped_capital_egp"]].head(20)
        stockout = inv[inv["stockout_risk"]].sort_values("days_of_cover")[["Product_ID","Product_Name","Location_Name","current_stock","days_of_cover","reorder_point"]].head(20)
        insight = f"Stock turns are {stock_turns:.2f}x; {len(over)} top overstock rows and {len(stockout)} stockout-risk rows need review."
        return {"insight": insight, "abc_xyz_matrix": _records(mat_sum), "product_classes": _records(matrix.merge(s[["Product_ID","Product_Name","Product_Family"]].drop_duplicates(), on="Product_ID", how="left"), 100), "stock_turns": stock_turns, "days_of_cover_distribution": _clean(cover_dist), "overstock_list": _records(over), "stockout_list": _records(stockout), "formulas": ["ABC by cumulative revenue: A<=80%, B<=95%, C=rest", "XYZ by CV of monthly units: X<0.5, Y<1, Z>=1", "stock turns = trailing 12m COGS / current inventory value"], "sources": ["Sales_Transactions", "Inventory_History", "Product_Master"]}

    def _forecast(self):
        s, inv = self._sales(), self._inventory_model()
        monthly = s.groupby(["Product_ID", "Product_Name", "Product_Family", "month"], as_index=False).agg(units=("Quantity", "sum"))
        rows=[]
        for (pid,pname,fam), g in monthly.groupby(["Product_ID","Product_Name","Product_Family"]):
            g=g.sort_values("month")
            vals=g["units"].to_numpy(dtype=float)
            if len(vals)<4: continue
            train, actual=vals[:-3], vals[-3:]
            baseline=np.repeat(train[-3:].mean(),3)
            trend = np.polyfit(np.arange(len(train)), train, 1)[0] if len(train)>=18 else 0
            model=np.array([max(train[-3:].mean()+trend*(i+1),0) for i in range(3)])
            def wape(pred): return np.abs(actual-pred).sum()/max(actual.sum(),1)
            wb, wm=wape(baseline), wape(model)
            use_baseline=wm>wb
            basis=baseline.mean() if use_baseline else model.mean()
            stock=inv.loc[inv["Product_ID"].eq(pid), "current_stock"].sum()
            lead=inv.loc[inv["Product_ID"].eq(pid), "lead_time_days"].mean() if pid in set(inv["Product_ID"]) else 14
            demand30=basis
            rows.append({"product_id":pid,"product_name":pname,"product_family":fam,"forecast_30d_units":demand30,"forecast_60d_units":demand30*2,"forecast_90d_units":demand30*3,"wape_model_pct":wm*100,"wape_baseline_pct":wb*100,"method_used":"baseline" if use_baseline else ("trend" if len(train)>=18 else "mean_last_3"),"current_stock":stock,"lead_time_days":lead,"replenishment_qty":max(math.ceil(basis*((lead+30)/30)-stock),0)})
        df=pd.DataFrame(rows).sort_values("forecast_90d_units", ascending=False).head(20)
        fam=df.groupby("product_family", as_index=False).agg(forecast_30d_units=("forecast_30d_units","sum"), forecast_60d_units=("forecast_60d_units","sum"), forecast_90d_units=("forecast_90d_units","sum")) if not df.empty else pd.DataFrame()
        insight=f"Forecast built for {len(df)} top products; models that lost to baseline were automatically downgraded."
        return {"insight": insight, "top20_products": _records(df), "family_forecast": _records(fam), "formulas": ["If >=18 months use last-3-month mean plus linear trend, else mean of last 3 months", "WAPE = sum(abs(actual-forecast))/sum(actual)", "replenishment = forecast demand over lead time + 30 days - stock - incoming transfers"], "sources": ["Sales_Transactions", "Inventory_History"]}

    def _marketing(self):
        m = self.t["marketing"].copy()
        for c in ["Spend_EGP","Impressions","Clicks","Landing_Page_Sessions","Orders_Attributed","Attributed_Revenue_EGP"]: m[c]=_num(m[c])
        m["ctr_pct"] = m["Clicks"] / m["Impressions"].replace(0,np.nan)*100
        m["conversion_pct"] = m["Orders_Attributed"] / m["Clicks"].replace(0,np.nan)*100
        m["cac_egp"] = m["Spend_EGP"] / m["Orders_Attributed"].replace(0,np.nan)
        m["roas"] = m["Attributed_Revenue_EGP"] / m["Spend_EGP"].replace(0,np.nan)
        by_platform=m.groupby("Platform", as_index=False).agg(spend_egp=("Spend_EGP","sum"), impressions=("Impressions","sum"), clicks=("Clicks","sum"), orders=("Orders_Attributed","sum"), attributed_revenue_egp=("Attributed_Revenue_EGP","sum"))
        by_platform["ctr_pct"]=by_platform["clicks"]/by_platform["impressions"].replace(0,np.nan)*100; by_platform["conversion_pct"]=by_platform["orders"]/by_platform["clicks"].replace(0,np.nan)*100; by_platform["cac_egp"]=by_platform["spend_egp"]/by_platform["orders"].replace(0,np.nan); by_platform["roas"]=by_platform["attributed_revenue_egp"]/by_platform["spend_egp"].replace(0,np.nan)
        by_family=m.groupby("Product_Name", as_index=False).agg(spend_egp=("Spend_EGP","sum"), attributed_revenue_egp=("Attributed_Revenue_EGP","sum"), orders=("Orders_Attributed","sum")).sort_values("spend_egp",ascending=False).head(20)
        med=m["Spend_EGP"].median(); outliers=m[m["Spend_EGP"]>=med].sort_values("roas")
        bottom=outliers.head(5); top=outliers.tail(5).sort_values("roas", ascending=False)
        bottom_spend=float(bottom["Spend_EGP"].sum()); top_roas=float(top["roas"].replace([np.inf,-np.inf],np.nan).mean()); bottom_roas=float(bottom["roas"].replace([np.inf,-np.inf],np.nan).mean())
        reallocate_pct=.2; effect=bottom_spend*reallocate_pct*max(top_roas-bottom_roas,0)
        w=self.t["web_traffic"].copy()
        funnel={"sessions": float(_num(w["Sessions"]).sum()), "users": float(_num(w["Users"]).sum()), "orders": float(_num(w["Orders"]).sum()), "avg_conversion_rate_pct": float(_num(w["Conversion_Rate"]).mean()*100), "avg_add_to_cart_rate_pct": float(_num(w["Add_To_Cart_Rate"]).mean()*100), "avg_checkout_rate_pct": float(_num(w["Checkout_Rate"]).mean()*100)}
        insight=f"Average platform ROAS ranges from {by_platform['roas'].min():.2f}x to {by_platform['roas'].max():.2f}x; reallocating 20% of bottom spend is an EGP {effect:,.0f} estimate."
        return {"insight": insight, "by_platform": _records(by_platform), "by_product": _records(by_family), "campaigns": _records(m.sort_values("roas", ascending=False), 50), "top_roas_campaigns": _records(top), "bottom_roas_campaigns": _records(bottom), "budget_reallocation_estimate": {"move_pct": 20, "estimated_incremental_revenue_egp": effect, "assumption": "constant ROAS; estimate only"}, "web_funnel": funnel, "formulas": ["CTR=clicks/impressions", "conversion=orders/clicks", "CAC=spend/orders", "ROAS=attributed revenue/spend"], "sources": ["Marketing", "Web_Traffic_Daily"]}

    def _operations(self):
        p=self.t["production_orders"].copy(); pr=self.t["printing_batches"].copy(); d=self.t["machine_downtime"].copy()
        for c in ["Planned_Qty","Produced_Qty","Good_Qty","Rejected_Qty","Delay_Days","Overtime_Hours","Efficiency_Pct"]:
            if c in p: p[c]=_num(p[c])
        line=p.groupby("Line_ID", as_index=False).agg(planned_qty=("Planned_Qty","sum"), produced_qty=("Produced_Qty","sum"), good_qty=("Good_Qty","sum"), rejected_qty=("Rejected_Qty","sum"), avg_delay_days=("Delay_Days","mean"), overtime_hours=("Overtime_Hours","sum"), avg_efficiency_pct=("Efficiency_Pct","mean"), bottleneck_frequency=("Primary_Bottleneck", lambda s: int(s.replace(0,np.nan).dropna().shape[0])))
        line["attainment_pct"]=line["produced_qty"]/line["planned_qty"].replace(0,np.nan)*100; line["reject_rate_pct"]=line["rejected_qty"]/line["produced_qty"].replace(0,np.nan)*100; line["capacity_utilisation_pct"]=line["attainment_pct"]
        for c in ["Planned_Qty","Printed_Qty","Good_Qty","Rejected_Qty","Reprint_Qty","Ink_or_Consumable_Cost_EGP","Rework_Cost_EGP"]:
            if c in pr: pr[c]=_num(pr[c])
        pm=pr.groupby("Machine_ID", as_index=False).agg(printed_qty=("Printed_Qty","sum"), good_qty=("Good_Qty","sum"), rejected_qty=("Rejected_Qty","sum"), reprint_qty=("Reprint_Qty","sum"), ink_cost_egp=("Ink_or_Consumable_Cost_EGP","sum"), rework_cost_egp=("Rework_Cost_EGP","sum"))
        pm["yield_pct"]=pm["good_qty"]/pm["printed_qty"].replace(0,np.nan)*100; pm["reject_rate_pct"]=pm["rejected_qty"]/pm["printed_qty"].replace(0,np.nan)*100; pm["rework_reprint_cost_egp"]=pm["rework_cost_egp"]+pm["ink_cost_egp"]*pm["reprint_qty"]/pm["printed_qty"].replace(0,np.nan)
        d["Downtime_Hours"]=_num(d["Downtime_Hours"]); downtime=d[d["Planned"].astype(str).str.lower().eq("no")].groupby(["Machine_ID","Reason"], as_index=False).agg(unplanned_hours=("Downtime_Hours","sum"))
        maint=pm.merge(downtime.groupby("Machine_ID",as_index=False).agg(unplanned_hours=("unplanned_hours","sum")), on="Machine_ID", how="left").fillna(0)
        maint["maintenance_priority_score"]=maint["unplanned_hours"].rank(ascending=False)+maint["reject_rate_pct"].rank(ascending=False)
        actions=maint.sort_values("maintenance_priority_score").head(5)
        insight=f"Production attainment averages {line['attainment_pct'].mean():.1f}% and top maintenance priorities are driven by downtime plus print reject rate."
        return {"insight": insight, "production_by_line": _records(line), "printing_by_machine": _records(pm), "downtime_by_machine_reason": _records(downtime), "maintenance_priorities": _records(actions), "formulas": ["attainment=produced/planned", "print yield=good/printed", "maintenance score=rank(downtime hours)+rank(reject rate)"], "sources": ["Production_Orders", "Printing_Batches", "Machine_Downtime"]}

    def _quality(self):
        q=self.t["quality"].copy(); s=self._sales()
        q["loss"]=_num(q["Estimated_Loss_EGP"]); q["inspected"]=_num(q["Inspected_Qty"]); q["rejected"]=_num(q["Rejected_Qty"])
        pareto=q.groupby(["Defect_Type","Root_Cause","Stage"], dropna=False, as_index=False).agg(loss_egp=("loss","sum"), rejected_qty=("rejected","sum"), inspected_qty=("inspected","sum")).sort_values("loss_egp", ascending=False).head(20)
        returns=s[s.get("Quality_Related_Return","No").astype(str).str.lower().eq("yes")].groupby(["Product_ID","Product_Name","Return_Reason"], as_index=False).agg(refund_egp=("Refund_Value_EGP","sum"), returns=("Invoice_ID","nunique")).sort_values("refund_egp", ascending=False).head(20)
        qc=q.groupby(["Product_ID","Product_Name"], as_index=False).agg(qc_rejected=("rejected","sum"), qc_inspected=("inspected","sum"), qc_loss_egp=("loss","sum")); qc["qc_reject_rate_pct"]=qc["qc_rejected"]/qc["qc_inspected"].replace(0,np.nan)*100
        sale_prod=s.groupby(["Product_ID","Product_Name"], as_index=False).agg(sales_rows=("Invoice_ID","count"), return_rows=("returned_flag" if "returned_flag" in s.columns else "Invoice_ID", "count"))
        s["returned_flag"]=s.get("Returned","No").astype(str).str.lower().eq("yes")
        sale_prod=s.groupby(["Product_ID","Product_Name"], as_index=False).agg(sales_rows=("Invoice_ID","count"), return_rows=("returned_flag","sum")); sale_prod["return_rate_pct"]=sale_prod["return_rows"]/sale_prod["sales_rows"].replace(0,np.nan)*100
        assoc=qc.merge(sale_prod,on=["Product_ID","Product_Name"],how="outer").fillna(0).sort_values("qc_loss_egp",ascending=False).head(50)
        actions=pareto.head(5).copy(); actions["recommended_action"]="Root-cause corrective action on recurring defect cluster"
        insight=f"Top QC defect cluster represents EGP {float(pareto['loss_egp'].iloc[0]) if len(pareto) else 0:,.0f}; QC and returns are shown as association, not causation."
        return {"insight": insight, "defect_pareto": _records(pareto), "quality_related_returns": _records(returns), "product_association_table": _records(assoc), "corrective_action_priorities": _records(actions), "formulas": ["QC reject rate = rejected / inspected", "Return association table joins product QC reject rate to product return rate; association only"], "sources": ["Quality", "Sales_Transactions"]}

    def _supply(self):
        po=self.t["purchase_orders"].copy(); sup=self.t["suppliers"].copy(); bom=self.t["product_bom"].copy()
        po["order"]=_dt(po["Order_Date"]); po["prom"]=_dt(po["Promised_Date"]); po["act"]=_dt(po["Actual_Receipt_Date"])
        for c in ["Ordered_Qty","Unit_Cost_EGP","Accepted_Qty","Rejected_Qty"]: po[c]=_num(po[c])
        po["lead_time_days"]=(po["act"]-po["order"]).dt.days; po["on_time"]=(po["act"]<=po["prom"]).astype(float); po["spend_egp"]=po["Ordered_Qty"]*po["Unit_Cost_EGP"]
        g=po.groupby(["Supplier_ID","Material_ID","Material_Name"], as_index=False).agg(lead_time_days=("lead_time_days","mean"), on_time_pct=("on_time",lambda x:x.mean()*100), acceptance_pct=("Accepted_Qty",lambda x: x.sum()), ordered=("Ordered_Qty","sum"), spend_egp=("spend_egp","sum"))
        g["acceptance_pct"]=g["acceptance_pct"]/g["ordered"].replace(0,np.nan)*100
        g=g.merge(sup[["Supplier_ID","Supplier_Name","Primary_Category"]],on="Supplier_ID",how="left")
        po["quarter"]=po["order"].dt.to_period("Q").astype(str)
        first=po.sort_values("order").groupby("Material_ID").first()[["Unit_Cost_EGP"]].rename(columns={"Unit_Cost_EGP":"first_unit_cost"})
        last=po.sort_values("order").groupby("Material_ID").last()[["Unit_Cost_EGP"]].rename(columns={"Unit_Cost_EGP":"last_unit_cost"})
        trend=first.join(last).reset_index(); trend["unit_cost_change_pct"]=(trend["last_unit_cost"]-trend["first_unit_cost"])/trend["first_unit_cost"].replace(0,np.nan)*100
        crit=bom.groupby("Material_ID",as_index=False).agg(products_using=("Product_ID","nunique")); spend=po.groupby("Material_ID",as_index=False).agg(spend_egp=("spend_egp","sum")); crit=crit.merge(spend,on="Material_ID",how="left"); crit["criticality_score"]=crit["products_using"]*crit["spend_egp"].fillna(0)
        risk=g[(g["acceptance_pct"]<97)|(g["on_time_pct"]<70)].sort_values("spend_egp",ascending=False).head(20)
        supplier_spend=g.groupby("Supplier_Name",as_index=False).agg(spend_egp=("spend_egp","sum"), on_time_pct=("on_time_pct","mean")); med=supplier_spend["spend_egp"].median(); matrix=[]
        for _,r in supplier_spend.iterrows():
            reliable=r["on_time_pct"]>=70; high=r["spend_egp"]>=med; matrix.append({"supplier_name":r["Supplier_Name"],"quadrant":("reliable" if reliable else "unreliable")+" / "+("high spend" if high else "low spend"),"recommended_action":"strategic partnership" if reliable and high else "backup supplier" if (not reliable and high) else "standard terms" if reliable else "monitor only","spend_egp":r["spend_egp"],"on_time_pct":r["on_time_pct"]})
        insight=f"Supplier on-time averages {self.engine.supply_readiness().get('overall',{}).get('on_time_pct',0):.1f}% while material acceptance is high; late high-spend suppliers drive readiness risk."
        return {"insight": insight, "supplier_material_performance": _records(g), "unit_cost_trend_by_material": _records(trend), "material_criticality": _records(crit.sort_values("criticality_score",ascending=False),20), "shortage_risk_materials": _records(risk), "action_matrix": _clean(matrix), "formulas": ["lead time = receipt date - order date", "acceptance = accepted / ordered", "criticality = products using material x material spend"], "sources": ["Purchase_Orders", "Suppliers", "Product_BOM", "Materials"]}

    def _story(self):
        ov=self.engine.overview(); dash=self.cache["dashboard"]; ch=self.cache["channels"]; cust=self.cache["customers"]; mkt=self.cache["marketing"]; inv=self.cache["inventory"]; sup=self.cache["supply"]; qual=self.cache["quality"]; leak=self.engine.leakage()
        steps=[
            {"step":1,"headline":"Demand is large, margin is thin","numbers":[{"label":"Net sales","value_egp":ov["kpis"]["total_revenue_egp"]},{"label":"Gross margin %","value_pct":ov["kpis"]["gross_margin_pct"]}],"action":"Prioritize margin-protecting actions before volume growth."},
            {"step":2,"headline":"Customer value is concentrated","numbers":[cust["summary"]],"action":"Use RFM segments for retention and win-back."},
            {"step":3,"headline":"Wholesale dominates channel mix","numbers":ch["channels"],"action":"Separate wholesale pricing exposure from leakage."},
            {"step":4,"headline":"Marketing efficiency varies by platform","numbers":mkt["by_platform"],"action":"Move test budget from bottom ROAS to top ROAS platforms."},
            {"step":5,"headline":"Inventory creates both trapped cash and stockout exposure","numbers":[{"stock_turns":inv["stock_turns"]},{"forecast_products":len(self.cache["forecast"]["top20_products"])}],"action":"Rebalance stock before discounting or reordering."},
            {"step":6,"headline":"Supply and production risks constrain execution","numbers":[sup["action_matrix"][:3], self.cache["operations"]["maintenance_priorities"][:3]],"action":"Prioritize high-spend unreliable suppliers and downtime-heavy machines."},
            {"step":7,"headline":"Quality closes the loop","numbers":qual["corrective_action_priorities"],"action":"Use defect Pareto to focus corrective actions."},
        ]
        opportunity=leak["conservative_total_egp"]+sum(d["expected_impact"]["estimated_value_egp"] for d in self._actions()[:5])
        return {"insight": f"Story quantifies EGP {opportunity/1e6:.1f}M of conservative leakage plus top-ranked decision upside/exposure.", "steps": steps, "total_quantified_opportunity_egp": opportunity, "assumptions": ["Decision impacts are exposures/opportunities, not guaranteed profit.", "Modeled training data: use for internship demo, not audited finance."], "scenario_endpoint": "/api/scenario", "formulas": ["opportunity = conservative leakage + top 5 decision values"], "sources": ["All stage 2 endpoints"]}

    def scenario(self, discount_cap_pct: float = 15, markdown_pct: float = 15):
        s=self._sales(); cap=discount_cap_pct/100; retail=s[s["Channel"].isin(["Retail","Online"])]
        disc=retail["Discount_Pct"]; disc = disc/100 if disc.max()>1 else disc
        discount_leak=float((retail["Gross_Sales_EGP"]*(disc-cap).clip(lower=0)).sum())
        dead=float(self._inventory_model().loc[self._inventory_model()["dead_stock"],"trapped_capital_egp"].sum())
        markdown_recovery=dead*(markdown_pct/100)
        total=discount_leak+markdown_recovery
        return _clean({"discount_cap_pct":discount_cap_pct,"markdown_pct":markdown_pct,"retail_online_excess_discount_egp":discount_leak,"markdown_recovery_estimate_egp":markdown_recovery,"total_scenario_impact_egp":total,"label":"estimate","assumptions":["Discount cap only applies to Retail and Online.","Markdown recovery uses trapped capital x markdown %, not demand elasticity."]})

    def _build_method(self):
        return [
            _metric("sales.revenue", "Net sales", "sum(Net_Sales_EGP)", ["Sales_Transactions"], ["Recorded modeled transactions."], "Modeled transaction data"),
            _metric("sales.margin", "Gross margin %", "sum(Gross_Profit_EGP) / sum(Net_Sales_EGP)", ["Sales_Transactions"], ["COGS is estimated in the dataset."], "Modeled transaction data"),
            _metric("channels.aov", "Average order value", "sum(Net_Sales_EGP) / count(distinct Invoice_ID)", ["Sales_Transactions"], [], "Modeled transaction data"),
            _metric("customers.rfm", "RFM segments", "recency quintile + frequency quintile + monetary quintile", ["Sales_Transactions"], ["Quintiles are based on available customer history."], "Modeled/anonymized customer data"),
            _metric("inventory.abc", "ABC class", "cumulative revenue share: A<=80%, B<=95%, C=rest", ["Sales_Transactions"], [], "Modeled transaction data"),
            _metric("inventory.xyz", "XYZ class", "coefficient of variation of monthly units", ["Sales_Transactions"], [], "Modeled transaction data"),
            _metric("forecast.wape", "Forecast WAPE", "sum(abs(actual-forecast))/sum(actual)", ["Sales_Transactions"], ["Backtest uses last 3 months."], "Modeled transaction data"),
            _metric("marketing.roas", "ROAS", "Attributed_Revenue_EGP / Spend_EGP", ["Marketing"], ["Campaign data is modeled, not ad account export."], "Modeled campaign data"),
            _metric("operations.attainment", "Production attainment", "Produced_Qty / Planned_Qty", ["Production_Orders"], [], "Modeled factory data"),
            _metric("quality.reject_rate", "QC reject rate", "Rejected_Qty / Inspected_Qty", ["Quality"], [], "Modeled QC data"),
            _metric("supply.on_time", "Supplier on-time", "Actual_Receipt_Date <= Promised_Date", ["Purchase_Orders"], [], "Modeled procurement data"),
            _metric("leakage.discount", "Retail/Online discount leakage", "Gross_Sales_EGP x max(Discount_Pct - cap, 0)", ["Sales_Transactions"], ["Wholesale excluded as volume pricing."], "Modeled transaction data"),
        ]

    def data_health_extension(self):
        out=[]
        for name,obj in self.cache.items():
            out.append({"check": f"endpoint_{name}_available", "expected": "dict with insight", "actual": isinstance(obj, dict) and bool(obj.get("insight")), "pass": isinstance(obj, dict) and bool(obj.get("insight"))})
        out.append({"check":"method_rows_present","expected":">=10","actual":len(self.method_rows),"pass":len(self.method_rows)>=10})
        return out
