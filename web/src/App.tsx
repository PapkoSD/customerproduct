import { useCallback, useEffect, useState } from "react";
import type { AgentId, Finding, Overview } from "../../shared/types";
import { money } from "../../shared/format";
import { api } from "./api";
import { AgentPage } from "./components/AgentPage";
import { Chat } from "./components/Chat";
import { FindingCard } from "./components/FindingCard";
import { Inbox } from "./components/Inbox";
import { ScamCheck } from "./components/ScamCheck";
import { CurrencyPicker, savedCurrency } from "./components/CurrencyPicker";

type View = { page: "home" } | { page: "inbox" } | { page: "agent"; id: AgentId };

export function App() {
  const [view, setView] = useState<View>({ page: "home" });
  const [overview, setOverview] = useState<Overview | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  /** Anything that changes findings or the inbox calls this to refresh the whole app. */
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Restore the currency the user picked last time (the server forgets on restart).
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (restored || !overview) return;
    setRestored(true);
    const saved = savedCurrency();
    if (saved && saved !== overview.profile.currency) api.setCurrency(saved).then(refresh).catch(() => {});
  }, [overview, restored, refresh]);

  useEffect(() => {
    Promise.all([api.overview(), api.findings()])
      .then(([o, f]) => {
        setOverview(o);
        setFindings(f);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [version]);

  const go = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  if (error) return <div className="shell"><div className="error">Couldn't reach Penny's server: {error}. Is <code>npm run dev</code> running?</div></div>;
  if (!overview) return <div className="shell"><div className="loading">Penny is looking through your money…</div></div>;

  const cur = overview.profile.currency;
  const impact = (f: Finding) => (f.yearlyImpact ?? 0) + (f.oneOffImpact ?? 0);
  const urgent = findings.filter((f) => f.severity === "danger");
  const top = findings.filter((f) => f.severity !== "danger").sort((a, b) => impact(b) - impact(a)).slice(0, 6);

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => go({ page: "home" })}>
          <span className="logo">🪙</span> Penny
        </button>
        <nav>
          <span className={`badge ${overview.mode}`} title={overview.mode === "claude" ? "Agents run on Claude" : "No API key: rule-based answers"}>
            {overview.mode === "claude" ? "AI on" : "Offline mode"} · sample data
          </span>
          <CurrencyPicker current={cur} pendingDrafts={overview.totals.pendingActions} onChanged={refresh} />
          <button className={`navbtn ${view.page === "inbox" ? "active" : ""}`} onClick={() => go({ page: "inbox" })}>
            Approvals {overview.totals.pendingActions > 0 && <span className="count">{overview.totals.pendingActions}</span>}
          </button>
        </nav>
      </header>

      {view.page === "home" && (
        <main>
          <section className="hero">
            <p className="eyebrow">Hi {overview.profile.name} 👋 Your agents found</p>
            <h1>
              {money(overview.totals.yearly, cur)} <span className="muted">a year</span>
            </h1>
            <p className="hero-sub">
              plus <strong>{money(overview.totals.oneOff, cur)}</strong> you can claim back right now. Nothing happens without your OK.
            </p>
          </section>

          {urgent.length > 0 && (
            <section>
              <h2>🚨 Careful</h2>
              <div className="list">
                {urgent.map((f) => <FindingCard key={f.id} finding={f} currency={cur} onChange={refresh} />)}
              </div>
            </section>
          )}

          <section>
            <h2>Best things to do next</h2>
            <div className="list">
              {top.map((f) => <FindingCard key={f.id} finding={f} currency={cur} onChange={refresh} />)}
            </div>
          </section>

          <section>
            <h2>Your money team</h2>
            <div className="agent-grid">
              {overview.agents.map((a) => (
                <button key={a.id} className="agent-card" onClick={() => go({ page: "agent", id: a.id })}>
                  <span className="agent-emoji">{a.emoji}</span>
                  <span className="agent-name">{a.name}</span>
                  <span className="agent-tagline">{a.tagline}</span>
                  <span className="agent-stat">
                    {a.findingCount === 0
                      ? "All clear"
                      : [
                          a.yearlyImpact ? `${money(a.yearlyImpact, cur)}/yr` : null,
                          a.oneOffImpact ? `${money(a.oneOffImpact, cur)} to claim` : null,
                          !a.yearlyImpact && !a.oneOffImpact ? `${a.findingCount} to check` : null,
                        ].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="two-col">
            <section className="panel">
              <h2>Ask Penny</h2>
              <Chat target="penny" starters={["What should I do first?", "Where does my money go each month?", "Am I being ripped off anywhere?"]} onActivity={refresh} />
            </section>
            <section className="panel">
              <h2>🛡️ Got a weird message?</h2>
              <ScamCheck />
            </section>
          </div>

          <footer className="foot">
            Prototype with made-up data. No real bank, provider, email or call is ever contacted.
            {overview.fx.base !== cur && (
              <>
                {" "}Amounts converted from {overview.fx.base} at 1 {overview.fx.base} = {overview.fx.rate.toPrecision(4)} {cur} ({overview.fx.live ? "live" : "offline"} rates: {overview.fx.source}, {overview.fx.asOf}).
              </>
            )}{" "}
            <button className="link" onClick={() => api.reset().then(refresh)}>Reset demo</button>
          </footer>
        </main>
      )}

      {view.page === "inbox" && <Inbox currency={cur} onChange={refresh} />}
      {view.page === "agent" && <AgentPage key={view.id} id={view.id} currency={cur} version={version} onChange={refresh} onBack={() => go({ page: "home" })} />}
    </div>
  );
}
