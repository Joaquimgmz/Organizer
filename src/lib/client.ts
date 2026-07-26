"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Small data hook: fetches on mount and whenever `path` changes, exposes a
 * `reload()` for after mutations, and keeps the previous data visible while
 * refetching so the UI doesn't flash empty.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const latest = useRef(0);

  const load = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!path) {
        setData(null);
        setLoading(false);
        return;
      }

      const ticket = ++latest.current;
      if (!options?.quiet) setLoading(true);
      setError(null);

      try {
        const result = await api.get<T>(path);
        if (ticket === latest.current) setData(result);
      } catch (caught) {
        if (ticket === latest.current) {
          setError(caught instanceof Error ? caught.message : "Request failed");
        }
      } finally {
        if (ticket === latest.current) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    error,
    loading,
    reload: useCallback(() => load({ quiet: true }), [load]),
    setData,
  };
}
