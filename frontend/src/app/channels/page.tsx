"use client";

import { useApi } from "@/hooks/useApi";
import { egp, pct } from "@/lib/format";
import { BarPanel, DataTable, MethodNote, MetricCard, PiePanel, StandardPage, toNum, toRows } from "@/components/Stage4Panels";

export default function ChannelsPage() {
  const api = useApi<Record<string, any>>("/api/channels");

  return (
    <StandardPage title="Channels" question="Which channel mix creates revenue, margin, and pricing exposure?" source="/api/channels" api={api}>
      {(data) => {
        const channels = toRows(data.channels);
        const wholesale = channels.find((row) => String(row.Channel).toLowerCase() === "wholesale") ?? {};
        const exposure = (data.channel_mix_opportunity ?? {}) as Record<string, any>;
        return (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Wholesale share" value={pct(toNum(wholesale.revenue_share_pct))} hint="Share of total net sales" tone="violet" />
              <MetricCard label="Wholesale exposure" value={egp(toNum(exposure.value_egp))} hint="Scenario upper bound, not leakage" tone="amber" />
              <MetricCard label="Retail revenue" value={egp(toNum(channels.find((r) => r.Channel === "Retail")?.revenue_egp))} hint="Store channel" tone="cyan" />
              <MetricCard label="Online revenue" value={egp(toNum(channels.find((r) => r.Channel === "Online")?.revenue_egp))} hint="E-commerce channel" tone="emerald" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <PiePanel title="Revenue mix" subtitle="Channel net sales composition." rows={channels} nameKey="Channel" valueKey="revenue_egp" />
              <BarPanel title="Margin by channel" subtitle="Gross margin % by channel." rows={channels} xKey="Channel" yKeys={["margin_pct", "avg_discount_pct"]} />
            </div>

            <DataTable title="Channel scorecard" rows={channels} filename="channels_scorecard.csv" columns={["Channel", "revenue_egp", "gross_profit_egp", "margin_pct", "avg_discount_pct", "return_rate_pct", "aov_egp"]} />
            <DataTable title="Top governorates · Retail + Online" rows={toRows(data.top_governorates_retail_online)} filename="top_governorates_retail_online.csv" columns={["Customer_Governorate", "revenue_egp", "units"]} />
            <DataTable title="Monthly channel growth" rows={toRows(data.monthly_growth)} filename="monthly_channel_growth.csv" columns={["month", "Channel", "revenue_egp", "units", "gp", "monthly_growth_pct"]} />
            <MethodNote sources={data.sources} formulas={data.formulas} />
          </>
        );
      }}
    </StandardPage>
  );
}
