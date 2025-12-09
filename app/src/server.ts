import app from "./app";

const PORT = process.env.PORT || 3000;

let serverStarted = false;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  serverStarted = true;
});

function shutdown(signal: string) {
  console.log(`${signal} received: starting graceful shutdown...`);

  if (!serverStarted) return process.exit(0);

  server.close(err => {
    if (err) {
      console.error("Error during server shutdown:", err);
      return process.exit(1);
    }
    console.log("Server closed gracefully.");
    process.exit(0);
  });
}

// Handle graceful shutdown on SIGINT/SIGTERM
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));