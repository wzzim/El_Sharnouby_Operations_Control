"use client";

import AppShell, { ErrorState, PageFooter, PageHeader, SkeletonBlock } from "@/components/AppShell";
import type { ReactNode } from "react";
import { useApi } from "@/hooks/useApi";
import type { ChannelsResponse, DashboardResponse, DecisionsResponse, Overview } from "@/lib/types";
import { egp, pct } from "@/lib/format";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleDollarSign, PackageSearch, ShieldAlert, TrendingUp } from "lucide-react";

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function firstArray(obj: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const found = rows(obj[name]);
    if (found.length) return found;
  }
  return [];
}

function kpi(label: string, value: string, hint: string, icon: ReactNode) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">{icon}</div>
      </div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 whitespace-nowrap text-2xl font-black tabular-nums text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default function CommandCenterPage() {
  const overview = useApi<Overview>("/api/overview");
  const dashboard = useApi<DashboardResponse>("/api/dashboard");
  const decisions = useApi<DecisionsResponse>("/api/decisions");
  const channels = useApi<ChannelsResponse>("/api/channels");

  const loading = overview.loading || dashboard.loading;
  const error = overview.error || dashboard.error;
  const monthly = firstArray((dashboard.data ?? {}) as Record<string, unknown>, ["monthly", "monthly_revenue", "revenue_vs_profit", "monthly_sales_trend"]);
  const channelRows = firstArray((channels.data ?? dashboard.data ?? {}) as Record<string, unknown>, ["channels", "channel_mix"]);
  const topActions = (decisions.data?.decisions ?? []).slice(0, 5);

  return (
    <AppShell>
      <PageHeader
        title="Command Center"
        question="What is happening in revenue, margin, channels, and urgent actions right now?"
        insight={dashboard.data?.insight}
      />

      {error && <ErrorState message={error} retry={() => { overview.retry(); dashboard.retry(); }} />}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          {kpi("Revenue", egp(overview.data?.kpis.total_revenue_egp), "Net sales", <CircleDollarSign className="h-5 w-5" />)}
          {kpi("Gross Margin", pct(overview.data?.kpis.gross_margin_pct), "Gross profit / net sales", <TrendingUp className="h-5 w-5" />)}
          {kpi("Trapped Capital", egp(overview.data?.kpis.dead_stock_trapped_capital_egp), "Idle inventory cost basis", <PackageSearch className="h-5 w-5" />)}
          {kpi("Stockout Risks", String(overview.data?.kpis.stockout_risk_count ?? 0), "Product-location pairs", <ShieldAlert className="h-5 w-5" />)}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-lg font-black text-white">Revenue vs Gross Profit</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="rev" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35}/><stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gp" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tickFormatter={(v) => egp(v as number)} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,.12)", borderRadius: 16 }} formatter={(v) => egp(Number(v))} />
                <Area type="monotone" dataKey="revenue_egp" name="Revenue" stroke="#22d3ee" fill="url(#rev)" strokeWidth={2} />
                <Area type="monotone" dataKey="gross_profit_egp" name="Gross Profit" stroke="#a78bfa" fill="url(#gp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-lg font-black text-white">Channel Mix</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channelRows} dataKey="revenue_egp" nameKey="channel" innerRadius={70} outerRadius={110} paddingAngle={3}>
                  {channelRows.map((_, index) => <Cell key={index} fill={["#22d3ee", "#a78bfa", "#34d399", "#f59e0b"][index % 4]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,.12)", borderRadius: 16 }} formatter={(v) => egp(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-lg font-black text-white">Top 5 Actions This Week</h2>
          <div className="space-y-3">
            {topActions.map((action) => (
              <div key={action.decision_id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-white">{action.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Owner: {action.suggested_owner}</p>
                  </div>
                  <p className="whitespace-nowrap text-sm font-black text-emerald-200">{egp(action.expected_impact.estimated_value_egp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-lg font-black text-white">Discount Impact by Band</h2>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3 text-right">Units</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {firstArray((dashboard.data ?? {}) as Record<string, unknown>, ["discount_bands", "discount_impact"]).map((row, index) => {
                  const band = String(row.band ?? row.discount_band ?? `Band ${index + 1}`);
                  const units = Number(row.units ?? 0);
                  const revenue = Number(row.revenue_egp ?? 0);
                  const margin = Number(row.margin_pct ?? 0);
                  return (
                    <tr key={band} className="hover:bg-white/[0.025]">
                      <td className="px-4 py-3 font-bold text-white">{band}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{units.toLocaleString("en-EG")}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-200">{egp(revenue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-cyan-200">{pct(margin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Shown as a table for clean recording: no grey chart artifacts, and every value comes from /api/dashboard.</p>
        </div>
      </div>

      <PageFooter source="/api/overview, /api/dashboard, /api/channels, /api/decisions" />
    </AppShell>
  );
}
