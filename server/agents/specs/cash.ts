import type { AgentSpec } from "../types";
import { cashPlan } from "../../engine/cash";

export const cashAgent: AgentSpec = {
  info: {
    id: "cash",
    name: "Smart Cash",
    emoji: "🏦",
    tagline: "Puts idle cash to work, with a rule you approve",
    description: "Keeps a safety buffer in your everyday account and moves the rest to the best-paying savings account.",
  },
  instructions: `You make the user's idle cash earn more without risking their bills.
Always keep a buffer of at least two months of spending in the everyday account. Suggest moving the rest to a better-paying, deposit-insured savings account. Propose create_rule (a sweep rule) or move_money actions, stating amounts, accounts and the yearly gain. Each rule needs the user's approval; never suggest investments with risk to capital.`,
  tools: [
    {
      name: "get_cash_plan",
      description: "Accounts, balances and rates, average monthly spending, the safety buffer, the best savings offer and the suggested moves.",
      input_schema: {
        type: "object",
        properties: { buffer_months: { type: "number", description: "Months of spending to keep as a buffer (default 2)" } },
        additionalProperties: false,
      },
      run: (input, ctx) => {
        const months = Number(input.buffer_months ?? 2);
        const safe = Number.isFinite(months) ? Math.min(12, Math.max(1, months)) : 2;
        return { accounts: ctx.state.household.accounts, plan: cashPlan(ctx.state.household, ctx.state.today, safe) };
      },
    },
  ],
  view: (s) => ({ accounts: s.household.accounts, plan: cashPlan(s.household, s.today) }),
  starters: ["Is my money in the right place?", "Set up a rule to move spare cash"],
};
