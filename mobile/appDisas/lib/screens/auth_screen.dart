import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../providers/auth_provider.dart';
import '../services/location_service.dart';
import '../widgets/glass_card.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _serverUrlController = TextEditingController();
  final _locationService = LocationService();

  bool _isLogin = true;
  bool _showSettings = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      _serverUrlController.text = ref.read(authProvider).serverUrl;
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _serverUrlController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    FocusScope.of(context).unfocus();
    
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    final name = _nameController.text.trim();

    final authNotifier = ref.read(authProvider.notifier);

    if (_isLogin) {
      await authNotifier.login(email, password);
    } else {
      // For registration, we fetch coordinates to register node immediately
      try {
        final pos = await _locationService.determinePosition();
        await authNotifier.register(email, password, name, pos.latitude, pos.longitude);
      } catch (e) {
        // Fallback to default coordinates if location fails
        await authNotifier.register(
          email, 
          password, 
          name, 
          LocationService.defaultLatitude, 
          LocationService.defaultLongitude,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authProvider);

    // Show error toast if any
    if (state.error != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(state.error!),
            backgroundColor: Colors.redAccent,
          ),
        );
      });
    }

    return Scaffold(
      backgroundColor: const Color(0xFF090D16),
      body: Stack(
        children: [
          // Background Gradient Blobs
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF007AFF).withOpacity(0.12),
              ),
            ),
          ).animate().fadeIn(duration: 1.seconds).scale(begin: const Offset(0.8, 0.8)),
          Positioned(
            bottom: -80,
            right: -80,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFFF3B30).withOpacity(0.08),
              ),
            ),
          ).animate().fadeIn(duration: 1.seconds, delay: 200.ms).scale(begin: const Offset(0.8, 0.8)),

          // Foreground Content
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header Logo
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(16.0),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFFFF3B30).withOpacity(0.1),
                          border: Border.all(
                            color: const Color(0xFFFF3B30).withOpacity(0.3),
                            width: 1.5,
                          ),
                        ),
                        child: const Icon(
                          Icons.radar,
                          size: 48,
                          color: Color(0xFFFF3B30),
                        ),
                      ).animate(onPlay: (controller) => controller.repeat(reverse: true))
                       .shimmer(duration: 2.seconds, color: Colors.white.withOpacity(0.2)),
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: Text(
                        'AID-RESPONSE',
                        style: GoogleFonts.outfit(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2.0,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    Center(
                      child: Text(
                        'Offline Mesh Emergency Link',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: Colors.white.withOpacity(0.6),
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Auth Form Card
                    GlassCard(
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Tabs switcher
                            Row(
                              children: [
                                Expanded(
                                  child: GestureDetector(
                                    onTap: () => setState(() => _isLogin = true),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        border: Border(
                                          bottom: BorderSide(
                                            color: _isLogin 
                                                ? const Color(0xFF007AFF) 
                                                : Colors.transparent,
                                            width: 2.0,
                                          ),
                                        ),
                                      ),
                                      child: Text(
                                        'Login',
                                        style: GoogleFonts.inter(
                                          fontSize: 16,
                                          fontWeight: _isLogin ? FontWeight.bold : FontWeight.normal,
                                          color: _isLogin ? Colors.white : Colors.white.withOpacity(0.5),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: GestureDetector(
                                    onTap: () => setState(() => _isLogin = false),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        border: Border(
                                          bottom: BorderSide(
                                            color: !_isLogin 
                                                ? const Color(0xFF007AFF) 
                                                : Colors.transparent,
                                            width: 2.0,
                                          ),
                                        ),
                                      ),
                                      child: Text(
                                        'Register',
                                        style: GoogleFonts.inter(
                                          fontSize: 16,
                                          fontWeight: !_isLogin ? FontWeight.bold : FontWeight.normal,
                                          color: !_isLogin ? Colors.white : Colors.white.withOpacity(0.5),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),

                            // Name field (Sign Up only)
                            if (!_isLogin) ...[
                              TextFormField(
                                controller: _nameController,
                                style: const TextStyle(color: Colors.white),
                                decoration: InputDecoration(
                                  labelText: 'Node/User Name',
                                  labelStyle: TextStyle(color: Colors.white.withOpacity(0.6)),
                                  prefixIcon: const Icon(Icons.person, color: Color(0xFF007AFF)),
                                  enabledBorder: OutlineInputBorder(
                                    borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderSide: const BorderSide(color: Color(0xFF007AFF)),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  filled: true,
                                  fillColor: Colors.white.withOpacity(0.02),
                                ),
                                validator: (value) {
                                  if (value == null || value.trim().isEmpty) {
                                    return 'Please enter a name';
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Email
                            TextFormField(
                              controller: _emailController,
                              style: const TextStyle(color: Colors.white),
                              keyboardType: TextInputType.emailAddress,
                              decoration: InputDecoration(
                                labelText: 'Email Address',
                                labelStyle: TextStyle(color: Colors.white.withOpacity(0.6)),
                                prefixIcon: const Icon(Icons.email, color: Color(0xFF007AFF)),
                                enabledBorder: OutlineInputBorder(
                                  borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: const BorderSide(color: Color(0xFF007AFF)),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                filled: true,
                                fillColor: Colors.white.withOpacity(0.02),
                              ),
                              validator: (value) {
                                if (value == null || !value.contains('@')) {
                                  return 'Please enter a valid email';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),

                            // Password
                            TextFormField(
                              controller: _passwordController,
                              style: const TextStyle(color: Colors.white),
                              obscureText: true,
                              decoration: InputDecoration(
                                labelText: 'Password',
                                labelStyle: TextStyle(color: Colors.white.withOpacity(0.6)),
                                prefixIcon: const Icon(Icons.lock, color: Color(0xFF007AFF)),
                                enabledBorder: OutlineInputBorder(
                                  borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: const BorderSide(color: Color(0xFF007AFF)),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                filled: true,
                                fillColor: Colors.white.withOpacity(0.02),
                              ),
                              validator: (value) {
                                if (value == null || value.length < 6) {
                                  return 'Password must be at least 6 characters';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 24),

                            // Submit Button
                            ElevatedButton(
                              onPressed: state.isLoading ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF007AFF),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: state.isLoading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor: AlwaysStoppedAnimation(Colors.white),
                                      ),
                                    )
                                  : Text(
                                      _isLogin ? 'CONNECT TO MESH' : 'REGISTER AS NODE',
                                      style: GoogleFonts.inter(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 1.0,
                                      ),
                                    ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Settings trigger
                    TextButton.icon(
                      onPressed: () => setState(() => _showSettings = !_showSettings),
                      icon: const Icon(Icons.settings, color: Colors.white60),
                      label: Text(
                        'Mesh Gateway Configuration',
                        style: TextStyle(color: Colors.white.withOpacity(0.6)),
                      ),
                    ),

                    if (_showSettings) ...[
                      const SizedBox(height: 8),
                      GlassCard(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Express Server Endpoint',
                              style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _serverUrlController,
                                    style: const TextStyle(color: Colors.white, fontSize: 13),
                                    decoration: InputDecoration(
                                      isDense: true,
                                      enabledBorder: UnderlineInputBorder(
                                        borderSide: BorderSide(color: Colors.white.withOpacity(0.2)),
                                      ),
                                      focusedBorder: const UnderlineInputBorder(
                                        borderSide: BorderSide(color: Color(0xFF007AFF)),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                ElevatedButton(
                                  onPressed: () async {
                                    final url = _serverUrlController.text.trim();
                                    if (url.isNotEmpty) {
                                      await ref.read(authProvider.notifier).updateServerUrl(url);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Endpoint updated to $url')),
                                      );
                                    }
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF007AFF).withOpacity(0.2),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  ),
                                  child: const Text('Save', style: TextStyle(color: Colors.white)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '💡 Android emulator maps localhost as 10.0.2.2:5000\n💡 Real devices and iOS simulators map localhost as localhost:5000 or the local IP address.',
                              style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
                            ),
                            const Divider(color: Colors.white10, height: 16),
                            SwitchListTile(
                              title: const Text(
                                'Local Sandbox Mode',
                                style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                              ),
                              subtitle: const Text(
                                'Bypasses Firebase Authentication for offline mesh simulation',
                                style: TextStyle(color: Colors.white54, fontSize: 10),
                              ),
                              value: state.isSandboxMode,
                              onChanged: (val) {
                                ref.read(authProvider.notifier).setSandboxMode(val);
                              },
                              activeColor: const Color(0xFF007AFF),
                              contentPadding: EdgeInsets.zero,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
