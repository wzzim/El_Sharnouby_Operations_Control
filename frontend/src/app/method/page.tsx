"use client";

import { useApi } from "@/hooks/useApi";
import { DataTable, MethodNote, MetricCard, SectionCard, StandardPage, toNum, toRows } from "@/components/Stage4Panels";

const coverage = [
  { card: "Card 1", page: "Command Center", endpoint: "/api/dashboard", coverage: "Monthly revenue, profit, margin, actions" },
  { card: "Card 2", page: "Customers", endpoint: "/api/customers", coverage: "RFM, repeat rate, cohorts" },
  { card: "Card 3", page: "Channels", endpoint: "/api/channels", coverage: "Retail, Online, Wholesale" },
  { card: "Card 4", page: "Inventory & Forecast", endpoint: "/api/inventory + /api/forecast", coverage: "ABC/XYZ, stock turns, WAPE" },
  { card: "Card 5", page: "Marketing", endpoint: "/api/marketing", coverage: "ROAS, CAC, funnel, reallocation" },
  { card: "Cards 6 & 8", page: "Operations", endpoint: "/api/operations", coverage: "Production, printing, downtime" },
  { card: "Card 7", page: "Quality & Returns", endpoint: "/api/quality", coverage: "Defect Pareto and returns association" },
  { card: "Card 9", page: "Supply Chain", endpoint: "/api/supply", coverage: "Supplier, materials, readiness risk" },
  { card: "Card 10", page: "Executive Story", endpoint: "/api/story", coverage: "Seven-step narrative" },
  { card: "Platform", page: "Profit Leakage", endpoint: "/api/leakage", coverage: "Conservative vs inclusive leakage" },
];

export default function MethodPage() {
  const api = useApi<Record<string, any>>("/api/method");

  return (
    <StandardPage title="Method & Coverage" question="Which formulas, source tables, assumptions, and modeled-data notes support the system?" source="/api/method" api={api}>
      {(data) => {
        const metrics = toRows(data.metrics);
        return (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Documented metrics" value={String(toNum(data.count) || metrics.length)} hint="Formula + source + assumption rows" tone="cyan" />
              <MetricCard label="Case cards mapped" value="10" hint="Each card maps to a page or endpoint" tone="emerald" />
              <MetricCard label="Data status" value="Modeled" hint="Training data disclosed honestly" tone="amber" />
              <MetricCard label="Execution" value="No DB" hint="CSV-loaded FastAPI analytics" tone="violet" />
            </div>

            <SectionCard title="Coverage map" subtitle="How the 10 business cards map to product pages and APIs.">
              <DataTable title="Case coverage" rows={coverage} columns={["card", "page", "endpoint", "coverage"]} filename="case_coverage.csv" />
            </SectionCard>

            <DataTable title="Metric formulas" rows={metrics} filename="method_formulas.csv" columns={["metric_id", "label", "formula", "source_tables", "assumptions", "real_vs_modeled"]} />
            <MethodNote sources={["/api/method", "Data_Dictionary.csv"]} formulas={["Every UI metric should trace back to an endpoint, a formula, source tables, and assumptions.", "Values are from modeled operational CSVs for the internship project, not audited company financials."]} />
          </>
        );
      }}
    </StandardPage>
  );
}
