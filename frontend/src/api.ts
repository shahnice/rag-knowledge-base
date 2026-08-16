const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface BusinessOut {
  id: string;
  name: string;
  greeting: string;
  persona_instructions: string;
  voice: string;
  phone_number: string | null;
  created_at: string;
}

export interface BusinessCreate {
  name: string;
  greeting?: string;
  persona_instructions?: string;
  voice?: string;
  phone_number?: string;
}

export interface BusinessUpdate {
  name?: string;
  greeting?: string;
  persona_instructions?: string;
  voice?: string;
  phone_number?: string;
}

export interface DocumentOut {
  id: string;
  business_id: string;
  filename: string;
  status: "processing" | "ready" | "failed";
  created_at: string;
}

export interface QAPairOut {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  created_at: string;
}

export interface SourceChunk {
  chunk_index: number;
  content: string;
}

export interface SourceQAPair {
  question: string;
  answer: string;
}

export interface ChatResponse {
  answer: string;
  qa_sources: SourceQAPair[];
  chunk_sources: SourceChunk[];
}

export interface ValidateKeyResponse {
  valid: boolean;
  detail: string | null;
}

export interface CallTurnOut {
  id: string;
  role: "caller" | "assistant" | "tool";
  content: string;
  created_at: string;
}

export interface CallDetailOut {
  id: string;
  business_id: string;
  channel: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  turns: CallTurnOut[];
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

export function listBusinesses(): Promise<BusinessOut[]> {
  return request("/businesses");
}

export function createBusiness(business: BusinessCreate): Promise<BusinessOut> {
  return request("/businesses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(business),
  });
}

export function updateBusiness(id: string, updates: BusinessUpdate): Promise<BusinessOut> {
  return request(`/businesses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export function deleteBusiness(id: string): Promise<void> {
  return request(`/businesses/${id}`, { method: "DELETE" });
}

export function listDocuments(businessId: string): Promise<DocumentOut[]> {
  return request(`/businesses/${businessId}/documents`);
}

export function uploadDocument(businessId: string, file: File): Promise<DocumentOut> {
  const formData = new FormData();
  formData.append("file", file);
  return request(`/businesses/${businessId}/documents`, { method: "POST", body: formData });
}

export function deleteDocument(businessId: string, id: string): Promise<void> {
  return request(`/businesses/${businessId}/documents/${id}`, { method: "DELETE" });
}

export function listQAPairs(businessId: string): Promise<QAPairOut[]> {
  return request(`/businesses/${businessId}/qa-pairs`);
}

export function createQAPair(businessId: string, question: string, answer: string): Promise<QAPairOut> {
  return request(`/businesses/${businessId}/qa-pairs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer }),
  });
}

export function deleteQAPair(businessId: string, qaId: string): Promise<void> {
  return request(`/businesses/${businessId}/qa-pairs/${qaId}`, { method: "DELETE" });
}

export function chatWithBusiness(businessId: string, question: string): Promise<ChatResponse> {
  return request(`/businesses/${businessId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export function validateOpenAIKey(openaiApiKey: string): Promise<ValidateKeyResponse> {
  return request("/realtime/validate-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openai_api_key: openaiApiKey }),
  });
}

export function browserCallSocketUrl(businessId: string): string {
  return `${API_URL.replace(/^http/, "ws")}/calls/browser/${businessId}`;
}

export function getCall(callId: string): Promise<CallDetailOut> {
  return request(`/calls/${callId}`);
}
