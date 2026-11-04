import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class RouteVisualizer extends StatelessWidget {
  final List<String> routingPath;
  final int hops;
  final String currentUserId;
  final Map<String, String> nodeNames;

  const RouteVisualizer({
    super.key,
    required this.routingPath,
    required this.hops,
    required this.currentUserId,
    required this.nodeNames,
  });

  @override
  Widget build(BuildContext context) {
    if (routingPath.isEmpty) return const SizedBox.shrink();

    // Map technical node IDs to friendly display names
    String getPrettyName(String id) {
      if (id == 'user' || id == currentUserId) return 'You';
      return nodeNames[id] ?? id.replaceAll('-', ' ').toUpperCase();
    }

    // Determine path type text & color scheme
    String pathType = '🌐 Mesh Network Route';
    Color pathColor = const Color(0xFF007AFF);
    
    if (hops == 1) {
      pathType = '🚀 Direct Link';
      pathColor = const Color(0xFF30D158);
    } else if (hops == 2) {
      pathType = '📡 Single Hop Relay';
      pathColor = Colors.orangeAccent;
    } else if (hops > 2) {
      pathType = '🔄 Multi-hop Routing ($hops hops)';
      pathColor = const Color(0xFF9F8BFF);
    }

    return Container(
      margin: const EdgeInsets.only(top: 8, bottom: 4),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.route, color: pathColor, size: 12),
              const SizedBox(width: 4),
              Text(
                pathType,
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: pathColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: List.generate(routingPath.length, (index) {
                final nodeId = routingPath[index];
                final isLast = index == routingPath.length - 1;
                
                return Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isLast 
                            ? pathColor.withOpacity(0.15) 
                            : Colors.white.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: isLast 
                              ? pathColor 
                              : Colors.white.withOpacity(0.1),
                          width: 1.0,
                        ),
                      ),
                      child: Text(
                        getPrettyName(nodeId),
                        style: GoogleFonts.inter(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: isLast ? Colors.white : Colors.white70,
                        ),
                      ),
                    ),
                    if (!isLast)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Icon(
                          Icons.arrow_right_alt,
                          color: Colors.white.withOpacity(0.3),
                          size: 14,
                        ),
                      ),
                  ],
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}
