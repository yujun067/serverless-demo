const express = require("express");
const jwtUtils = require("../utils/jwt");
const router = express.Router();

// Store connected clients with user mapping
const clients = new Set();
const userClientMap = new Map(); // userId -> client (one-to-one mapping)

// SSE endpoint for price updates
router.get("/price", (req, res) => {
  // Verify JWT token
  const authHeader = req.headers.authorization;
  const tokenVerification = jwtUtils.verifyToken(authHeader);

  if (!tokenVerification.success) {
    console.error("JWT verification failed:", tokenVerification.error);
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired JWT token",
    });
    return;
  }

  const { userId, username } = tokenVerification;
  console.log(`SSE connection authenticated for user: ${username} (${userId})`);

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable proxy buffering
    "Transfer-Encoding": "chunked", // Enable chunked transfer
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Cache-Control, Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Credentials": "true",
  });

  // Send initial connection message - ensure proper SSE format
  res.write(
    'data: {"type":"connection","message":"Connected to price stream"}\n\n'
  );

  // Force flush the response to ensure immediate delivery
  res.flushHeaders && res.flushHeaders();
  res.flush && res.flush();

  // Add user info to the response object for later use
  res.userId = userId;
  res.username = username;

  // Add client to global set
  clients.add(res);

  // Handle existing connection for this user (disconnect previous client)
  if (userClientMap.has(userId)) {
    const existingClient = userClientMap.get(userId);
    console.log(
      `Disconnecting existing client for user ${username} (${userId})`
    );
    try {
      existingClient.end();
    } catch (error) {
      console.error("Error closing existing client:", error);
    }
    clients.delete(existingClient);
  }

  // Add client to user-specific mapping (one-to-one)
  userClientMap.set(userId, res);

  console.log(
    `SSE client connected for user ${username} (${userId}), total clients: ${clients.size}`
  );

  // Helper function to clean up client
  const cleanupClient = () => {
    clients.delete(res);

    // Remove from user-specific mapping if this is the current client for the user
    if (res.userId && userClientMap.has(res.userId)) {
      const currentClient = userClientMap.get(res.userId);
      if (currentClient === res) {
        userClientMap.delete(res.userId);
      }
    }

    console.log(
      `SSE client disconnected for user ${res.username || "unknown"} (${
        res.userId || "unknown"
      }), total clients: ${clients.size}`
    );
  };

  // Send immediate test messages to ensure connection works
  setTimeout(() => {
    try {
      if (clients.has(res)) {
        console.log("Sending test message to client");
        res.write('data: {"type":"test","message":"Connection test"}\n\n');
        res.flush && res.flush();
      }
    } catch (error) {
      console.error("Error sending test message:", error);
      cleanupClient();
    }
  }, 200);

  // Send another test message after 1 second
  setTimeout(() => {
    try {
      if (clients.has(res)) {
        console.log("Sending delayed test message to client");
        res.write(
          'data: {"type":"test","message":"Delayed connection test"}\n\n'
        );
        res.flush && res.flush();
      }
    } catch (error) {
      console.error("Error sending delayed test message:", error);
      cleanupClient();
    }
  }, 1000);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch (error) {
      console.error("Error sending heartbeat:", error);
      clearInterval(heartbeatInterval);
      cleanupClient();
    }
  }, 30000);

  // Handle client disconnect
  req.on("close", () => {
    clearInterval(heartbeatInterval);
    cleanupClient();
  });

  // Handle connection errors
  req.on("error", (error) => {
    console.error("SSE connection error:", error);
    clearInterval(heartbeatInterval);
    cleanupClient();
  });

  console.log("SSE client connected, total clients:", clients.size);
});

// Function to broadcast price updates to all connected clients
const broadcastPrice = (priceData) => {
  const message = `data: ${JSON.stringify({
    type: "price_update",
    data: priceData,
    timestamp: new Date().toISOString(),
  })}\n\n`;

  const disconnectedClients = [];

  clients.forEach((client) => {
    try {
      client.write(message);
      // Force flush to ensure immediate delivery
      client.flush && client.flush();
    } catch (error) {
      console.error("Error sending SSE message:", error);
      disconnectedClients.push(client);
    }
  });

  // Clean up disconnected clients
  disconnectedClients.forEach((client) => {
    clients.delete(client);
  });
};

// Function to send point-to-point message to specific user
const sendToUser = (userId, result) => {
  console.log(`Sending message to user ${userId}:`, result);

  if (!userClientMap.has(userId)) {
    console.log(`No connected client found for user ${userId}`);
    return false;
  }

  const client = userClientMap.get(userId);
  const message = `data: ${JSON.stringify({
    type: "guess_result",
    data: result,
    timestamp: new Date().toISOString(),
  })}\n\n`;

  try {
    client.write(message);
    // Force flush to ensure immediate delivery
    client.flush && client.flush();
    console.log(`Message sent to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error sending SSE message to user ${userId}:`, error);

    // Clean up disconnected client
    clients.delete(client);
    userClientMap.delete(userId);

    console.log(`Cleaned up disconnected client for user ${userId}`);
    return false;
  }
};

module.exports = { router, broadcastPrice, sendToUser };
