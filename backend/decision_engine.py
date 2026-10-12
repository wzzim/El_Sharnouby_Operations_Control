import math
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd


class DecisionEngine:
    """
    El-Sharnouby Decision Control Room Engine

    - Loads the 20 CSVs from ../data (Survival Protocol: never crashes, falls back to mock per table)
    - Uses ONLY the latest inventory snapshot for stock-on-hand (history is monthly)
    - Every number is computed from the CSVs; every decision carries its formula
    - Decision types: markdown, stock transfer, replenishment, supplier risk,
      quality root-cause, marketing (low-stock push + low ROAS)
    """

    CSV_FILES = {
        "business_units": "Business_Units.csv",
        "case_briefs": "Case_Briefs.csv",
        "customer_service": "Customer_Service.csv",
        "customers": "Customers.csv",
        "data_dictionary": "Data_Dictionary.csv",
        "group_operations": "Group_Operations.csv",
        "inventory": "Inventory_History.csv",
        "locations": "Locations.csv",
        "machine_downtime": "Machine_Downtime.csv",
        "marketing": "Marketing.csv",
        "materials": "Materials.csv",
        "printing_batches": "Printing_Batches.csv",
        "product_bom": "Product_BOM.csv",
        "products": "Product_Master.csv",
        "production_orders": "Production_Orders.csv",
        "purchase_orders": "Purchase_Orders.csv",
        "quality": "Quality.csv",
        "sales": "Sales_Transactions.csv",
        "suppliers": "Suppliers.csv",
        "web_traffic": "Web_Traffic_Daily.csv",
    }

    REQUIRED_COLUMNS = {
        "inventory": ["Product_ID", "Product_Name", "Location_Name", "Closing_Stock",
                      "Avg_Daily_Sales_90D", "Days_of_Cover", "Reorder_Point_Units"],
        "products": ["Product_ID", "Product_Name", "Product_Family", "Public_Retail_Price_EGP"],
        "sales": ["Order_Date", "Product_ID", "Product_Name", "Quantity", "Net_Sales_EGP",
                  "Estimated_COGS_EGP", "Gross_Profit_EGP"],
        "purchase_orders": ["PO_ID", "Supplier_ID", "Promised_Date", "Actual_Receipt_Date",
                            "Ordered_Qty", "Accepted_Qty", "Rejected_Qty", "Unit_Cost_EGP"],
        "quality": ["Inspection_Date", "Product_ID", "Product_Name", "Inspected_Qty",
                    "Rejected_Qty", "Defect_Type", "Root_Cause", "Estimated_Loss_EGP"],
        "production_orders": ["Product_ID", "Rejected_Qty"],
        "printing_batches": ["Product_ID", "Printed_Qty", "Rejected_Qty",
                             "Ink_or_Consumable_Cost_EGP", "Rework_Cost_EGP"],
        "marketing": ["Campaign_ID", "Campaign_Name", "Product_ID", "Platform", "End_Date",
                      "Spend_EGP", "Clicks", "Orders_Attributed", "Attributed_Revenue_EGP"],
        "suppliers": ["Supplier_ID", "Supplier_Name"],
    }

    # ---- Tunable business rules (shown to the user in every explanation) ----
    DEAD_STOCK_COVER_DAYS = 60       # cover >= this => candidate for markdown
    REVIEW_BUFFER_DAYS = 7           # stockout risk if cover <= lead time + this
    REPLENISH_HORIZON_DAYS = 30      # order enough for lead time + this many days
    DISCOUNT_CAP_PCT = 0.15          # discount above this counts as leakage
    SUPPLIER_CRITICAL = (0.50, 0.95)  # (on-time, quality) below either => critical
    SUPPLIER_WATCH = (0.70, 0.97)     # below either => watchlist
    SCRAP_RECOVERY_PCT = 0.0          # recovered scrap value offset; 0 means no recovery credited
    MIN_SUPPLIER_ORDERS = 5
    DEFAULT_COST_RATIO = 0.62        # unit cost fallback = price * this

    def __init__(self):
        self.base_dir = Path(__file__).resolve().parent
        self.data_dir = self.base_dir.parent / "data"
        self.tables: Dict[str, pd.DataFrame] = {}
        self.mocked: set = set()
        self.load_warnings: List[str] = []
        self._rng = np.random.default_rng(42)
        self.loaded_at = datetime.now().isoformat(timespec="seconds")
        self.data_as_of: Optional[str] = None
        self._cache: Dict[str, Any] = {}

        self._load_all_tables()
        self.refresh()

    @property
    def using_mock_data(self) -> bool:
        return len(self.mocked) > 0

    # ------------------------------------------------------------------
    # Loading / Survival Protocol
    # ------------------------------------------------------------------

    def _load_all_tables(self) -> None:
        for table_name, file_name in self.CSV_FILES.items():
            required = self.REQUIRED_COLUMNS.get(table_name, [])
            self.tables[table_name] = self._safe_load_csv(table_name, file_name, required)

    def _safe_load_csv(self, table_name: str, file_name: str, required: List[str]) -> pd.DataFrame:
        path = self.data_dir / file_name
        try:
            if not os.path.exists(path):
                raise FileNotFoundError(f"Missing CSV: {file_name}")
            df = pd.read_csv(path, encoding="utf-8-sig", low_memory=False)
            df.columns = [str(c).strip() for c in df.columns]
            missing = [c for c in required if c not in df.columns]
            if missing:
                raise ValueError(f"{file_name} missing required columns: {missing}")
            return df
        except Exception as e:
            self.mocked.add(table_name)
            self.load_warnings.append(f"{table_name}: {e}")
            return self._mock_table(table_name)

    def _mock_table(self, table_name: str) -> pd.DataFrame:
        products = [
            ("P-1042", "Black Cotton Hoodie", "Hoodies", 850),
            ("P-2031", "Oversized White T-Shirt", "T-Shirts", 420),
            ("P-3308", "Navy Jogger Pants", "Pants", 690),
            ("P-4490", "Beige Linen Shirt", "Shirts", 760),
            ("P-5105", "Kids Summer Pajama Set", "Kidswear", 390),
            ("P-6601", "Women Basic Sweatshirt", "Sweatshirts", 720),
        ]
        if table_name == "inventory":
            return pd.DataFrame([{
                "Snapshot_Month": "2026-09-01", "Location_ID": "LOC001",
                "Location_Name": "Alexandria Branch", "Product_ID": p[0], "SKU": p[0],
                "Product_Name": p[1], "Opening_Stock": stock + 20, "Received_Qty": 30,
                "Sold_Qty": sold, "Returned_Qty": 2, "Damaged_Qty": 1, "Closing_Stock": stock,
                "Avg_Daily_Sales_90D": max(sold / 30, 0.1), "Safety_Stock_Units": 20,
                "Reorder_Point_Units": 60, "Supplier_Lead_Time_Days": 7,
                "Days_of_Cover": round(stock / max(sold / 30, 0.1), 1),
                "Stockout_Days_In_Month": 0, "Data_Class": "Mock fallback inventory",
            } for p, stock, sold in zip(products, [420, 310, 95, 260, 580, 180], [6, 18, 80, 9, 7, 14])])
        if table_name == "products":
            return pd.DataFrame([{
                "Product_ID": p[0], "SKU": p[0], "Product_Name": p[1], "Brand": "Leo Moda",
                "Product_Family": p[2], "Public_Retail_Price_EGP": p[3],
                "Verification_Class": "Mock fallback product",
            } for p in products])
        if table_name == "sales":
            rows = []
            for month in pd.date_range("2026-01-01", periods=9, freq="MS"):
                for pid, pname, family, price in products:
                    qty = int(self._rng.integers(20, 120))
                    discount = float(self._rng.choice([0.0, 0.1, 0.15]))
                    net = qty * price * (1 - discount)
                    cogs = net * float(self._rng.uniform(0.55, 0.72))
                    rows.append({
                        "Order_Date": month.strftime("%Y-%m-%d"), "Location_Name": "Alexandria Branch",
                        "Channel": "Retail", "Product_ID": pid, "Product_Name": pname,
                        "Product_Family": family, "Quantity": qty, "List_Price_EGP": price,
                        "Discount_Pct": discount, "Gross_Sales_EGP": qty * price,
                        "Net_Sales_EGP": net, "Estimated_COGS_EGP": cogs,
                        "Gross_Profit_EGP": net - cogs, "Returned": "No", "Refund_Value_EGP": 0,
                    })
            return pd.DataFrame(rows)
        # Everything else: empty -> the related feature reports "not available"
        return pd.DataFrame()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _has(self, table: str, cols: List[str]) -> bool:
        if table in self.mocked:
            return False
        df = self.tables.get(table)
        return df is not None and not df.empty and all(c in df.columns for c in cols)

    @staticmethod
    def _num(series, default=0.0):
        return pd.to_numeric(series, errors="coerce").fillna(default)

    @staticmethod
    def _dt(series):
        return pd.to_datetime(series, errors="coerce")

    @staticmethod
    def _safe_divide(a, b, default=0.0):
        try:
            if b == 0 or pd.isna(b):
                return default
            return a / b
        except Exception:
            return default

    @staticmethod
    def _slug(text: Any) -> str:
        return re.sub(r"[^A-Za-z0-9]+", "-", str(text)).strip("-")[:40] or "X"

    @staticmethod
    def _conf(support: float) -> float:
        """Data-support score in [0.50, 0.95]. NOT a statistical probability."""
        return round(0.50 + 0.45 * min(max(float(support), 0.0), 1.0), 2)

    @classmethod
    def _clean_value(cls, value):
        if value is None:
            return None
        if isinstance(value, (np.bool_, bool)):
            return bool(value)
        if isinstance(value, (np.integer,)):
            return int(value)
        if isinstance(value, (np.floating, float)):
            v = float(value)
            return None if (math.isnan(v) or math.isinf(v)) else round(v, 2)
        if isinstance(value, (pd.Timestamp, datetime)):
            return value.strftime("%Y-%m-%d")
        try:
            if pd.isna(value):
                return None
        except (TypeError, ValueError):
            pass
        return value

    @classmethod
    def _clean_json(cls, obj):
        if isinstance(obj, dict):
            return {str(k): cls._clean_json(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [cls._clean_json(v) for v in obj]
        return cls._clean_value(obj)

    # ------------------------------------------------------------------
    # Build everything once (call refresh() to reload)
    # ------------------------------------------------------------------

    def refresh(self) -> None:
        self.econ = self._unit_economics()
        self.model = self._build_inventory_model()
        self._cache["supply"] = self._compute_supply_readiness()
        self._cache["leakage"] = self._compute_leakage()
        self._cache["decisions"] = self._build_decisions()

    def _unit_economics(self) -> pd.DataFrame:
        sales = self.tables["sales"].copy()
        sales["_q"] = self._num(sales["Quantity"])
        sales["_c"] = self._num(sales["Estimated_COGS_EGP"])
        sales["_g"] = self._num(sales["Gross_Profit_EGP"])
        g = sales.groupby("Product_ID", as_index=False).agg(
            qty=("_q", "sum"), cogs=("_c", "sum"), gp=("_g", "sum"))
        qty = g["qty"].replace(0, np.nan)
        g["unit_cost_egp"] = (g["cogs"] / qty).fillna(0)
        g["unit_profit_egp"] = (g["gp"] / qty).fillna(0)
        return g[["Product_ID", "unit_cost_egp", "unit_profit_egp"]]

    def _build_inventory_model(self) -> pd.DataFrame:
        inv = self.tables["inventory"].copy()
        products = self.tables["products"][["Product_ID", "Product_Family", "Public_Retail_Price_EGP"]]

        # --- history stats (all months) used for confidence ---
        inv["_month"] = self._dt(inv["Snapshot_Month"]) if "Snapshot_Month" in inv.columns else pd.NaT
        inv["_sold"] = self._num(inv["Sold_Qty"]) if "Sold_Qty" in inv.columns else 0.0
        stats = inv.groupby(["Product_ID", "Location_Name"], as_index=False).agg(
            history_months=("_month", "nunique"), sold_mean=("_sold", "mean"), sold_std=("_sold", "std"))
        stats["demand_cv"] = (stats["sold_std"].fillna(0) /
                              stats["sold_mean"].replace(0, np.nan)).fillna(1.0).clip(0, 2)

        # --- ONLY the latest snapshot is stock on hand today ---
        if inv["_month"].notna().any():
            latest = inv["_month"].max()
            inv = inv[inv["_month"] == latest].copy()
            self.data_as_of = latest.strftime("%Y-%m-%d")

        df = (inv.merge(products, on="Product_ID", how="left")
                 .merge(self.econ, on="Product_ID", how="left")
                 .merge(stats[["Product_ID", "Location_Name", "history_months", "demand_cv"]],
                        on=["Product_ID", "Location_Name"], how="left"))

        df["Location_ID"] = df["Location_ID"] if "Location_ID" in df.columns else df["Location_Name"].map(self._slug)
        df["current_stock"] = self._num(df["Closing_Stock"])
        df["avg_daily_sales"] = self._num(df["Avg_Daily_Sales_90D"])
        df["sales_30d"] = df["avg_daily_sales"] * 30
        df["reorder_point"] = self._num(df["Reorder_Point_Units"])
        df["lead_time_days"] = (self._num(df["Supplier_Lead_Time_Days"], 7)
                                if "Supplier_Lead_Time_Days" in df.columns else 7.0)
        df["unit_price_egp"] = self._num(df["Public_Retail_Price_EGP"])
        df["history_months"] = self._num(df["history_months"], 1)
        df["demand_cv"] = self._num(df["demand_cv"], 1.0)

        cover = self._num(df["Days_of_Cover"])
        calc = np.where(df["avg_daily_sales"] > 0, df["current_stock"] / df["avg_daily_sales"].replace(0, np.nan), 999.0)
        df["days_of_cover"] = np.where(cover > 0, cover, calc)

        cost = self._num(df["unit_cost_egp"])
        df["unit_cost_egp"] = np.where(cost > 0, cost, df["unit_price_egp"] * self.DEFAULT_COST_RATIO)
        profit = self._num(df["unit_profit_egp"])
        df["unit_profit_egp"] = np.where(profit > 0, profit, (df["unit_price_egp"] - df["unit_cost_egp"]).clip(lower=0))

        df["target_stock_30d"] = np.maximum(df["sales_30d"], df["reorder_point"])
        df["idle_units"] = (df["current_stock"] - df["target_stock_30d"]).clip(lower=0).round(0)
        df["trapped_capital_egp"] = df["idle_units"] * df["unit_cost_egp"]

        df["stockout_risk"] = (df["avg_daily_sales"] > 0) & (
            df["days_of_cover"] <= df["lead_time_days"] + self.REVIEW_BUFFER_DAYS)
        df["dead_stock"] = ((df["current_stock"] > 0) & (df["days_of_cover"] >= self.DEAD_STOCK_COVER_DAYS)
                            & (df["idle_units"] > 0) & (df["trapped_capital_egp"] > 0))
        return df.reset_index(drop=True)

    # ------------------------------------------------------------------
    # Supply readiness
    # ------------------------------------------------------------------

    def _compute_supply_readiness(self) -> Dict[str, Any]:
        cols = self.REQUIRED_COLUMNS["purchase_orders"]
        if not self._has("purchase_orders", cols):
            return {"available": False, "reason": "Purchase_Orders.csv missing or incomplete"}

        po = self.tables["purchase_orders"].copy()
        po["prom"] = self._dt(po["Promised_Date"])
        po["act"] = self._dt(po["Actual_Receipt_Date"])
        open_orders = int(po["act"].isna().sum())
        po = po[po["act"].notna() & po["prom"].notna()].copy()
        if po.empty:
            return {"available": False, "reason": "No received purchase orders"}

        po["late_days"] = (po["act"] - po["prom"]).dt.days.clip(lower=0)
        po["on_time"] = (po["late_days"] == 0).astype(float)
        po["ordered"] = self._num(po["Ordered_Qty"])
        po["accepted"] = self._num(po["Accepted_Qty"])
        po["rejected"] = self._num(po["Rejected_Qty"])
        po["rej_value"] = po["rejected"] * self._num(po["Unit_Cost_EGP"])
        po["spend"] = po["ordered"] * self._num(po["Unit_Cost_EGP"])

        g = po.groupby("Supplier_ID", as_index=False).agg(
            orders=("PO_ID", "count"), on_time_rate=("on_time", "mean"),
            avg_delay_days=("late_days", "mean"), ordered=("ordered", "sum"),
            accepted=("accepted", "sum"), rejected_value_egp=("rej_value", "sum"),
            spend_egp=("spend", "sum"))
        g["quality_rate"] = g["accepted"] / g["ordered"].replace(0, np.nan)
        g["quality_rate"] = g["quality_rate"].fillna(0)

        if self._has("suppliers", ["Supplier_ID", "Supplier_Name"]):
            sup_cols = [c for c in ["Supplier_ID", "Supplier_Name", "Primary_Category"]
                        if c in self.tables["suppliers"].columns]
            g = g.merge(self.tables["suppliers"][sup_cols], on="Supplier_ID", how="left")
        if "Supplier_Name" not in g.columns:
            g["Supplier_Name"] = g["Supplier_ID"]
        g["Supplier_Name"] = g["Supplier_Name"].fillna(g["Supplier_ID"])
        if "Primary_Category" not in g.columns:
            g["Primary_Category"] = "n/a"

        crit_ot, crit_q = self.SUPPLIER_CRITICAL
        watch_ot, watch_q = self.SUPPLIER_WATCH
        g["status"] = np.select(
            [(g["on_time_rate"] < crit_ot) | (g["quality_rate"] < crit_q),
             (g["on_time_rate"] < watch_ot) | (g["quality_rate"] < watch_q)],
            ["critical", "watchlist"], default="stable")

        suppliers = g.sort_values("rejected_value_egp", ascending=False)
        out = suppliers.rename(columns={"Supplier_ID": "supplier_id", "Supplier_Name": "supplier_name",
                                        "Primary_Category": "category"})
        out["on_time_pct"] = out["on_time_rate"] * 100
        out["quality_pct"] = out["quality_rate"] * 100

        return {
            "available": True,
            "overall": {
                "on_time_pct": float(po["on_time"].mean() * 100),
                "quality_pct": float(self._safe_divide(po["accepted"].sum(), po["ordered"].sum()) * 100),
                "orders_received": int(len(po)),
                "orders_open": open_orders,
            },
            "counts": {s: int((g["status"] == s).sum()) for s in ["stable", "watchlist", "critical"]},
            "thresholds": {
                "critical_if_on_time_below_pct": crit_ot * 100, "critical_if_quality_below_pct": crit_q * 100,
                "watch_if_on_time_below_pct": watch_ot * 100, "watch_if_quality_below_pct": watch_q * 100,
            },
            "definitions": {
                "on_time": "Actual_Receipt_Date <= Promised_Date (received orders only)",
                "quality": "sum(Accepted_Qty) / sum(Ordered_Qty)",
            },
            "suppliers": out[["supplier_id", "supplier_name", "category", "orders", "on_time_pct",
                              "quality_pct", "avg_delay_days", "rejected_value_egp", "spend_egp",
                              "status"]].to_dict(orient="records"),
        }

    # ------------------------------------------------------------------
    # Profit leakage
    # ------------------------------------------------------------------

    def _compute_leakage(self) -> Dict[str, Any]:
        """Compute profit leakage using conservative and inclusive totals.

        Conservative total excludes Quality Losses because quality losses can overlap
        with production rejects. Wholesale discounting is treated separately as a
        pricing exposure scenario, not leakage.
        """
        items: List[Dict[str, Any]] = []
        med_cost = float(self.econ["unit_cost_egp"].replace(0, np.nan).median() or 0)

        # 1) Production & printing waste (conservative)
        comps: Dict[str, float] = {}
        srcs: List[str] = []
        assumptions: List[str] = []
        formula_parts: List[str] = []
        if self._has("production_orders", self.REQUIRED_COLUMNS["production_orders"]):
            po = self.tables["production_orders"].merge(self.econ, on="Product_ID", how="left")
            cost = self._num(po["unit_cost_egp"]).replace(0, med_cost)
            rejected_units = float(self._num(po["Rejected_Qty"]).sum())
            raw_value = float((self._num(po["Rejected_Qty"]) * cost).sum())
            net_value = raw_value * (1 - self.SCRAP_RECOVERY_PCT)
            comps["production_rejects_after_scrap_recovery_egp"] = net_value
            comps["production_rejected_units"] = rejected_units
            comps["production_scrap_recovery_pct"] = self.SCRAP_RECOVERY_PCT * 100
            srcs.append("Production_Orders")
            formula_parts.append(
                "Production waste = sum(Production_Orders.Rejected_Qty x product unit cost) x (1 - SCRAP_RECOVERY_PCT)"
            )
            assumptions.append(
                f"SCRAP_RECOVERY_PCT={self.SCRAP_RECOVERY_PCT:.0%}; unit cost = sales COGS / sales units by product, median cost if unknown."
            )
        if self._has("printing_batches", self.REQUIRED_COLUMNS["printing_batches"]):
            pb = self.tables["printing_batches"]
            printed = self._num(pb["Printed_Qty"]).replace(0, np.nan)
            ink_per_unit = (self._num(pb["Ink_or_Consumable_Cost_EGP"]) / printed).fillna(0)
            printing_rework = float(self._num(pb["Rework_Cost_EGP"]).sum())
            rejected_ink = float((ink_per_unit * self._num(pb["Rejected_Qty"])).sum())
            comps["printing_rework_egp"] = printing_rework
            comps["printing_rejected_ink_egp"] = rejected_ink
            comps["printing_rejected_units"] = float(self._num(pb["Rejected_Qty"]).sum())
            srcs.append("Printing_Batches")
            formula_parts.append(
                "Printing waste = sum(Rework_Cost_EGP) + sum((Ink_or_Consumable_Cost_EGP / Printed_Qty) x Rejected_Qty)"
            )
        items.append(self._leak_item(
            "production_waste", "Production & Printing Waste", comps, srcs,
            " + ".join(formula_parts) if formula_parts else "Production/printing waste unavailable.",
            assumptions, included_in_conservative=True, label_type="recorded_or_estimated_cost"))

        # 2) Quality losses (inclusive only; possible overlap with production rejects)
        comps, srcs = {}, []
        if self._has("quality", self.REQUIRED_COLUMNS["quality"]):
            comps["quality_estimated_loss_egp"] = float(self._num(self.tables["quality"]["Estimated_Loss_EGP"]).sum())
            srcs.append("Quality")
        items.append(self._leak_item(
            "quality_losses", "Quality Losses", comps, srcs,
            "Sum of Quality.Estimated_Loss_EGP across QC inspections.",
            ["Inclusive-only item because it may overlap with production rejects already counted in conservative leakage."],
            included_in_conservative=False, label_type="estimate_possible_overlap"))

        # 3) Returns & refunds (conservative)
        comps, srcs = {}, []
        if self._has("sales", ["Refund_Value_EGP"]):
            comps["refunds_egp"] = float(self._num(self.tables["sales"]["Refund_Value_EGP"]).sum())
            srcs.append("Sales_Transactions")
        items.append(self._leak_item(
            "returns_refunds", "Returns & Refunds", comps, srcs,
            "Sum of Sales_Transactions.Refund_Value_EGP.", [],
            included_in_conservative=True, label_type="recorded_refund_value"))

        # 4) Estimated stockout losses (conservative exposure estimate)
        comps, srcs = {}, []
        inv = self.tables["inventory"]
        if "inventory" not in self.mocked and {"Stockout_Days_In_Month", "Avg_Daily_Sales_90D", "Product_ID"} <= set(inv.columns):
            m = inv.merge(self.econ, on="Product_ID", how="left")
            lost = (self._num(m["Stockout_Days_In_Month"]) * self._num(m["Avg_Daily_Sales_90D"])
                    * self._num(m["unit_profit_egp"]))
            comps["lost_gross_profit_egp"] = float(lost.sum())
            srcs.append("Inventory_History")
        items.append(self._leak_item(
            "stockout_losses", "Estimated Stockout Losses", comps, srcs,
            "Stockout_Days_In_Month x Avg_Daily_Sales_90D x unit gross profit, summed over all monthly snapshots.",
            ["Assumes demand continues at the 90-day average during stockout days; estimate, not observed sales."],
            included_in_conservative=True, label_type="estimated_exposure"))

        # 5) Retail/Online discount leakage only (conservative)
        comps, srcs = {}, []
        if self._has("sales", ["Gross_Sales_EGP", "Discount_Pct", "Channel"]):
            s = self.tables["sales"].copy()
            disc = self._num(s["Discount_Pct"])
            if disc.max() > 1:
                disc = disc / 100.0
            retail_online = s["Channel"].astype(str).str.lower().isin(["retail", "online"])
            excess = (disc - self.DISCOUNT_CAP_PCT).clip(lower=0)
            comps["retail_online_excess_discount_egp"] = float((self._num(s["Gross_Sales_EGP"]) * excess * retail_online.astype(float)).sum())
            comps["excluded_wholesale_rows"] = int((s["Channel"].astype(str).str.lower() == "wholesale").sum())
            srcs.append("Sales_Transactions")
        items.append(self._leak_item(
            "discount_leakage", "Retail/Online Discount Leakage", comps, srcs,
            f"For Retail and Online only: Gross_Sales_EGP x max(Discount_Pct - {self.DISCOUNT_CAP_PCT:.0%}, 0). Wholesale is excluded.",
            [f"{self.DISCOUNT_CAP_PCT:.0%} discount cap is an assumption; wholesale volume pricing is not counted as leakage."],
            included_in_conservative=True, label_type="modeled_excess_discount"))

        # 6) Wholesale pricing exposure, scenario only (not leakage total)
        comps, srcs = {}, []
        if self._has("sales", ["Gross_Sales_EGP", "Channel"]):
            s = self.tables["sales"]
            wholesale = s["Channel"].astype(str).str.lower() == "wholesale"
            comps["wholesale_pricing_exposure_egp"] = float(self._num(s.loc[wholesale, "Gross_Sales_EGP"]).sum() * 0.05)
            srcs.append("Sales_Transactions")
        scenario = self._leak_item(
            "wholesale_pricing_exposure", "Wholesale Pricing Exposure", comps, srcs,
            "Wholesale gross sales x 5 percentage points = gross profit upside if average wholesale discount fell 5 points, volume held constant.",
            ["Scenario upper bound only; not counted in leakage because wholesale discounting is volume pricing."],
            included_in_conservative=False, label_type="scenario_upper_bound")

        conservative_total = sum(i["value_egp"] for i in items if i["available"] and i.get("included_in_conservative"))
        inclusive_total = conservative_total + sum(
            i["value_egp"] for i in items if i["available"] and i["key"] == "quality_losses"
        )

        for i in items:
            denom = conservative_total if i.get("included_in_conservative") else inclusive_total
            i["share_pct"] = (i["value_egp"] / denom * 100) if denom > 0 and i["available"] else 0.0
        top = max((i for i in items if i["available"] and i.get("included_in_conservative")),
                  key=lambda i: i["value_egp"], default=None)
        return self._clean_json({
            "headline_total_egp": conservative_total,
            "total_egp": conservative_total,
            "conservative_total_egp": conservative_total,
            "including_quality_losses_total_egp": inclusive_total,
            "primary_driver": top["label"] if top else None,
            "data_as_of": self.data_as_of,
            "discount_cap_pct": self.DISCOUNT_CAP_PCT * 100,
            "scrap_recovery_pct": self.SCRAP_RECOVERY_PCT * 100,
            "items": items,
            "wholesale_pricing_exposure": scenario,
            "notes": [
                "Headline uses conservative total.",
                "Quality losses are reported separately because they can overlap with production rejects.",
                "Wholesale pricing exposure is a scenario upper bound, not leakage."
            ],
        })

    @staticmethod
    def _leak_item(key, label, comps, sources, formula, assumptions, included_in_conservative=True, label_type="estimate"):
        value_components = {k: v for k, v in comps.items() if str(k).endswith("_egp")}
        return {
            "key": key,
            "label": label,
            "available": bool(value_components),
            "value_egp": float(sum(value_components.values())) if value_components else 0.0,
            "components": comps,
            "sources": sources,
            "formula": formula,
            "assumptions": assumptions,
            "included_in_conservative": included_in_conservative,
            "label_type": label_type,
        }

    # ------------------------------------------------------------------
    # Decisions
    # ------------------------------------------------------------------

    def _decision(self, did, category, department, title, action, reason, impact_type,
                  value, confidence, evidence, metrics, owner, window, explain):
        return {
            "decision_id": did, "rank": 0, "priority": "medium", "category": category,
            "department": department, "title": title, "recommended_action": action,
            "business_reason": reason,
            "expected_impact": {"impact_type": impact_type, "estimated_value_egp": round(float(value), 2),
                                "confidence": confidence},
            "evidence": {**evidence, "metrics": metrics},
            "suggested_owner": owner, "time_window": window, "explain": explain,
        }

    def _build_decisions(self) -> List[Dict[str, Any]]:
        df = self.model
        decisions: List[Dict[str, Any]] = []

        transfers, moved_out, moved_in = self._transfer_decisions(df)
        decisions += transfers
        decisions += self._markdown_decisions(df, moved_out)
        decisions += self._replenish_decisions(df, moved_in)
        decisions += self._supplier_decisions()
        decisions += self._quality_decisions()
        decisions += self._marketing_decisions(df)

        # --- priority from impact percentile (documented, not hardcoded per decision) ---
        if decisions:
            values = np.array([d["expected_impact"]["estimated_value_egp"] for d in decisions])
            p85, p50 = np.percentile(values, 85), np.percentile(values, 50)
            for d in decisions:
                v = d["expected_impact"]["estimated_value_egp"]
                d["priority"] = "critical" if v >= p85 else "high" if v >= p50 else "medium"
        order = {"critical": 0, "high": 1, "medium": 2}
        decisions.sort(key=lambda d: (order[d["priority"]], -d["expected_impact"]["estimated_value_egp"]))
        for i, d in enumerate(decisions, start=1):
            d["rank"] = i
        return self._clean_json(decisions)

    def _inv_evidence(self, r, extra_metrics=None):
        return (
            {"product_id": str(r["Product_ID"]), "product_name": str(r["Product_Name"]),
             "location": str(r["Location_Name"]), "current_stock": int(r["current_stock"]),
             "days_of_cover": round(float(min(r["days_of_cover"], 999)), 1)},
            extra_metrics or [],
        )

    def _inv_support(self, r) -> float:
        return 0.6 * min(r["history_months"] / 12, 1) + 0.4 * (1 - min(r["demand_cv"], 1))

    def _transfer_decisions(self, df):
        moved_out: Dict[tuple, float] = {}
        moved_in: Dict[tuple, float] = {}
        out: List[Dict[str, Any]] = []

        surplus: Dict[str, List[dict]] = {}
        for r in df[df["dead_stock"]].to_dict("records"):
            r["_left"] = float(r["idle_units"])
            surplus.setdefault(r["Product_ID"], []).append(r)

        need_rows = df[df["stockout_risk"]].copy()
        need_rows["need"] = (need_rows["avg_daily_sales"] * (need_rows["lead_time_days"] + self.REPLENISH_HORIZON_DAYS)
                             - need_rows["current_stock"]).clip(lower=0)
        for r in need_rows.sort_values("need", ascending=False).to_dict("records"):
            need = float(r["need"])
            for s in sorted(surplus.get(r["Product_ID"], []), key=lambda x: -x["_left"]):
                if need <= 0:
                    break
                if s["Location_ID"] == r["Location_ID"] or s["_left"] <= 0:
                    continue
                qty = math.floor(min(s["_left"], need))
                if qty <= 0:
                    continue
                s["_left"] -= qty
                need -= qty
                moved_out[(s["Product_ID"], s["Location_ID"])] = moved_out.get((s["Product_ID"], s["Location_ID"]), 0) + qty
                moved_in[(r["Product_ID"], r["Location_ID"])] = moved_in.get((r["Product_ID"], r["Location_ID"]), 0) + qty
                value = qty * r["unit_profit_egp"]
                support = (self._inv_support(s) + self._inv_support(r)) / 2
                out.append(self._decision(
                    f"TRF-{r['Product_ID']}-{s['Location_ID']}-{r['Location_ID']}", "inventory", "Inventory",
                    f"Transfer {qty:,} units of {r['Product_Name']}: {s['Location_Name']} -> {r['Location_Name']}",
                    f"Move {qty:,} idle units from {s['Location_Name']} (cover {min(s['days_of_cover'],999):.0f}d) "
                    f"to {r['Location_Name']} (cover {min(r['days_of_cover'],999):.0f}d) instead of discounting one and reordering for the other.",
                    "One location is overstocked while another is about to run out of the same product.",
                    "profit_protected", value, self._conf(support),
                    {"product_id": str(r["Product_ID"]), "product_name": str(r["Product_Name"]),
                     "location": f"{s['Location_Name']} -> {r['Location_Name']}",
                     "current_stock": int(s["current_stock"]), "days_of_cover": round(float(min(s["days_of_cover"], 999)), 1)},
                    [{"label": "Units to move", "value": f"{qty:,}"},
                     {"label": "Source cover", "value": f"{min(s['days_of_cover'],999):.0f} d"},
                     {"label": "Dest. cover", "value": f"{min(r['days_of_cover'],999):.0f} d"},
                     {"label": "Unit profit", "value": f"EGP {r['unit_profit_egp']:.0f}"}],
                    "Inventory Manager", f"{int(r['lead_time_days'])} days",
                    {"formula": "value = units moved x unit gross profit",
                     "inputs": {"units": qty, "unit_profit_egp": round(float(r["unit_profit_egp"]), 2)},
                     "confidence_method": "0.50 + 0.45 x (0.6 x months of history/12 + 0.4 x demand stability), averaged over both locations",
                     "assumptions": ["Transfer cost and transit time are not in the data and are ignored."]}))
        out.sort(key=lambda d: -d["expected_impact"]["estimated_value_egp"])
        return out[:15], moved_out, moved_in

    def _markdown_decisions(self, df, moved_out, limit: int = 20):
        rows = df[df["dead_stock"]].to_dict("records")
        res = []
        for r in rows:
            idle = r["idle_units"] - moved_out.get((r["Product_ID"], r["Location_ID"]), 0)
            if idle <= 0:
                continue
            trapped = idle * r["unit_cost_egp"]
            days = float(r["days_of_cover"])
            pct, window = (25, "7 days") if days >= 120 else (15, "14 days") if days >= 90 else (10, "21 days")
            ev, _ = self._inv_evidence(r)
            res.append((trapped, self._decision(
                f"MKD-{r['Product_ID']}-{r['Location_ID']}", "inventory", "Inventory",
                f"Apply {pct}% markdown on {r['Product_Name']}",
                f"Discount by {pct}% at {r['Location_Name']} to clear {int(idle):,} idle units.",
                "Stock far exceeds 30-day demand; holding it ties up cash and risks end-of-season write-down.",
                "capital_recovery", trapped, self._conf(self._inv_support(r)), ev,
                [{"label": "Idle units", "value": f"{int(idle):,}"},
                 {"label": "Cover", "value": f"{min(days,999):.0f} d"},
                 {"label": "Unit cost", "value": f"EGP {r['unit_cost_egp']:.0f}"},
                 {"label": "Markdown", "value": f"{pct}%"}],
                "Inventory Manager", window,
                {"formula": f"idle = stock - max(30-day sales, reorder point); value = idle x unit cost "
                            f"(markdown tier: cover>=120d: 25%, >=90d: 15%, else 10%)",
                 "inputs": {"stock": int(r["current_stock"]), "avg_daily_sales": round(float(r["avg_daily_sales"]), 2),
                            "reorder_point": int(r["reorder_point"]), "idle_units": int(idle),
                            "unit_cost_egp": round(float(r["unit_cost_egp"]), 2)},
                 "confidence_method": "0.50 + 0.45 x (0.6 x months of history/12 + 0.4 x (1 - demand variability))",
                 "assumptions": ["Value is capital (cost basis) released, not profit.",
                                 "Markdown % is a rule-based tier, not an elasticity model."]})))
        res.sort(key=lambda t: -t[0])
        return [d for _, d in res[:limit]]

    def _replenish_decisions(self, df, moved_in, limit: int = 20):
        res = []
        for r in df[df["stockout_risk"]].to_dict("records"):
            lead = float(r["lead_time_days"])
            exposure = lead + self.REVIEW_BUFFER_DAYS - float(r["days_of_cover"])
            order_qty = math.ceil(r["avg_daily_sales"] * (lead + self.REPLENISH_HORIZON_DAYS) - r["current_stock"]
                                  - moved_in.get((r["Product_ID"], r["Location_ID"]), 0))
            value = r["avg_daily_sales"] * r["unit_profit_egp"] * max(exposure, 0)
            if order_qty <= 0 or value <= 0:
                continue
            ev, _ = self._inv_evidence(r)
            res.append((value, self._decision(
                f"REP-{r['Product_ID']}-{r['Location_ID']}", "inventory", "Procurement",
                f"Replenish {r['Product_Name']} @ {r['Location_Name']}",
                f"Order {order_qty:,} units now to cover lead time ({int(lead)}d) + {self.REPLENISH_HORIZON_DAYS} days of sales.",
                "Cover is below supplier lead time plus review buffer; sales will be lost before new stock arrives.",
                "profit_protected", value, self._conf(self._inv_support(r)), ev,
                [{"label": "Order qty", "value": f"{order_qty:,}"},
                 {"label": "Cover", "value": f"{r['days_of_cover']:.0f} d"},
                 {"label": "Lead time", "value": f"{int(lead)} d"},
                 {"label": "Daily sales", "value": f"{r['avg_daily_sales']:.1f}"}],
                "Procurement Manager", f"Order within {max(int(r['days_of_cover'] - lead), 0)} days",
                {"formula": "value = daily sales x unit gross profit x (lead time + 7d buffer - days of cover); "
                            "order qty = daily sales x (lead time + 30d) - stock - incoming transfers",
                 "inputs": {"avg_daily_sales": round(float(r["avg_daily_sales"]), 2), "unit_profit_egp": round(float(r["unit_profit_egp"]), 2),
                            "lead_time_days": int(lead), "days_of_cover": round(float(r["days_of_cover"]), 1)},
                 "confidence_method": "0.50 + 0.45 x (0.6 x months of history/12 + 0.4 x (1 - demand variability))",
                 "assumptions": ["Uses the 90-day average daily sales; no seasonality forecast yet."]})))
        res.sort(key=lambda t: -t[0])
        return [d for _, d in res[:limit]]

    def _supplier_decisions(self, limit: int = 5):
        sup = self._cache.get("supply", {})
        if not sup.get("available"):
            return []
        res = []
        for s in sup["suppliers"]:
            if s["status"] == "stable" or s["orders"] < self.MIN_SUPPLIER_ORDERS or s["spend_egp"] <= 0:
                continue
            critical = s["status"] == "critical"
            res.append(self._decision(
                f"SUP-{s['supplier_id']}", "supplier", "Procurement",
                f"{'Escalate' if critical else 'Review'} supplier {s['supplier_name']}",
                ("Request a corrective-action plan and qualify a backup supplier. " if critical
                 else "Hold a performance review and add lead-time buffer. ")
                + f"On-time {s['on_time_pct']:.0f}%, accepted {s['quality_pct']:.0f}%.",
                "Late or rejected deliveries disrupt production and inflate material cost.",
                "late_spend_exposure", s["spend_egp"] * (1 - s["on_time_pct"] / 100), self._conf(min(s["orders"] / 30, 1)),
                {"product_id": str(s["supplier_id"]), "product_name": str(s["supplier_name"]),
                 "location": "Supply chain", "current_stock": 0, "days_of_cover": 0},
                [{"label": "On-time", "value": f"{s['on_time_pct']:.0f}%"},
                 {"label": "Accepted", "value": f"{s['quality_pct']:.0f}%"},
                 {"label": "Avg delay", "value": f"{s['avg_delay_days']:.1f} d"},
                 {"label": "Orders", "value": f"{s['orders']}"}],
                "Procurement Manager", "30 days",
                {"formula": "value = sum(Rejected_Qty x Unit_Cost_EGP) for this supplier",
                 "inputs": {"orders": s["orders"], "on_time_pct": round(s["on_time_pct"], 1), "quality_pct": round(s["quality_pct"], 1)},
                 "confidence_method": "0.50 + 0.45 x min(orders / 30, 1)",
                 "assumptions": ["Value counts rejected material only; delay costs are not in the data."]}))
        res.sort(key=lambda d: -d["expected_impact"]["estimated_value_egp"])
        return res[:limit]

    def _quality_decisions(self, limit: int = 5):
        if not self._has("quality", self.REQUIRED_COLUMNS["quality"]):
            return []
        q = self.tables["quality"].copy()
        q["loss"] = self._num(q["Estimated_Loss_EGP"])
        q["insp"] = self._num(q["Inspected_Qty"])
        q["rej"] = self._num(q["Rejected_Qty"])
        mask = (~q["Root_Cause"].astype(str).str.contains("no significant", case=False)
                & ~q["Defect_Type"].astype(str).str.lower().isin(["none", "0", "nan", ""]))
        q = q[mask]
        if q.empty:
            return []
        g = q.groupby(["Product_ID", "Product_Name", "Root_Cause"], as_index=False).agg(
            loss=("loss", "sum"), rejected=("rej", "sum"), inspected=("insp", "sum"), checks=("loss", "count"),
            defect=("Defect_Type", lambda s: s.mode().iat[0] if not s.mode().empty else "n/a"))
        res = []
        for r in g.sort_values("loss", ascending=False).head(limit).to_dict("records"):
            rate = self._safe_divide(r["rejected"], r["inspected"]) * 100
            res.append(self._decision(
                f"QLT-{r['Product_ID']}-{self._slug(r['Root_Cause'])}", "quality", "Quality",
                f"Fix '{r['Root_Cause']}' on {r['Product_Name']}",
                f"Run root-cause review on {r['defect']} defects; target the {rate:.1f}% rejection rate.",
                "Repeated defects with the same root cause are recurring, preventable loss.",
                "loss_avoided", r["loss"], self._conf(min(r["checks"] / 20, 1)),
                {"product_id": str(r["Product_ID"]), "product_name": str(r["Product_Name"]),
                 "location": "Quality control", "current_stock": 0, "days_of_cover": 0},
                [{"label": "Loss", "value": f"EGP {r['loss']:,.0f}"},
                 {"label": "Reject rate", "value": f"{rate:.1f}%"},
                 {"label": "Inspections", "value": f"{int(r['checks'])}"},
                 {"label": "Top defect", "value": str(r["defect"])}],
                "Quality Manager", "14 days",
                {"formula": "value = sum(Estimated_Loss_EGP) for this product + root cause (whole data window)",
                 "inputs": {"inspections": int(r["checks"]), "rejected_units": int(r["rejected"])},
                 "confidence_method": "0.50 + 0.45 x min(inspections / 20, 1)",
                 "assumptions": ["Loss is over the full data history, not annualised."]}))
        return res

    def _marketing_decisions(self, df, limit: int = 8):
        if not self._has("marketing", self.REQUIRED_COLUMNS["marketing"]):
            return []
        m = self.tables["marketing"].copy()
        m["end"] = self._dt(m["End_Date"])
        for c in ["Spend_EGP", "Clicks", "Orders_Attributed", "Attributed_Revenue_EGP"]:
            m[c] = self._num(m[c])
        res = []

        # (a) Low-stock push: recent campaigns advertising products about to stock out
        risk_ids = set(df.loc[df["stockout_risk"], "Product_ID"])
        anchor = pd.to_datetime(self.data_as_of) if self.data_as_of else m["end"].max()
        recent = m[(m["end"] >= anchor - pd.Timedelta(days=90)) & m["Product_ID"].isin(risk_ids)]
        for r in recent.sort_values("Spend_EGP", ascending=False).head(limit).to_dict("records"):
            res.append(self._decision(
                f"MKT-LOW-{r['Campaign_ID']}", "marketing", "Marketing",
                f"Low Stock Push: {r['Campaign_Name']}",
                "Pause or cap spend on this product until it is restocked.",
                "Ads are driving demand for a product that is about to run out.",
                "spend_protected", r["Spend_EGP"], self._conf(min(r["Orders_Attributed"] / 100, 1)),
                {"product_id": str(r["Product_ID"]), "product_name": str(r["Product_Name"]),
                 "location": str(r["Platform"]), "current_stock": 0, "days_of_cover": 0},
                [{"label": "Spend", "value": f"EGP {r['Spend_EGP']:,.0f}"},
                 {"label": "Orders", "value": f"{int(r['Orders_Attributed'])}"},
                 {"label": "Platform", "value": str(r["Platform"])},
                 {"label": "Ended", "value": r["end"].strftime("%Y-%m-%d") if pd.notna(r["end"]) else "n/a"}],
                "Marketing Manager", "7 days",
                {"formula": "value = campaign Spend_EGP (recent campaign on a product flagged as stockout risk)",
                 "inputs": {"spend_egp": round(float(r["Spend_EGP"]), 2), "campaign_window": "last 90 days of data"},
                 "confidence_method": "0.50 + 0.45 x min(attributed orders / 100, 1)",
                 "assumptions": ["Campaign recency is judged against the latest inventory snapshot date."]}))

        # (b) Low ROAS: spend not covered by attributed gross profit
        sales = self.tables["sales"]
        margin = self._safe_divide(self._num(sales["Gross_Profit_EGP"]).sum(), self._num(sales["Net_Sales_EGP"]).sum())
        m["roas"] = m["Attributed_Revenue_EGP"] / m["Spend_EGP"].replace(0, np.nan)
        m["waste"] = m["Spend_EGP"] - m["Attributed_Revenue_EGP"] * margin
        poor = m[(m["roas"] < 1) & (m["waste"] > 0) & (~m["Campaign_ID"].isin([r["Campaign_ID"] for r in recent.to_dict("records")]))]
        for r in poor.sort_values("waste", ascending=False).head(5).to_dict("records"):
            res.append(self._decision(
                f"MKT-ROAS-{r['Campaign_ID']}", "marketing", "Marketing",
                f"Rework low-ROAS campaign: {r['Campaign_Name']}",
                f"ROAS was {r['roas']:.2f}x. Reallocate similar budget to higher-ROAS platforms/products.",
                "Attributed revenue did not cover spend after cost of goods.",
                "spend_recovered", r["waste"], self._conf(min(r["Orders_Attributed"] / 100, 1)),
                {"product_id": str(r["Product_ID"]), "product_name": str(r["Product_Name"]),
                 "location": str(r["Platform"]), "current_stock": 0, "days_of_cover": 0},
                [{"label": "ROAS", "value": f"{r['roas']:.2f}x"},
                 {"label": "Spend", "value": f"EGP {r['Spend_EGP']:,.0f}"},
                 {"label": "Revenue", "value": f"EGP {r['Attributed_Revenue_EGP']:,.0f}"},
                 {"label": "Platform", "value": str(r["Platform"])}],
                "Marketing Manager", "Next campaign",
                {"formula": f"value = Spend - Attributed_Revenue x gross margin ({margin:.1%} overall)",
                 "inputs": {"roas": round(float(r["roas"]), 2), "gross_margin": round(float(margin), 3)},
                 "confidence_method": "0.50 + 0.45 x min(attributed orders / 100, 1)",
                 "assumptions": ["Modeled campaign data (not a real ad-account export); historic campaign, lesson for future spend."]}))
        return res

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def decisions(self) -> List[Dict[str, Any]]:
        return self._cache["decisions"]

    def leakage(self) -> Dict[str, Any]:
        return self._cache["leakage"]

    def supply_readiness(self) -> Dict[str, Any]:
        return self._clean_json(self._cache["supply"])

    def overview(self) -> Dict[str, Any]:
        sales = self.tables["sales"]
        revenue = float(self._num(sales["Net_Sales_EGP"]).sum())
        profit = float(self._num(sales["Gross_Profit_EGP"]).sum())
        df = self.model
        trapped = float(df.loc[df["dead_stock"], "trapped_capital_egp"].sum())
        stockout = int(df["stockout_risk"].sum())
        leak = self.leakage()
        decisions = self.decisions()
        by_cat: Dict[str, int] = {}
        for d in decisions:
            by_cat[d["department"]] = by_cat.get(d["department"], 0) + 1
        summary = (
            f"{len(decisions)} actions detected across {len(by_cat)} departments. "
            f"EGP {trapped/1e6:.2f}M is trapped in idle stock and {stockout} product-location pairs risk stocking out. "
            + (f"Largest profit leak: {leak['primary_driver']} (EGP {leak['total_egp']/1e6:.2f}M total leakage)."
               if leak["primary_driver"] else "Leakage could not be computed from the available data.")
        )
        return self._clean_json({
            "company": "El-Sharnouby Group", "platform_name": "Decision Control Room",
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "data_as_of": self.data_as_of, "using_mock_data": self.using_mock_data,
            "mocked_tables": sorted(self.mocked),
            "kpis": {
                "total_revenue_egp": revenue, "gross_profit_egp": profit,
                "gross_margin_pct": self._safe_divide(profit, revenue) * 100,
                "dead_stock_trapped_capital_egp": trapped, "stockout_risk_count": stockout,
                "decision_count": len(decisions), "total_leakage_egp": leak["total_egp"],
            },
            "decisions_by_department": by_cat,
            "executive_summary": summary,
        })

    def kpis(self) -> Dict[str, Any]:
        sales = self.tables["sales"].copy()
        sales["month"] = self._dt(sales["Order_Date"]).dt.to_period("M").astype(str)
        sales["rev"] = self._num(sales["Net_Sales_EGP"])
        sales["gp"] = self._num(sales["Gross_Profit_EGP"])
        monthly = sales.groupby("month", as_index=False).agg(revenue_egp=("rev", "sum"), gross_profit_egp=("gp", "sum"))
        monthly["gross_margin_pct"] = (monthly["gross_profit_egp"] / monthly["revenue_egp"].replace(0, np.nan) * 100).fillna(0)
        monthly = monthly.sort_values("month").tail(12)

        df = self.model[self.model["days_of_cover"] >= self.DEAD_STOCK_COVER_DAYS]
        cats = df.groupby("Product_Family", as_index=False).agg(
            trapped_capital_egp=("trapped_capital_egp", "sum"), idle_units=("idle_units", "sum"),
            avg_days_of_cover=("days_of_cover", "mean"), product_count=("Product_ID", "nunique"),
        ).sort_values("trapped_capital_egp", ascending=False).head(5)
        return self._clean_json({"monthly_sales_trend": monthly.to_dict(orient="records"),
                                 "top_5_dead_stock_categories": cats.to_dict(orient="records")})

    def data_health(self) -> Dict[str, Any]:
        """Reconciliation checks for the demo UI and tests."""
        checks: List[Dict[str, Any]] = []

        def add_check(check_id: str, label: str, expected: Any, actual: Any, passed: bool, detail: str = ""):
            checks.append({
                "check_id": check_id,
                "label": label,
                "expected": expected,
                "actual": actual,
                "pass": bool(passed),
                "detail": detail,
            })

        # 1) Channel revenue = total revenue
        sales = self.tables.get("sales", pd.DataFrame())
        if not sales.empty and {"Channel", "Net_Sales_EGP"} <= set(sales.columns):
            total = float(self._num(sales["Net_Sales_EGP"]).sum())
            by_channel = float(sales.groupby("Channel")["Net_Sales_EGP"].apply(lambda x: self._num(x).sum()).sum())
            add_check("channel_revenue", "Sum of channel revenue equals total revenue",
                      round(total, 2), round(by_channel, 2), abs(total - by_channel) < 0.01,
                      "Source: Sales_Transactions.Net_Sales_EGP grouped by Channel.")
        else:
            add_check("channel_revenue", "Sum of channel revenue equals total revenue", "sales data", "unavailable", False)

        # 2) Leakage items sum = conservative total
        leak = self.leakage()
        item_sum = sum(i["value_egp"] for i in leak.get("items", []) if i.get("available") and i.get("included_in_conservative"))
        add_check("leakage_sum", "Conservative leakage items sum to conservative total",
                  round(float(leak.get("conservative_total_egp", 0)), 2), round(float(item_sum), 2),
                  abs(float(leak.get("conservative_total_egp", 0)) - item_sum) < 0.01)

        # 3) Decision IDs unique
        ids = [d["decision_id"] for d in self.decisions()]
        add_check("decision_ids_unique", "Decision IDs are unique", len(ids), len(set(ids)), len(ids) == len(set(ids)))

        # 4) Inventory model uses a single latest snapshot month
        months = []
        if "_month" in self.model.columns:
            months = sorted(str(m.date()) for m in pd.to_datetime(self.model["_month"], errors="coerce").dropna().unique())
        add_check("single_inventory_snapshot", "Inventory stock uses only one latest snapshot month",
                  1, len(months), len(months) == 1, f"months={months}")

        # 5) No NaN in API JSON
        api_payload = {
            "overview": self.overview(),
            "decisions": self.decisions(),
            "leakage": self.leakage(),
            "supply_readiness": self.supply_readiness(),
            "kpis": self.kpis(),
        }
        nan_paths: List[str] = []

        def walk(obj, path="root"):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    walk(v, f"{path}.{k}")
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    walk(v, f"{path}[{i}]")
            elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
                nan_paths.append(path)

        walk(api_payload)
        add_check("no_nan_api_json", "No NaN/Infinity values in core API JSON", 0, len(nan_paths), len(nan_paths) == 0,
                  "; ".join(nan_paths[:10]))

        row_counts = {name: int(len(df)) for name, df in self.tables.items()}
        add_check("row_counts_present", "Row counts are available for all loaded tables",
                  len(self.CSV_FILES), len(row_counts), len(row_counts) == len(self.CSV_FILES))

        add_check("mocked_tables", "Tables falling back to mock data", [], sorted(self.mocked), len(self.mocked) == 0,
                  "Pass means every required table loaded from CSV.")

        return self._clean_json({
            "status": "pass" if all(c["pass"] for c in checks) else "warn",
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "data_as_of": self.data_as_of,
            "checks": checks,
            "row_counts": row_counts,
            "mocked_tables": sorted(self.mocked),
        })

    def health(self) -> Dict[str, Any]:
        return self._clean_json({
            "status": "ok", "service": "El-Sharnouby Operations Control API",
            "csv_loaded": not self.using_mock_data, "using_mock_data": self.using_mock_data,
            "mocked_tables": sorted(self.mocked), "tables_loaded": len(self.tables),
            "loaded_at": self.loaded_at, "data_as_of": self.data_as_of,
            "data_dir": str(self.data_dir), "warnings": self.load_warnings,
        })
