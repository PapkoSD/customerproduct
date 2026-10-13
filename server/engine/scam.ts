import type { Finding, Household, Profile } from "../../shared/types";

export interface ScamAssessment {
  verdict: "safe" | "suspicious" | "scam";
  score: number; // 0-100
  reasons: string[];
  advice: string;
}

const URGENCY = /\b(blocked|suspended|within 24 ?h|immediately|final notice|urgent|lose access|avoid disconnection|by tomorrow|within \d+ days?)\b/i;
const CREDENTIALS = /\b(verify your (identity|account)|login|password|pin|card number|cvv|one[- ]time code)\b/i;
const BANK_CHANGE = /\b(bank (account|details) (has )?changed|new account|updated bank details)\b/i;
const SHADY_TLD = /https?:\/\/[^\s/]+\.(top|xyz|click|shop|live|icu|info|co)(\/|\b)/i;
const LOOKALIKE = /https?:\/\/[^\s/]*-(secure|verify|login|support|payments?)[^\s/]*/i;
const IBAN = /\b([A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?)\b/g;
const VAGUE_SERVICE = /\b(search engine registration|domain listing|directory listing)\b/i;

const normIban = (s: string) => s.replace(/\s+/g, "").toUpperCase();

/** Rule-based check. The scam agent layers Claude's judgement on top of this. */
export function assessMessage(text: string, from: string, profile: Profile): ScamAssessment {
  const weighted: { pts: number; why: string }[] = [];
  let score = 0;
  const add = (pts: number, why: string) => {
    score += pts;
    weighted.push({ pts, why });
  };

  if (URGENCY.test(text)) add(20, "Pressure to act fast is a classic scam tactic.");
  if (CREDENTIALS.test(text)) add(30, "Asks you to verify identity or enter credentials. Real banks never ask this via a link.");
  if (SHADY_TLD.test(text) || LOOKALIKE.test(text)) add(35, "The link points to a look-alike or unusual domain, not the company's real site.");
  if (BANK_CHANGE.test(text)) add(30, "Says the payee's bank account changed. Invoice redirection fraud starts exactly like this.");
  if (VAGUE_SERVICE.test(text)) add(30, "Charges for a vague 'registration' service, typical of fake domain invoices.");

  const ibans = [...text.matchAll(IBAN)].map((m) => normIban(m[1]));
  for (const iban of ibans) {
    const known = profile.knownPayees.find((p) => normIban(p.iban) === iban);
    const claimed = profile.knownPayees.find((p) => text.toLowerCase().includes(p.name.toLowerCase()));
    if (known) {
      score -= 15;
      weighted.push({ pts: 15, why: `The account number matches the one you've paid ${known.name} before.` });
    } else if (claimed) {
      add(35, `Mentions ${claimed.name}, but the account number differs from the one you've always paid them.`);
    } else if (!iban.startsWith(profile.country)) {
      add(15, `The account is foreign (${iban.slice(0, 2)}) for what looks like a local service.`);
    }
  }

  const senderDomain = from.includes("@") ? from.split("@")[1].toLowerCase() : null;
  const claimedPayee = profile.knownPayees.find((p) => text.toLowerCase().includes(p.name.toLowerCase()));
  if (senderDomain && claimedPayee && !senderDomain.startsWith(claimedPayee.name.toLowerCase().replace(/\s+/g, "") + ".")) {
    add(15, `Sent from ${senderDomain}, which isn't ${claimedPayee.name}'s usual domain.`);
  }
  if (!senderDomain && /bank/i.test(text) && /https?:\/\//.test(text)) add(10, "An SMS from a regular phone number containing a bank link.");

  score = Math.max(0, Math.min(100, score));
  // Strongest signal first, so a one-line summary shows the most telling reason.
  const reasons = weighted.sort((a, b) => b.pts - a.pts).map((w) => w.why);
  const verdict = score >= 50 ? "scam" : score >= 20 ? "suspicious" : "safe";
  const advice =
    verdict === "scam"
      ? "Don't click, reply or pay. If you're worried, call the company on the number printed on your card or contract."
      : verdict === "suspicious"
        ? "Double-check with the company through a channel you already trust before paying or replying."
        : "Nothing alarming found. Still only pay to account numbers you recognise.";
  if (!reasons.length) reasons.push("No common scam patterns found.");
  return { verdict, score, reasons, advice };
}

export function detectScams(h: Household): Finding[] {
  return h.inbox.flatMap((m) => {
    const a = assessMessage(m.body + " " + (m.subject ?? ""), m.from, h.profile);
    if (a.verdict === "safe") return [];
    return [
      {
        id: `scam-${m.id}`,
        agent: "scam" as const,
        title: `${a.verdict === "scam" ? "Likely scam" : "Suspicious"}: ${m.subject ?? m.body.slice(0, 48) + "…"}`,
        detail: `${m.channel.toUpperCase()} from ${m.from}. ${a.reasons[0]} ${a.advice}`,
        severity: a.verdict === "scam" ? ("danger" as const) : ("warn" as const),
        evidence: [m.id],
        suggestedAction: "block_payment" as const,
      },
    ];
  });
}
