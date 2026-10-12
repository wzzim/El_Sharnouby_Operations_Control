export function compactNumber(value: number | null | undefined, digits = 1) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-EG", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(n);
}

export function egp(value: number | null | undefined, compact = true) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "EGP 0";
  if (compact) return `EGP ${compactNumber(n, n >= 1_000_000 ? 1 : 0)}`;
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function pct(value: number | null | undefined, digits = 1) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(digits)}%`;
}

export function number(value: number | null | undefined, digits = 0) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-EG", {
    maximumFractionDigits: digits,
  }).format(n);
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function priorityClass(priority: string) {
  switch ((priority || "").toLowerCase()) {
    case "critical":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    case "high":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "medium":
      return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}

export function statusClass(status: string) {
  switch ((status || "").toLowerCase()) {
    case "awaiting":
      return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
    case "approved":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "in_progress":
      return "border-violet-400/30 bg-violet-500/10 text-violet-200";
    case "deferred":
      return "border-slate-400/30 bg-slate-500/10 text-slate-300";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}
