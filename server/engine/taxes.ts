// Simplified Czech freelancer (OSVČ) tax estimate for the demo. Real filings
// need a tax advisor or the official calculator; the numbers are labelled
// "estimate" everywhere they are shown.

import type { Finding, Household } from "../../shared/types";
import { daysBetween, money } from "../../shared/format";

/** Amounts in CZK; converted to the display currency when used. */
export const CZ_RULES = {
  flatExpenseRate: 0.6, // "výdajový paušál" for most trades
  incomeTaxRate: 0.15,
  basicTaxpayerCredit: 30840,
  firstChildCredit: 15204,
};

export interface TaxSummary {
  year: number;
  income: number;
  expensesFlatRate: number;
  taxBase: number;
  taxBeforeCredits: number;
  credits: { label: string; amount: number }[];
  estimatedTax: number;
  advancesPaid: number;
  estimatedRefund: number; // positive = you get money back
  businessExpensesTracked: number;
  deadlines: { title: string; date: string; note: string; daysLeft: number }[];
  receivables: { id: string; counterparty: string; amount: number; dueOn: string; daysOverdue: number }[];
}

export function taxSummary(h: Household, today: string): TaxSummary {
  const p = h.profile;
  // Czech credits are set in CZK: express them in the display currency.
  const czk = h.fx.base === "CZK" ? h.fx.rate : 1;
  const income = p.annualIncomeEstimate;
  const expensesFlatRate = Math.round(income * CZ_RULES.flatExpenseRate);
  const taxBase = income - expensesFlatRate;
  const taxBeforeCredits = Math.round(taxBase * CZ_RULES.incomeTaxRate);
  const credits = [{ label: "Basic taxpayer credit", amount: Math.round(CZ_RULES.basicTaxpayerCredit * czk) }];
  if (p.childrenCount > 0) credits.push({ label: "Child tax credit (1st child)", amount: Math.round(CZ_RULES.firstChildCredit * czk) });
  const estimatedTax = Math.max(0, taxBeforeCredits - credits.reduce((n, c) => n + c.amount, 0));
  const year = Number(today.slice(0, 4));
  const deadlines = [
    { title: `Income tax return ${year} (electronic)`, date: `${year + 1}-05-03`, note: "Paper filing is due 1 April. Check exact dates with the tax office." },
    { title: "Social insurance overview", date: `${year + 1}-06-02`, note: "Within a month after the tax return deadline." },
    { title: "Health insurance overview", date: `${year + 1}-06-02`, note: "Within a month after the tax return deadline." },
  ].map((d) => ({ ...d, daysLeft: daysBetween(today, d.date) }));
  const receivables = h.invoices
    .filter((i) => i.kind === "issued" && !i.paid)
    .map((i) => ({ id: i.id, counterparty: i.counterparty, amount: i.amount, dueOn: i.dueOn, daysOverdue: daysBetween(i.dueOn, today) }));
  return {
    year,
    income,
    expensesFlatRate,
    taxBase,
    taxBeforeCredits,
    credits,
    estimatedTax,
    advancesPaid: p.taxAdvancesPaid,
    estimatedRefund: p.taxAdvancesPaid - estimatedTax,
    businessExpensesTracked: h.invoices.filter((i) => i.kind === "received").reduce((n, i) => n + i.amount, 0),
    deadlines,
    receivables,
  };
}

export function detectTaxes(h: Household, today: string): Finding[] {
  if (!h.profile.isFreelancer) return [];
  const cur = h.profile.currency;
  const s = taxSummary(h, today);
  const findings: Finding[] = [];
  for (const r of s.receivables) {
    if (r.daysOverdue > 0) {
      findings.push({
        id: `tax-overdue-${r.id}`,
        agent: "taxes",
        title: `${r.counterparty} owes you ${money(r.amount, cur)}`,
        detail: `Invoice ${r.id} was due ${r.dueOn}, ${r.daysOverdue} days ago. Penny drafted a polite reminder.`,
        severity: "warn",
        oneOffImpact: r.amount,
        evidence: [r.id],
        suggestedAction: "send_email",
      });
    } else if (r.daysOverdue >= -7) {
      findings.push({
        id: `tax-due-${r.id}`,
        agent: "taxes",
        title: `${r.counterparty} invoice due in ${-r.daysOverdue} days`,
        detail: `${money(r.amount, cur)} for invoice ${r.id}, due ${r.dueOn}. Nothing to do yet.`,
        severity: "info",
        evidence: [r.id],
      });
    }
  }
  const next = s.deadlines[0];
  findings.push({
    id: "tax-prepare-return",
    agent: "taxes",
    title: `Tax return ${s.year}: draft ready to review`,
    detail: `Estimated tax ${money(s.estimatedTax, cur)} after credits; you paid ${money(s.advancesPaid, cur)} in advances. Deadline ${next.date} (${next.daysLeft} days).`,
    severity: "info",
    evidence: [],
    suggestedAction: "prepare_filing",
  });
  return findings;
}
