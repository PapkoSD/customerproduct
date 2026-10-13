import { useEffect, useState } from "react";
import type { Currency, ProposedAction } from "../../../shared/types";
import { money } from "../../../shared/format";
import { api } from "../api";

const CHANNEL_ICON = { email: "✉️", chat: "💬", phone: "📞", web: "🌐", bank: "🏦" } as const;

export function Inbox({ currency, onChange }: { currency: Currency; onChange: () => void }) {
  const [actions, setActions] = useState<ProposedAction[] | null>(null);
  const load = () => api.actions().then(setActions);
  useEffect(() => {
    load();
  }, []);

  if (!actions) return <div className="loading">Loading…</div>;
  const pending = actions.filter((a) => a.status === "pending");
  const past = actions.filter((a) => a.status !== "pending");
  const after = () => load().then(onChange);

  return (
    <main>
      <section className="hero small">
        <h1>Approvals</h1>
        <p className="hero-sub">Your agents prepared these. Read, edit if you like, then approve or say no. Nothing is sent before you approve.</p>
      </section>
      {pending.length === 0 && <p className="empty">Nothing waiting. Tap "Handle it" on any finding to get a draft.</p>}
      <div className="list">
        {pending.map((a) => <PendingAction key={a.id} action={a} currency={currency} onDone={after} />)}
      </div>
      {past.length > 0 && (
        <section>
          <h2>History</h2>
          <div className="list">
            {past.map((a) => (
              <article key={a.id} className={`finding done status-${a.status}`}>
                <div className="finding-main">
                  <span className="pill">{a.status === "done" ? "Approved" : "Declined"}</span>
                  <h3>{a.title}</h3>
                  {a.outcome && <p className="note">{a.outcome}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function PendingAction({ action: a, currency, onDone }: { action: ProposedAction; currency: Currency; onDone: () => void }) {
  const [draft, setDraft] = useState(a.draft);
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="finding action">
      <div className="finding-main">
        <span className="pill">{a.channel ? CHANNEL_ICON[a.channel] : "📝"} {a.kind.replace(/_/g, " ")}</span>
        <h3>{a.title}</h3>
        <p>{a.summary}{a.recipient ? ` To: ${a.recipient}.` : ""}</p>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.min(14, draft.split("\n").length + 1)} aria-label="Draft" />
        <div className="actions-row">
          <button className="btn" disabled={busy} onClick={() => act(() => api.approve(a.id, draft))}>Approve</button>
          <button className="btn ghost" disabled={busy} onClick={() => act(() => api.reject(a.id))}>No thanks</button>
        </div>
      </div>
      <div className="finding-side">
        {a.estimatedYearlySaving ? <span className="impact">+{money(a.estimatedYearlySaving, currency)}<small>/yr</small></span> : null}
        {a.estimatedOneOff ? <span className="impact">+{money(a.estimatedOneOff, currency)}</span> : null}
      </div>
    </article>
  );
}
