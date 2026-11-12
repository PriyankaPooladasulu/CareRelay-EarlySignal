// Live client for the CareRelay-B FastAPI backend.
// Types come from Member B's typed client (lib/carerelay-client.ts, copied from CareRelay-B/integration/api.ts).
import type {
  Analysis, AuditPage, CompletionRequest, EducationContent, EvidenceResponse, NavigationPlan,
  Patient, PlanRequest, RecordInput, ReminderAction, ResourceRegistry, SignalReport, SourceRecord,
  Timeline, VoiceCatalog, VoiceRequest, VoiceResponse,
} from "./carerelay-client";

export * from "./carerelay-client";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
/** The backend case slug. DEMO-001 is the patient id; the route uses the slug. */
export const CASE = "amina";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown, timeoutMs = 6000): Promise<T> {
  const init: RequestInit = body === undefined
    ? { cache: "no-store" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" };
  const res = await fetch(API_BASE + path, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
    } catch { /* non-JSON error */ }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

export const api = {
  health: () => request<{ status: string; default_mode: string; scope: string }>("/health", undefined, 2500),
  patient: () => request<{ patient: Patient; record_count: number; analyzed: boolean; event_count: number }>(`/api/cases/${CASE}`),
  records: () => request<SourceRecord[]>(`/api/cases/${CASE}/records`),
  analyze: (records?: RecordInput[]) =>
    request<Analysis>(`/api/cases/${CASE}/analyze`, { mode: "demo", ...(records ? { records } : {}) }, 15000),
  timeline: () => request<Timeline>(`/api/cases/${CASE}/timeline`),
  evidence: (eventId: string) => request<EvidenceResponse>(`/api/cases/${CASE}/events/${enc(eventId)}/evidence`),
  signals: () => request<SignalReport>(`/api/cases/${CASE}/signals`),
  education: () => request<EducationContent>("/api/education/retina"),
  voiceCatalog: () => request<VoiceCatalog>("/api/voice/catalog"),
  voice: (body: VoiceRequest) => request<VoiceResponse>(`/api/cases/${CASE}/voice`, body),
  resources: () => request<ResourceRegistry>("/api/resources"),
  plan: (body: PlanRequest) => request<NavigationPlan>(`/api/cases/${CASE}/plan`, body),
  getPlan: (id: string) => request<NavigationPlan>(`/api/plans/${enc(id)}`),
  propose: (plan_id: string, reminder_date: string) =>
    request<ReminderAction>(`/api/cases/${CASE}/actions`, { plan_id, reminder_date }),
  action: (id: string) => request<ReminderAction>(`/api/actions/${enc(id)}`),
  approve: (id: string) => request<ReminderAction>(`/api/actions/${enc(id)}/approve`, { approved: true }),
  cancel: (id: string) => request<ReminderAction>(`/api/actions/${enc(id)}/cancel`, {}),
  complete: (id: string, body: CompletionRequest) => request<ReminderAction>(`/api/actions/${enc(id)}/complete`, body),
  audit: (after = 0, limit = 200) => request<AuditPage>(`/api/cases/${CASE}/audit?after=${enc(after)}&limit=${enc(limit)}`),
  calendar: async (id: string): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/api/actions/${enc(id)}/calendar`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.blob();
  },
};

/** Read every audit page (the backend pages by sequence). */
export async function fetchAllAudit(): Promise<AuditPage> {
  let after = 0;
  const events: AuditPage["events"] = [];
  let limitation = "";
  for (let i = 0; i < 20; i++) {
    const page = await api.audit(after, 200);
    events.push(...page.events);
    limitation = page.limitation;
    if (page.next_cursor == null) break;
    after = page.next_cursor;
  }
  return { events, next_cursor: null, limitation };
}
