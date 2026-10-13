import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { AppState } from "../server/state";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp(new AppState());
});

describe("approval gate", () => {
  it("a draft is pending until the user approves it, then its finding closes", async () => {
    const draft = await request(app).post("/api/findings/sub-unused-disney/draft").send({}).expect(200);
    const [id] = draft.body.proposedActionIds;
    const list = await request(app).get("/api/actions").expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id, status: "pending", kind: "cancel_subscription" });

    const done = await request(app).post(`/api/actions/${id}/approve`).send({ draft: "Please cancel. Thanks!" }).expect(200);
    expect(done.body.status).toBe("done");
    expect(done.body.draft).toBe("Please cancel. Thanks!");
    expect(done.body.outcome).toMatch(/Demo mode/);

    const findings = await request(app).get("/api/findings").expect(200);
    expect(findings.body.map((f: { id: string }) => f.id)).not.toContain("sub-unused-disney");
    await request(app).post(`/api/actions/${id}/approve`).send({}).expect(409);
  });

  it("drafting the same finding twice does not duplicate it", async () => {
    await request(app).post("/api/findings/cash-idle/draft").send({}).expect(200);
    await request(app).post("/api/findings/cash-idle/draft").send({}).expect(200);
    const list = await request(app).get("/api/actions").expect(200);
    expect(list.body).toHaveLength(1);
  });

  it("rejecting keeps the finding open", async () => {
    const draft = await request(app).post("/api/findings/bill-ct-energy/draft").send({}).expect(200);
    await request(app).post(`/api/actions/${draft.body.proposedActionIds[0]}/reject`).send({}).expect(200);
    const findings = await request(app).get("/api/findings").expect(200);
    expect(findings.body.map((f: { id: string }) => f.id)).toContain("bill-ct-energy");
  });
});

describe("api", () => {
  it("overview totals add up", async () => {
    const o = await request(app).get("/api/overview").expect(200);
    expect(o.body.mode).toBe("offline");
    expect(o.body.agents).toHaveLength(7);
    const yearly = o.body.agents.reduce((n: number, a: { yearlyImpact: number }) => n + a.yearlyImpact, 0);
    expect(o.body.totals.yearly).toBe(yearly);
  });

  it("offline chat answers and specialists draft their actions", async () => {
    const r = await request(app).post("/api/chat/subscriptions").send({ message: "What should I cancel?" }).expect(200);
    expect(r.body.mode).toBe("offline");
    expect(r.body.proposedActionIds.length).toBeGreaterThan(0);
  });

  it("validates input and unknown routes", async () => {
    await request(app).post("/api/chat/subscriptions").send({}).expect(400);
    await request(app).post("/api/chat/nope").send({ message: "hi" }).expect(404);
    await request(app).post("/api/findings/nope/draft").send({}).expect(404);
    await request(app).post("/api/actions/nope/approve").send({}).expect(404);
    await request(app).get("/api/nope").expect(404);
  });

  it("blocks cross-site style requests", async () => {
    await request(app).post("/api/reset").set("Content-Type", "text/plain").send("x").expect(415);
    await request(app).get("/api/overview").set("Host", "evil.example").expect(403);
  });

  it("checks pasted messages for scams", async () => {
    const r = await request(app)
      .post("/api/scam/check")
      .send({ text: "Your account is blocked. Verify your identity at https://mybank-secure.top/login immediately", from: "+420 700 000 000" })
      .expect(200);
    expect(r.body.verdict).toBe("scam");
  });
});
