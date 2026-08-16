import { DocumentOut } from "../api";

export default function DocumentList({
  documents,
  selectedId,
  onSelect,
}: {
  documents: DocumentOut[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (documents.length === 0) {
    return <p style={{ color: "#888", fontSize: 14 }}>No documents yet. Upload a PDF to get started.</p>;
  }

  return (
    <div>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={`doc-item ${doc.id === selectedId ? "selected" : ""}`}
          onClick={() => doc.status === "ready" && onSelect(doc.id)}
        >
          <div>{doc.filename}</div>
          <div className="status">{doc.status}</div>
        </div>
      ))}
    </div>
  );
}
