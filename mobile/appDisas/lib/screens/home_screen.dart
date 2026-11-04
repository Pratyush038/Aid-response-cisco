import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'dart:async';
import '../providers/auth_provider.dart';
import '../providers/network_provider.dart';
import '../services/location_service.dart';
import '../widgets/glass_card.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> with SingleTickerProviderStateMixin {
  late AnimationController _holdController;
  final _locationService = LocationService();
  bool _isBroadcasting = false;
  Map<String, dynamic>? _lastBroadcastResult;

  @override
  void initState() {
    super.initState();
    _holdController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2), // 2-second hold trigger
    );

    _holdController.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _triggerEmergencySOS();
        _holdController.reset();
      }
    });
  }

  @override
  void dispose() {
    _holdController.dispose();
    super.dispose();
  }

  Future<void> _triggerEmergencySOS() async {
    setState(() {
      _isBroadcasting = true;
      _lastBroadcastResult = null;
    });

    try {
      final pos = await _locationService.determinePosition();
      final networkNotifier = ref.read(networkProvider.notifier);

      final result = await networkNotifier.sendSosBroadcast(
        latitude: pos.latitude,
        longitude: pos.longitude,
        content: "EMERGENCY: SOS panic broadcasted from mobile client!",
      );

      setState(() {
        _lastBroadcastResult = result;
        _isBroadcasting = false;
      });

      // Show the triage result immediately in a premium Bottom Sheet
      _showTriageReport();
    } catch (e) {
      setState(() {
        _isBroadcasting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('SOS Broadcast Failed: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  void _showTriageReport() {
    if (_lastBroadcastResult == null) return;
    
    final sosEvent = _lastBroadcastResult!['sosEvent'] ?? {};
    final ciscoUplink = _lastBroadcastResult!['ciscoUplink'];
    final recipients = _lastBroadcastResult!['recipientCount'] ?? 0;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            return GlassCard(
              borderRadius: 24,
              borderColor: Colors.redAccent.withOpacity(0.3),
              gradientColors: [
                const Color(0xFF1E0A0A).withOpacity(0.95),
                const Color(0xFF0F0505).withOpacity(0.98),
              ],
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: ListView(
                controller: scrollController,
                children: [
                  Center(
                    child: Container(
                      width: 50,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.redAccent.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.notifications_active, color: Colors.redAccent, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'SOS BROADCAST COMPLETED',
                              style: GoogleFonts.outfit(
                                color: Colors.redAccent,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.0,
                              ),
                            ),
                            Text(
                              'Routed to $recipients online mesh nodes',
                              style: const TextStyle(color: Colors.white70, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Divider(color: Colors.white10, height: 24),
                  
                  // Coordinate detail
                  Row(
                    children: [
                      const Icon(Icons.location_on, color: Colors.redAccent, size: 16),
                      const SizedBox(width: 8),
                      Text(
                        'Location: ${(sosEvent['latitude'] as num?)?.toStringAsFixed(4) ?? '0.0000'}, ${(sosEvent['longitude'] as num?)?.toStringAsFixed(4) ?? '0.0000'}',
                        style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 13),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Groq AI Crisis Analysis Card
                  if (sosEvent['aiSummary'] != null) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6B4EFF).withOpacity(0.08),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF6B4EFF).withOpacity(0.3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.psychology, color: Color(0xFF9F8BFF), size: 20),
                              const SizedBox(width: 8),
                              Text(
                                'GROQ AI CRISIS ANALYSIS',
                                style: GoogleFonts.outfit(
                                  color: const Color(0xFF9F8BFF),
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.0,
                                ),
                              ),
                              const Spacer(),
                              if (sosEvent['aiProvider'] != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF6B4EFF).withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    sosEvent['aiProvider'].toString().toUpperCase(),
                                    style: const TextStyle(color: Color(0xFFBFB3FF), fontSize: 9, fontFamily: 'monospace'),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            sosEvent['aiSummary'],
                            style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.5),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Cisco Cloud Uplink Card
                  if (ciscoUplink != null) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF007AFF).withOpacity(0.06),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF007AFF).withOpacity(0.25)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.cloud_done, color: Color(0xFF30D158), size: 20),
                              const SizedBox(width: 8),
                              Text(
                                'CISCO MERAKI UPLINK GATEWAY',
                                style: GoogleFonts.outfit(
                                  color: const Color(0xFF30D158),
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.0,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            '☁ Connected through: ${ciscoUplink['gatewayName'] ?? 'MG52 Gateway'}',
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Uplink route verified over LTE backhaul. Webex Crisis Response Space alerted with Groq situation payload. Meraki IoT Telemetry synchronized.',
                            style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.orange.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.orange.withOpacity(0.25)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.wifi_off, color: Colors.orangeAccent, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'OFFLINE MESH PROPAGATION',
                                style: TextStyle(color: Colors.orangeAccent, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                              ),
                            ],
                          ),
                          SizedBox(height: 8),
                          Text(
                            'No Cisco Cloud backhaul gateway detected nearby. Broadcast is operating strictly over offline local LoRa peer routing protocols.',
                            style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),

                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white.withOpacity(0.1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: Colors.white.withOpacity(0.1)),
                      ),
                    ),
                    child: const Text('DISMISS HUD'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final network = ref.watch(networkProvider);

    // Calculate network stats reactively
    final totalNodes = network.nodes.length;
    final onlineNodes = network.nodes.where((n) => n.isOnline).length;
    final activeConns = network.connections.where((c) => c.isActive).length;
    
    // Average Latency
    final activeList = network.connections.where((c) => c.isActive).toList();
    final avgLatency = activeList.isNotEmpty 
        ? (activeList.map((c) => c.latency).reduce((a, b) => a + b) / activeList.length).round()
        : 0;

    return Scaffold(
      backgroundColor: const Color(0xFF090D16),
      body: Stack(
        children: [
          // Background Glows
          Positioned(
            top: 200,
            left: MediaQuery.of(context).size.width / 2 - 150,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _holdController.isAnimating || _isBroadcasting
                    ? Colors.redAccent.withOpacity(0.12)
                    : const Color(0xFF007AFF).withOpacity(0.04),
              ),
            ).animate(target: _holdController.value).scale(begin: const Offset(1, 1), end: const Offset(1.3, 1.3)),
          ),

          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Bar Row
                  Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            auth.displayName?.toUpperCase() ?? 'OFFLINE NODE',
                            style: GoogleFonts.outfit(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.0,
                            ),
                          ),
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: network.isSseConnected ? const Color(0xFF30D158) : Colors.orangeAccent,
                                  boxShadow: [
                                    BoxShadow(
                                      color: (network.isSseConnected ? const Color(0xFF30D158) : Colors.orangeAccent).withOpacity(0.5),
                                      blurRadius: 4,
                                      spreadRadius: 1,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                network.isSseConnected ? 'SSE Live Link' : 'Polling Mesh Feed',
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.6),
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () => ref.read(authProvider.notifier).logout(),
                        icon: const Icon(Icons.logout, color: Colors.white60),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Connection HUD Cards Row
                  Row(
                    children: [
                      Expanded(
                        child: GlassCard(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.dns, color: Color(0xFF007AFF), size: 20),
                              const SizedBox(height: 8),
                              Text(
                                '$onlineNodes / $totalNodes',
                                style: GoogleFonts.outfit(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const Text('Mesh Nodes Online', style: TextStyle(color: Colors.white54, fontSize: 10)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: GlassCard(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.settings_ethernet, color: Color(0xFF007AFF), size: 20),
                              const SizedBox(height: 8),
                              Text(
                                '$activeConns links',
                                style: GoogleFonts.outfit(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const Text('Active Topology', style: TextStyle(color: Colors.white54, fontSize: 10)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: GlassCard(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.speed, color: Color(0xFF007AFF), size: 20),
                              const SizedBox(height: 8),
                              Text(
                                '${avgLatency}ms',
                                style: GoogleFonts.outfit(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const Text('Avg Hop Latency', style: TextStyle(color: Colors.white54, fontSize: 10)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),

                  // Pulsing SOS Panic Center
                  Center(
                    child: GestureDetector(
                      onTapDown: (_) {
                        if (!_isBroadcasting) _holdController.forward();
                      },
                      onTapUp: (_) {
                        if (_holdController.value < 1.0) _holdController.reverse();
                      },
                      onTapCancel: () {
                        if (_holdController.value < 1.0) _holdController.reverse();
                      },
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Glowing rings
                          if (!_isBroadcasting)
                            ...List.generate(3, (index) {
                              final delay = index * 400;
                              return Container(
                                width: 180,
                                height: 180,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.redAccent.withOpacity(0.15),
                                    width: 1.5,
                                  ),
                                ),
                              ).animate(onPlay: (controller) => controller.repeat())
                               .scale(
                                 duration: 1.6.seconds,
                                 delay: delay.ms,
                                 begin: const Offset(1, 1),
                                 end: const Offset(1.8, 1.8),
                               )
                               .fadeOut(duration: 1.6.seconds);
                            }),

                          // Holds progress indicator border
                          AnimatedBuilder(
                            animation: _holdController,
                            builder: (context, child) {
                              return SizedBox(
                                width: 200,
                                height: 200,
                                child: CircularProgressIndicator(
                                  value: _holdController.value,
                                  strokeWidth: 4,
                                  backgroundColor: Colors.white.withOpacity(0.05),
                                  valueColor: const AlwaysStoppedAnimation<Color>(Colors.redAccent),
                                ),
                              );
                            },
                          ),

                          // Inner Solid Core Panic Button
                          Container(
                            width: 170,
                            height: 170,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  Color(0xFFFF453A),
                                  Color(0xFFFF3B30),
                                  Color(0xFF8B0000),
                                ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.redAccent.withOpacity(0.35),
                                  blurRadius: 20,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                            child: Center(
                              child: _isBroadcasting
                                  ? const CircularProgressIndicator(valueColor: AlwaysStoppedAnimation(Colors.white))
                                  : Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        const Icon(Icons.gavel, color: Colors.white, size: 36),
                                        const SizedBox(height: 8),
                                        Text(
                                          'SOS',
                                          style: GoogleFonts.outfit(
                                            color: Colors.white,
                                            fontSize: 32,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 2.0,
                                          ),
                                        ),
                                        Text(
                                          'HOLD TO PANIC',
                                          style: GoogleFonts.inter(
                                            color: Colors.white70,
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 1.0,
                                          ),
                                        ),
                                      ],
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const Spacer(),
                  
                  // Instruction banner
                  Center(
                    child: Text(
                      _isBroadcasting 
                          ? 'BROADCASTING EMERGENCY TOPOLOGY...'
                          : _holdController.isAnimating
                              ? 'HOLDING TO CONFIRM SOS...'
                              : 'SECURE ENCRYPTED NODE ACTIVE',
                      style: GoogleFonts.inter(
                        color: _isBroadcasting || _holdController.isAnimating 
                            ? Colors.redAccent
                            : Colors.white.withOpacity(0.4),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.0,
                      ),
                    ),
                  ).animate(
                    target: (_isBroadcasting || _holdController.isAnimating) ? 1 : 0
                  ).shimmer(duration: 1.seconds),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
