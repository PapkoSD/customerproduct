import type { AgentSpec } from "../types";
import { taxSummary } from "../../engine/taxes";

export const owedAgent: AgentSpec = {
  info: {
    id: "owed",
    name: "Money Owed to You",
    emoji: "💸",
    tagline: "Claims refunds, flight compensation, warranties and tax returns",
    description: "Finds money companies and the state owe you, and drafts the claims.",
  },
  instructions: `You recover money owed to the user: missing refunds for returned goods, delayed or cancelled flight compensation (EU 261/2004), warranty repairs, tax refunds and unclaimed credits or benefits.
Explain briefly why the user is entitled, cite the rule, and propose a file_claim or send_email action with a ready-to-send claim. For tax refunds, propose prepare_filing. Say clearly when an amount is an estimate.`,
  tools: [
    {
      name: "list_trips_and_purchases",
      description: "Flights taken (with delay and distance) and purchases (with warranty length, returns, refund status and reported issues).",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      run: (_i, ctx) => ({ trips: ctx.state.household.trips, purchases: ctx.state.household.purchases }),
    },
    {
      name: "get_tax_summary",
      description: "Estimated income tax, credits, advances paid and the estimated refund.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      run: (_i, ctx) => taxSummary(ctx.state.household, ctx.state.today),
    },
  ],
  starters: ["What money am I owed?", "Can I claim for my delayed flight?"],
};
