"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell, { ErrorState, PageFooter, PageHeader, ROLE_STORAGE_KEY, SkeletonBlock } from "@/components/AppShell";
import { useApi } from "@/hooks/useApi";
import { transitionDecision } from "@/lib/api";
import type { BoardStatus, Decision, DecisionsResponse } from "@/lib/types";
import { egp, priorityClass, statusClass, titleCase } from "@/lib/format";
import { ArrowRight, CheckCircle2, Eye, GripVertical, Search, X } from "lucide-react";

type PendingTransition = {
  decision: Decision;
  status: BoardStatus;
  note: string;
};

const columns: Array<{ id: BoardStatus; title: string; subtitle: string; color: string }> = [
  { id: "awaiting", title: "Awaiting decision", subtitle: "Incoming AI recommendations", color: "border-cyan-400/25" },
  { id: "deferred", title: "Deferred", subtitle: "Put aside", color: "border-slate-400/25" },
  { id: "approved", title: "Approved · not started", subtitle: "Accepted actions", color: "border-emerald-400/25" },
  { id: "in_progress", title: "In progress", subtitle: "Active execution", color: "border-violet-400/25" },
];

function nextStatus(status: BoardStatus): BoardStatus {
  if (status === "awaiting") return "approved";
  if (status === "approved") return "in_progress";
  if (status === "deferred") return "awaiting";
  return "approved";
}

function actionLabel(status: BoardStatus) {
  if (status === "awaiting") return "Approve";
  if (status === "approved") return "Start";
  if (status === "deferred") return "Reopen";
  return "Move back";
}

function currentRole() {
  if (typeof window === "undefined") return "CEO";
  return window.localStorage.getItem(ROLE_STORAGE_KEY) || "CEO";
}

function shouldShowStock(decision: Decision) {
  const department = (decision.department || decision.category || "").toLowerCase();
  return !(department.includes("supplier") || department.includes("quality") || department.includes("marketing") || department.includes("procurement"));
}

