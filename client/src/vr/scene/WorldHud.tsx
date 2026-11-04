import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { canvasTexture, drawTextCanvas, wrapText } from "@/vr/canvasText";

// In-world HUD. In a headset the DOM is invisible, so the control panel and
// the information panel are 3D planes textured with canvas drawings. Buttons
// are planes with click handlers: the controller ray (VR) or the gaze reticle
// (Cardboard) "clicks" them through the same pointer events as the mouse.

const GOLD = "#C8A97E";

type Mode = "destroy" | "source" | "shoot";

export interface HudModel {
  mode: Mode;
  quaking: boolean;
  slowMo: boolean;
  droneOn: boolean;
  sound: boolean;
  gravity: number;
  intensity: number;
  infoLines: string[];
  logLines: string[];
  on: {
    mode: (m: Mode) => void;
    quake: () => void;
    slowMo: () => void;
    drone: () => void;
    gravity: (delta: number) => void;
    intensity: (delta: number) => void;
    sound: () => void;
    reset: () => void;
    exit: () => void;
  };
}

function useTexture(make: () => HTMLCanvasElement, deps: unknown[]) {
  const result = useMemo(() => {
    const c = make();
    return { texture: canvasTexture(c), aspect: c.width / c.height };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => () => result.texture.dispose(), [result]);
  return result;
}

function Button({
  x,
  y,
  w,
  h,
  label,
  active,
  danger,
  onClick,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const { texture } = useTexture(
    () =>
      drawTextCanvas(
        [label],
        {
          fontPx: 34,
          align: "center",
          color: active ? GOLD : danger ? "#e58b84" : "#e8e4da",
          background: hover ? "rgba(70,66,58,0.95)" : "rgba(30,29,27,0.95)",
          border: active ? GOLD : hover ? "#ffffff" : "rgba(255,255,255,0.25)",
        },
        420,
        Math.round(420 * (h / w)),
      ),
    [label, active, danger, hover],
  );
  return (
    <mesh
      position={[x, y, 0.005]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function ControlPanel({ hud }: { hud: HudModel }) {
  const colW = 0.5;
  const rowH = 0.15;
  const gap = 0.02;
  const m = hud.mode;
  const items: [string, Partial<Parameters<typeof Button>[0]> & { onClick: () => void }][] = [
    ["Destroy / restore", { active: m === "destroy", onClick: () => hud.on.mode("destroy") }],
    ["Set SOS source", { active: m === "source", onClick: () => hud.on.mode("source") }],
    ["Shoot", { active: m === "shoot", onClick: () => hud.on.mode("shoot") }],
    [hud.quaking ? "Shaking..." : "Earthquake", { danger: true, onClick: hud.on.quake }],
    ["Slow motion", { active: hud.slowMo, onClick: hud.on.slowMo }],
    ["Relay drone", { active: hud.droneOn, onClick: hud.on.drone }],
    [`Gravity - (${hud.gravity.toFixed(1)})`, { onClick: () => hud.on.gravity(-2) }],
    ["Gravity +", { onClick: () => hud.on.gravity(2) }],
    [`Quake - (${hud.intensity.toFixed(1)})`, { onClick: () => hud.on.intensity(-0.2) }],
    ["Quake +", { onClick: () => hud.on.intensity(0.2) }],
    [hud.sound ? "Sound on" : "Sound off", { active: hud.sound, onClick: hud.on.sound }],
    ["Reset", { onClick: hud.on.reset }],
    ["Exit", { danger: true, onClick: hud.on.exit }],
  ];
  const nRows = Math.ceil(items.length / 2);
  const panelH = nRows * (rowH + gap) + gap;
  const panelW = colW * 2 + gap * 3;
  return (
    <group>
      <mesh>
        <planeGeometry args={[panelW, panelH]} />
        <meshBasicMaterial color="#111110" transparent opacity={0.85} />
      </mesh>
      {items.map(([label, props], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = (col === 0 ? -1 : 1) * (colW / 2 + gap / 2);
        const y = panelH / 2 - gap - rowH / 2 - row * (rowH + gap);
        return <Button key={label} x={x} y={y} w={colW} h={rowH} label={label} {...props} />;
      })}
    </group>
  );
}

function InfoPanel({ hud }: { hud: HudModel }) {
  const { texture, aspect } = useTexture(() => {
    const maxPx = 880;
    const lines: string[] = [];
    hud.infoLines.forEach((l) => lines.push(...wrapText(l, maxPx, 30)));
    lines.push("");
    lines.push("Event log");
    hud.logLines.slice(0, 6).forEach((l) => lines.push(...wrapText(l, maxPx, 26).slice(0, 2)));
    return drawTextCanvas(
      lines,
      { fontPx: 28, padding: 20, background: "rgba(17,17,16,0.88)", border: "rgba(255,255,255,0.2)" },
      960,
      760,
    );
  }, [hud.infoLines, hud.logLines]);
  const w = 1.1;
  return (
    <mesh>
      <planeGeometry args={[w, w / aspect]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * The two HUD panels. Place this inside a group that sits at the viewer's
 * feet; the panels are then 1.6 m in front of them, angled inwards.
 */
export function WorldHud({ hud }: { hud: HudModel }) {
  const rotL = useMemo(() => new THREE.Euler(0, 0.35, 0), []);
  const rotR = useMemo(() => new THREE.Euler(0, -0.35, 0), []);
  return (
    <>
      <group position={[-1.05, 1.15, -2.1]} rotation={rotL} scale={0.8}>
        <ControlPanel hud={hud} />
      </group>
      <group position={[1.05, 1.25, -2.1]} rotation={rotR} scale={0.8}>
        <InfoPanel hud={hud} />
      </group>
    </>
  );
}
