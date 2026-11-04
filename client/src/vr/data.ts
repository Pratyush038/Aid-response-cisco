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
 * node towers and the scenery all agree on the ground height.
 */
export function terrainHeight(x: number, z: number): number {
  return (
    1.1 * Math.sin(x * 0.09) * Math.cos(z * 0.08) +
    0.5 * Math.sin(x * 0.21 + z * 0.17)
  );
}

export const BODY_HEIGHT = 3;
export const MAST_HEIGHT = 3;

/** World position of the top of a node's antenna mast (where links attach). */
export function towerTop(spec: VrNodeSpec): [number, number, number] {
  return [spec.x, terrainHeight(spec.x, spec.z) + BODY_HEIGHT + MAST_HEIGHT, spec.z];
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

export interface SceneryBlock {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/** Background buildings around each node. Pure decoration in Stage 1. */
export function buildScenery(): SceneryBlock[] {
  const blocks: SceneryBlock[] = [];
  VR_NODES.forEach((node, i) => {
    const rand = mulberry32(1000 + i);
    for (let k = 0; k < 5; k++) {
      const angle = rand() * Math.PI * 2;
      const radius = 3.5 + rand() * 3.5;
      blocks.push({
        x: node.x + Math.cos(angle) * radius,
        z: node.z + Math.sin(angle) * radius,
        w: 1.2 + rand() * 1.6,
        d: 1.2 + rand() * 1.6,
        h: 1.5 + rand() * 3.5,
      });
    }
  });
  return blocks;
}
