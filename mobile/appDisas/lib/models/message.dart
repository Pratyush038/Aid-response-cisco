import 'dart:convert';

class Message {
  final int id;
  final String senderId;
  final String? receiverId;
  final String content;
  final String messageType; // "normal", "sos", "system"
  final List<String> routingPath;
  final int hops;
  final DateTime timestamp;
  final bool isDelivered;
  final bool encrypted;

  Message({
    required this.id,
    required this.senderId,
    this.receiverId,
    required this.content,
    required this.messageType,
    required this.routingPath,
    required this.hops,
    required this.timestamp,
    required this.isDelivered,
    required this.encrypted,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    List<String> path = [];
    if (json['routingPath'] != null) {
      path = List<String>.from(json['routingPath'] as List);
    } else if (json['routing_path'] != null) {
      path = List<String>.from(json['routing_path'] as List);
    }

    return Message(
      id: json['id'] as int? ?? 0,
      senderId: json['senderId'] as String? ?? json['sender_id'] as String? ?? '',
      receiverId: json['receiverId'] as String? ?? json['receiver_id'] as String?,
      content: json['content'] as String? ?? '',
      messageType: json['messageType'] as String? ?? json['message_type'] as String? ?? 'normal',
      routingPath: path,
      hops: json['hops'] as int? ?? 1,
      timestamp: json['timestamp'] != null 
          ? DateTime.parse(json['timestamp'] as String) 
          : DateTime.now(),
      isDelivered: json['isDelivered'] as bool? ?? json['is_delivered'] as bool? ?? false,
      encrypted: json['encrypted'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'senderId': senderId,
      'receiverId': receiverId,
      'content': content,
      'messageType': messageType,
      'routingPath': routingPath,
      'hops': hops,
      'timestamp': timestamp.toIso8601String(),
      'isDelivered': isDelivered,
      'encrypted': encrypted,
    };
  }

  // Get content decrypted if E2EE format, otherwise normal content
  String getDecryptedContent(String currentUserId) {
    if (content.startsWith('[E2EE-ENCRYPTED]:')) {
      final base64Data = content.substring('[E2EE-ENCRYPTED]:'.length);
      // Decrypt if current user is sender or receiver
      if (senderId == currentUserId || receiverId == currentUserId) {
        try {
          return utf8.decode(base64.decode(base64Data.trim()));
        } catch (_) {
          return 'Error decrypting message';
        }
      } else {
        // Scrambled for others
        return base64Data.length > 32 
            ? '${base64Data.substring(0, 32)}...' 
            : base64Data;
      }
    }
    return content;
  }

  bool isEncrypted() {
    return content.startsWith('[E2EE-ENCRYPTED]:') || encrypted;
  }
}
