import { useEffect, useState } from "react";
import { api, type Stats as StatsData } from "../api";

function Progress({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="metric">
      <div className="metric-head">
        <span>{label}</span>
        <strong>
          {value} / {target}
        </strong>
      </div>
      <div className="bar">
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.stats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="muted">Loading…</p>;

  const maxCat = Math.max(1, ...stats.byCategory.map((c) => c.count));

  return (
    <>
      <section className="card">
        <h2>Targets (end of Feb 2027)</h2>
        <Progress label="Sessions by other surfers" value={stats.othersSessions} target={stats.targets.othersSessions} />
        <Progress label="Items collected" value={stats.itemCount} target={stats.targets.itemCount} />
        <Progress label="Different surfers" value={stats.surferCount} target={stats.targets.surferCount} />
        <p className="muted">{stats.sessionCount} sessions logged in total.</p>
      </section>

      <section className="card">
        <h2>What we found</h2>
        {stats.byCategory.length === 0 && <p className="muted">Nothing logged yet.</p>}
        {stats.byCategory.map((c) => (
          <div key={c.id} className="row-bar">
            <span className="row-label">{c.label}</span>
            <div className="bar small">
              <div style={{ width: `${(c.count / maxCat) * 100}%` }} />
            </div>
            <span className="row-value">{c.count}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Spots</h2>
        <table>
          <thead>
            <tr>
              <th>Spot</th>
              <th>Sessions</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {stats.byLocation.map((l) => (
              <tr key={l.location}>
                <td>{l.location}</td>
                <td>{l.sessions}</td>
                <td>{l.items}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Recent sessions</h2>
        <ul className="items">
          {stats.recent.map((s) => (
            <li key={s.id}>
              <span className="count">{s.total}</span> at {s.location}
              <span className="muted">
                {" "}
                — {s.nickname || "anonymous"}, {new Date(s.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
