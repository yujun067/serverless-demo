const app = require("./app");
const config = require("./config");
const redisService = require("./services/redis");
const binanceService = require("./services/binance");
const workerService = require("./services/worker");
const { broadcastPrice } = require("./routes/sse");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await shutdown();
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await shutdown();
});

async function shutdown() {
  console.log("Starting graceful shutdown...");
  try {
    console.log("Closing Binance WebSocket connection...");
    binanceService.close();

    console.log("Stopping worker service...");
    await workerService.stop();

    console.log("Closing Redis connection...");
    await redisService.quit();

    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

// Initialize services and start server
async function startServer() {
  try {
    console.log("=== Starting Bitcoin WebSocket Service ===");
    console.log("Environment variables:");
    console.log("- REDIS_HOST:", process.env.REDIS_HOST);
    console.log("- REDIS_PORT:", process.env.REDIS_PORT);
    console.log("- DYNAMODB_TABLE:", process.env.DYNAMODB_TABLE);
    console.log("- AWS_REGION:", process.env.AWS_REGION);

    // Initialize Redis first
    console.log("1. Initializing Redis service...");
    await redisService.initialize();
    console.log("✓ Redis service initialized successfully");

    // Set broadcast functions for Redis service
    console.log("2. Setting up broadcast functions...");
    redisService.setBroadcastFunctions(broadcastPrice);
    console.log("✓ Broadcast functions configured");

    // Initialize Binance WebSocket
    console.log("3. Initializing Binance WebSocket service...");
    binanceService.initialize();
    console.log("✓ Binance WebSocket service initialized");

    // Start worker service
    console.log("4. Starting guess resolution worker...");
    await workerService.start();
    console.log("✓ Guess resolution worker started successfully");

    // Start Express server
    console.log("5. Starting Express server...");
    app.listen(config.server.port, () => {
      console.log("=== Server Startup Complete ===");
      console.log(
        `✓ Bitcoin WebSocket Service running on port ${config.server.port}`
      );
      console.log(
        `✓ Health check: http://localhost:${config.server.port}/health`
      );
      console.log(
        `✓ SSE endpoint: http://localhost:${config.server.port}/sse/price`
      );
      console.log("=== All services are ready ===");
    });
  } catch (error) {
    console.error("=== CRITICAL ERROR: Failed to start server ===");
    console.error("Error details:", error);
    console.error("Error stack:", error.stack);
    console.error("=== Server startup failed ===");
    process.exit(1);
  }
}

// Start the server
startServer();
