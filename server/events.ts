import type { Request, Response } from "express";

/**
 * Server-Sent Events hub. Every open client (dashboard, map, panel) holds a
 * long-lived GET /api/events connection; broadcastEvent() pushes a named
 * event to all of them instantly — no polling delay for SOS alerts.
 */

const clients = new Set<Response>();

export function sseHandler(req: Request, res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`event: connected\ndata: {"ok":true}\n\n`);

  clients.add(res);

  // Keep proxies from closing the idle stream
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

export function broadcastEvent(eventName: string, data: unknown) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((client) => {
    try {
      client.write(frame);
    } catch {
      clients.delete(client);
    }
  });
}
