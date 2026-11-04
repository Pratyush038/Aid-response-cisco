// Scene data for the 3D / VR disaster-mesh simulator.
//
// Node names, signal data and link weights mirror seed-db.ts so the 3D scene
// shows the same network as the rest of the app. World positions are a
// SCHEMATIC layout (not to scale): real distances span ~12 km, which cannot be
// walked in VR. Routing still uses the real distance/latency values below, so
// the paths Dijkstra picks are the same ones the 2D app would pick.

export const USER_ID = "user";
export const GATEWAY_ID = "cisco-gateway";
export const SOURCE_DEFAULT = "peenya";

export interface VrNodeSpec {
  nodeId: string;
  name: string;
  /** World X (east is +). */
  x: number;
  /** World Z (south is +). */
  z: number;
  startsOnline: boolean;
  role?: "standard" | "cisco-gateway";
}

export interface VrLinkSpec {
  from: string;
  to: string;
  /** Real-world distance in km (used for routing cost). */
  distance: number;
  /** Latency in ms (used for routing cost). */
  latency: number;
}

export const VR_NODES: VrNodeSpec[] = [
  { nodeId: "user", name: "You (RV College)", x: -6, z: 12, startsOnline: true },
  { nodeId: "rv-gate", name: "RV Gate Station", x: -9, z: 8.5, startsOnline: true },
  { nodeId: "mysore-road", name: "Mysore Road Junction", x: -12, z: 15, startsOnline: true },
  { nodeId: "kengeri", name: "Kengeri Satellite Town", x: -26, z: 24, startsOnline: true },
  { nodeId: "hoskerehalli", name: "Hoskerehalli Metro", x: -19, z: 1, startsOnline: true },
  { nodeId: "rajarajeshwari", name: "Rajarajeshwari Nagar", x: 8, z: 29, startsOnline: false },
  { nodeId: "banashankari", name: "Banashankari BDA", x: 21, z: 6, startsOnline: true },
  { nodeId: "jayanagar", name: "Jayanagar 9th Block", x: 32, z: -2, startsOnline: true },
  { nodeId: "vijayanagar", name: "Vijayanagar Metro", x: 16, z: -18, startsOnline: true },
  { nodeId: "magadi-road", name: "Magadi Road Hospital", x: -32, z: 6, startsOnline: false },
  { nodeId: "nandini-layout", name: "Nandini Layout", x: -13, z: -5, startsOnline: true },
  { nodeId: "peenya", name: "Peenya Industrial Area", x: -2, z: -30, startsOnline: true },
  { nodeId: "cisco-gateway", name: "Cisco Meraki Gateway", x: 1, z: 8, startsOnline: true, role: "cisco-gateway" },
];

// Same edges as seed-db.ts. Whether a link is usable is NOT stored here: it is
// derived from its two endpoints being alive (see mesh.ts). In the seed, every
// link flagged isActive:false touches an offline node, so this is equivalent
// at start-up and makes "restore node" bring its links back.
export const VR_LINKS: VrLinkSpec[] = [
  { from: "user", to: "rv-gate", distance: 0.2, latency: 25 },
  { from: "user", to: "mysore-road", distance: 0.5, latency: 35 },
  { from: "user", to: "hoskerehalli", distance: 1.8, latency: 65 },
  { from: "rv-gate", to: "mysore-road", distance: 0.4, latency: 30 },
  { from: "rv-gate", to: "nandini-layout", distance: 1.2, latency: 50 },
  { from: "mysore-road", to: "kengeri", distance: 2.1, latency: 75 },
  { from: "mysore-road", to: "magadi-road", distance: 1.5, latency: 60 },
  { from: "mysore-road", to: "banashankari", distance: 2.8, latency: 90 },
  { from: "hoskerehalli", to: "nandini-layout", distance: 0.8, latency: 40 },
  { from: "hoskerehalli", to: "vijayanagar", distance: 4.2, latency: 120 },
  { from: "hoskerehalli", to: "peenya", distance: 8.5, latency: 180 },
  { from: "banashankari", to: "rajarajeshwari", distance: 1.8, latency: 70 },
  { from: "banashankari", to: "jayanagar", distance: 4.5, latency: 110 },
  { from: "kengeri", to: "rajarajeshwari", distance: 2.2, latency: 80 },
  { from: "nandini-layout", to: "vijayanagar", distance: 3.8, latency: 100 },
  { from: "vijayanagar", to: "jayanagar", distance: 3.2, latency: 95 },
  { from: "vijayanagar", to: "peenya", distance: 5.1, latency: 130 },
  { from: "user", to: "cisco-gateway", distance: 0.6, latency: 22 },
  { from: "rv-gate", to: "cisco-gateway", distance: 0.8, latency: 28 },
  { from: "banashankari", to: "cisco-gateway", distance: 1.9, latency: 55 },
];

/** Nodes that are offline in the seed data. */
export function initialDeadNodes(): Set<string> {
  return new Set(VR_NODES.filter((n) => !n.startsOnline).map((n) => n.nodeId));
}

