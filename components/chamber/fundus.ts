// Procedural fundus textures for the original CareRelay eye model.
// Everything is drawn from code with a seeded random generator: no photos, no third-party assets.
// Fundus coordinates: p in [-1, 1]^2 is the back hemisphere seen from inside; uv = p * 0.5 + 0.5.
// Macula at the centre, optic disc to the nasal side (+x).

export const DISC = { x: 0.3, y: 0.04 };
export const MACULA = { x: -0.02, y: -0.02 };
const S = 1024;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const toPx = (p: number) => (p * 0.5 + 0.5) * S;
// Canvas y grows downward; flip so +y in fundus space is "up" on the texture (texture v=1 is top).
const toPy = (p: number) => (1 - (p * 0.5 + 0.5)) * S;

function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  return c;
}

type Ctx = CanvasRenderingContext2D;

function vessel(ctx: Ctx, mask: Ctx, r: () => number, x: number, y: number, ang: number, len: number, w: number, color: string, depth: number, curl: number) {
  let px = x, py = y, a = ang;
  const steps = Math.max(6, Math.floor(len / 0.018));
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    a += curl + (r() - 0.5) * 0.22;
    const nx = px + Math.cos(a) * (len / steps);
    const ny = py + Math.sin(a) * (len / steps);
    const width = w * (1 - t * 0.55);
    for (const [c, col, ww] of [[ctx, color, width], [mask, "#fff", width * 1.4]] as const) {
      c.strokeStyle = col; c.lineWidth = ww * S; c.lineCap = "round";
      c.beginPath(); c.moveTo(toPx(px), toPy(py)); c.lineTo(toPx(nx), toPy(ny)); c.stroke();
    }
    // light reflex down the centre of larger vessels
    if (width > 0.004) {
      ctx.strokeStyle = "rgba(255,190,150,0.25)"; ctx.lineWidth = width * S * 0.25;
      ctx.beginPath(); ctx.moveTo(toPx(px), toPy(py)); ctx.lineTo(toPx(nx), toPy(ny)); ctx.stroke();
    }
    if (depth > 0 && i > 2 && r() < 0.16) {
      const side = r() < 0.5 ? -1 : 1;
      vessel(ctx, mask, r, nx, ny, a + side * (0.5 + r() * 0.6), len * (0.35 + r() * 0.3), width * 0.62, color, depth - 1, curl * 0.6 + (r() - 0.5) * 0.04);
    }
    px = nx; py = ny;
  }
}

export interface FundusSet {
  base: HTMLCanvasElement; mask: HTMLCanvasElement; early: HTMLCanvasElement; progressing: HTMLCanvasElement; advanced: HTMLCanvasElement;
}

