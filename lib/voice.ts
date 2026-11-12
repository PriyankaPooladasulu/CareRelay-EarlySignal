"use client";
// The one voice system. Plays approved script segments with line-by-line captions.
// Order: prerecorded audio (none shipped yet) → browser speechSynthesis → captions on a timer.
// The mic is never opened except by an explicit push-to-talk press.
import { LANGS, type Lang } from "./i18n";

let token = 0;

export function stopSpeaking() {
  token++;
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const prefix = lang.toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix + "-ca")) ?? voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? null;
}

export function voiceAvailable(lang: Lang) {
  return typeof window !== "undefined" && "speechSynthesis" in window && !!pickVoice(lang);
}

/** Speaks lines in order, calling onLine(i) as each starts and onEnd when done or stopped. */
export async function speakLines(lines: string[], lang: Lang, onLine: (i: number) => void, onEnd: () => void) {
  stopSpeaking();
  const my = ++token;
  const voice = typeof window !== "undefined" ? pickVoice(lang) : null;
  const speech = LANGS.find((l) => l.code === lang)?.speech ?? "en-CA";
  for (let i = 0; i < lines.length; i++) {
    if (my !== token) return;
    onLine(i);
    if (voice) {
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(lines[i]);
        u.voice = voice; u.lang = voice.lang || speech; u.rate = 0.94;
        u.onend = () => resolve(); u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      });
    } else {
      // Captions only: hold each line long enough to read it.
      await new Promise((r) => setTimeout(r, Math.max(2200, lines[i].split(/\s+/).length * 360)));
    }
  }
  if (my === token) onEnd();
}

type Rec = { lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean; start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };

export function speechRecognitionSupported() {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

/** Push-to-talk: one utterance, then the mic closes. */
export function listenOnce(lang: Lang, onText: (t: string) => void, onDone: (err?: string) => void): () => void {
  const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) { onDone("unsupported"); return () => {}; }
  const rec = new Ctor();
  rec.lang = LANGS.find((l) => l.code === lang)?.speech ?? "en-CA";
  rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
  let got = false;
  rec.onresult = (e) => { got = true; onText(e.results[0][0].transcript); };
  rec.onerror = (e) => onDone(e.error);
  rec.onend = () => { if (!got) onDone("nothing-heard"); else onDone(); };
  rec.start();
  return () => { try { rec.stop(); } catch { /* already stopped */ } };
}

export const normalizeQuestion = (q: string) => q.toLowerCase().replace(/\s+/g, " ").replace(/[\s?.!¿？।]+$/u, "").trim();
