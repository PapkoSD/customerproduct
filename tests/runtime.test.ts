import { beforeEach, describe, expect, it, vi } from "vitest";

// A scripted stand-in for Claude: first asks for findings, then proposes an
// action, then answers. Lets us test the loop and the approval gate offline.
const script: unknown[] = [];
const requests: any[] = [];
const create = vi.fn(async (params: unknown) => {
  requests.push(structuredClone(params)); // the runtime keeps appending to the same array
  return script.shift();
});
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));

const { runAgent } = await import("../server/agents/runtime");
const { AppState } = await import("../server/state");

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  create.mockClear();
  requests.length = 0;
  script.length = 0;
});

const toolUse = (id: string, name: string, input: object) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input }],
});

describe("agent runtime with Claude", () => {
  it("runs tools, queues proposals as pending, and returns the reply", async () => {
    script.push(
      toolUse("t1", "get_findings", {}),
      toolUse("t2", "propose_action", {
        kind: "cancel_subscription",
        title: "Cancel Disney+",
        summary: "Cancel at period end",
        channel: "web",
        draft: "Hello, please cancel my Disney+ subscription at the end of this period.",
        finding_id: "sub-unused-disney",
      }),
      { stop_reason: "end_turn", content: [{ type: "text", text: "Drafted a cancellation for Disney+. Approve it in your inbox." }] },
    );
    const state = new AppState();
    const r = await runAgent(state, "subscriptions", "Cancel what I don't use");
    expect(r.mode).toBe("claude");
    expect(r.reply).toMatch(/Disney\+/);
    expect(r.toolCalls.map((t) => t.name)).toEqual(["get_findings", "propose_action"]);
    expect(state.listActions()).toHaveLength(1);
    expect(state.listActions()[0].status).toBe("pending");

    expect(requests[0].model).toBe("claude-opus-5-5");
    expect(requests[0].tools.map((t: { name: string }) => t.name)).toContain("propose_action");
    expect(requests[0].system).toMatch(/never say something was sent/i);
  });

  it("rejects proposals for another agent's finding", async () => {
    script.push(
      toolUse("t1", "propose_action", { kind: "move_money", title: "Move", summary: "x", channel: "bank", draft: "Move all the money now please", finding_id: "cash-idle" }),
      { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] },
    );
    const state = new AppState();
    await runAgent(state, "subscriptions", "move my cash");
    expect(state.listActions()).toHaveLength(0);
    const toolResult = requests[1].messages.at(-1).content[0].content;
    expect(toolResult).toMatch(/another agent/);
  });
});
