// Generates 30 days of 100% synthetic, unremarkable device readings for Amina as
// FHIR Observation-shaped objects. Seeded, so the output is reproducible.
// Run: node scripts/generate-vitals.ts   (Node 22.6+ strips the types natively)
//
// LOINC codes used (verify against loinc.org before any non-demo use):
//   8867-4  Heart rate
//   85354-9 Blood pressure panel; components 8480-6 systolic, 8462-4 diastolic
//   41950-7 Number of steps in 24 hour Measured
//   93832-4 Sleep duration
//   15074-8 Glucose [Moles/volume] in Blood
import { writeFileSync } from "node:fs";

const ANCHOR = "2026-11-12"; // last day of the series; the app re-anchors this to "today"
const DAYS = 30;
let seed = 20261113;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const jitter = (base: number, spread: number) => base + (rand() * 2 - 1) * spread;

const DEVICES = {
  watch: { display: "Smartwatch (optical heart rate)", type: "smartwatch" },
  watchSleep: { display: "Smartwatch (motion and heart rate sleep estimate)", type: "smartwatch" },
  watchSteps: { display: "Smartwatch (accelerometer step count)", type: "smartwatch" },
  cuff: { display: "Home blood pressure cuff", type: "bp_cuff" },
  meter: { display: "Glucose meter", type: "glucose_meter" },
} as const;

type Obs = {
  resourceType: "Observation"; id: string; status: "final";
  code: { coding: { system: string; code: string; display: string }[] };
  valueQuantity?: { value: number; unit: string; system: string; code: string };
  component?: { code: { coding: { system: string; code: string; display: string }[] }; valueQuantity: { value: number; unit: string; system: string; code: string } }[];
  effectiveDateTime: string; device: { display: string; type: string }; performer: [{ display: "patient" }];
  subject: { reference: "Patient/DEMO-001" }; meta: { tag: [{ code: "synthetic" }] };
};

const LOINC = "http://loinc.org";
const UCUM = "http://unitsofmeasure.org";
const out: Obs[] = [];
let n = 0;
const day = (offset: number, h: number, m = 0) => {
  const d = new Date(ANCHOR + "T00:00:00-05:00");
  d.setDate(d.getDate() - offset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const base = (code: string, display: string, at: string, device: (typeof DEVICES)[keyof typeof DEVICES]) => ({
  resourceType: "Observation" as const, id: `obs-${String(++n).padStart(4, "0")}`, status: "final" as const,
  code: { coding: [{ system: LOINC, code, display }] }, effectiveDateTime: at, device: { ...device },
  performer: [{ display: "patient" as const }] as [{ display: "patient" }], subject: { reference: "Patient/DEMO-001" as const },
  meta: { tag: [{ code: "synthetic" as const }] as [{ code: "synthetic" }] },
});

for (let o = DAYS - 1; o >= 0; o--) {
  // Heart rate: every two hours while the watch is worn (not worn on two nights, see sleep).
  for (let h = 0; h < 24; h += 2) {
    const asleep = h < 7 || h >= 23;
    const v = Math.round(jitter(asleep ? 61 : 74, asleep ? 3 : 7));
    out.push({ ...base("8867-4", "Heart rate", day(o, h, Math.floor(rand() * 50)), DEVICES.watch), valueQuantity: { value: v, unit: "beats/minute", system: UCUM, code: "/min" } });
  }
  // Steps: one daily total.
  if (o > 0) {
    const steps = Math.round(jitter(5600, 1400));
    out.push({ ...base("41950-7", "Number of steps in 24 hour Measured", day(o, 23, 55), DEVICES.watchSteps), valueQuantity: { value: steps, unit: "steps/day", system: UCUM, code: "/d" } });
  }
  // Sleep: nightly duration, except two nights the watch was charging.
  if (o !== 9 && o !== 10) {
    const hours = Math.round(jitter(7.1, 0.6) * 10) / 10;
    out.push({ ...base("93832-4", "Sleep duration", day(o, 7, 5), DEVICES.watchSleep), valueQuantity: { value: hours, unit: "h", system: UCUM, code: "h" } });
  }
  // Blood pressure: home cuff, mornings and some evenings, but none in the last 14 days.
  if (o >= 14) {
    for (const h of o % 2 === 0 ? [8, 20] : [8]) {
      const sys = Math.round(jitter(119, 5)); const dia = Math.round(jitter(77, 3));
      out.push({
        ...base("85354-9", "Blood pressure panel", day(o, h, 10), DEVICES.cuff),
        component: [
          { code: { coding: [{ system: LOINC, code: "8480-6", display: "Systolic blood pressure" }] }, valueQuantity: { value: sys, unit: "mmHg", system: UCUM, code: "mm[Hg]" } },
          { code: { coding: [{ system: LOINC, code: "8462-4", display: "Diastolic blood pressure" }] }, valueQuantity: { value: dia, unit: "mmHg", system: UCUM, code: "mm[Hg]" } },
        ],
      });
    }
  }
  // Glucose: meter, most mornings.
  if (o % 4 !== 3) {
    const g = Math.round(jitter(6.6, 0.5) * 10) / 10;
    out.push({ ...base("15074-8", "Glucose [Moles/volume] in Blood", day(o, 7, 30), DEVICES.meter), valueQuantity: { value: g, unit: "mmol/L", system: UCUM, code: "mmol/L" } });
  }
}

writeFileSync(
  new URL("../data/vitals-amina.json", import.meta.url),
  JSON.stringify({ synthetic: true, patient: "DEMO-001", anchor: ANCHOR, generated_by: "scripts/generate-vitals.ts", seed: 20261113, observations: out }, null, 1) + "\n",
);
console.log(`Wrote ${out.length} synthetic observations`);
