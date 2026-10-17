# Leave it cleaner — prototype

Surfers scan a QR code after their session and describe in free text what they picked up. The backend uses Gemini to turn that text into categories and counts, stores it in Supabase, and later writes the monthly "What we found" summary.

```
frontend (React + Vite)  →  backend (Express + TS)  →  Supabase
                                   ↓
                       Gemini: 1) normalize logs  2) monthly summary
```

## Setup

1. **Database**: open the Supabase SQL editor and run [supabase/schema.sql](supabase/schema.sql). On a fresh project this is all you need; `002_*` and `003_*` are migrations for databases created with an earlier version of the schema.
2. **Config**: copy `backend/.env.example` to `backend/.env` and fill in your Supabase URL, your Supabase **secret** key, your Gemini key and `CORE_NICKNAMES` (you + your dad). Keys only live in `.env`, which is git-ignored.
3. **Run both apps** from the project root:
   ```bash
   npm install          # also installs backend/ and frontend/
   npm run dev          # API on :3001, web on http://localhost:5173 (+ a Network URL for your phone)
   ```
   The Vite dev server proxies `/api` to the backend. You can also run each app separately with `npm run dev` inside `backend/` or `frontend/`.

## Pages
- `/`: the log form (this is the URL the QR code points to)
- `/stats`: progress against the targets (40 sessions by others, 500 items, 15 surfers), plus a breakdown by category and by spot
- `/summary`: generate and read the monthly "What we found" summaries

## API
| Method | Path | |
|---|---|---|
| GET | `/api/categories` | item categories |
| POST | `/api/sessions` | `{ location, items, nickname? }`: normalizes with Gemini, then stores |
| GET | `/api/stats` | metrics |
| GET | `/api/summaries` | all summaries |
| POST | `/api/summaries` | `{ month: "2026-12" }`: generates and stores a summary |

## QR code
Deploy the frontend (or use the Network URL during testing) and turn that URL into a QR code with any free generator.

## Deploy (Railway)
One service runs everything: `npm run build` builds the frontend into `frontend/dist`, and `npm start` runs the Express API, which also serves that build. Railway picks up both scripts from the root `package.json`.

1. Create a service from this repo (root directory: the repo root).
2. Under **Variables**, add `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` and `CORE_NICKNAMES`. Don't set `PORT`; Railway sets it.
3. Under **Networking**, generate a public domain. That URL is the one for the QR code.

## Notes
- The raw free text is stored next to the normalized items (`sessions.items_raw`), so logs can be normalized again if the categories change.
- To change the categories, edit the `categories` table. The normalizer prompt is built from that table.
- Security: the browser never talks to Supabase. Only the backend does, using the secret key. RLS is enabled with no policies, so the publishable key can't read or write anything. The API itself has no auth (prototype): anyone with the app URL can log sessions and see the stats.
