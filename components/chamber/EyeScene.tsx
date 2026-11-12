"use client";
/* eslint-disable react-hooks/immutability -- react-three-fiber animates three.js objects by mutating them inside useFrame, outside React render. */
// Original procedural cutaway eye. General education only: it never represents Amina's eye.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { easing } from "maath";
import * as THREE from "three";
import { makeFundus, makeIris, DISC, MACULA } from "./fundus";
import type { EducationState } from "@/lib/carerelay-client";

export type PartId = "retina" | "macula" | "blood_vessels" | "optic_nerve" | "cornea" | "lens";
const R = 0.955; // retina radius

const fromFundus = (x: number, y: number, r = R) => new THREE.Vector3(x * r, y * r, -Math.sqrt(Math.max(0, 1 - x * x - y * y)) * r);

export const HOTSPOTS: Record<PartId, { pos: THREE.Vector3; cam: [number, number, number]; target: [number, number, number] }> = {
  retina: { pos: fromFundus(-0.42, 0.5), cam: [1.6, 0.7, 1.7], target: [0, 0, -0.5] },
  macula: { pos: fromFundus(MACULA.x - 0.04, MACULA.y - 0.1), cam: [0.95, 0.25, 0.95], target: [-0.05, 0, -0.85] },
  blood_vessels: { pos: fromFundus(0.02, 0.46), cam: [1.0, 0.65, 0.9], target: [0.1, 0.25, -0.8] },
  optic_nerve: { pos: fromFundus(DISC.x + 0.04, DISC.y + 0.14), cam: [1.5, 0.3, 0.6], target: [0.3, 0.05, -0.9] },
  cornea: { pos: new THREE.Vector3(0, 0.12, 1.16), cam: [1.9, 0.6, 2.4], target: [0, 0, 0.7] },
  lens: { pos: new THREE.Vector3(0.05, -0.18, 0.7), cam: [1.6, 0.2, 1.6], target: [0, 0, 0.6] },
};
// Framed so the cutaway faces the viewer at about 30 degrees and the fundus fills the aperture.
const HOME = { cam: [2.15, 0.6, 1.4] as const, target: [-0.1, 0, -0.45] as const };

const STATE_MIX: Record<EducationState, [number, number, number]> = {
  normal: [0, 0, 0], early: [1, 0, 0], progressing: [0.6, 1, 0], advanced: [0.5, 0.8, 1],
};

