// Glue between the 3D scene and the existing routing code in lib/dijkstra.ts.
//
// IMPORTANT: NetworkGraph only looks at `connection.isActive`. It never reads
// `node.isOnline`. So a "destroyed" node only stops being routed through if
// every link touching it is also marked inactive. buildGraphInputs() does that
// explicitly; this is the self-healing step.

import { NetworkGraph } from "@/lib/dijkstra";
import type { NetworkConnection, NetworkNode, RoutingResult } from "@/types/network";
import { GATEWAY_ID, VR_LINKS, VR_NODES } from "./data";

export function buildGraphInputs(dead: ReadonlySet<string>): {
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

  const connections: NetworkConnection[] = VR_LINKS.map((l, i) => ({
    id: i + 1,
    fromNodeId: l.from,
    toNodeId: l.to,
    distance: l.distance,
    latency: l.latency,
    // A link works only while BOTH of its endpoints are alive.
    isActive: !dead.has(l.from) && !dead.has(l.to),
  }));

  return { nodes, connections };
}

/** Shortest route (by the app's weighted cost) from `source` to the gateway. */
export function computeRoute(
  source: string,
  dead: ReadonlySet<string>,
): RoutingResult | null {
  // NetworkGraph.findShortestPath returns a 0-hop route when start === end,
  // without checking that the node is alive. Guard that case here so a
  // destroyed gateway can never be reported as reachable from itself.
  if (dead.has(source) || dead.has(GATEWAY_ID)) return null;

  const { nodes, connections } = buildGraphInputs(dead);
  return new NetworkGraph(nodes, connections).findShortestPath(source, GATEWAY_ID);
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
