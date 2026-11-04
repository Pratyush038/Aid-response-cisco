class NetworkConnection {
  final int id;
  final String fromNodeId;
  final String toNodeId;
  final double distance;
  final int latency;
  final bool isActive;

  NetworkConnection({
    required this.id,
    required this.fromNodeId,
    required this.toNodeId,
    required this.distance,
    required this.latency,
    required this.isActive,
  });

  factory NetworkConnection.fromJson(Map<String, dynamic> json) {
    return NetworkConnection(
      id: json['id'] as int? ?? 0,
      fromNodeId: json['fromNodeId'] as String? ?? json['from_node_id'] as String? ?? '',
      toNodeId: json['toNodeId'] as String? ?? json['to_node_id'] as String? ?? '',
      distance: (json['distance'] as num?)?.toDouble() ?? 0.0,
      latency: json['latency'] as int? ?? 0,
      isActive: json['isActive'] as bool? ?? json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fromNodeId': fromNodeId,
      'toNodeId': toNodeId,
      'distance': distance,
      'latency': latency,
      'isActive': isActive,
    };
  }
}