const vert = /* glsl */ `
varying vec3 vPos;
void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */ `
uniform sampler2D uBase; uniform sampler2D uMask; uniform sampler2D uE; uniform sampler2D uP; uniform sampler2D uA;
uniform float uEarly; uniform float uProg; uniform float uAdv; uniform float uDim; uniform float uHi; uniform float uHiMode;
uniform float uTime; uniform vec2 uMacula; uniform vec2 uDisc; uniform float uR;
varying vec3 vPos;
void main() {
  vec2 p = vPos.xy / uR;
  vec2 uv = p * 0.5 + 0.5;
  vec3 col = texture2D(uBase, uv).rgb;
  vec4 e = texture2D(uE, uv); col = mix(col, e.rgb, e.a * uEarly);
  vec4 pr = texture2D(uP, uv); col = mix(col, pr.rgb, pr.a * uProg);
  vec4 a = texture2D(uA, uv); col = mix(col, a.rgb, a.a * uAdv);
  float rim = smoothstep(0.55, 1.0, length(p));
  col *= 1.0 - 0.55 * rim;
  if (vPos.z > 0.0) col *= 0.35;
  float mask = texture2D(uMask, uv).r;
  float mac = 1.0 - smoothstep(0.02, 0.2, length(p - uMacula));
  float disc = 1.0 - smoothstep(0.02, 0.09, length(p - uDisc));
  float hi = uHiMode < 0.5 ? 0.55 : (uHiMode < 1.5 ? mac : (uHiMode < 2.5 ? mask : disc));
  col += vec3(0.55, 0.42, 0.3) * hi * uHi * (0.55 + 0.45 * sin(uTime * 3.2));
  col *= mix(1.0, 0.32, uDim);
  // Retina glows a little in the fundus palette so bloom picks it up.
  col *= 1.16;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

type LabelEls = { current: Partial<Record<PartId, HTMLButtonElement | null>> };

function Eye({ state, selected, hovered, onSelect, onHover, reduce, labelEls }: {
  state: EducationState; selected: PartId | null; hovered: PartId | null;
  onSelect: (p: PartId) => void; onHover: (p: PartId | null) => void; reduce: boolean; labelEls: LabelEls;
}) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const group = useRef<THREE.Group>(null);
  const fundus = useMemo(() => makeFundus(), []);
  const iris = useMemo(() => tex(makeIris()), []);
  const retinaMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
    uniforms: {
      uBase: { value: tex(fundus.base) }, uMask: { value: tex(fundus.mask) }, uE: { value: tex(fundus.early) },
      uP: { value: tex(fundus.progressing) }, uA: { value: tex(fundus.advanced) },
      uEarly: { value: 0 }, uProg: { value: 0 }, uAdv: { value: 0 }, uDim: { value: 0 }, uHi: { value: 0 }, uHiMode: { value: 0 },
      uTime: { value: 0 }, uMacula: { value: new THREE.Vector2(MACULA.x, MACULA.y) }, uDisc: { value: new THREE.Vector2(DISC.x, DISC.y) }, uR: { value: R },
    },
  }), [fundus]);
  const mats = useMemo(() => ({
    sclera: new THREE.MeshPhysicalMaterial({ color: "#efe8df", roughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color("#ffffff"), clearcoat: 1, clearcoatRoughness: 0.25, envMapIntensity: 1.2, transparent: true, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0 }),
    optic_nerve: new THREE.MeshPhysicalMaterial({ color: "#e9d6bd", roughness: 0.55, sheen: 0.4, transparent: true, emissive: new THREE.Color("#ffd7a0"), emissiveIntensity: 0 }),
    iris: new THREE.MeshPhysicalMaterial({ map: iris, roughness: 0.6, side: THREE.DoubleSide, transparent: true, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0 }),
    lens: new THREE.MeshPhysicalMaterial({ color: "#fff6e0", transmission: 0.92, ior: 1.42, thickness: 0.4, roughness: 0.08, transparent: true, emissive: new THREE.Color("#fff2cc"), emissiveIntensity: 0 }),
    cornea: new THREE.MeshPhysicalMaterial({ color: "#ffffff", transmission: 1, ior: 1.376, thickness: 0.12, roughness: 0.02, clearcoat: 1, envMapIntensity: 2.2, iridescence: 0.35, iridescenceIOR: 1.3, transparent: true, opacity: 0.5, emissive: new THREE.Color("#bfe8ff"), emissiveIntensity: 0 }),
  }), [iris]);
  const focus = hovered ?? selected;
  const retinaParts: PartId[] = ["retina", "macula", "blood_vessels", "optic_nerve"];
  const pointer = useThree((s) => s.pointer);

  useFrame((s, dt) => {
    const u = retinaMat.uniforms;
    const [e, p, a] = STATE_MIX[state];
    easing.damp(u.uEarly, "value", e, 0.25, dt);
    easing.damp(u.uProg, "value", p, 0.25, dt);
    easing.damp(u.uAdv, "value", a, 0.25, dt);
    u.uTime.value = s.clock.elapsedTime;
    const retinaFocused = focus !== null && retinaParts.includes(focus);
    easing.damp(u.uDim, "value", focus && !retinaFocused ? 1 : 0, 0.15, dt);
    easing.damp(u.uHi, "value", retinaFocused ? 1 : 0, 0.15, dt);
    u.uHiMode.value = focus === "macula" ? 1 : focus === "blood_vessels" ? 2 : focus === "optic_nerve" ? 3 : 0;
    for (const [id, m] of Object.entries(mats)) {
      const part = id as PartId | "sclera" | "iris";
      const isFocus = focus === part || (part === "iris" && focus === "lens");
      const dim = focus !== null && !isFocus;
      easing.damp(m, "opacity", dim ? (part === "cornea" || part === "lens" ? 0.15 : 0.3) : part === "cornea" ? 0.5 : 1, 0.15, dt);
      easing.damp(m, "emissiveIntensity", isFocus ? 0.35 + 0.25 * Math.sin(s.clock.elapsedTime * 3.2) : 0, 0.12, dt);
    }
    if (group.current) {
      if (!reduce && !focus) group.current.rotation.y += dt * 0.08;
      easing.dampE(group.current.rotation, [-pointer.y * 0.08, group.current.rotation.y, 0], 0.4, dt);
      // Project each hotspot to the screen and move its DOM label (plain buttons, no extra React roots).
      group.current.updateWorldMatrix(true, false);
      for (const id of Object.keys(HOTSPOTS) as PartId[]) {
        const el = labelEls.current[id];
        if (!el) continue;
        v.copy(HOTSPOTS[id].pos).applyMatrix4(group.current.matrixWorld).project(s.camera);
        const x = (v.x * 0.5 + 0.5) * s.size.width, y = (-v.y * 0.5 + 0.5) * s.size.height;
        el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        // On small screens only the focused part keeps its label, so names never pile up.
        const small = s.size.width < 480;
        el.style.opacity = v.z > 1 || (small && id !== selected && id !== hovered) ? "0" : "1";
        el.style.pointerEvents = el.style.opacity === "0" ? "none" : "auto";
      }
    }
  });

  const ev = (id: PartId) => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onHover(id); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { onHover(null); document.body.style.cursor = ""; },
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onSelect(id); },
  });

  return (
    <group ref={group} rotation={[0, 0.25, 0]}>
      {/* sclera: outer shell with the front-right quadrant cut away */}
      <mesh material={mats.sclera}>
        <sphereGeometry args={[1, 96, 64, Math.PI, Math.PI * 1.5]} />
      </mesh>
      {/* choroid: the inner face of the wall */}
      <mesh>
        <sphereGeometry args={[0.975, 96, 64, Math.PI, Math.PI * 1.5]} />
        <meshStandardMaterial color="#5b1e14" roughness={0.8} side={THREE.BackSide} />
      </mesh>
      {/* cut rims, so the wall reads as tissue with thickness */}
      {[Math.PI, Math.PI * 2.5].map((phi) => (
        <mesh key={phi} rotation={[0, -phi + Math.PI / 2, 0]}>
          <ringGeometry args={[0.955, 1, 64, 1, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color="#d9c7b8" roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* retina: back hemisphere with the procedural fundus shader */}
      <mesh material={retinaMat} {...ev("retina")}>
        <sphereGeometry args={[R, 128, 96, Math.PI, Math.PI]} />
      </mesh>
      {/* optic nerve leaving the back of the eye */}
      <mesh position={[DISC.x * 0.98, DISC.y, -1.25]} rotation={[Math.PI / 2, 0, 0]} material={mats.optic_nerve} {...ev("optic_nerve")}>
        <cylinderGeometry args={[0.13, 0.16, 0.62, 40]} />
      </mesh>
      {/* iris and pupil */}
      <mesh position={[0, 0, 0.84]} material={mats.iris}>
        <ringGeometry args={[0.15, 0.43, 96]} />
      </mesh>
      {/* lens */}
      <mesh position={[0, 0, 0.7]} scale={[0.34, 0.34, 0.16]} material={mats.lens} {...ev("lens")}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>
      {/* cornea: clear front dome */}
      <mesh position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]} material={mats.cornea} {...ev("cornea")}>
        <sphereGeometry args={[0.56, 64, 32, 0, Math.PI * 2, 0, 0.95]} />
      </mesh>
    </group>
  );
}

function CameraRig({ selected }: { selected: PartId | null }) {
  const ref = useRef<CameraControls>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const h = selected ? HOTSPOTS[selected] : HOME;
    c.setLookAt(h.cam[0], h.cam[1], h.cam[2], h.target[0], h.target[1], h.target[2], true);
  }, [selected]);
  return <CameraControls ref={ref} minDistance={0.8} maxDistance={4.5} smoothTime={0.45} />;
}