function DecisionCard({
  decision,
  onOpen,
  onTransition,
  onDragStart,
}: {
  decision: Decision;
  onOpen: (decision: Decision) => void;
  onTransition: (decision: Decision, status: BoardStatus) => void;
  onDragStart: (decision: Decision) => void;
}) {
  const status = decision.status || "awaiting";
  const metrics = decision.evidence?.metrics ?? [];
  const stockCard = shouldShowStock(decision);

  return (
    <article
      draggable
      onDragStart={() => onDragStart(decision)}
      className="group rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-slate-900/90"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 cursor-grab text-slate-600" />
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-black text-slate-300">
            #{decision.rank}
          </span>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${priorityClass(decision.priority)}`}>
          {decision.priority}
        </span>
      </div>

      <button onClick={() => onOpen(decision)} className="block w-full text-left">
        <h3 className="line-clamp-2 text-sm font-black leading-5 text-white">{decision.title}</h3>
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{decision.recommended_action}</p>
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-black text-emerald-200">
          {egp(decision.expected_impact.estimated_value_egp)} · {Math.round(decision.expected_impact.confidence * 100)}%
        </span>
        <span className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-xs font-semibold text-violet-200">
          {decision.department || titleCase(decision.category)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-xs">
        {stockCard ? (
          <>
            <div><p className="text-slate-600">Stock</p><p className="mt-1 font-semibold text-slate-300">{decision.evidence.current_stock}</p></div>
            <div><p className="text-slate-600">Cover</p><p className="mt-1 font-semibold text-slate-300">{decision.evidence.days_of_cover}d</p></div>
          </>
        ) : (
          metrics.slice(0, 4).map((m) => (
            <div key={m.label}><p className="text-slate-600">{m.label}</p><p className="mt-1 font-semibold text-slate-300">{String(m.value)}</p></div>
          ))
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onTransition(decision, nextStatus(status))}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300"
        >
          {actionLabel(status)} <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onOpen(decision)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/[0.08]">
          <Eye className="h-3.5 w-3.5" />
        </button>
        {status !== "deferred" && (
          <button onClick={() => onTransition(decision, "deferred")} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/[0.08]">
            Defer
          </button>
        )}
      </div>
    </article>
  );
}

function ConfirmModal({ pending, error, onClose, onConfirm, onNote }: { pending: PendingTransition | null; error: string | null; onClose: () => void; onConfirm: () => void; onNote: (value: string) => void }) {
  if (!pending) return null;
  const formula = pending.decision.explain?.formula || "Formula not supplied by backend.";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Confirm transition</p>
            <h2 className="mt-2 text-2xl font-black text-white">{titleCase(pending.status)}</h2>
            <p className="mt-2 text-sm text-slate-400">{pending.decision.title}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <p className="text-xs text-emerald-200/70">Estimated impact</p>
          <p className="mt-1 text-3xl font-black text-emerald-100">{egp(pending.decision.expected_impact.estimated_value_egp)}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-bold text-slate-500">Formula</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{formula}</p>
        </div>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">Optional note</label>
        <textarea
          value={pending.note}
          onChange={(event) => onNote(event.target.value)}
          className="mt-2 h-24 w-full rounded-2xl border border-white/10 bg-slate-900 p-3 text-sm text-slate-200 outline-none"
          placeholder="Add a decision note..."
        />

        {error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/[0.05]">Cancel</button>
          <button onClick={onConfirm} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-300">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({ decision, onClose }: { decision: Decision | null; onClose: () => void }) {
  if (!decision) return null;
  return (
    <aside className="fixed right-0 top-0 z-40 h-screen w-full max-w-xl overflow-auto border-l border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Decision detail</p>
          <h2 className="mt-2 text-2xl font-black text-white">{decision.title}</h2>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-300">{decision.business_reason}</p>
      <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
        <p className="text-xs text-emerald-200/70">Impact</p>
        <p className="mt-1 text-3xl font-black text-emerald-100">{egp(decision.expected_impact.estimated_value_egp)}</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {(decision.evidence.metrics ?? []).map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-slate-500">{m.label}</p><p className="mt-1 text-sm font-bold text-white">{String(m.value)}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Explain</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{decision.explain?.formula || "No formula supplied."}</p>
        {(decision.explain?.assumptions ?? []).length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-400">
            {decision.explain?.assumptions?.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
      </div>
    </aside>
  );
}

export default function WarRoomPage() {
  const api = useApi<DecisionsResponse>("/api/decisions");
  const [cards, setCards] = useState<Decision[]>([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dragged, setDragged] = useState<Decision | null>(null);
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<Decision | null>(null);
  const [visibleCount, setVisibleCount] = useState<Record<BoardStatus, number>>({ awaiting: 10, deferred: 10, approved: 10, in_progress: 10 });

  useEffect(() => {
    if (api.data?.decisions) setCards(api.data.decisions);
  }, [api.data]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setDetail(null); setPending(null); }
      if (event.key.toLowerCase() === "j") window.scrollBy({ top: 240, behavior: "smooth" });
      if (event.key.toLowerCase() === "k") window.scrollBy({ top: -240, behavior: "smooth" });
      if (event.key === "Enter" && cards[0]) setDetail(cards[0]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cards]);

  const departments = useMemo(() => ["all", ...Array.from(new Set(cards.map((c) => c.department || c.category).filter(Boolean)))], [cards]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesText = !text || [card.title, card.recommended_action, card.evidence?.product_name, card.evidence?.location, card.department, card.category].join(" ").toLowerCase().includes(text);
      const matchesDepartment = department === "all" || (card.department || card.category) === department;
      const matchesPriority = priority === "all" || card.priority === priority;
      return matchesText && matchesDepartment && matchesPriority;
    });
  }, [cards, query, department, priority]);

  function requestTransition(decision: Decision, status: BoardStatus) {
    setModalError(null);
    setPending({ decision, status, note: "" });
  }

  async function confirmTransition() {
    if (!pending) return;
    try {
      setModalError(null);
      const role = currentRole();
      await transitionDecision(pending.decision.decision_id, pending.status, role, pending.note);
      setCards((current) => current.map((card) => card.decision_id === pending.decision.decision_id ? { ...card, status: pending.status, updated_by: role } : card));
      setToast(`Moved ${pending.decision.decision_id} to ${titleCase(pending.status)}`);
      setPending(null);
      setTimeout(() => setToast(null), 2600);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Transition failed");
    }
  }

  function onDrop(status: BoardStatus) {
    if (!dragged) return;
    requestTransition(dragged, status);
    setDragged(null);
  }

  return (
    <AppShell>
      <PageHeader
        title="Decision Execution Room"
        question="Which AI recommendations should executives approve, defer, or start executing?"
        insight={`${filtered.length} decisions shown after filters. All status changes require confirmation and are posted to the backend audit trail.`}
      />

      {api.error && <ErrorState message={api.error} retry={api.retry} />}

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_180px_160px]">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter decisions by text..." className="w-full bg-transparent text-sm text-slate-200 outline-none" />
        </div>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
          {departments.map((d) => <option key={d} value={d}>{d === "all" ? "All departments" : d}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
          {['all','critical','high','medium'].map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
        </select>
      </div>

      {api.loading ? (
        <div className="grid gap-4 xl:grid-cols-4"><SkeletonBlock className="h-[620px]" /><SkeletonBlock className="h-[620px]" /><SkeletonBlock className="h-[620px]" /><SkeletonBlock className="h-[620px]" /></div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-4">
          {columns.map((column) => {
            const columnCards = filtered.filter((c) => (c.status || "awaiting") === column.id);
            const shown = columnCards.slice(0, visibleCount[column.id]);
            return (
              <div key={column.id} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(column.id)} className={`min-h-[620px] rounded-3xl border ${column.color} bg-white/[0.025] p-3`}>
                <div className="mb-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><h2 className="text-sm font-black text-white">{column.title}</h2><p className="mt-1 text-xs text-slate-500">{column.subtitle}</p></div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-black text-slate-300">{columnCards.length}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {shown.map((decision) => <DecisionCard key={decision.decision_id} decision={decision} onOpen={setDetail} onTransition={requestTransition} onDragStart={setDragged} />)}
                  {columnCards.length > shown.length && (
                    <button onClick={() => setVisibleCount((c) => ({ ...c, [column.id]: c[column.id] + 10 }))} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/[0.08]">
                      Show more
                    </button>
                  )}
                  {columnCards.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">No cards match this column/filter.</div>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {toast && <div className="fixed bottom-5 right-5 z-50 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100 shadow-2xl"><CheckCircle2 className="mr-2 inline h-4 w-4" />{toast}</div>}
      <ConfirmModal pending={pending} error={modalError} onClose={() => setPending(null)} onConfirm={confirmTransition} onNote={(note) => setPending((p) => p ? { ...p, note } : p)} />
      <DetailDrawer decision={detail} onClose={() => setDetail(null)} />
      <PageFooter source="/api/decisions, POST /api/decisions/{id}/transition, /api/roles" />
    </AppShell>
  );
}
