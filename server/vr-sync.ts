import type { Express } from "express";
import { broadcastEvent } from "./events";

/**
 * Relay for the /vr page: lets several devices (for example a laptop and a
 * phone in Cardboard mode) show the same simulation. A device POSTs the action
 * it just performed; the server forwards it to every connected device over the
 * existing Server-Sent Events stream (GET /api/events, event name "vr-sync").
 * The server keeps no state; each device runs its own physics and applies the
 * actions it receives.
 */
const ALLOWED = new Set([
  "hello",
  "state",
  "demolish",
  "rebuild",
  "collapse",
  "shoot",
  "quake",
  "reset",
  "source",
  "settings",
]);

export function registerVrSync(app: Express) {
  app.post("/api/vr/sync", (req, res) => {
    const body = req.body;
    if (
      !body ||
      typeof body.from !== "string" ||
      body.from.length > 64 ||
      typeof body.type !== "string" ||
      !ALLOWED.has(body.type) ||
      JSON.stringify(body).length > 20000
    ) {
      return res.status(400).json({ message: "Invalid sync message" });
    }
    broadcastEvent("vr-sync", body);
    res.json({ ok: true });
  });
}
