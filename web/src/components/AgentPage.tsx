import { useEffect, useState } from "react";
import type { AgentId, Currency } from "../../../shared/types";
import { money } from "../../../shared/format";
import { api, type AgentDetail } from "../api";
import { Chat } from "./Chat";
import { FindingCard } from "./FindingCard";

interface Props {
  id: AgentId;
  currency: Currency;
  version: number;
  onChange: () => void;
  onBack: () => void;
}

export function AgentPage({ id, currency, version, onChange, onBack }: Props) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  useEffect(() => {
    api.agent(id).then(setDetail);
  }, [id, version]);
  if (!detail) return <div className="loading">Loading…</div>;
  const { info, findings, view, starters } = detail;

  return (
    <main>
      <button className="link back" onClick={onBack}>← All agents</button>
      <section className="hero small">
        <p className="eyebrow">{info.emoji} {info.name}</p>
        <h1>{info.tagline}</h1>
        <p className="hero-sub">{info.description}</p>
      </section>

      <section>
        <h2>{findings.length ? `Found ${findings.length}` : "All clear 🎉"}</h2>
        <div className="list">
          {findings.map((f) => <FindingCard key={f.id} finding={f} currency={currency} onChange={onChange} />)}
        </div>
      </section>

      {view && <AgentView id={id} view={view} currency={currency} />}

      <section className="panel">
        <h2>Chat with {info.name}</h2>
        <Chat target={id} starters={starters} onActivity={onChange} />
      </section>
    </main>
  );
}

function AgentView({ id, view, currency: c }: { id: AgentId; view: Record<string, any>; currency: Currency }) {
  switch (id) {
    case "subscriptions":
      return (
        <Table
          title="All your subscriptions"
          head={["Service", "Per month", "Used (30 days)", "Last used"]}
          rows={view.subscriptions.map((s: any) => [s.merchant, money(s.monthlyCost, c), s.usesLast30Days ?? "?", s.lastUsed ?? "never"])}
        />
      );
    case "negotiator":
      return (
        <Table
          title="Your contracts vs the market"
          head={["Contract", "You pay", "Best offer", "Saving / yr"]}
          rows={view.contracts.map((x: any) => [
            `${x.contract.provider} (${x.contract.kind})`,
            money(x.contract.monthlyCost, c),
            x.bestOffer ? `${x.bestOffer.provider} ${money(x.bestOffer.monthlyCost, c)}` : "You're on a good deal",
            x.monthlySaving ? money(x.monthlySaving * 12, c) : "–",
          ])}
        />
      );
    case "cash":
      return (
        <section>
          <h2>Your accounts</h2>
          <Table
            head={["Account", "Balance", "Interest"]}
            rows={view.accounts.map((a: any) => [`${a.institution} ${a.name}`, money(a.balance, c), `${a.interestRate}%`])}
          />
          <p className="muted">
            You spend about {money(view.plan.monthlySpending, c)} a month, so Penny keeps a {money(view.plan.buffer, c)} safety buffer. Proposed rule: {view.plan.rule}
          </p>
        </section>
      );
    case "scam":
      return (
        <Table
          title="Recent money messages"
          head={["From", "Message", "Verdict"]}
          rows={view.inbox.map((m: any) => [m.from, m.subject ?? m.body.slice(0, 70) + "…", `${{ safe: "✅", suspicious: "⚠️", scam: "🚨" }[m.assessment.verdict as "safe"]} ${m.assessment.verdict}`])}
        />
      );
    case "taxes":
      return (
        <section>
          <h2>Tax estimate {view.tax.year}</h2>
          <Table
            head={["", "Amount"]}
            rows={[
              ["Income", money(view.tax.income, c)],
              ["Flat-rate expenses (60%)", money(view.tax.expensesFlatRate, c)],
              ["Tax before credits", money(view.tax.taxBeforeCredits, c)],
              ...view.tax.credits.map((x: any) => [x.label, `− ${money(x.amount, c)}`]),
              ["Estimated tax", money(view.tax.estimatedTax, c)],
              ["Advances paid", money(view.tax.advancesPaid, c)],
              [view.tax.estimatedRefund >= 0 ? "Estimated refund" : "Left to pay", money(Math.abs(view.tax.estimatedRefund), c)],
            ]}
          />
          <h2>Deadlines</h2>
          <Table head={["What", "When", "Days left"]} rows={view.tax.deadlines.map((d: any) => [d.title, d.date, d.daysLeft])} />
          <p className="muted">Estimates using simplified Czech rules. Check with an advisor or the official form before filing.</p>
        </section>
      );
    default:
      return null;
  }
}

function Table({ title, head, rows }: { title?: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <section>
      {title && <h2>{title}</h2>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
