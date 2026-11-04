import type { NetworkNode, NetworkConnection, NetworkStats } from "@/types/network";
import { bluetoothService, type DiscoveredNode } from "./bluetooth-service";

export interface NetworkEvent {
  type: 'node_connected' | 'node_disconnected' | 'signal_changed' | 'emergency_alert' | 'ble_device_discovered';
  nodeId: string;
  timestamp: number;
  data?: any;
}

export class NetworkSimulation {
  private nodes: NetworkNode[] = [];
  private connections: NetworkConnection[] = [];
  private stats: NetworkStats = {
    connectedNodes: 0,
    totalNodes: 0,
    activeConnections: 0,
    averageLatency: 0,
    coverageRadius: 0,
    totalMessages: 0,
    unreadMessages: 0,
  };

  private simulationInterval: number | null = null;
  private eventSubscribers: Set<(event: NetworkEvent) => void> = new Set();
  private bleDevices: DiscoveredNode[] = [];
  private emergencyMode = false;

  constructor() {
    this.startSimulation();
    this.setupBLESubscription();
  }

  private setupBLESubscription(): void {
    // Subscribe to BLE device discovery
    bluetoothService.subscribe((devices) => {
      this.bleDevices = devices;
      this.integrateBLEDevices();
    });
  }

  private integrateBLEDevices(): void {
    // Convert BLE devices to network nodes if they're not already present
    this.bleDevices.forEach(bleDevice => {
      const existingNode = this.nodes.find(node => node.nodeId === bleDevice.nodeId);
      
      if (!existingNode) {
        // Create new network node from BLE device
        const newNode: NetworkNode = {
          id: this.nodes.length + 1,
          nodeId: bleDevice.nodeId,
          name: bleDevice.name,
          latitude: bleDevice.location?.latitude || 0,
          longitude: bleDevice.location?.longitude || 0,
          isOnline: true,
          signalStrength: this.convertRSSIToSignalStrength(bleDevice.rssi),
          lastSeen: new Date(bleDevice.lastSeen),
        };

        this.nodes.push(newNode);
        this.createConnectionsForNode(newNode);
        
        // Emit event
        this.emitEvent({
          type: 'ble_device_discovered',
          nodeId: bleDevice.nodeId,
          timestamp: Date.now(),
          data: { bleDevice, newNode }
        });
      } else {
        // Update existing node with BLE data
        existingNode.signalStrength = this.convertRSSIToSignalStrength(bleDevice.rssi);
        existingNode.lastSeen = new Date(bleDevice.lastSeen);
        existingNode.isOnline = bleDevice.rssi > -80; // Consider offline if signal too weak
        
        // Emit signal change event
        this.emitEvent({
          type: 'signal_changed',
          nodeId: bleDevice.nodeId,
          timestamp: Date.now(),
          data: { rssi: bleDevice.rssi, signalStrength: existingNode.signalStrength }
        });
      }
    });

    // Remove nodes that are no longer discovered via BLE
    this.nodes = this.nodes.filter(node => {
      if (node.nodeId === 'user') return true; // Keep user node
      
      const stillDiscovered = this.bleDevices.some(ble => ble.nodeId === node.nodeId);
      if (!stillDiscovered && node.isOnline) {
        // Emit disconnection event
        this.emitEvent({
          type: 'node_disconnected',
          nodeId: node.nodeId,
          timestamp: Date.now(),
          data: { reason: 'ble_device_lost' }
        });
      }
      
      return stillDiscovered || node.nodeId === 'user';
    });
  }

  private convertRSSIToSignalStrength(rssi: number): number {
    // Convert RSSI to signal strength percentage
    if (rssi >= -30) return 100;
    if (rssi >= -50) return 90;
    if (rssi >= -60) return 80;
    if (rssi >= -70) return 60;
    if (rssi >= -80) return 40;
    if (rssi >= -90) return 20;
    return 0;
  }

