"use client";
// The Relay Thread: one luminous line down the page. Records are nodes on it; the missing
// follow-up frays into a gap; only a confirmed completion joins it.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { stageOf, useStore, type Stage } from "@/lib/store";

export type LineKind = "solid" | "pending" | "joined" | "chamber" | "none";
export type NodeKind = "fact" | "gap" | "step" | "step-done" | "completed" | "education" | "education-done";

export function ThreadNode({ kind, label }: { kind: NodeKind; label?: string }) {
  if (kind === "gap") {
    return <span className="bead gap !size-6" aria-hidden />;
  }
  if (kind === "completed") {
    return (
      <span className="relative grid size-[26px] place-items-center" aria-hidden>
        {/* two green strands woven around the check bead: the signal, closed */}
        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible" width="26" height="70" viewBox="0 0 26 70">
          <path d="M13 5 C 3 20, 23 50, 13 65 M13 5 C 23 20, 3 50, 13 65" fill="none" stroke="var(--confirmed)" strokeWidth="2" />
        </svg>
        <span className="bead ok relative grid size-[26px] place-items-center text-white"><Check size={15} strokeWidth={3} /></span>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      title={label}
      className={clsx(
        "bead",
        kind === "step" && "empty",
        kind === "education" && "edu empty",
        kind === "education-done" && "edu",
      )}
    />
  );
}

/** One row of the page: a slice of the thread on the left, content on the right. */
export function ThreadRow({
  children, line = "solid", node, nodeAt = 30, lineFrom, lineTo, className, id, as: As = "div",
}: {
  children: ReactNode; line?: LineKind; node?: NodeKind; nodeAt?: number; lineFrom?: "node"; lineTo?: "node";
  className?: string; id?: string; as?: "div" | "section" | "li";
}) {
  return (
    <As id={id} className="flex">
      <div className="thread-col" aria-hidden>
        {line !== "none" && (
          <div
            className={clsx("thread-line", line === "pending" && "is-pending", line === "joined" && "is-joined", line === "chamber" && "is-chamber")}
            style={{ top: lineFrom === "node" ? nodeAt : 0, bottom: lineTo === "node" ? `calc(100% - ${nodeAt}px)` : 0 }}
          />
        )}
        {node && <div className="thread-node" style={{ top: nodeAt }}><ThreadNode kind={node} /></div>}
      </div>
      <div className={clsx("min-w-0 flex-1", className)}>{children}</div>
    </As>
  );
}

/** The gap: the thread frays where completion can't be confirmed, and joins only on confirmation. */
export function ThreadGap({ children }: { children: ReactNode }) {
  const joined = useStore((s) => stageOf(s) === "completed");
  const reduce = useReducedMotion();
  return (
    <div className="flex">
      <div className="thread-col" aria-hidden>
        {/* the amber stretch reaching the gap */}
        {!joined && <div className="thread-line" style={{ top: 0, height: 120, background: "linear-gradient(var(--thread), var(--amber) 55%)", filter: "drop-shadow(0 0 6px rgba(233,162,59,.7))" }} />}
        {!joined && (
          <svg className="absolute overflow-visible" style={{ left: "calc(var(--thread-x) - 32px)", top: 120 }} width="64" height="150" viewBox="0 0 64 150">
            <path className="strand" d="M32 0 C 30 30, 18 50, 10 80" />
            <path className="strand b" d="M32 0 C 33 40, 36 66, 32 100" />
            <path className="strand c" d="M32 0 C 36 30, 50 52, 56 76" />
            <path className="strand" d="M32 0 C 28 36, 26 66, 22 112" style={{ opacity: 0.45 }} />
            <circle className="spark" cx="12" cy="94" r="2.6" /><circle className="spark s2" cx="54" cy="90" r="2.2" /><circle className="spark s3" cx="34" cy="120" r="2" />
          </svg>
        )}
        {/* the join: a single solid motion, only after confirmed completion */}
        <motion.div
          className="thread-line is-joined origin-top"
          style={{ top: 0, bottom: 0 }}
          initial={false}
          animate={{ scaleY: joined ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {!joined && <div className="thread-line is-pending" style={{ top: 260, bottom: 0 }} />}
        <div className="thread-node" style={{ top: 120 }}>
          <ThreadNode kind={joined ? "completed" : "gap"} />
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const TRACK: { key: Stage | "records"; label: string; href: string }[] = [
  { key: "open", label: "Unconfirmed", href: "#timeline" },
  { key: "planned", label: "Plan", href: "#navigate" },
  { key: "approved", label: "Approved", href: "#approve" },
  { key: "awaiting", label: "Reminder", href: "#approve" },
  { key: "completed", label: "Completed", href: "#complete" },
];
const ORDER: Stage[] = ["open", "planned", "proposed", "approved", "awaiting", "completed"];

/** The sticky horizontal journey track: the same thread, seen from above. */
export function JourneyTrack() {
  const stage = useStore(stageOf);
  const idx = ORDER.indexOf(stage);
  const reached = (k: Stage) => ORDER.indexOf(k) <= idx && (k !== "open" || true);
  return (
    <nav aria-label="Journey progress" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-0 text-[0.889rem]">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center" aria-hidden>
            <span className="bead sm" />
            {i < 2 && <span className="track-line on" />}
          </li>
        ))}
        {TRACK.map((t, i) => {
          const k = t.key as Stage;
          const done = k === "open" ? true : reached(k);
          const isCompleted = k === "completed" && stage === "completed";
          // Visual only: the furthest reached step is "current".
          const current = !isCompleted && TRACK.reduce((c, x, j) => (x.key === "open" || reached(x.key as Stage) ? j : c), 0) === i;
          return (
            <li key={t.label} className="flex items-center">
              <span aria-hidden className={clsx("track-line", isCompleted ? "ok" : current ? "fray" : done ? "on" : "")} />
              <a href={t.href} className="flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full px-1 font-semibold text-ink-3 hover:text-ink">
                <span aria-hidden className={clsx("bead sm", isCompleted ? "ok" : current ? "gap" : done ? "" : "empty")} />
                <span className={clsx(done && "text-ink-2", current && "!text-amber-ink", isCompleted && "text-confirmed-text")}>{t.label}</span>
                <span className="sr-only">{isCompleted ? "(done)" : done ? "(reached)" : "(not yet)"}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A faint pulse that travels down the thread from one anchor to another (watch → summary). */
export function ThreadPulse({ fromId, toId }: { fromId: string; toId: string }) {
  const pulse = useStore((s) => s.pulse);
  const reduce = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState<{ key: number; y1: number; y2: number } | null>(null);
  useEffect(() => {
    if (!pulse || reduce || !host.current) return;
    const base = host.current.getBoundingClientRect().top;
    const a = document.getElementById(fromId)?.getBoundingClientRect();
    const b = document.getElementById(toId)?.getBoundingClientRect();
    if (!a || !b) return;
    setRun({ key: pulse, y1: a.top - base + 40, y2: b.top - base + 40 });
  }, [pulse, reduce, fromId, toId]);
  return (
    <div ref={host} className="pointer-events-none absolute inset-0" aria-hidden>
      {run && (
        <motion.span
          key={run.key}
          className="absolute block size-3 rounded-full bg-white shadow-[0_0_10px_3px_#fff,0_0_18px_6px_rgba(127,182,242,.8)]"
          style={{ left: "calc(var(--thread-x) - 6px)" }}
          initial={{ top: run.y1, opacity: 0 }}
          animate={{ top: [run.y1, run.y2], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
