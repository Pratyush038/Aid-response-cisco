export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface LocationServiceOptions {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

export class LocationService {
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private subscribers: Set<(location: LocationData) => void> = new Set();
  private errorSubscribers: Set<(error: GeolocationPositionError) => void> = new Set();

  constructor(private options: LocationServiceOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000 // 1 minute
  }) {}

  async getCurrentLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
          };
          
          this.currentLocation = locationData;
          this.notifySubscribers(locationData);
          resolve(locationData);
        },
        (error) => {
          this.notifyErrorSubscribers(error);
          reject(error);
        },
        this.options
      );
    });
  }

  startWatching(): void {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    if (this.watchId !== null) {
      this.stopWatching();
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined,
        };
        
        this.currentLocation = locationData;
        this.notifySubscribers(locationData);
      },
      (error) => {
        this.notifyErrorSubscribers(error);
      },
      this.options
    );
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  subscribe(callback: (location: LocationData) => void): () => void {
    this.subscribers.add(callback);
    
    // If we have a current location, notify immediately
    if (this.currentLocation) {
      callback(this.currentLocation);
    }
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  subscribeToErrors(callback: (error: GeolocationPositionError) => void): () => void {
    this.errorSubscribers.add(callback);
    return () => {
      this.errorSubscribers.delete(callback);
    };
  }

  getLastKnownLocation(): LocationData | null {
    return this.currentLocation;
  }

  private notifySubscribers(location: LocationData): void {
    this.subscribers.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('Error in location subscriber:', error);
      }
    });
  }

  private notifyErrorSubscribers(error: GeolocationPositionError): void {
    this.errorSubscribers.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in location error subscriber:', err);
      }
    });
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const locationService = new LocationService();