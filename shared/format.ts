import type { Currency } from "./types";

const formatters = new Map<string, Intl.NumberFormat[]>();

/** Format money in any ISO currency. Whole units from 100 up, cents below. */
export function money(amount: number, currency: Currency = "CZK"): string {
  let f = formatters.get(currency);
  if (!f) {
    const opts = { style: "currency", currency, currencyDisplay: "narrowSymbol" } as const;
    try {
      f = [new Intl.NumberFormat("en-GB", { ...opts, maximumFractionDigits: 0 }), new Intl.NumberFormat("en-GB", opts)];
    } catch {
      f = [new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }), new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 })];
    }
    formatters.set(currency, f);
  }
  return Math.abs(amount) >= 100 ? f[0].format(Math.round(amount)) : f[1].format(amount);
}

/** Decimal places a currency normally uses (JPY 0, EUR 2, ...). */
export function currencyDecimals(currency: Currency): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** A round step for amounts of this size: 37 000 -> 1 000, 1 480 -> 100. */
export function roundStep(amount: number): number {
  return Math.max(1, 10 ** (Math.floor(Math.log10(Math.max(1, Math.abs(amount)))) - 1));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(Date.parse(date) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}
