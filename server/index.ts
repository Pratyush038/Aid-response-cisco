import "dotenv/config";
import { createApp } from "./app";
import { setupVite, serveStatic, log } from "./vite";

(async () => {
  const { app, server } = await createApp();

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT environment variable or default to 5050
  const port = process.env.PORT || 5050;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`Use the app on http://localhost:${port}/login`);
  });
})();
