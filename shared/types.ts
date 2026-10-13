// Types shared by the API server and the web app.

/** ISO 4217 code, e.g. "CZK", "EUR", "USD". */
export type Currency = string;

export interface Account {
  id: string;
  name: string;
  institution: string;
  kind: "current" | "savings" | "credit";
  balance: number;
  interestRate: number; // annual, percent
  monthlyFee: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO yyyy-mm-dd
  accountId: string;
  merchant: string;
  description: string;
  amount: number; // negative = money out
  category:
    | "subscription"
    | "utilities"
    | "telecom"
    | "insurance"
    | "groceries"
    | "dining"
    | "travel"
    | "shopping"
    | "bank_fee"
    | "income"
    | "transfer"
    | "tax"
    | "other";
}

/** Signals about how much a subscription is actually used (would come from email/app usage data). */
export interface UsageSignal {
  merchant: string;
  lastUsed: string | null;
  usesLast30Days: number;
}

export interface Contract {
  id: string;
  provider: string;
  kind: "mobile" | "internet" | "energy" | "insurance";
  monthlyCost: number;
  startedOn: string;
  promoEndsOn?: string;
  details: string;
  contact: { email?: string; phone?: string; chat?: string };
}

export interface MarketOffer {
  provider: string;
  kind: Contract["kind"] | "savings" | "bank_account";
  /** For savings offers: annual interest rate in percent. */
  rate?: number;
  monthlyCost: number;
  details: string;
}

export interface Trip {
  id: string;
  airline: string;
  flight: string;
  date: string;
  from: string;
  to: string;
  distanceKm: number;
  delayMinutes: number;
  cancelled: boolean;
}

export interface Purchase {
  id: string;
  date: string;
  merchant: string;
  item: string;
  price: number;
  warrantyMonths: number;
  issue?: string;
  returnedOn?: string;
  refundReceived?: boolean;
}

export interface InboxMessage {
  id: string;
  receivedAt: string;
  channel: "sms" | "email";
  from: string;
  subject?: string;
  body: string;
}

export interface Invoice {
  id: string;
  kind: "issued" | "received";
  counterparty: string;
  issuedOn: string;
  dueOn: string;
  amount: number;
  paid: boolean;
  iban?: string;
  description: string;
}

export interface Profile {
  name: string;
  country: string;
  currency: Currency;
  isFreelancer: boolean;
  annualIncomeEstimate: number;
  taxAdvancesPaid: number;
  childrenCount: number;
  knownPayees: { name: string; iban: string }[];
}

/** How the household's money was converted from the sample data's base currency. */
export interface FxInfo {
  base: Currency;
  /** Units of the display currency per 1 unit of base. */
  rate: number;
  /** Units of the display currency per 1 EUR (for EU rules set in euros). */
  perEur: number;
  source: string;
  asOf: string;
  live: boolean;
}

export interface Household {
  fx: FxInfo;
  profile: Profile;
  accounts: Account[];
  transactions: Transaction[];
  usage: UsageSignal[];
  contracts: Contract[];
  offers: MarketOffer[];
  trips: Trip[];
  purchases: Purchase[];
  inbox: InboxMessage[];
  invoices: Invoice[];
}

export type AgentId =
  | "subscriptions"
  | "negotiator"
  | "fees"
  | "owed"
  | "cash"
  | "scam"
  | "taxes";

/** A specialist agent, or "penny", the coordinator that can use every agent's tools. */
export type ChatTarget = AgentId | "penny";

export type Severity = "info" | "save" | "warn" | "danger";

/** Something a detector found. Deterministic, so it works without the model. */
export interface Finding {
  id: string;
  agent: AgentId;
  title: string;
  detail: string;
  severity: Severity;
  /** Estimated money saved or recovered per year (positive), if applicable. */
  yearlyImpact?: number;
  /** One-off money that can be recovered. */
  oneOffImpact?: number;
  evidence: string[]; // transaction / record ids
  suggestedAction?: ActionKind;
  /** Set when a draft for this finding is already waiting for approval. */
  hasDraft?: boolean;
}

export type ActionKind =
  | "cancel_subscription"
  | "send_email"
  | "start_chat"
  | "place_call"
  | "switch_provider"
  | "file_claim"
  | "move_money"
  | "create_rule"
  | "block_payment"
  | "prepare_filing";

export type ActionStatus = "pending" | "approved" | "rejected" | "done";

/**
 * An outward action. Agents can only ever propose these; nothing leaves the
 * app until the user approves, and in this prototype "done" is simulated.
 */
export interface ProposedAction {
  id: string;
  agent: ChatTarget;
  kind: ActionKind;
  title: string;
  summary: string;
  channel?: "email" | "chat" | "phone" | "web" | "bank";
  recipient?: string;
  /** The exact draft the user is approving: email body, call script, rule text. */
  draft: string;
  estimatedYearlySaving?: number;
  estimatedOneOff?: number;
  status: ActionStatus;
  createdAt: string;
  resolvedAt?: string;
  outcome?: string;
  findingId?: string;
}

export interface AgentInfo {
  id: AgentId;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface AgentRunResult {
  agent: ChatTarget;
  reply: string;
  mode: "claude" | "offline";
  proposedActionIds: string[];
  toolCalls: { name: string; input: unknown }[];
}

export interface Overview {
  profile: Profile;
  accounts: Account[];
  agents: (AgentInfo & { findingCount: number; yearlyImpact: number; oneOffImpact: number })[];
  totals: { yearly: number; oneOff: number; findings: number; pendingActions: number };
  mode: "claude" | "offline";
  fx: FxInfo;
}
