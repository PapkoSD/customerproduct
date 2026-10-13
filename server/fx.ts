// Exchange rates. Live rates come from free sources that need no API key;
// if both are unreachable the app falls back to a bundled snapshot so it
// still works offline. All rates are "units of currency per 1 EUR".

export interface RateTable {
  base: "EUR";
  rates: Record<string, number>;
  source: string;
  asOf: string;
  live: boolean;
}

/** Approximate snapshot for offline use only. */
export const FALLBACK_RATES: RateTable = {
  base: "EUR",
  source: "Bundled offline snapshot (approximate)",
  asOf: "2026-10-01",
  live: false,
  rates: {
    EUR: 1, USD: 1.09, GBP: 0.85, CZK: 25.0, PLN: 4.28, HUF: 395, CHF: 0.95, SEK: 11.4,
    NOK: 11.6, DKK: 7.46, RON: 4.97, BGN: 1.96, ISK: 150, TRY: 38.5, UAH: 45.0, RSD: 117,
    JPY: 165, CNY: 7.85, HKD: 8.5, SGD: 1.45, KRW: 1500, INR: 92, IDR: 17500, THB: 38.5,
    MYR: 4.9, PHP: 62, VND: 27500, AUD: 1.65, NZD: 1.8, CAD: 1.49, MXN: 20.5, BRL: 6.0,
    ARS: 1050, CLP: 1020, COP: 4500, ZAR: 19.8, EGP: 53, NGN: 1700, KES: 140, AED: 4.0,
    SAR: 4.09, ILS: 4.05, QAR: 3.97,
  },
};

const TTL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;
const CODE = /^[A-Z]{3}$/;

let cache: { table: RateTable; fetchedAt: number } | null = null;

type Fetch = typeof fetch;

async function getJson(url: string, fetchImpl: Fetch): Promise<any> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

/** Keep only sane entries: 3-letter codes with positive finite rates. */
function clean(rates: unknown): Record<string, number> {
  const out: Record<string, number> = { EUR: 1 };
  if (!rates || typeof rates !== "object") return out;
  for (const [k, v] of Object.entries(rates as Record<string, unknown>)) {
    if (CODE.test(k) && typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return out;
}

const SOURCES: { name: string; load: (f: Fetch) => Promise<RateTable> }[] = [
  {
    // ~160 currencies, daily, no key. https://www.exchangerate-api.com/docs/free
    name: "open.er-api.com",
    load: async (f) => {
      const j = await getJson("https://open.er-api.com/v6/latest/EUR", f);
      if (j?.result !== "success") throw new Error("open.er-api.com: bad response");
      const asOf = new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10);
      return { base: "EUR", rates: clean(j.rates), source: "ExchangeRate-API (open.er-api.com)", asOf, live: true };
    },
  },
  {
    // European Central Bank reference rates, ~30 currencies, no key.
    name: "frankfurter",
    load: async (f) => {
      const j = await getJson("https://api.frankfurter.dev/v1/latest?base=EUR", f);
      return { base: "EUR", rates: clean(j?.rates), source: "European Central Bank via Frankfurter", asOf: String(j?.date ?? ""), live: true };
    },
  },
];

/** Live rates (cached for 6 hours), or the bundled snapshot if no source answers. */
export async function getRates(fetchImpl: Fetch = fetch, now = Date.now()): Promise<RateTable> {
  if (cache && now - cache.fetchedAt < TTL_MS) return cache.table;
  for (const s of SOURCES) {
    try {
      const table = await s.load(fetchImpl);
      if (Object.keys(table.rates).length < 10) throw new Error(`${s.name}: too few rates`);
      // Keep any snapshot currency the live source lacks, so a choice never disappears.
      table.rates = { ...FALLBACK_RATES.rates, ...table.rates };
      cache = { table, fetchedAt: now };
      return table;
    } catch (err) {
      console.warn(`Exchange rates: ${s.name} unavailable (${(err as Error).message})`);
    }
  }
  // Retry live sources in 10 minutes rather than on every request.
  cache = { table: FALLBACK_RATES, fetchedAt: now - TTL_MS + 10 * 60 * 1000 };
  return FALLBACK_RATES;
}

export function resetRateCache() {
  cache = null;
}

/** How many `to` you get for one `from`. */
export function rate(table: RateTable, from: string, to: string): number {
  const f = table.rates[from];
  const t = table.rates[to];
  if (!f || !t) throw new Error(`No exchange rate for ${!f ? from : to}`);
  return t / f;
}
