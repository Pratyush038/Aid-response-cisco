import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_provider.dart';
import '../models/node.dart';
import '../models/connection.dart';
import '../models/message.dart';
import '../models/sos_event.dart';
import '../services/sse_service.dart';
import '../services/dijkstra_router.dart';

class NetworkState {
  final List<NetworkNode> nodes;
  final List<NetworkConnection> connections;
  final List<Message> messages;
  final List<SosEvent> sosEvents;
  final bool isLoading;
  final String? error;
  final bool isSseConnected;

  NetworkState({
    this.nodes = const [],
    this.connections = const [],
    this.messages = const [],
    this.sosEvents = const [],
    this.isLoading = false,
    this.error,
    this.isSseConnected = false,
  });

  NetworkState copyWith({
    List<NetworkNode>? nodes,
    List<NetworkConnection>? connections,
    List<Message>? messages,
    List<SosEvent>? sosEvents,
    bool? isLoading,
    String? error,
    bool? isSseConnected,
  }) {
    return NetworkState(
      nodes: nodes ?? this.nodes,
      connections: connections ?? this.connections,
      messages: messages ?? this.messages,
      sosEvents: sosEvents ?? this.sosEvents,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      isSseConnected: isSseConnected ?? this.isSseConnected,
    );
  }
}

class NetworkNotifier extends StateNotifier<NetworkState> {
  final Ref _ref;
  SseService? _sseService;
  StreamSubscription<SseEvent>? _sseSubscription;
  Timer? _pollingTimer;

  NetworkNotifier(this._ref) : super(NetworkState()) {
    // Listen to auth state changes to start/stop network services
    _ref.listen(authProvider, (previous, next) {
      if (next.isAuthenticated) {
        fetchNetworkTopology();
        _setupEventChannel(next.serverUrl);
      } else {
        _cleanup();
      }
    });
  }

  void _cleanup() {
    _sseSubscription?.cancel();
    _sseService?.dispose();
    _pollingTimer?.cancel();
    _sseSubscription = null;
    _sseService = null;
    _pollingTimer = null;
    state = NetworkState();
  }

  // Fetch complete network topology from server
  Future<void> fetchNetworkTopology() async {
    final auth = _ref.read(authProvider);
    if (!auth.isAuthenticated) return;

    if (state.nodes.isEmpty) {
      state = state.copyWith(isLoading: true, error: null);
    }

    try {
      final api = _ref.read(authProvider.notifier).apiService;
      final nodes = await api.fetchNodes();
      final connections = await api.fetchConnections();
      final messages = await api.fetchMessages();
      final sosEvents = await api.fetchSosEvents();

      state = state.copyWith(
        nodes: nodes,
        connections: connections,
        messages: messages,
        sosEvents: sosEvents,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  // Setup SSE Listener
  void _setupEventChannel(String serverUrl) {
    _sseSubscription?.cancel();
    _sseService?.dispose();
    _pollingTimer?.cancel();

    _sseService = SseService(baseUrl: serverUrl);
    
    _sseSubscription = _sseService!.eventStream.listen(
      (event) {
        state = state.copyWith(isSseConnected: true);
        if (event.event == 'sos') {
          // New SOS Alert Broadcasted
          print('SSE Alert: New SOS broadcast received!');
          fetchNetworkTopology(); // Refresh topology immediately
        } else if (event.event == 'sos-resolved') {
          print('SSE Alert: SOS event resolved!');
          fetchNetworkTopology();
        }
      },
      onError: (err) {
        state = state.copyWith(isSseConnected: false);
        print('SSE Error: $err. Falling back to background polling.');
      },
      onDone: () {
        state = state.copyWith(isSseConnected: false);
      }
    );

    // Run active polling interval (every 3 seconds) as backup to handle SSE disconnects
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      fetchNetworkTopology();
    });
  }

  // Send Direct Message using Dijkstra routing paths
  Future<void> sendMessage({required String receiverId, required String content, required bool isUser}) async {
    final auth = _ref.read(authProvider);
    if (!auth.isAuthenticated) return;

    try {
      final senderId = auth.uid!;
      
      // Calculate Dijkstra optimal route from user's registered node
      final userNodeId = auth.registeredNode?.nodeId ?? 'user';
      
      // Target node ID: if sending to user, find their nearest node
      String targetNodeId = receiverId;

      final routeResult = DijkstraRouter.findShortestPath(state.nodes, state.connections, userNodeId, targetNodeId);
      final routingPath = routeResult?.path ?? [userNodeId, targetNodeId];

      final api = _ref.read(authProvider.notifier).apiService;
      final newMessage = await api.sendDirectMessage(
        senderId: senderId,
        receiverId: receiverId,
        content: content,
        routingPath: routingPath,
        isUserTarget: isUser,
      );

      // Append message locally for instant latency-free rendering
      state = state.copyWith(
        messages: [...state.messages, newMessage],
      );

      fetchNetworkTopology();
    } catch (e) {
      print('NetworkNotifier: Send Message failed ($e)');
      rethrow;
    }
  }

  // Trigger "Big Red Button" SOS Broadcast
  Future<Map<String, dynamic>> sendSosBroadcast({required double latitude, required double longitude, required String content}) async {
    final auth = _ref.read(authProvider);
    if (!auth.isAuthenticated) throw Exception('Not authenticated');

    try {
      final api = _ref.read(authProvider.notifier).apiService;
      final result = await api.triggerSOS(
        senderId: auth.uid!,
        latitude: latitude,
        longitude: longitude,
        content: content,
      );

      fetchNetworkTopology(); // Sync all created broadcast message rows
      return result;
    } catch (e) {
      print('NetworkNotifier: SOS trigger failed ($e)');
      rethrow;
    }
  }

  // Resolve SOS Event
  Future<void> resolveSos(int id) async {
    final auth = _ref.read(authProvider);
    if (!auth.isAuthenticated) return;

    try {
      final api = _ref.read(authProvider.notifier).apiService;
      await api.resolveSOS(id);
      fetchNetworkTopology();
    } catch (e) {
      print('NetworkNotifier: SOS resolution failed ($e)');
    }
  }

  // Clear Chats
  Future<void> clearAllMessages() async {
    final auth = _ref.read(authProvider);
    if (!auth.isAuthenticated) return;

    try {
      final api = _ref.read(authProvider.notifier).apiService;
      await api.clearAllMessages();
      state = state.copyWith(messages: []);
    } catch (e) {
      print('NetworkNotifier: Clear messages failed ($e)');
    }
  }

  @override
  void dispose() {
    _cleanup();
    super.dispose();
  }
}

final networkProvider = StateNotifierProvider<NetworkNotifier, NetworkState>((ref) {
  return NetworkNotifier(ref);
});
