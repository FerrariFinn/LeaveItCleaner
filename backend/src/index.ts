import "dotenv/config";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { supabase, getCategories } from "./supabase";
import { normalizeLog, summarizeMonth, MODEL, type MonthData } from "./gemini";

const app = express();
app.use(cors());
app.use(express.json());

const CORE_NICKNAMES = (process.env.CORE_NICKNAMES ?? "")
  .split(",")
  .map((n) => n.trim().toLowerCase())
  .filter(Boolean);

type SessionRow = {
  id: string;
  created_at: string;
  location: string;
  nickname: string | null;
  items_raw: string;
  session_items: { category_id: string; count: number; description: string | null }[];
};

async function fetchSessions(from?: string, to?: string): Promise<SessionRow[]> {
  let query = supabase
    .from("sessions")
    .select("id, created_at, location, nickname, items_raw, session_items(category_id, count, description)")
    .order("created_at", { ascending: false });
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);
  const { data, error } = await query;
  if (error) throw error;
  return data as SessionRow[];
}

const total = (s: SessionRow) => s.session_items.reduce((sum, i) => sum + i.count, 0);

function aggregate(sessions: SessionRow[], labels: Map<string, string>) {
  const byCategory = new Map<string, number>();
  const byLocation = new Map<string, { sessions: number; items: number }>();
  const nicknames = new Set<string>();
  let itemCount = 0;
  let othersSessions = 0;

  for (const s of sessions) {
    const nick = s.nickname?.trim().toLowerCase();
    if (nick) nicknames.add(nick);
    if (!nick || !CORE_NICKNAMES.includes(nick)) othersSessions++;

    const loc = byLocation.get(s.location) ?? { sessions: 0, items: 0 };
    loc.sessions++;
    loc.items += total(s);
    byLocation.set(s.location, loc);

    for (const i of s.session_items) {
      byCategory.set(i.category_id, (byCategory.get(i.category_id) ?? 0) + i.count);
      itemCount += i.count;
    }
  }

  return {
    sessionCount: sessions.length,
    othersSessions,
    itemCount,
    surferCount: nicknames.size,
    byCategory: [...byCategory]
      .map(([id, count]) => ({ id, label: labels.get(id) ?? id, count }))
      .sort((a, b) => b.count - a.count),
    byLocation: [...byLocation]
      .map(([location, v]) => ({ location, ...v }))
      .sort((a, b) => b.items - a.items),
  };
}

app.get("/api/categories", async (_req, res, next) => {
  try {
    res.json(await getCategories());
  } catch (e) {
    next(e);
  }
});

app.post("/api/sessions", async (req, res, next) => {
  try {
    const { location, items, nickname } = req.body as { location?: string; items?: string; nickname?: string };
    if (!location?.trim() || !items?.trim()) {
      return res.status(400).json({ error: "Please fill in where you were and what you found." });
    }

    const categories = await getCategories();
    const normalized = await normalizeLog(location, items, categories);
    if (normalized.items.length === 0) {
      return res.status(422).json({ error: "We couldn't recognise any litter in that description. Try e.g. '3 bottles, some rope'." });
    }

    const { data: id, error } = await supabase.rpc("log_session", {
      p_location_raw: location.trim(),
      p_location: normalized.location,
      p_nickname: nickname ?? "",
      p_items_raw: items.trim(),
      p_items: normalized.items,
    });
    if (error) throw error;

    const labels = new Map(categories.map((c) => [c.id, c.label]));
    res.status(201).json({
      id,
      location: normalized.location,
      items: normalized.items.map((i) => ({ ...i, label: labels.get(i.category_id) })),
      total: normalized.items.reduce((sum, i) => sum + i.count, 0),
    });
  } catch (e) {
    next(e);
  }
});

app.get("/api/stats", async (_req, res, next) => {
  try {
    const [sessions, categories] = await Promise.all([fetchSessions(), getCategories()]);
    const labels = new Map(categories.map((c) => [c.id, c.label]));
    res.json({
      ...aggregate(sessions, labels),
      targets: { othersSessions: 40, itemCount: 500, surferCount: 15 },
      recent: sessions.slice(0, 10).map((s) => ({
        id: s.id,
        created_at: s.created_at,
        location: s.location,
        nickname: s.nickname,
        total: total(s),
      })),
    });
  } catch (e) {
    next(e);
  }
});

async function findSummary(month: string) {
  const { data, error } = await supabase.from("summaries").select("*").eq("month", `${month}-01`).maybeSingle();
  if (error) throw error;
  return data;
}

app.get("/api/summaries", async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from("summaries").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    next(e);
  }
});

app.post("/api/summaries", async (req, res, next) => {
  try {
    const { month } = req.body as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "month must look like 2026-12" });

    // A month is only summarized once: return the stored summary if there is one.
    const existing = await findSummary(month);
    if (existing) return res.json(existing);

    const [y, m] = month.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const to = new Date(Date.UTC(y, m, 1)).toISOString();

    const [sessions, categories] = await Promise.all([fetchSessions(from, to), getCategories()]);
    if (sessions.length === 0) return res.status(422).json({ error: `No sessions logged in ${month} yet.` });

    const stats = aggregate(sessions, new Map(categories.map((c) => [c.id, c.label])));
    const monthData: MonthData = {
      month,
      sessionCount: stats.sessionCount,
      itemCount: stats.itemCount,
      surferCount: stats.surferCount,
      byCategory: stats.byCategory.map(({ label, count }) => ({ label, count })),
      byLocation: stats.byLocation,
      notableItems: [...new Set(sessions.flatMap((s) => s.session_items.map((i) => i.description ?? "")))]
        .filter(Boolean)
        .slice(0, 30),
    };

    const content = await summarizeMonth(monthData);
    const { data, error } = await supabase
      .from("summaries")
      .insert({ month: `${month}-01`, content, model: MODEL, session_count: stats.sessionCount, item_count: stats.itemCount })
      .select()
      .single();
    // Someone else generated it at the same moment: the unique constraint kept theirs.
    if (error?.code === "23505") return res.json(await findSummary(month));
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

// In production the same server serves the built frontend; every non-API path falls back to the SPA.
const webDir = fileURLToPath(new URL("../../frontend/dist", import.meta.url));
app.use(express.static(webDir));
app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile("index.html", { root: webDir }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Something went wrong";
  res.status(500).json({ error: message });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`Leave it cleaner API on http://localhost:${port}`));
