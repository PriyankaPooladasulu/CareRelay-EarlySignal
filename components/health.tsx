"use client";
// Shared health data + the CareRelay Watch. Show, don't interpret: readings and gaps only.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, CircleDashed, Droplet, Footprints, Gauge, HeartPulse, Moon, Watch as WatchIcon } from "lucide-react";
import { actions, stageOf, useStore } from "@/lib/store";
import { ui, type Lang } from "@/lib/i18n";
import { fmtValue, gapSignals, getSeries, MAX_GAP, METRICS, segments, type Metric, type Point, type Series } from "@/lib/vitals";
import { StatusTag, fmtTime } from "./ui";
import { ThreadRow } from "./thread";

const SCREENS = ["face", "heart_rate", "blood_pressure", "steps", "sleep", "glucose", "sharing"] as const;
type Screen = (typeof SCREENS)[number];
const DAY = 86400000;
const STEP_GOAL = 6000;
const SOURCE: Record<Metric, string> = {
  heart_rate: "Optical sensor · smartwatch", blood_pressure: "Home BP cuff · synced to watch", steps: "Accelerometer · smartwatch",
  sleep: "Motion + heart rate estimate · smartwatch", glucose: "Glucose meter · synced",
};

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** Heart rate ticks every few seconds from the synthetic stream (labelled "Simulated live data"). */
function useLiveHr(series: Series) {
  const base = series.points.at(-1)?.v ?? 72;
  const [hr, setHr] = useState(base);
  useEffect(() => {
    let i = 0;
    const seq = series.points.slice(-24).map((p) => p.v);
    const t = setInterval(() => { i = (i + 1) % seq.length; setHr(Math.round((seq[i] + base) / 2)); }, 3200);
    return () => clearInterval(t);
  }, [series, base]);
  return hr;
}

