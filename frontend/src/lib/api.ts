import type { BoardStatus } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `GET ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `POST ${path} failed with ${res.status}`;
    try {
      const json = await res.json();
      message = json.detail || JSON.stringify(json);
    } catch {
      message = await res.text();
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function transitionDecision(decisionId: string, status: BoardStatus, role: string, note = "") {
  return apiPost<{ ok: boolean; decision_id: string; status: BoardStatus }>(
    `/api/decisions/${decisionId}/transition`,
    { status, role, note }
  );
}