export default function EyeScene(props: {
  state: EducationState; selected: PartId | null; hovered: PartId | null;
  onSelect: (p: PartId) => void; onHover: (p: PartId | null) => void; labels: Record<PartId, string>;
  reduce: boolean; active: boolean; onReady?: (gl: THREE.WebGLRenderer) => void;
}) {
  const [fx, setFx] = useState(true);
  const labelEls = useRef<Partial<Record<PartId, HTMLButtonElement | null>>>({});
  return (
    <div className="relative size-full">
    <Canvas
      dpr={[1, 2]} frameloop={props.active ? "always" : "demand"}
      camera={{ position: [...HOME.cam], fov: 34, near: 0.05, far: 30 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => props.onReady?.(gl)}
      onPointerMissed={() => props.onHover(null)}
    >
      <color attach="background" args={["#0a1a21"]} />
      <PerformanceMonitor onDecline={() => setFx(false)} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 2.5, 3]} intensity={1.4} color="#fff4ea" />
      <directionalLight position={[-3, 1, -2.5]} intensity={1.1} color="#9b88f2" />
      <pointLight position={[0.4, 0.2, 0.2]} intensity={1.6} distance={2.2} color="#ffd2a8" />
      <Environment resolution={128}>
        <Lightformer intensity={1.2} position={[2, 3, 3]} scale={[4, 2, 1]} color="#ffffff" />
        <Lightformer intensity={0.6} position={[-3, 0, -2]} scale={[3, 3, 1]} color="#8f7cf0" />
        <Lightformer intensity={0.4} position={[0, -3, 1]} scale={[5, 1, 1]} color="#5fa0c8" />
      </Environment>
      <Eye state={props.state} selected={props.selected} hovered={props.hovered} onSelect={props.onSelect} onHover={props.onHover} reduce={props.reduce} labelEls={labelEls} />
      <CameraRig selected={props.selected} />
      {fx && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.45} luminanceThreshold={0.62} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette offset={0.32} darkness={0.75} />
          <Noise opacity={0.035} />
        </EffectComposer>
      )}
    </Canvas>
    {/* labels: names, not numbers. Mouse targets only; the same parts are keyboard buttons beside the model. */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {(Object.keys(HOTSPOTS) as PartId[]).map((id) => (
        <button key={id} tabIndex={-1} ref={(el) => { labelEls.current[id] = el; }}
          onClick={() => props.onSelect(id)} onPointerEnter={() => props.onHover(id)} onPointerLeave={() => props.onHover(null)}
          className="pointer-events-auto absolute left-0 top-0 size-0 transition-opacity">
          {/* every part is a small white pin; the selected or hovered part gets a dot, a leader line and a frosted pill */}
          <span className={`absolute left-0 top-0 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center`}>
            {props.selected === id || props.hovered === id
              ? <span className="block size-3 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,.18),0_0_12px_#fff]" />
              : <span className="block size-[9px] rounded-full bg-white/65 shadow-[0_0_0_3px_rgba(255,255,255,.12)]" />}
          </span>
          {(props.selected === id || props.hovered === id) && (
            <span className={`absolute top-0 flex -translate-y-1/2 items-center ${id === "cornea" || id === "lens" || id === "retina" ? "left-[6px]" : "right-[6px] flex-row-reverse"}`}>
              <span className={`block h-[1.5px] w-[110px] ${id === "cornea" || id === "lens" || id === "retina" ? "bg-[linear-gradient(90deg,#fff,rgba(255,255,255,.4))]" : "bg-[linear-gradient(270deg,#fff,rgba(255,255,255,.4))]"}`} />
              <span className="whitespace-nowrap rounded-[12px] border border-[rgba(179,166,240,.4)] bg-[rgba(10,26,33,.78)] px-3.5 py-2 text-[16px] font-semibold text-white backdrop-blur-md">{props.labels[id]}</span>
            </span>
          )}
        </button>
      ))}
    </div>
    </div>
  );
}
