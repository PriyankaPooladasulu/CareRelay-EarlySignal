"use client";
// The few primitives CareRelay needs, built in-house so the look stays ours.
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { CircleCheck, CircleDashed, Hourglass, Info, X, FileText, GraduationCap, Check, Loader, Pause, Circle, Download } from "lucide-react";
import { actions, useStore } from "@/lib/store";

type BtnVariant = "primary" | "quiet" | "ghost" | "chamber" | "confirm";
export function Button({ variant = "primary", className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-5 py-2.5 text-base font-bold transition-[background,box-shadow,color] duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-chart text-white hover:bg-[#184f87] shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_10px_24px_-10px_rgba(31,95,160,.7)]",
        variant === "confirm" && "bg-chart text-white hover:bg-[#184f87] shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_10px_24px_-10px_rgba(31,95,160,.7)]",
        variant === "quiet" && "bg-paper text-ink shadow-paper hover:bg-white",
        variant === "ghost" && "px-1.5 text-chart underline decoration-2 underline-offset-[5px] hover:text-[#184f87]",
        variant === "chamber" && "border border-white/15 bg-white/5 text-chamber hover:bg-white/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

export type Status = "unconfirmed" | "awaiting" | "completed" | "approved" | "proposed" | "incomplete" | "fact" | "education" | "patient-reported";
const STATUS: Record<Status, { label: string; icon: typeof Info; cls: string }> = {
  unconfirmed: { label: "Unconfirmed", icon: CircleDashed, cls: "bg-amber-wash text-amber-ink border-amber/55" },
  incomplete: { label: "Information incomplete", icon: CircleDashed, cls: "bg-amber-wash text-amber-ink border-amber/55" },
  awaiting: { label: "Awaiting confirmation", icon: Hourglass, cls: "bg-amber-wash text-amber-ink border-amber/55" },
  proposed: { label: "Proposed", icon: Circle, cls: "bg-paper text-chart border-chart/30" },
  approved: { label: "Approved by you", icon: Check, cls: "bg-chart/[.08] text-chart border-chart/[.22]" },
  completed: { label: "Completed", icon: CircleCheck, cls: "bg-confirmed-text text-white border-confirmed-text" },
  "patient-reported": { label: "Patient-reported", icon: Info, cls: "bg-transparent text-chart border-chart/[.35]" },
  fact: { label: "From your records", icon: FileText, cls: "bg-chart/[.08] text-chart border-chart/[.22]" },
  education: { label: "General education", icon: GraduationCap, cls: "bg-lens/[.14] text-lens-soft border-lens/40" },
};

/** Status is never colour alone: colour + icon + word. */
export function StatusTag({ status, label, className }: { status: Status; label?: string; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.778rem] font-semibold whitespace-nowrap", s.cls, className)}>
      <Icon aria-hidden size={15} strokeWidth={2.4} />
      {label ?? s.label}
    </span>
  );
}

export function PaperSheet({ children, className, stacked, as: As = "article" }: { children: ReactNode; className?: string; stacked?: boolean; as?: "article" | "div" | "section" }) {
  return <As className={clsx("paper", stacked && "paper-stack", className)}>{children}</As>;
}

export type StepState = "queued" | "running" | "passed" | "failed" | "waiting" | "info";
const STEP: Record<StepState, { icon: typeof Info; label: string; cls: string }> = {
  queued: { icon: CircleDashed, label: "Queued", cls: "text-ink-3" },
  running: { icon: Loader, label: "Running", cls: "text-chart" },
  passed: { icon: CircleCheck, label: "Passed", cls: "text-chart" },
  failed: { icon: X, label: "Failed", cls: "text-amber-text" },
  waiting: { icon: Pause, label: "Waiting for you", cls: "text-amber-text" },
  info: { icon: Circle, label: "Step", cls: "text-ink-3" },
};
export function StepRow({ state, title, detail, code }: { state: StepState; title: string; detail?: string; code?: string }) {
  const s = STEP[state];
  const Icon = s.icon;
  return (
    <li className="flex gap-3 border-b border-line/70 py-2.5 last:border-0">
      <Icon aria-hidden size={20} strokeWidth={2.3} className={clsx("mt-0.5 flex-none", s.cls, state === "running" && "animate-spin [animation-duration:1.6s]")} />
      <div className="min-w-0">
        <p className="font-bold leading-snug">
          {title} <span className={clsx("ml-1 text-sm font-bold", s.cls)}>· {s.label}</span>
        </p>
        {detail && <p className="text-ink-2">{detail}</p>}
        {code && <p className="text-xs text-ink-3">Backend reason code: {code}</p>}
      </div>
    </li>
  );
}

/** Side drawer on desktop, bottom sheet on mobile. Traps focus and restores it on close. */
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab" && el) {
        const f = el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); prev?.focus(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-[#13222c]/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref} role="dialog" aria-modal="true" aria-label={title}
            className="absolute bottom-0 left-0 right-0 flex max-h-[88dvh] flex-col rounded-t-[20px] bg-paper shadow-2xl md:bottom-0 md:left-auto md:top-0 md:max-h-none md:w-[min(640px,92vw)] md:rounded-none md:rounded-l-[6px]"
            initial={reduce ? { opacity: 0 } : { x: "100%" }} animate={reduce ? { opacity: 1 } : { x: 0 }} exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
              <h2 className="text-xl">{title}</h2>
              <button data-autofocus onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-mist" aria-label="Close">
                <X aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="border-t border-line bg-mist/60 px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Visible confirmation after every action. */
export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
            className="pointer-events-auto rounded-[12px] border border-line bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{t.text}</p>
                {t.detail && <p className="text-sm text-ink-2">{t.detail}</p>}
                {t.href && (
                  <a href={t.href} download={t.download} className="mt-2 inline-flex min-h-11 items-center gap-2 font-bold text-chart underline underline-offset-4">
                    <Download aria-hidden size={18} /> Download reminder (.ics)
                  </a>
                )}
              </div>
              <button onClick={() => actions.dismissToast(t.id)} aria-label="Dismiss" className="grid size-8 place-items-center rounded-full hover:bg-mist"><X size={16} aria-hidden /></button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  const d = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return d.toLocaleDateString("en-CA", opts);
}
export function fmtTime(iso: string | number) {
  return new Date(iso).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export function SectionHeading({ id, kicker, title, children }: { id?: string; kicker?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 max-w-[70ch]">
      {kicker && <p className="mb-1 text-base font-bold text-ink-3">{kicker}</p>}
      <h2 id={id} className="text-2xl md:text-3xl">{title}</h2>
      {children && <div className="mt-2 text-lg text-ink-2">{children}</div>}
    </header>
  );
}
