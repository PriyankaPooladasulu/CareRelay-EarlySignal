"use client";
import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, FileText, Quote, SearchX } from "lucide-react";
import clsx from "clsx";
import { actions, openSignal, stageOf, useStore } from "@/lib/store";
import { splitEvidenceText, type TimelineEvent } from "@/lib/carerelay-client";
import { Button, Drawer, PaperSheet, StatusTag, fmtDate } from "./ui";
import { ThreadGap, ThreadRow } from "./thread";

const KIND: Record<TimelineEvent["kind"], { label: string; plain: string }> = {
  instruction: { label: "Instruction", plain: "Recommended" },
  observation: { label: "Observation", plain: "Noted in record" },
  completion: { label: "Completion", plain: "Done" },
  not_completed: { label: "Not completed", plain: "Not done yet" },
  missing_information: { label: "Missing information", plain: "Information missing" },
};
const PLAIN: Record<string, string> = {
  "instruction:retinal_exam": "An eye exam of the retina was recommended or discussed.",
  "observation:type_2_diabetes": "The record says you have type 2 diabetes.",
  "not_completed:retinal_exam": "The record says the eye exam isn't done or isn't documented yet.",
  "completion:retinal_exam": "The record says the eye exam was done.",
};
export const eventText = (e: TimelineEvent, plain: boolean) => (plain && PLAIN[`${e.kind}:${e.concept}`]) || e.text;

export function modeLabel(mode?: string) {
  if (mode === "live_llm_validated") return "Live mode: LLM extraction, every claim checked against the source";
  return "Demo mode: deterministic rules, no AI model is called";
}

/** Scene 2: "Hello, Amina." with facts we can prove, read from the API. */
export function Summary() {
  const s = useStore((x) => x);
  const sig = openSignal(s);
  const stage = stageOf(s);
  const open = s.signals?.signals.filter((g) => g.status !== "resolved").length ?? 0;
  const approvedIds = new Set(s.audit.filter((e) => e.event_type === "action_approved").map((e) => e.entity_id));
  const unapproved = s.audit.filter((e) => e.event_type === "calendar_generated" && !approvedIds.has(e.entity_id)).length;
  const facts = [
    { n: s.records.length, label: "records analyzed" },
    { n: s.timeline?.events.length ?? 0, label: "events extracted, each with an exact source quote" },
    { n: stage === "completed" ? 0 : open, label: stage === "completed" ? "follow-ups unconfirmed (you reported completion)" : "follow-up unconfirmed" },
    { n: unapproved, label: "actions taken without your approval" },
  ];
  return (
    <ThreadRow line="none" className="grid items-center gap-[clamp(24px,4vw,72px)] pb-12 pt-10 md:pt-14 min-[900px]:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]" id="summary">
      <div>
      <h1 className="t-hero">Hello, Amina.</h1>
      <p className="t-lede mt-6 max-w-[34ch] text-ink-2">
        We read {s.records.length} of your records. {stage === "completed"
          ? "You told us the retinal exam is done. Thank you for closing the loop."
          : "One follow-up couldn't be confirmed."}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {sig && stage !== "completed" && <Button variant="confirm" onClick={() => {
          const first = sig.evidence[0]?.event_id; if (first) actions.openEvidence(first);
        }}>See why it was flagged</Button>}
        <span className="text-sm text-ink-3">{modeLabel(s.timeline?.mode)}</span>
      </div>
      <dl className="mt-14 grid max-w-[880px] grid-cols-2 gap-x-7 gap-y-8 border-t border-hair pt-7 md:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col-reverse justify-end">
            <dt className="mt-2.5 max-w-[18ch] text-[0.889rem] leading-snug text-ink-2">{f.label}</dt>
            <dd className={clsx("t-stat", f.label.startsWith("follow-up") && f.n > 0 ? "text-amber-ink" : "text-ink")}>{f.n}</dd>
          </div>
        ))}
      </dl>
      </div>
      {/* Decorative hero stage: her three records fanned on the thread, ending in the frayed gap. Real dates and quotes, read only. */}
      <div className="stage hidden min-[900px]:block" aria-hidden="true">
        <div className="light" />
        <div className="gaplight" />
        <svg className="stage-thread" viewBox="0 0 640 652" preserveAspectRatio="none">
          <path className="t-base" d="M14 0 C 14 40, 14 60, 14 84 C 14 150, 196 160, 194 236 C 192 300, 80 330, 78 410 C 76 480, 200 520, 300 560" />
          <path className="t-pulse" d="M14 0 C 14 40, 14 60, 14 84 C 14 150, 196 160, 194 236 C 192 300, 80 330, 78 410 C 76 480, 200 520, 300 560" />
          <g className="t-beads"><circle cx="14" cy="84" r="9" /><circle cx="194" cy="236" r="9" /><circle cx="78" cy="410" r="9" /></g>
          {stage !== "completed" && (
            <>
              <path className="strand" d="M300 560 C 325 575, 342 582, 370 590" />
              <path className="strand b" d="M300 560 C 330 562, 354 558, 384 566" />
              <path className="strand c" d="M300 560 C 318 584, 326 604, 340 628" />
              <path className="strand b" d="M300 560 C 332 584, 350 600, 372 620" style={{ opacity: 0.5 }} />
              <circle className="spark" cx="394" cy="580" r="3" />
              <circle className="spark s2" cx="356" cy="640" r="2.4" />
              <circle className="spark s3" cx="400" cy="616" r="2" />
            </>
          )}
          {stage === "completed" && <circle cx="300" cy="560" r="11" fill="var(--confirmed)" style={{ filter: "drop-shadow(0 0 12px rgba(44,138,102,.7))" }} />}
        </svg>
        {[...s.records].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3).map((r, i) => {
          const quote = s.timeline?.events.filter((e) => e.evidence.source_id === r.id && e.concept === "retinal_exam").at(-1)?.evidence.quote;
          return (
            <div key={r.id} className={clsx("mini", ["m1", "m2", "m3"][i])}>
              <div className="d">{fmtDate(r.date)}</div>
              <div className="t">{r.title}</div>
              {quote && <div className="q">&ldquo;{quote}&rdquo;</div>}
              <div className="rule" /><div className="rule s" />
            </div>
          );
        })}
      </div>
    </ThreadRow>
  );
}

