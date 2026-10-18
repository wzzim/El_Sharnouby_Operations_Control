"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Brain,
  CheckCircle2,
  CircleDot,
  Lightbulb,
  Loader2,
  Lock,
  Search,
  Send,
  ShieldCheck,
  Target,
  User,
  Zap,
} 

from "lucide-react";

import AppShell, { PageHeader } from "@/components/AppShell";
import { apiGet, apiPost } from "@/lib/api";

type Mode = "chat" | "investigate" | "advisor";

type AIStatus = {
  online: boolean;
  provider: string;
  model: string;
  model_available: boolean;
  privacy: string;
  can_modify_decisions: boolean;
};

type AIResponse = {
  answer: string;
  model: string;
  provider: string;
  privacy: string;
  sources: string[];
  can_modify_decisions: boolean;
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

const MODES = [
  {
    id: "chat" as const,
    label: "Ask Analyst",
    icon: Brain,
    description: "Ask questions about company performance.",
  },
  {
    id: "investigate" as const,
    label: "Root Cause",
    icon: Search,
    description: "Investigate operational problems across functions.",
  },
  {
    id: "advisor" as const,
    label: "Action Advisor",
    icon: Target,
    description: "Prioritize existing management actions.",
  },
];

const SUGGESTIONS: Record<Mode, string[]> = {
  chat: [
    "What is our gross margin and what does it mean?",
    "What is the biggest profit leakage problem?",
    "What are our biggest inventory risks?",
    "How is supplier performance affecting the business?",
  ],
  investigate: [
    "Supplier delivery performance is creating operational risk",
    "We have too much capital trapped in inventory",
    "Stockout risk is affecting product availability",
    "Production and quality losses are hurting profitability",
  ],
  advisor: [
    "What should management prioritize next?",
    "Which high-impact action has the strongest evidence?",
    "What should the Procurement Manager focus on first?",
    "Compare our most urgent operational decisions",
  ],
};

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    overview: "Financial Overview",
    decision_engine: "Decision Engine",
    profit_leakage: "Profit Leakage",
    inventory: "Inventory",
    forecast: "Forecast",
    supply: "Supply Chain",
    supply_readiness: "Supply Readiness",
    operations: "Operations",
    quality: "Quality",
    channels: "Channels",
    customers: "Customers",
    marketing: "Marketing",
  };

  return labels[source] ?? source.replaceAll("_", " ");
}
function renderAIText(text: string) {
  return text.split("\n").map((line, lineIndex) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);

    return (
      <div key={lineIndex} className={line.trim() === "" ? "h-3" : ""}>
        {parts.map((part, partIndex) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong
                key={partIndex}
                className="font-black text-white"
              >
                {part.slice(2, -2)}
              </strong>
            );
          }

          return <span key={partIndex}>{part}</span>;
        })}
      </div>
    );
  });
}

