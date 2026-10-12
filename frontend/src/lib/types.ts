export type BoardStatus = "awaiting" | "deferred" | "approved" | "in_progress";

export type Role = {
  role: string;
  departments: string[];
};

export type MetricKV = {
  label: string;
  value: string | number;
};

export type Decision = {
  decision_id: string;
  rank: number;
  priority: "critical" | "high" | "medium" | string;
  category: string;
  department?: string;
  title: string;
  recommended_action: string;
  business_reason: string;
  expected_impact: {
    impact_type: string;
    estimated_value_egp: number;
    confidence: number;
  };
  evidence: {
    product_id: string;
    product_name: string;
    location: string;
    current_stock: number;
    days_of_cover: number;
    metrics?: MetricKV[];
  };
  suggested_owner: string;
  time_window: string;
  explain?: {
    formula?: string;
    inputs?: Record<string, unknown>;
    confidence_method?: string;
    assumptions?: string[];
  };
  status?: BoardStatus;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type Overview = {
  company: string;
  platform_name: string;
  generated_at: string;
  data_as_of?: string;
  using_mock_data: boolean;
  mocked_tables?: string[];
  kpis: {
    total_revenue_egp: number;
    gross_profit_egp: number;
    gross_margin_pct: number;
    dead_stock_trapped_capital_egp: number;
    stockout_risk_count: number;
    decision_count: number;
    total_leakage_egp?: number;
  };
  decisions_by_department?: Record<string, number>;
  executive_summary: string;
};

export type DecisionsResponse = {
  generated_at: string;
  data_as_of?: string;
  total_decisions: number;
  decisions: Decision[];
};

export type DashboardResponse = {
  insight: string;
  sources?: string[];
  formulas?: unknown[];
  monthly?: Array<Record<string, number | string>>;
  monthly_revenue?: Array<Record<string, number | string>>;
  revenue_vs_profit?: Array<Record<string, number | string>>;
  top_products?: Array<Record<string, number | string>>;
  channel_mix?: Array<Record<string, number | string>>;
  discount_bands?: Array<Record<string, number | string>>;
  top_actions?: Array<Record<string, number | string>>;
  [key: string]: unknown;
};

export type ChannelsResponse = {
  insight: string;
  channels?: Array<Record<string, number | string>>;
  channel_mix?: Array<Record<string, number | string>>;
  top_governorates?: Array<Record<string, number | string>>;
  scenario?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AuditEvent = {
  id?: number;
  ts: string;
  decision_id: string;
  title?: string;
  from_status?: string;
  to_status?: string;
  role?: string;
  note?: string;
};

export type DataHealth = {
  status: string;
  checks?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};
