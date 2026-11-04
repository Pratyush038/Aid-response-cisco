import type { NetworkNode, NetworkConnection, RoutingResult } from "@/types/network";

export class NetworkGraph {
  private nodes: Map<string, NetworkNode> = new Map();
  private adjacencyList: Map<string, Map<string, number>> = new Map();

  constructor(nodes: NetworkNode[], connections: NetworkConnection[]) {
    // Initialize nodes
    nodes.forEach(node => {
      this.nodes.set(node.nodeId, node);
      this.adjacencyList.set(node.nodeId, new Map());
    });

    // Build adjacency list with weights (distance + latency factor)
    connections.forEach(conn => {
      if (conn.isActive) {
        const weight = this.calculateEdgeWeight(conn);
        
        // Add bidirectional edges
        this.adjacencyList.get(conn.fromNodeId)?.set(conn.toNodeId, weight);
        this.adjacencyList.get(conn.toNodeId)?.set(conn.fromNodeId, weight);
      }
    });
  }

  private calculateEdgeWeight(connection: NetworkConnection): number {
    // Weight considers both distance and latency
    // Higher latency and distance result in higher weight (less preferred)
    return connection.distance * 10 + connection.latency / 10;
  }

  findShortestPath(start: string, end: string): RoutingResult | null {
    if (!this.nodes.has(start) || !this.nodes.has(end)) {
      return null;
    }

    if (start === end) {
      return {
        path: [start],
        totalDistance: 0,
        hops: 0,
      };
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    // Initialize distances
    for (const nodeId of Array.from(this.nodes.keys())) {
      distances.set(nodeId, nodeId === start ? 0 : Infinity);
      previous.set(nodeId, null);
      unvisited.add(nodeId);
    }

    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let current: string | null = null;
      let minDistance = Infinity;

      for (const nodeId of Array.from(unvisited)) {
        // ?? not ||: the start node's distance is 0, which is falsy — `||`
        // would turn it into Infinity and no route would ever be found.
        const distance = distances.get(nodeId) ?? Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          current = nodeId;
        }
      }

      if (!current || minDistance === Infinity) {
        break; // No path found
      }

      unvisited.delete(current);

      if (current === end) {
        break; // Found shortest path to destination
      }

      // Check neighbors
      const neighbors = this.adjacencyList.get(current);
      if (neighbors) {
        for (const [neighbor, weight] of Array.from(neighbors)) {
          if (unvisited.has(neighbor)) {
            const newDistance = (distances.get(current) ?? Infinity) + weight;
            if (newDistance < (distances.get(neighbor) ?? Infinity)) {
              distances.set(neighbor, newDistance);
              previous.set(neighbor, current);
            }
          }
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = end;

    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) || null;
    }

    if (path[0] !== start) {
      return null; // No path found
    }

    return {
      path,
      totalDistance: distances.get(end) || 0,
      hops: path.length - 1,
    };
  }

  findAllPaths(start: string): Map<string, RoutingResult> {
    const results = new Map<string, RoutingResult>();
    
    for (const nodeId of Array.from(this.nodes.keys())) {
      if (nodeId !== start) {
        const result = this.findShortestPath(start, nodeId);
        if (result) {
          results.set(nodeId, result);
        }
      }
    }

    return results;
  }

  getConnectedNodes(nodeId: string): string[] {
    const neighbors = this.adjacencyList.get(nodeId);
    return neighbors ? Array.from(neighbors.keys()) : [];
  }

  // Broadcast algorithm for SOS messages (flood routing)
  broadcastPath(start: string): string[] {
    const visited = new Set<string>();
    const queue = [start];
    const broadcastOrder: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current)) {
        continue;
      }

      visited.add(current);
      broadcastOrder.push(current);

      // Add all connected neighbors to queue
      const neighbors = this.getConnectedNodes(current);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    return broadcastOrder;
  }
}

export function calculateOptimalRoute(
  nodes: NetworkNode[],
  connections: NetworkConnection[],
  from: string,
  to: string
): RoutingResult | null {
  const graph = new NetworkGraph(nodes, connections);
  return graph.findShortestPath(from, to);
}

export function calculateBroadcastRoute(
  nodes: NetworkNode[],
  connections: NetworkConnection[],
  from: string
): string[] {
  const graph = new NetworkGraph(nodes, connections);
  return graph.broadcastPath(from);
}
