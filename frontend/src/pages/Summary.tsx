import { useEffect, useState } from "react";
import { api, type Summary as SummaryData } from "../api";

const currentMonth = () => new Date().toISOString().slice(0, 7);

function SummaryCard({ summary }: { summary: SummaryData }) {
  return (
    <article className="card summary">
      <div className="muted">
        {new Date(summary.month).toLocaleDateString(undefined, { month: "long", year: "numeric" })} ·{" "}
        {summary.session_count} sessions · {summary.item_count} items · {summary.model}
      </div>
      <p>{summary.content}</p>
    </article>
  );
}

export default function Summary() {
  const [month, setMonth] = useState(currentMonth);
  const [summaries, setSummaries] = useState<SummaryData[]>([]);
  const [shown, setShown] = useState<string | null>(null); // month whose summary is opened
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .summaries()
      .then(setSummaries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const existing = summaries.find((s) => s.month.slice(0, 7) === month);

  async function onClick() {
    setError("");
    if (existing) return setShown(month);

    setBusy(true);
    try {
      // The backend returns the stored summary if someone generated it in the meantime.
      const summary = await api.generateSummary(month);
      setSummaries((prev) => [summary, ...prev.filter((s) => s.id !== summary.id)]);
      setShown(month);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const label = busy ? "Writing…" : existing ? "Show summary" : "Generate summary";

  return (
    <>
      <section className="card">
        <h2>Monthly “What we found”</h2>
        <div className="inline">
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setError("");
            }}
          />
          <button onClick={onClick} disabled={busy || loading}>
            {label}
          </button>
        </div>
        {!existing && !loading && (
          <p className="muted">No summary for this month yet. Generating it saves it for everyone.</p>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      {existing && shown === month && <SummaryCard summary={existing} />}

      {summaries.length > 0 && <h2 className="section-title">All summaries</h2>}
      {summaries
        .filter((s) => !(shown === month && s.id === existing?.id))
        .map((s) => (
          <SummaryCard key={s.id} summary={s} />
        ))}
    </>
  );
}