function MiniLine({ points, w = 170, h = 34, color = "#7FB6F2" }: { points: Point[]; w?: number; h?: number; color?: string }) {
  if (points.length < 2) return null;
  const t0 = points[0].t, t1 = points.at(-1)!.t, vs = points.map((p) => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const d = points.map((p, i) => `${i ? "L" : "M"}${(((p.t - t0) / (t1 - t0 || 1)) * w).toFixed(1)} ${(h - ((p.v - lo) / (hi - lo || 1)) * h).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden><path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} /></svg>;
}

function WatchScreen({ screen, lang, now, hr, notice, onAnswer, onJump }: {
  screen: Screen; lang: Lang; now: number; hr: number; notice: "reminder" | "question" | null;
  onAnswer: (yes: boolean) => void; onJump: (s: Screen) => void;
}) {
  const series = useMemo(() => getSeries(), []);
  const sharing = useStore((s) => s.sharing);
  const last = (m: Metric) => series[m].points.at(-1);
  const bp = last("blood_pressure");
  const bpDays = bp ? Math.floor((now - bp.t) / DAY) : 0;
  const today = series.steps.points.filter((p) => now - p.t < DAY).at(-1);
  const stepsToday = today?.v ?? Math.round(((new Date(now).getHours() * 60 + new Date(now).getMinutes()) / 1440) * 5600);
  const label = "text-[13px] font-bold text-[#a3b6bf]";

  if (notice) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-9 text-center">
        <p className={label}>CareRelay</p>
        {notice === "reminder" ? (
          <p className="text-[19px] font-bold leading-tight text-white">{ui("reminder", lang)}</p>
        ) : (
          <>
            <p className="text-[18px] font-bold leading-tight text-white">{ui("did_you_complete", lang)}</p>
            <div className="flex gap-2">
              <button onClick={() => onAnswer(true)} className="min-h-11 min-w-16 rounded-full bg-[#1f6e50] px-4 font-bold text-white">{ui("yes", lang)}</button>
              <button onClick={() => onAnswer(false)} className="min-h-11 min-w-16 rounded-full border border-white/30 px-3 font-bold text-white">{ui("not_yet", lang)}</button>
            </div>
          </>
        )}
      </div>
    );
  }
  switch (screen) {
    case "face": {
      const d = new Date(now);
      return (
        <div className="flex h-full flex-col items-center justify-center">
          <p className="text-[15px] font-bold text-[#a3b6bf]">{d.toLocaleDateString(lang === "en" ? "en-CA" : lang, { weekday: "short", month: "short", day: "numeric" })}</p>
          <p className="text-[64px] font-extrabold leading-none tracking-tight text-white">{d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: false })}</p>
          <div className="mt-3 flex gap-2">
            {([["heart_rate", `${hr}`, "bpm"], ["steps", stepsToday.toLocaleString("en-CA"), ui("steps", lang).toLowerCase()], ["blood_pressure", bp ? `${bpDays}d` : "–", "BP"]] as const).map(([s, v, u]) => (
              <button key={s} onClick={() => onJump(s)} aria-label={`${ui(s, lang)}: ${v} ${u}`} className="grid size-[58px] place-content-center rounded-full border border-white/15 bg-white/5 text-center leading-none">
                <span className="text-[15px] font-extrabold text-white">{v}</span><span className="mt-0.5 text-[10px] font-bold text-[#a3b6bf]">{u}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "heart_rate":
      return (
        <Metric title={ui("heart_rate", lang)} source={SOURCE.heart_rate} extra={ui("simulated_live", lang)}>
          <p className="flex items-baseline gap-2">
            <svg aria-hidden className="cr-heart self-center" style={{ animationDuration: `${(60 / Math.max(40, hr)).toFixed(2)}s` }} viewBox="0 0 16 16"><path d="M8 14s-5.5-3.4-5.5-7.2C2.5 4.6 4 3.2 5.7 3.2c1 0 1.8.5 2.3 1.3.5-.8 1.3-1.3 2.3-1.3 1.7 0 3.2 1.4 3.2 3.6C13.5 10.6 8 14 8 14z" fill="#7FB6F2" /></svg>
            <span className="text-[60px] font-light leading-none tracking-[-0.04em] text-white lg:text-[92px]">{hr}</span><span className="text-[17px] font-semibold text-[#9fb2bd] lg:text-[20px]">bpm</span>
          </p>
          <MiniLine points={series.heart_rate.points.filter((p) => now - p.t < DAY)} />
        </Metric>
      );
    case "blood_pressure":
      return (
        <Metric title={ui("blood_pressure", lang)} source={SOURCE.blood_pressure} extra={bp ? `${new Date(bp.t).toLocaleDateString("en-CA", { month: "short", day: "numeric" })} · ${fmtTime(bp.t)}` : ""}>
          <p className="flex items-baseline gap-1.5"><span className="text-[46px] font-light leading-none tracking-[-0.03em] text-white lg:text-[64px]">{bp ? `${bp.v}/${bp.v2}` : "–"}</span><span className="font-semibold text-[#9fb2bd]">mmHg</span></p>
          {bpDays >= 7 && <p className="mt-1 flex items-center gap-1 text-[14px] font-bold text-[#f0c27a]"><CircleDashed size={14} aria-hidden /> {ui("info_incomplete", lang)}: {lang === "en" ? `No new reading in ${bpDays} days` : ui("no_bp_14", lang)}</p>}
        </Metric>
      );
    case "steps": {
      const frac = Math.min(1, stepsToday / STEP_GOAL);
      return (
        <Metric title={ui("steps", lang)} source={SOURCE.steps} extra={`${ui("your_goal", lang)}: ${STEP_GOAL.toLocaleString("en-CA")}`}>
          <div className="relative grid place-items-center">
            <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden className="-rotate-90">
              <circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,.12)" strokeWidth="5" fill="none" />
              <circle cx="60" cy="60" r="52" stroke="#b9adf5" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={`${frac * 326.7} 326.7`} />
            </svg>
            <div className="absolute text-center"><p className="text-[30px] font-extrabold leading-none text-white">{stepsToday.toLocaleString("en-CA")}</p><p className="text-[12px] font-bold text-[#a3b6bf]">{(stepsToday * 0.00072).toFixed(1)} km</p></div>
          </div>
        </Metric>
      );
    }
    case "sleep": {
      const nights = series.sleep.points.slice(-7);
      const lastNight = series.sleep.points.at(-1);
      return (
        <Metric title={ui("sleep", lang)} source={SOURCE.sleep} extra={ui("last_night", lang)}>
          <p className="flex items-baseline gap-1"><span className="text-[50px] font-extrabold leading-none text-white">{lastNight ? `${Math.floor(lastNight.v)}h ${Math.round((lastNight.v % 1) * 60)}m` : "–"}</span></p>
          <div className="mt-2 flex h-10 items-end gap-1.5" aria-hidden>{nights.map((n) => <span key={n.t} className="w-3 rounded-t-[2px] bg-[#b9adf5]/80" style={{ height: `${(n.v / 9) * 40}px` }} />)}</div>
        </Metric>
      );
    }
    case "glucose": {
      const g = last("glucose");
      return (
        <Metric title={ui("glucose", lang)} source={SOURCE.glucose} extra={g ? `${new Date(g.t).toLocaleDateString("en-CA", { month: "short", day: "numeric" })} · ${fmtTime(g.t)}` : ""}>
          <p className="flex items-baseline gap-1.5"><span className="text-[56px] font-extrabold leading-none text-white">{g?.v.toFixed(1)}</span><span className="font-bold text-[#a3b6bf]">mmol/L</span></p>
        </Metric>
      );
    }
    case "sharing":
      return (
        <div className="flex h-full flex-col items-center justify-center px-10">
          <p className={label}>{ui("share_with_team", lang)}</p>
          <ul className="mt-2 w-full space-y-1">
            {METRICS.map((m) => (
              <li key={m}>
                <button role="switch" aria-checked={sharing[m]} onClick={() => actions.toggleShare(m, "watch")}
                  className="flex min-h-9 w-full items-center justify-between gap-2 rounded-full px-2 text-left text-[14px] font-bold text-white hover:bg-white/5">
                  <span>{ui(m, lang)}</span>
                  <span aria-hidden className={clsx("relative h-5 w-9 rounded-full transition-colors", sharing[m] ? "bg-[#6a55c9]" : "bg-white/20")}>
                    <span className={clsx("absolute top-0.5 size-4 rounded-full bg-white transition-[left]", sharing[m] ? "left-[18px]" : "left-0.5")} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

function Metric({ title, source, extra, children }: { title: string; source: string; extra?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-10 text-center">
      <p className="text-[14px] font-bold text-[#a3b6bf]">{title}</p>
      {children}
      {extra && <p className="text-[13px] font-bold text-[#d6dfe3]">{extra}</p>}
      <p className="text-[11px] text-[#a3b6bf]">{source}</p>
    </div>
  );
}

/** Original smartwatch hardware, drawn in CSS + SVG. No brand shapes, logos or ring layouts. */
export function CareRelayWatch() {
  const lang = useStore((s) => s.lang);
  const idx = useStore((s) => s.watchScreen);
  const buzz = useStore((s) => s.watchBuzz);
  const stage = useStore(stageOf);
  const notYet = useStore((s) => s.notYet);
  const series = useMemo(() => getSeries(), []);
  const hr = useLiveHr(series.heart_rate);
  const now = useNow(15000);
  const reduce = useReducedMotion();
  const [spec, setSpec] = useState({ x: 30, y: 22 });
  const [dismissed, setDismissed] = useState(0);
  const [detent, setDetent] = useState(0);
  const drag = useRef<number | null>(null);
  const screen = SCREENS[idx];
  const go = (i: number) => { actions.setWatchScreen((i + SCREENS.length) % SCREENS.length); setDismissed(buzz); setDetent((d) => d + 1); };

  // After approval: buzz + reminder for a few seconds; then the completion question on the face.
  const noticeNow: "reminder" | "question" | null =
    stage === "awaiting" && dismissed < buzz ? "reminder" : stage === "awaiting" && !notYet && screen === "face" ? "question" : null;
  useEffect(() => {
    if (noticeNow !== "reminder") return;
    const t = setTimeout(() => setDismissed(buzz), 5000);
    return () => clearTimeout(t);
  }, [noticeNow, buzz]);

  const onWheel = (e: WheelEvent) => { e.preventDefault(); go(idx + (e.deltaY > 0 ? 1 : -1)); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); go(idx + 1); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1); }
  };
  const onDown = (e: PointerEvent) => { drag.current = e.clientY; };
  const onMove = (e: PointerEvent) => {
    if (drag.current === null) return;
    const dy = e.clientY - drag.current;
    if (Math.abs(dy) > 28) { go(idx + (dy > 0 ? 1 : -1)); drag.current = e.clientY; }
  };
  const answer = (yes: boolean) => {
    if (yes) actions.complete(new Date().toISOString().slice(0, 10), "patient", "watch");
    else actions.notYet("watch");
  };

  return (
    <div className="watch flex flex-col items-center" onKeyDown={onKey}>
      <div
        className={clsx("watch-tilt relative select-none", buzz > 0 && !reduce && "buzz")} key={reduce ? "w" : "w" + buzz}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSpec({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
      >
        {/* strap */}
        <div aria-hidden className="strap absolute left-1/2 top-[-34%] h-[58%] w-1/2 -translate-x-1/2 rounded-[26px] [mask-image:linear-gradient(transparent,#000_40%)]" />
        <div aria-hidden className="strap absolute bottom-[-34%] left-1/2 h-[58%] w-1/2 -translate-x-1/2 rounded-[26px] [mask-image:linear-gradient(#000_60%,transparent)]" />
        {/* crown + side button */}
        <button aria-label="Back to watch face (crown). Scroll or drag on it to change screens."
          onClick={() => go(0)} onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}
          className="knurl absolute right-[-7%] top-[40%] z-10 h-[20%] w-[9%] min-w-[22px] touch-none rounded-[6px]">
          <motion.span aria-hidden key={detent} className="absolute inset-0 rounded-[6px] bg-white/30" initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} transition={{ duration: 0.18 }} />
        </button>
        <button aria-label="Sharing settings (side button)" onClick={() => go(SCREENS.indexOf("sharing"))}
          className="absolute right-[-4.5%] top-[64%] z-10 h-[12%] w-[5%] min-w-[12px] rounded-[4px] bg-[linear-gradient(90deg,#9aa3ab,#e4e8ec)]" />
        {/* case */}
        <div className="watch-bezel relative grid size-[260px] place-items-center rounded-full p-[7.5%] min-[400px]:size-[300px] sm:size-[340px] lg:size-[400px]"
          style={{ ["--spec-x" as string]: `${spec.x}%`, ["--spec-y" as string]: `${spec.y}%` }}>
          <div className="watch-brushed absolute inset-0 rounded-full" aria-hidden />
          <div className="watch-screen relative size-full overflow-hidden rounded-full"
            role="region" aria-roledescription="smartwatch screen" aria-label={`Watch screen: ${screen === "face" ? "watch face" : ui(screen, lang)}`} aria-live="polite" tabIndex={0} onWheel={onWheel}>
            <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(185,173,245,.08),transparent)]" aria-hidden />
            <motion.div key={(noticeNow ?? "") + screen + lang} className="absolute inset-0" initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <WatchScreen screen={screen} lang={lang} now={now} hr={hr} notice={noticeNow} onAnswer={answer} onJump={(s) => go(SCREENS.indexOf(s))} />
            </motion.div>
            <div aria-hidden className="watch-sheen pointer-events-none absolute inset-0 rounded-full" />
          </div>
        </div>
      </div>
      <div aria-hidden className="watch-floor mt-[30%]" />
      {/* pager + plain-text controls */}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => go(idx - 1)} className="grid size-11 place-items-center rounded-full bg-paper shadow-paper" aria-label="Previous screen"><ChevronLeft aria-hidden /></button>
        <p className="min-w-16 text-center font-bold sm:hidden" aria-live="polite">{idx + 1} of {SCREENS.length}</p>
        <ol className="hidden gap-0.5 sm:flex" aria-label="Watch screens">
          {SCREENS.map((s, i) => (
            <li key={s}><button onClick={() => go(i)} aria-label={s === "face" ? "Watch face" : ui(s, lang)} aria-current={i === idx}
              className="grid size-11 place-items-center"><span className={clsx("block h-2 rounded-full transition-[width]", i === idx ? "w-[22px] bg-ink" : "w-2 bg-hair")} /></button></li>
          ))}
        </ol>
        <button onClick={() => go(idx + 1)} className="grid size-11 place-items-center rounded-full border border-line bg-white" aria-label="Next screen"><ChevronRight aria-hidden /></button>
      </div>
      <p className="mt-1 text-sm text-ink-3">Turn the crown, use ↑/↓ on the screen, or the buttons above.</p>
    </div>
  );
}

/** Small-multiple sparkline with literal breaks where readings are missing. */
function Spark({ s, now, active }: { s: Series; now: number; active: boolean }) {
  const w = 300, h = 54, t0 = now - 30 * DAY;
  const pts = s.points.filter((p) => p.t >= t0);
  const vs = pts.map((p) => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const x = (t: number) => ((t - t0) / (now - t0)) * w;
  const y = (v: number) => h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8);
  const segs = segments(pts, MAX_GAP[s.metric]);
  const [hover, setHover] = useState<Point | null>(null);
  const last = pts.at(-1);
  const alt = `${s.label}, 30 days, ${pts.length} readings${last ? `, latest ${fmtValue(s.metric, last)} ${s.unit} at ${fmtTime(last.t)} on ${new Date(last.t).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}` : ""}, ${s.device}.`;
  return (
    <figure className={clsx("rounded-[4px] border bg-paper p-3", active ? "border-chart" : "border-line")}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold">{s.label}</span>
        <span className="text-lg font-extrabold">{last ? fmtValue(s.metric, last) : "–"} <span className="text-sm font-bold text-ink-2">{s.unit}</span></span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-[54px] w-full" role="img" aria-label={alt}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const t = t0 + ((e.clientX - r.left) / r.width) * (now - t0);
          setHover(pts.reduce((b, p) => (Math.abs(p.t - t) < Math.abs(b.t - t) ? p : b), pts[0]));
        }}>
        {segs.map((sg, i) => (
          sg.length === 1
            ? <circle key={i} cx={x(sg[0].t)} cy={y(sg[0].v)} r="2" fill="var(--chart-blue)" />
            : <path key={i} d={sg.map((p, j) => `${j ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ")} fill="none" stroke="var(--chart-blue)" strokeWidth="1.6" />
        ))}
        {hover && <circle cx={x(hover.t)} cy={y(hover.v)} r="4" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />}
      </svg>
      <p className="text-sm text-ink-2" aria-live="polite">
        {hover ? `${fmtValue(s.metric, hover)} ${s.unit} · ${new Date(hover.t).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${s.device}` : `${pts.length} readings · ${s.device}`}
      </p>
    </figure>
  );
}

