import type { Contract, Finding, Household, MarketOffer } from "../../shared/types";
import { money } from "../../shared/format";

export interface ContractComparison {
  contract: Contract;
  bestOffer: MarketOffer | null;
  monthlySaving: number;
}

export function compareContracts(h: Household): ContractComparison[] {
  return h.contracts.map((contract) => {
    const cheaper = h.offers
      .filter((o) => o.kind === contract.kind && o.monthlyCost < contract.monthlyCost)
      .sort((a, b) => a.monthlyCost - b.monthlyCost);
    const bestOffer = cheaper[0] ?? null;
    return { contract, bestOffer, monthlySaving: bestOffer ? contract.monthlyCost - bestOffer.monthlyCost : 0 };
  });
}

export function detectBills(h: Household, today: string): Finding[] {
  const cur = h.profile.currency;
  return compareContracts(h)
    .filter((c) => c.bestOffer && c.monthlySaving > 0)
    .map(({ contract, bestOffer, monthlySaving }) => {
      const promoEnded = contract.promoEndsOn && contract.promoEndsOn < today;
      return {
        id: `bill-${contract.id}`,
        agent: "negotiator" as const,
        title: `${capital(contract.kind)}: ${contract.provider} is ${money(monthlySaving, cur)}/month too expensive`,
        detail: `You pay ${money(contract.monthlyCost, cur)}/month${promoEnded ? ` (promo ended ${contract.promoEndsOn})` : ""}. ${bestOffer!.provider} offers ${bestOffer!.details} for ${money(bestOffer!.monthlyCost, cur)}. Penny can ask ${contract.provider} to match it first, or switch you.`,
        severity: "save" as const,
        yearlyImpact: monthlySaving * 12,
        evidence: [contract.id],
        suggestedAction: "place_call" as const,
      };
    });
}

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);