/** Scene 3: records as stacked paper sheets on the thread, then the gap. */
export function Timeline() {
  const timeline = useStore((s) => s.timeline);
  const records = useStore((s) => s.records);
  const plain = useStore((s) => s.plain);
  const signals = useStore((s) => s.signals);
  const stage = useStore(stageOf);
  const sig = useStore(openSignal);
  const byRecord = useMemo(() => {
    const groups = records.map((r) => ({ record: r, events: (timeline?.events ?? []).filter((e) => e.evidence.source_id === r.id) }));
    return groups.sort((a, b) => a.record.date.localeCompare(b.record.date));
  }, [records, timeline]);

  return (
    <section aria-labelledby="timeline-h" id="timeline" className="pt-12">
      <ThreadRow line="none">
        <h2 id="timeline-h" className="t-section">Your records, in order</h2>
        <p className="mt-3.5 max-w-[56ch] text-[1.111rem] text-ink-2">Each sheet is one supplied record. The quoted lines are the record&apos;s own words. Select a line to see it inside the original.</p>
      </ThreadRow>
      <ol className="thread-travel mt-10">
        {byRecord.map(({ record, events }, i) => (
          <ThreadRow as="li" key={record.id} node="fact" nodeAt={40} lineFrom={i === 0 ? "node" : undefined} className={clsx("pb-7 [&>article]:origin-left", i % 2 ? "[&>article]:rotate-[0.3deg]" : "[&>article]:-rotate-[0.4deg]")}>
            <PaperSheet stacked className="max-w-[760px] px-5 py-6 md:px-8 md:py-7">
              <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <h3>
                  <time dateTime={record.date} className="block text-[0.833rem] font-bold text-chart tabular-nums">{fmtDate(record.date)}</time>
                  <span className="mt-0.5 block text-[1.333rem] font-semibold tracking-[-0.01em]">{record.title}</span>
                </h3>
                <StatusTag status="fact" label="Synthetic record" />
              </header>
              <ul className="mt-2 space-y-1">
                {events.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => actions.openEvidence(e.id)}
                      className="claim mt-4 block w-full rounded-r-[4px] py-1 pl-[18px] pr-2 text-left transition-colors">
                      <span className="block text-[0.833rem] font-bold text-chart">{plain ? KIND[e.kind].plain : KIND[e.kind].label}</span>
                      <span className="record-voice mt-1 block text-[1.333rem] leading-[1.5] text-ink md:text-[1.333rem]">&ldquo;<mark>{e.evidence.quote}</mark>&rdquo;</span>
                      {plain && <span className="mt-1 block text-[0.944rem] text-ink-soft">{eventText(e, true)}</span>}
                    </button>
                  </li>
                ))}
                {events.length === 0 && <li className="text-ink-2">No supported events were found in this record.</li>}
              </ul>
            </PaperSheet>
          </ThreadRow>
        ))}
      </ol>
      <ThreadGap>
        <div className={clsx("max-w-[880px] px-6 py-8 md:px-10 md:pb-9 md:pt-10", stage === "completed" ? "done-surface" : "signal-surface")}>
          {stage === "completed" ? <StatusTag status="completed" label="Completed (patient-reported)" /> : <StatusTag status="unconfirmed" />}
          <h3 className="t-surface mt-4">Retinal exam follow-up</h3>
          {sig && (() => {
            const text = sig.summary.replace("No validated later completion was found after the latest instruction in the supplied records.", "We couldn't find a record showing the eye exam happened.").replace("Missing documentation does not prove care did not occur.", "Missing documentation does not prove care did not occur. It means the records you shared don't show it.");
            const [first, ...rest] = text.startsWith("We couldn't find a record showing the eye exam happened.") ? ["We couldn't find a record showing the eye exam happened.", text.slice(56).trim()] : [text];
            return (
              <>
                <p className="mt-3.5 max-w-[46ch] text-[1.111rem]">{first}</p>
                {rest.length > 0 && rest[0] && <p className="mt-3 max-w-[46ch] text-[0.944rem] text-ink-soft">{rest[0]}</p>}
              </>
            );
          })()}
          {stage === "completed" && <p className="mt-3 max-w-[46ch] text-ink-2">The records themselves are unchanged: the supplied notes still don&apos;t contain a completion. Your report is kept separately as patient-reported.</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3.5">
            {sig && <Button variant="quiet" className="!px-6 !py-4" onClick={() => actions.openEvidence(sig.evidence[0].event_id)}>See why it was flagged</Button>}
            <a href="#understand" className="inline-flex min-h-11 items-center px-1.5 font-bold text-chart underline decoration-2 underline-offset-[5px]">Why does this follow-up matter?</a>
          </div>
          <details className="mt-5 text-[0.833rem] text-ink-soft">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">How this was checked</summary>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1">
              <dt className="text-ink-3">Rule</dt><dd className="text-ink">{sig?.rule.replace(/_/g, " ")}</dd>
              <dt className="text-ink-3">Method</dt><dd className="text-ink">{signals?.mode.replace(/_/g, " ")} v{signals?.rule_version}</dd>
              <dt className="text-ink-3">Searched</dt><dd className="text-ink">{signals?.searched_source_ids.length} sources</dd>
            </dl>
          </details>
        </div>
        <RejectedList />
      </ThreadGap>
    </section>
  );
}

