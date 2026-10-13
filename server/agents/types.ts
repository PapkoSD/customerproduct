import type { AgentInfo, ChatTarget } from "../../shared/types";
import type { AppState } from "../state";

/**
 * A tool an agent can call.
 * - "read" tools look at the household's data and run immediately.
 * - Outward actions are never tools of their own: agents call the shared
 *   `propose_action` tool, which only queues a draft for the user to approve.
 */
export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  run: (input: Record<string, unknown>, ctx: AgentContext) => unknown;
}

export interface AgentContext {
  state: AppState;
  agent: ChatTarget;
  /** Ids of actions proposed during this run. */
  proposed: string[];
}

/**
 * Everything that makes an agent. To add a new agent, write one of these in
 * `server/agents/specs/`, add a detector in `server/engine/`, and register both.
 * See AGENTS.md.
 */
export interface AgentSpec {
  info: AgentInfo;
  /** What this agent is for and how it should behave. Shared rules are added by the runtime. */
  instructions: string;
  /** Agent-specific read tools. Shared tools are added by the runtime. */
  tools: AgentTool[];
  /** Data the agent's page shows, beside its findings. */
  view?: (state: AppState) => unknown;
  /** Suggested first questions shown in the chat. */
  starters: string[];
}
