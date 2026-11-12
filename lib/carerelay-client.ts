// Copied verbatim from CareRelay-B/integration/api.ts (Member B's typed client). Do not edit by hand;
// update the backend copy and re-copy instead.
export interface Patient {
  id: string; slug: string; name: string; location: string; synthetic: true;
}
export interface RecordInput {
  id: string; date?: string; title: string; text: string; synthetic: true;
}
export interface DateProvenance {
  origin: "supplied_metadata" | "source_header" | "metadata_and_header";
  quote: string | null; start: number | null; end: number | null;
}
export interface SourceRecord extends RecordInput {
  date: string; date_provenance: DateProvenance;
}
export interface Evidence {
  source_id: string; source_title: string; quote: string;
  start: number; end: number; source_sha256: string;
  validation: "exact_span_and_bounded_semantic_rule";
}
export interface TimelineEvent {
  id: string; date: string;
  kind: "instruction" | "observation" | "completion" | "not_completed" | "missing_information";
  concept: "retinal_exam" | "type_2_diabetes" | "retinal_referral";
  text: string; evidence: Evidence; date_provenance: DateProvenance;
}
export interface Timeline {
  events: TimelineEvent[];
  mode: "deterministic_demo" | "live_llm_validated";
  warnings: string[]; revision: string; rejected: RejectedCandidate[];
}
export interface Candidate {
  source_id: string; date: string; kind: TimelineEvent["kind"];
  concept: TimelineEvent["concept"]; quote: string;
}
export interface RejectedCandidate { candidate: Candidate; reason: string }
export interface Analysis extends Timeline { records: SourceRecord[] }
export interface CandidateValidation {events: TimelineEvent[]; rejected: RejectedCandidate[]; saved: false}
export interface EvidenceResponse {
  event_id: string; evidence: Evidence; original_record: SourceRecord; offset_convention: string;
}

export function createCareRelayClient(base = "http://127.0.0.1:8000") {
  async function request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(base + path, body === undefined ? {} : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail));
    }
    return response.json() as Promise<T>;
  }
  return {
    patient: () => request<{patient: Patient; record_count: number; analyzed: boolean; event_count: number}>("/api/cases/amina"),
    records: () => request<SourceRecord[]>("/api/cases/amina/records"),
    analyze: (mode: "demo" | "live" = "demo", records?: RecordInput[]) =>
      request<Analysis>("/api/cases/amina/analyze", { mode, ...(records ? {records} : {}) }),
    validate: (events: Candidate[]) => request<CandidateValidation>("/api/cases/amina/validate", {events}),
    timeline: () => request<Timeline>("/api/cases/amina/timeline"),
    signals: () => request<SignalReport>("/api/cases/amina/signals"),
    education: () => request<EducationContent>("/api/education/retina"),
    voice: (body: VoiceRequest) => request<VoiceResponse>("/api/cases/amina/voice", body),
    resources: () => request<ResourceRegistry>("/api/resources"),
    plan: (body: PlanRequest) => request<NavigationPlan>("/api/cases/amina/plan", body),
    getPlan: (id: string) => request<NavigationPlan>("/api/plans/" + encodeURIComponent(id)),
    proposeReminder: (plan_id: string, reminder_date: string) =>
      request<ReminderAction>("/api/cases/amina/actions", {plan_id, reminder_date}),
    reminder: (id: string) => request<ReminderAction>("/api/actions/" + encodeURIComponent(id)),
    approveReminder: (id: string, approved: true) =>
      request<ReminderAction>("/api/actions/" + encodeURIComponent(id) + "/approve", {approved}),
    cancelReminder: (id: string) =>
      request<ReminderAction>("/api/actions/" + encodeURIComponent(id) + "/cancel", {}),
    completeReminder: (id: string, body: CompletionRequest) =>
      request<ReminderAction>("/api/actions/" + encodeURIComponent(id) + "/complete", body),
    audit: (after = 0, limit = 100) =>
      request<AuditPage>("/api/cases/amina/audit?after=" + encodeURIComponent(after) + "&limit=" + encodeURIComponent(limit)),
    calendar: async (id: string): Promise<Blob> => {
      const response = await fetch(base + "/api/actions/" + encodeURIComponent(id) + "/calendar", {cache: "no-store"});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail));
      }
      return response.blob();
    },
    voiceCatalog: () => request<VoiceCatalog>("/api/voice/catalog"),
    evidence: (id: string) => request<EvidenceResponse>("/api/cases/amina/events/" + encodeURIComponent(id) + "/evidence")
  };
}

export function splitEvidenceText(text: string, evidence: Evidence) {
  const characters = Array.from(text);
  return {
    before: characters.slice(0, evidence.start).join(""),
    quote: characters.slice(evidence.start, evidence.end).join(""),
    after: characters.slice(evidence.end).join("")
  };
}

