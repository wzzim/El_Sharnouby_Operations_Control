"use client";

import AppShell, { EmptyState, ErrorState, PageFooter, PageHeader, SkeletonBlock } from "@/components/AppShell";
import { useApi } from "@/hooks/useApi";
import type { DecisionsResponse } from "@/lib/types";
import { egp, priorityClass, statusClass } from "@/lib/format";
import { ClipboardCheck } from "lucide-react";

export default function ActionCenterPage() {
  const api = useApi<DecisionsResponse>("/api/decisions");
  const decisions = api.data?.decisions ?? [];
  const grouped = decisions.reduce<Record<string, typeof decisions>>((acc, decision) => {
    const key = decision.department || decision.category || "Operations";
    acc[key] = acc[key] || [];
    acc[key].push(decision);
    return acc;
  }, {});
  const owners = Object.entries(grouped).map(([department, items]) => ({
    department,
    count: items.length,
    value: items.reduce((sum, item) => sum + (item.expected_impact?.estimated_value_egp ?? 0), 0),
  })).sort((a, b) => b.value - a.value);

  return (
    <AppShell>
      <PageHeader
        title="Action Center"
        question="Which departments own the highest-impact open actions?"
        insight={`${decisions.length} actions are grouped by department so leadership can assign accountability.`}
      />
      {api.error && <ErrorState message={api.error} retry={api.retry} />}
      {api.loading ? (
        <div className="space-y-4"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
      ) : decisions.length === 0 ? (
        <EmptyState title="No actions returned yet" body="The endpoint responded but returned no decisions. Check /api/decisions or reload the backend." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {owners.slice(0, 4).map((item) => (
              <div key={item.department} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                <div className="mb-4 inline-flex rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200"><ClipboardCheck className="h-5 w-5" /></div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{item.department}</p>
                <p className="mt-2 text-2xl font-black text-white">{item.count} actions</p>
                <p className="mt-1 text-sm font-bold text-emerald-200">{egp(item.value)} total impact</p>
              </div>
            ))}
          </div>
          {Object.entries(grouped).map(([department, items]) => (
            <section key={department} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-white">{department}</h2>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">{items.length} actions</span>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Impact</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {items.slice(0, 12).map((item) => (
                      <tr key={item.decision_id} className="hover:bg-white/[0.025]">
                        <td className="px-4 py-3 font-black text-slate-300">#{item.rank}</td>
                        <td className="px-4 py-3"><p className="font-semibold text-white">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.time_window}</p></td>
                        <td className="px-4 py-3 text-slate-300">{item.suggested_owner}</td>
                        <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-black uppercase ${priorityClass(item.priority)}`}>{item.priority}</span></td>
                        <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-black ${statusClass(item.status || "awaiting")}`}>{item.status || "awaiting"}</span></td>
                        <td className="px-4 py-3 text-right font-black text-emerald-200">{egp(item.expected_impact.estimated_value_egp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
      <PageFooter source="/api/decisions" />
    </AppShell>
  );
}
