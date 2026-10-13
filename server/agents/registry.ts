import type { AgentId } from "../../shared/types";
import type { AgentSpec } from "./types";
import { subscriptionsAgent } from "./specs/subscriptions";
import { negotiatorAgent } from "./specs/negotiator";
import { feesAgent } from "./specs/fees";
import { owedAgent } from "./specs/owed";
import { cashAgent } from "./specs/cash";
import { scamAgent } from "./specs/scam";
import { taxesAgent } from "./specs/taxes";

/** Every agent in the app. Adding one here makes it appear in the API and UI. */
export const AGENTS: AgentSpec[] = [
  subscriptionsAgent,
  negotiatorAgent,
  feesAgent,
  owedAgent,
  cashAgent,
  scamAgent,
  taxesAgent,
];

export function getAgent(id: string): AgentSpec | undefined {
  return AGENTS.find((a) => a.info.id === (id as AgentId));
}
