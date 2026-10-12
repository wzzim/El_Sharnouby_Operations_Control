"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { egp, pct } from "@/lib/format";
import { BarPanel, DataTable, MethodNote, MetricCard, MiniBar, SectionCard, StandardPage, toNum, toRows } from "@/components/Stage4Panels";

type Scenario = Record<string, any>;

export default function ProfitLeakagePage() {
  const api = useApi<Record<string, any>>("/api/leakage");
  const [discountCap, setDiscountCap] = useState(15);
  const [markdown, setMarkdown] = useState(15);
  const [scenario, setScenario] = useState<Scenario | null>(null);

  useEffect(() => {
    const id = setTimeout(async () => {
      try { setScenario(await apiPost<Scenario>("/api/scenario", { discount_cap_pct: discountCap, markdown_pct: markdown })); }
      catch { setScenario(null); }
    }, 300);
    return () => clearTimeout(id);
  }, [discountCap, markdown]);

  return (
    <StandardPage title="Profit Leakage" question="How much opportunity is tied to conservative leakage versus inclusive exposure?" source="/api/leakage, /api/scenario" api={api}>
      {(data) => {
        const items = toRows(data.items);
        const conservative = toNum(data.conservative_total_egp);
        const inclusive = toNum(data.including_quality_losses_total_egp);
        const wholesale = (data.wholesale_pricing_exposure ?? {}) as Record<string, any>;
        const maxItem = Math.max(...items.map((i) => toNum(i.value_egp)), 1);
        return (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Conservative leakage" value={egp(conservative)} hint="Headline total, excludes possible QC overlap" tone="rose" />
              <MetricCard label="Inclusive total" value={egp(inclusive)} hint="Includes quality losses that may overlap" tone="amber" />
              <MetricCard label="Wholesale exposure" value={egp(toNum(wholesale.value_egp))} hint="Scenario upper bound, not leakage" tone="violet" />
              <MetricCard label="Primary driver" value={String(data.primary_driver ?? "—")} hint="Largest available component" tone="cyan" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
              <SectionCard title="Leakage waterfall" subtitle="Computed items with conservative vs possible-overlap treatment.">
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black text-white">{item.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.available ? "Available from current data" : "Not available"}</p>
                        </div>
                        <p className="whitespace-nowrap text-lg font-black tabular-nums text-cyan-200">{egp(toNum(item.value_egp))}</p>
                      </div>
                      <MiniBar value={toNum(item.value_egp)} max={maxItem} tone={item.label?.includes("Quality") ? "amber" : "cyan"} />
                      <p className="mt-3 text-xs leading-5 text-slate-500">Formula: {item.formula}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="What-if estimate" subtitle="Scenario outputs are estimates and do not execute actions.">
                <div className="space-y-5">
                  <label className="block">
                    <div className="mb-2 flex justify-between text-sm"><span className="font-bold text-slate-200">Discount cap</span><span className="text-cyan-200">{discountCap}%</span></div>
                    <input type="range" min={5} max={30} value={discountCap} onChange={(e) => setDiscountCap(Number(e.target.value))} className="w-full accent-cyan-400" />
                  </label>
                  <label className="block">
                    <div className="mb-2 flex justify-between text-sm"><span className="font-bold text-slate-200">Markdown recovery</span><span className="text-cyan-200">{markdown}%</span></div>
                    <input type="range" min={5} max={35} value={markdown} onChange={(e) => setMarkdown(Number(e.target.value))} className="w-full accent-cyan-400" />
                  </label>
                  <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-200/70">Total scenario impact · estimate</p>
                    <p className="mt-2 text-3xl font-black text-white">{egp(toNum(scenario?.total_scenario_impact_egp))}</p>
                    <p className="mt-3 text-sm text-emerald-100/70">Discount leakage {egp(toNum(scenario?.retail_online_excess_discount_egp))}; markdown recovery {egp(toNum(scenario?.markdown_recovery_estimate_egp))}.</p>
                  </div>
                  <button onClick={() => { setDiscountCap(15); setMarkdown(15); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/[0.08]">Reset</button>
                </div>
              </SectionCard>
            </div>

            <BarPanel title="Leakage components" rows={items} xKey="label" yKeys={["value_egp"]} layout="vertical" />
            <DataTable title="Leakage formulas" rows={items} filename="profit_leakage_formulas.csv" columns={["label", "available", "value_egp", "share_pct", "formula", "sources"]} />
            <MethodNote sources={["/api/leakage"]} formulas={["Conservative total = production waste + returns + stockout + Retail/Online excess discount", "Inclusive total adds quality losses, labelled possible overlap", "Wholesale exposure is scenario upper bound, not leakage"]} />
          </>
        );
      }}
    </StandardPage>
  );
}
