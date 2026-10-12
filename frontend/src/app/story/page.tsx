"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Calculator, CheckCircle2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { apiPost } from "@/lib/api";
import { egp, number, pct } from "@/lib/format";
import { MetricCard, MethodNote, SectionCard, StandardPage, toNum } from "@/components/Stage4Panels";

type Scenario = {
  discount_cap_pct: number;
  markdown_pct: number;
  retail_online_excess_discount_egp: number;
  markdown_recovery_estimate_egp: number;
  total_scenario_impact_egp: number;
  label: string;
  assumptions: string[];
};

function summarizeNumbers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).map((item, index) => {
    if (item && typeof item === "object") {
      const entries = Object.entries(item as Record<string, unknown>).slice(0, 3);
      return (
        <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          {entries.map(([key, val]) => (
            <div key={key} className="mb-2 last:mb-0">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{key.replace(/_/g, " ")}</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-100">
                {String(key).toLowerCase().includes("egp") ? egp(toNum(val)) : String(key).toLowerCase().includes("pct") ? pct(toNum(val)) : Number.isFinite(Number(val)) ? number(Number(val), 1) : String(val)}
              </p>
            </div>
          ))}
        </div>
      );
    }
    return <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-slate-300">{String(item)}</div>;
  });
}

export default function StoryPage() {
  const api = useApi<Record<string, any>>("/api/story");
  const [stepIndex, setStepIndex] = useState(0);
  const [discountCap, setDiscountCap] = useState(15);
  const [markdown, setMarkdown] = useState(15);
  const [scenario, setScenario] = useState<Scenario | null>(null);

  const steps = useMemo(() => Array.isArray(api.data?.steps) ? api.data.steps : [], [api.data]);
  const active = steps[stepIndex] ?? null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setStepIndex((i) => Math.min(i + 1, Math.max(steps.length - 1, 0)));
      if (event.key === "ArrowLeft") setStepIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const res = await apiPost<Scenario>("/api/scenario", { discount_cap_pct: discountCap, markdown_pct: markdown });
        setScenario(res);
      } catch {
        setScenario(null);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [discountCap, markdown]);

  return (
    <StandardPage title="Executive Story" question="What is the shortest CEO-ready explanation of the business opportunity?" source="/api/story, /api/scenario" api={api}>
      {(data) => (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Story opportunity" value={egp(toNum(data.total_quantified_opportunity_egp))} hint="Conservative leakage plus top-ranked decision exposure" tone="emerald" />
            <MetricCard label="Steps" value={String(steps.length)} hint="Demand to quality narrative" tone="cyan" />
            <MetricCard label="Scenario estimate" value={egp(scenario?.total_scenario_impact_egp)} hint="Debounced what-if impact" tone="violet" />
          </div>

          <SectionCard title="CEO story navigator" subtitle="Use the arrow keys or the controls below to move through the story.">
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
              <div className="space-y-2">
                {steps.map((step: any, index: number) => (
                  <button key={index} onClick={() => setStepIndex(index)} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${index === stepIndex ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]"}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-xs font-black">{index + 1}</span>
                    <span className="text-sm font-bold">{step.headline}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                {active ? (
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Step {stepIndex + 1}</p>
                    <h2 className="mt-3 text-3xl font-black text-white">{active.headline}</h2>
                    <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">Action: {active.action}</p>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">{summarizeNumbers(active.numbers)}</div>
                    <div className="mt-6 flex items-center justify-between gap-3">
                      <button onClick={() => setStepIndex((i) => Math.max(i - 1, 0))} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/[0.08]"><ArrowLeft className="h-4 w-4" /> Previous</button>
                      <button onClick={() => setStepIndex((i) => Math.min(i + 1, steps.length - 1))} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-300">Next <ArrowRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                ) : <p className="text-slate-500">No story steps returned.</p>}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="What-if scenario" subtitle="Estimate only. These sliders do not execute decisions or change source data.">
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <label className="block">
                  <div className="mb-2 flex justify-between text-sm"><span className="font-bold text-slate-200">Retail/Online discount cap</span><span className="tabular-nums text-cyan-200">{discountCap}%</span></div>
                  <input type="range" min={5} max={30} value={discountCap} onChange={(e) => setDiscountCap(Number(e.target.value))} className="w-full accent-cyan-400" />
                </label>
                <label className="block">
                  <div className="mb-2 flex justify-between text-sm"><span className="font-bold text-slate-200">Markdown recovery %</span><span className="tabular-nums text-cyan-200">{markdown}%</span></div>
                  <input type="range" min={5} max={35} value={markdown} onChange={(e) => setMarkdown(Number(e.target.value))} className="w-full accent-cyan-400" />
                </label>
                <button onClick={() => { setDiscountCap(15); setMarkdown(15); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/[0.08]">Reset scenario</button>
              </div>
              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                <div className="mb-4 flex items-center gap-3 text-cyan-100"><Calculator className="h-5 w-5" /><p className="font-black">Scenario result</p></div>
                <p className="text-4xl font-black tabular-nums text-white">{egp(scenario?.total_scenario_impact_egp)}</p>
                <div className="mt-4 space-y-2 text-sm text-cyan-100/80">
                  <p>Discount leakage: {egp(scenario?.retail_online_excess_discount_egp)}</p>
                  <p>Markdown recovery: {egp(scenario?.markdown_recovery_estimate_egp)}</p>
                </div>
                <ul className="mt-4 space-y-1 text-xs text-cyan-100/60">
                  {(scenario?.assumptions ?? []).map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />{item}</li>)}
                </ul>
              </div>
            </div>
          </SectionCard>

          <MethodNote sources={data.sources} formulas={data.formulas} />
        </>
      )}
    </StandardPage>
  );
}
