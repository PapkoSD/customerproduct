import { useState } from "react";
import type { Currency, Finding } from "../../../shared/types";
import { money } from "../../../shared/format";
import { api } from "../api";

const SEVERITY_LABEL = { info: "Heads-up", save: "Save", warn: "Act", danger: "Danger" } as const;

export function FindingCard({ finding: f, currency, onChange }: { finding: Finding; currency: Currency; onChange: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  const handle = async () => {
    setState("busy");
    try {
      const r = await api.draft(f.id);
      setNote(r.proposedActionIds.length ? "Draft is waiting in Approvals." : r.reply);
      setState("done");
      onChange();
    } catch (e) {
      setNote((e as Error).message);
      setState("error");
    }
  };

  return (
    <article className={`finding sev-${f.severity}`}>
      <div className="finding-main">
        <span className={`pill sev-${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span>
        <h3>{f.title}</h3>
        <p>{f.detail}</p>
        {note && <p className={`note ${state === "error" ? "bad" : ""}`}>{note}</p>}
      </div>
      <div className="finding-side">
        {f.yearlyImpact ? <span className="impact">+{money(f.yearlyImpact, currency)}<small>/yr</small></span> : null}
        {f.oneOffImpact ? <span className="impact">+{money(f.oneOffImpact, currency)}</span> : null}
        {f.hasDraft && state !== "done" && <span className="muted small">Draft in Approvals</span>}
        {f.suggestedAction && !f.hasDraft && state !== "done" && (
          <button className="btn" onClick={handle} disabled={state === "busy"}>
            {state === "busy" ? "Drafting…" : "Handle it"}
          </button>
        )}
      </div>
    </article>
  );
}
