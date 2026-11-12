"use client";
import { useRef, useState } from "react";
import clsx from "clsx";
import { Upload as UploadIcon, FileText, CircleCheck, CircleDashed, Loader, X } from "lucide-react";
import { actions, useStore, type Upload } from "@/lib/store";
import { PaperSheet } from "./ui";
import { ThreadRow } from "./thread";

const STATE: Record<Upload["state"], { label: string; icon: typeof FileText; spin?: boolean }> = {
  uploaded: { label: "Uploaded", icon: CircleDashed },
  reading: { label: "Reading text (OCR)", icon: Loader, spin: true },
  checking: { label: "Checking against evidence rules", icon: Loader, spin: true },
  done: { label: "Checked", icon: CircleCheck },
  unsupported: { label: "Not readable in the demo", icon: X },
  failed: { label: "Couldn't be checked", icon: X },
};

/** Document vault: real states only. Text goes through the backend's evidence validator like everything else. */
export function DocumentVault() {
  const uploads = useStore((s) => s.uploads);
  const source = useStore((s) => s.source);
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const add = (files: FileList | null) => { if (files) Array.from(files).forEach((f) => actions.addRecord(f)); };

  return (
    <section id="vault" aria-labelledby="vault-h" className="pt-4">
      <ThreadRow line="pending" className="pb-16">
        <h2 id="vault-h" tabIndex={-1} className="text-[1.333rem] font-semibold">Add a synthetic record</h2>
        <p className="mt-1 max-w-[64ch] text-ink-2">Upload a photo of a note or a .txt file. CareRelay reads the text, then checks it with the same evidence rules as Amina&apos;s records. Only claims with an exact source sentence are kept. {source === "live" && "Adding a record re-runs the analysis and replaces any unfinished plan."}</p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          className={clsx("mt-4 flex max-w-[720px] flex-wrap items-center gap-4 rounded-[4px] border-2 border-dashed p-5", drag ? "border-chart bg-chart-tint" : "border-line bg-white/60")}
        >
          <UploadIcon aria-hidden className="text-chart" />
          <p className="flex-1">Drop a file here, or</p>
          <button onClick={() => input.current?.click()} className="min-h-11 rounded-[12px] border border-line bg-white px-4 font-bold hover:border-chart">Choose a file</button>
          <input ref={input} type="file" accept="image/*,.txt,text/plain,.pdf" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} aria-label="Choose a synthetic record file" />
        </div>
        <p className="mt-2 text-sm text-ink-3">Use synthetic text only. Never upload real health information. OCR runs in your browser with bundled English language data.</p>
        {uploads.length > 0 && (
          <ul className="mt-5 max-w-[720px] space-y-3" aria-live="polite">
            {uploads.map((u) => {
              const s = STATE[u.state];
              const Icon = s.icon;
              return (
                <li key={u.id}>
                  <PaperSheet className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-bold"><FileText aria-hidden size={18} /> {u.name} <span className="font-normal text-ink-3">{Math.max(1, Math.round(u.size / 1024))} KB</span></p>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-ink-2"><Icon aria-hidden size={16} className={clsx(s.spin && "animate-spin")} /> {s.label}{u.state === "reading" && u.progress ? ` ${Math.round(u.progress * 100)}%` : ""}</p>
                    </div>
                    <ol className="mt-2 flex flex-wrap gap-x-2 text-sm text-ink-3" aria-label="Progress">
                      {["Uploaded", "Reading text", "Checked against evidence rules", "Result"].map((step, i) => {
                        const at = { uploaded: 0, reading: 1, checking: 2, done: 3, unsupported: 0, failed: 1 }[u.state];
                        return <li key={step} className={clsx(i <= at && "font-bold text-ink")}>{i > 0 && "→ "}{step}</li>;
                      })}
                    </ol>
                    {u.state === "done" && u.accepted !== undefined && source === "live" && (
                      <p className="mt-2 font-bold">{u.accepted} {u.accepted === 1 ? "event" : "events"} accepted · {u.rejected} rejected</p>
                    )}
                    {u.note && <p className="mt-1 text-ink-2">{u.note}</p>}
                    {u.text && (
                      <details className="mt-2">
                        <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">Extracted text</summary>
                        <p className="record-voice whitespace-pre-wrap text-ink-2">{u.text.slice(0, 1200)}</p>
                      </details>
                    )}
                  </PaperSheet>
                </li>
              );
            })}
          </ul>
        )}
      </ThreadRow>
    </section>
  );
}