export function makeFundus(seed = 1113): FundusSet {
  const r = rng(seed);
  const base = canvas(), mask = canvas();
  const b = base.getContext("2d")!, m = mask.getContext("2d")!;
  m.fillStyle = "#000"; m.fillRect(0, 0, S, S);

  // warm fundus orange, darker toward the periphery
  const g = b.createRadialGradient(toPx(MACULA.x), toPy(MACULA.y), 0, S / 2, S / 2, S * 0.62);
  // Fundus palette: core #F08A46 → mid #C24A26 → edge #5E1A12
  g.addColorStop(0, "#f08a46"); g.addColorStop(0.22, "#e06c36"); g.addColorStop(0.52, "#c24a26"); g.addColorStop(0.82, "#5e1a12"); g.addColorStop(1, "#1c0806");
  b.fillStyle = g; b.fillRect(0, 0, S, S);
  // choroidal texture: faint mottling
  for (let i = 0; i < 1600; i++) {
    const x = r() * S, y = r() * S, rad = 6 + r() * 26;
    b.fillStyle = `rgba(${r() < 0.5 ? "120,30,12" : "235,140,80"},${0.03 + r() * 0.04})`;
    b.beginPath(); b.ellipse(x, y, rad, rad * (0.4 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2); b.fill();
  }
  // macula and fovea
  const mg = b.createRadialGradient(toPx(MACULA.x), toPy(MACULA.y), 0, toPx(MACULA.x), toPy(MACULA.y), S * 0.11);
  mg.addColorStop(0, "rgba(80,22,8,0.75)"); mg.addColorStop(0.55, "rgba(110,32,12,0.35)"); mg.addColorStop(1, "rgba(110,32,12,0)");
  b.fillStyle = mg; b.fillRect(0, 0, S, S);
  b.fillStyle = "rgba(255,210,170,0.55)"; b.beginPath(); b.arc(toPx(MACULA.x), toPy(MACULA.y), 3, 0, Math.PI * 2); b.fill();

  // vessels from the disc: four arcades, veins (darker, wider) and arteries
  // [start heading, curl per step]: temporal arcades bend around the macula, nasal ones fan out.
  const arcades: [number, number, number][] = [[Math.PI * 0.7, 0.014, 1.15], [-Math.PI * 0.7, -0.014, 1.15], [Math.PI * 0.28, -0.006, 0.62], [-Math.PI * 0.28, 0.006, 0.62]];
  for (const [kind, color, w] of [["vein", "#6e170f", 0.0105], ["artery", "#b0331a", 0.0078]] as const) {
    for (const [ang, curl, len] of arcades) {
      const off = kind === "vein" ? 0.07 : -0.06;
      vessel(b, m, r, DISC.x, DISC.y, ang + off * Math.sign(ang), len, w, color, 3, curl);
    }
  }
  // macular branches converge toward (never cross) the fovea
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2, d = 0.22 + r() * 0.06;
    vessel(b, m, r, MACULA.x + Math.cos(a) * d, MACULA.y + Math.sin(a) * d, a + Math.PI + (r() - 0.5) * 0.6, 0.1, 0.0026, "#9c2a16", 0, 0);
  }

  // optic disc (drawn last so vessels emerge from it)
  const dg = b.createRadialGradient(toPx(DISC.x), toPy(DISC.y), 0, toPx(DISC.x), toPy(DISC.y), S * 0.042);
  dg.addColorStop(0, "#fff1c9"); dg.addColorStop(0.45, "#f2c77f"); dg.addColorStop(0.85, "#e09a57"); dg.addColorStop(1, "rgba(224,154,87,0)");
  b.fillStyle = dg; b.beginPath(); b.arc(toPx(DISC.x), toPy(DISC.y), S * 0.042, 0, Math.PI * 2); b.fill();

  // ── state overlays (transparent canvases) ──
  const early = canvas(), prog = canvas(), adv = canvas();
  const e = early.getContext("2d")!, p = prog.getContext("2d")!, a = adv.getContext("2d")!;
  const nearPole = () => { const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.5; return [MACULA.x + Math.cos(ang) * d, MACULA.y + Math.sin(ang) * d * 0.85]; };
  // early: scattered tiny dark-red dots
  for (let i = 0; i < 70; i++) {
    const [x, y] = nearPole();
    e.fillStyle = `rgba(${90 + r() * 40},10,8,${0.75 + r() * 0.25})`;
    e.beginPath(); e.arc(toPx(x), toPy(y), 2 + r() * 2.6, 0, Math.PI * 2); e.fill();
  }
  // progressing: blot-shaped spots and pale-yellow flecks around the macula
  for (let i = 0; i < 26; i++) {
    const [x, y] = nearPole();
    p.fillStyle = `rgba(${80 + r() * 30},8,6,${0.7 + r() * 0.2})`;
    p.beginPath(); p.ellipse(toPx(x), toPy(y), 7 + r() * 9, 5 + r() * 7, r() * Math.PI, 0, Math.PI * 2); p.fill();
  }
  for (let i = 0; i < 90; i++) {
    const ang = r() * Math.PI * 2, d = 0.13 + r() * 0.12;
    const x = MACULA.x + Math.cos(ang) * d, y = MACULA.y + Math.sin(ang) * d;
    p.fillStyle = `rgba(250,232,160,${0.7 + r() * 0.3})`;
    p.beginPath(); p.ellipse(toPx(x), toPy(y), 2 + r() * 4, 1.5 + r() * 2.5, r() * Math.PI, 0, Math.PI * 2); p.fill();
  }
  for (let i = 0; i < 5; i++) {
    const [x, y] = nearPole();
    const cg = p.createRadialGradient(toPx(x), toPy(y), 0, toPx(x), toPy(y), 26);
    cg.addColorStop(0, "rgba(250,244,230,0.75)"); cg.addColorStop(1, "rgba(250,244,230,0)");
    p.fillStyle = cg; p.fillRect(toPx(x) - 30, toPy(y) - 30, 60, 60);
  }
  // advanced: fine tangled new vessels near the disc, plus a soft haze
  const hz = a.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.6);
  hz.addColorStop(0, "rgba(235,210,190,0.16)"); hz.addColorStop(1, "rgba(235,210,190,0.06)");
  a.fillStyle = hz; a.fillRect(0, 0, S, S);
  a.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    let x = DISC.x + (r() - 0.5) * 0.14, y = DISC.y + (r() - 0.5) * 0.14, ang = r() * Math.PI * 2;
    a.strokeStyle = `rgba(${170 + r() * 50},${30 + r() * 20},20,0.9)`; a.lineWidth = 1 + r() * 1.2;
    a.beginPath(); a.moveTo(toPx(x), toPy(y));
    for (let k = 0; k < 9; k++) { ang += (r() - 0.5) * 1.8; x += Math.cos(ang) * 0.012; y += Math.sin(ang) * 0.012; a.lineTo(toPx(x), toPy(y)); }
    a.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const x = DISC.x - 0.1 - r() * 0.15, y = DISC.y - 0.18 - r() * 0.1;
    a.fillStyle = "rgba(110,14,8,0.55)"; a.beginPath(); a.ellipse(toPx(x), toPy(y), 22 + r() * 16, 12 + r() * 8, r(), 0, Math.PI * 2); a.fill();
  }
  return { base, mask, early, progressing: prog, advanced: adv };
}

/** Iris texture: radial striations, used on a ring around the pupil. */
export function makeIris(seed = 7): HTMLCanvasElement {
  const r = rng(seed);
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(256, 256, 60, 256, 256, 256);
  g.addColorStop(0, "#6b4a2b"); g.addColorStop(0.5, "#4a3320"); g.addColorStop(1, "#2a1c12");
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2;
    x.strokeStyle = `rgba(${200 + r() * 40},${150 + r() * 40},${90 + r() * 40},${0.06 + r() * 0.12})`;
    x.lineWidth = 1 + r() * 2;
    x.beginPath(); x.moveTo(256 + Math.cos(a) * 70, 256 + Math.sin(a) * 70);
    x.lineTo(256 + Math.cos(a + (r() - 0.5) * 0.1) * 250, 256 + Math.sin(a + (r() - 0.5) * 0.1) * 250); x.stroke();
  }
  return c;
}
