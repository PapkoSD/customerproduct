import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../server/app";
import { createHousehold, TODAY } from "../server/data/mock";
import { detectAll } from "../server/engine";
import { taxSummary } from "../server/engine/taxes";
import { FALLBACK_RATES, getRates, rate, resetRateCache, type RateTable } from "../server/fx";
import { AppState } from "../server/state";

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const erApi = { result: "success", time_last_update_unix: 1791849600, rates: { EUR: 1, USD: 1.1, CZK: 24.5, GBP: 0.86, JPY: 170, PLN: 4.3, CHF: 0.94, SEK: 11, NOK: 11.5, DKK: 7.46, HUF: 400, bad: "x" } };

beforeEach(() => resetRateCache());
afterEach(() => vi.unstubAllGlobals());

describe("exchange rates", () => {
  it("uses the live source and caches it", async () => {
    const f = vi.fn(() => ok(erApi)) as unknown as typeof fetch;
    const t = await getRates(f, 1000);
    expect(t.live).toBe(true);
    expect(t.rates.CZK).toBe(24.5);
    expect(t.rates).not.toHaveProperty("bad");
    expect(t.rates.AED).toBe(FALLBACK_RATES.rates.AED); // snapshot fills gaps
    await getRates(f, 2000);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("falls back to the ECB source, then to the offline snapshot", async () => {
    const ecb = vi.fn((url: string) =>
      url.includes("er-api") ? Promise.reject(new Error("down")) : ok({ date: "2026-10-12", rates: erApi.rates }),
    ) as unknown as typeof fetch;
    expect((await getRates(ecb)).source).toMatch(/European Central Bank/);

    resetRateCache();
    const down = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    const t = await getRates(down);
    expect(t.live).toBe(false);
    expect(t.rates.CZK).toBeGreaterThan(0);
  });

  it("cross-converts through EUR", () => {
    expect(rate(FALLBACK_RATES, "CZK", "CZK")).toBe(1);
    expect(rate(FALLBACK_RATES, "EUR", "CZK")).toBe(FALLBACK_RATES.rates.CZK);
    expect(() => rate(FALLBACK_RATES, "CZK", "XXX")).toThrow();
  });
});

describe("household in another currency", () => {
  const table: RateTable = { base: "EUR", rates: { EUR: 1, CZK: 25, USD: 1.1, JPY: 170 }, source: "test", asOf: "2026-10-12", live: true };

  it("converts every amount and keeps the same findings", () => {
    const czk = createHousehold("CZK", table);
    const eur = createHousehold("EUR", table);
    expect(eur.profile.currency).toBe("EUR");
    expect(eur.accounts[0].balance).toBeCloseTo(czk.accounts[0].balance / 25, 2);
    expect(eur.transactions.find((t) => t.merchant === "Netflix")!.amount).toBeCloseTo(-329 / 25, 2);
    expect(detectAll(eur, TODAY).map((f) => f.id).sort()).toEqual(detectAll(czk, TODAY).map((f) => f.id).sort());
  });

  it("keeps EU and Czech rules right after conversion", () => {
    const eur = createHousehold("EUR", table);
    const flight = detectAll(eur, TODAY).find((f) => f.id === "owed-flight-trip-1")!;
    expect(flight.oneOffImpact).toBe(250);
    const czkRefund = taxSummary(createHousehold("CZK", table), TODAY).estimatedRefund;
    expect(taxSummary(eur, TODAY).estimatedRefund).toBeCloseTo(czkRefund / 25, 0);
  });

  it("rounds to the currency's own decimals", () => {
    const jpy = createHousehold("JPY", table);
    for (const t of jpy.transactions) expect(Number.isInteger(t.amount)).toBe(true);
  });
});

describe("currency API", () => {
  it("switches currency, clears old drafts and rejects unknown codes", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const app = createApp(new AppState());
    await request(app).post("/api/findings/cash-idle/draft").send({}).expect(200);

    await request(app).post("/api/settings/currency").send({ currency: "usd" }).expect(200);
    const o = await request(app).get("/api/overview").expect(200);
    expect(o.body.profile.currency).toBe("USD");
    expect(o.body.fx.live).toBe(false);
    expect((await request(app).get("/api/actions")).body).toHaveLength(0);

    await request(app).post("/api/settings/currency").send({ currency: "ZZZ" }).expect(400);
    const list = await request(app).get("/api/currencies").expect(200);
    expect(list.body.codes).toContain("EUR");
    expect(list.body.current).toBe("USD");
  });
});