export type EducationState = "normal" | "early" | "progressing" | "advanced";
export interface SignalEvidence {event_id: string; date: string; evidence: Evidence}
export interface Signal {
  id: string; rule: "unresolved_instruction" | "repeated_observation" | "conflict" | "missing_information";
  concept: TimelineEvent["concept"]; status: "open" | "resolved" | "needs_review";
  title: string; summary: string; evidence: SignalEvidence[]; education_topic: "retina";
}
export interface SignalReport {revision: string; mode: "deterministic_rules"; rule_version: string;
  searched_source_ids: string[]; signals: Signal[]; limitations: string[]; extraction_warnings: string[]}
export interface ContentSource {id: string; title: string; publisher: string; url: string; checked_on: string}
export interface EducationCard {id: string; title: string; text: string; source_ids: string[]; scope: "general_education"}
export interface EducationContent {topic: "retina"; version: string;
  review_status: "source_checked_prototype_clinical_review_pending";
  disclaimer: string; progression_limit: string; sources: ContentSource[];
  anatomy: EducationCard[]; follow_up: EducationCard;
  states: (EducationCard & {id: EducationState; anatomy_focus: string[]})[]}
export type VoiceTopic = "retina" | "follow_up" | "progression" | "next_steps" | "patient_facts" | "diagnosis" | "state";
export type VoiceRequest = {topic: Exclude<VoiceTopic,"state">; question?: never; state?: never}
  | {topic: "state"; state: EducationState; question?: never}
  | {question: string; topic?: never; state?: never};
export interface VoiceSegment {scope: "general_education" | "patient_record" | "limitation" | "safety";
  text: string; source_ids: string[]; event_ids: string[]}
export interface VoiceResponse {topic: string; state: EducationState | null; mode: "allowlisted_scripts";
  approval: "prototype_allowlist_not_clinical_approval"; refused: boolean; revision: string | null;
  segments: VoiceSegment[]; transcript: string; sources: ContentSource[]; evidence: SignalEvidence[]; audio_available: false}
export interface VoiceCatalog {version: string; questions: {question: string; topic: VoiceTopic}[];
  scripts: VoiceResponse[]; patient_facts: string; rules: string[]}

export interface NavigationResource {
  id: string; name: string; kind: "clinic" | "navigation" | "directory";
  jurisdiction: string[]; location: string; delivery: "in_person" | "remote";
  purpose: string; eligibility: string; requires_existing_referral: boolean;
  languages: string[]; accessibility: string[]; requires_phone: boolean;
  source_urls: string[]; verified_on: string; review_due: string;
  verification_note: string; limitations: string[];
}
export interface ResourceRegistry {version: string; resources: NavigationResource[]; disclaimer: string}
export interface NavigationConstraints {
  jurisdiction?: string; travel?: "any" | "cannot_travel"; language?: string;
  accessibility?: "none" | "tty" | "step_free"; phone_available?: boolean;
  existing_referral_confirmed?: boolean;
}
export interface PlanRequest {revision: string; signal_id: string; constraints?: NavigationConstraints}
export interface NavigationPlan {
  id: string; revision: string; signal_id: string; constraints: Required<NavigationConstraints>;
  registry_digest: string; created_at: string; active: boolean; mode: "deterministic_navigation";
  status: "proposed" | "no_verified_match"; selected: NavigationResource | null;
  evaluations: {resource_id: string; eligible: boolean; reasons: string[]}[];
  steps: {stage: "checking_resource" | "checking_constraints" | "rejected" |
    "searching_alternative" | "selected" | "no_verified_match"; resource_id: string | null; message: string}[];
  limitations: string[];
}
export interface ReminderAction {
  id: string; plan_id: string; revision: string; registry_digest: string;
  resource: NavigationResource; reminder_date: string; summary: string; description: string;
  status: "proposed" | "approved" | "awaiting_confirmation" | "cancelled" | "invalidated" | "completed";
  created_at: string; approved_at: string | null; calendar_generated_at: string | null;
  invalidation_reason: string | null; is_appointment: false; care_completed: false; completion: CompletionReport | null;
}

export interface CompletionRequest {confirmed: true; completed_on: string; reported_by: "patient" | "caregiver"}
export interface CompletionReport {
  completed_on: string; reported_by: "patient" | "caregiver"; confirmed_at: string;
  basis: "explicit_unverified_report"; clinically_verified: false;
}
export interface AuditEvent {
  sequence: number; created_at: string; entity_type: "system" | "analysis" | "plan" | "action";
  entity_id: string; event_type: string; from_status: string | null; to_status: string | null;
  revision: string | null; details: Record<string, unknown>;
}
export interface AuditPage {events: AuditEvent[]; next_cursor: number | null; limitation: string}
