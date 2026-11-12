"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { CalendarClock, CircleCheck, Download, ExternalLink, Phone, MapPin, Info } from "lucide-react";
import { actions, openSignal, stageOf, useStore } from "@/lib/store";
import type { NavigationConstraints, NavigationPlan, NavigationResource } from "@/lib/carerelay-client";
import { Button, StatusTag, StepRow, fmtDate, fmtTime, type StepState } from "./ui";
import { ThreadRow } from "./thread";

export const REASONS: Record<string, string> = {
  in_person_pathway_conflicts_with_travel_constraint: "This is an in-person pathway, and you said you can't travel.",
  existing_referral_to_this_clinic_not_confirmed: "It needs an existing referral to this clinic, which isn't confirmed.",
  requested_language_not_verified: "Support for your language isn't verified for this service.",
  requested_accessibility_not_verified: "Your accessibility need isn't verified for this service.",
  telephone_access_required: "It needs a telephone, and you said you don't have one.",
  resource_review_out_of_date: "This registry entry is past its review date, so it isn't used.",
  jurisdiction_not_supported: "It isn't available in your region.",
};
const reasonText = (msg: string) => msg.split("; ").map((c) => REASONS[c] ?? c).join(" ");

const todayUTC = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onClick}
      className={clsx("min-h-11 rounded-full border-2 px-4 font-bold transition-colors duration-200",
        on ? "border-chart bg-chart text-white" : "border-line bg-white text-ink hover:border-chart/60")}>
      {children}
    </button>
  );
}

function Constraints() {
  const c = useStore((s) => s.constraints);
  const set = (p: NavigationConstraints) => actions.setConstraint(p);
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-lg font-bold">What should we plan around?</legend>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 font-bold text-ink-2">Travel</span>
        <Chip on={c.travel === "cannot_travel"} onClick={() => set({ travel: c.travel === "cannot_travel" ? "any" : "cannot_travel" })}>I can&apos;t travel to appointments</Chip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 font-bold text-ink-2">Language</span>
        <span className="flex flex-1 flex-wrap gap-2">{[["any", "Any"], ["en", "English"], ["fr", "French"], ["hi", "Hindi"], ["ta", "Tamil"]].map(([v, l]) => (
          <Chip key={v} on={c.language === v} onClick={() => set({ language: v })}>{l}</Chip>
        ))}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 font-bold text-ink-2">Accessibility</span>
        <span className="flex flex-1 flex-wrap gap-2">{[["none", "None"], ["tty", "TTY"], ["step_free", "Step-free access"]].map(([v, l]) => (
          <Chip key={v} on={c.accessibility === v} onClick={() => set({ accessibility: v as NavigationConstraints["accessibility"] })}>{l}</Chip>
        ))}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 font-bold text-ink-2">Phone</span>
        <Chip on={c.phone_available === false} onClick={() => set({ phone_available: c.phone_available === false })}>I don&apos;t have a phone</Chip>
      </div>
      <label className="flex max-w-[70ch] cursor-pointer items-start gap-3 rounded-[12px] border border-dashed border-line bg-white/70 p-3">
        <input type="checkbox" className="mt-1 size-5 flex-none accent-[#1f5fa0]" checked={!!c.existing_referral_confirmed} onChange={(e) => set({ existing_referral_confirmed: e.target.checked })} />
        <span><span className="font-bold">Demo scenario assumption:</span> Amina already has a referral to the UHN eye clinic. <span className="text-ink-2">This is a test assumption for the demo. It is not in Amina&apos;s records.</span></span>
      </label>
    </fieldset>
  );
}

