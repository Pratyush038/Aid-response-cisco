// Procedural textures drawn with the 2D canvas API (no image files).
// Guarded so the physics code can still be run in Node for testing.

import * as THREE from "three";

const hasDom = typeof document !== "undefined";

function make(size: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture | null {
  if (!hasDom) return null;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let building: { map: THREE.CanvasTexture | null; emissive: THREE.CanvasTexture | null } | null = null;

/** Concrete wall with a grid of windows; a few windows are lit at dusk. */
export function buildingTextures() {
  if (building) return building;
  const N = 3; // windows per side
  const size = 128;
  const cell = size / N;
  const lit: boolean[] = [];
  let seed = 12345;
  for (let i = 0; i < N * N; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    lit.push(seed / 4294967296 < 0.3);
  }
  const map = make(size, (g) => {
    g.fillStyle = "#cfcac0";
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        g.fillStyle = lit[y * N + x] ? "#f6d58a" : "#3b4654";
        g.fillRect(x * cell + cell * 0.2, y * cell + cell * 0.25, cell * 0.6, cell * 0.5);
      }
    g.strokeStyle = "rgba(0,0,0,0.18)";
    g.strokeRect(0, 0, size, size);
  });
  const emissive = make(size, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (!lit[y * N + x]) continue;
        g.fillStyle = "#ffbb55";
        g.fillRect(x * cell + cell * 0.2, y * cell + cell * 0.25, cell * 0.6, cell * 0.5);
      }
  });
  building = { map, emissive };
  return building;
}

let soft: THREE.CanvasTexture | null | undefined;

/** Soft round blob, used for dust particles and lamp glow. */
export function softDot(): THREE.CanvasTexture | null {
  if (soft !== undefined) return soft;
  soft = make(64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.4)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  if (soft) soft.wrapS = soft.wrapT = THREE.ClampToEdgeWrapping;
  return soft;
}