/** Responsible-AI win: claims the validator refused are shown, not hidden. */
function RejectedList() {
  const rejected = useStore((s) => s.timeline?.rejected ?? []);
  const warnings = useStore((s) => s.timeline?.warnings ?? []);
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 max-w-[720px] pb-10 text-ink-2">
      {rejected.length > 0 && (
        <div className="rounded-[20px] bg-paper p-4 shadow-paper">
          <button aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left font-bold text-ink">
            <span className="flex items-center gap-2"><SearchX aria-hidden size={20} /> {rejected.length} {rejected.length === 1 ? "claim wasn't" : "claims weren't"} supported by the records, so we didn&apos;t use {rejected.length === 1 ? "it" : "them"}</span>
            <ChevronDown aria-hidden className={clsx("transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <ul className="mt-2 space-y-2">
              {rejected.map((r, i) => (
                <li key={i} className="border-t border-line pt-2">
                  <p className="record-voice">&ldquo;{r.candidate.quote}&rdquo;</p>
                  <p className="text-sm">{r.candidate.kind.replace(/_/g, " ")} · {r.candidate.source_id} · reason: {r.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {warnings.map((w) => <p key={w} className="mt-2 text-[0.833rem]">CareRelay only uses wording it can match exactly in your records. Anything else is left out.</p>)}
    </div>
  );
}

/** Scene 4: "Why was this flagged?" The quote, highlighted inside the full original record. */
export function EvidenceDrawer() {
  const open = useStore((s) => s.evidenceOpen);
  const ev = useStore((s) => s.evidence);
  const sig = useStore(openSignal);
  const timeline = useStore((s) => s.timeline);
  const plain = useStore((s) => s.plain);
  const event = timeline?.events.find((e) => e.id === ev?.event_id);
  const parts = ev ? splitEvidenceText(ev.original_record.text, ev.evidence) : null;
  const inSignal = sig?.evidence.some((e) => e.event_id === ev?.event_id);
  const openOriginal = () => {
    if (!ev) return;
    const url = URL.createObjectURL(new Blob([ev.original_record.text], { type: "text/plain;charset=utf-8" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  return (
    <Drawer open={open && !!ev} onClose={actions.closeEvidence} title="Why was this flagged?"
      footer={<p className="text-base font-bold">CareRelay could not find evidence of completion in the supplied records.</p>}>
      {ev && parts && (
        <div className="space-y-6">
          {inSignal && sig && (
            <section>
              <h3 className="text-sm font-bold text-ink-3">Finding</h3>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-bold">{sig.title} <StatusTag status="unconfirmed" /></p>
              <p className="text-ink-2">{sig.summary.replace("No validated later completion was found after the latest instruction in the supplied records.", "We couldn't find a record showing the eye exam happened.").replace("Missing documentation does not prove care did not occur.", "Missing documentation does not prove care did not occur. It means the records you shared don't show it.")}</p>
            </section>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1">
            <dt className="text-ink-3">Source</dt><dd className="font-bold">{ev.evidence.source_title}</dd>
            <dt className="text-ink-3">Date</dt><dd className="font-bold"><time dateTime={ev.original_record.date}>{fmtDate(ev.original_record.date)}</time></dd>
            {event && <><dt className="text-ink-3">What it says</dt><dd>{eventText(event, plain)}</dd></>}
          </dl>
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-3"><Quote size={16} aria-hidden /> Exact quote, shown inside the original record</h3>
            <PaperSheet className="original-sheet mx-1 my-2 px-7 py-7">
              <p className="record-voice whitespace-pre-wrap text-[1rem] !leading-[1.75] text-ink-soft">
                {parts.before}
                <mark className="[box-decoration-break:clone]">{parts.quote}</mark>
                {parts.after}
              </p>
              <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-hair pt-4 text-[0.833rem]">
                <dt className="text-ink-3">Record ID</dt><dd className="text-ink">{ev.evidence.source_id}</dd>
                <dt className="text-ink-3">Characters</dt><dd className="text-ink tabular-nums">{ev.evidence.start}–{ev.evidence.end}</dd>
                <dt className="text-ink-3">SHA-256</dt><dd className="text-ink tabular-nums">{ev.evidence.source_sha256.slice(0, 12)}…</dd>
              </dl>
            </PaperSheet>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="quiet" onClick={openOriginal}><FileText aria-hidden size={18} /> Open original record <ExternalLink aria-hidden size={16} /></Button>
            </div>
          </section>
          {inSignal && sig && sig.evidence.length > 1 && (
            <section>
              <h3 className="text-sm font-bold text-ink-3">All evidence behind this finding</h3>
              <ul className="mt-2 space-y-1">
                {sig.evidence.map((e) => (
                  <li key={e.event_id}>
                    <button onClick={() => actions.openEvidence(e.event_id)} aria-current={e.event_id === ev.event_id}
                      className={clsx("w-full rounded-[4px] px-3 py-2 text-left hover:bg-chart-tint", e.event_id === ev.event_id && "bg-chart-tint")}>
                      <span className="text-sm font-bold text-chart">{fmtDate(e.date)} · {e.evidence.source_title}</span>
                      <span className="record-voice block">&ldquo;{e.evidence.quote}&rdquo;</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <aside className="rounded-[20px] border border-amber/55 bg-amber-wash p-4 text-amber-ink">
            <p className="font-bold">Missing-source notice</p>
            <p>These are only the records supplied to CareRelay. An exam may have happened and been recorded somewhere we can&apos;t see. Missing documentation doesn&apos;t prove care didn&apos;t happen.</p>
          </aside>
        </div>
      )}
    </Drawer>
  );
}
