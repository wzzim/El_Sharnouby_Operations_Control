"use client";

import { useApi } from "@/hooks/useApi";
import { egp, number, pct } from "@/lib/format";
import { BarPanel, DataTable, MethodNote, MetricCard, SectionCard, StandardPage, toNum, toRows } from "@/components/Stage4Panels";

export default function SupplyPage() {
  const api = useApi<Record<string, any>>("/api/supply");
  const readiness = useApi<Record<string, any>>("/api/supply-readiness");

  return (
    <StandardPage title="Supply Chain" question="Which suppliers and materials create readiness risk?" source="/api/supply, /api/supply-readiness" api={api}>
      {(data) => {
        const overall = (readiness.data?.overall ?? {}) as Record<string, any>;
        const counts = (readiness.data?.counts ?? {}) as Record<string, any>;
        const materials = toRows(data.material_criticality);
        const risk = toRows(data.shortage_risk_materials);
        const matrix = toRows(data.action_matrix);
        const performance = toRows(data.supplier_material_performance);
        return (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="On-time" value={pct(toNum(overall.on_time_pct))} hint="Actual receipt <= promised date" tone="cyan" />
              <MetricCard label="Quality" value={pct(toNum(overall.quality_pct))} hint="Accepted / ordered" tone="emerald" />
              <MetricCard label="Watchlist" value={number(toNum(counts.watchlist))} hint="On-time/quality below watch threshold" tone="amber" />
              <MetricCard label="Critical" value={number(toNum(counts.critical))} hint="Critical supplier count" tone="rose" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <BarPanel title="Material criticality" subtitle="Products using material × spend." rows={materials.slice(0, 10)} xKey="Material_ID" yKeys={["criticality_score", "spend_egp"]} layout="vertical" />
              <BarPanel title="Supplier readiness risk" subtitle="High spend suppliers with lower on-time rates." rows={matrix} xKey="supplier_name" yKeys={["spend_egp", "on_time_pct"]} layout="vertical" />
            </div>

            <SectionCard title="Supplier action matrix" subtitle="Recommended treatment by reliability and spend quadrant.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {matrix.slice(0, 8).map((row, index) => (
                  <div key={index} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="text-sm font-black text-white">{row.supplier_name}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-cyan-300">{row.quadrant}</p>
                    <p className="mt-3 text-sm text-slate-400">{row.recommended_action}</p>
                    <p className="mt-3 text-xs text-slate-500">Spend: <span className="font-bold text-slate-200">{egp(toNum(row.spend_egp))}</span></p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <DataTable title="Supplier-material performance" rows={performance} filename="supplier_material_performance.csv" columns={["Supplier_ID", "Supplier_Name", "Material_Name", "lead_time_days", "on_time_pct", "acceptance_pct", "spend_egp"]} />
            <DataTable title="Shortage risk materials" rows={risk} filename="shortage_risk_materials.csv" columns={["Supplier_Name", "Material_Name", "on_time_pct", "acceptance_pct", "spend_egp"]} />
            <DataTable title="Unit-cost trend by material" rows={toRows(data.unit_cost_trend_by_material)} filename="unit_cost_trend_by_material.csv" columns={["Material_ID", "first_unit_cost", "last_unit_cost", "unit_cost_change_pct"]} />
            <MethodNote sources={data.sources} formulas={data.formulas} />
          </>
        );
      }}
    </StandardPage>
  );
}