  private createConnectionsForNode(node: NetworkNode): void {
    // Create connections to nearby nodes based on distance
    this.nodes.forEach(existingNode => {
      if (existingNode.nodeId === node.nodeId) return;
      
      const distance = this.calculateDistance(
        node.latitude, node.longitude,
        existingNode.latitude, existingNode.longitude
      );
      
      // Create connection if within range (5km for BLE devices)
      if (distance <= 5) {
        const latency = Math.floor(distance * 20 + Math.random() * 30); // Realistic latency
        const connection: NetworkConnection = {
          id: this.connections.length + 1,
          fromNodeId: node.nodeId,
          toNodeId: existingNode.nodeId,
          distance,
          latency,
          isActive: true,
        };
        
        this.connections.push(connection);
      }
    });
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

  setData(nodes: NetworkNode[], connections: NetworkConnection[], stats: NetworkStats) {
    this.nodes = nodes;
    this.connections = connections;
    this.stats = stats;
  }

  setEmergencyMode(enabled: boolean): void {
    this.emergencyMode = enabled;
    
    if (enabled) {
      // In emergency mode, prioritize all connections and reduce latency
      this.connections.forEach(conn => {
        conn.latency = Math.max(10, conn.latency * 0.7); // Reduce latency by 30%
        conn.isActive = true;
      });
      
      // Emit emergency alert
      this.emitEvent({
        type: 'emergency_alert',
        nodeId: 'user',
        timestamp: Date.now(),
        data: { mode: 'enabled' }
      });
    }
  }

  private startSimulation() {
    // Simulate network changes every 3 seconds (faster for more responsive updates)
    this.simulationInterval = window.setInterval(() => {
      this.simulateNetworkChanges();
    }, 3000);
  }

  private simulateNetworkChanges() {
    // Enhanced network simulation with BLE integration
    this.updateNetworkStats();
    
    // Simulate latency fluctuations based on network load
    const baseLatency = this.emergencyMode ? 15 : 25;
    this.stats.averageLatency = Math.floor(baseLatency + Math.random() * 30);

    // Simulate signal strength changes for non-BLE nodes
    this.nodes.forEach(node => {
      if (node.isOnline && !this.bleDevices.some(ble => ble.nodeId === node.nodeId)) {
        // Only simulate for non-BLE nodes (BLE nodes are updated by BLE service)
        if (Math.random() < 0.3) { // 30% chance
          const change = (Math.random() - 0.5) * 15;
          node.signalStrength = Math.max(20, Math.min(100, node.signalStrength + change));
          
          // Emit signal change event
          this.emitEvent({
            type: 'signal_changed',
            nodeId: node.nodeId,
            timestamp: Date.now(),
            data: { signalStrength: node.signalStrength }
          });
        }
      }
    });

    // Occasionally simulate node discovery or disconnection
    if (Math.random() < 0.15) { // 15% chance
      this.simulateNodeChange();
    }

    // Update BLE device status
    this.updateBLEDeviceStatus();
  }

  private updateBLEDeviceStatus(): void {
    this.bleDevices.forEach(bleDevice => {
      const node = this.nodes.find(n => n.nodeId === bleDevice.nodeId);
      if (node) {
        const wasOnline = node.isOnline;
        node.isOnline = bleDevice.rssi > -80;
        
        if (wasOnline && !node.isOnline) {
          this.emitEvent({
            type: 'node_disconnected',
            nodeId: bleDevice.nodeId,
            timestamp: Date.now(),
            data: { reason: 'signal_too_weak', rssi: bleDevice.rssi }
          });
        } else if (!wasOnline && node.isOnline) {
          this.emitEvent({
            type: 'node_connected',
            nodeId: bleDevice.nodeId,
            timestamp: Date.now(),
            data: { rssi: bleDevice.rssi }
          });
        }
      }
    });
  }

  private simulateNodeChange() {
    // Find a node to toggle status (only non-BLE nodes)
    const changeableNodes = this.nodes.filter(node => 
      node.nodeId !== "user" && 
      !this.bleDevices.some(ble => ble.nodeId === node.nodeId)
    );
    
    if (changeableNodes.length === 0) return;

    const randomNode = changeableNodes[Math.floor(Math.random() * changeableNodes.length)];
    
    if (randomNode.isOnline && Math.random() < 0.3) {
      // Simulate disconnection
      randomNode.isOnline = false;
      randomNode.signalStrength = 0;
      this.stats.connectedNodes = Math.max(0, this.stats.connectedNodes - 1);
      
      this.emitEvent({
        type: 'node_disconnected',
        nodeId: randomNode.nodeId,
        timestamp: Date.now(),
        data: { reason: 'simulated_disconnection' }
      });
    } else if (!randomNode.isOnline && Math.random() < 0.7) {
      // Simulate reconnection
      randomNode.isOnline = true;
      randomNode.signalStrength = Math.floor(Math.random() * 50) + 50;
      this.stats.connectedNodes++;
      
      this.emitEvent({
        type: 'node_connected',
        nodeId: randomNode.nodeId,
        timestamp: Date.now(),
        data: { signalStrength: randomNode.signalStrength }
      });
    }
  }

  private updateNetworkStats(): void {
    const onlineNodes = this.nodes.filter(node => node.isOnline);
    const activeConnections = this.connections.filter(conn => conn.isActive);
    
    this.stats.connectedNodes = onlineNodes.length;
    this.stats.totalNodes = this.nodes.length;
    this.stats.activeConnections = activeConnections.length;
    
    // Calculate coverage radius based on active connections
    const userConnections = activeConnections.filter(conn => 
      conn.fromNodeId === "user" || conn.toNodeId === "user"
    );
    this.stats.coverageRadius = userConnections.length > 0 
      ? Math.max(...userConnections.map(conn => conn.distance))
      : 0;
  }

  private emitEvent(event: NetworkEvent): void {
    this.eventSubscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in network event subscriber:', error);
      }
    });
  }

  subscribeToEvents(callback: (event: NetworkEvent) => void): () => void {
    this.eventSubscribers.add(callback);
    return () => {
      this.eventSubscribers.delete(callback);
    };
  }

  getCurrentStats(): NetworkStats {
    return { ...this.stats };
  }

  getCurrentNodes(): NetworkNode[] {
    return [...this.nodes];
  }

  getCurrentConnections(): NetworkConnection[] {
    return [...this.connections];
  }

  getBLEDevices(): DiscoveredNode[] {
    return [...this.bleDevices];
  }

  getNodePosition(node: NetworkNode): { x: number; y: number } {
    // Convert lat/lng to screen coordinates (simplified)
    // This is a basic projection for demo purposes
    const baseLatitude = 12.9249; // RV College latitude
    const baseLongitude = 77.4996; // RV College longitude
    
    const x = (node.longitude - baseLongitude) * 50000 + 200;
    const y = (baseLatitude - node.latitude) * 50000 + 200;
    
    return { x: Math.max(50, Math.min(350, x)), y: Math.max(50, Math.min(350, y)) };
  }

  isEmergencyMode(): boolean {
    return this.emergencyMode;
  }

  cleanup() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.eventSubscribers.clear();
  }
}

export const networkSimulation = new NetworkSimulation();
