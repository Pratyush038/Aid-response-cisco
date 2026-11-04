import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/node.dart';
import '../models/connection.dart';
import '../models/message.dart';
import '../models/sos_event.dart';

class ApiService {
  String baseUrl;

  ApiService({this.baseUrl = 'http://localhost:5000'});

  // Helper for requests
  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
  };

  // Node registration: POST /api/nodes
  Future<NetworkNode> registerNode(NetworkNode node) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/nodes'),
      headers: _headers,
      body: jsonEncode(node.toJson()),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return NetworkNode.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to register node: ${response.body}');
    }
  }

  // Fetch nodes: GET /api/nodes
  Future<List<NetworkNode>> fetchNodes() async {
    final response = await http.get(Uri.parse('$baseUrl/api/nodes'));

    if (response.statusCode == 200) {
      final List<dynamic> list = jsonDecode(response.body);
      return list.map((item) => NetworkNode.fromJson(item)).toList();
    } else {
      throw Exception('Failed to fetch nodes');
    }
  }

  // Fetch connections: GET /api/connections
  Future<List<NetworkConnection>> fetchConnections() async {
    final response = await http.get(Uri.parse('$baseUrl/api/connections'));

    if (response.statusCode == 200) {
      final List<dynamic> list = jsonDecode(response.body);
      return list.map((item) => NetworkConnection.fromJson(item)).toList();
    } else {
      throw Exception('Failed to fetch connections');
    }
  }

  // Send Direct Message: POST /api/messages/direct (for users) or POST /api/messages (for nodes)
  Future<Message> sendDirectMessage({
    required String senderId,
    required String receiverId,
    required String content,
    required List<String> routingPath,
    required bool isUserTarget,
  }) async {
    final Map<String, dynamic> body;
    final String endpoint;

    if (isUserTarget) {
      // E2EE for civilian-to-civilian text
      final encryptedContent = '[E2EE-ENCRYPTED]:${base64.encode(utf8.encode(content))}';
      endpoint = '$baseUrl/api/messages/direct';
      body = {
        'senderId': senderId,
        'receiverId': receiverId,
        'content': encryptedContent,
        'routingPath': routingPath,
        'hops': routingPath.length,
      };
    } else {
      // Standard messages to hardware nodes
      endpoint = '$baseUrl/api/messages';
      body = {
        'senderId': senderId,
        'receiverId': receiverId,
        'content': content,
        'messageType': 'normal',
        'routingPath': routingPath,
        'hops': routingPath.length - 1,
      };
    }

    final response = await http.post(
      Uri.parse(endpoint),
      headers: _headers,
      body: jsonEncode(body),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return Message.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to send message: ${response.body}');
    }
  }

  // Fetch messages: GET /api/messages
  Future<List<Message>> fetchMessages() async {
    final response = await http.get(Uri.parse('$baseUrl/api/messages'));

    if (response.statusCode == 200) {
      final List<dynamic> list = jsonDecode(response.body);
      return list.map((item) => Message.fromJson(item)).toList();
    } else {
      throw Exception('Failed to fetch messages');
    }
  }

  // Trigger SOS broadcast: POST /api/sos
  Future<Map<String, dynamic>> triggerSOS({
    required String senderId,
    required double latitude,
    required double longitude,
    required String content,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/sos'),
      headers: _headers,
      body: jsonEncode({
        'senderId': senderId,
        'location': {
          'latitude': latitude,
          'longitude': longitude,
        },
        'content': content,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else {
      throw Exception('Failed to broadcast SOS: ${response.body}');
    }
  }

  // Resolve SOS event: PATCH /api/sos/events/:id/resolve
  Future<void> resolveSOS(int id) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/api/sos/events/$id/resolve'),
      headers: _headers,
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to resolve SOS event');
    }
  }

  // Fetch SOS events: GET /api/sos/events
  Future<List<SosEvent>> fetchSosEvents() async {
    final response = await http.get(Uri.parse('$baseUrl/api/sos/events'));

    if (response.statusCode == 200) {
      final List<dynamic> list = jsonDecode(response.body);
      return list.map((item) => SosEvent.fromJson(item)).toList();
    } else {
      throw Exception('Failed to fetch SOS events');
    }
  }

  // Clear messages: DELETE /api/messages
  Future<void> clearAllMessages() async {
    final response = await http.delete(Uri.parse('$baseUrl/api/messages'));
    if (response.statusCode != 200) {
      throw Exception('Failed to clear messages');
    }
  }
}
