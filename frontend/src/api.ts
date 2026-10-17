const BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export type LoggedSession = {
  id: string;
  location: string;
  total: number;
  items: { category_id: string; label: string; count: number; description: string }[];
};

export type Stats = {
  sessionCount: number;
  othersSessions: number;
  itemCount: number;
  surferCount: number;
  targets: { othersSessions: number; itemCount: number; surferCount: number };
  byCategory: { id: string; label: string; count: number }[];
  byLocation: { location: string; sessions: number; items: number }[];
  recent: { id: string; created_at: string; location: string; nickname: string | null; total: number }[];
};

export type Summary = {
  id: number;
  month: string;
  content: string;
  model: string;
  session_count: number;
  item_count: number;
  created_at: string;
};

export const api = {
  logSession: (data: { location: string; items: string; nickname: string }) =>
    request<LoggedSession>("/api/sessions", { method: "POST", body: JSON.stringify(data) }),
  stats: () => request<Stats>("/api/stats"),
  summaries: () => request<Summary[]>("/api/summaries"),
  generateSummary: (month: string) =>
    request<Summary>("/api/summaries", { method: "POST", body: JSON.stringify({ month }) }),
};
