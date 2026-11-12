"use client";
// The Chamber: general education only. Dark, circular, like looking through a fundus camera.
// The design itself says "this is not your eye".
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import clsx from "clsx";
import { Info, Mic, Square, Volume2, ExternalLink } from "lucide-react";
import { actions, useStore } from "@/lib/store";
import { tr, ui, type Lang } from "@/lib/i18n";
import { listenOnce, normalizeQuestion, speakLines, speechRecognitionSupported, stopSpeaking, voiceAvailable } from "@/lib/voice";
import { api } from "@/lib/api";
import type { EducationState, VoiceResponse, VoiceSegment } from "@/lib/carerelay-client";
import { ThreadRow } from "../thread";
import type { PartId } from "./EyeScene";

const EyeScene = dynamic(() => import("./EyeScene"), { ssr: false, loading: () => <div className="size-full animate-pulse bg-choroid-2" /> });

const STATES: EducationState[] = ["normal", "early", "progressing", "advanced"];
const PARTS: PartId[] = ["retina", "macula", "blood_vessels", "optic_nerve", "cornea", "lens"];
const QUESTIONS = [
  { topic: "retina", key: "q_retina" }, { topic: "follow_up", key: "q_follow_up" },
  { topic: "progression", key: "q_progression" }, { topic: "next_steps", key: "q_next_steps" },
] as const;
const EYE_MODE = process.env.NEXT_PUBLIC_EYE_MODE;

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function webglOk() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

