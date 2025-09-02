const redis = require("redis");

// Redis client configuration
let redisClient = null;

const getRedisClient = async () => {
  if (!redisClient) {
    redisClient = redis.createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    });

    redisClient.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    await redisClient.connect();
  }
  return redisClient;
};

// Price operations
const getLatestPrice = async () => {
  const client = await getRedisClient();
  const price = await client.get("btc_price");
  return price ? JSON.parse(price) : null;
};

const setPrice = async (priceData) => {
  const client = await getRedisClient();
  await client.set("btc_price", JSON.stringify(priceData), { EX: 300 }); // 5 minutes TTL
};

// Guess task operations
const addGuessTask = async (userId, guessData, resolveTime) => {
  const client = await getRedisClient();

  const task = {
    userId,
    guessData,
    createdAt: new Date().toISOString(),
  };

  console.log(`Adding guess task to Redis`);

  // Use a more explicit approach to avoid data corruption
  const score = resolveTime.getTime();
  const value = JSON.stringify(task);

  // Add task to Redis sorted set
  const result = await client.zAdd("guess_tasks", [
    {
      score: score,
      value: value,
    },
  ]);

  console.log(
    `Guess task added for user ${userId}, resolve time: ${resolveTime.toISOString()}`
  );
};

module.exports = {
  getRedisClient,
  getLatestPrice,
  setPrice,
  addGuessTask,
};
