import type { NetworkNode } from "@/types/network";

export interface BluetoothDevice {
  id: string;
  name: string;
  rssi: number; // Signal strength
  distance: number; // Estimated distance in meters
  lastSeen: number;
  batteryLevel?: number;
  txPower?: number;
}

export interface DiscoveredNode extends BluetoothDevice {
  nodeId: string;
  deviceType: "smartphone" | "tablet" | "emergency_beacon" | "relay_station" | "medical_device";
  capabilities: string[];
  emergencyStatus?: "normal" | "warning" | "critical";
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export interface BLEAdvertisement {
  deviceId: string;
  deviceName: string;
  rssi: number;
  txPower?: number;
  manufacturerData?: ArrayBuffer;
  serviceData?: Map<string, ArrayBuffer>;
  serviceUuids?: string[];
}

export class BluetoothDiscoveryService {
  private isScanning = false;
  private scanInterval: number | null = null;
  private discoveredDevices: Map<string, DiscoveredNode> = new Map();
  private subscribers: Set<(devices: DiscoveredNode[]) => void> = new Set();
  private bluetoothDevice: any = null;
  private gattServer: any = null;
  private _isConnected = false;
  private connectionRetries = 0;
  private maxRetries = 3;

  // BLE Service UUIDs for Aid-Response
  private readonly AID_RESPONSE_SERVICE_UUID = "12345678-1234-1234-1234-123456789abc";
  private readonly AID_RESPONSE_CHARACTERISTIC_UUID = "87654321-4321-4321-4321-cba987654321";
  private readonly BATTERY_SERVICE_UUID = "0000180f-0000-1000-8000-00805f9b34fb";
  private readonly DEVICE_INFO_SERVICE_UUID = "0000180a-0000-1000-8000-00805f9b34fb";

  constructor() {
    this.startBackgroundScanning();
    this.setupBluetoothEventListeners();
  }

  private setupBluetoothEventListeners(): void {
    // Listen for Bluetooth availability changes
    if ('bluetooth' in navigator) {
      (navigator as any).bluetooth.addEventListener('availabilitychanged', (event: any) => {
        console.log('Bluetooth availability changed:', event.target.available);
      });
    }
  }

  async requestBluetoothPermission(): Promise<boolean> {
    try {
      // Check if Web Bluetooth API is available
      if (!(navigator as any).bluetooth) {
        console.warn('Web Bluetooth API not available');
        return false;
      }

      // Check if Bluetooth is available
      if (!(navigator as any).bluetooth.available) {
        console.warn('Bluetooth is not available on this device');
        return false;
      }

      // Request device access with specific filters for Aid-Response devices
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: false,
        filters: [
          {
            services: [this.AID_RESPONSE_SERVICE_UUID]
          },
          {
            namePrefix: 'Aid-Response'
          },
          {
            namePrefix: 'Emergency'
          }
        ],
        optionalServices: [
          this.BATTERY_SERVICE_UUID,
          this.DEVICE_INFO_SERVICE_UUID,
          'battery_service',
          'device_information'
        ]
      });

