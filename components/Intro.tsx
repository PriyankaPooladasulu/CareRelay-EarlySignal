"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The page's one orchestrated load moment: the thread draws itself, then frays at the gap. */
function IntroThread() {
  const reduce = useReducedMotion();
  const t = (d: number) => (reduce ? { duration: 0 } : { delay: d, duration: 0.32, ease: EASE });
  const nodes = [
    { x: 40, label: "Oct 3", sub: "Exam recommended" },
    { x: 300, label: "Oct 13", sub: "Discussed again" },
    { x: 560, label: "Oct 24", sub: "Not yet arranged" },
  ];
  return (
    <svg viewBox="0 0 1000 150" className="w-full max-w-[1000px] overflow-visible" role="img"
      aria-label="A thread connects three record dates, October 3, 13 and 24, then frays into a gap marked unconfirmed.">
      <motion.path d="M40 60 L640 60" stroke="var(--chart-blue)" strokeWidth="4" strokeLinecap="round" fill="none"
        initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={reduce ? { duration: 0 } : { duration: 1.0, ease: "easeInOut" }} />
      {/* fray */}
      {[[-14, 0.8], [-5, 0.6], [6, 0.7], [15, 0.5]].map(([dy, op], i) => (
        <motion.path key={i} d={`M640 60 C 668 60, 684 ${60 + dy * 0.6}, 708 ${60 + dy}`} stroke="var(--chart-blue)" strokeWidth="1.6" fill="none" opacity={op}
          initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={reduce ? { duration: 0 } : { delay: 1.0, duration: 0.3 }} />
      ))}
      {nodes.map((n, i) => (
        <motion.g key={n.label} initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.6 }} animate={{ opacity: 1, scale: 1 }}
          transition={t(0.05 + i * 0.33)} style={{ transformOrigin: `${n.x}px 60px` }}>
          <circle cx={n.x} cy="60" r="11" fill="var(--chart-blue)" stroke="var(--mist)" strokeWidth="5" />
          <text x={n.x} y="104" textAnchor="middle" className="fill-ink text-[22px] font-bold">{n.label}</text>
          <text x={n.x} y="130" textAnchor="middle" className="fill-ink-2 text-[17px]">{n.sub}</text>
        </motion.g>
      ))}
      <motion.g initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={t(1.28)}>
        <circle className="gap-pulse" cx="800" cy="60" r="20" fill="var(--signal-amber-tint)" stroke="var(--signal-amber)" strokeWidth="4" strokeDasharray="7 6" />
        <text x="800" y="104" textAnchor="middle" className="fill-amber-text text-[22px] font-bold">Unconfirmed</text>
        <text x="800" y="130" textAnchor="middle" className="fill-ink-2 text-[17px]">Retinal exam follow-up</text>
      </motion.g>
    </svg>
  );
}

export default function Intro() {
  const reduce = useReducedMotion();
  return (
    <main className="grain flex min-h-dvh flex-col px-4 py-6 md:px-12">
      <header className="flex items-center justify-between">
        <p className="text-lg font-extrabold tracking-tight">CareRelay <span className="font-medium text-ink-2">EarlySignal</span></p>
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm font-bold text-ink-2">
          <ShieldCheck aria-hidden size={16} /> Synthetic demonstration
        </p>
      </header>
      <section className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col justify-center gap-10 py-10">
        <h1 className="t-hero max-w-[14ch]">From missed signals to completed care.</h1>
        <p className="max-w-[58ch] text-lg text-ink-2 md:text-xl">
          CareRelay reads a person&apos;s scattered records and asks one question: was something recommended, and can we confirm it happened?
          When it can&apos;t, it raises an EarlySignal and helps close the loop, with your approval at every step. It is not a doctor and it does not diagnose.
        </p>
        <IntroThread />
        <motion.div className="flex flex-wrap items-center gap-5" initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 1.6, duration: 0.3 }}>
          <Link href="/patients/amina/360" className="inline-flex min-h-12 items-center rounded-[12px] bg-ink px-6 text-lg font-bold text-white hover:bg-[#1f3442]">
            Start with Amina
          </Link>
          <p className="text-base text-ink-2">Synthetic demonstration, no real patient data. Amina and her records are fictional.</p>
        </motion.div>
      </section>
      <footer className="text-sm text-ink-3">Women in AI Canada 2026 · Theme 4: equitable healthcare</footer>
    </main>
  );
}
