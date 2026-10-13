import type { AgentId, Finding, Household } from "../../shared/types";
import { detectSubscriptions } from "./subscriptions";
import { detectBills } from "./negotiator";
import { detectFees } from "./fees";
import { detectOwed } from "./owed";
import { detectCash } from "./cash";
import { detectScams } from "./scam";
import { detectTaxes } from "./taxes";

export const detectors: Record<AgentId, (h: Household, today: string) => Finding[]> = {
  subscriptions: detectSubscriptions,
  negotiator: detectBills,
  fees: detectFees,
  owed: detectOwed,
  cash: detectCash,
  scam: (h) => detectScams(h),
  taxes: detectTaxes,
};

export function detectAll(h: Household, today: string): Finding[] {
  return (Object.keys(detectors) as AgentId[]).flatMap((id) => detectors[id](h, today));
}
