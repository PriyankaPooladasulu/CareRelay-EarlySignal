"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { ClipboardList, History } from "lucide-react";
import { actions, openSignal, stageOf, useStore } from "@/lib/store";
import type { ReviewDecision } from "@/lib/types";
import { getSeries, gapSignals, fmtValue, METRICS } from "@/lib/vitals";
import { Button, PaperSheet, StatusTag, fmtDate, fmtTime } from "./ui";
import { REASONS } from "./action";

const METRIC_LABEL = { heart_rate: "Heart rate", blood_pressure: "Blood pressure", glucose: "Glucose", steps: "Steps", sleep: "Sleep" } as const;

/** Replaces the old FHIR/SOAP note: only source quotes, what's unconfirmed, what she chose. */
export function HandoffSummary() {
  const timeline = useStore((s) => s.timeline);
  const sig = useStore(openSignal);
  const plan = useStore((s) => s.plan);
  const action = useStore((s) => s.action);
  const sharing = useStore((s) => s.sharing);
  const stage = useStore(stageOf);
  const [showRaw, setShowRaw] = useState(false);
  const series = useMemo(() => getSeries(), []);
  const shared = METRICS.filter((m) => sharing[m]);
  const gaps = gapSignals(series).filter((g) => sharing[g.metric]);

  return (
    <PaperSheet as="section" className="relative mt-12 max-w-[1040px] overflow-hidden px-6 py-7 md:p-[clamp(24px,4vw,56px)]">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-chart" />
      <header>
        <h3 className="flex items-center gap-3 text-[1.667rem] font-semibold tracking-[-0.015em]"><ClipboardList aria-hidden className="text-ink-faint" strokeWidth={1.6} /> Clinician handoff summary</h3>
        <dl className="mt-3.5 flex flex-wrap gap-x-7 gap-y-2 text-[0.833rem]">
          <div className="flex gap-1.5"><dt className="text-ink-3">Patient</dt><dd>Amina (synthetic, DEMO-001)</dd></div>
          <div className="flex gap-1.5"><dt className="text-ink-3">Region</dt><dd>Ontario</dd></div>
          <div className="flex gap-1.5"><dt className="text-ink-3">Generated</dt><dd>{fmtDate(new Date().toISOString())}</dd></div>
        </dl>
      </header>
      <div className="mt-2">
        <section>
          <h4 className="mb-1.5 mt-7 text-[0.944rem] font-bold">What the records say</h4>
          <ul>
            {timeline?.events.map((e) => (
              <li key={e.id} className="grid items-baseline gap-x-5 gap-y-1 border-t border-hair py-4 md:grid-cols-[110px_minmax(0,1fr)_auto]">
                <span className="text-[0.833rem] font-bold text-chart tabular-nums"><time dateTime={e.date}>{fmtDate(e.date)}</time></span>
                <span className="record-voice text-[1.111rem] leading-[1.5]">&ldquo;{e.evidence.quote}&rdquo;</span>
                <span className="justify-self-start"><StatusTag status="fact" label={e.evidence.source_title} /></span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="mb-1.5 mt-7 text-[0.944rem] font-bold">What is unconfirmed</h4>
          {stage === "completed" ? (
            <p className="mt-1">The supplied records still contain no completion. The patient has reported completion (see below); it is not clinically verified.</p>
          ) : (
            <p className="mt-1 flex flex-wrap items-center gap-2">{sig?.title}. <StatusTag status="unconfirmed" /></p>
          )}
          {sig && <p className="text-ink-2">{sig.summary.replace("No validated later completion was found after the latest instruction in the supplied records.", "We couldn't find a record showing the eye exam happened.").replace("Missing documentation does not prove care did not occur.", "Missing documentation does not prove care did not occur. It means the records you shared don't show it.")}</p>}
        </section>
        <section>
          <h4 className="mb-1.5 mt-7 text-[0.944rem] font-bold">What the patient chose</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {!plan && <li>No navigation help requested yet.</li>}
            {plan && <li>Planned around: {[
              plan.constraints.travel === "cannot_travel" && "can't travel",
              plan.constraints.language !== "any" && `language ${plan.constraints.language}`,
              plan.constraints.accessibility !== "none" && `accessibility ${plan.constraints.accessibility}`,
              !plan.constraints.phone_available && "no phone",
              plan.constraints.existing_referral_confirmed && "existing UHN referral (demo assumption)",
            ].filter(Boolean).join(", ") || "no specific needs"}.</li>}
            {plan?.evaluations.filter((e) => !e.eligible).map((e) => <li key={e.resource_id}>Not suitable: {e.resource_id} ({e.reasons.map((r) => REASONS[r] ?? r).join(" ")})</li>)}
            {plan?.selected && <li>Navigation resource: {plan.selected.name}.</li>}
            {action && <li>Reminder for {fmtDate(action.reminder_date)}: {action.status.replace(/_/g, " ")}{action.approved_at ? `, approved by patient at ${fmtTime(action.approved_at)}` : ""}.</li>}
            {action?.completion && <li>Completion reported by {action.completion.reported_by} on {fmtDate(action.completion.completed_on)} (explicit unverified report).</li>}
          </ul>
        </section>
        <section>
          <h4 className="mb-1.5 mt-7 flex flex-wrap items-center gap-2 text-[0.944rem] font-bold">Shared device data (last 30 days) {shared.length > 0 && <StatusTag status="patient-reported" label="Shared by patient" />}</h4>
          {shared.length === 0 ? (
            <p className="mt-1 text-ink-2">Amina hasn&apos;t shared any device data. Nothing from her devices appears here unless she turns it on.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-3">Shared by patient · device readings, as reported. CareRelay does not interpret them.</p>
              <table className="mt-2 w-full text-left text-[0.944rem]">
                <thead className="text-sm text-ink-3"><tr><th className="py-1 font-bold">Metric</th><th className="font-bold">Readings</th><th className="font-bold">Range</th><th className="font-bold">Source</th></tr></thead>
                <tbody>
                  {shared.map((m) => {
                    const s = series[m];
                    return (
                      <tr key={m} className="border-t border-hair">
                        <td className="py-3 font-bold">{METRIC_LABEL[m]}</td>
                        <td>{s.points.length}</td>
                        <td>{s.points.length ? `${fmtDate(new Date(s.points[0].t).toISOString())} – ${fmtDate(new Date(s.points.at(-1)!.t).toISOString())}` : "none"}</td>
                        <td className="text-ink-2">{s.device}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {gaps.map((g) => <p key={g.metric} className="mt-2 flex flex-wrap items-center gap-2"><StatusTag status="incomplete" /> {g.text}</p>)}
              <Button variant="ghost" className="mt-2 !px-0" aria-expanded={showRaw} onClick={() => setShowRaw(!showRaw)}>{showRaw ? "Hide readings" : "View readings"}</Button>
              {showRaw && (
                <div className="mt-2 max-h-72 overflow-auto rounded-[4px] border border-line">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-mist"><tr><th className="p-2">Time</th><th>Metric</th><th>Value</th><th>Device</th></tr></thead>
                    <tbody>
                      {shared.flatMap((m) => series[m].points.slice(-40).map((p) => ({ m, p }))).sort((a, b) => b.p.t - a.p.t).map(({ m, p }) => (
                        <tr key={m + p.t} className="border-t border-line">
                          <td className="p-2">{new Date(p.t).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                          <td>{METRIC_LABEL[m]}</td><td>{fmtValue(m, p)} {series[m].unit}</td><td className="text-ink-2">{series[m].device}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
        <section>
          <h4 className="mb-1.5 mt-7 text-[0.944rem] font-bold">Open questions</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {stage === "completed"
              ? <li>Can the reported exam be confirmed against a clinical result?</li>
              : <li>Was a retinal exam completed and documented somewhere CareRelay can&apos;t see?</li>}
            <li>Is there a confirmed referral destination for the retinal exam?</li>
            {gaps.map((g) => <li key={g.metric}>{g.text.replace(/\.$/, "")}: is that expected?</li>)}
          </ul>
        </section>
        <p className="mt-7 border-t border-hair pt-4 text-sm text-ink-3">This summary contains no diagnosis, classification or confidence score. It lists source quotes and choices only.</p>
      </div>
    </PaperSheet>
  );
}

const DECISIONS: { v: ReviewDecision; label: string }[] = [
  { v: "confirm", label: "Confirm" }, { v: "correct", label: "Correct" }, { v: "needs-more-evidence", label: "Needs more evidence" },
];

/** Clinician-in-the-loop: every finding can be confirmed, corrected or sent back, with versions. */
export function ClinicianReview() {
  const signals = useStore((s) => s.signals);
  const action = useStore((s) => s.action);
  const reviews = useStore((s) => s.reviews);
  const [remark, setRemark] = useState<Record<string, string>>({});
  const findings = [
    ...(signals?.signals.map((g) => ({ id: g.id, title: g.title, detail: g.summary })) ?? []),
    ...(action?.completion ? [{ id: "completion-" + action.id, title: "Patient-reported completion", detail: `Reported by ${action.completion.reported_by} for ${fmtDate(action.completion.completed_on)}. Not clinically verified.` }] : []),
  ];
  return (
    <section className="mt-10 max-w-[1040px] rounded-[20px] bg-paper p-6 shadow-paper md:p-10" aria-labelledby="clin-h">
      <h3 id="clin-h" className="text-[1.333rem] font-semibold">Clinician review</h3>
      <p className="mt-1 text-ink-2">A clinician checks each finding. The reviewer here is a synthetic demo persona. Reviews are saved in this browser only.</p>
      <ul className="mt-4 space-y-6">
        {findings.map((f) => {
          const hist = reviews[f.id] ?? [];
          return (
            <li key={f.id} className="border-t border-hair pt-5">
              <p className="text-lg font-bold">{f.title}</p>
              <p className="text-ink-2">{f.detail}</p>
              <label className="mt-3 block font-bold" htmlFor={"rm-" + f.id}>Remark (optional)</label>
              <textarea id={"rm-" + f.id} rows={2} value={remark[f.id] ?? ""} onChange={(e) => setRemark({ ...remark, [f.id]: e.target.value })}
                className="mt-1 w-full max-w-[70ch] rounded-[12px] border border-hair bg-white p-3" />
              <div className="mt-2 flex flex-wrap gap-2">
                {DECISIONS.map((d) => (
                  <Button key={d.v} variant="quiet" onClick={() => { actions.review(f.id, d.v, remark[f.id] ?? ""); setRemark({ ...remark, [f.id]: "" }); }}>{d.label}</Button>
                ))}
              </div>
              {hist.length > 0 && (
                <ol className="mt-3 space-y-2">
                  {[...hist].reverse().map((h) => (
                    <li key={h.version} className={clsx("rounded-[12px] bg-mist p-3", h.version !== hist.length && "opacity-75")}>
                      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[0.833rem]">
                        <div className="flex gap-1.5"><dt className="text-ink-3">Version</dt><dd className="font-bold">v{h.version}</dd></div>
                        <div className="flex gap-1.5"><dt className="text-ink-3">Decision</dt><dd className="font-bold">{h.decision.replace(/-/g, " ")}</dd></div>
                        <div className="flex gap-1.5"><dt className="text-ink-3">Reviewer</dt><dd>{h.reviewer}</dd></div>
                        <div className="flex gap-1.5"><dt className="text-ink-3">When</dt><dd className="tabular-nums">{fmtDate(h.at)} {fmtTime(h.at)}</dd></div>
                      </dl>
                      {h.remark && <p className="mt-0.5">{h.remark}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const WHO: Record<string, string> = {
  audit_started: "System", analysis_saved: "CareRelay evidence checker", plan_created: "CareRelay planner", plan_step: "CareRelay planner",
  plan_invalidated: "CareRelay planner", action_proposed: "CareRelay (prepared for review)", action_approved: "Patient", action_cancelled: "Patient",
  calendar_generated: "System (after approval)", completion_reported: "Patient", action_invalidated: "System",
};
const WHAT: Record<string, string> = {
  audit_started: "History started", analysis_saved: "Records analyzed", plan_created: "Navigation plan created", plan_step: "Planner check",
  plan_invalidated: "Old plan replaced", action_proposed: "Reminder proposed", action_approved: "Reminder approved", action_cancelled: "Reminder cancelled",
  calendar_generated: "Reminder file created", completion_reported: "Completion reported", action_invalidated: "Unfinished reminder invalidated",
};

/** A quiet log: who, what, when, approved by. */
export function AuditLog() {
  const audit = useStore((s) => s.audit);
  const local = useStore((s) => s.localAudit);
  const limitation = useStore((s) => s.auditLimitation);
  const source = useStore((s) => s.source);
  const [steps, setSteps] = useState(false);
  const stepCount = audit.filter((e) => e.event_type === "plan_step").length;
  const rows = [
    ...audit.filter((e) => steps || e.event_type !== "plan_step").map((e) => ({
      key: "s" + e.sequence, at: e.created_at, who: e.event_type === "completion_reported" && (e.details as { reported_by?: string }).reported_by === "caregiver" ? "Caregiver" : WHO[e.event_type] ?? e.entity_type,
      what: WHAT[e.event_type] ?? e.event_type.replace(/_/g, " "),
      detail: e.event_type === "plan_step" ? String((e.details as { message?: string }).message ?? "") : e.from_status || e.to_status ? `${e.from_status ?? "–"} → ${e.to_status ?? "–"}` : "",
      where: source === "live" ? "Backend" : "Offline demo",
    })),
    ...local.map((l) => ({ key: l.id, at: l.at, who: l.actor === "clinician" ? "Clinician (synthetic)" : "Patient", what: l.what, detail: l.origin === "watch" ? "from the watch" : "", where: "This browser" })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="mt-12 max-w-[1040px]" aria-labelledby="audit-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="audit-h" className="flex items-center gap-3 text-[1.333rem] font-semibold"><History aria-hidden className="text-ink-faint" strokeWidth={1.6} /> What happened, and who approved it</h3>
        <div className="flex gap-2">
          {stepCount > 0 && <Button variant="ghost" aria-pressed={steps} onClick={() => setSteps(!steps)}>{steps ? "Hide" : "Show"} {stepCount} planner checks</Button>}
          <Button variant="ghost" onClick={() => actions.refreshAudit()}>Refresh</Button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-[4px] bg-paper px-2 shadow-paper md:px-6">
        <table className="w-full min-w-[640px] text-left">
          <thead className="text-[0.833rem] text-ink-3"><tr><th className="p-3 font-semibold">When</th><th className="font-bold">Who</th><th className="font-bold">What</th><th className="font-bold">Change</th><th className="pr-2.5 font-bold">Recorded by</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-hair align-baseline">
                <td className="whitespace-nowrap p-3 text-[0.833rem] font-bold text-chart tabular-nums">{fmtDate(r.at, { month: "short", day: "numeric" })} {fmtTime(r.at)}</td>
                <td className="py-3.5 pr-4 font-semibold">{r.who}</td>
                <td className="py-3.5 pr-4">{r.what}</td>
                <td className="py-3.5 pr-4 text-[0.833rem] text-ink-2">{r.detail}</td>
                <td className="py-3.5 pr-3"><span className="inline-flex rounded-full border border-chart/[.22] bg-chart/[.08] px-2.5 py-0.5 text-[0.722rem] font-semibold text-chart">{r.where}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-ink-3">{limitation} Sharing changes and clinician reviews are kept in this browser; the demo backend has no endpoint for them.</p>
    </section>
  );
}
