"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  Bell,
  BookOpen,
  Brain,
  ClipboardCheck,
  Database,
  Factory,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  Map,
  Megaphone,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { DecisionsResponse, Role } from "@/lib/types";
import { egp, priorityClass } from "@/lib/format";

export const ROLE_STORAGE_KEY = "elsharnouby-ops-role";

const PRODUCT_NAME = "El-Sharnouby Ops Intelligence";
const PRODUCT_SUBTITLE = "Executive Operations AI";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  helper?: string;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
{
  label: "Command",
  items: [
      {
      label: "Command Center",
      href: "/",
      icon: <LayoutDashboard className="h-4 w-4" />,
      helper: "Revenue, margin, channels, urgent actions",
      },
      {
      label: "AI Analyst",
      href: "/ai-analyst",
      icon: <Sparkles className="h-4 w-4" />,
      helper: "Ask, investigate, and prioritize",
      },
      {
      label: "Executive Story",
      href: "/story",
      icon: <BookOpen className="h-4 w-4" />,
      helper: "Seven-step CEO narrative",
      },
    ],
  },

  {
    label: "Workspaces",
    items: [
      { label: "Decision Execution Room", href: "/war-room", icon: <Workflow className="h-4 w-4" />, helper: "Approve, defer, and start actions" },
      { label: "Action Center", href: "/action-center", icon: <ClipboardCheck className="h-4 w-4" />, helper: "Department ownership" },
      { label: "Time Machine", href: "/audit", icon: <Activity className="h-4 w-4" />, helper: "Audit trail" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Channels", href: "/channels", icon: <ShoppingBag className="h-4 w-4" />, helper: "Retail, online, wholesale mix" },
      { label: "Customers", href: "/customers", icon: <Users className="h-4 w-4" />, helper: "RFM and retention" },
      { label: "Inventory & Forecast", href: "/inventory", icon: <PackageSearch className="h-4 w-4" />, helper: "ABC/XYZ, turns, replenishment" },
      { label: "Marketing", href: "/marketing", icon: <Megaphone className="h-4 w-4" />, helper: "ROAS, spend, funnel" },
      { label: "Operations", href: "/operations", icon: <Factory className="h-4 w-4" />, helper: "Production, printing, downtime" },
      { label: "Quality & Returns", href: "/quality", icon: <HeartPulse className="h-4 w-4" />, helper: "QC loss and returns" },
      { label: "Supply Chain", href: "/supply", icon: <Truck className="h-4 w-4" />, helper: "Supplier readiness" },
      { label: "Profit Leakage", href: "/profit-leakage", icon: <LineChart className="h-4 w-4" />, helper: "Conservative vs inclusive leakage" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Data Health", href: "/data-health", icon: <ShieldCheck className="h-4 w-4" />, helper: "Reconciliation checks" },
      { label: "Method & Coverage", href: "/method", icon: <Database className="h-4 w-4" />, helper: "Formulas and sources" },
    ],
  },
];

const flatNav = navGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function RoleSwitcher() {
  const { data } = useApi<{ roles: Role[] }>("/api/roles");
  const [role, setRole] = useState("CEO");

  useEffect(() => {
    const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
    if (stored) setRole(stored);
  }, []);

  function updateRole(nextRole: string) {
    setRole(nextRole);
    window.localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
    window.dispatchEvent(new CustomEvent("sharnouby-role-change", { detail: nextRole }));
  }

  return (
    <select
      value={role}
      onChange={(event) => updateRole(event.target.value)}
      className="h-9 max-w-44 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs font-bold text-slate-200 shadow-xl outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
      aria-label="Acting role"
    >
      {(data?.roles ?? [{ role: "CEO", departments: ["*"] }]).map((item) => (
        <option key={item.role} value={item.role}>
          {item.role}
        </option>
      ))}
    </select>
  );
}

function BellDropdown() {
  const { data } = useApi<DecisionsResponse>("/api/decisions");
  const [open, setOpen] = useState(false);
  const awaiting = (data?.decisions ?? []).filter(
    (d) => d.status === "awaiting" && ["critical", "high"].includes(d.priority)
  );
  const items = awaiting.slice(0, 8);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
        aria-label="Open notification dropdown"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
          {awaiting.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-96 rounded-2xl border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-black/50">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
            <p className="text-sm font-black text-white">Critical / High awaiting</p>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-96 space-y-2 overflow-auto">
            {items.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                No critical or high awaiting decisions.
              </p>
            ) : (
              items.map((decision) => (
                <Link
                  href={`/war-room?decision=${decision.decision_id}`}
                  key={decision.decision_id}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:border-cyan-400/30 hover:bg-cyan-400/10"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${priorityClass(decision.priority)}`}>
                      {decision.priority}
                    </span>
                    <span className="text-xs font-bold text-emerald-200">
                      {egp(decision.expected_impact.estimated_value_egp)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-slate-100">{decision.title}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CommandSearch() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? flatNav.filter((item) => `${item.label} ${item.helper ?? ""} ${item.group}`.toLowerCase().includes(q))
      : flatNav.slice(0, 8);
    return rows.slice(0, 8);
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(item: (typeof flatNav)[number]) {
    setOpen(false);
    setQuery("");
    router.push(item.href);
  }

  return (
    <div className="relative hidden w-full max-w-xl md:block">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 focus-within:border-cyan-400/50 focus-within:ring-2 focus-within:ring-cyan-400/10">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            }
            if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              go(results[activeIndex]);
            }
          }}
          placeholder="Search pages or jump to a module..."
          className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
        />
        <kbd className="rounded-md border border-white/10 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-500">Ctrl K</kbd>
      </div>
      {open && (
        <div className="absolute z-50 mt-3 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-black/50">
          {results.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-500">No matching modules.</div>
          ) : (
            results.map((item, index) => (
              <button
                key={item.href}
                onMouseDown={(event) => { event.preventDefault(); go(item); }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${index === activeIndex ? "bg-cyan-400/10 text-cyan-100" : "text-slate-300 hover:bg-white/[0.04]"}`}
              >
                <span className="text-cyan-300">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{item.label}</span>
                  <span className="block truncate text-xs text-slate-500">{item.group} · {item.helper}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  question,
  insight,
  children,
}: {
  title: string;
  question: string;
  insight?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            Ops Intelligence Layer
          </p>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{question}</p>
        </div>
        {children}
      </div>
      {insight && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50 shadow-xl shadow-cyan-950/20">
          <span className="font-black text-cyan-200">Insight: </span>
          {insight}
        </div>
      )}
    </div>
  );
}

export function PageFooter({ source }: { source: string }) {
  return (
    <footer className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs text-slate-500">
      Source: {source} | formulas in /method | values are computed from the provided modeled operational data
    </footer>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-8 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-slate-600" />
      <p className="mt-3 font-bold text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-red-100">
      <p className="font-black">API error</p>
      <p className="mt-1 text-sm text-red-100/80">{message}</p>
      <button onClick={retry} className="mt-4 rounded-xl bg-red-200 px-4 py-2 text-sm font-black text-red-950">
        Retry
      </button>
    </div>
  );
}

export function SkeletonBlock({ className = "h-32" }: { className?: string }) {
  return <div className={`${className} animate-pulse rounded-3xl border border-white/10 bg-white/[0.035]`} />;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const currentTitle = useMemo(() => {
    for (const group of navGroups) {
      const item = group.items.find((nav) => isActive(pathname, nav.href));
      if (item) return item.label;
    }
    return "Command Center";
  }, [pathname]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/3 top-0 h-[520px] w-[760px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[520px] w-[660px] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/90 px-4 py-5 backdrop-blur-xl lg:block">
          <Link href="/" className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white">{PRODUCT_NAME}</p>
              <p className="text-xs text-slate-500">{PRODUCT_SUBTITLE}</p>
            </div>
          </Link>

          <nav className="space-y-7">
            {navGroups.map((group) => (
              <section key={group.label}>
                <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-400/25 ${
                          active
                            ? "border border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
                            : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <span className={active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <div className="flex items-center gap-2 text-cyan-100">
              <Gauge className="h-4 w-4" />
              <p className="text-sm font-bold">Modeled Data</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-cyan-100/70">
              Values are computed from the provided operational CSVs. Formula notes are exposed in /api/method.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
              <div className="hidden items-center gap-2 text-sm text-slate-500 md:flex">
                <span>Command</span>
                <span>/</span>
                <span className="font-semibold text-slate-300">{currentTitle}</span>
              </div>

              <CommandSearch />

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200 md:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/40" />
                  Ops AI Online
                </div>
                <BellDropdown />
                <RoleSwitcher />
              </div>
            </div>
          </header>

          <section className="min-w-0 px-4 py-6 md:px-6">{children}</section>
        </div>
      </div>
    </main>
  );
}
