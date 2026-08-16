import { useState } from "react";
import { createQAPair, deleteQAPair, QAPairOut } from "../api";

export default function QAPairList({
  businessId,
  qaPairs,
  onChanged,
}: {
  businessId: string;
  qaPairs: QAPairOut[];
  onChanged: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createQAPair(businessId, question.trim(), answer.trim());
      setQuestion("");
      setAnswer("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add Q&A pair");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(qaId: string) {
    await deleteQAPair(businessId, qaId);
    onChanged();
  }

  const fieldStyle = { width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", marginTop: 4 };

  return (
    <div>
      <h3>Q&A pairs</h3>
      {qaPairs.length === 0 && (
        <p style={{ color: "#888", fontSize: 14 }}>No Q&A pairs yet. Add common questions and their answers.</p>
      )}
      {qaPairs.map((qa) => (
        <div key={qa.id} style={{ padding: 10, borderRadius: 8, background: "#eee", marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>{qa.question}</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>{qa.answer}</div>
          <button
            style={{ marginTop: 8, background: "#c33", padding: "4px 10px" }}
            onClick={() => handleDelete(qa.id)}
          >
            Delete
          </button>
        </div>
      ))}

      <div style={{ marginTop: 16, maxWidth: 480 }}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Question
          <input value={question} onChange={(e) => setQuestion(e.target.value)} style={fieldStyle} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Answer
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} style={fieldStyle} />
        </label>
        <button onClick={handleAdd} disabled={saving}>
          {saving ? "Adding…" : "Add Q&A pair"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </div>
  );
}
