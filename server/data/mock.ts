// Sample household used by the prototype. Every company here is fictional.
// Swap this module for a real data source (open banking, CSV import, email
// parsing) without touching the detectors or agents: they only see `Household`.

import type { Household, Transaction } from "../../shared/types";

/** Fixed "today" so the demo and the tests are deterministic. */
export const TODAY = "2026-10-13";

const MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

let seq = 0;
const tx = (
  date: string,
  merchant: string,
  amount: number,
  category: Transaction["category"],
  description = merchant,
  accountId = "acc-current",
): Transaction => ({
  id: `tx-${String(++seq).padStart(4, "0")}`,
  date,
  accountId,
  merchant,
  description,
  amount,
  category,
});

function buildTransactions(): Transaction[] {
  seq = 0;
  const out: Transaction[] = [];
  for (const m of MONTHS) {
    const isOct = m === "2026-10";
    // Income
    out.push(tx(`${m}-05`, "Studio Klient s.r.o.", 58000, "income", "Invoice payment"));
    out.push(tx(`${m}-08`, "Nordic Apps AB", 21000, "income", "Invoice payment"));

    // Subscriptions
    out.push(tx(`${m}-03`, "Netflix", -329, "subscription"));
    out.push(tx(`${m}-04`, "Spotify", -189, "subscription"));
    out.push(tx(`${m}-06`, "Disney+", -249, "subscription"));
    out.push(tx(`${m}-01`, "FitZone Gym", -990, "subscription", "Monthly membership"));
    out.push(tx(`${m}-11`, "Google One", -249, "subscription", "2 TB storage"));
    out.push(tx(`${m}-12`, "iCloud+", -249, "subscription", "2 TB storage"));
    const adobe = m >= "2026-09" ? -749 : -599;
    out.push(tx(`${m}-09`, "Adobe Creative Cloud", adobe, "subscription"));
    if (m >= "2026-09") out.push(tx(`${m}-10`, "LinguaPro", -399, "subscription", "Plan after free trial"));

    // Bank fees on the current account
    out.push(tx(`${m}-01`, "Classic Bank", -129, "bank_fee", "Account maintenance fee"));
    out.push(tx(`${m}-01`, "Classic Bank", -50, "bank_fee", "Debit card fee"));
    out.push(tx(`${m}-14`, "Classic Bank", -39, "bank_fee", "ATM withdrawal fee (other bank)"));

    if (isOct) continue; // October has only happened up to the 13th

    // Utilities, telecom, insurance
    out.push(tx(`${m}-15`, "Volna Mobile", -690, "telecom", "Mobile plan 20 GB"));
    const internet = m >= "2026-08" ? -599 : -299;
    out.push(tx(`${m}-16`, "FiberNet", internet, "telecom", "Home internet 500 Mb/s"));
    out.push(tx(`${m}-18`, "ProudCo Energie", -2450, "utilities", "Electricity and gas advance"));
    out.push(tx(`${m}-20`, "Jistota Insurance", -1150, "insurance", "Car insurance"));

    // Everyday spending
    out.push(tx(`${m}-07`, "Albert", -1840, "groceries"));
    out.push(tx(`${m}-14`, "Lidl", -1320, "groceries"));
    out.push(tx(`${m}-21`, "Albert", -2105, "groceries"));
    out.push(tx(`${m}-24`, "Kaufland", -1690, "groceries"));
    out.push(tx(`${m}-13`, "Bistro Na Rohu", -486, "dining"));
    out.push(tx(`${m}-22`, "Cafe Lounge", -215, "dining"));
    out.push(tx(`${m}-25`, "Vyšehrad Rent", -18500, "other", "Rent"));
    out.push(tx(`${m}-20`, "Tax office", -3000, "tax", "Income tax advance"));
  }

  // One-offs that the detectors should catch
  out.push(tx("2026-05-19", "Headspace", -1590, "subscription", "Annual plan renewal"));
  out.push(tx("2026-08-13", "Bistro Na Rohu", -486, "dining", "Card payment (duplicate)"));
  out.push(tx("2026-07-02", "Barcelona Tapas Bar", -1260, "travel", "EUR 50.00 card payment"));
  out.push(tx("2026-07-02", "Classic Bank", -32, "bank_fee", "Foreign transaction fee 2.5%"));
  out.push(tx("2026-07-03", "Sagrada Tickets", -890, "travel", "EUR 35.30 card payment"));
  out.push(tx("2026-07-03", "Classic Bank", -22, "bank_fee", "Foreign transaction fee 2.5%"));
  out.push(tx("2026-06-28", "SkyLark Air", -4380, "travel", "PRG-BCN return ticket"));
  out.push(tx("2026-09-02", "Ticketon", -1980, "shopping", "Concert tickets"));
  out.push(tx("2026-09-02", "Ticketon", -149, "shopping", "Service fee"));
  out.push(tx("2026-09-02", "Ticketon", -99, "shopping", "Ticket protection add-on"));
  out.push(tx("2026-08-18", "SoundMax", -2990, "shopping", "Wireless headphones"));
  out.push(tx("2026-06-10", "Classic Bank", -250, "bank_fee", "Paper statement fee"));

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function createHousehold(): Household {
  return {
    profile: {
      name: "Alex",
      country: "CZ",
      currency: "CZK",
      isFreelancer: true,
      annualIncomeEstimate: 948000,
      taxAdvancesPaid: 36000,
      childrenCount: 1,
      knownPayees: [
        { name: "FiberNet", iban: "CZ65 0800 0000 1920 0014 5399" },
        { name: "ProudCo Energie", iban: "CZ12 0300 0000 0002 7700 1234" },
        { name: "Vyšehrad Rent", iban: "CZ44 2010 0000 0024 0011 8877" },
      ],
    },
    accounts: [
      { id: "acc-current", name: "Everyday account", institution: "Classic Bank", kind: "current", balance: 284600, interestRate: 0, monthlyFee: 179 },
      { id: "acc-savings", name: "Savings", institution: "Classic Bank", kind: "savings", balance: 120000, interestRate: 0.5, monthlyFee: 0 },
    ],
    transactions: buildTransactions(),
    usage: [
      { merchant: "Netflix", lastUsed: "2026-10-11", usesLast30Days: 9 },
      { merchant: "Spotify", lastUsed: "2026-10-13", usesLast30Days: 41 },
      { merchant: "Disney+", lastUsed: "2026-06-02", usesLast30Days: 0 },
      { merchant: "FitZone Gym", lastUsed: "2026-05-20", usesLast30Days: 0 },
      { merchant: "Google One", lastUsed: "2026-10-12", usesLast30Days: 30 },
      { merchant: "iCloud+", lastUsed: "2026-10-12", usesLast30Days: 30 },
      { merchant: "Adobe Creative Cloud", lastUsed: "2026-10-09", usesLast30Days: 14 },
      { merchant: "LinguaPro", lastUsed: "2026-08-29", usesLast30Days: 0 },
      { merchant: "Headspace", lastUsed: "2026-09-30", usesLast30Days: 1 },
    ],
    contracts: [
      { id: "ct-mobile", provider: "Volna Mobile", kind: "mobile", monthlyCost: 690, startedOn: "2023-03-01", details: "20 GB, unlimited calls, no commitment", contact: { email: "care@volna.example", phone: "+420 800 100 100", chat: "volna.example/chat" } },
      { id: "ct-internet", provider: "FiberNet", kind: "internet", monthlyCost: 599, startedOn: "2026-02-01", promoEndsOn: "2026-07-31", details: "500 Mb/s fibre, promo 299 for 6 months", contact: { email: "support@fibernet.example", phone: "+420 800 200 200" } },
      { id: "ct-energy", provider: "ProudCo Energie", kind: "energy", monthlyCost: 2450, startedOn: "2024-01-01", details: "Electricity + gas, variable tariff, 3.1 MWh/yr", contact: { email: "zakaznici@proudco.example", phone: "+420 800 300 300" } },
      { id: "ct-insurance", provider: "Jistota Insurance", kind: "insurance", monthlyCost: 1150, startedOn: "2022-11-01", details: "Car liability + comprehensive, Škoda Octavia 2019, renews 1 Nov", contact: { email: "claims@jistota.example", phone: "+420 800 400 400" } },
    ],
    offers: [
      { provider: "Kapka Mobil", kind: "mobile", monthlyCost: 399, details: "25 GB, unlimited calls, no commitment" },
      { provider: "Sitka Net", kind: "internet", monthlyCost: 449, details: "500 Mb/s fibre, no promo cliff" },
      { provider: "Zelená Energie", kind: "energy", monthlyCost: 1990, details: "Fixed price 24 months for 3.1 MWh/yr" },
      { provider: "Klidná Pojišťovna", kind: "insurance", monthlyCost: 890, details: "Same cover, 10% no-claims bonus kept" },
      { provider: "Fér Banka", kind: "bank_account", monthlyCost: 0, details: "Free account, free card, free ATM withdrawals worldwide, no FX fee" },
      { provider: "Fér Banka", kind: "savings", monthlyCost: 0, rate: 4.1, details: "Instant-access savings, 4.1% p.a., deposit insured" },
      { provider: "Moudrá Spořka", kind: "savings", monthlyCost: 0, rate: 3.6, details: "Instant-access savings, 3.6% p.a." },
    ],
    trips: [
      { id: "trip-1", airline: "SkyLark Air", flight: "SL 1234", date: "2026-07-01", from: "PRG", to: "BCN", distanceKm: 1350, delayMinutes: 245, cancelled: false },
      { id: "trip-2", airline: "SkyLark Air", flight: "SL 1235", date: "2026-07-06", from: "BCN", to: "PRG", distanceKm: 1350, delayMinutes: 25, cancelled: false },
    ],
    purchases: [
      { id: "pur-1", date: "2026-08-18", merchant: "SoundMax", item: "Wireless headphones", price: 2990, warrantyMonths: 24, returnedOn: "2026-09-01", refundReceived: false },
      { id: "pur-2", date: "2025-08-04", merchant: "TechPoint", item: "Laptop ProBook 14", price: 32990, warrantyMonths: 24, issue: "Battery swelling, trackpad lifting" },
      { id: "pur-3", date: "2024-02-10", merchant: "TechPoint", item: "Coffee machine", price: 8990, warrantyMonths: 24 },
    ],
    inbox: [
      { id: "msg-1", receivedAt: "2026-10-12T08:14:00", channel: "sms", from: "+420 731 555 019", body: "Classic Bank: Your account has been BLOCKED due to suspicious activity. Verify your identity within 24h at https://classic-bank-secure.top/verify or lose access." },
      { id: "msg-2", receivedAt: "2026-10-10T16:02:00", channel: "email", from: "billing@fibernet-payments.co", subject: "FiberNet: updated bank details for your invoice", body: "Dear customer, due to an audit our bank account has changed. Please pay invoice FN-2026-10 of CZK 599 to the new account CZ03 2700 0000 0099 8811 2233 by tomorrow to avoid disconnection." },
      { id: "msg-3", receivedAt: "2026-10-09T09:30:00", channel: "email", from: "invoices@domain-registry-services.net", subject: "Domain renewal notice alex-design.cz", body: "Final notice: your domain listing expires. Pay CZK 4,900 for 'search engine registration' to IBAN LT12 3456 7890 1234 5678 within 3 days." },
      { id: "msg-4", receivedAt: "2026-10-01T10:00:00", channel: "email", from: "support@fibernet.example", subject: "Your October invoice", body: "Your invoice FN-2026-10 for CZK 599 is ready. Pay to CZ65 0800 0000 1920 0014 5399 as usual by 16 Oct." },
    ],
    invoices: [
      { id: "inv-101", kind: "issued", counterparty: "Studio Klient s.r.o.", issuedOn: "2026-09-01", dueOn: "2026-09-15", amount: 58000, paid: true, description: "Design retainer September" },
      { id: "inv-102", kind: "issued", counterparty: "Nordic Apps AB", issuedOn: "2026-09-01", dueOn: "2026-09-30", amount: 21000, paid: true, description: "UI work September" },
      { id: "inv-103", kind: "issued", counterparty: "Pekárna Dobrota", issuedOn: "2026-08-20", dueOn: "2026-09-03", amount: 14500, paid: false, description: "Logo and packaging" },
      { id: "inv-104", kind: "issued", counterparty: "Studio Klient s.r.o.", issuedOn: "2026-10-01", dueOn: "2026-10-15", amount: 58000, paid: false, description: "Design retainer October" },
      { id: "inv-201", kind: "received", counterparty: "Adobe Creative Cloud", issuedOn: "2026-09-09", dueOn: "2026-09-09", amount: 749, paid: true, description: "Software (business expense)" },
      { id: "inv-202", kind: "received", counterparty: "TechPoint", issuedOn: "2025-08-04", dueOn: "2025-08-04", amount: 32990, paid: true, description: "Laptop (business asset)" },
    ],
  };
}
