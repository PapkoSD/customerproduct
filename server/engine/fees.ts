import type { Finding, Household, Transaction } from "../../shared/types";
import { daysBetween, money } from "../../shared/format";
import { slug } from "./subscriptions";

export function detectFees(h: Household, today: string): Finding[] {
  const cur = h.profile.currency;
  const txs = h.transactions;
  const findings: Finding[] = [];

  // 1. Duplicate charges: same merchant and amount within a day, not a subscription.
  const seen = new Map<string, Transaction>();
  for (const t of txs) {
    if (t.amount >= 0 || t.category === "subscription" || t.category === "bank_fee") continue;
    const key = `${t.merchant}|${t.amount}`;
    const prev = seen.get(key);
    if (prev && daysBetween(prev.date, t.date) <= 1) {
      findings.push({
        id: `fee-dup-${t.id}`,
        agent: "fees",
        title: `Possible double charge at ${t.merchant}`,
        detail: `${money(-t.amount, cur)} was charged twice (${prev.date} and ${t.date}). Ask the merchant or your bank for a refund.`,
        severity: "warn",
        oneOffImpact: -t.amount,
        evidence: [prev.id, t.id],
        suggestedAction: "send_email",
      });
    }
    seen.set(key, t);
  }

  // 2. Price hikes on recurring charges.
  const recurring = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.amount >= 0 || !["subscription", "telecom", "utilities", "insurance"].includes(t.category)) continue;
    recurring.set(t.merchant, [...(recurring.get(t.merchant) ?? []), t]);
  }
  for (const [merchant, list] of recurring) {
    if (list.length < 3) continue;
    const first = -list[0].amount;
    const last = -list[list.length - 1].amount;
    if (last > first * 1.05) {
      const changedAt = list.find((t) => -t.amount === last)!;
      const promo = h.contracts.find((c) => c.provider === merchant && c.promoEndsOn);
      findings.push({
        id: `fee-hike-${slug(merchant)}`,
        agent: "fees",
        title: promo ? `${merchant} promo ended, price went up` : `${merchant} raised its price`,
        detail: `${money(first, cur)} → ${money(last, cur)} per month since ${changedAt.date} (+${Math.round((last / first - 1) * 100)}%).${promo ? " The bill negotiator can find a better deal." : " You may be able to cancel penalty-free after a price change."}`,
        severity: promo ? "info" : "warn",
        // Contract price hikes are costed by the bill negotiator, so don't count them twice.
        yearlyImpact: promo ? undefined : Math.round((last - first) * 12),
        evidence: list.map((t) => t.id),
        suggestedAction: promo ? undefined : "send_email",
      });
    }
  }

  // 3. Bank fees vs a fee-free account.
  const bankFees = txs.filter((t) => t.category === "bank_fee");
  if (bankFees.length) {
    const months = Math.max(1, daysBetween(txs[0].date, today) / 30.4);
    const yearly = Math.round((bankFees.reduce((n, t) => n - t.amount, 0) / months) * 12);
    const freeAccount = h.offers.find((o) => o.kind === "bank_account" && o.monthlyCost === 0);
    const kinds = [...new Set(bankFees.map((t) => t.description.replace(/ \d.*$/, "")))];
    findings.push({
      id: "fee-bank",
      agent: "fees",
      title: `Your bank charges you about ${money(yearly, cur)} a year`,
      detail: `Fees: ${kinds.join(", ")}.${freeAccount ? ` ${freeAccount.provider} offers: ${freeAccount.details}.` : ""}`,
      severity: "save",
      yearlyImpact: yearly,
      evidence: bankFees.map((t) => t.id),
      suggestedAction: "switch_provider",
    });
  }

  // 4. Hidden add-on fees bundled with a purchase.
  for (const t of txs) {
    if (t.amount < 0 && /service fee|add-on|protection|handling/i.test(t.description) && t.category !== "bank_fee") {
      findings.push({
        id: `fee-hidden-${t.id}`,
        agent: "fees",
        title: `Hidden fee: ${t.description} at ${t.merchant}`,
        detail: `${money(-t.amount, cur)} on ${t.date}, added on top of the main purchase. Add-ons that were pre-ticked can usually be refunded.`,
        severity: "info",
        oneOffImpact: -t.amount,
        evidence: [t.id],
        suggestedAction: "send_email",
      });
    }
  }
  return findings;
}
