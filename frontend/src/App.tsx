import { useEffect, useState } from "react";
import { DocumentOut, listDocuments } from "./api";
import ChatPanel from "./components/ChatPanel";
import DocumentList from "./components/DocumentList";
import UploadPanel from "./components/UploadPanel";

export default function App() {
  const [documents, setDocuments] = useState<DocumentOut[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh() {
    const docs = await listDocuments();
    setDocuments(docs);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="layout">
      <div className="sidebar">
        <h2>Knowledge Base</h2>
        <UploadPanel onUploaded={refresh} />
        <DocumentList documents={documents} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="chat-area">
        {selectedId ? (
          <ChatPanel key={selectedId} documentId={selectedId} />
        ) : (
          <p style={{ color: "#888" }}>Select a ready document to start chatting.</p>
        )}
      </div>
    </div>
  );
}
