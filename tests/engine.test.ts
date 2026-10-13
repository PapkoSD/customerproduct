import { describe, expect, it } from "vitest";
import { createHousehold, TODAY } from "../server/data/mock";
import { detectAll } from "../server/engine";
import { cashPlan } from "../server/engine/cash";
import { eu261Compensation } from "../server/engine/owed";
import { assessMessage } from "../server/engine/scam";
import { listSubscriptions } from "../server/engine/subscriptions";
import { taxSummary } from "../server/engine/taxes";
import { templateDraft } from "../server/engine/drafts";

const h = createHousehold();
const findings = detectAll(h, TODAY);
const ids = findings.map((f) => f.id);

describe("subscription hunter", () => {
  it("groups recurring charges and detects annual plans", () => {
    const subs = listSubscriptions(h);
    expect(subs.find((s) => s.merchant === "Headspace")?.billing).toBe("annual");
    expect(subs.find((s) => s.merchant === "Netflix")?.monthlyCost).toBe(329);
  });
  it("flags forgotten, barely used, converted trials and overlaps, not well-used ones", () => {
    expect(ids).toContain("sub-unused-disney");
    expect(ids).toContain("sub-unused-fitzone-gym");
    expect(ids).toContain("sub-trial-linguapro");
    expect(ids).toContain("sub-rare-headspace");
    expect(ids).toContain("sub-overlap-2-tb-storage");
    expect(ids.some((i) => i.includes("spotify") || i.includes("netflix"))).toBe(false);
  });
});

describe("fee detector", () => {
  it("finds the duplicate charge, hidden fees and bank fees", () => {
    expect(ids.filter((i) => i.startsWith("fee-dup-"))).toHaveLength(1);
    expect(ids.filter((i) => i.startsWith("fee-hidden-"))).toHaveLength(2);
    expect(ids).toContain("fee-bank");
  });
  it("counts the Adobe hike but leaves the contract hike to the negotiator", () => {
    expect(findings.find((f) => f.id === "fee-hike-adobe-creative-cloud")?.yearlyImpact).toBe(1800);
    expect(findings.find((f) => f.id === "fee-hike-fibernet")?.yearlyImpact).toBeUndefined();
  });
});

describe("bill negotiator", () => {
  it("compares each contract with the cheapest equivalent offer", () => {
    expect(findings.find((f) => f.id === "bill-ct-energy")?.yearlyImpact).toBe((2450 - 1990) * 12);
    expect(findings.filter((f) => f.agent === "negotiator")).toHaveLength(4);
  });
});

describe("money owed", () => {
  it("applies EU 261 bands", () => {
    expect(eu261Compensation(1350, 245, false)).toBe(250);
    expect(eu261Compensation(2000, 200, false)).toBe(400);
    expect(eu261Compensation(5000, 0, true)).toBe(600);
    expect(eu261Compensation(1350, 170, false)).toBe(0);
  });
  it("finds the flight, missing refund, warranty and tax refund", () => {
    expect(ids).toEqual(expect.arrayContaining(["owed-flight-trip-1", "owed-refund-pur-1", "owed-warranty-pur-2", "owed-tax-refund"]));
    expect(ids).not.toContain("owed-flight-trip-2");
    expect(ids).not.toContain("owed-warranty-pur-3");
  });
});

describe("smart cash", () => {
  it("keeps a buffer of two months of spending and moves the rest", () => {
    const plan = cashPlan(h, TODAY);
    const current = h.accounts.find((a) => a.kind === "current")!;
    const move = plan.moves.find((m) => m.fromAccountId === current.id)!;
    expect(plan.buffer).toBeGreaterThanOrEqual(plan.monthlySpending * 2);
    expect(current.balance - move.amount).toBeGreaterThanOrEqual(plan.buffer);
    expect(plan.bestRate).toBe(4.1);
  });
});

describe("scam shield", () => {
  const p = h.profile;
  it("flags the fake bank SMS, the changed IBAN and the fake domain invoice", () => {
    for (const m of h.inbox.slice(0, 3)) expect(assessMessage(m.body + " " + (m.subject ?? ""), m.from, p).verdict).toBe("scam");
  });
  it("trusts the real invoice to the known account number", () => {
    const real = h.inbox[3];
    expect(assessMessage(real.body + " " + real.subject, real.from, p).verdict).toBe("safe");
  });
});

describe("taxes", () => {
  it("estimates tax with credits and the refund", () => {
    const t = taxSummary(h, TODAY);
    expect(t.taxBase).toBe(379200);
    expect(t.estimatedTax).toBe(56880 - 30840 - 15204);
    expect(t.estimatedRefund).toBe(36000 - t.estimatedTax);
    expect(ids).toContain("tax-overdue-inv-103");
  });
});

describe("drafts", () => {
  it("every finding with a suggested action gets a usable template draft", () => {
    for (const f of findings.filter((x) => x.suggestedAction)) {
      const d = templateDraft(f, h, TODAY);
      expect(d, f.id).not.toBeNull();
      expect(d!.draft.length, f.id).toBeGreaterThan(40);
      expect(d!.findingId).toBe(f.id);
    }
  });
});
