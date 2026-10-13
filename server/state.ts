// In-memory app state for the prototype: one household, its findings and the
// approval queue. Replace with a database when there are real users.

import { randomUUID } from "node:crypto";
import type { AgentId, Currency, Finding, Household, ProposedAction } from "../shared/types";
import { createHousehold, TODAY } from "./data/mock";
import { FALLBACK_RATES, getRates, type RateTable } from "./fx";
import { detectAll } from "./engine";
import type { DraftInput } from "./engine/drafts";

export class AppState {
  household: Household;
  today: string;
  private actions = new Map<string, ProposedAction>();
  /** Findings closed by an approved action; they drop off the dashboard. */
  private resolved = new Set<string>();

  constructor(household = createHousehold(), today = TODAY, private rates: RateTable = FALLBACK_RATES) {
    this.household = household;
    this.today = today;
  }

  get currency(): Currency {
    return this.household.profile.currency;
  }

  /**
   * Show everything in another currency, converted at the latest rates.
   * Drafts are cleared because their text quotes the old amounts.
   */
  async setCurrency(code: string, fetchImpl?: typeof fetch): Promise<void> {
    const currency = code.trim().toUpperCase();
    const rates = await getRates(fetchImpl);
    if (!/^[A-Z]{3}$/.test(currency) || !rates.rates[currency]) throw new HttpError(400, `Unsupported currency ${code}`);
    this.rates = rates;
    this.household = createHousehold(currency, rates);
    this.actions.clear();
    this.resolved.clear();
  }

  /** Start over with fresh sample data in the current currency. */
  reset(): void {
    this.household = createHousehold(this.currency, this.rates);
    this.actions.clear();
    this.resolved.clear();
  }

  findings(agent?: AgentId): Finding[] {
    const drafted = new Set(this.listActions().filter((a) => a.status === "pending").map((a) => a.findingId));
    return detectAll(this.household, this.today)
      .filter((f) => !this.resolved.has(f.id) && (!agent || f.agent === agent))
      .map((f) => (drafted.has(f.id) ? { ...f, hasDraft: true } : f));
  }

  listActions(): ProposedAction[] {
    return [...this.actions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getAction(id: string) {
    return this.actions.get(id);
  }

  /** The only way an agent can act on the outside world: queue a draft for approval. */
  propose(input: DraftInput): { action: ProposedAction; duplicate: boolean } {
    const existing = input.findingId
      ? [...this.actions.values()].find((a) => a.findingId === input.findingId && a.status === "pending")
      : undefined;
    if (existing) {
      // Agents may refine a pending draft, but never duplicate it.
      Object.assign(existing, { ...input, status: "pending" });
      return { action: existing, duplicate: true };
    }
    const action: ProposedAction = { ...input, id: `act-${randomUUID().slice(0, 8)}`, status: "pending", createdAt: new Date().toISOString() };
    this.actions.set(action.id, action);
    return { action, duplicate: false };
  }

  /**
   * Approve a draft. In this prototype execution is simulated: nothing is sent,
   * no call is placed and no money moves. A real integration plugs in here.
   */
  approve(id: string, editedDraft?: string): ProposedAction {
    const a = this.mustPending(id);
    if (typeof editedDraft === "string" && editedDraft.trim()) a.draft = editedDraft.slice(0, 20_000);
    a.status = "done";
    a.resolvedAt = new Date().toISOString();
    a.outcome = simulatedOutcome(a);
    if (a.findingId) this.resolved.add(a.findingId);
    return a;
  }

  reject(id: string): ProposedAction {
    const a = this.mustPending(id);
    a.status = "rejected";
    a.resolvedAt = new Date().toISOString();
    return a;
  }

  private mustPending(id: string): ProposedAction {
    const a = this.actions.get(id);
    if (!a) throw new HttpError(404, "Action not found");
    if (a.status !== "pending") throw new HttpError(409, `Action is already ${a.status}`);
    return a;
  }
}

function simulatedOutcome(a: ProposedAction): string {
  const to = a.recipient ? ` to ${a.recipient}` : "";
  switch (a.channel) {
    case "email": return `Demo mode: the email${to} was not really sent.`;
    case "phone": return `Demo mode: no call was placed${to}. A voice agent would call and report back here.`;
    case "bank": return `Demo mode: no money moved and no rule was created at the bank.`;
    case "chat": return `Demo mode: no chat was started${to}.`;
    default: return `Demo mode: nothing was submitted${to}.`;
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
