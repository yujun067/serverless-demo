const WebSocket = require("ws");
const config = require("../config");
const redisService = require("./redis");

class BinanceService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.binance.maxReconnectAttempts;
    this.reconnectDelay = config.binance.reconnectDelay;
  }

  initialize() {
    try {
      console.log("Connecting to Binance Kline 1s WebSocket...");
      this.connect();
    } catch (error) {
      console.error("Failed to initialize Binance WebSocket:", error);
    }
  }

  connect() {
    try {
      this.ws = new WebSocket(config.binance.wsUrl);

      this.ws.on("open", () => {
        console.log("Connected to Binance Kline 1s WebSocket");
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.ws.on("message", async (data) => {
        try {
          const klineData = JSON.parse(data);
          // Process kline_1s stream data (updates once per second)
          await redisService.storePriceData(klineData);
        } catch (error) {
          console.error("Error processing Binance kline message:", error);
        }
      });

      this.ws.on("error", (error) => {
        console.error("Binance WebSocket error:", error);
        this.isConnected = false;
      });

      this.ws.on("close", (code, reason) => {
        console.log(`Binance WebSocket closed: ${code} - ${reason}`);
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on("ping", () => {
        this.ws.pong();
      });
    } catch (error) {
      console.error("Failed to connect to Binance WebSocket:", error);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        30000
      );
      console.log(
        `Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`
      );

      setTimeout(() => {
        console.log(
          `Reconnecting to Binance WebSocket (attempt ${this.reconnectAttempts})`
        );
        this.connect();
      }, delay);
    } else {
      console.error("Max reconnection attempts reached for Binance WebSocket");
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      streamType: "kline_1s",
    };
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = new BinanceService();
