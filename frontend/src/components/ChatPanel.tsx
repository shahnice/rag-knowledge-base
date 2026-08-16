import { useState } from "react";
import { chatWithDocument, SourceChunk } from "../api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
}

export default function ChatPanel({ documentId }: { documentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await chatWithDocument(documentId, question);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div>{m.content}</div>
            {m.sources && m.sources.length > 0 && (
              <div className="sources">
                Sources: chunks {m.sources.map((s) => s.chunk_index).join(", ")}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="message assistant">Thinking…</div>}
      </div>
      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask a question about this document…"
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </>
  );
}
