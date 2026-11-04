export interface NetworkNode {
  id: number;
  nodeId: string;
  name: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
  signalStrength: number;
  lastSeen: Date;
  role?: "standard" | "cisco-gateway";
}

export interface CiscoUplinkEvent {
  id: string;
  timestamp: string;
  sourceNodeId: string;
  alertType: string;
  status: "success" | "forwarding";
  channels: string[];
  logLines: string[];
  webexRoom: string;
  latencyMs: number;
}

export interface MerakiTelemetry {
  device: {
    model: string;
    serial: string;
    mac: string;
    firmware: string;
    lanIp: string;
    tags: string[];
    address: string;
  };
  status: {
    state: "online" | "offline" | "rebooting";
    uptimeSeconds: number;
    lastReportedAt: string;
    meshNodeId: string;
    meshSignalStrength: number;
  };
  cellular: {
    carrier: string;
    apn: string;
    band: string;
    iccid: string;
    connectionState: string;
    rsrp: number;
    rsrq: number;
    sinr: number;
    signalBars: number;
    failover: string;
  };
  throughput: { t: string; down: number; up: number }[];
  packetInspection: {
    inspectionMode: string;
    totalForwarded: number;
    sosAlerts: number;
    systemMessages: number;
    meshTelemetry: number;
    blockedThreats: number;
    quarantined: number;
  };
  clients: {
    meshNodesOnline: number;
    meshNodesTotal: number;
    lastClient: string;
  };
  uplinkEvents: CiscoUplinkEvent[];
  webexRoom: string;
  cloudRegion: string;
}

export interface CiscoUplinkState {
  uplinkStatus: "online" | "offline";
  transport: string;
  failover: string;
  gatewayHealth: "active" | "degraded";
  cloudRegion: string;
  webexRoom: string;
  totalUplinks: number;
  events: CiscoUplinkEvent[];
  gateway: {
    nodeId: string;
    name: string;
    isOnline: boolean;
    signalStrength: number;
  } | null;
}

export interface NetworkConnection {
  id: number;
  fromNodeId: string;
  toNodeId: string;
  distance: number;
  latency: number;
  isActive: boolean;
}

export interface Message {
  id: number;
  senderId: string;
  receiverId?: string;
  content: string;
  messageType: "normal" | "sos" | "system";
  routingPath?: string[];
  hops: number;
  timestamp: Date;
  isDelivered: boolean;
  encrypted?: boolean;
  signature?: string;
  senderPublicKey?: string;
  integrityValid?: boolean;
}

export interface NetworkStats {
  connectedNodes: number;
  totalNodes: number;
  activeConnections: number;
  averageLatency: number;
  coverageRadius: number;
  totalMessages: number;
  unreadMessages: number;
}

export interface GraphNode {
  id: string;
  name: string;
  position: { x: number; y: number };
  isOnline: boolean;
  signalStrength: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
  isActive: boolean;
}

export interface RoutingResult {
  path: string[];
  totalDistance: number;
  hops: number;
}

// Persisted SOS alert with Groq AI crisis analysis (Emergency Response Panel)
export interface SosEvent {
  id: number;
  senderId: string;
  latitude: number;
  longitude: number;
  content: string | null;
  routingPath: string[] | null;
  aiSummary: string | null;
  aiProvider: string | null;
  isResolved: boolean;
  createdAt: string;
}
