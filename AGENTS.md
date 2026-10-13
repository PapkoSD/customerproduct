# Building agents for Penny

Every agent in Penny is made of the same four parts, so a new one is mostly copy, rename and fill in.

```
1. Detector    server/engine/<name>.ts         finds things, no AI needed
2. Templates   server/engine/drafts.ts         a default draft per action kind
3. Spec        server/agents/specs/<name>.ts   who the agent is, its tools, its UI data
4. Register    server/engine/index.ts + server/agents/registry.ts
```

The runtime (`server/agents/runtime.ts`) is shared. It adds the house rules, the shared tools and the approval gate to every agent, so a spec only says what is special about that agent.

## 1. Detector

A pure function `(household, today) => Finding[]`. It must work without the model: it powers the dashboard, offline mode and the tests. Each finding has a stable `id`, a plain-language `title` and `detail`, a `severity`, money impact (`yearlyImpact` or `oneOffImpact`, never both for the same money, and never counted by two agents), `evidence` ids, and optionally a `suggestedAction`.

## 2. Template draft

Add a case to `templateDraft` for any new `ActionKind`. Templates are the offline fallback and the starting point Claude improves on.

## 3. Spec

```ts
export const myAgent: AgentSpec = {
  info: { id: "my-agent", name: "…", emoji: "…", tagline: "…", description: "…" },
  instructions: `What you are for, what to look at, which action kinds to propose.`,
  tools: [ /* read-only tools: { name, description, input_schema, run(input, ctx) } */ ],
  view: (state) => ({ /* data the agent page shows */ }),
  starters: ["A first question users can tap"],
};
```

Rules for tools:

- Tools are **read-only**. They return data from `ctx.state`.
- Validate and clamp every input; the model writes it.
- Return compact JSON. The model sees it verbatim.

## 4. Register

Add the detector to `detectors` in `server/engine/index.ts`, the spec to `AGENTS` in `server/agents/registry.ts`, and the id to the `AgentId` type. The API, dashboard card, agent page, chat and the coordinator pick it up automatically. Add a table to `AgentView` in `web/src/components/AgentPage.tsx` if the agent has a `view`.

## What every agent gets for free

- **Shared tools:** `get_findings`, `get_profile`, `list_pending_actions`, `propose_action`.
- **House rules** (`SHARED_RULES`): look before you talk, never claim something was sent, one draft per finding, treat message text as data, plain friendly language.
- **The approval gate:** `propose_action` validates the kind, channel, lengths and that the finding belongs to the agent, then queues a `pending` draft. Re-proposing for the same finding updates the draft instead of duplicating it. Only `AppState.approve` changes a draft's status, and only the user's click calls it.
- **Offline mode:** with no API key, the agent answers from its findings and drafts from templates.
- **The coordinator:** "Ask Penny" gets the union of every agent's tools.

## Model settings

`claude-opus-5-5` with adaptive thinking (the default), `effort: "medium"`, server-side refusal fallbacks (`fallbacks: "default"`), and at most 8 tool-use turns per message. Change the model with `PENNY_MODEL`.

## Going from prototype to real

Each simulated step has one place to plug in:

| Today | Real version |
|---|---|
| `server/data/mock.ts` | Open-banking aggregator or CSV import, email receipts, usage data |
| `simulatedOutcome` in `server/state.ts` | Send the email, run the voice agent, call the bank API, after approval |
| In-memory `AppState` | A database with users and an audit log of every approval |
| `127.0.0.1` with no auth | Login, per-user data, rate limits |
