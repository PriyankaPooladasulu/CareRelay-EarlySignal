"use client";
// One shared state store for the whole journey: records, signal, plan, approval, completion,
// sharing, voice and the watch all read and write here, so nothing forks.
import { useSyncExternalStore } from "react";
import { api, fetchAllAudit, ApiError } from "./api";
import { offline, resetOffline } from "./offline";
import type {
  AuditEvent, EducationContent, EducationState, EvidenceResponse, NavigationConstraints, NavigationPlan,
  RecordInput, ReminderAction, ResourceRegistry, SignalReport, SourceRecord, Timeline, VoiceCatalog,
} from "./carerelay-client";
import type { Lang } from "./i18n";
import type { Metric } from "./vitals";
import type { ReviewDecision } from "./types";

export type Source = "live" | "offline";
export type Stage = "open" | "planned" | "proposed" | "approved" | "awaiting" | "completed";

export interface LocalAudit {
  id: string; at: string; actor: "patient" | "clinician" | "presenter"; what: string; origin: "app" | "watch";
}
export interface ReviewEntry {
  version: number; decision: ReviewDecision; remark: string; at: string; reviewer: string; synthetic: true;
}
export interface Toast { id: number; text: string; detail?: string; href?: string; download?: string }
export interface Upload {
  id: string; name: string; size: number; state: "uploaded" | "reading" | "checking" | "done" | "unsupported" | "failed";
  progress?: number; text?: string; accepted?: number; rejected?: number; note?: string;
}

export interface State {
  status: "loading" | "ready";
  source: Source;
  timeline: Timeline | null;
  records: SourceRecord[];
  signals: SignalReport | null;
  education: EducationContent | null;
  catalog: VoiceCatalog | null;
  resources: ResourceRegistry | null;
  evidence: EvidenceResponse | null;
  evidenceOpen: boolean;
  constraints: NavigationConstraints;
  plan: NavigationPlan | null;
  priorPlan: NavigationPlan | null;
  planRevealed: number;
  planBusy: boolean;
  action: ReminderAction | null;
  icsUrl: string | null;
  busy: boolean;
  error: string | null;
  audit: AuditEvent[];
  auditLimitation: string;
  localAudit: LocalAudit[];
  sharing: Record<Metric, boolean>;
  reviews: Record<string, ReviewEntry[]>;
  uploads: Upload[];
  lang: Lang;
  largeText: boolean;
  highContrast: boolean;
  plain: boolean;
  chamberVisited: boolean;
  edu: EducationState;
  notYet: boolean;
  watchScreen: number;
  watchBuzz: number;
  pulse: number;
  toasts: Toast[];
}

const initial: State = {
  status: "loading", source: "live", timeline: null, records: [], signals: null, education: null, catalog: null,
  resources: null, evidence: null, evidenceOpen: false,
  constraints: { travel: "any", language: "any", accessibility: "none", phone_available: true, existing_referral_confirmed: true },
  plan: null, priorPlan: null, planRevealed: 0, planBusy: false, action: null, icsUrl: null, busy: false, error: null,
  audit: [], auditLimitation: "", localAudit: [],
  sharing: { heart_rate: false, blood_pressure: false, glucose: false, steps: false, sleep: false },
  reviews: {
    // Seeded entry, clearly labelled synthetic. Replaces the old invented-doctor chat comments.
    sig_3b27843e1868d299: [{
      version: 1, decision: "confirm", at: "2026-11-08T14:30:00Z", reviewer: "Synthetic clinician reviewer (demo persona)", synthetic: true,
      remark: "Checked the Oct 3 quote against the source note. The recommendation is documented; no completion record was supplied.",
    }],
  },
  uploads: [], lang: "en", largeText: false, highContrast: false, plain: true, chamberVisited: false, edu: "normal", notYet: false,
  watchScreen: 0, watchBuzz: 0, pulse: 0, toasts: [],
};

let state: State = initial;
const listeners = new Set<() => void>();
const set = (patch: Partial<State> | ((s: State) => Partial<State>)) => {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((l) => l());
};
export const getState = () => state;
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(initial));
}

const PREFS_KEY = "carerelay.prefs.v1";
const ACTION_KEY = "carerelay.action.v1";
const PLAN_KEY = "carerelay.plan.v1";
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const todayUTC = () => new Date().toISOString().slice(0, 10);
let toastId = 0;

