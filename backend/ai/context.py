from typing import Any, Dict, List, Set


class BusinessContextBuilder:
    """
    Builds compact, verified business context from the deterministic
    Operations Control backend.

    The LLM explains and reasons over these facts. It is not the authority
    for business calculations.
    """

    def __init__(self, engine, analytics, board_provider):
        self.engine = engine
        self.analytics = analytics
        self.board_provider = board_provider

    def _engine(self, method: str) -> Dict[str, Any]:
        try:
            result = getattr(self.engine, method)()
            return result if isinstance(result, dict) else {}
        except Exception:
            return {}

    def _analytics(self, endpoint: str) -> Dict[str, Any]:
        try:
            result = self.analytics.endpoint(endpoint)
            return result if isinstance(result, dict) else {}
        except Exception:
            return {}

    @staticmethod
    def _money(value: Any) -> str:
        try:
            return f"EGP {float(value):,.2f}"
        except (TypeError, ValueError):
            return "Unavailable"

    @staticmethod
    def _pct(value: Any) -> str:
        try:
            return f"{float(value):,.2f}%"
        except (TypeError, ValueError):
            return "Unavailable"

    @staticmethod
    def _compact_row(row: Dict[str, Any]) -> str:
        useful: List[str] = []

        preferred = [
            "Supplier_ID",
            "Supplier_Name",
            "supplier_name",
            "Material_ID",
            "Material_Name",
            "Product_ID",
            "Product_Name",
            "product_name",
            "Product_Family",
            "category",
            "Channel",
            "channel",
            "Platform",
            "platform",
            "status",
            "priority",
            "on_time_pct",
            "acceptance_pct",
            "quality_pct",
            "lead_time_days",
            "avg_delay_days",
            "roas",
            "revenue_egp",
            "spend_egp",
            "estimated_value_egp",
            "days_of_cover",
            "current_stock",
            "stock",
            "units",
        ]

        for key in preferred:
            if key in row and row[key] is not None:
                useful.append(f"{key}={row[key]}")

            if len(useful) >= 7:
                break

        if not useful:
            for key, value in list(row.items())[:7]:
                useful.append(f"{key}={value}")

        return ", ".join(useful)

    def _financial(self) -> str:
        overview = self._engine("overview")
        kpis = overview.get("kpis", overview)

        return "\n".join([
            "FINANCIAL OVERVIEW — BACKEND VERIFIED",
            f'- Recorded net sales: {self._money(kpis.get("total_revenue_egp"))}',
            f'- Recorded gross profit: {self._money(kpis.get("gross_profit_egp"))}',
            f'- Gross margin: {self._pct(kpis.get("gross_margin_pct"))}',
            f'- Dead-stock / trapped capital: {self._money(kpis.get("dead_stock_trapped_capital_egp"))}',
            f'- Product-location stockout risk count: {kpis.get("stockout_risk_count", "Unavailable")}',
        ])

    def _leakage(self) -> str:
        data = self._engine("leakage")

        lines = [
            "PROFIT LEAKAGE — BACKEND VERIFIED",
            f'- Conservative operational leakage: {self._money(data.get("conservative_total_egp"))}',
            f'- Including quality losses: {self._money(data.get("including_quality_losses_total_egp"))}',
            f'- Wholesale pricing exposure scenario: {self._money(data.get("wholesale_pricing_exposure_egp"))}',
            f'- Primary leakage driver: {data.get("primary_driver", "Unavailable")}',
        ]

        components = data.get("components", [])

        if isinstance(components, list):
            for component in components[:8]:
                if not isinstance(component, dict):
                    continue

                name = (
                    component.get("name")
                    or component.get("component")
                    or component.get("label")
                )

                value = (
                    component.get("value_egp")
                    or component.get("estimated_value_egp")
                    or component.get("amount_egp")
                )

                if name and value is not None:
                    lines.append(f"- {name}: {self._money(value)}")

        return "\n".join(lines)

    def _inventory(self) -> str:
        data = self._analytics("inventory")
        lines = ["INVENTORY — BACKEND VERIFIED"]

        insight = data.get("insight")
        if insight:
            lines.append(f"- Backend insight: {insight}")

        for key, label in [
            ("stock_turns", "Stock turns"),
            ("dead_stock_trapped_capital_egp", "Trapped capital"),
            ("stockout_risk_count", "Stockout risks"),
        ]:
            if key in data:
                value = data[key]
                if key.endswith("_egp"):
                    value = self._money(value)
                lines.append(f"- {label}: {value}")

        for collection_name in [
            "top_overstock",
            "overstock",
            "stockout_risks",
            "top_stockout_risks",
            "product_classes",
        ]:
            rows = data.get(collection_name)

            if isinstance(rows, list) and rows:
                lines.append(
                    f"- {collection_name.replace('_', ' ').title()}:"
                )

                limit = 5 if collection_name != "product_classes" else 3

                for row in rows[:limit]:
                    if isinstance(row, dict):
                        lines.append(f"  - {self._compact_row(row)}")

        return "\n".join(lines)

    def _forecast(self) -> str:
        data = self._analytics("forecast")
        lines = ["FORECAST — BACKEND VERIFIED"]

        insight = data.get("insight")
        if insight:
            lines.append(f"- Backend insight: {insight}")

        for key, value in data.items():
            if isinstance(value, list) and value:
                lines.append(f"- {key.replace('_', ' ').title()}:")

                for row in value[:4]:
                    if isinstance(row, dict):
                        lines.append(f"  - {self._compact_row(row)}")

                break

        return "\n".join(lines)

    def _supply(self) -> str:
        readiness = self._engine("supply_readiness")
        supply = self._analytics("supply")

        lines = ["SUPPLY CHAIN — BACKEND VERIFIED"]

        insight = supply.get("insight")
        if insight:
            lines.append(f"- Backend insight: {insight}")

        overall = readiness.get("overall", {})

        if isinstance(overall, dict):
            if "on_time_pct" in overall:
                lines.append(
                    f'- Overall on-time delivery: {self._pct(overall["on_time_pct"])}'
                )

            if "quality_pct" in overall:
                lines.append(
                    f'- Overall supplier quality: {self._pct(overall["quality_pct"])}'
                )

        counts = readiness.get("counts", {})

        if isinstance(counts, dict):
            lines.append(
                "- Supplier classifications: "
                f'{counts.get("critical", 0)} critical, '
                f'{counts.get("watchlist", 0)} watchlist, '
                f'{counts.get("stable", 0)} stable'
            )

        for key in [
            "supplier_action_matrix",
            "supplier_material_performance",
            "suppliers",
            "risk_materials",
            "supplier_risks",
        ]:
            rows = supply.get(key)

            if isinstance(rows, list) and rows:
                lines.append(f"- {key.replace('_', ' ').title()}:")

                for row in rows[:6]:
                    if isinstance(row, dict):
                        lines.append(f"  - {self._compact_row(row)}")

                break

        return "\n".join(lines)

    def _marketing(self) -> str:
        data = self._analytics("marketing")
        lines = ["MARKETING — BACKEND VERIFIED"]

        insight = data.get("insight")
        if insight:
            lines.append(f"- Backend insight: {insight}")

        for key in [
            "budget_reallocation_estimate_egp",
            "reallocation_estimate_egp",
        ]:
            if key in data:
                lines.append(
                    f"- Budget reallocation estimate: {self._money(data[key])}"
                )
                break

        for key in [
            "platform_roas",
            "platforms",
            "platform_performance",
            "campaigns",
        ]:
            rows = data.get(key)

            if isinstance(rows, list) and rows:
                for row in rows[:6]:
                    if isinstance(row, dict):
                        lines.append(f"- {self._compact_row(row)}")
                break

            if isinstance(rows, dict) and rows:
                for name, value in list(rows.items())[:6]:
                    lines.append(f"- {name}: {value}")
                break

        return "\n".join(lines)

    def _quality(self) -> str:
        data = self._analytics("quality")
        lines = ["QUALITY & RETURNS — BACKEND VERIFIED"]

        insight = data.get("insight")
        if insight:
            lines.append(f"- Backend insight: {insight}")

        for key in [
            "top_defects",
            "defect_clusters",
            "quality_losses",
            "returns",
            "return_reasons",
        ]:
            rows = data.get(key)

            if isinstance(rows, list) and rows:
                lines.append(f"- {key.replace('_', ' ').title()}:")

                for row in rows[:6]:
                    if isinstance(row, dict):
                        lines.append(f"  - {self._compact_row(row)}")

                break

        return "\n".join(lines)

    def _operations(self) -> str:
        data = self._analytics("operations")
        lines = ["OPERATIONS — BACKEND VERIFIED"]

        insight = data.get("insight")
        if insight:
            lines.append(f"- Backend insight: {insight}")

        for key, label in [
            (
                "average_production_attainment_pct",
                "Average production attainment",
            ),
            ("production_lines", "Production lines"),
            ("printing_machines", "Printing machines"),
        ]:
            if key in data:
                lines.append(f"- {label}: {data[key]}")

        for key, value in data.items():
            if isinstance(value, list) and value:
                lines.append(f"- {key.replace('_', ' ').title()}:")

                for row in value[:5]:
                    if isinstance(row, dict):
                        lines.append(f"  - {self._compact_row(row)}")

                break

        return "\n".join(lines)

    def _channels(self) -> str:
        data = self._analytics("channels")
        lines = ["CHANNELS — BACKEND VERIFIED"]

        insight = data.get("insight")
        if insight:
            lines.append(f"- Backend insight: {insight}")

        for key in [
            "channels",
            "channel_summary",
            "channel_performance",
        ]:
            rows = data.get(key)

            if isinstance(rows, list) and rows:
                for row in rows[:6]:
                    if isinstance(row, dict):
                        lines.append(f"- {self._compact_row(row)}")
                break

        if "wholesale_pricing_exposure_egp" in data:
            lines.append(
                "- Wholesale pricing exposure scenario: "
                f'{self._money(data["wholesale_pricing_exposure_egp"])}'
            )

        return "\n".join(lines)

    def _customers(self) -> str:
        data = self._analytics("customers")
        lines = ["CUSTOMERS — BACKEND VERIFIED"]

        insight = data.get("insight")
        if insight:
            lines.append(f"- Backend insight: {insight}")

        for key, label in [
            ("repeat_rate_pct", "Repeat customer rate"),
            (
                "top_10_pct_revenue_share",
                "Top 10% customer revenue share",
            ),
            (
                "top_10_revenue_share_pct",
                "Top 10% customer revenue share",
            ),
        ]:
            if key in data:
                lines.append(f"- {label}: {self._pct(data[key])}")

        for key in ["segments", "customer_segments"]:
            rows = data.get(key)

            if isinstance(rows, list) and rows:
                lines.append(f"- {key.replace('_', ' ').title()}:")

                for row in rows[:5]:
                    if isinstance(row, dict):
                        lines.append(f"  - {self._compact_row(row)}")

                break

        return "\n".join(lines)

    def _decisions(self) -> str:
        try:
            decisions = self.board_provider()
        except Exception:
            decisions = []

        lines = ["TOP MANAGEMENT ACTIONS — BACKEND VERIFIED"]

        for decision in decisions[:8]:
            impact = decision.get("expected_impact", {})

            if isinstance(impact, dict):
                value = impact.get("estimated_value_egp")
                confidence = impact.get("confidence")
            else:
                value = None
                confidence = None

            line = (
                f'- #{decision.get("rank", "?")} '
                f'{decision.get("title", "Untitled")} | '
                f'Priority: {decision.get("priority", "unknown")} | '
                f'Department: {decision.get("department", "unknown")} | '
                f'Owner: {decision.get("suggested_owner", "Unassigned")} | '
                f'Status: {decision.get("status", "awaiting")} | '
                f'Time window: {decision.get("time_window", "Unavailable")}'
            )

            if value is not None:
                line += f" | Estimated impact: {self._money(value)}"

            if confidence is not None:
                try:
                    line += (
                        f" | Confidence: "
                        f"{float(confidence) * 100:.0f}%"
                    )
                except (TypeError, ValueError):
                    pass

            lines.append(line)

            recommended = decision.get("recommended_action")
            if recommended:
                lines.append(f"  Recommended action: {recommended}")

            reason = decision.get("business_reason")
            if reason:
                lines.append(f"  Business reason: {reason}")

            evidence = decision.get("evidence", {})
            if isinstance(evidence, dict):
                metrics = evidence.get("metrics", [])
                if isinstance(metrics, list) and metrics:
                    metric_text = ", ".join(
                        f'{m.get("label")}: {m.get("value")}'
                        for m in metrics
                        if isinstance(m, dict)
                    )
                    if metric_text:
                        lines.append(f"  Evidence: {metric_text}")

            explain = decision.get("explain", {})
            if isinstance(explain, dict):
                formula = explain.get("formula")
                if formula:
                    lines.append(f"  Formula: {formula}")

                assumptions = explain.get("assumptions")
                if isinstance(assumptions, list):
                    for assumption in assumptions[:2]:
                        lines.append(f"  Assumption: {assumption}")

        return "\n".join(lines)

    def _select_modules(
        self,
        question: str,
        mode: str = "chat",
        previous_context: str = "",
    ) -> Set[str]:
        """
        Route arbitrary natural-language questions to relevant backend modules.

        Suggestions in the UI are examples only. They are not required.
        """

        combined = f"{previous_context} {question}".lower()
        modules: Set[str] = {"overview"}

        topics = {
            "leakage": [
                "leakage",
                "leak",
                "waste",
                "loss",
                "losses",
                "exposure",
                "discount",
                "profitability problem",
            ],
            "inventory": [
                "inventory",
                "stock",
                "stockout",
                "stock out",
                "overstock",
                "dead stock",
                "trapped capital",
                "replenish",
                "replenishment",
                "warehouse",
                "cover",
            ],
            "forecast": [
                "forecast",
                "forecasting",
                "future demand",
                "demand prediction",
                "predict demand",
            ],
            "supply": [
                "supplier",
                "suppliers",
                "supply",
                "procurement",
                "vendor",
                "vendors",
                "delivery",
                "deliveries",
                "material",
                "materials",
                "lead time",
                "late",
            ],
            "marketing": [
                "marketing",
                "campaign",
                "campaigns",
                "roas",
                "advertising",
                "advert",
                "ads",
                "google",
                "meta",
                "tiktok",
                "spend",
            ],
            "quality": [
                "quality",
                "defect",
                "defects",
                "return",
                "returns",
                "refund",
                "refunds",
                "reject",
                "rejected",
                "acceptance",
            ],
            "operations": [
                "production",
                "printing",
                "machine",
                "machines",
                "downtime",
                "factory",
                "capacity",
                "attainment",
                "manufacturing",
                "line efficiency",
            ],
            "channels": [
                "channel",
                "channels",
                "retail",
                "online",
                "wholesale",
                "e-commerce",
                "ecommerce",
                "store sales",
            ],
            "customers": [
                "customer",
                "customers",
                "repeat",
                "segment",
                "segments",
                "rfm",
                "retention",
                "churn",
                "customer value",
            ],
            "decisions": [
                "decision",
                "decisions",
                "action",
                "actions",
                "priority",
                "prioritize",
                "prioritise",
                "what should",
                "recommend",
                "recommendation",
                "next step",
                "next move",
                "focus on",
                "owner",
                "manager",
                "urgent",
            ],
        }

        for module_name, keywords in topics.items():
            if any(keyword in combined for keyword in keywords):
                modules.add(module_name)

        if mode == "decision":
            modules.add("decisions")

        return modules

    def build(
        self,
        question: str,
        mode: str = "chat",
        previous_context: str = "",
    ) -> Dict[str, Any]:
        modules = self._select_modules(
            question=question,
            mode=mode,
            previous_context=previous_context,
        )

        sections: List[str] = []
        sources: List[str] = []

        # Financial overview is always useful as a small executive baseline.
        if "overview" in modules:
            sections.append(self._financial())
            sources.append("overview")

        if "leakage" in modules:
            sections.append(self._leakage())
            sources.append("profit_leakage")

        if "inventory" in modules:
            sections.append(self._inventory())
            sources.append("inventory")

        if "forecast" in modules:
            sections.append(self._forecast())
            sources.append("forecast")

        if "supply" in modules:
            sections.append(self._supply())
            sources.extend(["supply_readiness", "supply"])

        if "marketing" in modules:
            sections.append(self._marketing())
            sources.append("marketing")

        if "quality" in modules:
            sections.append(self._quality())
            sources.append("quality")

        if "operations" in modules:
            sections.append(self._operations())
            sources.append("operations")

        if "channels" in modules:
            sections.append(self._channels())
            sources.append("channels")

        if "customers" in modules:
            sections.append(self._customers())
            sources.append("customers")

        if "decisions" in modules:
            sections.append(self._decisions())
            sources.append("decision_engine")

        # If the question was too vague for keyword routing, provide a useful
        # executive context instead of pretending we have no information.
        if modules == {"overview"} and self._is_broad_question(question):
            sections.extend([
                self._leakage(),
                self._inventory(),
                self._supply(),
                self._operations(),
                self._quality(),
                self._decisions(),
            ])
            sources.extend([
                "profit_leakage",
                "inventory",
                "supply_readiness",
                "supply",
                "operations",
                "quality",
                "decision_engine",
            ])

        return {
            "question": question,
            "data_as_of": getattr(self.engine, "data_as_of", None),
            "sources": list(dict.fromkeys(sources)),
            "sections": sections,
            "modules": sorted(modules),
        }

    @staticmethod
    def _is_broad_question(question: str) -> bool:
        q = question.lower().strip()

        broad_phrases = [
            "how are we doing",
            "how is the business doing",
            "how is the company doing",
            "overall",
            "executive summary",
            "summarize the business",
            "summarise the business",
            "biggest problems",
            "main problems",
            "main risks",
            "biggest risks",
            "top risks",
            "top opportunities",
            "what should management",
            "what should we do",
            "where should we focus",
            "what needs attention",
            "tell me about the business",
        ]

        return any(phrase in q for phrase in broad_phrases)

    def as_prompt_text(
        self,
        question: str,
        mode: str = "chat",
        previous_context: str = "",
    ) -> tuple[str, List[str]]:
        bundle = self.build(
            question=question,
            mode=mode,
            previous_context=previous_context,
        )

        fact_sheet = "\n\n".join(bundle["sections"])

        conversation_note = ""

        if previous_context.strip():
            conversation_note = f"""
RECENT CONVERSATION CONTEXT
===========================
{previous_context.strip()}

The recent conversation is provided only to understand references such as
"why?", "what about that?", "which one?", or "tell me more".

Never treat a number from conversation history as authoritative unless that
same number is present in the VERIFIED BUSINESS FACT SHEET below.
""".strip()

        prompt = f"""
{conversation_note}

VERIFIED BUSINESS FACT SHEET
============================
Data as of: {bundle["data_as_of"]}

{fact_sheet}

CURRENT USER QUESTION
=====================
{question}

ANSWERING RULES
===============
1. Answer the user's actual question, even if it does not match a suggested
   question from the interface.
2. Use only the VERIFIED BUSINESS FACT SHEET for company-specific facts.
3. The backend metrics are authoritative. Do not replace them with your own
   calculations.
4. If the requested company fact is not present, say that the available
   verified context does not support an answer.
5. Never invent revenue, profit, products, suppliers, customers, dates,
   benchmarks, causes, targets, forecasts, or events.
6. Do not call a metric good, bad, high, low, above standard, or below
   standard unless the verified context supplies a comparison or benchmark.
7. Clearly distinguish recorded values from estimates, scenarios, exposure,
   recommendations, and assumptions.
8. Estimated impact is not guaranteed recoverable savings.
9. You may explain general business concepts when helpful, but clearly
   separate general explanation from El-Sharnouby-specific evidence.
10. Keep the answer useful and concise.
""".strip()

        return prompt, bundle["sources"]