import { useRef, useState } from "react";
import { uploadDocument } from "../api";

export default function UploadPanel({
  businessId,
  apiKey,
  onUploaded,
}: {
  businessId: string;
  apiKey: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(businessId, file, apiKey);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handleChange}
        disabled={uploading || !apiKey.trim()}
      />
      {!apiKey.trim() && <p style={{ color: "#888", fontSize: 14 }}>Enter your OpenAI API key above to upload.</p>}
      {uploading && <p>Uploading & indexing…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
