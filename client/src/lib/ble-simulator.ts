import { bluetoothService, type DiscoveredNode } from "./bluetooth-service";

export interface BLESimulatedDevice {
  id: string;
  nodeId: string;
  name: string;
  deviceType: DiscoveredNode['deviceType'];
  baseRSSI: number;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  capabilities: string[];
  emergencyStatus: DiscoveredNode['emergencyStatus'];
  batteryLevel: number;
  isActive: boolean;
  movementPattern?: 'static' | 'walking' | 'driving';
}

export class BLESimulator {
  private devices: BLESimulatedDevice[] = [];
  private simulationInterval: number | null = null;
  private isRunning = false;

  constructor() {
    this.initializeDevices();
  }

  private initializeDevices(): void {
    // Initialize realistic BLE devices around RV College
    this.devices = [
      {
        id: 'ble-001',
        nodeId: 'emergency-responder-01',
        name: 'Emergency Responder Phone',
        deviceType: 'smartphone',
        baseRSSI: -45,
        location: {
          latitude: 12.9250,
          longitude: 77.4995,
          accuracy: 5
        },
        capabilities: ['messaging', 'gps', 'emergency_broadcast'],
        emergencyStatus: 'normal',
        batteryLevel: 85,
        isActive: true,
        movementPattern: 'walking'
      },
      {
        id: 'ble-002',
        nodeId: 'rv-college-beacon',
        name: 'RV College Emergency Beacon',
        deviceType: 'emergency_beacon',
        baseRSSI: -35,
        location: {
          latitude: 12.9249,
          longitude: 77.4996,
          accuracy: 3
        },
        capabilities: ['emergency_broadcast', 'location_beacon', 'mesh_relay'],
        emergencyStatus: 'normal',
        batteryLevel: 95,
        isActive: true,
        movementPattern: 'static'
      },
      {
        id: 'ble-003',
        nodeId: 'mysore-road-relay',
        name: 'Mysore Road Relay Station',
        deviceType: 'relay_station',
        baseRSSI: -55,
        location: {
          latitude: 12.9240,
          longitude: 77.4980,
          accuracy: 10
        },
        capabilities: ['mesh_relay', 'long_range', 'power_backup'],
        emergencyStatus: 'normal',
        batteryLevel: 100,
        isActive: true,
        movementPattern: 'static'
      },
      {
        id: 'ble-004',
        nodeId: 'medical-device-01',
        name: 'Medical Monitoring Device',
        deviceType: 'medical_device',
        baseRSSI: -40,
        location: {
          latitude: 12.9255,
          longitude: 77.4990,
          accuracy: 8
        },
        capabilities: ['medical_monitoring', 'emergency_broadcast', 'gps'],
        emergencyStatus: 'warning',
        batteryLevel: 45,
        isActive: true,
        movementPattern: 'walking'
      },
      {
        id: 'ble-005',
        nodeId: 'civilian-phone-01',
        name: 'Civilian Smartphone',
        deviceType: 'smartphone',
        baseRSSI: -50,
        location: {
          latitude: 12.9245,
          longitude: 77.5000,
          accuracy: 15
        },
        capabilities: ['messaging', 'gps'],
        emergencyStatus: 'normal',
        batteryLevel: 72,
        isActive: true,
        movementPattern: 'walking'
      },
      {
        id: 'ble-006',
        nodeId: 'emergency-vehicle-01',
        name: 'Emergency Vehicle Beacon',
        deviceType: 'emergency_beacon',
        baseRSSI: -30,
        location: {
          latitude: 12.9260,
          longitude: 77.4985,
          accuracy: 20
        },
        capabilities: ['emergency_broadcast', 'long_range', 'vehicle_tracking'],
        emergencyStatus: 'critical',
        batteryLevel: 88,
        isActive: true,
        movementPattern: 'driving'
      }
    ];
  }

  startSimulation(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 Starting BLE device simulation...');
    
    this.simulationInterval = window.setInterval(() => {
      this.updateDevices();
    }, 2000); // Update every 2 seconds
  }

  stopSimulation(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    console.log('⏹️ BLE simulation stopped');
  }

  private updateDevices(): void {
    this.devices.forEach(device => {
      if (!device.isActive) return;

      // Update device position based on movement pattern
      this.updateDevicePosition(device);
      
      // Update RSSI based on distance and movement
      this.updateDeviceRSSI(device);
      
      // Update battery level (slow drain)
      this.updateDeviceBattery(device);
      
      // Occasionally change emergency status
      this.updateEmergencyStatus(device);
      
      // Simulate device going offline occasionally
      this.simulateDeviceOffline(device);
    });
  }

