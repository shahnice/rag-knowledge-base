import { useState } from "react";
import { chatWithBusiness, SourceChunk, SourceQAPair } from "../api";

interface Message {
  role: "user" | "assistant";
  content: string;
  qaSources?: SourceQAPair[];
  chunkSources?: SourceChunk[];
}

export default function ChatPanel({ businessId, apiKey }: { businessId: string; apiKey: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading || !apiKey.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await chatWithBusiness(businessId, question, apiKey);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, qaSources: res.qa_sources, chunkSources: res.chunk_sources },
      ]);
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
            {((m.qaSources && m.qaSources.length > 0) || (m.chunkSources && m.chunkSources.length > 0)) && (
              <div className="sources">
                {m.qaSources && m.qaSources.length > 0 && <div>Q&A: {m.qaSources.map((s) => s.question).join(", ")}</div>}
                {m.chunkSources && m.chunkSources.length > 0 && (
                  <div>Document chunks: {m.chunkSources.map((s) => s.chunk_index).join(", ")}</div>
                )}
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
          placeholder="Ask this business a question…"
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim() || !apiKey.trim()}>
          Send
        </button>
      </div>
      {!apiKey.trim() && <p style={{ color: "#888", fontSize: 14 }}>Enter your OpenAI API key above to chat.</p>}
    </>
  );
}
