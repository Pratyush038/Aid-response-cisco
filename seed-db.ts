import { db } from "./server/db";
import { networkNodes, networkConnections, messages } from "./shared/schema";

async function main() {
  console.log("Dropping old table data...");
  await db.delete(networkNodes);
  await db.delete(networkConnections);
  await db.delete(messages);

  console.log("Inserting all mock data...");
  const defaultNodes = [
    { nodeId: "user", name: "You (RV College)", latitude: 12.9249, longitude: 77.4996, isOnline: true, signalStrength: 100 },
    { nodeId: "rv-gate", name: "RV Gate Station", latitude: 12.9258, longitude: 77.4988, isOnline: true, signalStrength: 95 },
    { nodeId: "mysore-road", name: "Mysore Road Junction", latitude: 12.9240, longitude: 77.4980, isOnline: true, signalStrength: 88 },
    { nodeId: "kengeri", name: "Kengeri Satellite Town", latitude: 12.9180, longitude: 77.4850, isOnline: true, signalStrength: 75 },
    { nodeId: "hoskerehalli", name: "Hoskerehalli Metro", latitude: 12.9300, longitude: 77.4900, isOnline: true, signalStrength: 82 },
    { nodeId: "rajarajeshwari", name: "Rajarajeshwari Nagar", latitude: 12.9150, longitude: 77.5100, isOnline: false, signalStrength: 0 },
    { nodeId: "banashankari", name: "Banashankari BDA", latitude: 12.9280, longitude: 77.5200, isOnline: true, signalStrength: 70 },
    { nodeId: "jayanagar", name: "Jayanagar 9th Block", latitude: 12.9350, longitude: 77.5850, isOnline: true, signalStrength: 65 },
    { nodeId: "vijayanagar", name: "Vijayanagar Metro", latitude: 12.9750, longitude: 77.5380, isOnline: true, signalStrength: 78 },
    { nodeId: "magadi-road", name: "Magadi Road Hospital", latitude: 12.9320, longitude: 77.4750, isOnline: false, signalStrength: 0 },
    { nodeId: "nandini-layout", name: "Nandini Layout", latitude: 12.9380, longitude: 77.4920, isOnline: true, signalStrength: 85 },
    { nodeId: "peenya", name: "Peenya Industrial Area", latitude: 13.0280, longitude: 77.5200, isOnline: true, signalStrength: 72 },
    { nodeId: "cisco-gateway", name: "Cisco Meraki Gateway (MG52)", latitude: 12.9268, longitude: 77.5035, isOnline: true, signalStrength: 97, role: "cisco-gateway" }
  ];

  await db.insert(networkNodes).values(defaultNodes);

  const defaultConnections = [
    { fromNodeId: "user", toNodeId: "rv-gate", distance: 0.2, latency: 25, isActive: true },
    { fromNodeId: "user", toNodeId: "mysore-road", distance: 0.5, latency: 35, isActive: true },
    { fromNodeId: "user", toNodeId: "hoskerehalli", distance: 1.8, latency: 65, isActive: true },
    { fromNodeId: "rv-gate", toNodeId: "mysore-road", distance: 0.4, latency: 30, isActive: true },
    { fromNodeId: "rv-gate", toNodeId: "nandini-layout", distance: 1.2, latency: 50, isActive: true },
    { fromNodeId: "mysore-road", toNodeId: "kengeri", distance: 2.1, latency: 75, isActive: true },
    { fromNodeId: "mysore-road", toNodeId: "magadi-road", distance: 1.5, latency: 60, isActive: false },
    { fromNodeId: "mysore-road", toNodeId: "banashankari", distance: 2.8, latency: 90, isActive: true },
    { fromNodeId: "hoskerehalli", toNodeId: "nandini-layout", distance: 0.8, latency: 40, isActive: true },
    { fromNodeId: "hoskerehalli", toNodeId: "vijayanagar", distance: 4.2, latency: 120, isActive: true },
    { fromNodeId: "hoskerehalli", toNodeId: "peenya", distance: 8.5, latency: 180, isActive: true },
    { fromNodeId: "banashankari", toNodeId: "rajarajeshwari", distance: 1.8, latency: 70, isActive: false },
    { fromNodeId: "banashankari", toNodeId: "jayanagar", distance: 4.5, latency: 110, isActive: true },
    { fromNodeId: "kengeri", toNodeId: "rajarajeshwari", distance: 2.2, latency: 80, isActive: false },
    { fromNodeId: "nandini-layout", toNodeId: "vijayanagar", distance: 3.8, latency: 100, isActive: true },
    { fromNodeId: "vijayanagar", toNodeId: "jayanagar", distance: 3.2, latency: 95, isActive: true },
    { fromNodeId: "vijayanagar", toNodeId: "peenya", distance: 5.1, latency: 130, isActive: true },
    { fromNodeId: "user", toNodeId: "cisco-gateway", distance: 0.6, latency: 22, isActive: true },
    { fromNodeId: "rv-gate", toNodeId: "cisco-gateway", distance: 0.8, latency: 28, isActive: true },
    { fromNodeId: "banashankari", toNodeId: "cisco-gateway", distance: 1.9, latency: 55, isActive: true }
  ];

  await db.insert(networkConnections).values(defaultConnections);

  const sampleMessages = [
    { senderId: "rv-gate", receiverId: "user", content: "Welcome to Aid-Response! Emergency communication network is now active in your area.", messageType: "system", routingPath: ["rv-gate", "user"], hops: 1 },
    { senderId: "hoskerehalli", receiverId: "user", content: "Medical supplies needed at metro station. Can anyone assist?", messageType: "normal", routingPath: ["hoskerehalli", "user"], hops: 1 }
  ];
  
  await db.insert(messages).values(sampleMessages);

  const nodes = await db.select().from(networkNodes);
  console.log(`\nSuccessfully inserted and retrieved ${nodes.length} nodes from PostgreSQL!`);
  
  process.exit(0);
}

main().catch(console.error);