/**
 * Gentle rolling terrain. Pure function of (x, z) so the terrain mesh, the
 * node towers, the buildings and the physics ground all agree on the height.
 *
 * The amplitude is deliberately small: buildings are rigid, pre-fractured
 * blocks, so a strongly sloped ground would make their footings float or
 * penetrate the ground collider. See baseHeight() and GROUND_OFFSET below.
 */
export function terrainHeight(x: number, z: number): number {
  return (
    0.4 * Math.sin(x * 0.09) * Math.cos(z * 0.08) +
    0.18 * Math.sin(x * 0.21 + z * 0.17)
  );
}

export const BODY_HEIGHT = 3;
export const MAST_HEIGHT = 3;

/**
 * The physics ground is the visual terrain lowered by this amount. Building
 * footings sit at the HIGHEST ground point under their footprint, so with this
 * margin a footing never penetrates the physics ground (penetration would make
 * the ground joints fight the contact solver). The small gap under the lower
 * corners is hidden by a visual foundation slab.
 */
export const GROUND_OFFSET = 0.3;

/** World position of the top of a node's antenna mast (where links attach). */
export function towerTop(spec: VrNodeSpec): [number, number, number] {
  const base = baseHeight(spec.x, spec.z, 2.2, 2.2);
  return [spec.x, base + BODY_HEIGHT + MAST_HEIGHT, spec.z];
}

/** Highest terrain point under a w x d footprint centred on (x, z). */
export function baseHeight(x: number, z: number, w: number, d: number): number {
  let h = terrainHeight(x, z);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      h = Math.max(h, terrainHeight(x + (sx * w) / 2, z + (sz * d) / 2));
    }
  }
  return h;
}

/** Small deterministic PRNG so scenery is identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type BuildingKind = "tower" | "landmark" | "scenery";

/**
 * A building is a box footprint split into an nx x ny x nz grid of blocks.
 * The split is fixed here, at data time: there is no runtime fracturing.
 */
export interface BuildingSpec {
  id: string;
  kind: BuildingKind;
  /** Set for node towers; collapsing such a building kills the node. */
  nodeId?: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  nx: number;
  ny: number;
  nz: number;
}

/**
 * Tall buildings placed on the middle of three links. Their top is above the
 * height of the antennas, so the line of sight of those links is blocked until
 * the building falls down. This is what makes "collapse a building" able to
 * RESTORE a link as well as to break one.
 */
const LANDMARKS: { x: number; z: number }[] = [
  { x: 26.5, z: 2 }, // banashankari - jayanagar
  { x: 1.5, z: -11.5 }, // nandini-layout - vijayanagar
  { x: -19, z: 19.5 }, // mysore-road - kengeri
];

function overlaps(a: BuildingSpec, b: BuildingSpec, margin: number): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + margin
  );
}

let cachedBuildings: BuildingSpec[] | null = null;

/** Every building in the scene: node towers, landmarks, then scenery. */
export function buildBuildings(): BuildingSpec[] {
  if (cachedBuildings) return cachedBuildings;
  const out: BuildingSpec[] = [];

  // Node towers first so nothing else can be placed on top of them.
  for (const n of VR_NODES) {
    out.push({
      id: `tower-${n.nodeId}`,
      kind: "tower",
      nodeId: n.nodeId,
      x: n.x,
      z: n.z,
      w: 2.2,
      d: 2.2,
      h: BODY_HEIGHT,
      nx: 2,
      ny: 3,
      nz: 2,
    });
  }

  LANDMARKS.forEach((l, i) =>
    out.push({
      id: `landmark-${i}`,
      kind: "landmark",
      x: l.x,
      z: l.z,
      w: 2.4,
      d: 2.4,
      h: 12,
      nx: 2,
      ny: 8,
      nz: 2,
    }),
  );

  // Scenery: random but seeded. A candidate that would overlap an existing
  // building is rejected, because overlapping rigid bodies at t=0 would be
  // pushed apart violently by the physics engine.
  VR_NODES.forEach((node, i) => {
    const rand = mulberry32(1000 + i);
    for (let k = 0; k < 5; k++) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const angle = rand() * Math.PI * 2;
        const radius = 3.5 + rand() * 3.5;
        const w = 1.4 + rand() * 1.4;
        const d = 1.4 + rand() * 1.4;
        const h = 2 + rand() * 3.4;
        const cand: BuildingSpec = {
          id: `scenery-${i}-${k}`,
          kind: "scenery",
          x: node.x + Math.cos(angle) * radius,
          z: node.z + Math.sin(angle) * radius,
          w,
          d,
          h,
          nx: 2,
          ny: Math.max(2, Math.round(h / 1.3)),
          nz: 2,
        };
        if (!out.some((o) => overlaps(cand, o, 0.6))) {
          out.push(cand);
          break;
        }
      }
    }
  });

  cachedBuildings = out;
  return out;
}
