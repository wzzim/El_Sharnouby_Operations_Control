"use client";

import AppShell, { EmptyState, ErrorState, PageFooter, PageHeader, SkeletonBlock } from "@/components/AppShell";
import { useApi } from "@/hooks/useApi";
import { CheckCircle2, XCircle } from "lucide-react";

type Check = Record<string, unknown>;
type DataHealth = { status?: string; checks?: Check[]; [key: string]: unknown };

function asChecks(data: DataHealth | null): Check[] {
  if (!data) return [];
  if (Array.isArray(data.checks)) return data.checks;
  return Object.entries(data)
    .filter(([, value]) => typeof value === "object" && value !== null)
    .map(([key, value]) => ({ name: key, ...(value as Record<string, unknown>) }));
}
function valueText(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function DataHealthPage() {
  const api = useApi<DataHealth>("/api/data-health");
  const checks = asChecks(api.data);
  const passCount = checks.filter((c) => valueText(c.pass ?? c.status).toLowerCase().includes("pass") || c.pass === true).length;

  return (
    <AppShell>
      <PageHeader
        title="Data Health"
        question="Do the API numbers reconcile before we present them?"
        insight={api.loading ? "Running reconciliation checks..." : `${passCount} of ${checks.length} visible reconciliation checks are passing.`}
      />
      {api.error && <ErrorState message={api.error} retry={api.retry} />}
      {api.loading ? <SkeletonBlock className="h-80" /> : checks.length === 0 ? (
        <EmptyState title="No health checks returned" body="The endpoint responded but did not return check rows. Open /api/data-health directly to inspect the backend response." />
      ) : (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Overall status</p><p className={`mt-2 text-3xl font-black ${api.data?.status === "pass" ? "text-emerald-200" : "text-red-200"}`}>{api.data?.status || "unknown"}</p></div></div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Check</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Actual</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-white/10">
                {checks.map((check, index) => {
                  const passed = check.pass === true || valueText(check.status ?? check.pass).toLowerCase().includes("pass");
                  return (
                    <tr key={index} className="hover:bg-white/[0.025]"><td className="px-4 py-3 font-bold text-white">{valueText(check.name ?? check.check ?? check.id ?? `check_${index + 1}`)}</td><td className="px-4 py-3 text-slate-400">{valueText(check.expected)}</td><td className="px-4 py-3 text-slate-400">{valueText(check.actual)}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-black ${passed ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-red-400/20 bg-red-500/10 text-red-200"}`}>{passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{passed ? "pass" : "review"}</span></td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <PageFooter source="/api/data-health" />
    </AppShell>
  );
}
