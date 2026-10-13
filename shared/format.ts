import type { Currency } from "./types";

const LOCALES: Record<Currency, string> = { CZK: "cs-CZ", EUR: "de-DE", USD: "en-US", GBP: "en-GB" };

export function money(amount: number, currency: Currency = "CZK"): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(Date.parse(date) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}
