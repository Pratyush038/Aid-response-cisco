import { storage } from "./storage";
import { getCiscoUplinkState } from "./cisco";

/**
 * Simulated Cisco Meraki Dashboard API for the MG52 edge gateway.
 *
 * Mirrors the shape of real Meraki endpoints (device status, cellular uplink,
 * traffic analysis) but generates telemetry locally so the demo runs offline.
 * Live numbers (packet counts, client counts, uplink events) are derived from
 * the actual mesh state in storage, so SOS broadcasts move the dashboards.
 */

const GATEWAY_NODE_ID = "cisco-gateway";

let bootedAt = Date.now();
let rebootPendingUntil = 0;

type ThroughputPoint = { t: string; down: number; up: number };

const throughputSeries: ThroughputPoint[] = [];
let lastSamplePoint = { down: 6.2, up: 2.4 };
let lastSampleAt = 0;
const SAMPLE_INTERVAL_MS = 5_000;
const MAX_POINTS = 36;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function jitter(base: number, spread: number): number {
  return base + (Math.random() - 0.5) * 2 * spread;
}

// Random-walk the LTE throughput, backfilling one point per elapsed interval.
function sampleThroughput(): ThroughputPoint[] {
  const now = Date.now();
  if (lastSampleAt === 0) {
    lastSampleAt = now - SAMPLE_INTERVAL_MS * MAX_POINTS;
  }

  while (lastSampleAt + SAMPLE_INTERVAL_MS <= now) {
    lastSampleAt += SAMPLE_INTERVAL_MS;
    lastSamplePoint = {
      down: clamp(jitter(lastSamplePoint.down, 1.6), 1.5, 18),
      up: clamp(jitter(lastSamplePoint.up, 0.7), 0.4, 8),
    };
    throughputSeries.push({
      t: new Date(lastSampleAt).toTimeString().slice(0, 8),
      down: Number(lastSamplePoint.down.toFixed(1)),
      up: Number(lastSamplePoint.up.toFixed(1)),
    });
  }

  if (throughputSeries.length > MAX_POINTS) {
    throughputSeries.splice(0, throughputSeries.length - MAX_POINTS);
  }

  return throughputSeries;
}

export async function getMerakiTelemetry() {
  const nodes = await storage.getAllNodes();
  const messages = await storage.getAllMessages();
  const uplinkState = getCiscoUplinkState();

  const gateway = nodes.find(
    (node) => node.role === GATEWAY_NODE_ID || node.nodeId === GATEWAY_NODE_ID,
  );
  const onlineNodes = nodes.filter((node) => node.isOnline);

  const sosCount = messages.filter((message) => message.messageType === "sos").length;
  const systemCount = messages.filter((message) => message.messageType === "system").length;
  const normalCount = messages.length - sosCount - systemCount;

  const rebooting = Date.now() < rebootPendingUntil;
  const gatewayOnline = Boolean(gateway?.isOnline) && !rebooting;

  return {
    device: {
      model: "Meraki MG52",
      serial: "Q2KD-9J3K-MG52",
      mac: "e0:cb:bc:52:7a:1e",
      firmware: "MG 18.211.2",
      lanIp: "192.168.128.1",
      tags: ["disaster-ops", "edge-gateway", "resqnet"],
      address: "RV College of Engineering, Bengaluru",
    },
    status: {
      state: rebooting ? "rebooting" : gatewayOnline ? "online" : "offline",
      uptimeSeconds: rebooting ? 0 : Math.floor((Date.now() - bootedAt) / 1000),
      lastReportedAt: new Date().toISOString(),
      meshNodeId: gateway?.nodeId ?? GATEWAY_NODE_ID,
      meshSignalStrength: gateway?.signalStrength ?? 0,
    },
    cellular: {
      carrier: "Airtel IN",
      apn: "resqnet.m2m",
      band: "LTE B28 (700 MHz)",
      iccid: "8991 0192 2381 7743 921",
      connectionState: gatewayOnline ? "Connected · Active" : "Searching",
      rsrp: Math.round(clamp(jitter(-84, 3), -110, -70)),
      rsrq: Math.round(clamp(jitter(-9, 1.5), -18, -5)),
      sinr: Math.round(clamp(jitter(18, 2.5), 2, 28)),
      signalBars: gatewayOnline ? 4 : 0,
      failover: "Satellite standby (idle)",
    },
    throughput: sampleThroughput(),
    packetInspection: {
      inspectionMode: "Layer 7 deep packet inspection",
      totalForwarded: 1284 + messages.length * 3,
      sosAlerts: sosCount,
      systemMessages: systemCount,
      meshTelemetry: 412 + normalCount * 2,
      blockedThreats: 3,
      quarantined: 0,
    },
    clients: {
      meshNodesOnline: onlineNodes.length,
      meshNodesTotal: nodes.length,
      lastClient: onlineNodes[onlineNodes.length - 1]?.name ?? "—",
    },
    uplinkEvents: uplinkState.events.slice(0, 8),
    webexRoom: uplinkState.webexRoom,
    cloudRegion: uplinkState.cloudRegion,
  };
}

export function rebootMerakiGateway() {
  bootedAt = Date.now() + 8_000;
  rebootPendingUntil = Date.now() + 8_000;
  return {
    status: "rebooting",
    message: "MG52 reboot scheduled — back online in ~8s",
    etaSeconds: 8,
  };
}
