const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

// Import routes
const healthRoutes = require("./routes/health");
const sseRoutes = require("./routes/sse");

// Create Express app
const app = express();

// Security and performance middleware
app.use(helmet());
app.use(compression());

// Enhanced CORS configuration for SSE
app.use(
  cors({
    origin: true, // Allow all origins for development
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"],
    exposedHeaders: ["Content-Type", "Cache-Control"],
  })
);

app.use(express.json());

// Routes
app.use("/health", healthRoutes);
app.use("/sse", sseRoutes.router);

module.exports = app;
