import type { Finding, Household, Transaction } from "../../shared/types";
import { daysBetween, money } from "../../shared/format";

export interface Subscription {
  merchant: string;
  description: string;
  billing: "monthly" | "annual";
  monthlyCost: number;
  lastCharge: string;
  firstCharge: string;
  chargeIds: string[];
  usesLast30Days: number | null;
  lastUsed: string | null;
}

/** Group subscription charges into recurring subscriptions. */
export function listSubscriptions(h: Household): Subscription[] {
  const byMerchant = new Map<string, Transaction[]>();
  for (const t of h.transactions) {
    if (t.category !== "subscription" || t.amount >= 0) continue;
    byMerchant.set(t.merchant, [...(byMerchant.get(t.merchant) ?? []), t]);
  }
  const subs: Subscription[] = [];
  for (const [merchant, txs] of byMerchant) {
    const latest = txs[txs.length - 1];
    const annual = txs.length === 1 && /annual/i.test(latest.description);
    if (txs.length < 2 && !annual) continue;
    const usage = h.usage.find((u) => u.merchant === merchant);
    subs.push({
      merchant,
      description: latest.description,
      billing: annual ? "annual" : "monthly",
      monthlyCost: annual ? -latest.amount / 12 : -latest.amount,
      lastCharge: latest.date,
      firstCharge: txs[0].date,
      chargeIds: txs.map((t) => t.id),
      usesLast30Days: usage?.usesLast30Days ?? null,
      lastUsed: usage?.lastUsed ?? null,
    });
  }
  return subs.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

export function detectSubscriptions(h: Household, today: string): Finding[] {
  const cur = h.profile.currency;
  const subs = listSubscriptions(h);
  const findings: Finding[] = [];

  for (const s of subs) {
    const yearly = Math.round(s.monthlyCost * 12);
    const idleDays = s.lastUsed ? daysBetween(s.lastUsed, today) : null;
    const isNew = daysBetween(s.firstCharge, today) <= 60;
    if (s.usesLast30Days === 0 && isNew) {
      findings.push({
        id: `sub-trial-${slug(s.merchant)}`,
        agent: "subscriptions",
        title: `${s.merchant} free trial turned into a paid plan`,
        detail: `Started charging ${money(s.monthlyCost, cur)}/month on ${s.firstCharge} and you haven't opened it since ${s.lastUsed ?? "signing up"}.`,
        severity: "warn",
        yearlyImpact: yearly,
        evidence: s.chargeIds,
        suggestedAction: "cancel_subscription",
      });
    } else if (s.usesLast30Days === 0) {
      findings.push({
        id: `sub-unused-${slug(s.merchant)}`,
        agent: "subscriptions",
        title: `${s.merchant} looks forgotten`,
        detail: `${money(s.monthlyCost, cur)}/month, last used ${idleDays} days ago (${s.lastUsed}).`,
        severity: "warn",
        yearlyImpact: yearly,
        evidence: s.chargeIds,
        suggestedAction: "cancel_subscription",
      });
    } else if (s.usesLast30Days !== null && s.usesLast30Days <= 2) {
      findings.push({
        id: `sub-rare-${slug(s.merchant)}`,
        agent: "subscriptions",
        title: `${s.merchant} is barely used`,
        detail: `Used ${s.usesLast30Days}× in the last 30 days for ${money(s.monthlyCost, cur)}/month (${s.billing} billing). Consider cancelling before the next renewal.`,
        severity: "info",
        yearlyImpact: yearly,
        evidence: s.chargeIds,
        suggestedAction: "cancel_subscription",
      });
    }
  }

  // Overlapping services: same description from different merchants.
  const byDesc = new Map<string, Subscription[]>();
  for (const s of subs) byDesc.set(s.description, [...(byDesc.get(s.description) ?? []), s]);
  for (const [desc, group] of byDesc) {
    if (group.length < 2 || desc === "") continue;
    const cheapestFirst = [...group].sort((a, b) => a.monthlyCost - b.monthlyCost);
    const drop = cheapestFirst.slice(1);
    findings.push({
      id: `sub-overlap-${slug(desc)}`,
      agent: "subscriptions",
      title: `You pay twice for ${desc}`,
      detail: `${group.map((s) => s.merchant).join(" and ")} both provide ${desc}. Keeping one saves ${money(drop.reduce((n, s) => n + s.monthlyCost, 0), cur)}/month.`,
      severity: "save",
      yearlyImpact: Math.round(drop.reduce((n, s) => n + s.monthlyCost * 12, 0)),
      evidence: group.flatMap((s) => s.chargeIds),
      suggestedAction: "cancel_subscription",
    });
  }
  return findings;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
