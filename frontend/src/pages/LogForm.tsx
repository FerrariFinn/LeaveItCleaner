import { useState, type FormEvent } from "react";
import { api, type LoggedSession } from "../api";

function remembered(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export default function LogForm() {
  const [location, setLocation] = useState(() => remembered("lic.location"));
  const [nickname, setNickname] = useState(() => remembered("lic.nickname"));
  const [items, setItems] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LoggedSession | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const logged = await api.logSession({ location, items, nickname });
      remember("lic.location", location);
      remember("lic.nickname", nickname);
      setResult(logged);
      setItems("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <section className="card thanks">
        <h2>Thank you! 🌊</h2>
        <p>
          You took <strong>{result.total}</strong> {result.total === 1 ? "piece" : "pieces"} of litter off{" "}
          <strong>{result.location}</strong>. The tide can't take them back out.
        </p>
        <ul className="items">
          {result.items.map((i, idx) => (
            <li key={idx}>
              <span className="count">{i.count}×</span> {i.label}
              <span className="muted"> — {i.description}</span>
            </li>
          ))}
        </ul>
        <button onClick={() => setResult(null)}>Log another session</button>
      </section>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <p className="intro">10 minutes on the sand, 30 seconds here. Tell us what you picked up.</p>

      <label>
        Where were you?
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Praia do Amado"
          required
        />
      </label>

      <label>
        What did you find, and how much?
        <textarea
          value={items}
          onChange={(e) => setItems(e.target.value)}
          placeholder="e.g. 3 plastic bottles, a tangle of blue rope, loads of bottle caps"
          rows={4}
          required
        />
      </label>

      <label>
        Nickname <span className="muted">(optional)</span>
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. wave_finn" />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={busy}>
        {busy ? "Sorting your haul…" : "Log my cleanup"}
      </button>
    </form>
  );
}
