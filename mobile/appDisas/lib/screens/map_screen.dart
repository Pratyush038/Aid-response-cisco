import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../providers/auth_provider.dart';
import '../providers/network_provider.dart';
import '../services/location_service.dart';
import '../widgets/glass_card.dart';

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final MapController _mapController = MapController();
  final _locationService = LocationService();

  Future<void> _centerOnUser() async {
    try {
      final pos = await _locationService.determinePosition();
      _mapController.move(LatLng(pos.latitude, pos.longitude), 15.0);
    } catch (e) {
      // Fallback
      _mapController.move(
        const LatLng(LocationService.defaultLatitude, LocationService.defaultLongitude), 
        15.0,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final network = ref.watch(networkProvider);

    final currentUserId = auth.uid ?? 'user';
    final userLat = auth.registeredNode?.latitude ?? LocationService.defaultLatitude;
    final userLng = auth.registeredNode?.longitude ?? LocationService.defaultLongitude;

    // Create a fast lookup map of Node Coordinates
    final Map<String, LatLng> nodeLatLngs = {
      for (var node in network.nodes)
        node.nodeId: LatLng(node.latitude, node.longitude)
    };

    // Always ensure current user coordinate is in map even if not registered on backend yet
    nodeLatLngs[currentUserId] = LatLng(userLat, userLng);
    nodeLatLngs['user'] = LatLng(userLat, userLng);

    // Build Polylines from active connections
    final polylines = network.connections
        .where((conn) => conn.isActive)
        .map((conn) {
          final fromPoint = nodeLatLngs[conn.fromNodeId];
          final toPoint = nodeLatLngs[conn.toNodeId];

          if (fromPoint != null && toPoint != null) {
            return Polyline(
              points: [fromPoint, toPoint],
              color: const Color(0xFF007AFF).withOpacity(0.35),
              strokeWidth: 2.0,
              isDotted: false,
            );
          }
          return null;
        })
        .whereType<Polyline>()
        .toList();

    // Build Markers (User, Gateways, standard nodes)
    final markers = <Marker>[];

    // Standard / Hardware nodes
    for (final node in network.nodes) {
      final isSelf = node.nodeId == currentUserId || node.nodeId == 'user';
      final isGateway = node.role == 'cisco-gateway';
      
      markers.add(
        Marker(
          point: LatLng(node.latitude, node.longitude),
          width: 60,
          height: 60,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Node name label overlay
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF0E131F).withOpacity(0.85),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: Colors.white.withOpacity(0.1), width: 0.5),
                ),
                child: Text(
                  isSelf ? 'YOU' : node.name.split(' ').first,
                  style: GoogleFonts.inter(
                    color: isSelf ? const Color(0xFF30D158) : Colors.white,
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(height: 2),
              
              // Pulsing Dot / Node Radar icon
              Stack(
                alignment: Alignment.center,
                children: [
                  if (node.isOnline)
                    Container(
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: (isSelf 
                                ? const Color(0xFF30D158) 
                                : isGateway 
                                    ? const Color(0xFF9F8BFF) 
                                    : const Color(0xFF007AFF))
                            .withOpacity(0.2),
                      ),
                    ).animate(onPlay: (c) => c.repeat())
                     .scale(duration: 1.5.seconds, begin: const Offset(1, 1), end: const Offset(2.2, 2.2))
                     .fadeOut(duration: 1.5.seconds),
                  
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: !node.isOnline
                          ? Colors.grey
                          : isSelf
                              ? const Color(0xFF30D158)
                              : isGateway
                                  ? const Color(0xFF9F8BFF)
                                  : const Color(0xFF007AFF),
                      border: Border.all(color: Colors.white, width: 1),
                      boxShadow: [
                        BoxShadow(
                          color: (isSelf ? const Color(0xFF30D158) : const Color(0xFF007AFF)).withOpacity(0.5),
                          blurRadius: 4,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    // Active SOS event overlays (large glowing/pulsing targets)
    final activeSos = network.sosEvents.where((e) => !e.isResolved).toList();
    for (final event in activeSos) {
      markers.add(
        Marker(
          point: LatLng(event.latitude, event.longitude),
          width: 100,
          height: 100,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Concentric radar warning ripples
              ...List.generate(2, (index) {
                return Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.redAccent.withOpacity(0.3),
                      width: 1.5,
                    ),
                  ),
                ).animate(onPlay: (c) => c.repeat())
                 .scale(
                   duration: 1.8.seconds,
                   delay: (index * 600).ms,
                   begin: const Offset(0.2, 0.2),
                   end: const Offset(1.1, 1.1),
                 )
                 .fadeOut(duration: 1.8.seconds);
              }),
              
              // Warning flag badge
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF3B30),
                      borderRadius: BorderRadius.circular(6),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.redAccent.withOpacity(0.5),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.notifications_active, color: Colors.white, size: 10),
                        const SizedBox(width: 4),
                        Text(
                          'SOS ACTIVE',
                          style: GoogleFonts.outfit(
                            color: Colors.white,
                            fontSize: 7,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Icon(
                    Icons.warning_amber_rounded,
                    color: Colors.redAccent,
                    size: 20,
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      body: Stack(
        children: [
          // Tactical Map Layer
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: LatLng(userLat, userLng),
              initialZoom: 14.5,
              maxZoom: 18,
              minZoom: 10,
            ),
            children: [
              TileLayer(
                // Use CartoDB Dark Matter tiles (completely free, styling-friendly)
                urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                subdomains: const ['a', 'b', 'c', 'd'],
                userAgentPackageName: 'com.aidresponse.app',
              ),
              PolylineLayer(
                polylines: polylines,
              ),
              MarkerLayer(
                markers: markers,
              ),
            ],
          ),

          // Search HUD / Overlay panel
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 16,
            right: 16,
            child: GlassCard(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  const Icon(Icons.radar, color: Colors.redAccent, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'TACTICAL MESH MONITOR',
                          style: GoogleFonts.outfit(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.0,
                          ),
                        ),
                        Text(
                          activeSos.isNotEmpty
                              ? '🚨 WARNING: ${activeSos.length} Active SOS incidents'
                              : '✅ Mesh secure: All link paths normal',
                          style: TextStyle(
                            color: activeSos.isNotEmpty ? Colors.redAccent : const Color(0xFF30D158),
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: network.isSseConnected ? const Color(0xFF30D158) : Colors.orangeAccent,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Floating Controls Panel (Radar, Center)
          Positioned(
            bottom: 24,
            right: 16,
            child: Column(
              children: [
                // Radar sweep button (forces topology reload)
                FloatingActionButton(
                  heroTag: 'map_radar',
                  backgroundColor: const Color(0xFF151B26).withOpacity(0.9),
                  mini: true,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.white.withOpacity(0.1)),
                  ),
                  onPressed: () {
                    ref.read(networkProvider.notifier).fetchNetworkTopology();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Sweeping mesh network topology...'),
                        duration: Duration(seconds: 1),
                      ),
                    );
                  },
                  child: const Icon(Icons.sync, color: Colors.white),
                ),
                const SizedBox(height: 10),
                
                // Recenter target button
                FloatingActionButton(
                  heroTag: 'map_center',
                  backgroundColor: const Color(0xFF007AFF),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  onPressed: _centerOnUser,
                  child: const Icon(Icons.my_location, color: Colors.white),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
