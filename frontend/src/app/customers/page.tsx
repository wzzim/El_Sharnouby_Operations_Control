"use client";

import { useApi } from "@/hooks/useApi";
import { egp, number, pct } from "@/lib/format";
import { BarPanel, DataTable, MethodNote, MetricCard, StandardPage, toNum, toRows } from "@/components/Stage4Panels";

export default function CustomersPage() {
  const api = useApi<Record<string, any>>("/api/customers");

  return (
    <StandardPage title="Customers" question="Which customer groups drive revenue and repeat behavior?" source="/api/customers" api={api}>
      {(data) => {
        const summary = (data.summary ?? {}) as Record<string, any>;
        const segments = toRows(data.segments);
        const retailSegments = segments.filter((row) => String(row.Customer_Type).toLowerCase() === "retail");
        return (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Repeat rate" value={pct(toNum(summary.repeat_rate_pct))} hint="Customers with more than one invoice" tone="emerald" />
              <MetricCard label="AOV" value={egp(toNum(summary.aov_egp))} hint="Net sales / invoice" tone="cyan" />
              <MetricCard label="Purchase frequency" value={number(toNum(summary.purchase_frequency), 2)} hint="Average invoices per customer" tone="violet" />
              <MetricCard label="Top 10% share" value={pct(toNum(summary.top_10pct_customer_revenue_share_pct))} hint="Revenue concentration" tone="amber" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <BarPanel title="RFM segment revenue" subtitle="Revenue by customer type and RFM segment." rows={segments} xKey="segment" yKeys={["revenue_egp"]} layout="vertical" />
              <BarPanel title="Retail segment count" subtitle="Retail customers by RFM segment." rows={retailSegments} xKey="segment" yKeys={["customers"]} layout="vertical" />
            </div>

            <DataTable title="RFM segments" rows={segments} filename="rfm_segments.csv" columns={["Customer_Type", "segment", "customers", "revenue_egp", "revenue_share_pct", "avg_recency_days", "avg_frequency"]} />
            <DataTable title="Cohort retention months 0-6" rows={toRows(data.cohorts_m1_m6)} filename="cohort_retention.csv" columns={["cohort", "age_m", "active_customers", "cohort_size", "retention_pct"]} />
            <MethodNote sources={data.sources} formulas={data.formulas} />
          </>
        );
      }}
    </StandardPage>
  );
}
