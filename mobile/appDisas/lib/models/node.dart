class NetworkNode {
  final String nodeId;
  final String name;
  final double latitude;
  final double longitude;
  final bool isOnline;
  final int signalStrength;
  final String role; // "standard", "cisco-gateway", "user"
  final DateTime lastSeen;

  NetworkNode({
    required this.nodeId,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.isOnline,
    required this.signalStrength,
    required this.role,
    required this.lastSeen,
  });

  factory NetworkNode.fromJson(Map<String, dynamic> json) {
    return NetworkNode(
      nodeId: json['nodeId'] as String? ?? json['node_id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      isOnline: json['isOnline'] as bool? ?? json['is_online'] as bool? ?? true,
      signalStrength: json['signalStrength'] as int? ?? json['signal_strength'] as int? ?? 100,
      role: json['role'] as String? ?? 'standard',
      lastSeen: json['lastSeen'] != null 
          ? DateTime.parse(json['lastSeen'] as String) 
          : json['last_seen'] != null 
              ? DateTime.parse(json['last_seen'] as String)
              : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'nodeId': nodeId,
      'name': name,
      'latitude': latitude,
      'longitude': longitude,
      'isOnline': isOnline,
      'signalStrength': signalStrength,
      'role': role,
      'lastSeen': lastSeen.toIso8601String(),
    };
  }
}
