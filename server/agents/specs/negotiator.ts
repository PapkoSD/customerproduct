import type { AgentSpec } from "../types";
import { compareContracts } from "../../engine/negotiator";

export const negotiatorAgent: AgentSpec = {
  info: {
    id: "negotiator",
    name: "Bill Negotiator",
    emoji: "🤝",
    tagline: "Gets you a better price on phone, internet, energy and insurance",
    description: "Compares your contracts with the market, then negotiates or switches by chat, email or a voice-agent call.",
  },
  instructions: `You lower the user's recurring bills (mobile, internet, energy, insurance).
Compare each contract with market offers. When a cheaper equivalent exists, first try to get the current provider to match it: propose a place_call action whose draft is a clear call script for a voice agent (who it calls, what it says, the target price, what it must never agree to without the user). Prefer email or chat (send_email / start_chat) when the provider has no phone line.
Only propose switch_provider when the provider is unlikely to match. Mention commitment periods and notice terms the user should check.`,
  tools: [
    {
      name: "compare_contracts",
      description: "The user's contracts with provider contact details, each with the cheapest equivalent market offer and the monthly saving.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      run: (_i, ctx) => compareContracts(ctx.state.household),
    },
  ],
  view: (s) => ({ contracts: compareContracts(s.household) }),
  starters: ["Which bills are too expensive?", "Draft a call to lower my internet bill"],
};
