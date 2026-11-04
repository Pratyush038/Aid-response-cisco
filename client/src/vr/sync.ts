// Multi-device sync for /vr (see server/vr-sync.ts).
//
// Each device runs its own physics. What is shared is the list of ACTIONS
// (demolish, shoot, quake, reset, source, settings) and the OUTCOMES that
// matter (which buildings collapsed). Physics is not bit-for-bit identical on
// two devices, so a collapse seen on one device is also sent as an explicit
// "collapse" message and forced on the others. Routing then agrees everywhere
// because it is derived from the same set of dead nodes.

export interface SyncMessage {
  type:
    | "hello"
    | "state"
    | "demolish"
    | "rebuild"
    | "collapse"
    | "shoot"
    | "quake"
    | "reset"
    | "source"
    | "settings";
  id?: string;
  ids?: string[];
  dead?: string[];
  nodeId?: string;
  origin?: [number, number, number];
  target?: [number, number, number];
  gravity?: number;
  intensity?: number;
  slowMo?: boolean;
  droneOn?: boolean;
}

/** Unique per page load, so a device can ignore its own echoes. */
export const CLIENT_ID = Math.random().toString(36).slice(2, 10);

export function sendSync(msg: SyncMessage) {
  void fetch("/api/vr/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: CLIENT_ID, ...msg }),
  }).catch(() => {});
}

/** Listen for messages from OTHER devices. Returns an unsubscribe function. */
export function subscribeSync(
  onMessage: (m: SyncMessage) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  const es = new EventSource("/api/events");
  es.onopen = () => onStatus(true);
  es.onerror = () => onStatus(false);
  es.addEventListener("vr-sync", (e) => {
    try {
      const m = JSON.parse((e as MessageEvent).data) as SyncMessage & { from: string };
      if (m.from !== CLIENT_ID) onMessage(m);
    } catch {
      // ignore malformed
    }
  });
  return () => es.close();
}
