"use client";

import { useApi } from "@/hooks/useApi";
import { egp, number } from "@/lib/format";
import { BarPanel, DataTable, MethodNote, MetricCard, SectionCard, StandardPage, toNum, toRows } from "@/components/Stage4Panels";

export default function MarketingPage() {
  const api = useApi<Record<string, any>>("/api/marketing");

  return (
    <StandardPage title="Marketing" question="Which spend creates efficient demand and where should budget move?" source="/api/marketing" api={api}>
      {(data) => {
        const platforms = toRows(data.by_platform);
        const top = toRows(data.top_roas_campaigns);
        const bottom = toRows(data.bottom_roas_campaigns);
        const estimate = (data.budget_reallocation_estimate ?? {}) as Record<string, any>;
        const funnel = (data.web_funnel ?? {}) as Record<string, any>;
        return (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Budget move estimate" value={egp(toNum(estimate.estimated_incremental_revenue_egp))} hint="20% bottom-spend reallocation, constant ROAS" tone="emerald" />
              <MetricCard label="Sessions" value={number(toNum(funnel.sessions))} hint="Web funnel sessions" tone="cyan" />
              <MetricCard label="Orders" value={number(toNum(funnel.orders))} hint="Web funnel orders" tone="violet" />
              <MetricCard label="Platforms" value={number(platforms.length)} hint="Marketing platform rows" tone="amber" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <BarPanel title="ROAS by platform" subtitle="Attributed revenue divided by spend." rows={platforms} xKey="Platform" yKeys={["roas"]} />
              <BarPanel title="Spend vs revenue" subtitle="Spend compared with attributed revenue." rows={platforms} xKey="Platform" yKeys={["spend_egp", "attributed_revenue_egp"]} />
            </div>

            <SectionCard title="Web funnel" subtitle="Modeled e-commerce funnel from Web_Traffic_Daily.">
              <div className="grid gap-4 md:grid-cols-5">
                <MetricCard label="Users" value={number(toNum(funnel.users))} tone="cyan" />
                <MetricCard label="Sessions" value={number(toNum(funnel.sessions))} tone="cyan" />
                <MetricCard label="Orders" value={number(toNum(funnel.orders))} tone="emerald" />
                <MetricCard label="Add to cart" value={`${toNum(funnel.avg_add_to_cart_rate_pct).toFixed(1)}%`} tone="violet" />
                <MetricCard label="Checkout" value={`${toNum(funnel.avg_checkout_rate_pct).toFixed(1)}%`} tone="amber" />
              </div>
            </SectionCard>

            <DataTable title="Platform performance" rows={platforms} filename="marketing_platforms.csv" columns={["Platform", "spend_egp", "impressions", "clicks", "orders", "attributed_revenue_egp", "ctr_pct", "conversion_pct", "cac_egp", "roas"]} />
            <div className="grid gap-6 xl:grid-cols-2">
              <DataTable title="Top ROAS campaigns" rows={top} filename="top_roas_campaigns.csv" columns={["Campaign_ID", "Campaign_Name", "Platform", "Spend_EGP", "Attributed_Revenue_EGP", "roas", "Orders_Attributed"]} />
              <DataTable title="Bottom ROAS campaigns" rows={bottom} filename="bottom_roas_campaigns.csv" columns={["Campaign_ID", "Campaign_Name", "Platform", "Spend_EGP", "Attributed_Revenue_EGP", "roas", "Orders_Attributed"]} />
            </div>
            <MethodNote sources={data.sources} formulas={data.formulas} />
          </>
        );
      }}
    </StandardPage>
  );
}
