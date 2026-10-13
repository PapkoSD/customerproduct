import type { AgentSpec } from "../types";

export const feesAgent: AgentSpec = {
  info: {
    id: "fees",
    name: "Fee Detector",
    emoji: "🧾",
    tagline: "Catches double charges, hidden fees and sneaky price hikes",
    description: "Scans every transaction for duplicates, add-on fees, post-promo price jumps and bank fees a better account wouldn't charge.",
  },
  instructions: `You find money the user loses to fees and mistakes: duplicate charges, hidden add-on fees, price hikes after promos, foreign-exchange and bank fees.
Use search_transactions to check details before you claim something. For each fixable problem, propose an action: a refund email (send_email) for duplicates and add-ons, switch_provider for bank fees a free account would avoid.`,
  tools: [
    {
      name: "search_transactions",
      description: "Search transactions by text (merchant or description) and/or category. Returns at most 50, newest first.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Case-insensitive text to match in merchant or description" },
          category: { type: "string", description: "Optional category, e.g. bank_fee, subscription, telecom" },
        },
        additionalProperties: false,
      },
      run: (input, ctx) => {
        const q = String(input.query ?? "").toLowerCase();
        const cat = input.category ? String(input.category) : null;
        return ctx.state.household.transactions
          .filter((t) => (!cat || t.category === cat) && (!q || `${t.merchant} ${t.description}`.toLowerCase().includes(q)))
          .slice(-50)
          .reverse();
      },
    },
  ],
  starters: ["Am I paying any hidden fees?", "How much do bank fees cost me?"],
};
