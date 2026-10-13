import type { Finding, Household } from "../../shared/types";
import { addDays, daysBetween, money } from "../../shared/format";
import { taxSummary } from "./taxes";

/** EU Regulation 261/2004 compensation for a delay of 3h+ at arrival or a cancellation. */
export function eu261Compensation(distanceKm: number, delayMinutes: number, cancelled: boolean): number {
  if (!cancelled && delayMinutes < 180) return 0;
  if (distanceKm <= 1500) return 250;
  if (distanceKm <= 3500) return 400;
  return 600;
}

export function detectOwed(h: Household, today: string): Finding[] {
  const cur = h.profile.currency;
  const rate = h.fx.perEur;
  const findings: Finding[] = [];

  for (const trip of h.trips) {
    const eur = eu261Compensation(trip.distanceKm, trip.delayMinutes, trip.cancelled);
    if (!eur) continue;
    findings.push({
      id: `owed-flight-${trip.id}`,
      agent: "owed",
      title: `${trip.airline} owes you €${eur} for flight ${trip.flight}`,
      detail: `${trip.from} → ${trip.to} on ${trip.date} arrived ${Math.round(trip.delayMinutes / 6) / 10} h late. Under EU rule 261/2004 that's €${eur} ${cur === "EUR" ? "" : ` (≈ ${money(eur * rate, cur)})`} per passenger, unless the airline proves extraordinary circumstances.`,
      severity: "save",
      oneOffImpact: eur * rate,
      evidence: [trip.id],
      suggestedAction: "file_claim",
    });
  }

  for (const p of h.purchases) {
    if (p.returnedOn && !p.refundReceived) {
      const waited = daysBetween(p.returnedOn, today);
      if (waited > 14) {
        findings.push({
          id: `owed-refund-${p.id}`,
          agent: "owed",
          title: `${p.merchant} hasn't refunded your ${p.item.toLowerCase()}`,
          detail: `You returned it on ${p.returnedOn}, ${waited} days ago. EU consumer law requires a refund within 14 days of withdrawal. ${money(p.price, cur)} is owed.`,
          severity: "warn",
          oneOffImpact: p.price,
          evidence: [p.id],
          suggestedAction: "send_email",
        });
      }
    }
    if (p.issue) {
      const warrantyEnds = addDays(p.date, Math.round(p.warrantyMonths * 30.44));
      if (warrantyEnds > today) {
        findings.push({
          id: `owed-warranty-${p.id}`,
          agent: "owed",
          title: `${p.item} is still under warranty`,
          detail: `Bought ${p.date} at ${p.merchant} for ${money(p.price, cur)}; warranty runs until ${warrantyEnds}. Reported issue: ${p.issue}. A repair or replacement claim is free (saves an estimated 30% of the price in repair costs).`,
          severity: "save",
          oneOffImpact: Math.round(p.price * 0.3), // typical repair cost avoided
          evidence: [p.id],
          suggestedAction: "file_claim",
        });
      }
    }
  }

  if (h.profile.isFreelancer) {
    const t = taxSummary(h, today);
    if (t.estimatedRefund > 0) {
      findings.push({
        id: "owed-tax-refund",
        agent: "owed",
        title: `Estimated tax refund: ${money(t.estimatedRefund, cur)}`,
        detail: `Your advances (${money(t.advancesPaid, cur)}) exceed the estimated tax (${money(t.estimatedTax, cur)}), including ${t.credits.map((c) => c.label.toLowerCase()).join(" and ")}. File the return to get it back.`,
        severity: "save",
        oneOffImpact: t.estimatedRefund,
        evidence: [],
        suggestedAction: "prepare_filing",
      });
    }
  }
  return findings;
}