interface Row { id: string; state: StepState; title: string; detail?: string; code?: string }
function traceRows(plan: NavigationPlan, revealed: number, names: Record<string, string>, approved: boolean): Row[] {
  const rows: Row[] = [];
  const shown = plan.steps.slice(0, revealed);
  for (const [i, s] of shown.entries()) {
    const name = s.resource_id ? names[s.resource_id] ?? s.resource_id : "";
    if (s.stage === "checking_resource") {
      rows.push({ id: "r" + i, state: "running", title: `Check ${name}`, detail: "Checking the verified registry entry and its review date." });
    } else if (s.stage === "checking_constraints") {
      const r = rows.findLast((x) => x.title === `Check ${name}`);
      if (r) r.detail = "Checking region, travel, referral, language, accessibility and phone.";
    } else if (s.stage === "rejected") {
      const r = rows.findLast((x) => x.title === `Check ${name}`);
      if (r) { r.state = "failed"; r.detail = reasonText(s.message); r.code = s.message; }
    } else if (s.stage === "selected") {
      const r = rows.findLast((x) => x.title === `Check ${name}`);
      if (r) { r.state = "passed"; r.detail = "Matches every need you told us. Eligibility still needs to be confirmed directly."; }
    } else if (s.stage === "searching_alternative") {
      rows.push({ id: "a" + i, state: "info", title: "Search the remaining verified options" });
    } else if (s.stage === "no_verified_match") {
      rows.push({ id: "n" + i, state: "waiting", title: "No verified option matched every need", detail: "Nothing is proposed. A person should review this manually; we don't invent a substitute." });
    }
  }
  // Steps after "searching_alternative" that are done become passed-through info.
  if (revealed >= plan.steps.length && plan.status === "proposed") {
    rows.push({ id: "you", state: approved ? "passed" : "waiting", title: "Your approval", detail: approved ? "You approved the reminder." : "Nothing happens until you approve. See below." });
  }
  return rows;
}

