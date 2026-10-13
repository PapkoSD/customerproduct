# Penny: AI money agents for everyday people

In this repo I am trying to figure out a way how to implement AI into the average person's life. For now this is just for testing. :P

Penny is a friendly web app where a small team of AI agents looks after your money. Each agent finds something, explains it in plain words and **drafts** the fix. Nothing leaves the app until you approve it.

| Agent | What it does |
|---|---|
| 🔍 Subscription Hunter | Finds forgotten, barely used and overlapping subscriptions, and trials that turned paid. Drafts cancellations. |
| 🤝 Bill Negotiator | Compares mobile, internet, energy and insurance with the market. Drafts a voice-agent call script, email or switch. |
| 🧾 Fee Detector | Duplicate charges, hidden add-on fees, price hikes after promos, bank and FX fees. |
| 💸 Money Owed to You | Missing refunds, EU 261 flight compensation, warranty claims, tax refunds and credits. |
| 🏦 Smart Cash | Keeps a safety buffer, moves idle cash to a better rate through a rule you approve. |
| 🛡️ Scam Shield | Checks texts, emails and invoices for phishing and changed bank details. |
| 📅 Taxes & Freelance Admin | Unpaid invoices, deadlines, and a tax return worksheet. |

Plus **Ask Penny**, a coordinator chat that can use every agent's tools.

**Any currency:** pick one in the top bar. Every amount, finding and draft is converted at live exchange rates from free sources that need no API key ([ExchangeRate-API open access](https://www.exchangerate-api.com/docs/free), with [ECB rates via Frankfurter](https://frankfurter.dev) as backup), cached for 6 hours. Without internet the app uses a bundled rate snapshot and says so in the footer. Rules set in a fixed currency stay correct: EU flight compensation is always €250/€400/€600, and the Czech tax credits are converted from CZK.

> ⚠️ Prototype. It runs on made-up sample data for one Czech freelancer, written in CZK. No bank, provider, email, phone call or payment is ever contacted: approving an action only simulates it. Tax and legal rules are simplified estimates.

## Run it

```bash
npm install
cp .env.example .env      # optional: add ANTHROPIC_API_KEY to turn the AI on
npm run dev               # http://localhost:5173
```

Without an API key the app runs in **offline mode**: the detectors still find everything and drafts come from templates. With a key, the agents run on Claude (`claude-opus-5-5`, override with `PENNY_MODEL`) and write the replies and drafts themselves.

```bash
npm test          # detectors, approval gate, agent loop (Claude mocked)
npm run typecheck
npm run build && npm start   # production build served on http://127.0.0.1:8787
```

## How it fits together

```
shared/types.ts         data model shared by server and web
server/data/mock.ts     the sample household (swap for real data later)
server/engine/          deterministic detectors, one per agent, plus draft templates
server/agents/          agent specs, the registry and the shared Claude runtime
server/state.ts         findings + the approval queue (in memory)
server/app.ts           HTTP API
web/src/                React UI
```

The key design rule: **agents can read anything but can only act through `propose_action`**, which puts a draft in the Approvals inbox. The user can edit the draft, approve or decline. See [AGENTS.md](AGENTS.md) for how agents are built and how to add a new one.

## Security notes

- No secrets in the repo. The API key is read from the environment or a git-ignored `.env`.
- The server binds to `127.0.0.1` because there is no login yet. Don't expose it to a network as is.
- Message and invoice text is treated as untrusted data in the agent prompts, and tool inputs from the model are validated before they touch the approval queue.
