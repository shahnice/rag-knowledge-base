const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface DocumentOut {
  id: string;
  filename: string;
  status: "processing" | "ready" | "failed";
  created_at: string;
}

export interface SourceChunk {
  chunk_index: number;
  content: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listDocuments(): Promise<DocumentOut[]> {
  return request("/documents");
}

export function uploadDocument(file: File): Promise<DocumentOut> {
  const formData = new FormData();
  formData.append("file", file);
  return request("/documents", { method: "POST", body: formData });
}

export function deleteDocument(id: string): Promise<void> {
  return request(`/documents/${id}`, { method: "DELETE" });
}

export function chatWithDocument(id: string, question: string): Promise<ChatResponse> {
  return request(`/documents/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}
