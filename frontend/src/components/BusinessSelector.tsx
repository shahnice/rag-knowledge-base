import { useState } from "react";
import { BusinessOut, createBusiness } from "../api";

export default function BusinessSelector({
  businesses,
  selectedId,
  onSelect,
  onCreated,
}: {
  businesses: BusinessOut[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    try {
      const business = await createBusiness({ name: name.trim() });
      setName("");
      setCreating(false);
      onCreated(business.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create business");
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <h2>Businesses</h2>
      {businesses.length === 0 && (
        <p style={{ color: "#888", fontSize: 14 }}>No businesses yet. Create one to get started.</p>
      )}
      {businesses.map((b) => (
        <div
          key={b.id}
          className={`doc-item ${b.id === selectedId ? "selected" : ""}`}
          onClick={() => onSelect(b.id)}
        >
          <div>{b.name}</div>
          <div className="status">{b.phone_number || "no phone number"}</div>
        </div>
      ))}

      {creating ? (
        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Business name"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button onClick={handleCreate}>Add</button>
        </div>
      ) : (
        <button style={{ marginTop: 10 }} onClick={() => setCreating(true)}>
          + New business
        </button>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
