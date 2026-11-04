import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema, insertNetworkNodeSchema } from "@shared/schema";
import { z } from "zod";
import { fireCiscoWebhook, getCiscoUplinkState } from "./cisco";
import { getMerakiTelemetry, rebootMerakiGateway } from "./meraki";
import { groqChatHandler, generateSosAnalysis } from "./ai";
import { setupAuth } from "./auth";
import { sseHandler, broadcastEvent } from "./events";
import { findMeshPath } from "@shared/routing";

const nodeStatusSchema = z.object({
  isOnline: z.boolean(),
  signalStrength: z.number().int().min(0).max(100).optional(),
});

const sosSchema = z.object({
  senderId: z.string().min(1),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  content: z.string().min(1).optional(),
});

const ciscoWebhookSchema = z.object({
  sourceNodeId: z.string().min(1),
  alertType: z.string().min(1).optional(),
  content: z.string().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Sessions + Passport Local + Cisco Duo MFA (must register before routes)
  setupAuth(app);

  // AI Chatbot route
  app.post("/api/chat", groqChatHandler);

  // Network nodes routes
  app.get("/api/nodes", async (req, res) => {
    try {
      const nodes = await storage.getAllNodes();
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch nodes" });
    }
  });

  app.get("/api/nodes/:nodeId", async (req, res) => {
    try {
      const node = await storage.getNode(req.params.nodeId);
      if (!node) {
        return res.status(404).json({ message: "Node not found" });
      }
      res.json(node);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch node" });
    }
  });

  app.post("/api/nodes", async (req, res) => {
    try {
      const nodeData = insertNetworkNodeSchema.parse(req.body);
      const node = await storage.createNode(nodeData);
      res.status(201).json(node);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid node data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create node" });
    }
  });

  app.patch("/api/nodes/:nodeId/status", async (req, res) => {
    try {
      const { isOnline, signalStrength } = nodeStatusSchema.parse(req.body);
      await storage.updateNodeStatus(req.params.nodeId, isOnline, signalStrength);
      res.json({ message: "Node status updated" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid node status", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update node status" });
    }
  });

  // Network connections routes
  app.get("/api/connections", async (req, res) => {
    try {
      const connections = await storage.getAllConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  app.get("/api/connections/:nodeId", async (req, res) => {
    try {
      const connections = await storage.getConnectionsForNode(req.params.nodeId);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch node connections" });
    }
  });

  // Messages routes
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getAllMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/:nodeId", async (req, res) => {
    try {
      const messages = await storage.getMessagesByNode(req.params.nodeId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch node messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);

      // Forward to Webex if destination is the Cisco Gateway
      if (message.receiverId === "cisco-gateway") {
        try {
          const { fireCiscoWebhook } = await import("./cisco");
          fireCiscoWebhook({
            sourceNodeId: message.senderId,
            alertType: "NODE_MESSAGE",
            content: message.content,
          }).catch(e => console.error("Webex webhook background error:", e));
        } catch (e) {
          console.error("Failed to load cisco module:", e);
        }
      }

      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.patch("/api/messages/:messageId/delivered", async (req, res) => {
    try {
      const messageId = Number(req.params.messageId);
      if (!Number.isInteger(messageId)) {
        return res.status(400).json({ message: "Invalid message id" });
      }

      await storage.markMessageDelivered(messageId);
      res.json({ message: "Message marked as delivered" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update message status" });
    }
  });

  app.delete("/api/messages", async (req, res) => {
    try {
      await storage.clearAllMessages();
      res.json({ message: "All messages cleared successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear messages" });
    }
  });

  // User management
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(u => {
        const { password, ...safe } = u;
        return safe;
      });
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users/location", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { latitude, longitude } = req.body;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      const nodes = await storage.getAllNodes();
      const onlineNodes = nodes.filter(n => n.isOnline);
      if (onlineNodes.length === 0) {
        return res.status(400).json({ message: "No online nodes available" });
      }

      let nearestNode = onlineNodes[0];
      let minDistance = Infinity;
      for (const node of onlineNodes) {
        const dx = node.longitude - longitude;
        const dy = node.latitude - latitude;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          minDistance = dist;
          nearestNode = node;
        }
      }

      // @ts-ignore - req.user exists if authenticated
      const updatedUser = await storage.updateUserLocation(req.user.id, latitude, longitude, nearestNode.nodeId);
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  // ---------------------------------------------------------------------
  // SOS broadcast — the flagship emergency pipeline:
  //   1. Compute the real Dijkstra mesh path from the sender to the gateway
  //   2. Groq AI crisis analysis (summary + tactical recommendations)
  //   3. Broadcast SOS messages to every online node
  //   4. Persist the sos_event (powers the Emergency Panel + map overlay)
  //   5. Uplink to Webex Crisis Room WITH the AI analysis attached
  //   6. Push an instant SSE alert to every connected client
  // ---------------------------------------------------------------------
  app.post("/api/sos", async (req, res) => {
    try {
      const { senderId, location, content } = sosSchema.parse(req.body);

      const nodes = await storage.getAllNodes();
      const connections = await storage.getAllConnections();
      const onlineNodes = nodes.filter(node => node.isOnline && node.nodeId !== senderId);
      const sender = nodes.find(node => node.nodeId === senderId);

      const gatewayNode = onlineNodes.find(
        node => node.role === "cisco-gateway" || node.nodeId === "cisco-gateway"
      );

      // Real multi-hop mesh path the SOS takes to reach the uplink gateway
      const onlineIds = nodes.filter(n => n.isOnline).map(n => n.nodeId);
      const usableLinks = connections.filter(
        conn =>
          conn.isActive &&
          onlineIds.includes(conn.fromNodeId) &&
          onlineIds.includes(conn.toNodeId),
      );
      const routingPath =
        (gatewayNode && findMeshPath(onlineIds, usableLinks, senderId, gatewayNode.nodeId)) ||
        (gatewayNode ? [senderId, gatewayNode.nodeId] : [senderId]);

      // Groq crisis analysis (never throws — falls back to offline triage)
      const activeConnections = connections.filter(conn => conn.isActive);
      const analysis = await generateSosAnalysis({
        senderId,
        senderName: sender?.name ?? senderId,
        location,
        content,
        routingPath,
        networkHealth: {
          onlineNodes: onlineIds.length,
          totalNodes: nodes.length,
          activeConnections: activeConnections.length,
          averageLatencyMs: activeConnections.length
            ? Math.round(
                activeConnections.reduce((sum, conn) => sum + conn.latency, 0) /
                  activeConnections.length,
              )
            : 0,
        },
      });

      // Broadcast SOS message to every online node
      const sosMessages = await Promise.all(
        onlineNodes.map(node =>
          storage.createMessage({
            senderId,
            receiverId: node.nodeId,
            content: content || `SOS Alert from ${senderId}. Location: ${location.latitude}, ${location.longitude}`,
            messageType: "sos",
            routingPath: [senderId, node.nodeId],
            hops: 1,
          })
        )
      );

      // Persist the event — powers the Emergency Response Panel + map overlay
      const sosEvent = await storage.createSosEvent({
        senderId,
        latitude: location.latitude,
        longitude: location.longitude,
        content: content ?? null,
        routingPath,
        aiSummary: analysis.summary,
        aiProvider: analysis.provider,
      });

      // Edge gateway bridge: uplink out of the mesh to the Cisco Cloud,
      // with the AI analysis riding along to the Webex Crisis Room.
      let ciscoUplink = null;
      if (gatewayNode) {
        const uplinkEvent = await fireCiscoWebhook({
          sourceNodeId: senderId,
          alertType: "SOS",
          content,
          location,
          routingPath,
          aiSummary: analysis.summary,
        });

        await storage.createMessage({
          senderId: gatewayNode.nodeId,
          receiverId: senderId,
          content: `☁ ${gatewayNode.name}: SOS uplinked to Cisco Cloud over LTE — Webex Crisis Room alerted with Groq AI analysis, Meraki IoT Dashboard synced (${uplinkEvent.latencyMs}ms).`,
          messageType: "system",
          routingPath: [gatewayNode.nodeId, senderId],
          hops: Math.max(routingPath.length - 1, 1),
        });

        ciscoUplink = {
          gatewayNodeId: gatewayNode.nodeId,
          gatewayName: gatewayNode.name,
          event: uplinkEvent,
        };
      }

      // Instant push to every connected client (Emergency Panel, map, toasts)
      broadcastEvent("sos", {
        event: sosEvent,
        senderName: sender?.name ?? senderId,
        recipientCount: onlineNodes.length,
      });

      res.json({
        message: "SOS broadcast sent",
        recipientCount: onlineNodes.length,
        messages: sosMessages,
        sosEvent,
        ciscoUplink,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid SOS payload", errors: error.errors });
      }
      console.error("SOS pipeline failed:", error);
      res.status(500).json({ message: "Failed to broadcast SOS" });
    }
  });

  // Live SOS event feed for the Emergency Response Panel + map overlay
  app.get("/api/sos/events", async (req, res) => {
    try {
      res.json(await storage.getSosEvents());
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch SOS events" });
    }
  });

  app.patch("/api/sos/events/:id/resolve", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: "Invalid SOS event id" });
      }
      await storage.resolveSosEvent(id);
      broadcastEvent("sos-resolved", { id });
      res.json({ message: "SOS event resolved" });
    } catch (error) {
      res.status(500).json({ message: "Failed to resolve SOS event" });
    }
  });

  // Server-Sent Events stream — instant SOS alerts on all connected clients
  app.get("/api/events", sseHandler);

  // Mock Cisco Cloud webhook — simulates the Meraki gateway pushing an alert
  // from the offline mesh to the Cisco Cloud (Webex + Meraki IoT Dashboard).
  app.post("/api/cisco/webhook", async (req, res) => {
    try {
      const payload = ciscoWebhookSchema.parse(req.body);
      const event = await fireCiscoWebhook(payload);
      res.status(200).json({
        status: "success",
        message: "Webex Alert Fired · IoT Dashboard Synced",
        webex: { roomAlerted: true, room: event.webexRoom },
        merakiDashboard: { synced: true, org: "Aid-Response-Disaster-Ops" },
        event,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid webhook payload", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to process Cisco webhook" });
    }
  });

  // Cisco Meraki uplink status + live event log for the dashboard panel
  app.get("/api/cisco/uplink", async (req, res) => {
    try {
      const state = getCiscoUplinkState();
      const nodes = await storage.getAllNodes();
      const gatewayNode = nodes.find(
        node => node.role === "cisco-gateway" || node.nodeId === "cisco-gateway"
      );

      res.json({
        ...state,
        gateway: gatewayNode
          ? {
              nodeId: gatewayNode.nodeId,
              name: gatewayNode.name,
              isOnline: gatewayNode.isOnline,
              signalStrength: gatewayNode.signalStrength,
            }
          : null,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch Cisco uplink status" });
    }
  });

  // Simulated Cisco Meraki Dashboard API — device telemetry for the MG52
  // gateway (cellular backhaul, throughput, packet inspection, client list).
  app.get("/api/meraki/telemetry", async (req, res) => {
    try {
      const telemetry = await getMerakiTelemetry();
      res.json(telemetry);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch Meraki telemetry" });
    }
  });

  app.post("/api/meraki/reboot", async (req, res) => {
    try {
      res.json(rebootMerakiGateway());
    } catch (error) {
      res.status(500).json({ message: "Failed to reboot gateway" });
    }
  });

  // Direct Node-to-Node Messaging
  app.post("/api/messages/direct", async (req, res) => {
    try {
      const schema = z.object({
        senderId: z.string(),
        receiverId: z.string(),
        content: z.string(),
        routingPath: z.array(z.string()),
        hops: z.number()
      });
      const data = schema.parse(req.body);
      
      const message = await storage.createMessage({
        senderId: data.senderId,
        receiverId: data.receiverId,
        content: data.content,
        messageType: "normal",
        routingPath: data.routingPath,
        hops: data.hops
      });

      // Bonus feature: If destination is the Cisco Gateway, trigger Webex
      if (data.receiverId === "cisco-gateway") {
        const nodes = await storage.getAllNodes();
        const gatewayNode = nodes.find(n => (n.nodeId === "cisco-gateway" || n.role === "cisco-gateway") && n.isOnline);
        
        if (gatewayNode) {
          const uplinkEvent = await fireCiscoWebhook({
            sourceNodeId: data.senderId,
            alertType: "DIRECT_MESSAGE",
            content: data.content,
          });

          await storage.createMessage({
            senderId: gatewayNode.nodeId,
            receiverId: data.senderId,
            content: `☁ ${gatewayNode.name}: Direct message uplinked to Cisco Cloud (${uplinkEvent.latencyMs}ms).`,
            messageType: "system",
            routingPath: [gatewayNode.nodeId, data.senderId],
            hops: data.hops
          });
        }
      }

      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid message data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to send message" });
      }
    }
  });


  // Network statistics endpoint
  app.get("/api/network/stats", async (req, res) => {
    try {
      const nodes = await storage.getAllNodes();
      const connections = await storage.getAllConnections();
      const messages = await storage.getAllMessages();
      
      const onlineNodes = nodes.filter(node => node.isOnline);
      const activeConnections = connections.filter(conn => conn.isActive);
      const averageLatency = activeConnections.length > 0 
        ? Math.round(activeConnections.reduce((sum, conn) => sum + conn.latency, 0) / activeConnections.length)
        : 0;
      
      // Calculate coverage radius (max distance from user node)
      const userConnections = activeConnections.filter(conn => 
        conn.fromNodeId === "user" || conn.toNodeId === "user"
      );
      const maxDistance = userConnections.length > 0 
        ? Math.max(...userConnections.map(conn => conn.distance))
        : 0;

      res.json({
        connectedNodes: onlineNodes.length,
        totalNodes: nodes.length,
        activeConnections: activeConnections.length,
        averageLatency,
        coverageRadius: maxDistance,
        totalMessages: messages.length,
        unreadMessages: messages.filter(msg => !msg.isDelivered && msg.receiverId === "user").length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch network statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
