import type { AgentInfo, AgentRunResult, ChatMessage, ChatTarget, Finding, Overview, ProposedAction } from "../../shared/types";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

const post = <T,>(path: string, body: unknown = {}) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

export interface AgentDetail {
  info: AgentInfo;
  starters: string[];
  findings: Finding[];
  view: Record<string, any> | null;
}

export const api = {
  overview: () => call<Overview>("/overview"),
  findings: () => call<Finding[]>("/findings"),
  agent: (id: string) => call<AgentDetail>(`/agents/${id}`),
  chat: (target: ChatTarget, message: string, history: ChatMessage[]) => post<AgentRunResult>(`/chat/${target}`, { message, history }),
  draft: (findingId: string) => post<AgentRunResult>(`/findings/${encodeURIComponent(findingId)}/draft`),
  actions: () => call<ProposedAction[]>("/actions"),
  approve: (id: string, draft?: string) => post<ProposedAction>(`/actions/${id}/approve`, { draft }),
  reject: (id: string) => post<ProposedAction>(`/actions/${id}/reject`),
  scamCheck: (text: string, from: string) =>
    post<{ verdict: "safe" | "suspicious" | "scam"; score: number; reasons: string[]; advice: string }>("/scam/check", { text, from }),
  reset: () => post<{ ok: true }>("/reset"),
  currencies: () => call<{ current: string; codes: string[]; source: string; asOf: string; live: boolean }>("/currencies"),
  setCurrency: (currency: string) => post<{ ok: true }>("/settings/currency", { currency }),
};
