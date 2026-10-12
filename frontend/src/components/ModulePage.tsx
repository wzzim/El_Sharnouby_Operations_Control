"use client";

import AppShell, { ErrorState, EmptyState, PageFooter, PageHeader, SkeletonBlock } from "@/components/AppShell";
import { useApi } from "@/hooks/useApi";
import { egp, number, pct, titleCase } from "@/lib/format";
import { BarChart3, Database, Sparkles } from "lucide-react";

type AnyRecord = Record<string, unknown>;

type ModulePageProps = {
  title: string;
  question: string;
  endpoint: string;
  source: string;
  preferredTables?: string[];
  preferredKpis?: string[];
};

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRows(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function prettyLabel(key: string) {
  return titleCase(key.replace(/pct/g, "%").replace(/egp/g, "EGP"));
}

function formatValue(key: string, value: unknown) {
  const n = asNumber(value);
  if (n === null) return String(value ?? "—");
  const lower = key.toLowerCase();
  if (lower.includes("egp") || lower.includes("revenue") || lower.includes("spend") || lower.includes("cost") || lower.includes("loss") || lower.includes("refund") || lower.includes("capital") || lower.includes("value")) return egp(n);
  if (lower.includes("pct") || lower.includes("rate") || lower.includes("margin") || lower.includes("share") || lower.includes("roas")) {
    if (lower.includes("roas")) return `${n.toFixed(2)}x`;
    return pct(n);
  }
  if (Math.abs(n) >= 1000) return number(n);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function isUsefulKpi(key: string, value: unknown) {
  if (Array.isArray(value) || isRecord(value)) return false;
  if (asNumber(value) === null) return false;
  const lower = key.toLowerCase();
  return ["egp", "pct", "rate", "count", "share", "turns", "roas", "orders", "units", "customers", "margin"].some((token) => lower.includes(token));
}

function collectKpis(data: AnyRecord, preferredKpis: string[] = []) {
  const source = isRecord(data.summary) ? data.summary : data;
  const preferred = preferredKpis
    .filter((key) => key in source)
    .map((key) => ({ key, value: source[key] }));
  const general = Object.entries(source)
    .filter(([key, value]) => isUsefulKpi(key, value))
    .map(([key, value]) => ({ key, value }));
  const seen = new Set<string>();
  return [...preferred, ...general]
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    })
    .slice(0, 4);
}

function collectTables(data: AnyRecord, preferredTables: string[] = []) {
  const preferred = preferredTables
    .map((key) => ({ key, rows: asRows(data[key]) }))
    .filter((item) => item.rows.length > 0);
  const general = Object.entries(data)
    .map(([key, value]) => ({ key, rows: asRows(value) }))
    .filter((item) => item.rows.length > 0 && !["formulas", "sources", "assumptions"].includes(item.key));
  const seen = new Set<string>();
  return [...preferred, ...general]
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    })
    .slice(0, 4);
}

function DataTable({ title, rows }: { title: string; rows: AnyRecord[] }) {
  const columns = Object.keys(rows[0] ?? {}).slice(0, 6);
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
            <BarChart3 className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-black text-white">{titleCase(title)}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-400">{rows.length} rows</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => <th key={column} className="px-4 py-3">{prettyLabel(column)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.slice(0, 8).map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-white/[0.025]">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3 text-slate-300">
                    <span className={asNumber(row[column]) !== null ? "font-semibold tabular-nums text-slate-100" : ""}>{formatValue(column, row[column])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ModulePage({ title, question, endpoint, source, preferredTables = [], preferredKpis = [] }: ModulePageProps) {
  const api = useApi<AnyRecord>(endpoint);
  const data = api.data ?? {};
  const insight = typeof data.insight === "string" ? data.insight : "This module is connected to a live analytics endpoint and summarizes computed operating signals.";
  const kpis = collectKpis(data, preferredKpis);
  const tables = collectTables(data, preferredTables);

  return (
    <AppShell>
      <PageHeader title={title} question={question} insight={insight} />
      {api.error && <ErrorState message={api.error} retry={api.retry} />}
      {api.loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
          <SkeletonBlock className="h-96" />
        </div>
      ) : (
        <div className="space-y-6">
          {kpis.length > 0 && (
            <div className="grid gap-4 md:grid-cols-4">
              {kpis.map((item) => (
                <div key={item.key} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
                  <div className="mb-4 inline-flex rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{prettyLabel(item.key)}</p>
                  <p className="mt-2 whitespace-nowrap text-2xl font-black tabular-nums text-white">{formatValue(item.key, item.value)}</p>
                </div>
              ))}
            </div>
          )}

          {tables.length > 0 ? (
            <div className="grid gap-6">
              {tables.map((table) => <DataTable key={table.key} title={table.key} rows={table.rows} />)}
            </div>
          ) : (
            <EmptyState title="No table rows returned" body="The endpoint is live, but this response does not expose a tabular section yet." />
          )}

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-3 text-slate-300">
              <Database className="h-5 w-5 text-cyan-300" />
              <div>
                <p className="font-black text-white">Method note</p>
                <p className="mt-1 text-sm text-slate-500">This view hides raw JSON. Formulas, sources, and modeled-data coverage are available through the Method & Coverage page.</p>
              </div>
            </div>
          </section>
        </div>
      )}
      <PageFooter source={source} />
    </AppShell>
  );
}
