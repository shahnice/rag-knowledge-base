import { useEffect, useState } from "react";
import { BusinessOut, DocumentOut, QAPairOut, listBusinesses, listDocuments, listQAPairs } from "./api";
import BusinessSelector from "./components/BusinessSelector";
import BusinessSettings from "./components/BusinessSettings";
import ChatPanel from "./components/ChatPanel";
import DocumentList from "./components/DocumentList";
import QAPairList from "./components/QAPairList";
import TestCallPanel from "./components/TestCallPanel";
import UploadPanel from "./components/UploadPanel";
import { useApiKey } from "./useApiKey";

type Tab = "knowledge" | "voice" | "settings";

export default function App() {
  const { apiKey, setApiKey } = useApiKey();
  const [businesses, setBusinesses] = useState<BusinessOut[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentOut[]>([]);
  const [qaPairs, setQaPairs] = useState<QAPairOut[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("knowledge");

  async function refreshBusinesses() {
    const list = await listBusinesses();
    setBusinesses(list);
  }

  async function refreshKnowledge(businessId: string) {
    const [docs, qas] = await Promise.all([listDocuments(businessId), listQAPairs(businessId)]);
    setDocuments(docs);
    setQaPairs(qas);
  }

  useEffect(() => {
    refreshBusinesses();
  }, []);

  useEffect(() => {
    if (!selectedBusinessId) return;
    refreshKnowledge(selectedBusinessId);
    const interval = setInterval(() => refreshKnowledge(selectedBusinessId), 3000);
    return () => clearInterval(interval);
  }, [selectedBusinessId]);

  const selectedBusiness = businesses.find((b) => b.id === selectedBusinessId) || null;

  return (
    <div className="layout">
      <div className="sidebar">
        <BusinessSelector
          businesses={businesses}
          selectedId={selectedBusinessId}
          onSelect={(id) => {
            setSelectedBusinessId(id);
            setSelectedDocId(null);
          }}
          onCreated={async (id) => {
            await refreshBusinesses();
            setSelectedBusinessId(id);
          }}
        />

        <label style={{ display: "block", margin: "12px 0" }}>
          Your OpenAI API key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", marginTop: 4 }}
          />
        </label>
        <p style={{ color: "#888", fontSize: 12, marginTop: -8, marginBottom: 12 }}>
          Used only for this session, never stored on our servers.
        </p>

        {selectedBusiness && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setTab("knowledge")}
                style={{ background: tab === "knowledge" ? "#4a4aff" : "#ccc" }}
              >
                Knowledge
              </button>
              <button
                onClick={() => setTab("voice")}
                style={{ background: tab === "voice" ? "#4a4aff" : "#ccc" }}
              >
                Voice Demo
              </button>
              <button
                onClick={() => setTab("settings")}
                style={{ background: tab === "settings" ? "#4a4aff" : "#ccc" }}
              >
                Settings
              </button>
            </div>

            {tab === "knowledge" && (
              <>
                <h2>Documents</h2>
                <UploadPanel
                  businessId={selectedBusiness.id}
                  apiKey={apiKey}
                  onUploaded={() => refreshKnowledge(selectedBusiness.id)}
                />
                <DocumentList documents={documents} selectedId={selectedDocId} onSelect={setSelectedDocId} />
              </>
            )}
          </>
        )}
      </div>

      <div className="chat-area">
        {!selectedBusiness && <p style={{ color: "#888" }}>Select or create a business to get started.</p>}

        {selectedBusiness && tab === "settings" && (
          <BusinessSettings business={selectedBusiness} onUpdated={refreshBusinesses} />
        )}

        {selectedBusiness && tab === "voice" && (
          <TestCallPanel key={selectedBusiness.id} business={selectedBusiness} apiKey={apiKey} />
        )}

        {selectedBusiness && tab === "knowledge" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 16, overflowY: "auto" }}>
            <QAPairList
              businessId={selectedBusiness.id}
              qaPairs={qaPairs}
              apiKey={apiKey}
              onChanged={() => refreshKnowledge(selectedBusiness.id)}
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 300 }}>
              <h3>Test chat</h3>
              <ChatPanel key={selectedBusiness.id} businessId={selectedBusiness.id} apiKey={apiKey} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
