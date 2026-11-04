import 'package:geolocator/geolocator.dart';

class LocationService {
  // Default coordinates centered on the seeded disaster simulation area (RV College, Bangalore)
  static const double defaultLatitude = 12.9249;
  static const double defaultLongitude = 77.4996;

  Future<Position> determinePosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    try {
      // Test if location services are enabled.
      serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return _getDefaultPosition('Location services are disabled.');
      }

      permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return _getDefaultPosition('Location permissions are denied');
        }
      }
      
      if (permission == LocationPermission.deniedForever) {
        return _getDefaultPosition('Location permissions are permanently denied.');
      }

      // If permissions are granted, try to fetch current location within a 5s limit
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 5),
      );
    } catch (e) {
      return _getDefaultPosition('Error getting position: $e');
    }
  }

  Position _getDefaultPosition(String reason) {
    // Return standard fallback coordinate matching seed data
    return Position(
      latitude: defaultLatitude,
      longitude: defaultLongitude,
      timestamp: DateTime.now(),
      accuracy: 0.0,
      altitude: 0.0,
      altitudeAccuracy: 0.0,
      heading: 0.0,
      headingAccuracy: 0.0,
      speed: 0.0,
      speedAccuracy: 0.0,
    );
  }
}
