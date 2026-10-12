"use client";

import { useApi } from "@/hooks/useApi";
import { egp, number } from "@/lib/format";
import { BarPanel, DataTable, MethodNote, MetricCard, StandardPage, toNum, toRows } from "@/components/Stage4Panels";

export default function QualityPage() {
  const api = useApi<Record<string, any>>("/api/quality");

  return (
    <StandardPage title="Quality & Returns" question="Which defects and returns are associated with the largest losses?" source="/api/quality" api={api}>
      {(data) => {
        const pareto = toRows(data.defect_pareto);
        const returns = toRows(data.quality_related_returns);
        const assoc = toRows(data.product_association_table);
        const actions = toRows(data.corrective_action_priorities);
        const topLoss = toNum(pareto[0]?.loss_egp);
        return (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Top defect loss" value={egp(topLoss)} hint="Largest defect cluster" tone="rose" />
              <MetricCard label="Defect clusters" value={number(pareto.length)} hint="Pareto rows" tone="amber" />
              <MetricCard label="Quality returns" value={number(returns.length)} hint="Return reason/product rows" tone="cyan" />
              <MetricCard label="Action priorities" value={number(actions.length)} hint="Corrective actions" tone="emerald" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <BarPanel title="Defect Pareto by loss" rows={pareto.slice(0, 10).map((row) => ({ ...row, cluster: `${row.Defect_Type} / ${row.Root_Cause}` }))} xKey="cluster" yKeys={["loss_egp"]} layout="vertical" />
              <BarPanel title="Quality-related returns" rows={returns.slice(0, 10).map((row) => ({ ...row, product: row.Product_Name }))} xKey="product" yKeys={["refund_egp", "returns"]} layout="vertical" />
            </div>

            <DataTable title="Defect Pareto" rows={pareto} filename="defect_pareto.csv" columns={["Defect_Type", "Root_Cause", "Stage", "loss_egp", "rejected_qty", "inspected_qty"]} />
            <DataTable title="QC + returns association" subtitle="Association only; this page does not claim defects caused returns." rows={assoc} filename="quality_return_association.csv" columns={["Product_ID", "Product_Name", "qc_reject_rate_pct", "return_rate_pct", "qc_loss_egp", "return_rows"]} />
            <DataTable title="Corrective action priorities" rows={actions} filename="corrective_actions.csv" columns={["Defect_Type", "Root_Cause", "Stage", "loss_egp", "recommended_action"]} />
            <MethodNote sources={data.sources} formulas={data.formulas} />
          </>
        );
      }}
    </StandardPage>
  );
}
