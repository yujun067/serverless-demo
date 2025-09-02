const express = require("express");
const redisService = require("../services/redis");
const binanceService = require("../services/binance");

const router = express.Router();

router.get("/", (req, res) => {
  const redisStatus = redisService.getStatus();
  const binanceStatus = binanceService.getStatus();

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      redis: redisStatus.connected ? "connected" : "disconnected",
      binance: binanceStatus.connected ? "connected" : "disconnected",
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    reconnectAttempts: binanceStatus.reconnectAttempts,
  };

  const statusCode =
    redisStatus.connected && binanceStatus.connected ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
