import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const STORAGE_KEY = "penny.currency";

export function savedCurrency(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function remember(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode or blocked storage: the choice just won't survive a restart.
  }
}

/** Pick any currency the live rate source knows. Everything is converted on the server. */
export function CurrencyPicker({ current, pendingDrafts, onChanged }: { current: string; pendingDrafts: number; onChanged: () => void }) {
  const [codes, setCodes] = useState<string[]>([current]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.currencies().then((c) => setCodes(c.codes)).catch(() => {});
  }, []);

  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames(undefined, { type: "currency" });
    } catch {
      return null;
    }
  }, []);
  const label = (c: string) => {
    const n = names?.of(c);
    return n && n !== c ? `${c} · ${n}` : c;
  };

  const change = async (code: string) => {
    if (code === current) return;
    if (pendingDrafts > 0 && !window.confirm("Switching currency clears the drafts waiting in Approvals, because they quote the old amounts. Continue?")) return;
    setBusy(true);
    try {
      await api.setCurrency(code);
      remember(code);
      onChanged();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <select className="currency" value={current} disabled={busy} onChange={(e) => change(e.target.value)} aria-label="Currency">
      {codes.map((c) => (
        <option key={c} value={c}>{label(c)}</option>
      ))}
    </select>
  );
}