      this.bluetoothDevice = device;
      return !!device;
    } catch (error) {
      console.warn('Bluetooth permission denied or error:', error);
      return false;
    }
  }

  async startScanning(): Promise<void> {
    if (this.isScanning) return;
    
    this.isScanning = true;
    console.log('🔍 Starting Bluetooth LE scan for nearby Aid-Response nodes...');
    
    // Try real BLE scanning first
    if (await this.startRealBLEScan()) {
      return;
    }
    
    // Fallback to simulation if real BLE fails
    this.simulateDeviceDiscovery().catch(console.error);
  }

  private async startRealBLEScan(): Promise<boolean> {
    try {
      // Check if we have permission
      if (!this.bluetoothDevice) {
        const hasPermission = await this.requestBluetoothPermission();
        if (!hasPermission) {
          return false;
        }
      }

      // Start scanning for BLE advertisements
      const advertisements: BLEAdvertisement[] = [];
      
      // Listen for advertisement events
      this.bluetoothDevice.addEventListener('advertisementreceived', (event: any) => {
        const advertisement: BLEAdvertisement = {
          deviceId: event.device.id,
          deviceName: event.device.name || 'Unknown Device',
          rssi: event.rssi,
          txPower: event.txPower,
          manufacturerData: event.manufacturerData,
          serviceData: event.serviceData,
          serviceUuids: event.serviceUuids
        };
        
        this.processBLEAdvertisement(advertisement);
      });

      // Start scanning
      await this.bluetoothDevice.startScanning();
      return true;
    } catch (error) {
      console.warn('Real BLE scanning failed, falling back to simulation:', error);
      return false;
    }
  }

  private processBLEAdvertisement(advertisement: BLEAdvertisement): void {
    try {
      // Parse Aid-Response-specific data from manufacturer data
      const nodeData = this.parseAidResponseData(advertisement);
      
      if (nodeData) {
        const discoveredNode: DiscoveredNode = {
          id: advertisement.deviceId,
          nodeId: nodeData.nodeId,
          name: advertisement.deviceName,
          rssi: advertisement.rssi,
          distance: this.calculateDistanceFromRSSI(advertisement.rssi, advertisement.txPower),
          lastSeen: Date.now(),
          deviceType: nodeData.deviceType,
          capabilities: nodeData.capabilities,
          emergencyStatus: nodeData.emergencyStatus,
          location: nodeData.location,
          batteryLevel: nodeData.batteryLevel,
          txPower: advertisement.txPower
        };

        this.discoveredDevices.set(advertisement.deviceId, discoveredNode);
        this.notifySubscribers();
      }
    } catch (error) {
      console.error('Error processing BLE advertisement:', error);
    }
  }

  private parseAidResponseData(advertisement: BLEAdvertisement): any {
    try {
      if (!advertisement.manufacturerData) {
        return null;
      }

      // Parse manufacturer data for Aid-Response devices
      const data = new Uint8Array(advertisement.manufacturerData);
      
      // Check for Aid-Response manufacturer ID (example: 0x1234)
      if (data.length < 4 || (data[0] !== 0x12 && data[1] !== 0x34)) {
        return null;
      }

      // Parse node data
      const nodeId = this.decodeString(data, 4, 8);
      const deviceType = this.decodeDeviceType(data[12]);
      const capabilities = this.decodeCapabilities(data[13]);
      const emergencyStatus = this.decodeEmergencyStatus(data[14]);
      const batteryLevel = data[15];
      
      // Parse location if available
      let location = null;
      if (data.length >= 24) {
        const lat = this.decodeFloat(data, 16);
        const lng = this.decodeFloat(data, 20);
        location = { latitude: lat, longitude: lng, accuracy: data[24] || 10 };
      }

      return {
        nodeId,
        deviceType,
        capabilities,
        emergencyStatus,
        batteryLevel,
        location
      };
    } catch (error) {
      console.error('Error parsing Aid-Response data:', error);
      return null;
    }
  }

  private decodeString(data: Uint8Array, start: number, length: number): string {
    const slice = data.slice(start, start + length);
    return String.fromCharCode.apply(null, Array.from(slice)).replace(/\0/g, '');
  }

  private decodeDeviceType(type: number): DiscoveredNode['deviceType'] {
    switch (type) {
      case 1: return 'smartphone';
      case 2: return 'tablet';
      case 3: return 'emergency_beacon';
      case 4: return 'relay_station';
      case 5: return 'medical_device';
      default: return 'smartphone';
    }
  }

  private decodeCapabilities(capabilities: number): string[] {
    const caps: string[] = [];
    if (capabilities & 0x01) caps.push('messaging');
    if (capabilities & 0x02) caps.push('gps');
    if (capabilities & 0x04) caps.push('emergency_broadcast');
    if (capabilities & 0x08) caps.push('mesh_relay');
    if (capabilities & 0x10) caps.push('medical_monitoring');
    if (capabilities & 0x20) caps.push('long_range');
    if (capabilities & 0x40) caps.push('power_backup');
    return caps;
  }

  private decodeEmergencyStatus(status: number): DiscoveredNode['emergencyStatus'] {
    switch (status) {
      case 0: return 'normal';
      case 1: return 'warning';
      case 2: return 'critical';
      default: return 'normal';
    }
  }

  private decodeFloat(data: Uint8Array, offset: number): number {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint8(0, data[offset]);
    view.setUint8(1, data[offset + 1]);
    view.setUint8(2, data[offset + 2]);
    view.setUint8(3, data[offset + 3]);
    return view.getFloat32(0, true); // little-endian
  }

  stopScanning(): void {
    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    // Stop real BLE scanning if active
    if (this.bluetoothDevice) {
      try {
        this.bluetoothDevice.stopScanning();
      } catch (error) {
        console.warn('Error stopping BLE scan:', error);
      }
    }
    
    console.log('⏹️ Bluetooth scanning stopped');
  }

  private startBackgroundScanning(): void {
    // Start automatic scanning every 30 seconds
    setInterval(() => {
      if (!this.isScanning) {
        this.simulateDeviceDiscovery().catch(console.error);
      }
    }, 30000);
  }

  private async simulateDeviceDiscovery(): Promise<void> {
    // Use BLE simulator for more realistic device discovery
    try {
      const { bleSimulator } = await import('./ble-simulator');
      const simulatedDevices = bleSimulator.getActiveDevices();
      
      // Randomly discover devices to simulate real scanning
      const discoveryChance = 0.7; // 70% chance to discover each device
      
      simulatedDevices.forEach((device: DiscoveredNode) => {
        if (Math.random() < discoveryChance) {
          // Add some realistic variation to signal strength
          const rssiVariation = (Math.random() - 0.5) * 10;
          device.rssi += rssiVariation;
          device.distance = this.calculateDistanceFromRSSI(device.rssi, device.txPower);
          
          this.discoveredDevices.set(device.id, device);
        }
      });
    } catch (error) {
      console.warn('BLE simulator not available, using fallback devices');
      // Fallback to basic simulation
      const fallbackDevices: DiscoveredNode[] = [
        {
          id: 'bt-001',
          nodeId: 'mobile-rescue-01',
          name: 'Emergency Responder Phone',
          rssi: -45,
          distance: 8,
          lastSeen: Date.now(),
          deviceType: 'smartphone',
          capabilities: ['messaging', 'gps', 'emergency_broadcast'],
          emergencyStatus: 'normal',
          batteryLevel: 85,
          txPower: -20
        },
        {
          id: 'bt-002', 
          nodeId: 'beacon-alpha',
          name: 'RV College Emergency Beacon',
          rssi: -35,
          distance: 5,
          lastSeen: Date.now(),
          deviceType: 'emergency_beacon',
          capabilities: ['emergency_broadcast', 'location_beacon', 'mesh_relay'],
          emergencyStatus: 'normal',
          batteryLevel: 95,
          txPower: -15
        }
      ];
      
      fallbackDevices.forEach((device: DiscoveredNode) => {
        if (Math.random() < 0.7) {
          const rssiVariation = (Math.random() - 0.5) * 10;
          device.rssi += rssiVariation;
          device.distance = this.calculateDistanceFromRSSI(device.rssi, device.txPower);
          this.discoveredDevices.set(device.id, device);
        }
      });
    }

    // Randomly discover devices to simulate real scanning
    const discoveryChance = 0.7; // 70% chance to discover each device
    
    // Occasionally simulate device disconnection
    const disconnectionChance = 0.1; // 10% chance
    this.discoveredDevices.forEach((device, id) => {
      if (Math.random() < disconnectionChance) {
        this.discoveredDevices.delete(id);
      }
    });

    this.notifySubscribers();
  }

  private calculateDistanceFromRSSI(rssi: number, txPower?: number): number {
    // Enhanced distance calculation using path loss model
    const measuredPower = txPower || -20; // Default TX power
    const pathLossExponent = 2.5; // Urban environment
    
    if (rssi === 0) return 0;
    
    const distance = Math.pow(10, (measuredPower - rssi) / (10 * pathLossExponent));
    return Math.max(1, Math.round(distance * 10) / 10); // Round to 1 decimal place
  }

  getDiscoveredDevices(): DiscoveredNode[] {
    return Array.from(this.discoveredDevices.values())
      .filter(device => Date.now() - device.lastSeen < 60000) // Remove devices not seen in 1 minute
      .sort((a, b) => b.rssi - a.rssi); // Sort by signal strength
  }

  subscribe(callback: (devices: DiscoveredNode[]) => void): () => void {
    this.subscribers.add(callback);
    
    // Notify immediately with current devices
    callback(this.getDiscoveredDevices());
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    const devices = this.getDiscoveredDevices();
    this.subscribers.forEach(callback => {
      try {
        callback(devices);
      } catch (error) {
        console.error('Error in Bluetooth discovery subscriber:', error);
      }
    });
  }

  async connectToDevice(deviceId: string): Promise<boolean> {
    const device = this.discoveredDevices.get(deviceId);
    if (!device) {
      console.error('Device not found:', deviceId);
      return false;
    }

    try {
      console.log(`🔗 Attempting to connect to ${device.name}...`);
      
      // Try real BLE connection first
      if (this.bluetoothDevice && device.id === this.bluetoothDevice.id) {
        return await this.connectToBLEDevice();
      }
      
      // Fallback to simulated connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (Math.random() > 0.2) { // 80% success rate
        console.log(`✅ Successfully connected to ${device.name}`);
        this._isConnected = true;
        return true;
      } else {
        console.log(`❌ Failed to connect to ${device.name}`);
        return false;
      }
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  }

  private async connectToBLEDevice(): Promise<boolean> {
    try {
      if (!this.bluetoothDevice) {
        return false;
      }

      // Connect to GATT server
      this.gattServer = await this.bluetoothDevice.gatt.connect();
      
      // Get Aid-Response service
      const service = await this.gattServer.getPrimaryService(this.AID_RESPONSE_SERVICE_UUID);
      
      // Get characteristic for communication
      const characteristic = await service.getCharacteristic(this.AID_RESPONSE_CHARACTERISTIC_UUID);
      
      // Enable notifications
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        this.handleBLEMessage(event.target.value);
      });
      
      this._isConnected = true;
      console.log('✅ Successfully connected to BLE device');
      return true;
    } catch (error) {
      console.error('BLE connection failed:', error);
      return false;
    }
  }

  private handleBLEMessage(value: DataView): void {
    try {
      // Parse incoming BLE message
      const message = this.parseBLEMessage(value);
      console.log('📨 Received BLE message:', message);
      
      // Handle different message types
      switch (message.type) {
        case 'emergency':
          this.handleEmergencyMessage(message);
          break;
        case 'status':
          this.handleStatusMessage(message);
          break;
        case 'location':
          this.handleLocationMessage(message);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling BLE message:', error);
    }
  }

  private parseBLEMessage(value: DataView): any {
    // Parse BLE message format
    const messageType = value.getUint8(0);
    const payloadLength = value.getUint8(1);
    const payload = new Uint8Array(value.buffer, value.byteOffset + 2, payloadLength);
    
    return {
      type: messageType === 1 ? 'emergency' : messageType === 2 ? 'status' : 'location',
      payload: new TextDecoder().decode(payload)
    };
  }

  private handleEmergencyMessage(message: any): void {
    // Handle emergency messages
    console.log('🚨 Emergency message received:', message.payload);
  }

  private handleStatusMessage(message: any): void {
    // Handle status updates
    console.log('📊 Status message received:', message.payload);
  }

  private handleLocationMessage(message: any): void {
    // Handle location updates
    console.log('📍 Location message received:', message.payload);
  }

  async sendMessage(deviceId: string, message: string): Promise<boolean> {
    try {
      if (!this._isConnected || !this.gattServer) {
        console.warn('Not connected to BLE device');
        return false;
      }

      // Get service and characteristic
      const service = await this.gattServer.getPrimaryService(this.AID_RESPONSE_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(this.AID_RESPONSE_CHARACTERISTIC_UUID);
      
      // Prepare message
      const encoder = new TextEncoder();
      const messageData = encoder.encode(message);
      
      // Send message
      await characteristic.writeValue(messageData);
      
      console.log('✅ Message sent via BLE');
      return true;
    } catch (error) {
      console.error('Failed to send BLE message:', error);
      return false;
    }
  }

  getDeviceCapabilities(deviceId: string): string[] {
    const device = this.discoveredDevices.get(deviceId);
    return device?.capabilities || [];
  }

  isBluetoothSupported(): boolean {
    return 'bluetooth' in (navigator as any);
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  getConnectionStatus(): { isConnected: boolean; deviceName?: string } {
    return {
      isConnected: this._isConnected,
      deviceName: this.bluetoothDevice?.name
    };
  }

  disconnect(): void {
    if (this.gattServer) {
      try {
        this.gattServer.disconnect();
      } catch (error) {
        console.warn('Error disconnecting BLE device:', error);
      }
    }
    
    this._isConnected = false;
    this.gattServer = null;
    console.log('🔌 Disconnected from BLE device');
  }

  cleanup(): void {
    this.stopScanning();
    this.disconnect();
    this.discoveredDevices.clear();
    this.subscribers.clear();
  }
}

export const bluetoothService = new BluetoothDiscoveryService();