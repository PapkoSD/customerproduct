import express, { type NextFunction, type Request, type Response } from "express";
import type { AgentId, ChatMessage, ChatTarget, Overview } from "../shared/types";
import { AGENTS, getAgent } from "./agents/registry";
import { draftForFinding, hasClaude, runAgent } from "./agents/runtime";
import { assessMessage } from "./engine/scam";
import { getRates } from "./fx";
import { AppState, HttpError } from "./state";

export function createApp(state = new AppState()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  // No login yet, so guard against other websites driving the local API:
  // reject unknown Host headers (DNS rebinding) and require JSON on writes,
  // which browsers can't send cross-site without a CORS preflight we never allow.
  const allowedHosts = (process.env.ALLOWED_HOSTS ?? "localhost,127.0.0.1").split(",").map((h) => h.trim());
  app.use("/api", (req, _res, next) => {
    const host = (req.hostname ?? "").toLowerCase();
    if (!allowedHosts.includes(host)) throw new HttpError(403, "Host not allowed");
    if (req.method !== "GET" && !req.is("application/json")) throw new HttpError(415, "Send JSON");
    next();
  });

  app.get("/api/overview", (_req, res) => {
    const findings = state.findings();
    const sum = (k: "yearlyImpact" | "oneOffImpact", list = findings) => list.reduce((n, f) => n + (f[k] ?? 0), 0);
    const body: Overview = {
      profile: state.household.profile,
      accounts: state.household.accounts,
      agents: AGENTS.map((a) => {
        const own = findings.filter((f) => f.agent === a.info.id);
        return { ...a.info, findingCount: own.length, yearlyImpact: sum("yearlyImpact", own), oneOffImpact: sum("oneOffImpact", own) };
      }),
      totals: {
        yearly: sum("yearlyImpact"),
        oneOff: sum("oneOffImpact"),
        findings: findings.length,
        pendingActions: state.listActions().filter((a) => a.status === "pending").length,
      },
      mode: hasClaude() ? "claude" : "offline",
      fx: state.household.fx,
    };
    res.json(body);
  });

  app.get("/api/findings", (_req, res) => res.json(state.findings()));

  app.post("/api/findings/:id/draft", async (req, res) => {
    if (!state.findings().some((f) => f.id === req.params.id)) throw new HttpError(404, "Finding not found");
    res.json(await draftForFinding(state, req.params.id));
  });

  app.get("/api/agents/:id", (req, res) => {
    const spec = getAgent(req.params.id);
    if (!spec) throw new HttpError(404, "Unknown agent");
    res.json({
      info: spec.info,
      starters: spec.starters,
      findings: state.findings(spec.info.id as AgentId),
      view: spec.view?.(state) ?? null,
    });
  });

  app.post("/api/chat/:target", async (req, res) => {
    const target = req.params.target as ChatTarget;
    if (target !== "penny" && !getAgent(target)) throw new HttpError(404, "Unknown agent");
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) throw new HttpError(400, "message is required");
    const history: ChatMessage[] = Array.isArray(req.body?.history)
      ? req.body.history
          .filter((m: unknown): m is ChatMessage => {
            const x = m as ChatMessage;
            return (x?.role === "user" || x?.role === "assistant") && typeof x.text === "string";
          })
          .map((m: ChatMessage) => ({ role: m.role, text: m.text }))
      : [];
    res.json(await runAgent(state, target, message, history));
  });

  app.post("/api/scam/check", (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.slice(0, 10_000) : "";
    if (!text.trim()) throw new HttpError(400, "text is required");
    const from = typeof req.body?.from === "string" ? req.body.from.slice(0, 200) : "";
    res.json(assessMessage(text, from, state.household.profile));
  });

  app.get("/api/transactions", (_req, res) => res.json(state.household.transactions));
  app.get("/api/actions", (_req, res) => res.json(state.listActions()));

  app.post("/api/actions/:id/approve", (req, res) => {
    const draft = typeof req.body?.draft === "string" ? req.body.draft : undefined;
    res.json(state.approve(req.params.id, draft));
  });
  app.post("/api/actions/:id/reject", (req, res) => res.json(state.reject(req.params.id)));

  app.get("/api/currencies", async (_req, res) => {
    const rates = await getRates();
    res.json({ current: state.currency, codes: Object.keys(rates.rates).sort(), source: rates.source, asOf: rates.asOf, live: rates.live });
  });

  app.post("/api/settings/currency", async (req, res) => {
    const code = typeof req.body?.currency === "string" ? req.body.currency : "";
    await state.setCurrency(code);
    res.json({ ok: true, fx: state.household.fx });
  });

  app.post("/api/reset", (_req, res) => {
    state.reset();
    res.json({ ok: true });
  });

  app.use("/api", (_req, _res) => {
    throw new HttpError(404, "Not found");
  });

  // Express 5 forwards async errors here too.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });
  return app;
}
