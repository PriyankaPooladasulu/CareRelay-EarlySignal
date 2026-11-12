"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Keyboard, RotateCcw, ShieldCheck, Type, WifiOff } from "lucide-react";
import clsx from "clsx";
import { actions, useStore } from "@/lib/store";
import { LANGS, type Lang } from "@/lib/i18n";
import { EvidenceDrawer, Summary, Timeline } from "./record";
import { JourneyTrack, ThreadPulse, ThreadRow } from "./thread";
import { Toaster } from "./ui";
import { ActionCenter, Approval, Completion } from "./action";
import { AuditLog, ClinicianReview, HandoffSummary } from "./review";
import { DocumentVault } from "./vault";
import SharedHealthData from "./health";

// 3D, mic and audio stay client-only.
const Chamber = dynamic(() => import("./chamber/Chamber"), {
  ssr: false,
  loading: () => <div className="min-h-[80vh] bg-choroid" aria-busy="true" />,
});

const SECTIONS = ["summary", "timeline", "vault", "understand", "navigate", "approve", "complete", "health", "review"];

function TopBar() {
  const source = useStore((s) => s.source);
  const lang = useStore((s) => s.lang);
  const largeText = useStore((s) => s.largeText);
  const highContrast = useStore((s) => s.highContrast);
  const plain = useStore((s) => s.plain);
  const [aaOpen, setAaOpen] = useState(false);
  return (
    <header className="topbar sticky top-0 z-40 border-b border-line bg-mist/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1320px] items-center gap-x-2 px-4 pt-2 md:gap-x-4 md:px-8">
        <Link href="/" className="mr-auto text-lg font-extrabold leading-tight tracking-tight">CareRelay <span className="hidden font-medium text-ink-2 sm:inline">EarlySignal</span></Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-sm font-bold text-ink-2"><ShieldCheck size={15} aria-hidden /> <span className="hidden sm:inline">Synthetic demo</span><span className="sm:hidden">Demo</span></span>
        {source === "offline" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/60 bg-amber-tint px-2.5 py-0.5 text-sm font-bold text-amber-text" title="The CareRelay backend isn't reachable. Showing a saved deterministic run.">
            <WifiOff size={15} aria-hidden /> <span className="hidden sm:inline">Offline demo data</span><span className="sm:hidden">Offline</span>
          </span>
        )}
        <label className="flex items-center gap-1 text-sm font-bold" title="Language for the education room and the watch">
          <span className="sr-only">Language for education and the watch</span>
          <select value={lang} onChange={(e) => actions.setPref({ lang: e.target.value as Lang })}
            className="min-h-11 rounded-[12px] border border-line bg-white px-2 font-bold">
            {LANGS.map((l) => <option key={l.code} value={l.code} aria-label={l.label}>{l.short}</option>)}
          </select>
        </label>
        <div className="relative">
          <button aria-expanded={aaOpen} aria-haspopup="true" onClick={() => setAaOpen(!aaOpen)} className="grid min-h-11 min-w-11 place-items-center rounded-[12px] border border-line bg-white font-extrabold" aria-label="Reading settings">
            <Type size={20} aria-hidden />
          </button>
          {aaOpen && (
            <div className="absolute right-0 top-12 w-72 rounded-[12px] border border-line bg-white p-3 shadow-xl">
              {[
                { k: "largeText", label: "Larger text (+20%)", v: largeText },
                { k: "highContrast", label: "High contrast", v: highContrast },
                { k: "plain", label: "Plain-language mode", v: plain },
              ].map((o) => (
                <label key={o.k} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[8px] px-2 hover:bg-mist">
                  <span className="font-bold">{o.label}</span>
                  <input type="checkbox" className="size-5 accent-[#1f5fa0]" checked={o.v} onChange={(e) => actions.setPref({ [o.k]: e.target.checked })} />
                </label>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => actions.reset()} className="inline-flex min-h-11 items-center gap-1.5 rounded-[12px] px-2 text-sm font-bold text-ink-2 hover:bg-white" title="Reset demo (R)">
          <RotateCcw size={16} aria-hidden /> <span className="sr-only md:not-sr-only">Reset demo</span>
        </button>
      </div>
      <div className="mx-auto max-w-[1320px] px-4 pb-1 md:px-8"><JourneyTrack /></div>
    </header>
  );
}

function Shortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Presenter shortcuts" className="fixed inset-0 z-[70] grid place-items-center bg-[#13222c]/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="flex items-center gap-2 text-xl"><Keyboard aria-hidden /> Presenter shortcuts</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {[["J", "Next section"], ["K", "Previous section"], ["R", "Reset demo"], ["?", "Show or hide this list"], ["Esc", "Close a drawer or dialog"]].map(([k, v]) => (
            <div key={k} className="contents"><dt><kbd className="rounded-[6px] border border-line bg-mist px-2 py-0.5 font-bold">{k}</kbd></dt><dd>{v}</dd></div>
          ))}
        </dl>
        <button autoFocus onClick={onClose} className="mt-5 min-h-11 w-full rounded-[12px] bg-ink font-bold text-white">Close</button>
      </div>
    </div>
  );
}