  private updateDevicePosition(device: BLESimulatedDevice): void {
    if (device.movementPattern === 'static') return;

    const baseLat = 12.9249;
    const baseLon = 77.4996;
    const maxMovement = 0.001; // ~100 meters

    if (device.movementPattern === 'walking') {
      // Random walking movement
      const latChange = (Math.random() - 0.5) * maxMovement * 0.1;
      const lonChange = (Math.random() - 0.5) * maxMovement * 0.1;
      
      device.location.latitude = Math.max(baseLat - maxMovement, Math.min(baseLat + maxMovement, 
        device.location.latitude + latChange));
      device.location.longitude = Math.max(baseLon - maxMovement, Math.min(baseLon + maxMovement, 
        device.location.longitude + lonChange));
    } else if (device.movementPattern === 'driving') {
      // Simulate vehicle movement along roads
      const roadPattern = Math.sin(Date.now() / 10000) * maxMovement * 0.5;
      device.location.longitude = baseLon + roadPattern;
    }
  }

  private updateDeviceRSSI(device: BLESimulatedDevice): void {
    // Calculate distance from user (at RV College)
    const userLat = 12.9249;
    const userLon = 77.4996;
    const distance = this.calculateDistance(
      userLat, userLon,
      device.location.latitude, device.location.longitude
    );

    // RSSI decreases with distance
    const distanceFactor = Math.max(0.1, 1 - (distance / 5)); // 5km max range
    const movementFactor = device.movementPattern === 'static' ? 1 : 0.9;
    const randomFactor = 0.8 + Math.random() * 0.4; // ±20% variation

    device.baseRSSI = Math.max(-90, Math.min(-20, 
      device.baseRSSI * distanceFactor * movementFactor * randomFactor));
  }

  private updateDeviceBattery(device: BLESimulatedDevice): void {
    // Different devices have different battery drain rates
    let drainRate = 0.1; // Default slow drain
    
    if (device.deviceType === 'medical_device') {
      drainRate = 0.3; // Medical devices drain faster
    } else if (device.deviceType === 'emergency_beacon') {
      drainRate = 0.05; // Beacons are very efficient
    } else if (device.deviceType === 'relay_station') {
      drainRate = 0; // Relay stations have backup power
    }

    device.batteryLevel = Math.max(0, device.batteryLevel - drainRate);
    
    // Device goes offline if battery too low
    if (device.batteryLevel < 5) {
      device.isActive = false;
    }
  }

  private updateEmergencyStatus(device: BLESimulatedDevice): void {
    // Occasionally change emergency status
    if (Math.random() < 0.05) { // 5% chance
      const statuses: DiscoveredNode['emergencyStatus'][] = ['normal', 'warning', 'critical'];
      const currentIndex = statuses.indexOf(device.emergencyStatus || 'normal');
      const nextIndex = (currentIndex + 1) % statuses.length;
      device.emergencyStatus = statuses[nextIndex];
    }
  }

  private simulateDeviceOffline(device: BLESimulatedDevice): void {
    // Occasionally simulate device going offline
    if (Math.random() < 0.02) { // 2% chance
      device.isActive = false;
      
      // Reconnect after some time
      setTimeout(() => {
        device.isActive = true;
        device.batteryLevel = Math.max(20, device.batteryLevel); // Recharge a bit
      }, Math.random() * 10000 + 5000); // 5-15 seconds
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  getActiveDevices(): DiscoveredNode[] {
    return this.devices
      .filter(device => device.isActive)
      .map(device => ({
        id: device.id,
        nodeId: device.nodeId,
        name: device.name,
        rssi: device.baseRSSI,
        distance: this.calculateDistance(12.9249, 77.4996, device.location.latitude, device.location.longitude) * 1000, // Convert to meters
        lastSeen: Date.now(),
        deviceType: device.deviceType,
        capabilities: device.capabilities,
        emergencyStatus: device.emergencyStatus,
        location: device.location,
        batteryLevel: device.batteryLevel,
        txPower: -20
      }));
  }

  addDevice(device: BLESimulatedDevice): void {
    this.devices.push(device);
  }

  removeDevice(deviceId: string): void {
    this.devices = this.devices.filter(device => device.id !== deviceId);
  }

  setDeviceEmergencyStatus(deviceId: string, status: DiscoveredNode['emergencyStatus']): void {
    const device = this.devices.find(d => d.id === deviceId);
    if (device) {
      device.emergencyStatus = status;
    }
  }

  getDeviceStats(): {
    totalDevices: number;
    activeDevices: number;
    emergencyDevices: number;
    averageRSSI: number;
    averageBattery: number;
  } {
    const activeDevices = this.devices.filter(d => d.isActive);
    const emergencyDevices = activeDevices.filter(d => d.emergencyStatus !== 'normal');
    
    return {
      totalDevices: this.devices.length,
      activeDevices: activeDevices.length,
      emergencyDevices: emergencyDevices.length,
      averageRSSI: activeDevices.reduce((sum, d) => sum + d.baseRSSI, 0) / activeDevices.length,
      averageBattery: activeDevices.reduce((sum, d) => sum + d.batteryLevel, 0) / activeDevices.length
    };
  }

  cleanup(): void {
    this.stopSimulation();
  }
}

export const bleSimulator = new BLESimulator();

// Start the simulation automatically
bleSimulator.startSimulation(); 