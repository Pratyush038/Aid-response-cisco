import { pgTable, text, serial, integer, boolean, timestamp, real, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  nearestNodeId: text("nearest_node_id"),
});

export const networkNodes = pgTable("network_nodes", {
  id: serial("id").primaryKey(),
  nodeId: text("node_id").notNull().unique(),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  isOnline: boolean("is_online").notNull().default(true),
  signalStrength: integer("signal_strength").notNull().default(100),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
  // "standard" LoRa mesh node, or "cisco-gateway" — the Meraki edge gateway
  // that bridges the offline mesh to the Cisco Cloud over cellular backhaul.
  role: text("role").notNull().default("standard"),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  receiverId: text("receiver_id"),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("normal"), // normal, sos, system
  routingPath: text("routing_path").array(),
  hops: integer("hops").notNull().default(1),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  isDelivered: boolean("is_delivered").notNull().default(false),
  encrypted: boolean("encrypted").notNull().default(false),
  signature: text("signature"),
  senderPublicKey: text("sender_public_key"),
});

export const networkConnections = pgTable("network_connections", {
  id: serial("id").primaryKey(),
  fromNodeId: text("from_node_id").notNull(),
  toNodeId: text("to_node_id").notNull(),
  distance: real("distance").notNull(),
  latency: integer("latency").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// One row per SOS trigger — powers the Emergency Response Panel, the map
// overlay, and stores the Grok AI crisis analysis alongside the alert.
export const sosEvents = pgTable("sos_events", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  content: text("content"),
  routingPath: text("routing_path").array(),
  aiSummary: text("ai_summary"),
  aiProvider: text("ai_provider"),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertNetworkNodeSchema = createInsertSchema(networkNodes).omit({
  id: true,
  lastSeen: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
  isDelivered: true,
});

export const insertNetworkConnectionSchema = createInsertSchema(networkConnections).omit({
  id: true,
});

export const insertSosEventSchema = createInsertSchema(sosEvents).omit({
  id: true,
  createdAt: true,
  isResolved: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type NetworkNode = typeof networkNodes.$inferSelect;
export type InsertNetworkNode = z.infer<typeof insertNetworkNodeSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type NetworkConnection = typeof networkConnections.$inferSelect;
export type InsertNetworkConnection = z.infer<typeof insertNetworkConnectionSchema>;
export type SosEvent = typeof sosEvents.$inferSelect;
export type InsertSosEvent = z.infer<typeof insertSosEventSchema>;
