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

import type { BuildingStyle } from "./data";

type Pair = { map: THREE.CanvasTexture | null; emissive: THREE.CanvasTexture | null };
const cache = new Map<string, Pair>();

/** Deterministic 0..1 sequence for window patterns. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

/**
 * Wall texture (+ matching emissive map for lit windows) for a building style.
 * Each block face shows one tile, so tiles are drawn small and simple.
 */
export function buildingTextures(style: BuildingStyle | "tower" = "tower"): Pair {
  const hit = cache.get(style);
  if (hit) return hit;
  const size = 128;
  const r = rng(style.length * 977 + 13);
  const lit = (p: number) => r() < p;

  // Each style draws its wall, then a list of window rectangles with a "lit" flag.
  const wins: { x: number; y: number; w: number; h: number; lit: boolean }[] = [];
  let wall = "#cfcac0";
  let glass = "#3b4654";
  let extra: ((g: CanvasRenderingContext2D) => void) | null = null;

  if (style === "residential") {
    wall = "#f1ece2"; // tinted per building by the material colour
    glass = "#4a5a6e";
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) wins.push({ x: 14 + x * 58, y: 16 + y * 56, w: 40, h: 34, lit: lit(0.35) });
    extra = (g) => {
      g.fillStyle = "rgba(255,255,255,0.7)"; // window sills
      for (const w of wins) g.fillRect(w.x - 3, w.y + w.h, w.w + 6, 4);
    };
  } else if (style === "commercial") {
    wall = "#9fb6c9";
    glass = "#27405c"; // blue glass curtain wall
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) wins.push({ x: 4 + x * 42, y: 6 + y * 30, w: 38, h: 26, lit: lit(0.3) });
  } else if (style === "industrial") {
    wall = "#b4b8bd";
    glass = "#4d5560";
    wins.push({ x: 10, y: 20, w: 40, h: 14, lit: lit(0.2) }, { x: 78, y: 20, w: 40, h: 14, lit: lit(0.2) });
    extra = (g) => {
      g.strokeStyle = "rgba(0,0,0,0.22)"; // corrugated ribs
      g.lineWidth = 2;
      for (let x = 0; x < size; x += 8) {
        g.beginPath();
        g.moveTo(x, 50);
        g.lineTo(x, size);
        g.stroke();
      }
    };
  } else if (style === "civic") {
    wall = "#f4f5f6";
    glass = "#4c7da8";
    for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) wins.push({ x: 8 + x * 40, y: 14 + y * 52, w: 28, h: 34, lit: lit(0.4) });
    extra = (g) => {
      g.fillStyle = "#c2453d"; // red band
      g.fillRect(0, 56, size, 8);
    };
  } else if (style === "campus") {
    wall = "#b5674f"; // brick
    glass = "#2f3a48";
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) wins.push({ x: 16 + x * 56, y: 18 + y * 54, w: 36, h: 36, lit: lit(0.3) });
    extra = (g) => {
      g.strokeStyle = "rgba(60,25,15,0.35)"; // brick courses
      g.lineWidth = 1;
      for (let y = 0; y < size; y += 8) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(size, y);
        g.stroke();
      }
    };
  } else {
    // node towers: concrete with a grid of windows
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) wins.push({ x: x * 42 + 8, y: y * 42 + 10, w: 26, h: 21, lit: lit(0.3) });
  }

  const map = make(size, (g) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, size, size);
    extra?.(g);
    for (const w of wins) {
      g.fillStyle = w.lit ? "#f6d58a" : glass;
      g.fillRect(w.x, w.y, w.w, w.h);
    }
    g.strokeStyle = "rgba(0,0,0,0.18)";
    g.strokeRect(0, 0, size, size);
  });
  const emissive = make(size, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    g.fillStyle = "#ffbb55";
    for (const w of wins) if (w.lit) g.fillRect(w.x, w.y, w.w, w.h);
  });
  const pair = { map, emissive };
  cache.set(style, pair);
  return pair;
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
