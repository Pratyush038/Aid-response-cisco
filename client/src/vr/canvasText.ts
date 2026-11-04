// Text in 3D without DOM and without font files.
//
// DOM overlays (drei <Html>) are invisible inside a VR headset, because the
// headset only shows the WebGL canvas. So all text is drawn into a 2D canvas
// and used as a texture on a plane or sprite. It then lives in the scene like
// any other object and works in VR and in the Cardboard stereo view.

import * as THREE from "three";

export interface TextStyle {
  color?: string;
  background?: string;
  border?: string;
  fontPx?: number;
  padding?: number;
  align?: "left" | "center";
  font?: string;
}

const FONT = "Inter, Helvetica, Arial, sans-serif";

/** Render lines of text on a canvas. Returns the canvas (size is power-of-two friendly). */
export function drawTextCanvas(
  lines: string[],
  style: TextStyle = {},
  minWidth = 0,
  minHeight = 0,
): HTMLCanvasElement {
  const fontPx = style.fontPx ?? 28;
  const pad = style.padding ?? 14;
  const font = style.font ?? FONT;
  const lineH = Math.round(fontPx * 1.3);

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `${fontPx}px ${font}`;
  let w = minWidth;
  for (const l of lines) w = Math.max(w, Math.ceil(measure.measureText(l).width) + pad * 2);
  const h = Math.max(minHeight, lines.length * lineH + pad * 2);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(16, w);
  canvas.height = Math.max(16, h);
  const g = canvas.getContext("2d")!;
  if (style.background) {
    g.fillStyle = style.background;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (style.border) {
    g.strokeStyle = style.border;
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  }
  g.font = `${fontPx}px ${font}`;
  g.fillStyle = style.color ?? "#e8e4da";
  g.textBaseline = "middle";
  g.textAlign = style.align === "center" ? "center" : "left";
  lines.forEach((l, i) => {
    const x = style.align === "center" ? canvas.width / 2 : pad;
    g.fillText(l, x, pad + lineH * i + lineH / 2);
  });
  return canvas;
}

export function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** Greedy word wrap of `text` to at most `maxPx` pixels wide. */
export function wrapText(text: string, maxPx: number, fontPx = 28, font = FONT): string[] {
  const g = document.createElement("canvas").getContext("2d")!;
  g.font = `${fontPx}px ${font}`;
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxPx && line) {
      out.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out;
}
