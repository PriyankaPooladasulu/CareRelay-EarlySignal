// Offline fallback. Data comes from CareRelay-B/offline-demo/snapshot.json (a real, saved
// deterministic backend run) and docs/VOICE_SCRIPTS.json, both copied into data/.
// Plan checks mirror backend/app/navigation.py rule for rule, so the trace shows the same checks
// the backend would make. Nothing here contacts a service. The UI labels this "Offline demo data".
import snapshot from "@/data/snapshot.json";
import catalog from "@/data/voice-catalog.json";
import type {
  Analysis, AuditEvent, CompletionRequest, EducationContent, EvidenceResponse, NavigationConstraints,
  NavigationPlan, NavigationResource, ReminderAction, ResourceRegistry, SignalReport, VoiceCatalog,
} from "./carerelay-client";

const snap = snapshot as unknown as {
  analysis: Analysis; signals: SignalReport; education: EducationContent; resources: ResourceRegistry;
  planA: NavigationPlan; audit: { events: AuditEvent[]; limitation: string };
};

const todayUTC = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const rid = (p: string) => p + "_offline_" + Math.random().toString(16).slice(2, 14);

let audit: AuditEvent[] = [];
let plans: NavigationPlan[] = [];
let actions: ReminderAction[] = [];

function log(e: Omit<AuditEvent, "sequence" | "created_at">) {
  audit.push({ ...e, sequence: audit.length + 1, created_at: nowISO() });
}

export function resetOffline() {
  audit = snap.audit.events.slice(0, 2).map((e, i) => ({ ...e, sequence: i + 1 }));
  plans = [];
  actions = [];
}
resetOffline();

const DEFAULTS: Required<NavigationConstraints> = {
  jurisdiction: "Ontario", travel: "any", language: "any", accessibility: "none",
  phone_available: true, existing_referral_confirmed: false,
};

function checkResource(r: NavigationResource, c: Required<NavigationConstraints>, today: string) {
  const reasons: string[] = [];
  if (!(r.verified_on <= today && today <= r.review_due)) reasons.push("resource_review_out_of_date");
  if (!r.jurisdiction.map((j) => j.toLowerCase()).includes(c.jurisdiction.trim().toLowerCase())) reasons.push("jurisdiction_not_supported");
  if (c.travel === "cannot_travel" && r.delivery === "in_person") reasons.push("in_person_pathway_conflicts_with_travel_constraint");
  if (r.requires_existing_referral && !c.existing_referral_confirmed) reasons.push("existing_referral_to_this_clinic_not_confirmed");
  const lang = c.language.trim().toLowerCase();
  if (lang !== "any" && !r.languages.includes(lang)) reasons.push("requested_language_not_verified");
  if (c.accessibility !== "none" && !r.accessibility.includes(c.accessibility)) reasons.push("requested_accessibility_not_verified");
  if (r.requires_phone && !c.phone_available) reasons.push("telephone_access_required");
  return { resource_id: r.id, eligible: reasons.length === 0, reasons };
}

