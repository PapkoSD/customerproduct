import type { AgentSpec } from "../types";
import { listSubscriptions } from "../../engine/subscriptions";

export const subscriptionsAgent: AgentSpec = {
  info: {
    id: "subscriptions",
    name: "Subscription Hunter",
    emoji: "🔍",
    tagline: "Finds forgotten subscriptions and cancels them",
    description: "Spots recurring charges, checks how much you actually use each one, and drafts cancellations.",
  },
  instructions: `You hunt down subscriptions the user pays for but doesn't use.
Look at every recurring charge with its usage. Flag forgotten ones (no use in 30+ days), barely used ones, free trials that turned paid, and overlapping services.
For each one worth cancelling, propose a cancel_subscription action with a short, polite cancellation message. Never cancel something the user clearly uses a lot.`,
  tools: [
    {
      name: "list_subscriptions",
      description: "All recurring subscriptions with monthly cost, billing period, first/last charge and usage in the last 30 days.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      run: (_i, ctx) => listSubscriptions(ctx.state.household),
    },
  ],
  view: (s) => ({ subscriptions: listSubscriptions(s.household) }),
  starters: ["Which subscriptions should I cancel?", "How much do I spend on subscriptions a year?"],
};
