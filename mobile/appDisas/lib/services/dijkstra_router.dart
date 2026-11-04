import '../models/node.dart';
import '../models/connection.dart';

class RoutingResult {
  final List<String> path;
  final double totalDistance;
  final int hops;

  RoutingResult({
    required this.path,
    required this.totalDistance,
    required this.hops,
  });
}

class DijkstraRouter {
  static RoutingResult? findShortestPath(
    List<NetworkNode> nodes,
    List<NetworkConnection> connections,
    String start,
    String end,
  ) {
    // 1. Create a set of online nodes
    final onlineNodeIds = nodes.where((n) => n.isOnline).map((n) => n.nodeId).toSet();
    if (!onlineNodeIds.contains(start) || !onlineNodeIds.contains(end)) {
      return null;
    }
    if (start == end) {
      return RoutingResult(path: [start], totalDistance: 0.0, hops: 0);
    }

    // 2. Build adjacency list
    final Map<String, List<MapEntry<String, double>>> neighbors = {};
    for (final conn in connections) {
      if (!conn.isActive) continue;
      if (!onlineNodeIds.contains(conn.fromNodeId) || !onlineNodeIds.contains(conn.toNodeId)) {
        continue;
      }
      
      // Calculate weight: weight = distance * 10 + latency / 10
      // Higher latency and distance result in a higher weight (less preferred path)
      final weight = conn.distance * 10 + conn.latency / 10;
      
      neighbors.putIfAbsent(conn.fromNodeId, () => []).add(MapEntry(conn.toNodeId, weight));
      neighbors.putIfAbsent(conn.toNodeId, () => []).add(MapEntry(conn.fromNodeId, weight));
    }

    // 3. Initialize structures
    final Map<String, double> dist = {};
    final Map<String, String> prev = {};
    final Set<String> unvisited = Set.from(onlineNodeIds);
    
    for (final nodeId in onlineNodeIds) {
      dist[nodeId] = double.infinity;
    }
    dist[start] = 0.0;

    // 4. Dijkstra exploration
    while (unvisited.isNotEmpty) {
      // Find unvisited node with minimum distance
      String? current;
      double best = double.infinity;
      
      for (final id in unvisited) {
        final d = dist[id] ?? double.infinity;
        if (d < best) {
          best = d;
          current = id;
        }
      }

      if (current == null || best == double.infinity) {
        break; // Destination unreachable
      }

      if (current == end) {
        break; // Found shortest path
      }

      unvisited.remove(current);

      // Relax neighbors
      final nodeNeighbors = neighbors[current] ?? [];
      for (final edge in nodeNeighbors) {
        final neighborId = edge.key;
        final weight = edge.value;
        
        if (!unvisited.contains(neighborId)) continue;
        
        final candidate = best + weight;
        if (candidate < (dist[neighborId] ?? double.infinity)) {
          dist[neighborId] = candidate;
          prev[neighborId] = current;
        }
      }
    }

    if (dist[end] == double.infinity || dist[end] == null) {
      return null;
    }

    // 5. Reconstruct path
    final List<String> path = [];
    String? cursor = end;
    while (cursor != null) {
      path.insert(0, cursor);
      cursor = prev[cursor];
    }

    if (path.isEmpty || path.first != start) {
      return null;
    }

    return RoutingResult(
      path: path,
      totalDistance: dist[end]!,
      hops: path.length - 1,
    );
  }
}