export const offline = {
  analysis: () => snap.analysis,
  records: () => snap.analysis.records,
  signals: () => snap.signals,
  education: () => snap.education,
  catalog: () => catalog as unknown as VoiceCatalog,
  resources: () => snap.resources,
  evidence(eventId: string): EvidenceResponse {
    const ev = snap.analysis.events.find((e) => e.id === eventId);
    if (!ev) throw new Error("Unknown event");
    const rec = snap.analysis.records.find((r) => r.id === ev.evidence.source_id)!;
    return { event_id: ev.id, evidence: ev.evidence, original_record: rec, offset_convention: "unicode_code_points_start_inclusive_end_exclusive" };
  },
  plan(signal_id: string, constraints: NavigationConstraints): NavigationPlan {
    const c = { ...DEFAULTS, ...constraints };
    const today = todayUTC();
    plans.forEach((p) => {
      if (p.active) { p.active = false; log({ entity_type: "plan", entity_id: p.id, event_type: "plan_invalidated", from_status: p.status, to_status: "invalidated", revision: p.revision, details: { reason: "replanned" } }); }
    });
    actions.forEach((a) => {
      if (["proposed", "approved", "awaiting_confirmation"].includes(a.status)) {
        log({ entity_type: "action", entity_id: a.id, event_type: "action_invalidated", from_status: a.status, to_status: "invalidated", revision: a.revision, details: { reason: "replanned" } });
        a.status = "invalidated"; a.invalidation_reason = "replanned";
      }
    });
    const evaluations: NavigationPlan["evaluations"] = [];
    const steps: NavigationPlan["steps"] = [];
    let selected: NavigationResource | null = null;
    for (const r of snap.resources.resources) {
      steps.push({ stage: "checking_resource", resource_id: r.id, message: "Checking the curated resource and review date." });
      const res = checkResource(r, c, today);
      evaluations.push(res);
      steps.push({ stage: "checking_constraints", resource_id: r.id, message: "Checking jurisdiction, travel, referral, language, accessibility and telephone access." });
      if (!res.eligible) {
        steps.push({ stage: "rejected", resource_id: r.id, message: res.reasons.join("; ") });
        steps.push({ stage: "searching_alternative", resource_id: null, message: "Searching the remaining curated options." });
        continue;
      }
      selected = r;
      steps.push({ stage: "selected", resource_id: r.id, message: "Matches the declared navigation constraints; confirm service eligibility directly." });
      break;
    }
    if (!selected) steps.push({ stage: "no_verified_match", resource_id: null, message: "No curated option satisfies every requested constraint. No action is proposed." });
    const plan: NavigationPlan = {
      id: rid("plan"), revision: snap.signals.revision, signal_id, constraints: c,
      registry_digest: snap.planA.registry_digest, created_at: nowISO(), active: true,
      mode: "deterministic_navigation", status: selected ? "proposed" : "no_verified_match", selected,
      evaluations, steps, limitations: snap.planA.limitations,
    };
    plans.push(plan);
    log({ entity_type: "plan", entity_id: plan.id, event_type: "plan_created", from_status: null, to_status: plan.status, revision: plan.revision, details: { signal_id, constraints: c } });
    steps.forEach((s) => log({ entity_type: "plan", entity_id: plan.id, event_type: "plan_step", from_status: null, to_status: null, revision: plan.revision, details: { resource_id: s.resource_id, message: s.message } }));
    return plan;
  },
  propose(plan_id: string, reminder_date: string): ReminderAction {
    const plan = plans.find((p) => p.id === plan_id && p.active);
    if (!plan || !plan.selected) throw new Error("Plan is not current.");
    const r = plan.selected;
    const a: ReminderAction = {
      id: rid("act"), plan_id, revision: plan.revision, registry_digest: plan.registry_digest, resource: r,
      reminder_date, created_at: nowISO(), approved_at: null, calendar_generated_at: null, invalidation_reason: null,
      status: "proposed", is_appointment: false, care_completed: false, completion: null,
      summary: "CareRelay synthetic follow-up reminder - not an appointment",
      description: "Synthetic demonstration. Review the documented retinal examination recommendation and clarify next steps with an appropriate care team. "
        + "Navigation resource: " + r.name + ". " + r.purpose + " Source: " + r.source_urls[0]
        + " This is an administrative reminder only: no appointment is booked and no care completion is established.",
    };
    actions.push(a);
    log({ entity_type: "action", entity_id: a.id, event_type: "action_proposed", from_status: null, to_status: "proposed", revision: a.revision, details: { plan_id, reminder_date, resource_id: r.id } });
    return { ...a };
  },
  approve(id: string): ReminderAction {
    const a = actions.find((x) => x.id === id)!;
    if (a.status === "proposed") {
      a.status = "approved"; a.approved_at = nowISO();
      log({ entity_type: "action", entity_id: id, event_type: "action_approved", from_status: "proposed", to_status: "approved", revision: a.revision, details: { explicit_approval: true } });
    }
    return { ...a };
  },
  cancel(id: string): ReminderAction {
    const a = actions.find((x) => x.id === id)!;
    if (["proposed", "approved", "awaiting_confirmation"].includes(a.status)) {
      log({ entity_type: "action", entity_id: id, event_type: "action_cancelled", from_status: a.status, to_status: "cancelled", revision: a.revision, details: {} });
      a.status = "cancelled";
    }
    return { ...a };
  },
  calendar(id: string): { action: ReminderAction; blob: Blob } {
    const a = actions.find((x) => x.id === id)!;
    if (!["approved", "awaiting_confirmation"].includes(a.status)) throw new Error("Calendar requires approval.");
    if (a.status === "approved") {
      a.status = "awaiting_confirmation"; a.calendar_generated_at = nowISO();
      log({ entity_type: "action", entity_id: id, event_type: "calendar_generated", from_status: "approved", to_status: "awaiting_confirmation", revision: a.revision, details: { calendar_import_verified: false, care_completed: false } });
    }
    return { action: { ...a }, blob: new Blob([buildIcs(a)], { type: "text/calendar" }) };
  },
  complete(id: string, body: CompletionRequest): ReminderAction {
    const a = actions.find((x) => x.id === id)!;
    if (a.status !== "awaiting_confirmation") throw new Error("Wrong state.");
    a.status = "completed";
    a.completion = { completed_on: body.completed_on, reported_by: body.reported_by, confirmed_at: nowISO(), basis: "explicit_unverified_report", clinically_verified: false };
    log({ entity_type: "action", entity_id: id, event_type: "completion_reported", from_status: "awaiting_confirmation", to_status: "completed", revision: a.revision, details: { ...a.completion } });
    return { ...a };
  },
  audit: () => ({ events: [...audit], next_cursor: null, limitation: "Offline demo: this history is kept only in this browser tab. " + snap.audit.limitation }),
};

// Mirrors backend/app/calendar_file.py (RFC 5545 all-day, no invite, no alarm).
function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\r\n|\r/g, "\n").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
function fold(line: string) {
  const out: string[] = []; let cur = "";
  const te = new TextEncoder();
  for (const ch of Array.from(line)) {
    if (te.encode(cur + ch).length > 75) { out.push(cur); cur = " "; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}
function buildIcs(a: ReminderAction) {
  const d = a.reminder_date.replace(/-/g, "");
  const next = new Date(a.reminder_date + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CareRelay//Synthetic Reminder 0.9//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${a.id}@carerelay.local`, "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + d,
    "DTEND;VALUE=DATE:" + next.toISOString().slice(0, 10).replace(/-/g, ""), "SUMMARY:" + esc(a.summary),
    "DESCRIPTION:" + esc(a.description), "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}
