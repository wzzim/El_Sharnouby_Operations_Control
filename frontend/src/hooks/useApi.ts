"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export function useApi<T>(path: string, enabled = true, timeoutMs = 12000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const retry = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}${path}`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `GET ${path} failed with ${res.status}`);
        }
        return res.json() as Promise<T>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err?.name === "AbortError"
            ? `GET ${path} timed out after ${Math.round(timeoutMs / 1000)}s. Make sure FastAPI is running and the endpoint responds.`
            : err instanceof Error ? err.message : "Unknown API error";
          setError(message);
        }
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [path, enabled, version, timeoutMs]);

  return { data, loading, error, retry };
}
