/**
 * Minimal latency-weighted Dijkstra over the mesh, shared by client and
 * server. The server uses it to compute the real multi-hop path an SOS
 * takes from the sender to the Cisco Meraki gateway.
 */

export interface RoutableLink {
  fromNodeId: string;
  toNodeId: string;
  latency: number;
}

export function findMeshPath(
  onlineNodeIds: string[],
  links: RoutableLink[],
  start: string,
  end: string,
): string[] | null {
  const nodes = new Set(onlineNodeIds);
  if (!nodes.has(start) || !nodes.has(end)) return null;
  if (start === end) return [start];

  const neighbors = new Map<string, Array<{ id: string; weight: number }>>();
  const addEdge = (from: string, to: string, weight: number) => {
    if (!neighbors.has(from)) neighbors.set(from, []);
    neighbors.get(from)!.push({ id: to, weight });
  };
  for (const link of links) {
    if (!nodes.has(link.fromNodeId) || !nodes.has(link.toNodeId)) continue;
    const weight = Math.max(1, link.latency);
    addEdge(link.fromNodeId, link.toNodeId, weight);
    addEdge(link.toNodeId, link.fromNodeId, weight);
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const unvisited = new Set(nodes);
  dist.set(start, 0);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of Array.from(unvisited)) {
      const d = dist.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null || best === Infinity) break;
    if (current === end) break;
    unvisited.delete(current);

    for (const { id, weight } of neighbors.get(current) ?? []) {
      if (!unvisited.has(id)) continue;
      const candidate = best + weight;
      if (candidate < (dist.get(id) ?? Infinity)) {
        dist.set(id, candidate);
        prev.set(id, current);
      }
    }
  }

  if (!dist.has(end)) return null;
  const path: string[] = [];
  let cursor: string | undefined = end;
  while (cursor !== undefined) {
    path.unshift(cursor);
    cursor = prev.get(cursor);
  }
  return path[0] === start ? path : null;
}