export default function CareRelayApp() {
  const status = useStore((s) => s.status);
  const largeText = useStore((s) => s.largeText);
  const highContrast = useStore((s) => s.highContrast);
  const [help, setHelp] = useState(false);

  useEffect(() => { actions.init(); }, []);
  useEffect(() => {
    document.documentElement.dataset.large = String(largeText);
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
  }, [largeText, highContrast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]') && e.key !== "?") return;
      if (e.key === "?") { setHelp((h) => !h); return; }
      if (e.key === "r" || e.key === "R") { actions.reset(); return; }
      if (e.key === "j" || e.key === "k" || e.key === "J" || e.key === "K") {
        const tops = SECTIONS.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? 0);
        const cur = tops.reduce((best, top, i) => (top <= 140 ? i : best), 0);
        const next = e.key.toLowerCase() === "j" ? Math.min(cur + 1, SECTIONS.length - 1) : Math.max(cur - 1, 0);
        const el = document.getElementById(SECTIONS[next]);
        el?.scrollIntoView({ block: "start" });
        el?.querySelector<HTMLElement>("h1,h2")?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-[8px] focus:bg-white focus:p-3 focus:font-bold">Skip to content</a>
      <TopBar />
      <main id="main" className="grain">
        {status === "loading" ? (
          <div className="mx-auto max-w-[1320px] px-4 py-24 md:px-8" aria-busy="true">
            <p className="text-xl font-bold">Reading Amina&apos;s records…</p>
            <p className="text-ink-2">Checking every claim against its source.</p>
          </div>
        ) : (
          <>
            <div className="relative mx-auto max-w-[1320px] px-4 md:px-8">
              <Summary />
              <Timeline />
              <DocumentVault />
            </div>
            <Chamber />
            <div className="relative mx-auto max-w-[1320px] px-4 md:px-8">
              <ThreadPulse fromId="health" toId="review" />
              <ActionCenter />
              <Approval />
              <Completion />
              <SharedHealthData />
              <section id="review" aria-labelledby="review-h" className="pb-24 pt-14">
                <ThreadRow line="none">
                  <h2 id="review-h" tabIndex={-1} className="t-section">For the care team</h2>
                  <p className="mt-3.5 max-w-[56ch] text-[1.111rem] text-ink-2">A handoff summary built only from source quotes and what Amina chose, a review panel for clinicians, and the full history of what happened.</p>
                </ThreadRow>
                <ThreadRow line="none"><HandoffSummary /></ThreadRow>
                <ThreadRow line="none"><ClinicianReview /></ThreadRow>
                <ThreadRow line="none"><AuditLog /></ThreadRow>
              </section>
            </div>
            <footer className={clsx("border-t border-line bg-white/60")}>
              <div className="mx-auto max-w-[1320px] px-4 py-8 text-sm text-ink-2 md:px-8">
                <p>Synthetic demonstration. Amina, her records and her device readings are fictional. CareRelay does not diagnose, predict outcomes or book appointments.</p>
                <p className="mt-1">Fonts: Atkinson Hyperlegible Next (Braille Institute), Newsreader, Noto Sans (SIL Open Font License). The 3D eye is an original procedural model built for this project. See ASSET_CREDITS.md. Press <kbd className="font-bold">?</kbd> for presenter shortcuts.</p>
              </div>
            </footer>
          </>
        )}
      </main>
      <EvidenceDrawer />
      <Toaster />
      <Shortcuts open={help} onClose={() => setHelp(false)} />
    </>
  );
}
