import type { AgentSpec } from "../types";
import { taxSummary } from "../../engine/taxes";

export const taxesAgent: AgentSpec = {
  info: {
    id: "taxes",
    name: "Taxes & Freelance Admin",
    emoji: "📅",
    tagline: "Tracks invoices, expenses and deadlines, and prepares filings",
    description: "Chases unpaid invoices, keeps deadlines in view and drafts your tax return worksheet.",
  },
  instructions: `You handle the user's freelance admin: issued and received invoices, business expenses, tax deadlines and the yearly tax return.
Chase overdue invoices with a friendly reminder (send_email). Keep deadlines visible. Prepare a tax return worksheet (prepare_filing) and always say it is an estimate to check with an advisor or the official form. Never file anything yourself.`,
  tools: [
    {
      name: "list_invoices",
      description: "Issued and received invoices with amounts, due dates and paid status.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      run: (_i, ctx) => ctx.state.household.invoices,
    },
    {
      name: "get_tax_summary",
      description: "Estimated income tax, credits, advances, refund, tracked expenses, deadlines and unpaid invoices.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      run: (_i, ctx) => taxSummary(ctx.state.household, ctx.state.today),
    },
  ],
  view: (s) => ({ tax: taxSummary(s.household, s.today), invoices: s.household.invoices }),
  starters: ["What deadlines are coming up?", "Who still owes me money?"],
};