/** Static fallback: a captured image of the same original model, per state. */
function StaticEye({ state }: { state: EducationState }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/images/eye/${state}.png`} alt={`Original CareRelay eye model, general ${state} educational view. Not a real eye.`} className="size-full object-cover" />
  );
}

function SketchfabEye() {
  return (
    <div className="relative size-full">
      <iframe title="Cross Section of Eye – Anatomy (third-party 3D model, backup)" className="size-full"
        src="https://sketchfab.com/models/4bf3236c8fe2407ea3f494a93b8f5aa2/embed?autostart=1&ui_theme=dark&transparent=1&ui_infos=0&ui_controls=0&ui_stop=0&ui_inspector=0&ui_settings=0&ui_help=0&ui_vr=0&ui_fullscreen=0&ui_annotations=0"
        allow="autoplay; fullscreen; xr-spatial-tracking" />
    </div>
  );
}

type Line = { text: string; scope: VoiceSegment["scope"] };

export default function Chamber() {
  const education = useStore((s) => s.education);
  const catalog = useStore((s) => s.catalog);
  const lang = useStore((s) => s.lang);
  const edu = useStore((s) => s.edu);
  const visited = useStore((s) => s.chamberVisited);
  const source = useStore((s) => s.source);
  const reduce = !!useReducedMotion();
  const [selected, setSelected] = useState<PartId | null>(null);
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [inView, setInView] = useState(false);
  const [gl, setGl] = useState<boolean | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState<string | null>(null);
  const [sources, setSources] = useState<VoiceResponse["sources"]>([]);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string>("");
  const [recordAnswer, setRecordAnswer] = useState<Line[] | null>(null);
  const stopListen = useRef<() => void>(() => {});
  const ref = useRef<HTMLElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection runs once on mount
  useEffect(() => { setGl(webglOk()); }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setInView(e.isIntersecting);
      document.documentElement.dataset.world = e.intersectionRatio > 0.35 ? "chamber" : "record";
      if (e.intersectionRatio > 0.35) actions.visitChamber();
    }, { threshold: [0, 0.35, 0.6] });
    io.observe(el);
    return () => { io.disconnect(); document.documentElement.dataset.world = "record"; };
  }, []);
  useEffect(() => () => stopSpeaking(), []);

  const labels = useMemo(() => Object.fromEntries(PARTS.map((p) => [p, ui(p, lang)])) as Record<PartId, string>, [lang]);
  const card = selected ? education?.anatomy.find((a) => a.id === selected) : null;
  const stateCard = education?.states.find((s) => s.id === edu);
  const srcById = (ids: string[]) => education?.sources.filter((s) => ids.includes(s.id)) ?? [];

  const play = (id: string, segs: { text: string; scope: VoiceSegment["scope"] }[], srcs: VoiceResponse["sources"]) => {
    const ls = segs.map((s) => ({ text: tr(s.text, lang), scope: s.scope }));
    setLines(ls); setSources(srcs); setPlaying(id); setCurrent(0); setRecordAnswer(null);
    speakLines(ls.map((l) => l.text), lang, setCurrent, () => { setPlaying(null); setCurrent(-1); });
  };
  const stop = () => { stopSpeaking(); setPlaying(null); setCurrent(-1); };
  const playTopic = (topic: string) => {
    const s = catalog?.scripts.find((x) => x.topic === topic && !x.state);
    if (s) play(topic, s.segments, s.sources);
  };

  const ask = async (text: string) => {
    const q = normalizeQuestion(text);
    setHeard(text);
    const en = catalog?.questions.find((x) => normalizeQuestion(x.question) === q);
    const local = QUESTIONS.find((x) => normalizeQuestion(ui(x.key, lang)) === q);
    const topic = en?.topic ?? local?.topic;
    if (topic === "patient_facts") {
      // Patient facts are record content: shown apart from education, never mixed in.
      if (source === "live") {
        try {
          const r = await api.voice({ topic: "patient_facts" });
          setRecordAnswer(r.segments.map((s) => ({ text: s.text, scope: s.scope })));
        } catch { setRecordAnswer([{ text: "Your records are shown in the section above.", scope: "patient_record" }]); }
      } else setRecordAnswer([{ text: "Your records are shown in the section above, with their exact quotes.", scope: "patient_record" }]);
      return;
    }
    if (topic && topic !== "diagnosis") { playTopic(topic); return; }
    const refusal = catalog?.scripts.find((x) => x.refused);
    if (refusal) play("refusal", refusal.segments, []);
  };

  const pushToTalk = () => {
    if (listening) { stopListen.current(); return; }
    stop(); setListening(true); setHeard("");
    stopListen.current = listenOnce(lang, (t) => ask(t), (err) => {
      setListening(false);
      if (err === "not-allowed") setHeard("Microphone permission was declined. You can use the question buttons instead.");
      else if (err === "nothing-heard") setHeard("Didn't catch that. Try again, or use a question button.");
    });
  };

  const viz = EYE_MODE === "sketchfab" ? <SketchfabEye /> : gl === false ? <StaticEye state={edu} /> : gl === null ? null : (
    <Boundary fallback={<StaticEye state={edu} />}>
      <EyeScene state={edu} selected={selected} hovered={hovered} onSelect={(p) => setSelected((s) => (s === p ? null : p))}
        onHover={setHovered} labels={labels} reduce={reduce} active={inView && !reduce} />
    </Boundary>
  );

  return (
    <section ref={ref} id="understand" aria-labelledby="understand-h" lang={lang} className="chamber relative overflow-hidden bg-[radial-gradient(90%_70%_at_30%_40%,var(--choroid-2),var(--choroid)_70%)] text-chamber">
      {/* smooth the light-to-dark change */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[140px] bg-[linear-gradient(rgba(242,245,247,.08),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_28%_45%,rgba(106,85,201,.12),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1320px] px-4 md:px-8">
        <ThreadRow line="chamber" node={visited ? "education-done" : "education"} nodeAt={110} className="py-16 md:py-[110px]">
          <div className="grid items-start gap-[clamp(24px,4vw,80px)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
            <div className="lg:sticky lg:top-36">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-lens/40 bg-[rgba(10,26,33,.7)] px-3 py-1.5 text-[0.778rem] font-semibold text-[#d9d2fa]">General education · not your eye</p>
              <div className="relative mx-auto aspect-square w-full max-w-[640px] overflow-hidden rounded-full bg-choroid shadow-[0_0_0_2px_rgba(106,85,201,.45),0_0_0_14px_rgba(106,85,201,.08),0_0_90px_rgba(106,85,201,.3),0_0_120px_rgba(240,138,70,.12)]">
                {/* violet aperture: an inner hairline ring with an inset glow */}
                <div aria-hidden className="pointer-events-none absolute inset-[3.5%] z-10 rounded-full border border-[rgba(179,166,240,.28)] shadow-[inset_0_0_60px_rgba(106,85,201,.25)]" />
                {viz}
                <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_70px_24px_#0a1a21]" />
              </div>
              {EYE_MODE === "sketchfab" && (
                <p className="mt-2 text-center text-sm text-chamber-muted">Backup 3D model: “Cross Section of Eye – Anatomy” by Erik Ao on Sketchfab. Used under the license shown on the model page.</p>
              )}
              <p role="note" className="mt-6 flex gap-3 rounded-[12px] border border-[rgba(179,166,240,.32)] bg-lens/[.12] px-[18px] py-4 text-[0.889rem] leading-[1.45] text-[#d9d2fa]">
                <Info aria-hidden className="mt-0.5 flex-none" size={18} />
                <span>{tr(education?.disclaimer ?? "General educational visualization. This model does not represent the patient's actual eye. Only an appropriate healthcare professional can determine whether these changes are present.", lang)}</span>
              </p>
            </div>

            <div>
              <h2 id="understand-h" tabIndex={-1} className="t-section text-white">Understand the follow-up</h2>
              <p className="mt-4 max-w-[40ch] text-[1.111rem] text-chamber-muted">This room is general education about the eye. Nothing here is about Amina&apos;s eye or her records. Turn the model, pick a part, or ask a question.</p>
              {lang !== "en" && <p className="mt-2 text-sm font-bold text-lens-text">{ui("translation_note", lang)}</p>}

              <h3 className="mt-9 text-[0.889rem] font-semibold text-chamber-muted">Educational views</h3>
              <div role="radiogroup" aria-label="Educational views" className="mt-3 flex flex-wrap gap-2.5">
                {STATES.map((s) => (
                  <button key={s} role="radio" aria-checked={edu === s} onClick={() => actions.setEdu(s)}
                    className={clsx("min-h-11 rounded-full border px-5 py-2.5 text-[0.944rem] font-semibold transition-colors", edu === s ? "border-lens bg-lens text-white shadow-[0_8px_24px_-10px_rgba(106,85,201,.9)]" : "border-[rgba(179,166,240,.28)] bg-white/[.04] text-chamber hover:bg-lens/[.18]")}>
                    {ui(s, lang)}
                  </button>
                ))}
              </div>

              <h3 className="mt-8 text-[0.889rem] font-semibold text-chamber-muted">Parts of the eye</h3>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {PARTS.map((p) => (
                  <button key={p} aria-pressed={selected === p} onClick={() => setSelected(selected === p ? null : p)}
                    onMouseEnter={() => setHovered(p)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(p)} onBlur={() => setHovered(null)}
                    className={clsx("min-h-11 rounded-[12px] border px-5 py-2.5 text-[0.944rem] font-semibold transition-colors", selected === p ? "border-lens bg-lens text-white shadow-[0_8px_24px_-10px_rgba(106,85,201,.9)]" : "border-white/[.14] bg-white/[.04] text-chamber hover:bg-lens/[.18]")}>
                    {labels[p]}
                  </button>
                ))}
              </div>

              <article className="mt-7 rounded-[20px] border border-[rgba(179,166,240,.22)] bg-white/[.035] p-6 backdrop-blur-sm" aria-live="polite">
                {card ? (
                  <>
                    <h4 className="text-xl text-white">{labels[card.id as PartId]}</h4>
                    <p className="mt-2 text-lg">{tr(card.text, lang)}</p>
                    <Sources list={srcById(card.source_ids)} />
                    <button onClick={() => (playing === card.id ? stop() : play(card.id, [{ text: card.text, scope: "general_education" }], srcById(card.source_ids)))}
                      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-white/20 px-3 font-bold hover:bg-white/10">
                      {playing === card.id ? <Square size={16} aria-hidden /> : <Volume2 size={18} aria-hidden />} {playing === card.id ? ui("stop", lang) : ui("listen", lang)}
                    </button>
                  </>
                ) : stateCard ? (
                  <>
                    <h4 className="text-xl text-white">{ui(edu, lang)}</h4>
                    <p className="mt-2 text-lg">{tr(stateCard.text, lang)}</p>
                    <p className="mt-3 text-sm text-chamber-muted">{tr(education!.progression_limit, lang)}</p>
                    <Sources list={srcById(stateCard.source_ids)} />
                    <button onClick={() => {
                      if (playing === "state") return stop();
                      const s = catalog?.scripts.find((x) => x.topic === "state" && x.state === edu);
                      if (s) play("state", s.segments, s.sources);
                    }} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-white/20 px-3 font-bold hover:bg-white/10">
                      {playing === "state" ? <Square size={16} aria-hidden /> : <Volume2 size={18} aria-hidden />} {playing === "state" ? ui("stop", lang) : ui("listen", lang)}
                    </button>
                  </>
                ) : null}
              </article>

              <h3 className="mt-9 text-[0.889rem] font-semibold text-chamber-muted">Ask a question</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {QUESTIONS.map((q) => (
                  <button key={q.topic} onClick={() => (playing === q.topic ? stop() : playTopic(q.topic))} aria-pressed={playing === q.topic}
                    className={clsx("flex min-h-14 items-center gap-3 rounded-[12px] border px-4 py-3 text-left text-lg font-bold", playing === q.topic ? "border-lens bg-lens text-white" : "border-white/15 bg-white/5 hover:bg-white/10")}>
                    {playing === q.topic ? <Square aria-hidden size={18} className="flex-none" /> : <Volume2 aria-hidden size={20} className="flex-none text-lens-text" />}
                    {ui(q.key, lang)}
                  </button>
                ))}
              </div>
              {speechRecognitionSupported() && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button onClick={pushToTalk} aria-pressed={listening}
                    className={clsx("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-bold", listening ? "border-lens-text bg-lens text-white" : "border-white/20 text-chamber hover:bg-white/10")}>
                    <Mic aria-hidden size={18} /> {listening ? "Listening… select to stop" : "Push to talk"}
                  </button>
                  <span className="text-sm text-chamber-muted">The mic is off until you press. Only the listed questions are answered.</span>
                </div>
              )}
              {heard && <p className="mt-2 text-sm text-chamber-muted">Heard: “{heard}”</p>}

              {lines.length > 0 && (
                <div className="mt-5 rounded-[12px] border border-white/10 bg-black/20 p-4" aria-live="polite">
                  <p className="mb-2 text-sm font-bold text-chamber-muted">Captions{!voiceAvailable(lang) && " · no voice for this language on this device, captions only"}</p>
                  <ol className="space-y-2">
                    {lines.map((l, i) => (
                      <li key={i} className={clsx("transition-colors", i === current ? "text-white" : "text-chamber-muted", l.scope !== "general_education" && "flex gap-2 text-base")}>
                        {l.scope !== "general_education" && <Info aria-hidden size={16} className="mt-1 flex-none" />}
                        <span className={clsx(l.scope === "general_education" && "text-lg")}>{l.text}</span>
                      </li>
                    ))}
                  </ol>
                  <Sources list={sources} />
                </div>
              )}
              {recordAnswer && (
                <div className="mt-5 rounded-[4px] border border-chart bg-paper p-4 text-ink">
                  <p className="text-sm font-bold text-chart">From your records, not general education</p>
                  {recordAnswer.map((l, i) => <p key={i} className="mt-1">{l.text}</p>)}
                </div>
              )}
            </div>
          </div>
        </ThreadRow>
      </div>
    </section>
  );
}

function Sources({ list }: { list: { id: string; title: string; publisher: string; url: string; checked_on: string }[] }) {
  if (!list.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-sm text-chamber-muted">
      {list.map((s) => (
        <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-white">
          Source: {s.publisher}, “{s.title}” (checked {s.checked_on}) <ExternalLink size={13} aria-hidden /></a></li>
      ))}
    </ul>
  );
}

export type { Lang };
