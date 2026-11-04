class SosEvent {
  final int id;
  final String senderId;
  final double latitude;
  final double longitude;
  final String? content;
  final List<String> routingPath;
  final String? aiSummary;
  final String? aiProvider;
  final bool isResolved;
  final DateTime createdAt;

  SosEvent({
    required this.id,
    required this.senderId,
    required this.latitude,
    required this.longitude,
    this.content,
    required this.routingPath,
    this.aiSummary,
    this.aiProvider,
    required this.isResolved,
    required this.createdAt,
  });

  factory SosEvent.fromJson(Map<String, dynamic> json) {
    List<String> path = [];
    if (json['routingPath'] != null) {
      path = List<String>.from(json['routingPath'] as List);
    } else if (json['routing_path'] != null) {
      path = List<String>.from(json['routing_path'] as List);
    }

    return SosEvent(
      id: json['id'] as int? ?? 0,
      senderId: json['senderId'] as String? ?? json['sender_id'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      content: json['content'] as String?,
      routingPath: path,
      aiSummary: json['aiSummary'] as String? ?? json['ai_summary'] as String?,
      aiProvider: json['aiProvider'] as String? ?? json['ai_provider'] as String?,
      isResolved: json['isResolved'] as bool? ?? json['is_resolved'] as bool? ?? false,
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt'] as String) 
          : json['created_at'] != null 
              ? DateTime.parse(json['created_at'] as String)
              : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'senderId': senderId,
      'latitude': latitude,
      'longitude': longitude,
      'content': content,
      'routingPath': routingPath,
      'aiSummary': aiSummary,
      'aiProvider': aiProvider,
      'isResolved': isResolved,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}
