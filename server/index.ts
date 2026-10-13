import "./env";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app";
import { AppState } from "./state";
import { hasClaude, MODEL } from "./agents/runtime";

const state = new AppState();
const app = createApp(state);
// Optional starting currency, e.g. DEFAULT_CURRENCY=EUR. Fetches live rates.
if (process.env.DEFAULT_CURRENCY) {
  state.setCurrency(process.env.DEFAULT_CURRENCY).catch((e) => console.warn(`DEFAULT_CURRENCY ignored: ${e.message}`));
}

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 8787;
// Bind to localhost: this prototype has no login, so it must not be exposed on a network.
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => {
  console.log(`Penny API on http://${host}:${port} (${hasClaude() ? `Claude: ${MODEL}` : "offline mode, no API key"})`);
});
