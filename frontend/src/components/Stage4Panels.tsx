"use client";

import { type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Database, Download, Sparkles } from "lucide-react";
import AppShell, { EmptyState, ErrorState, PageFooter, PageHeader, SkeletonBlock } from "@/components/AppShell";
import { useApi } from "@/hooks/useApi";
import { egp, number, pct, titleCase } from "@/lib/format";

export type AnyRecord = Record<string, any>;

export const chartColors = ["#22d3ee", "#34d399", "#a78bfa", "#f59e0b", "#fb7185", "#60a5fa", "#f472b6", "#c084fc"];

export function toRows(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as AnyRecord[] : [];
}

export function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function label(key: string) {
  return titleCase(key.replace(/pct/g, "%").replace(/egp/g, "EGP").replace(/roas/g, "ROAS"));
}

export function fmt(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const lower = key.toLowerCase();
  if (lower.includes("egp") || lower.includes("revenue") || lower.includes("profit") || lower.includes("spend") || lower.includes("cost") || lower.includes("loss") || lower.includes("refund") || lower.includes("capital") || lower.includes("value") || lower.includes("impact") || lower.includes("opportunity")) return egp(n);
  if (lower.includes("pct") || lower.includes("rate") || lower.includes("margin") || lower.includes("share") || lower.includes("yield") || lower.includes("attainment") || lower.includes("conversion") || lower.includes("quality") || lower.includes("acceptance") || lower.includes("on_time")) return pct(n);
  if (lower.includes("roas")) return `${n.toFixed(2)}x`;
  if (Math.abs(n) >= 1000) return number(n);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function exportCsv(filename: string, rows: AnyRecord[]) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0] ?? {});
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => {
      const raw = row[column] ?? "";
      const safe = String(raw).replace(/"/g, '""');
      return `"${safe}"`;
    }).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function MetricCard({ label, value, hint, tone = "cyan" }: { label: string; value: string; hint?: string; tone?: "cyan" | "emerald" | "violet" | "amber" | "rose" }) {
  const classes = {
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  }[tone];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
      <div className={`mb-4 inline-flex rounded-2xl border p-3 ${classes}`}>
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 whitespace-nowrap text-2xl font-black tabular-nums text-white">{value}</p>
      {hint && <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

export function SectionCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-xl shadow-black/20">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DataTable({ title, rows, columns, filename, subtitle }: { title: string; rows: AnyRecord[]; columns?: string[]; filename?: string; subtitle?: string }) {
  const visibleColumns = columns ?? Object.keys(rows[0] ?? {}).slice(0, 7);
  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      action={rows.length > 0 && filename ? (
        <button onClick={() => exportCsv(filename, rows)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/[0.08]">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      ) : undefined}
    >
      {rows.length === 0 ? (
        <EmptyState title="No rows returned" body="The endpoint is live but this table is empty for the current data." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-500">
              <tr>{visibleColumns.map((column) => <th key={column} className="px-4 py-3">{label(column)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.slice(0, 12).map((row, index) => (
                <tr key={index} className="hover:bg-white/[0.025]">
                  {visibleColumns.map((column) => (
                    <td key={column} className="px-4 py-3 text-slate-300">
                      <span className={Number.isFinite(Number(row[column])) ? "font-semibold tabular-nums text-slate-100" : ""}>{fmt(column, row[column])}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function axisFormatter(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

export function LinePanel({ title, rows, xKey, yKeys, subtitle }: { title: string; rows: AnyRecord[]; xKey: string; yKeys: string[]; subtitle?: string }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="#334155" strokeOpacity={0.35} />
            <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tickFormatter={axisFormatter} tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }} formatter={(v: any, n: any) => [axisFormatter(v), label(String(n))]} />
            <Legend />
            {yKeys.map((key, index) => <Line key={key} type="monotone" dataKey={key} stroke={chartColors[index % chartColors.length]} strokeWidth={2.5} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

export function AreaPanel({ title, rows, xKey, yKeys, subtitle }: { title: string; rows: AnyRecord[]; xKey: string; yKeys: string[]; subtitle?: string }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <defs>
              {yKeys.map((key, index) => (
                <linearGradient key={key} id={`g-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors[index % chartColors.length]} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={chartColors[index % chartColors.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#334155" strokeOpacity={0.35} />
            <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tickFormatter={axisFormatter} tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }} formatter={(v: any, n: any) => [axisFormatter(v), label(String(n))]} />
            <Legend />
            {yKeys.map((key, index) => <Area key={key} type="monotone" dataKey={key} stroke={chartColors[index % chartColors.length]} fill={`url(#g-${key})`} strokeWidth={2.5} />)}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

export function BarPanel({ title, rows, xKey, yKeys, subtitle, layout = "horizontal" }: { title: string; rows: AnyRecord[]; xKey: string; yKeys: string[]; subtitle?: string; layout?: "horizontal" | "vertical" }) {
  const vertical = layout === "vertical";
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout={vertical ? "vertical" : "horizontal"} margin={{ left: vertical ? 64 : 8, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="#334155" strokeOpacity={0.35} />
            {vertical ? <XAxis type="number" stroke="#64748b" tickFormatter={axisFormatter} /> : <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 12 }} />}
            {vertical ? <YAxis type="category" dataKey={xKey} stroke="#64748b" tick={{ fontSize: 12 }} width={120} /> : <YAxis stroke="#64748b" tickFormatter={axisFormatter} tick={{ fontSize: 12 }} />}
            <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }} formatter={(v: any, n: any) => [axisFormatter(v), label(String(n))]} />
            <Legend />
            {yKeys.map((key, index) => <Bar key={key} dataKey={key} fill={chartColors[index % chartColors.length]} radius={[8, 8, 0, 0]} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

export function PiePanel({ title, rows, nameKey, valueKey, subtitle }: { title: string; rows: AnyRecord[]; nameKey: string; valueKey: string; subtitle?: string }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} nameKey={nameKey} dataKey={valueKey} innerRadius={68} outerRadius={110} paddingAngle={3}>
              {rows.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }} formatter={(v: any) => axisFormatter(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

export function MethodNote({ sources, formulas }: { sources?: unknown; formulas?: unknown }) {
  const sourceList = Array.isArray(sources) ? sources : [];
  const formulaList = Array.isArray(formulas) ? formulas : [];
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-start gap-3 text-slate-300">
        <Database className="mt-1 h-5 w-5 text-cyan-300" />
        <div>
          <p className="font-black text-white">Formula and source note</p>
          {sourceList.length > 0 && <p className="mt-1 text-sm text-slate-500">Sources: {sourceList.join(", ")}</p>}
          {formulaList.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-500">
              {formulaList.slice(0, 4).map((item, index) => <li key={index}>{String(item)}</li>)}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export function LoadingPage({ title, question }: { title: string; question: string }) {
  return (
    <AppShell>
      <PageHeader title={title} question={question} insight="Loading computed operating signals..." />
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
        <SkeletonBlock className="h-96" />
      </div>
    </AppShell>
  );
}

export function StandardPage({ title, question, source, api, children }: { title: string; question: string; source: string; api: { data?: AnyRecord | null; loading: boolean; error?: string | null; retry: () => void }; children: (data: AnyRecord) => ReactNode }) {
  if (api.loading) return <LoadingPage title={title} question={question} />;
  const data = api.data ?? {};
  const insight = typeof data.insight === "string" ? data.insight : "Computed analytics are available for this module.";
  return (
    <AppShell>
      <PageHeader title={title} question={question} insight={insight} />
      {api.error && <ErrorState message={api.error} retry={api.retry} />}
      {!api.error && <div className="space-y-6">{children(data)}</div>}
      <PageFooter source={source} />
    </AppShell>
  );
}

export function MiniBar({ value, max = 100, tone = "cyan" }: { value: number; max?: number; tone?: "cyan" | "emerald" | "violet" | "amber" | "rose" }) {
  const pctValue = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100));
  const colors = {
    cyan: "from-cyan-400 to-blue-400",
    emerald: "from-emerald-400 to-cyan-300",
    violet: "from-violet-400 to-fuchsia-400",
    amber: "from-amber-300 to-orange-400",
    rose: "from-rose-400 to-red-400",
  }[tone];
  return (
    <div className="h-2 rounded-full bg-white/10">
      <div className={`h-2 rounded-full bg-gradient-to-r ${colors}`} style={{ width: `${pctValue}%` }} />
    </div>
  );
}
