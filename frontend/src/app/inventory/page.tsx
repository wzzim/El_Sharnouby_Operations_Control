"use client";

import { useApi } from "@/hooks/useApi";
import { egp, number } from "@/lib/format";
import { BarPanel, DataTable, MethodNote, MetricCard, SectionCard, StandardPage, toNum, toRows } from "@/components/Stage4Panels";

export default function InventoryPage() {
  const api = useApi<Record<string, any>>("/api/inventory");
  const forecastApi = useApi<Record<string, any>>("/api/forecast");

  return (
    <StandardPage title="Inventory & Forecast" question="Where are stock, capital, and future demand misaligned?" source="/api/inventory, /api/forecast" api={api}>
      {(data) => {
        const forecast = forecastApi.data ?? {};
        const matrix = toRows(data.abc_xyz_matrix);
        const overstock = toRows(data.overstock_list);
        const stockout = toRows(data.stockout_list);
        const familyForecast = toRows(forecast.family_forecast);
        const topForecast = toRows(forecast.top20_products);
        return (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Stock turns" value={`${number(toNum(data.stock_turns), 2)}x`} hint="Trailing 12m COGS / inventory value" tone="emerald" />
              <MetricCard label="Overstock rows" value={number(overstock.length)} hint="Highest trapped capital items" tone="amber" />
              <MetricCard label="Stockout risks" value={number(stockout.length)} hint="Lowest days-of-cover rows" tone="rose" />
              <MetricCard label="Forecast products" value={number(topForecast.length)} hint="Top demand products forecasted" tone="cyan" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <BarPanel title="ABC / XYZ revenue matrix" subtitle="Revenue by inventory class." rows={matrix} xKey="abc_xyz" yKeys={["revenue_egp"]} />
              <BarPanel title="Family forecast" subtitle="30/60/90 day demand by family." rows={familyForecast} xKey="product_family" yKeys={["forecast_30d_units", "forecast_60d_units", "forecast_90d_units"]} layout="vertical" />
            </div>

            <SectionCard title="Forecast honesty" subtitle={String(forecast.insight ?? "Forecast endpoint not loaded yet.")}>
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Method" value="Seasonal naive" hint="Downgrades to baseline if WAPE loses" tone="violet" />
                <MetricCard label="Backtest" value="Last 3 months" hint="WAPE shown per product" tone="cyan" />
                <MetricCard label="Replenishment" value="Lead + 30 days" hint="Forecast demand minus stock" tone="emerald" />
              </div>
            </SectionCard>

            <DataTable title="Overstock list" rows={overstock} filename="overstock_list.csv" columns={["Product_ID", "Product_Name", "Location_Name", "current_stock", "days_of_cover", "trapped_capital_egp"]} />
            <DataTable title="Stockout risk list" rows={stockout} filename="stockout_risk_list.csv" columns={["Product_ID", "Product_Name", "Location_Name", "current_stock", "days_of_cover", "reorder_point"]} />
            <DataTable title="Top 20 product forecasts" rows={topForecast} filename="top20_forecasts.csv" columns={["product_id", "product_name", "product_family", "forecast_30d_units", "forecast_60d_units", "forecast_90d_units", "wape_model_pct", "wape_baseline_pct", "method_used", "replenishment_qty"]} />
            <MethodNote sources={data.sources} formulas={[...(Array.isArray(data.formulas) ? data.formulas : []), ...(Array.isArray(forecast.formulas) ? forecast.formulas : [])]} />
          </>
        );
      }}
    </StandardPage>
  );
}
