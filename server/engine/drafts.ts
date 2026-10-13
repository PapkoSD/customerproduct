// Template drafts for each kind of finding. Used in offline mode, and as a
// starting point the agents can rewrite when Claude is available.

import type { Finding, Household, ProposedAction } from "../../shared/types";
import { money } from "../../shared/format";
import { compareContracts } from "./negotiator";
import { cashPlan } from "./cash";
import { taxSummary } from "./taxes";

export type DraftInput = Omit<ProposedAction, "id" | "status" | "createdAt">;

export function templateDraft(f: Finding, h: Household, today: string): DraftInput | null {
  if (!f.suggestedAction) return null;
  const cur = h.profile.currency;
  const name = h.profile.name;
  const base = {
    agent: f.agent,
    kind: f.suggestedAction,
    findingId: f.id,
    estimatedYearlySaving: f.yearlyImpact,
    estimatedOneOff: f.oneOffImpact,
  };
  const tx = (id: string) => h.transactions.find((t) => t.id === id);

  switch (f.suggestedAction) {
    case "cancel_subscription": {
      const merchants = [...new Set(f.evidence.map((id) => tx(id)?.merchant).filter(Boolean))] as string[];
      // For overlaps, cancel all but the first (cheapest) one.
      const target = f.id.startsWith("sub-overlap") ? merchants[merchants.length - 1] : merchants[0];
      return {
        ...base,
        title: `Cancel ${target}`,
        summary: `Cancel ${target} at the end of the current billing period.`,
        channel: "web",
        recipient: target,
        draft: `Hello ${target} team,\n\nPlease cancel my subscription effective at the end of the current billing period and confirm the cancellation in writing. Please do not renew or charge my card after that date.\n\nThank you,\n${name}`,
      };
    }
    case "place_call": {
      const cmp = compareContracts(h).find((c) => `bill-${c.contract.id}` === f.id);
      if (!cmp?.bestOffer) return null;
      const { contract, bestOffer } = cmp;
      return {
        ...base,
        title: `Ask ${contract.provider} to match ${money(bestOffer.monthlyCost, cur)}/month`,
        summary: `A voice agent calls ${contract.provider} retention, asks them to match ${bestOffer.provider}, and only switches if you approve the result.`,
        channel: "phone",
        recipient: contract.contact.phone ?? contract.provider,
        draft: [
          `CALL SCRIPT (voice agent, on behalf of ${name})`,
          `1. Introduce: "Hi, I'm an AI assistant calling for ${name}, account holder. ${name} has authorised this call."`,
          `2. State the facts: current plan ${contract.details}, ${money(contract.monthlyCost, cur)}/month, customer since ${contract.startedOn}.`,
          `3. The ask: "${bestOffer.provider} offers ${bestOffer.details} for ${money(bestOffer.monthlyCost, cur)}. Can you match or beat that?"`,
          `4. If they offer ≤ ${money(bestOffer.monthlyCost, cur)}: ask for it in writing by email. Do NOT accept any new commitment period without checking back.`,
          `5. If they refuse: thank them, say ${name} will consider switching, end the call.`,
          `6. Never share card numbers, passwords or one-time codes.`,
          ``,
          `If they won't match, Penny will prepare a switch to ${bestOffer.provider} for your approval.`,
        ].join("\n"),
      };
    }
    case "switch_provider": {
      const offer = h.offers.find((o) => o.kind === "bank_account");
      return {
        ...base,
        title: `Switch everyday banking to ${offer?.provider ?? "a fee-free bank"}`,
        summary: "Open a fee-free account and use the free bank-switching service to move direct debits and income.",
        channel: "web",
        recipient: offer?.provider,
        draft: `Switch plan:\n1. Open a ${offer?.provider} account (${offer?.details}).\n2. Request the free account-switching service so standing orders and direct debits move over.\n3. Tell your clients the new account for invoices.\n4. Close the Classic Bank everyday account after 2 months of overlap.\n\nNo money moves until you approve each step.`,
      };
    }
    case "file_claim": {
      const trip = h.trips.find((t) => f.evidence.includes(t.id));
      if (trip) {
        const eur = Math.round((f.oneOffImpact ?? 0) / 25);
        return {
          ...base,
          title: `Claim €${eur} from ${trip.airline}`,
          summary: `Submit an EU 261 compensation claim for ${trip.flight} on ${trip.date}.`,
          channel: "web",
          recipient: `${trip.airline} claims form`,
          draft: `Subject: EU261 compensation claim, flight ${trip.flight}, ${trip.date}\n\nDear ${trip.airline},\n\nI was a passenger on flight ${trip.flight} from ${trip.from} to ${trip.to} on ${trip.date}, which arrived ${Math.round(trip.delayMinutes / 60 * 10) / 10} hours late. Under Regulation (EC) No 261/2004 and the CJEU ruling in Sturgeon (C-402/07), I am entitled to €${eur} in compensation.\n\nPlease pay this to my bank account within 14 days. Booking confirmation attached.\n\nKind regards,\n${name}`,
        };
      }
      const p = h.purchases.find((x) => f.evidence.includes(x.id));
      if (!p) return null;
      return {
        ...base,
        title: `Warranty claim: ${p.item}`,
        summary: `File a warranty claim with ${p.merchant} for repair or replacement.`,
        channel: "email",
        recipient: p.merchant,
        draft: `Subject: Warranty claim, ${p.item} bought ${p.date}\n\nDear ${p.merchant},\n\nI bought a ${p.item} from you on ${p.date} for ${money(p.price, cur)}. It has developed this fault: ${p.issue}. As this is within the ${p.warrantyMonths}-month statutory warranty, I request a free repair or replacement.\n\nPlease tell me how to hand the device over. Receipt attached.\n\nKind regards,\n${name}`,
      };
    }
    case "send_email": {
      if (f.id.startsWith("owed-refund")) {
        const p = h.purchases.find((x) => f.evidence.includes(x.id))!;
        return {
          ...base,
          title: `Chase ${p.merchant} for your ${money(p.price, cur)} refund`,
          summary: "A firm reminder citing the 14-day refund rule.",
          channel: "email",
          recipient: p.merchant,
          draft: `Subject: Refund overdue for returned ${p.item}\n\nDear ${p.merchant},\n\nI returned the ${p.item} (order of ${p.date}) on ${p.returnedOn}. Under EU consumer law the refund of ${money(p.price, cur)} was due within 14 days, but I have not received it.\n\nPlease refund it within 7 days or tell me the reason for the delay.\n\nThank you,\n${name}`,
        };
      }
      if (f.id.startsWith("tax-overdue")) {
        const inv = h.invoices.find((i) => f.evidence.includes(i.id))!;
        return {
          ...base,
          title: `Remind ${inv.counterparty} about invoice ${inv.id}`,
          summary: `Friendly payment reminder for ${money(inv.amount, cur)}.`,
          channel: "email",
          recipient: inv.counterparty,
          draft: `Subject: Friendly reminder, invoice ${inv.id}\n\nHi,\n\nJust a quick reminder that invoice ${inv.id} for ${inv.description} (${money(inv.amount, cur)}) was due on ${inv.dueOn}. Could you let me know when I can expect payment? I've attached the invoice again in case it got lost.\n\nThanks a lot,\n${name}`,
        };
      }
      const t = tx(f.evidence[f.evidence.length - 1]);
      const merchant = t?.merchant ?? "the merchant";
      const issue = f.id.startsWith("fee-dup")
        ? `I was charged ${money(-(t?.amount ?? 0), cur)} twice on ${t?.date}. Please refund the duplicate charge.`
        : f.id.startsWith("fee-hidden")
          ? `A "${t?.description}" of ${money(-(t?.amount ?? 0), cur)} was added to my purchase on ${t?.date} without my clear consent. Please refund it.`
          : `My price went up without a clear notice. Please confirm whether I can keep my previous price, or cancel penalty-free.`;
      return {
        ...base,
        title: `Email ${merchant}: ${f.title.toLowerCase()}`,
        summary: issue,
        channel: "email",
        recipient: merchant,
        draft: `Dear ${merchant},\n\n${issue}\n\nThank you,\n${name}`,
      };
    }
    case "create_rule": {
      const plan = cashPlan(h, today);
      return {
        ...base,
        title: `Move ${money(plan.idleCash, cur)} to ${plan.bestProvider} and turn on a sweep rule`,
        summary: `One-off move now, then a weekly rule. Each rule needs your approval and can be paused any time.`,
        channel: "bank",
        recipient: plan.bestProvider ?? undefined,
        draft: [
          ...plan.moves.map((m) => `• Move ${money(m.amount, cur)} from ${m.fromName} (${m.currentRate}%) → ${plan.bestProvider} (${plan.bestRate}%), +${money(m.yearlyGain, cur)}/yr`),
          ``,
          `Rule: ${plan.rule}`,
        ].join("\n"),
      };
    }
    case "block_payment": {
      const m = h.inbox.find((x) => f.evidence.includes(x.id));
      return {
        ...base,
        title: `Block and report: message from ${m?.from}`,
        summary: "Don't pay. Add the sender and account number to your block list and report it to your bank.",
        channel: "bank",
        recipient: "Classic Bank fraud team",
        draft: `Report to bank fraud team:\n\nI received a suspicious ${m?.channel} from ${m?.from} on ${m?.receivedAt.slice(0, 10)}:\n"${m?.body}"\n\nI have not paid or clicked anything. Please flag any account numbers in it.\n\n${name}`,
      };
    }
    case "prepare_filing": {
      const s = taxSummary(h, today);
      return {
        ...base,
        title: `Prepare ${s.year} tax return (estimate)`,
        summary: "A worksheet for the income tax return, to check with an advisor or the official form.",
        channel: "web",
        recipient: "Tax office (EPO portal)",
        draft: [
          `TAX RETURN WORKSHEET ${s.year} (estimate, not filed)`,
          `Income (§7): ${money(s.income, cur)}`,
          `Flat-rate expenses 60%: ${money(s.expensesFlatRate, cur)}`,
          `Tax base: ${money(s.taxBase, cur)}`,
          `Tax 15%: ${money(s.taxBeforeCredits, cur)}`,
          ...s.credits.map((c) => `− ${c.label}: ${money(c.amount, cur)}`),
          `Estimated tax: ${money(s.estimatedTax, cur)}`,
          `Advances paid: ${money(s.advancesPaid, cur)}`,
          `${s.estimatedRefund >= 0 ? "Refund" : "To pay"}: ${money(Math.abs(s.estimatedRefund), cur)}`,
          ``,
          `Deadline: ${s.deadlines[0].date}. ${s.deadlines[0].note}`,
        ].join("\n"),
      };
    }
    default:
      return null;
  }
}
