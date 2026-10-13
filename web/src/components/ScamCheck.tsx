import { useState } from "react";
import { api } from "../api";

type Result = Awaited<ReturnType<typeof api.scamCheck>>;
const LABEL = { safe: "✅ Looks safe", suspicious: "⚠️ Suspicious", scam: "🚨 Very likely a scam" } as const;

export function ScamCheck() {
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      setResult(await api.scamCheck(text, from));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scam">
      <p className="muted">Paste a text, email or invoice before you pay or reply.</p>
      <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Sender (email or phone), optional" maxLength={200} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="e.g. Your bank account is blocked, verify at…" maxLength={10000} />
      <button className="btn" onClick={check} disabled={busy || !text.trim()}>{busy ? "Checking…" : "Check it"}</button>
      {result && (
        <div className={`verdict v-${result.verdict}`}>
          <strong>{LABEL[result.verdict]}</strong> <span className="muted">risk {result.score}/100</span>
          <ul>{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <p>{result.advice}</p>
        </div>
      )}
    </div>
  );
}
