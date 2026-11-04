import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/node.dart';
import '../services/api_service.dart';
import '../services/firebase_service.dart';

class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final String? error;
  final String? uid;
  final String? email;
  final String? displayName;
  final String serverUrl;
  final NetworkNode? registeredNode;
  final bool isSandboxMode;

  AuthState({
    this.isAuthenticated = false,
    this.isLoading = false,
    this.error,
    this.uid,
    this.email,
    this.displayName,
    this.serverUrl = 'http://localhost:5000',
    this.registeredNode,
    this.isSandboxMode = false,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    String? error,
    String? uid,
    String? email,
    String? displayName,
    String? serverUrl,
    NetworkNode? registeredNode,
    bool? isSandboxMode,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      uid: uid ?? this.uid,
      email: email ?? this.email,
      displayName: displayName ?? this.displayName,
      serverUrl: serverUrl ?? this.serverUrl,
      registeredNode: registeredNode ?? this.registeredNode,
      isSandboxMode: isSandboxMode ?? this.isSandboxMode,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final FirebaseService _firebaseService = FirebaseService();
  late ApiService _apiService;

  AuthNotifier() : super(AuthState()) {
    _loadSettings();
  }

  ApiService get apiService => _apiService;

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    // Default to localhost:5000, but configure for Android emulator if needed (10.0.2.2)
    final savedUrl = prefs.getString('server_url') ?? 'http://10.0.2.2:5000';
    _apiService = ApiService(baseUrl: savedUrl);
    
    final savedUid = prefs.getString('user_uid');
    final savedEmail = prefs.getString('user_email');
    final savedName = prefs.getString('user_name');
    final isSandbox = prefs.getBool('is_sandbox') ?? !_firebaseService.isFirebaseEnabled;

    if (savedUid != null) {
      state = AuthState(
        isAuthenticated: true,
        uid: savedUid,
        email: savedEmail,
        displayName: savedName,
        serverUrl: savedUrl,
        isSandboxMode: isSandbox,
      );
    } else {
      state = AuthState(
        serverUrl: savedUrl,
        isSandboxMode: isSandbox,
      );
    }
  }

  Future<void> updateServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', url);
    _apiService.baseUrl = url;
    state = state.copyWith(serverUrl: url);
  }

  Future<void> setSandboxMode(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('is_sandbox', value);
    state = state.copyWith(isSandboxMode: value);
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final Map<String, dynamic> user;
      if (state.isSandboxMode) {
        await Future.delayed(const Duration(milliseconds: 600));
        user = {
          'uid': 'mock_${email.split('@')[0].toLowerCase()}',
          'email': email,
          'displayName': email.split('@')[0],
        };
      } else {
        user = await _firebaseService.signIn(email, password);
      }
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_uid', user['uid']!);
      await prefs.setString('user_email', user['email']!);
      await prefs.setString('user_name', user['displayName']!);
      await prefs.setBool('is_sandbox', state.isSandboxMode);

      state = state.copyWith(
        isAuthenticated: true,
        isLoading: false,
        uid: user['uid'],
        email: user['email'],
        displayName: user['displayName'],
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> register(String email, String password, String name, double latitude, double longitude) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final Map<String, dynamic> user;
      if (state.isSandboxMode) {
        await Future.delayed(const Duration(milliseconds: 600));
        user = {
          'uid': 'mock_${name.toLowerCase().replaceAll(' ', '_')}',
          'email': email,
          'displayName': name,
        };
      } else {
        user = await _firebaseService.signUp(email, password, name);
      }
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_uid', user['uid']!);
      await prefs.setString('user_email', user['email']!);
      await prefs.setString('user_name', user['displayName']!);
      await prefs.setBool('is_sandbox', state.isSandboxMode);

      state = state.copyWith(
        isAuthenticated: true,
        isLoading: false,
        uid: user['uid'],
        email: user['email'],
        displayName: user['displayName'],
      );

      // Automatically register the mobile device as an active node on the mesh network
      await registerMeshNode(latitude, longitude);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> registerMeshNode(double latitude, double longitude) async {
    if (!state.isAuthenticated) return;
    
    try {
      final node = NetworkNode(
        nodeId: state.uid!,
        name: state.displayName!,
        latitude: latitude,
        longitude: longitude,
        isOnline: true,
        signalStrength: 100,
        role: 'standard',
        lastSeen: DateTime.now(),
      );

      NetworkNode registered;
      if (state.isSandboxMode) {
        registered = node;
      } else {
        registered = await _apiService.registerNode(node);
      }

      state = state.copyWith(registeredNode: registered);
      print('AuthNotifier: Node registered on mesh network successfully.');
    } catch (e) {
      print('AuthNotifier: Failed to register mesh node: $e');
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user_uid');
    await prefs.remove('user_email');
    await prefs.remove('user_name');
    await prefs.remove('is_sandbox');
    
    await _firebaseService.signOut();
    state = AuthState(serverUrl: state.serverUrl);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