export default function SharedHealthData() {
  const sharing = useStore((s) => s.sharing);
  const idx = useStore((s) => s.watchScreen);
  const now = useNow(60000);
  const series = useMemo(() => getSeries(), []);
  const gaps = gapSignals(series, now).filter((g) => sharing[g.metric]);
  const screen = SCREENS[idx];
  const shared = METRICS.filter((m) => sharing[m]);
  return (
    <section id="health" aria-labelledby="health-h" className="pt-4">
      <ThreadRow line="pending" node="step" nodeAt={22} className="pb-16">
        <h2 id="health-h" tabIndex={-1} className="t-section flex items-center gap-3"><WatchIcon aria-hidden className="size-9 flex-none text-ink-faint" strokeWidth={1.5} /> Shared health data</h2>
        <p className="mt-3.5 max-w-[56ch] text-[1.111rem] text-ink-2">Readings from Amina&apos;s watch and home devices usually live in separate apps. She chooses what her care team can see. Everything is off until she turns it on.</p>
        <p className="mt-2 max-w-[64ch] font-bold">CareRelay shows shared readings as reported by your devices. It does not interpret them.</p>
        <div className="mt-10 grid items-start gap-[clamp(24px,5vw,96px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex justify-center pt-28 pb-4"><CareRelayWatch /></div>
          <div className="space-y-6">
            <fieldset>
              <legend className="mb-3 text-[1.333rem] font-semibold">Choose what to share</legend>
              <ul className="grid gap-3.5">
                {METRICS.map((m) => {
                  const Icon = { heart_rate: HeartPulse, blood_pressure: Gauge, glucose: Droplet, steps: Footprints, sleep: Moon }[m];
                  return (
                  <li key={m} className={clsx("share-tile", sharing[m] && "on")}>
                    <span aria-hidden className="grid size-11 place-items-center rounded-[12px] bg-mist-deep text-chart"><Icon size={22} strokeWidth={2} /></span>
                    <label htmlFor={"share-" + m} className="cursor-pointer text-[1rem] font-bold">{series[m].label} <span className="block text-[0.833rem] font-normal text-ink-soft">{series[m].device}</span></label>
                    <button id={"share-" + m} role="switch" aria-checked={sharing[m]} onClick={() => actions.toggleShare(m, "app")}
                      className={clsx("relative h-8 w-14 flex-none rounded-full transition-colors", sharing[m] ? "bg-chart" : "bg-[#c4cfd8]")}>
                      <span className="sr-only">{sharing[m] ? "Shared" : "Not shared"}</span>
                      <span aria-hidden className={clsx("absolute top-1 size-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,.2)] transition-[left] duration-200", sharing[m] ? "left-7" : "left-1")} />
                    </button>
                  </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-sm text-ink-2">Shared items appear in the clinician handoff summary. Unshared items never do. Every change is logged.</p>
            </fieldset>
            {gaps.length > 0 && (
              <ul className="space-y-2">
                {gaps.map((g) => (
                  <li key={g.metric} className="signal-surface flex flex-wrap items-center gap-2 px-5 py-4 text-amber-ink">
                    <StatusTag status="incomplete" /> <span className="font-bold">{g.text}</span> <span className="text-sm">Source: {series[g.metric].device}</span>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <h3 className="text-lg">What your care team sees, last 30 days</h3>
              <p className="text-ink-2">Shared by patient · device · simulated data</p>
              {shared.length === 0 ? (
                <p className="mt-3 rounded-[4px] border border-dashed border-line bg-white/60 p-4 text-ink-2">Nothing is shared yet. Turn on a reading above or on the watch&apos;s sharing screen and it appears here and in the handoff summary.</p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {shared.map((m) => <Spark key={m} s={series[m]} now={now} active={screen === m} />)}
                </div>
              )}
              <p className="mt-3 text-sm text-ink-3">Breaks in a line are days with no readings. Imports from Android Health Connect and Apple Health are planned. Not connected in this demo.</p>
            </div>
          </div>
        </div>
      </ThreadRow>
    </section>
  );
}