function ResourceCard({ r, state, better }: { r: NavigationResource; state: "selected" | "rejected" | "checking"; better: boolean }) {
  return (
    <motion.article layout transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={clsx("rounded-[20px] border bg-white p-4 transition-[filter,opacity,transform] duration-300", state === "rejected" && "stepped-back", state === "selected" ? "border-chart shadow-[0_8px_24px_-16px_rgba(31,95,160,.6)]" : "border-line")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="resource-title text-lg font-bold leading-snug">{r.name}</h4>
        {state === "selected" && <StatusTag status="approved" label={better ? "Better matches your constraint" : "Matches your needs"} className="!bg-chart !text-white !border-chart" />}
        {state === "rejected" && <span className="text-sm font-bold text-amber-text">✕ Doesn&apos;t fit</span>}
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">{r.delivery === "remote" ? <Phone size={15} aria-hidden /> : <MapPin size={15} aria-hidden />} {r.delivery === "remote" ? "Remote" : "In person"} · {r.location}</p>
      <p className="mt-2">{r.purpose}</p>
      <details className="mt-2 text-sm text-ink-2">
        <summary className="min-h-11 cursor-pointer content-center font-bold text-ink">Verified on {fmtDate(r.verified_on)} · sources and limits</summary>
        <p className="mt-1">{r.verification_note}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">{r.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        <p className="mt-2">Review due {fmtDate(r.review_due)}. Sources:</p>
        <ul className="mt-1 space-y-1">{r.source_urls.map((u) => (
          <li key={u}><a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-chart underline underline-offset-2">{u.replace(/^https?:\/\//, "")}<ExternalLink size={13} aria-hidden /></a></li>
        ))}</ul>
      </details>
    </motion.article>
  );
}

/** Scenes 6–7: the agent's work, kept in three zones: Plan, Checks, Evidence. */
export function ActionCenter() {
  const plan = useStore((s) => s.plan);
  const prior = useStore((s) => s.priorPlan);
  const revealed = useStore((s) => s.planRevealed);
  const busy = useStore((s) => s.planBusy);
  const error = useStore((s) => s.error);
  const registry = useStore((s) => s.resources);
  const sig = useStore(openSignal);
  const stage = useStore(stageOf);
  const action = useStore((s) => s.action);
  const names = useMemo(() => Object.fromEntries((registry?.resources ?? []).map((r) => [r.id, r.name])), [registry]);
  const approved = !!action && ["approved", "awaiting_confirmation", "completed"].includes(action.status);
  const rows = plan ? traceRows(plan, revealed, names, approved) : [];
  const done = plan && revealed >= plan.steps.length;
  const checkedIds = plan ? [...new Set(plan.steps.slice(0, revealed).map((s) => s.resource_id).filter(Boolean) as string[])] : [];
  const rejectedIds = new Set(plan?.steps.slice(0, revealed).filter((s) => s.stage === "rejected").map((s) => s.resource_id));
  const better = !!plan?.selected && (rejectedIds.size > 0 || (!!prior?.selected && prior.selected.id !== plan.selected.id));
  const completed = stage === "completed";

  return (
    <section id="navigate" aria-labelledby="navigate-h" className="pt-16">
      <ThreadRow node={plan?.status === "proposed" && done ? "step-done" : "step"} nodeAt={22} line={plan?.status === "proposed" && done ? "solid" : "pending"} className="pb-12">
        <h2 id="navigate-h" tabIndex={-1} className="t-section">Next steps</h2>
        <p className="mt-3.5 max-w-[56ch] text-[1.111rem] text-ink-2">Would you like help finding verified next-step information? Tell us what to plan around. CareRelay checks a small registry of verified Ontario resources. It doesn&apos;t search the web or book anything.</p>
        {completed ? (
          <p className="mt-4 font-bold">You&apos;ve reported the exam as done, so there&apos;s nothing more to plan.</p>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div>
              <Constraints />
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button onClick={() => actions.plan()} disabled={busy || !sig}>{busy ? "Checking…" : plan ? "Check again with these needs" : "Yes, find verified options"}</Button>
                {plan && <span className="text-sm text-ink-2">Checking again replaces the old plan and cancels any reminder that wasn&apos;t completed.</span>}
              </div>
              {error && <p role="alert" className="mt-3 rounded-[12px] border border-amber/60 bg-amber-tint p-3 font-bold text-amber-text">{error}</p>}
            </div>
            <div className="rounded-[20px] bg-paper p-6 shadow-paper" aria-label="Agent trace">
              <h3 className="text-sm font-bold text-ink-3">Plan · what CareRelay will do</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-2">
                <li>Check each verified resource in the registry, in a fixed order.</li>
                <li>For each one, check your region, travel, referral, language, accessibility and phone.</li>
                <li>Suggest the first that fits every need, or suggest nothing.</li>
                <li>Wait for you. Nothing is scheduled without your approval.</li>
              </ol>
              <h3 className="mt-5 text-sm font-bold text-ink-3">Checks · what it actually did</h3>
              {!plan && !busy && <p className="mt-2 text-ink-2">Not started. Choose your needs, then select “Yes, find verified options”.</p>}
              {busy && revealed === 0 && <ul className="mt-1"><StepRow state="running" title="Sending your needs to the planner" /></ul>}
              <ul className="mt-1" aria-live="polite">{rows.map((r) => <StepRow key={r.id} state={r.state} title={r.title} detail={r.detail} code={r.code} />)}</ul>
              {plan && done && <p className="mt-2 text-xs text-ink-3">Deterministic navigation checks, recorded in the audit log. Not an AI model, not a live web search. Plan {plan.id.slice(0, 13)}…</p>}
            </div>
          </div>
        )}
      </ThreadRow>
      {plan && checkedIds.length > 0 && !completed && (
        <ThreadRow line={plan.status === "proposed" && done ? "solid" : "pending"} className="pb-12">
          <h3 className="text-sm font-bold text-ink-3">Evidence · where each result came from</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {checkedIds.map((id) => {
              const r = registry?.resources.find((x) => x.id === id);
              if (!r) return null;
              const state = rejectedIds.has(id) ? "rejected" : plan.selected?.id === id && done ? "selected" : "checking";
              return <ResourceCard key={id} r={r} state={state} better={better} />;
            })}
          </div>
          <p className="mt-4 flex max-w-[78ch] gap-2 text-ink-2"><Info aria-hidden className="mt-1 flex-none" size={18} />{registry?.disclaimer}</p>
        </ThreadRow>
      )}
    </section>
  );
}

/** Scenes 8–9: a calm, separate approval surface. A reminder is not care. */
export function Approval() {
  const plan = useStore((s) => s.plan);
  const action = useStore((s) => s.action);
  const busy = useStore((s) => s.busy);
  const icsUrl = useStore((s) => s.icsUrl);
  const stage = useStore(stageOf);
  const [date, setDate] = useState(() => addDays(todayUTC(), 7));
  const ready = plan?.status === "proposed" && plan.active && !!plan.selected;
  const st = action?.status;
  const nodeDone = st === "approved" || st === "awaiting_confirmation" || st === "completed";

  return (
    <section id="approve" aria-labelledby="approve-h" className="pt-4">
      <ThreadRow node={nodeDone ? "step-done" : "step"} nodeAt={40} line={nodeDone ? "solid" : "pending"} className="pb-12">
        <div className="max-w-[880px] rounded-[20px] bg-paper p-6 shadow-paper md:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="approve-h" tabIndex={-1} className="t-surface">Your approval</h2>
            {st === "proposed" && <StatusTag status="proposed" label="Waiting for your approval" />}
            {st === "approved" && <StatusTag status="approved" />}
            {(st === "awaiting_confirmation") && <StatusTag status="awaiting" />}
            {st === "completed" && <StatusTag status="completed" />}
          </div>
          {!ready && !action && (
            <p className="mt-3 text-lg text-ink-2">{plan?.status === "no_verified_match"
              ? "No verified option matched every need, so there is nothing to approve. A person on the care team should review this manually."
              : "First, find a verified next step above. Nothing can be scheduled before that."}</p>
          )}
          {ready && !action && (
            <>
              <p className="mt-3 text-xl">Would you like CareRelay to create a follow-up reminder for the retinal exam?</p>
              <p className="mt-1 text-ink-2">It points to <strong>{plan.selected!.name}</strong>. It&apos;s a reminder to arrange the exam, not a booked appointment.</p>
              <label className="mt-5 flex flex-wrap items-center gap-3 font-bold">Remind me on
                <input type="date" value={date} min={todayUTC()} max={addDays(todayUTC(), 365)} onChange={(e) => setDate(e.target.value)}
                  className="min-h-11 rounded-[12px] border border-line px-3 font-bold" />
              </label>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => actions.propose(date)} disabled={busy}>Prepare reminder to review</Button>
              </div>
              <p className="mt-3 text-ink-2">Nothing is scheduled until you approve. You can cancel anytime.</p>
            </>
          )}
          {action && st === "proposed" && (
            <>
              <p className="mt-3 text-xl">Would you like CareRelay to create a follow-up reminder for the retinal exam?</p>
              <div className="mt-4 rounded-[4px] border border-line bg-mist/60 p-4">
                <p className="text-sm font-bold text-ink-3">Exactly what will be saved to your calendar file</p>
                <p className="mt-1 flex items-center gap-2 font-bold"><CalendarClock size={18} aria-hidden /> {fmtDate(action.reminder_date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · all day</p>
                <p className="mt-1 font-bold">{action.summary}</p>
                <p className="mt-1 text-ink-2">{action.description}</p>
              </div>
              <p className="mt-4 font-bold">Nothing is scheduled until you approve. You can cancel anytime.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="quiet" onClick={() => actions.cancel()} disabled={busy}>Cancel</Button>
                <Button variant="confirm" onClick={() => actions.approve()} disabled={busy}>Approve reminder</Button>
              </div>
            </>
          )}
          {action && (st === "approved" || st === "awaiting_confirmation" || st === "completed") && (
            <div className="mt-3 space-y-3">
              <p className="text-lg">{st === "approved" ? "Reminder approved. Creating it now…" : "Reminder created for " + fmtDate(action.reminder_date) + "."}</p>
              {action.approved_at && <p className="text-ink-2">You approved it at {fmtTime(action.approved_at)}. No message was sent and no appointment was booked.</p>}
              {icsUrl && st !== "completed" && (
                <a href={icsUrl} download="carerelay-reminder.ics" className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-line px-4 font-bold text-chart hover:border-chart">
                  <Download size={18} aria-hidden /> Download reminder (.ics)
                </a>
              )}
              {st === "awaiting_confirmation" && (
                <p className="rounded-[12px] border border-amber/60 bg-amber-tint p-3 text-amber-text"><strong>A reminder is not care.</strong> The follow-up stays open until you tell us the exam is done.</p>
              )}
              {st === "awaiting_confirmation" && <Button variant="ghost" onClick={() => actions.cancel()} disabled={busy}>Cancel this reminder</Button>}
            </div>
          )}
          {stage === "completed" && !action && null}
        </div>
      </ThreadRow>
    </section>
  );
}

/** Scene 10: only an explicit "Yes" closes the loop. */
export function Completion() {
  const action = useStore((s) => s.action);
  const busy = useStore((s) => s.busy);
  const notYet = useStore((s) => s.notYet);
  const records = useStore((s) => s.timeline);
  const st = action?.status;
  const latestInstruction = records?.events.filter((e) => e.kind === "instruction").map((e) => e.date).sort().at(-1) ?? "2026-10-13";
  const [date, setDate] = useState(todayUTC);
  const [by, setBy] = useState<"patient" | "caregiver">("patient");
  const completed = st === "completed";

  return (
    <section id="complete" aria-labelledby="complete-h" className="pt-2">
      <ThreadRow node={completed ? "completed" : "step"} nodeAt={40} line={completed ? "joined" : "pending"} lineTo="node" className="pb-16">
        <div className={clsx("max-w-[880px] p-6 md:p-10", completed ? "done-surface" : "rounded-[20px] bg-paper shadow-paper")}>
          <h2 id="complete-h" tabIndex={-1} className="t-surface">{completed ? "Completed" : "Did you complete the retinal exam?"}</h2>
          {!action || st === "proposed" || st === "approved" ? (
            <p className="mt-2 text-lg text-ink-2">We&apos;ll ask this once a reminder is in place. Approving a reminder never marks the exam as done.</p>
          ) : null}
          {st === "awaiting_confirmation" && (
            <div aria-live="polite">
              <div className="mt-4 flex flex-wrap gap-5">
                <label className="flex flex-wrap items-center gap-2 font-bold">Completed on
                  <input type="date" value={date} min={latestInstruction} max={todayUTC()} onChange={(e) => setDate(e.target.value)} className="min-h-11 rounded-[12px] border border-line px-3 font-bold" />
                </label>
                <fieldset className="flex flex-wrap items-center gap-3">
                  <legend className="sr-only">Who is answering</legend>
                  {(["patient", "caregiver"] as const).map((v) => (
                    <label key={v} className="flex min-h-11 items-center gap-2 font-bold">
                      <input type="radio" name="by" className="size-5 accent-[#1f5fa0]" checked={by === v} onChange={() => setBy(v)} /> {v === "patient" ? "I'm Amina" : "I'm her caregiver"}
                    </label>
                  ))}
                </fieldset>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="confirm" disabled={busy} onClick={() => actions.complete(date, by)}>Yes, I completed it</Button>
                <Button variant="quiet" disabled={busy} onClick={() => actions.notYet()}>Not yet</Button>
              </div>
              {notYet && (
                <div className="mt-4 rounded-[12px] border border-line bg-mist p-4">
                  <p className="font-bold">That&apos;s okay. Your reminder stays in place.</p>
                  <p className="text-ink-2">Nothing has been marked as done. If something is getting in the way, like travel or language, you can check other options.</p>
                  <a href="#navigate" className="mt-2 inline-flex min-h-11 items-center font-bold text-chart underline underline-offset-4">Check other options</a>
                </div>
              )}
              <p className="mt-4 text-sm text-ink-3">Your answer is saved as patient-reported. It isn&apos;t a clinical record and doesn&apos;t change your source notes.</p>
            </div>
          )}
          {completed && action?.completion && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.5 }} className="mt-3 space-y-3" aria-live="polite">
              <p className="flex flex-wrap items-center gap-2 text-xl font-bold text-confirmed-text"><CircleCheck aria-hidden /> Retinal exam follow-up completed
                <StatusTag status="patient-reported" label="Patient-reported · not clinically verified" /></p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1">
                <dt className="text-ink-2">Completed on</dt><dd className="font-bold">{fmtDate(action.completion.completed_on)}</dd>
                <dt className="text-ink-2">Reported by</dt><dd className="font-bold">{action.completion.reported_by === "patient" ? "Amina (patient)" : "Caregiver"}</dd>
                <dt className="text-ink-2">Recorded</dt><dd className="font-bold">{fmtTime(action.completion.confirmed_at)}</dd>
                <dt className="text-ink-2">Basis</dt><dd>Explicit report, not verified against a clinical record</dd>
              </dl>
              <p className="text-ink-2">Your care team can confirm it when the exam result reaches your records.</p>
            </motion.div>
          )}
        </div>
      </ThreadRow>
    </section>
  );
}