export function stageOf(s: State): Stage {
  const a = s.action;
  if (a?.status === "completed") return "completed";
  if (a?.status === "awaiting_confirmation") return "awaiting";
  if (a?.status === "approved") return "approved";
  if (a?.status === "proposed") return "proposed";
  if (s.plan?.status === "proposed" && s.plan.active) return "planned";
  return "open";
}

export function openSignal(s: State) {
  return s.signals?.signals.find((g) => g.rule === "unresolved_instruction" && g.status === "open") ?? s.signals?.signals[0] ?? null;
}

function persistPrefs() {
  const { lang, largeText, highContrast, plain, sharing, reviews, localAudit } = state;
  safe(() => localStorage.setItem(PREFS_KEY, JSON.stringify({ lang, largeText, highContrast, plain, sharing, reviews, localAudit })), undefined);
}

export const actions = {
  toast(text: string, extra: Omit<Toast, "id" | "text"> = {}) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, ...extra }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), extra.href ? 9000 : 4200);
  },
  dismissToast(id: number) { set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })); },

  async init() {
    const saved = safe(() => JSON.parse(localStorage.getItem(PREFS_KEY) || "null"), null);
    if (saved) set({ ...saved, sharing: { ...initial.sharing, ...saved.sharing }, reviews: { ...initial.reviews, ...saved.reviews } });
    try {
      await api.health();
      const p = await api.patient();
      if (!p.analyzed) await api.analyze();
      const [timeline, records, signals, education, catalog, resources] = await Promise.all([
        api.timeline(), api.records(), api.signals(), api.education(), api.voiceCatalog(), api.resources(),
      ]);
      set({ source: "live", timeline, records, signals, education, catalog, resources });
      // Restore a persisted plan/action after refresh (the backend keeps their state).
      const planId = safe(() => localStorage.getItem(PLAN_KEY), null);
      const actionId = safe(() => localStorage.getItem(ACTION_KEY), null);
      if (planId) {
        const plan = await api.getPlan(planId).catch(() => null);
        if (plan?.active && plan.revision === signals.revision) set({ plan, planRevealed: plan.steps.length });
      }
      if (actionId) {
        const action = await api.action(actionId).catch(() => null);
        if (action && !["cancelled", "invalidated"].includes(action.status)) set({ action });
      }
      await actions.refreshAudit();
    } catch {
      resetOffline();
      const a = offline.analysis();
      set({
        source: "offline", timeline: { events: a.events, mode: a.mode, warnings: a.warnings, revision: a.revision, rejected: a.rejected },
        records: offline.records(), signals: offline.signals(), education: offline.education(), catalog: offline.catalog(),
        resources: offline.resources(),
      });
      await actions.refreshAudit();
    }
    set({ status: "ready" });
  },

  async refreshAudit() {
    try {
      const page = state.source === "live" ? await fetchAllAudit() : offline.audit();
      set({ audit: page.events, auditLimitation: page.limitation });
    } catch { /* keep the last loaded history */ }
  },

  localLog(what: string, actor: LocalAudit["actor"] = "patient", origin: LocalAudit["origin"] = "app") {
    set((s) => ({ localAudit: [...s.localAudit, { id: "l" + Date.now() + Math.random(), at: new Date().toISOString(), actor, what, origin }] }));
    persistPrefs();
  },

  async openEvidence(eventId: string) {
    try {
      const ev = state.source === "live" ? await api.evidence(eventId) : offline.evidence(eventId);
      set({ evidence: ev, evidenceOpen: true });
    } catch {
      actions.toast("Couldn't load that record", { detail: "Try again, or reset the demo." });
    }
  },
  closeEvidence() { set({ evidenceOpen: false }); },

  setConstraint(patch: NavigationConstraints) { set((s) => ({ constraints: { ...s.constraints, ...patch } })); },

  async plan() {
    const sig = openSignal(state);
    if (!sig || !state.signals) return;
    const prior = state.plan;
    set({ planBusy: true, error: null, planRevealed: 0 });
    try {
      const plan = state.source === "live"
        ? await api.plan({ revision: state.signals.revision, signal_id: sig.id, constraints: state.constraints })
        : offline.plan(sig.id, state.constraints);
      safe(() => localStorage.setItem(PLAN_KEY, plan.id), undefined);
      // Replanning invalidates any unfinished reminder on the server. Clear it here too.
      const keep = state.action?.status === "completed" ? state.action : null;
      if (!keep) safe(() => localStorage.removeItem(ACTION_KEY), undefined);
      set({ plan, priorPlan: prior, action: keep, icsUrl: keep ? state.icsUrl : null, notYet: false });
      // Stage the backend's real steps so people can follow them. Nothing is invented.
      for (let i = 1; i <= plan.steps.length; i++) {
        await wait(420 + Math.random() * 260);
        set({ planRevealed: i });
      }
      await actions.refreshAudit();
    } catch (e) {
      set({ error: e instanceof ApiError ? e.message : "Planning failed. Reset the demo and try again." });
    } finally {
      set({ planBusy: false });
    }
  },

  async propose(date: string) {
    if (!state.plan?.selected) return;
    set({ busy: true, error: null });
    try {
      const action = state.source === "live" ? await api.propose(state.plan.id, date) : offline.propose(state.plan.id, date);
      safe(() => localStorage.setItem(ACTION_KEY, action.id), undefined);
      set({ action });
      await actions.refreshAudit();
    } catch (e) {
      set({ error: e instanceof ApiError ? e.message : "Couldn't prepare the reminder." });
    } finally { set({ busy: false }); }
  },

  async approve() {
    const a = state.action;
    if (!a || a.status !== "proposed") return;
    set({ busy: true, error: null });
    try {
      const approved = state.source === "live" ? await api.approve(a.id) : offline.approve(a.id);
      set({ action: approved });
      actions.toast("Reminder approved", { detail: "Creating your calendar reminder now." });
      await wait(650);
      let blob: Blob; let after: ReminderAction;
      if (state.source === "live") { blob = await api.calendar(a.id); after = await api.action(a.id); }
      else { const r = offline.calendar(a.id); blob = r.blob; after = r.action; }
      if (state.icsUrl) URL.revokeObjectURL(state.icsUrl);
      const icsUrl = URL.createObjectURL(blob);
      set((s) => ({ action: after, icsUrl, watchBuzz: s.watchBuzz + 1, watchScreen: 0 }));
      actions.toast("Reminder created", { detail: "A reminder is not care. Status: awaiting confirmation.", href: icsUrl, download: "carerelay-reminder.ics" });
      await actions.refreshAudit();
    } catch (e) {
      set({ error: e instanceof ApiError ? e.message : "Approval didn't go through. Nothing was scheduled." });
    } finally { set({ busy: false }); }
  },

  async cancel() {
    const a = state.action;
    if (!a) return;
    set({ busy: true });
    try {
      if (["proposed", "approved", "awaiting_confirmation"].includes(a.status)) {
        if (state.source === "live") await api.cancel(a.id); else offline.cancel(a.id);
      }
      safe(() => localStorage.removeItem(ACTION_KEY), undefined);
      if (state.icsUrl) URL.revokeObjectURL(state.icsUrl);
      set({ action: null, icsUrl: null });
      actions.toast("Reminder cancelled", { detail: "Nothing is scheduled." });
      await actions.refreshAudit();
    } finally { set({ busy: false }); }
  },

  async complete(completed_on: string, reported_by: "patient" | "caregiver" = "patient", origin: "app" | "watch" = "app") {
    const a = state.action;
    if (!a || a.status !== "awaiting_confirmation") return;
    set({ busy: true, error: null });
    try {
      const body = { confirmed: true as const, completed_on, reported_by };
      const done = state.source === "live" ? await api.complete(a.id, body) : offline.complete(a.id, body);
      set({ action: done, notYet: false });
      actions.toast("Completion recorded", { detail: "Recorded as patient-reported, not clinically verified." });
      if (origin === "watch") actions.localLog("Completion answered on the watch", "patient", "watch");
      await actions.refreshAudit();
    } catch (e) {
      set({ error: e instanceof ApiError ? e.message : "Couldn't record completion." });
    } finally { set({ busy: false }); }
  },

  notYet(origin: "app" | "watch" = "app") {
    set({ notYet: true });
    if (origin === "watch") actions.localLog("Answered \"Not yet\" on the watch (no completion recorded)", "patient", "watch");
  },

  toggleShare(metric: Metric, origin: "app" | "watch") {
    const on = !state.sharing[metric];
    set((s) => ({ sharing: { ...s.sharing, [metric]: on }, pulse: s.pulse + 1 }));
    const label = { heart_rate: "Heart rate", blood_pressure: "Blood pressure", glucose: "Glucose", steps: "Steps", sleep: "Sleep" }[metric];
    actions.localLog(`${label} sharing turned ${on ? "on" : "off"} by patient${origin === "watch" ? " (on the watch)" : ""}`, "patient", origin);
  },

  review(findingId: string, decision: ReviewDecision, remark: string) {
    set((s) => {
      const prev = s.reviews[findingId] ?? [];
      const entry: ReviewEntry = { version: prev.length + 1, decision, remark, at: new Date().toISOString(), reviewer: "Synthetic clinician reviewer (demo persona)", synthetic: true };
      return { reviews: { ...s.reviews, [findingId]: [...prev, entry] } };
    });
    actions.localLog(`Clinician review: ${decision.replace(/-/g, " ")}`, "clinician");
  },

  setPref(p: Partial<Pick<State, "lang" | "largeText" | "highContrast" | "plain">>) { set(p); persistPrefs(); },
  setEdu(edu: EducationState) { set({ edu }); },
  visitChamber() { if (!state.chamberVisited) set({ chamberVisited: true }); },
  setWatchScreen(i: number) { set({ watchScreen: i }); },

  async addRecord(file: File) {
    const id = "upl" + Date.now();
    const up: Upload = { id, name: file.name, size: file.size, state: "uploaded" };
    const patch = (p: Partial<Upload>) => set((s) => ({ uploads: s.uploads.map((u) => (u.id === id ? { ...u, ...p } : u)) }));
    set((s) => ({ uploads: [up, ...s.uploads] }));
    const isImage = file.type.startsWith("image/");
    const isText = file.type === "text/plain" || file.name.endsWith(".txt");
    if (!isImage && !isText) {
      patch({ state: "unsupported", note: "Text extraction isn't available for this file type in the demo." });
      return;
    }
    let text = "";
    try {
      if (isImage) {
        patch({ state: "reading", progress: 0 });
        const { createWorker } = await import("tesseract.js");
        // Language data is bundled in public/tesseract so OCR works offline.
        const worker = await createWorker("eng", 1, {
          langPath: "/tesseract", gzip: true, workerPath: "/tesseract/worker.min.js", corePath: "/tesseract/core",
          logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") patch({ progress: m.progress }); },
        });
        const r = await worker.recognize(file);
        await worker.terminate();
        text = r.data.text.trim();
      } else {
        patch({ state: "reading" });
        text = (await file.text()).trim();
      }
    } catch {
      patch({ state: "failed", note: "Text couldn't be read from this file. Nothing was added." });
      return;
    }
    if (!text) { patch({ state: "failed", note: "No readable text was found. Nothing was added." }); return; }
    patch({ state: "checking", text });
    if (state.source !== "live") {
      patch({ state: "done", accepted: 0, rejected: 0, note: "Evidence checks need the CareRelay backend. In offline demo mode the text is shown but not added to the timeline." });
      return;
    }
    try {
      const recId = "upload-" + Date.now().toString(36);
      const originals: RecordInput[] = state.records.map((r) => ({ id: r.id, date: r.date, title: r.title, text: r.text, synthetic: true }));
      const analysis = await api.analyze([...originals, { id: recId, date: todayUTC(), title: file.name.replace(/\.[^.]+$/, ""), text, synthetic: true }]);
      const accepted = analysis.events.filter((e) => e.evidence.source_id === recId).length;
      const rejected = analysis.rejected.filter((r) => r.candidate.source_id === recId).length;
      const [timeline, signals] = await Promise.all([api.timeline(), api.signals()]);
      set({ timeline, records: analysis.records, signals, plan: null, action: null, icsUrl: null });
      patch({ state: "done", accepted, rejected, note: accepted === 0 ? "Nothing in this text matched the supported evidence rules, so nothing was added." : undefined });
      await actions.refreshAudit();
    } catch (e) {
      patch({ state: "failed", note: e instanceof ApiError ? `The evidence check refused this record: ${e.message}` : "The evidence check couldn't run." });
    }
  },

  async reset() {
    safe(() => { localStorage.removeItem(ACTION_KEY); localStorage.removeItem(PLAN_KEY); localStorage.removeItem(PREFS_KEY); }, undefined);
    if (state.icsUrl) URL.revokeObjectURL(state.icsUrl);
    if (state.source === "live" && state.action && ["proposed", "approved", "awaiting_confirmation"].includes(state.action.status)) {
      await api.cancel(state.action.id).catch(() => null);
    }
    const keep = { lang: state.lang, largeText: state.largeText, highContrast: state.highContrast };
    state = { ...initial, ...keep };
    listeners.forEach((l) => l());
    if (state.source === "live") await api.analyze().catch(() => null);
    await actions.init();
    actions.toast("Demo reset", { detail: "Amina's three original records are restored." });
  },
};
