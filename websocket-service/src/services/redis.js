const redis = require("redis");
const config = require("../config");

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.broadcastPrice = null;
  }

  // Set broadcast functions from SSE service
  setBroadcastFunctions(broadcastPrice) {
    this.broadcastPrice = broadcastPrice;
  }

  async initialize() {
    try {
      console.log("Initializing Redis service...");
      console.log(`Redis URL: ${config.redis.url}`);
      console.log(`Redis Host: ${config.redis.host}`);
      console.log(`Redis Port: ${config.redis.port}`);

      this.client = redis.createClient({
        url: config.redis.url,
        retry_strategy: (options) => {
          if (options.error && options.error.code === "ECONNREFUSED") {
            console.error("Redis server refused connection");
            return new Error("Redis server refused connection");
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error("Redis retry time exhausted");
            return new Error("Redis retry time exhausted");
          }
          if (options.attempt > 10) {
            console.error("Redis max retry attempts reached");
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        },
      });

      this.client.on("error", (err) => {
        console.error("Redis Client Error:", err);
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        console.log("Redis service initialized successfully");
        this.isConnected = true;
      });

      this.client.on("end", () => {
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error("Failed to initialize Redis:", error);
      this.isConnected = false;
      throw error;
    }
  }

  async storePriceData(priceData) {
    if (!this.isConnected || !this.client) {
      console.warn("Redis not connected, skipping price storage");
      return;
    }

    try {
      // Process kline data format (only format we expect)
      if (!priceData.e || priceData.e !== "kline" || !priceData.k) {
        console.warn("Received unexpected data format:", priceData.e);
        return;
      }

      const kline = priceData.k;
      const data = {
        price: parseFloat(kline.c), // Close price (current price)
        open_price: parseFloat(kline.o), // Open price
        high_price: parseFloat(kline.h), // High price
        low_price: parseFloat(kline.l), // Low price
        volume: parseFloat(kline.v), // Volume
        quote_volume: parseFloat(kline.q), // Quote volume
        trades_count: parseInt(kline.n), // Number of trades
        timestamp: new Date().toISOString(),
        kline_start_time: new Date(kline.t).toISOString(),
        kline_close_time: new Date(kline.T).toISOString(),
        is_closed: kline.x, // Whether this kline is closed
        event_type: "kline",
      };

      await this.client.setEx(
        config.price.cacheKey,
        config.price.cacheTTL,
        JSON.stringify(data)
      );

      // Broadcast price update to all SSE clients
      if (this.broadcastPrice) {
        this.broadcastPrice(data);
      }
    } catch (error) {
      console.error("Failed to store price data:", error);
    }
  }

  async getPriceData() {
    if (!this.isConnected || !this.client) {
      throw new Error("Redis service unavailable");
    }

    const priceData = await this.client.get(config.price.cacheKey);
    if (!priceData) {
      throw new Error("No price data available");
    }

    return JSON.parse(priceData);
  }

  // Get expired guess tasks
  async getExpiredGuessTasks() {
    if (!this.isConnected || !this.client) {
      console.error("Redis not connected, cannot get expired tasks");
      return [];
    }

    try {
      const now = Date.now();

      // Get expired tasks directly (efficient operation)
      const tasks = await this.client.zRangeByScore("guess_tasks", 0, now);

      if (tasks.length > 0) {
        // Remove expired tasks from Redis
        await this.client.zRemRangeByScore("guess_tasks", 0, now);

        // Parse and return tasks
        const parsedTasks = tasks.map((task) => JSON.parse(task));
        console.log(`Processed ${parsedTasks.length} expired guess tasks`);
        return parsedTasks;
      }

      return [];
    } catch (error) {
      console.error("Failed to get expired guess tasks:", error);
      console.error("Error stack:", error.stack);
      return [];
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      client: !!this.client,
    };
  }

  async quit() {
    if (this.client) {
      await this.client.quit();
    }
  }
}

module.exports = new RedisService();
