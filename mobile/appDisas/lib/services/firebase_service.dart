import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class FirebaseService {
  bool isFirebaseEnabled = false;
  FirebaseAuth? _auth;
  FirebaseMessaging? _messaging;

  FirebaseService() {
    _init();
  }

  Future<void> _init() async {
    try {
      // Initialize Firebase core.
      // This will throw if configurations (google-services.json/plist) are missing.
      await Firebase.initializeApp();
      _auth = FirebaseAuth.instance;
      _messaging = FirebaseMessaging.instance;
      isFirebaseEnabled = true;
      print('FirebaseService: Firebase successfully initialized.');
      _setupFCM();
    } catch (e) {
      isFirebaseEnabled = false;
      print('FirebaseService: Firebase initialization failed ($e). Operating in Offline Sandbox mode.');
    }
  }

  // Set up Firebase Cloud Messaging
  Future<void> _setupFCM() async {
    if (_messaging == null) return;

    try {
      // Request notification permission
      NotificationSettings settings = await _messaging!.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        print('FirebaseService: User granted push notification permission.');
      }

      // Foreground message stream handler
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        print("FCM Foreground Message: ${message.notification?.title} - ${message.notification?.body}");
      });

      // Token setup for push notification targeting
      String? token = await _messaging!.getToken();
      print("FCM Registration Token: $token");
    } catch (e) {
      print('FirebaseService: Failed setting up FCM: $e');
    }
  }

  // Sign In
  Future<Map<String, dynamic>> signIn(String email, String password) async {
    if (isFirebaseEnabled && _auth != null) {
      final credential = await _auth!.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      return {
        'uid': credential.user?.uid ?? 'unknown_uid',
        'email': credential.user?.email ?? email,
        'displayName': credential.user?.displayName ?? email.split('@')[0],
      };
    } else {
      // Sandbox mode login fallback
      await Future.delayed(const Duration(milliseconds: 600)); // Simulate delay
      return {
        'uid': 'mock_${email.split('@')[0].toLowerCase()}',
        'email': email,
        'displayName': email.split('@')[0],
      };
    }
  }

  // Sign Up
  Future<Map<String, dynamic>> signUp(String email, String password, String name) async {
    if (isFirebaseEnabled && _auth != null) {
      final credential = await _auth!.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      await credential.user?.updateDisplayName(name);
      return {
        'uid': credential.user?.uid ?? 'unknown_uid',
        'email': credential.user?.email ?? email,
        'displayName': name,
      };
    } else {
      // Sandbox mode signup fallback
      await Future.delayed(const Duration(milliseconds: 600)); // Simulate delay
      return {
        'uid': 'mock_${name.toLowerCase().replaceAll(' ', '_')}',
        'email': email,
        'displayName': name,
      };
    }
  }

  // Sign Out
  Future<void> signOut() async {
    if (isFirebaseEnabled && _auth != null) {
      await _auth!.signOut();
    }
  }
}