export default function AIAnalystPage() {
  const [mode, setMode] = useState<Mode>("chat");
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chats, setChats] = useState<Record<Mode, Message[]>>({
    chat: [],
    investigate: [],
    advisor: [],
  });
  const messages = chats[mode];
  const bottomRef = useRef<HTMLDivElement | null>(null);

  function setMessages(
    update: Message[] | ((current: Message[]) => Message[])
  ) {
    setChats((current) => ({
      ...current,
      [mode]:
        typeof update === "function"
          ? update(current[mode])
          : update,
    }));
  }

  useEffect(() => {
    apiGet<AIStatus>("/api/ai/status")
      .then(setStatus)
      .catch(() => {
        setStatus({
          online: false,
          provider: "Ollama",
          model: "qwen2.5:3b",
          model_available: false,
          privacy: "local",
          can_modify_decisions: false,
        });
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function switchMode(next: Mode) {
    setMode(next);
    setInput("");
    setError("");
  }

  async function submit(text?: string) {
    const question = (text ?? input).trim();

    if (!question || loading) return;

    setError("");
    setInput("");

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: question,
    };

    const history = messages.slice(-6).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((current) => [...current, userMessage]);
    setLoading(true);

    try {
      let result: AIResponse;

      if (mode === "chat") {
        result = await apiPost<AIResponse>("/api/ai/chat", {
          question,
          history,
        });
      } else if (mode === "investigate") {
        result = await apiPost<AIResponse>("/api/ai/root-cause", {
          problem: question,
          history,
        });
      } else {
        result = await apiPost<AIResponse>("/api/ai/action-advisor", {
          focus: question,
          history,
        });
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: result.answer,
          sources: result.sources,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The local AI analyst could not answer."
      );
    } finally {
      setLoading(false);
    }
  }

  const activeMode = MODES.find((item) => item.id === mode)!;
  const ActiveModeIcon = activeMode.icon;

  return (
    <AppShell>
      <PageHeader
        title="AI Analyst"
        question="A private local intelligence layer grounded in the same verified operational metrics used across Operations Control."
        insight="The AI explains and investigates backend-verified evidence. It cannot approve, defer, start, or execute management decisions."
      >
        <div
          className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black ${
            status?.online && status?.model_available
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
              : "border-red-400/20 bg-red-400/10 text-red-200"
          }`}
        >
          <CircleDot className="h-4 w-4" />
          {status?.online && status?.model_available
            ? "Local AI Online"
            : "Local AI Offline"}
        </div>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-3">
            <p className="px-2 pb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
              Analyst Modes
            </p>

            <div className="space-y-2">
              {MODES.map((item) => {
                const Icon = item.icon;
                const active = mode === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => switchMode(item.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-cyan-400/30 bg-cyan-400/10"
                        : "border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`h-4 w-4 ${
                          active ? "text-cyan-300" : "text-slate-500"
                        }`}
                      />
                      <span
                        className={`text-sm font-black ${
                          active ? "text-white" : "text-slate-300"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
            <div className="flex items-center gap-2 text-emerald-200">
              <Lock className="h-4 w-4" />
              <p className="text-xs font-black uppercase tracking-wider">
                Private AI
              </p>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-400">
              Runs locally through Ollama. Business context is processed on this
              machine rather than sent to an external AI API.
            </p>

            <div className="mt-4 space-y-2 border-t border-emerald-400/10 pt-3 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Model</span>
                <span className="font-bold text-slate-200">
                  {status?.model ?? "qwen2.5:3b"}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Provider</span>
                <span className="font-bold text-slate-200">
                  {status?.provider ?? "Ollama"}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Decision access</span>
                <span className="font-bold text-emerald-200">Read only</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[680px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <ActiveModeIcon className="h-5 w-5" />
              </div>

              <div>
                <p className="font-black text-white">{activeMode.label}</p>
                <p className="text-xs text-slate-500">
                  Grounded in Operations Control evidence
                </p>
              </div>
                        </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Verified context only
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            {messages.length === 0 ? (
              <div className="flex min-h-[430px] flex-col items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-xl shadow-cyan-950/20">
                  {mode === "chat" ? (
                    <Brain className="h-7 w-7" />
                  ) : mode === "investigate" ? (
                    <Search className="h-7 w-7" />
                  ) : (
                    <Target className="h-7 w-7" />
                  )}
                </div>

                <h2 className="mt-5 text-xl font-black text-white">
                  {mode === "chat"
                    ? "Ask the business"
                    : mode === "investigate"
                      ? "Investigate a problem"
                      : "Prioritize the next move"}
                </h2>

                <p className="mt-2 max-w-lg text-center text-sm leading-6 text-slate-500">
                  {mode === "chat"
                    ? "Ask a question and the local analyst will answer using verified Operations Control metrics."
                    : mode === "investigate"
                      ? "Describe an operational problem and the analyst will look across relevant evidence for likely drivers."
                      : "Ask the advisor to compare existing management decisions using impact, confidence, evidence, owner and urgency."}
                </p>

                <div className="mt-8 grid w-full max-w-3xl gap-3 md:grid-cols-2">
                  {SUGGESTIONS[mode].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => submit(suggestion)}
                      disabled={loading}
                      className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.07] disabled:opacity-50"
                    >
                      <div className="flex items-start gap-3">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        <span className="text-sm font-semibold leading-6 text-slate-300 group-hover:text-white">
                          {suggestion}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-3xl border p-4 ${
                        message.role === "user"
                          ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-50"
                          : "border-white/10 bg-white/[0.035] text-slate-200"
                      }`}
                    >
                    <div className="text-sm leading-7">
                        {renderAIText(message.content)}
                    </div>
                      {message.role === "assistant" &&
                        message.sources &&
                        message.sources.length > 0 && (
                          <div className="mt-4 border-t border-white/10 pt-3">
                            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                              <Activity className="h-3 w-3" />
                              Evidence
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {message.sources.map((source) => (
                                <span
                                  key={source}
                                  className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2.5 py-1 text-[11px] font-bold text-emerald-200"
                                >
                                  {sourceLabel(source)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>

                    {message.role === "user" && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                      <Bot className="h-4 w-4" />
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                        <div>
                          <p className="text-sm font-bold text-slate-200">
                            Analyzing verified evidence...
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Running locally with {status?.model ?? "Qwen"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {error && (
            <div className="mx-5 mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="border-t border-white/10 bg-slate-950/90 p-4">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2 focus-within:border-cyan-400/40 focus-within:ring-2 focus-within:ring-cyan-400/10">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  placeholder={
                    mode === "chat"
                      ? "Ask about performance, inventory, suppliers, leakage..."
                      : mode === "investigate"
                        ? "Describe the business problem to investigate..."
                        : "Ask what management should prioritize..."
                  }
                  className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-5 text-white outline-none placeholder:text-slate-600"
                />

                <button
                  onClick={() => submit()}
                  disabled={!input.trim() || loading}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Send to AI Analyst"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-slate-600">
                <span>
                  Enter to send · Shift + Enter for new line
                </span>

                <span className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Local inference · Read-only business access
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex items-center gap-2 text-cyan-300">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-xs font-black uppercase tracking-wider">
            Grounded
          </p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Business numbers come from the existing analytics and decision
          engines rather than from the language model.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex items-center gap-2 text-violet-300">
          <Zap className="h-4 w-4" />
          <p className="text-xs font-black uppercase tracking-wider">
            Explainable
          </p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Responses show which Operations Control modules supplied the
          evidence.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex items-center gap-2 text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          <p className="text-xs font-black uppercase tracking-wider">
            Human controlled
          </p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          AI can analyze and advise, but decision transitions remain inside
          the existing human approval workflow.
        </p>
      </div>
    </div>
  </AppShell>
);
}