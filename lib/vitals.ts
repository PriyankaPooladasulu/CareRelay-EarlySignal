// Shared health data: loads the synthetic FHIR-shaped readings and derives display series.
// CareRelay shows readings as reported by devices. It never labels a value good, bad, high or low.
import raw from "@/data/vitals-amina.json";

export type Metric = "heart_rate" | "blood_pressure" | "glucose" | "steps" | "sleep";
export const METRICS: Metric[] = ["heart_rate", "blood_pressure", "glucose", "steps", "sleep"];

export interface Point { t: number; v: number; v2?: number }
export interface Series {
  metric: Metric; label: string; unit: string; loinc: string; device: string; points: Point[];
}

type Obs = {
  code: { coding: { code: string }[] }; effectiveDateTime: string; device: { display: string };
  valueQuantity?: { value: number; unit: string }; component?: { valueQuantity: { value: number } }[];
};

const DAY = 86400000;
const data = raw as unknown as { anchor: string; observations: Obs[] };

const META: Record<Metric, { code: string; label: string; unit: string }> = {
  heart_rate: { code: "8867-4", label: "Heart rate", unit: "bpm" },
  blood_pressure: { code: "85354-9", label: "Blood pressure", unit: "mmHg" },
  glucose: { code: "15074-8", label: "Glucose", unit: "mmol/L" },
  steps: { code: "41950-7", label: "Steps", unit: "steps" },
  sleep: { code: "93832-4", label: "Sleep", unit: "h" },
};

let cache: Record<Metric, Series> | null = null;

/** Re-anchors the synthetic series so its last day is today (the data is simulated). */
export function getSeries(now = Date.now()): Record<Metric, Series> {
  if (cache) return cache;
  const anchorEnd = new Date(data.anchor + "T23:59:59-05:00").getTime();
  const today = new Date(now); today.setHours(23, 59, 59, 0);
  // Keep the shifted series in the past: anything later than "now" is dropped.
  const shift = today.getTime() - anchorEnd;
  const out = {} as Record<Metric, Series>;
  for (const m of Object.keys(META) as Metric[]) {
    const obs = data.observations.filter((o) => o.code.coding[0].code === META[m].code);
    out[m] = {
      metric: m, label: META[m].label, unit: META[m].unit, loinc: META[m].code,
      device: obs[0]?.device.display ?? "",
      points: obs
        .map((o) => ({
          t: new Date(o.effectiveDateTime).getTime() + shift,
          v: m === "blood_pressure" ? o.component![0].valueQuantity.value : o.valueQuantity!.value,
          v2: m === "blood_pressure" ? o.component![1].valueQuantity.value : undefined,
        }))
        .filter((p) => p.t <= now)
        .sort((a, b) => a.t - b.t),
    };
  }
  cache = out;
  return out;
}

export interface GapSignal { metric: Metric; text: string; since: number }

/** Information signals only: missing or stale data. Never a statement about what a value means. */
export function gapSignals(series: Record<Metric, Series>, now = Date.now()): GapSignal[] {
  const out: GapSignal[] = [];
  for (const s of Object.values(series)) {
    const last = s.points.at(-1);
    if (!last) continue;
    const days = Math.floor((now - last.t) / DAY);
    if (days >= 7) out.push({ metric: s.metric, since: last.t, text: `No ${s.label.toLowerCase()} readings shared in the last ${days} days.` });
  }
  return out;
}

/** Splits a series where consecutive readings are further apart than `maxGap` (drawn as breaks). */
export function segments(points: Point[], maxGap: number): Point[][] {
  const segs: Point[][] = [];
  for (const p of points) {
    const cur = segs.at(-1);
    if (cur && p.t - cur[cur.length - 1].t <= maxGap) cur.push(p);
    else segs.push([p]);
  }
  return segs;
}

export const MAX_GAP: Record<Metric, number> = {
  heart_rate: 5 * 3600000, blood_pressure: 2.5 * DAY, glucose: 2.5 * DAY, steps: 1.5 * DAY, sleep: 1.5 * DAY,
};

export function fmtValue(m: Metric, p: Point) {
  if (m === "blood_pressure") return `${p.v}/${p.v2}`;
  if (m === "steps") return p.v.toLocaleString("en-CA");
  return String(p.v);
}
