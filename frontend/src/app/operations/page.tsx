"use client";

import { useApi } from "@/hooks/useApi";
import { number, pct } from "@/lib/format";
import { BarPanel, DataTable, MethodNote, MetricCard, StandardPage, toNum, toRows } from "@/components/Stage4Panels";

export default function OperationsPage() {
  const api = useApi<Record<string, any>>("/api/operations");

  return (
    <StandardPage title="Operations" question="Where do production, printing, and downtime create avoidable loss?" source="/api/operations" api={api}>
      {(data) => {
        const lines = toRows(data.production_by_line);
        const machines = toRows(data.printing_by_machine);
        const downtime = toRows(data.downtime_by_machine_reason);
        const priorities = toRows(data.maintenance_priorities);
        const avgAttainment = lines.reduce((sum, row) => sum + toNum(row.attainment_pct), 0) / Math.max(lines.length, 1);
        const avgYield = machines.reduce((sum, row) => sum + toNum(row.yield_pct), 0) / Math.max(machines.length, 1);
        return (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Avg attainment" value={pct(avgAttainment)} hint="Produced / planned" tone="emerald" />
              <MetricCard label="Avg print yield" value={pct(avgYield)} hint="Good / printed" tone="cyan" />
              <MetricCard label="Production lines" value={number(lines.length)} hint="Line-level analysis" tone="violet" />
              <MetricCard label="Machines" value={number(machines.length)} hint="Printing machine rows" tone="amber" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <BarPanel title="Production attainment by line" rows={lines} xKey="Line_ID" yKeys={["attainment_pct", "reject_rate_pct"]} />
              <BarPanel title="Printing yield by machine" rows={machines} xKey="Machine_ID" yKeys={["yield_pct", "reject_rate_pct"]} />
            </div>

            <DataTable title="Maintenance priorities" rows={priorities} filename="maintenance_priorities.csv" columns={["Machine_ID", "maintenance_priority_score", "unplanned_hours", "reject_rate_pct", "rework_reprint_cost_egp"]} />
            <DataTable title="Production by line" rows={lines} filename="production_by_line.csv" columns={["Line_ID", "planned_qty", "produced_qty", "good_qty", "rejected_qty", "attainment_pct", "reject_rate_pct", "avg_delay_days", "overtime_hours"]} />
            <DataTable title="Unplanned downtime by reason" rows={downtime} filename="downtime_by_reason.csv" columns={["Machine_ID", "Reason", "unplanned_hours"]} />
            <MethodNote sources={data.sources} formulas={data.formulas} />
          </>
        );
      }}
    </StandardPage>
  );
}
