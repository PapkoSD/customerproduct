import type { Finding, Household } from "../../shared/types";
import { daysBetween, money } from "../../shared/format";

export interface CashPlan {
  monthlySpending: number;
  buffer: number;
  idleCash: number;
  bestRate: number;
  bestProvider: string | null;
  moves: { fromAccountId: string; fromName: string; amount: number; currentRate: number; yearlyGain: number }[];
  rule: string;
}

/** Keep two months of spending in the everyday account, move the rest to the best rate. */
export function cashPlan(h: Household, today: string, bufferMonths = 2): CashPlan {
  const out = h.transactions.filter((t) => t.amount < 0 && t.category !== "transfer");
  const months = Math.max(1, daysBetween(h.transactions[0].date, today) / 30.4);
  const monthlySpending = Math.round(out.reduce((n, t) => n - t.amount, 0) / months);
  const buffer = Math.ceil((monthlySpending * bufferMonths) / 1000) * 1000;
  const best = h.offers.filter((o) => o.kind === "savings" && o.rate).sort((a, b) => b.rate! - a.rate!)[0];
  const bestRate = best?.rate ?? 0;

  const moves: CashPlan["moves"] = [];
  for (const a of h.accounts) {
    if (a.interestRate >= bestRate) continue;
    const amount = a.kind === "current" ? Math.floor((a.balance - buffer) / 1000) * 1000 : a.balance;
    if (amount <= 0) continue;
    moves.push({
      fromAccountId: a.id,
      fromName: `${a.institution} ${a.name}`,
      amount,
      currentRate: a.interestRate,
      yearlyGain: Math.round((amount * (bestRate - a.interestRate)) / 100),
    });
  }
  const cur = h.profile.currency;
  return {
    monthlySpending,
    buffer,
    idleCash: moves.reduce((n, m) => n + m.amount, 0),
    bestRate,
    bestProvider: best?.provider ?? null,
    moves,
    rule: `Every Friday, if the everyday account holds more than ${money(buffer, cur)}, move the excess to ${best?.provider ?? "savings"} (${bestRate}%). Never move money if it would leave less than ${money(buffer, cur)}.`,
  };
}

export function detectCash(h: Household, today: string): Finding[] {
  const cur = h.profile.currency;
  const plan = cashPlan(h, today);
  if (!plan.moves.length || !plan.bestProvider) return [];
  const gain = plan.moves.reduce((n, m) => n + m.yearlyGain, 0);
  return [
    {
      id: "cash-idle",
      agent: "cash",
      title: `${money(plan.idleCash, cur)} is earning almost nothing`,
      detail: `You spend about ${money(plan.monthlySpending, cur)}/month. Keeping a ${money(plan.buffer, cur)} buffer and moving the rest to ${plan.bestProvider} at ${plan.bestRate}% would earn about ${money(gain, cur)} a year.`,
      severity: "save",
      yearlyImpact: gain,
      evidence: plan.moves.map((m) => m.fromAccountId),
      suggestedAction: "create_rule",
    },
  ];
}
