// Glue between the 3D scene and the existing routing code in lib/dijkstra.ts.
//
// IMPORTANT: NetworkGraph only looks at `connection.isActive`. It never reads
// `node.isOnline`. So a "destroyed" node only stops being routed through if
// every link touching it is also marked inactive. buildGraphInputs() does that
// explicitly; this is the self-healing step.

import { NetworkGraph } from "@/lib/dijkstra";
import type { NetworkConnection, NetworkNode, RoutingResult } from "@/types/network";
import { GATEWAY_ID, VR_LINKS, VR_NODES } from "./data";

/** Order-independent key for an undirected link. */
export function linkKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** A temporary link that is not part of the seed data (e.g. the relay drone). */
export interface ExtraLink {
  from: string;
  to: string;
  distance: number;
  latency: number;
}

/**
 * A link is usable only if (1) both endpoints are alive and (2) it is not in
 * `blocked`, the set of links whose line of sight is obstructed (los.ts).
 * Dijkstra only ever reads `isActive`, so all of that is folded in here.
 */
export function buildGraphInputs(
  dead: ReadonlySet<string>,
  blocked: ReadonlySet<string> = new Set(),
  extra: readonly ExtraLink[] = [],
): {
  nodes: NetworkNode[];
  connections: NetworkConnection[];
} {
  const nodes: NetworkNode[] = VR_NODES.map((n, i) => ({
    id: i + 1,
    nodeId: n.nodeId,
    name: n.name,
    latitude: 0,
    longitude: 0,
    isOnline: !dead.has(n.nodeId),
    signalStrength: dead.has(n.nodeId) ? 0 : 80,
    lastSeen: new Date(0),
    role: n.role,
  }));

  const all = [...VR_LINKS, ...extra];
  const connections: NetworkConnection[] = all.map((l, i) => ({
    id: i + 1,
    fromNodeId: l.from,
    toNodeId: l.to,
    distance: l.distance,
    latency: l.latency,
    // A link works only while BOTH endpoints are alive and, for the fixed
    // links, the line of sight is clear. Extra (drone) links are airborne, so
    // buildings do not block them.
    isActive:
      !dead.has(l.from) &&
      !dead.has(l.to) &&
      (i >= VR_LINKS.length || !blocked.has(linkKey(l.from, l.to))),
  }));

  return { nodes, connections };
}

/** Shortest route (by the app's weighted cost) from `source` to the gateway. */
export function computeRoute(
  source: string,
  dead: ReadonlySet<string>,
  blocked: ReadonlySet<string> = new Set(),
  extra: readonly ExtraLink[] = [],
): RoutingResult | null {
  // NetworkGraph.findShortestPath returns a 0-hop route when start === end,
  // without checking that the node is alive. Guard that case here so a
  // destroyed gateway can never be reported as reachable from itself.
  if (dead.has(source) || dead.has(GATEWAY_ID)) return null;

  const { nodes, connections } = buildGraphInputs(dead, blocked, extra);
  const result = new NetworkGraph(nodes, connections).findShortestPath(source, GATEWAY_ID);
  return result && result.path.length > 0 ? result : null;
}

export function nodeName(nodeId: string): string {
  return VR_NODES.find((n) => n.nodeId === nodeId)?.name ?? nodeId;
}

function fmtCost(r: RoutingResult): string {
  return r.totalDistance.toFixed(1);
}

/** Human-readable description of how a change affected the route. */
export function describeChange(
  before: RoutingResult | null,
  after: RoutingResult | null,
): string {
  if (!after) return before ? "No route to the gateway remains." : "Still no route.";
  if (!before) {
    return `Route restored: ${after.hops} hops, cost ${fmtCost(after)}.`;
  }
  const same =
    before.path.length === after.path.length &&
    before.path.every((id, i) => id === after.path[i]);
  if (same) return "Route unaffected.";
  return (
    `Rerouted: ${before.hops} hops (cost ${fmtCost(before)}) ` +
    `to ${after.hops} hops (cost ${fmtCost(after)}).`
  );
}

/**
 * Connected components of the usable fixed-link graph (union-find). Returns a
 * map nodeId -> component id; dead nodes are left out. Used by the drone to
 * tell whether two nodes are "otherwise disconnected".
 */
export function connectedComponents(
  dead: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
): Map<string, number> {
  const parent = new Map<string, string>();
  VR_NODES.forEach((n) => {
    if (!dead.has(n.nodeId)) parent.set(n.nodeId, n.nodeId);
  });
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (const l of VR_LINKS) {
    if (dead.has(l.from) || dead.has(l.to) || blocked.has(linkKey(l.from, l.to))) continue;
    parent.set(find(l.from), find(l.to));
  }
  const ids = new Map<string, number>();
  const out = new Map<string, number>();
  for (const id of Array.from(parent.keys())) {
    const root = find(id);
    if (!ids.has(root)) ids.set(root, ids.size);
    out.set(id, ids.get(root)!);
  }
  return out;
}
