import {
  users,
  networkNodes,
  messages,
  networkConnections,
  sosEvents,
  type User,
  type InsertUser,
  type NetworkNode,
  type InsertNetworkNode,
  type Message,
  type InsertMessage,
  type NetworkConnection,
  type InsertNetworkConnection,
  type SosEvent,
  type InsertSosEvent
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserLocation(id: number, lat: number, lng: number, nearestNodeId: string): Promise<User>;
  
  // Network nodes
  getAllNodes(): Promise<NetworkNode[]>;
  getNode(nodeId: string): Promise<NetworkNode | undefined>;
  createNode(node: InsertNetworkNode): Promise<NetworkNode>;
  updateNodeStatus(nodeId: string, isOnline: boolean, signalStrength?: number): Promise<void>;
  
  // Messages
  getAllMessages(): Promise<Message[]>;
  getMessagesByNode(nodeId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageDelivered(messageId: number): Promise<void>;
  
  // Network connections
  getAllConnections(): Promise<NetworkConnection[]>;
  getConnectionsForNode(nodeId: string): Promise<NetworkConnection[]>;
  createConnection(connection: InsertNetworkConnection): Promise<NetworkConnection>;
  updateConnectionStatus(fromNodeId: string, toNodeId: string, isActive: boolean): Promise<void>;
  
  // Clear all messages
  clearAllMessages(): Promise<void>;

  // SOS events (Emergency Response Panel)
  createSosEvent(event: InsertSosEvent): Promise<SosEvent>;
  getSosEvents(limit?: number): Promise<SosEvent[]>;
  resolveSosEvent(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeDefaultData();
  }

  async initializeDefaultData() {
    try {
      // Check if data already exists
      const existingNodes = await db.select().from(networkNodes).limit(1);
      if (existingNodes.length > 0) {
        // Data exists from an earlier version — additively ensure the Cisco
        // Meraki gateway node is present without touching existing rows.
        await this.ensureCiscoGateway();
        await this.reconcileConnectionStates();
        return;
      }

      // Initialize default network nodes around RV College, Bangalore with more realistic coverage
      const defaultNodes: InsertNetworkNode[] = [
        {
          nodeId: "user",
          name: "You (RV College)",
          latitude: 12.9249,
          longitude: 77.4996,
          isOnline: true,
          signalStrength: 100,
        },
        {
          nodeId: "rv-gate",
          name: "RV Gate Station",
          latitude: 12.9258,
          longitude: 77.4988,
          isOnline: true,
          signalStrength: 95,
        },
        {
          nodeId: "mysore-road",
          name: "Mysore Road Junction",
          latitude: 12.9240,
          longitude: 77.4980,
          isOnline: true,
          signalStrength: 88,
        },
        {
          nodeId: "kengeri",
          name: "Kengeri Satellite Town",
          latitude: 12.9180,
          longitude: 77.4850,
          isOnline: true,
          signalStrength: 75,
        },
        {
          nodeId: "hoskerehalli",
          name: "Hoskerehalli Metro",
          latitude: 12.9300,
          longitude: 77.4900,
          isOnline: true,
          signalStrength: 82,
        },
        {
          nodeId: "rajarajeshwari",
          name: "Rajarajeshwari Nagar",
          latitude: 12.9150,
          longitude: 77.5100,
          isOnline: false,
          signalStrength: 0,
        },
        {
          nodeId: "banashankari",
          name: "Banashankari BDA",
          latitude: 12.9280,
          longitude: 77.5200,
          isOnline: true,
          signalStrength: 70,
        },
        {
          nodeId: "jayanagar",
          name: "Jayanagar 9th Block",
          latitude: 12.9350,
          longitude: 77.5850,
          isOnline: true,
          signalStrength: 65,
        },
        {
          nodeId: "vijayanagar",
          name: "Vijayanagar Metro",
          latitude: 12.9750,
          longitude: 77.5380,
          isOnline: true,
          signalStrength: 78,
        },
        {
          nodeId: "magadi-road",
          name: "Magadi Road Hospital",
          latitude: 12.9320,
          longitude: 77.4750,
          isOnline: false,
          signalStrength: 0,
        },
        {
          nodeId: "nandini-layout",
          name: "Nandini Layout",
          latitude: 12.9380,
          longitude: 77.4920,
          isOnline: true,
          signalStrength: 85,
        },
        {
          nodeId: "peenya",
          name: "Peenya Industrial Area",
          latitude: 13.0280,
          longitude: 77.5200,
          isOnline: true,
          signalStrength: 72,
        },
        {
          nodeId: "cisco-gateway",
          name: "Cisco Meraki Gateway (MG52)",
          latitude: 12.9268,
          longitude: 77.5035,
          isOnline: true,
          signalStrength: 97,
          role: "cisco-gateway",
        }
      ];

      // Insert nodes
      await db.insert(networkNodes).values(defaultNodes);

      // Initialize default connections with realistic mesh topology
      const defaultConnections: InsertNetworkConnection[] = [
        // Direct connections from user node
        { fromNodeId: "user", toNodeId: "rv-gate", distance: 0.2, latency: 25, isActive: true },
        { fromNodeId: "user", toNodeId: "mysore-road", distance: 0.5, latency: 35, isActive: true },
        { fromNodeId: "user", toNodeId: "hoskerehalli", distance: 1.8, latency: 65, isActive: true },
        
        // RV Gate connections
        { fromNodeId: "rv-gate", toNodeId: "mysore-road", distance: 0.4, latency: 30, isActive: true },
        { fromNodeId: "rv-gate", toNodeId: "nandini-layout", distance: 1.2, latency: 50, isActive: true },
        
        // Mysore Road hub connections
        { fromNodeId: "mysore-road", toNodeId: "kengeri", distance: 2.1, latency: 75, isActive: true },
        { fromNodeId: "mysore-road", toNodeId: "magadi-road", distance: 1.5, latency: 60, isActive: false },
        { fromNodeId: "mysore-road", toNodeId: "banashankari", distance: 2.8, latency: 90, isActive: true },
        
        // Hoskerehalli connections
        { fromNodeId: "hoskerehalli", toNodeId: "nandini-layout", distance: 0.8, latency: 40, isActive: true },
        { fromNodeId: "hoskerehalli", toNodeId: "vijayanagar", distance: 4.2, latency: 120, isActive: true },
        { fromNodeId: "hoskerehalli", toNodeId: "peenya", distance: 8.5, latency: 180, isActive: true },
        
        // Banashankari connections
        { fromNodeId: "banashankari", toNodeId: "rajarajeshwari", distance: 1.8, latency: 70, isActive: false },
        { fromNodeId: "banashankari", toNodeId: "jayanagar", distance: 4.5, latency: 110, isActive: true },
        
        // Extended mesh connections
        { fromNodeId: "kengeri", toNodeId: "rajarajeshwari", distance: 2.2, latency: 80, isActive: false },
        { fromNodeId: "nandini-layout", toNodeId: "vijayanagar", distance: 3.8, latency: 100, isActive: true },
        { fromNodeId: "vijayanagar", toNodeId: "jayanagar", distance: 3.2, latency: 95, isActive: true },
        { fromNodeId: "vijayanagar", toNodeId: "peenya", distance: 5.1, latency: 130, isActive: true },

        // Cisco Meraki gateway backhaul links into the mesh
        { fromNodeId: "user", toNodeId: "cisco-gateway", distance: 0.6, latency: 22, isActive: true },
        { fromNodeId: "rv-gate", toNodeId: "cisco-gateway", distance: 0.8, latency: 28, isActive: true },
        { fromNodeId: "banashankari", toNodeId: "cisco-gateway", distance: 1.9, latency: 55, isActive: true },
      ];

      // Insert connections
      await db.insert(networkConnections).values(defaultConnections);

      // Initialize some sample messages
      const sampleMessages: InsertMessage[] = [
        {
          senderId: "rv-gate",
          receiverId: "user",
          content: "Welcome to Aid-Response! Emergency communication network is now active in your area.",
          messageType: "system",
          routingPath: ["rv-gate", "user"],
          hops: 1,
        },
        {
          senderId: "hoskerehalli",
          receiverId: "user",
          content: "Medical supplies needed at metro station. Can anyone assist?",
          messageType: "normal",
          routingPath: ["hoskerehalli", "user"],
          hops: 1,
        }
      ];

      // Insert messages
      await db.insert(messages).values(sampleMessages);
    } catch (error) {
      console.error("Database initialization failed:", error);
    }
  }

  private async ensureCiscoGateway() {
    const [gateway] = await db
      .select()
      .from(networkNodes)
      .where(eq(networkNodes.nodeId, "cisco-gateway"));
    if (gateway) return;

    await db.insert(networkNodes).values({
      nodeId: "cisco-gateway",
      name: "Cisco Meraki Gateway (MG52)",
      latitude: 12.9268,
      longitude: 77.5035,
      isOnline: true,
      signalStrength: 97,
      role: "cisco-gateway",
    });

    await db.insert(networkConnections).values([
      { fromNodeId: "user", toNodeId: "cisco-gateway", distance: 0.6, latency: 22, isActive: true },
      { fromNodeId: "rv-gate", toNodeId: "cisco-gateway", distance: 0.8, latency: 28, isActive: true },
      { fromNodeId: "banashankari", toNodeId: "cisco-gateway", distance: 1.9, latency: 55, isActive: true },
    ]);
  }

  // Heal any impossible link state (active link touching an offline node),
  // e.g. left behind by an older buggy cascade or hand-edited data.
  private async reconcileConnectionStates() {
    const allNodes = await db.select().from(networkNodes);
    const onlineIds = new Set(
      allNodes.filter((node: NetworkNode) => node.isOnline).map((node: NetworkNode) => node.nodeId),
    );
    const allConnections = await db.select().from(networkConnections);

    for (const conn of allConnections) {
      const endpointsOnline = onlineIds.has(conn.fromNodeId) && onlineIds.has(conn.toNodeId);
      if (conn.isActive && !endpointsOnline) {
        await db
          .update(networkConnections)
          .set({ isActive: false })
          .where(eq(networkConnections.id, conn.id));
      }
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserLocation(id: number, lat: number, lng: number, nearestNodeId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ latitude: lat, longitude: lng, nearestNodeId })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllNodes(): Promise<NetworkNode[]> {
    return await db.select().from(networkNodes);
  }

  async getNode(nodeId: string): Promise<NetworkNode | undefined> {
    const [node] = await db.select().from(networkNodes).where(eq(networkNodes.nodeId, nodeId));
    return node || undefined;
  }

  async createNode(node: InsertNetworkNode): Promise<NetworkNode> {
    const [newNode] = await db
      .insert(networkNodes)
      .values(node)
      .returning();
    return newNode;
  }

  async updateNodeStatus(nodeId: string, isOnline: boolean, signalStrength?: number): Promise<void> {
    const updateData: any = { isOnline, lastSeen: new Date() };
    if (signalStrength !== undefined) {
      updateData.signalStrength = signalStrength;
    }

    await db
      .update(networkNodes)
      .set(updateData)
      .where(eq(networkNodes.nodeId, nodeId));

    // DEMO LOGIC: Automatically kill or restore any physical connections attached
    // to this node. Restoring only re-activates a link when the peer node is also
    // online, so a link between two dead nodes stays down until both recover.
    const allNodes = await db.select().from(networkNodes);
    const allConnections = await db.select().from(networkConnections);
    const touching = allConnections.filter(
      (conn: NetworkConnection) => conn.fromNodeId === nodeId || conn.toNodeId === nodeId,
    );

    for (const conn of touching) {
      const peerId = conn.fromNodeId === nodeId ? conn.toNodeId : conn.fromNodeId;
      const peer = allNodes.find((node: NetworkNode) => node.nodeId === peerId);
      const nextActive = isOnline && Boolean(peer?.isOnline);

      await db
        .update(networkConnections)
        .set({ isActive: nextActive })
        .where(eq(networkConnections.id, conn.id));
    }
  }

  async getAllMessages(): Promise<Message[]> {
    return await db.select().from(messages).orderBy(messages.timestamp);
  }

  async getMessagesByNode(nodeId: string): Promise<Message[]> {
    const allMessages = await db.select().from(messages).orderBy(messages.timestamp);
    return allMessages.filter(
      (message: Message) =>
        message.senderId === nodeId || message.receiverId === nodeId,
    );
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    return newMessage;
  }

  async markMessageDelivered(messageId: number): Promise<void> {
    await db
      .update(messages)
      .set({ isDelivered: true })
      .where(eq(messages.id, messageId));
  }

  async getAllConnections(): Promise<NetworkConnection[]> {
    return await db.select().from(networkConnections);
  }

  async getConnectionsForNode(nodeId: string): Promise<NetworkConnection[]> {
    const connections = await db.select().from(networkConnections);
    return connections.filter(
      (connection: NetworkConnection) =>
        connection.fromNodeId === nodeId || connection.toNodeId === nodeId,
    );
  }

  async createConnection(connection: InsertNetworkConnection): Promise<NetworkConnection> {
    const [newConnection] = await db
      .insert(networkConnections)
      .values(connection)
      .returning();
    return newConnection;
  }

  async updateConnectionStatus(fromNodeId: string, toNodeId: string, isActive: boolean): Promise<void> {
    await db
      .update(networkConnections)
      .set({ isActive })
      .where(
        and(
          eq(networkConnections.fromNodeId, fromNodeId),
          eq(networkConnections.toNodeId, toNodeId),
        ),
      );
  }

  async clearAllMessages(): Promise<void> {
    await db.delete(messages);
  }

  async createSosEvent(event: InsertSosEvent): Promise<SosEvent> {
    const [row] = await db.insert(sosEvents).values(event).returning();
    return row;
  }

  async getSosEvents(limit = 25): Promise<SosEvent[]> {
    return await db
      .select()
      .from(sosEvents)
      .orderBy(desc(sosEvents.createdAt))
      .limit(limit);
  }

  async resolveSosEvent(id: number): Promise<void> {
    await db.update(sosEvents).set({ isResolved: true }).where(eq(sosEvents.id, id));
  }
}

export const storage = new DatabaseStorage();
