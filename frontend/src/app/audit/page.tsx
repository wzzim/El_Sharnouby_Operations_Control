"use client";

import AppShell, { EmptyState, ErrorState, PageFooter, PageHeader, SkeletonBlock } from "@/components/AppShell";
import { useApi } from "@/hooks/useApi";
import type { AuditEvent } from "@/lib/types";
import { Activity, Clock3 } from "lucide-react";

type AuditResponse = { events: AuditEvent[] };

export default function AuditPage() {
  const api = useApi<AuditResponse>("/api/audit");
  const events = api.data?.events ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Time Machine / Audit Trail"
        question="What decision changes happened, when, and under which role?"
        insight={`${events.length} audit events are currently stored in the local SQLite audit database.`}
      />
      {api.error && <ErrorState message={api.error} retry={api.retry} />}
      {api.loading ? <SkeletonBlock className="h-80" /> : events.length === 0 ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <EmptyState title="No audit events yet" body="Approve, defer, or start a War Room card to create an audit entry. This is expected before you interact with the board." />
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <Clock3 className="h-8 w-8 text-cyan-200" />
            <h2 className="mt-4 text-xl font-black text-white">How to create one</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-50/80">Go to Decision War Room → click Approve / Defer / Start → confirm the modal. The backend writes the transition to SQLite and it appears here.</p>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={`${event.id}-${index}`} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-200"><Activity className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-black text-white">{event.title || event.decision_id}</p><span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">{event.from_status} → {event.to_status}</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-xs font-bold text-cyan-200">{event.role || "Unknown role"}</span></div>
                  <p className="mt-1 text-xs text-slate-500">{event.ts}</p>
                  {event.note && <p className="mt-2 text-sm text-slate-400">{event.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <PageFooter source="/api/audit, backend/store.py" />
    </AppShell>
  );
}
