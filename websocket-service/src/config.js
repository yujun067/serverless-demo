// Centralized configuration
const config = {
  server: {
    port: process.env.PORT || 3000,
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    url: `redis://${process.env.REDIS_HOST || "localhost"}:${
      process.env.REDIS_PORT || 6379
    }`,
  },
  binance: {
    wsUrl: "wss://stream.binance.com:9443/ws/btcusdt@kline_1s",
    maxReconnectAttempts: 10,
    reconnectDelay: 5000, // 5 seconds
    // Using kline_1s stream - updates once per second, contains OHLCV data
  },
  price: {
    cacheKey: "btc_price",
    cacheTTL: 300, // 5 minutes
  },
};

module.exports = config;
