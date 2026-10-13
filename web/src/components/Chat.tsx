import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatTarget } from "../../../shared/types";
import { api } from "../api";

export function Chat({ target, starters, onActivity }: { target: ChatTarget; starters: string[]; onActivity: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [messages, busy]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    const history = messages;
    setMessages([...history, { role: "user", text: msg }]);
    setInput("");
    setBusy(true);
    try {
      const r = await api.chat(target, msg, history);
      setMessages((m) => [...m, { role: "assistant", text: r.reply }]);
      if (r.proposedActionIds.length) onActivity();
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `Sorry, something went wrong: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat">
      <div className="chat-log">
        {messages.length === 0 && (
          <div className="starters">
            {starters.map((s) => (
              <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
        ))}
        {busy && <div className="bubble assistant typing">Thinking…</div>}
        <div ref={end} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about your money…" maxLength={4000} />
        <button className="btn" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
