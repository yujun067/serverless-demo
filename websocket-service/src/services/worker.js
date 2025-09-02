const AWS = require("aws-sdk");
const redisService = require("./redis");
const { sendToUser } = require("../routes/sse");

class WorkerService {
  constructor() {
    this.dynamodb = new AWS.DynamoDB.DocumentClient();
    this.isRunning = false;
    this.interval = null;
  }

  async start() {
    console.log("=== Starting Guess Resolution Worker ===");

    if (this.isRunning) {
      console.log("Worker is already running");
      return;
    }

    try {
      // Test DynamoDB connection
      const testParams = {
        TableName: process.env.DYNAMODB_TABLE || "users",
        Limit: 1,
      };
      await this.dynamodb.scan(testParams).promise();

      this.isRunning = true;

      // Check for expired guesses every second
      this.interval = setInterval(async () => {
        try {
          await this.processExpiredGuesses();
        } catch (error) {
          console.error("Error in worker loop:", error);
        }
      }, 1000);

      console.log("Guess resolution worker started successfully");
    } catch (error) {
      console.error("Failed to start worker:", error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    console.log("=== Stopping Guess Resolution Worker ===");

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
    console.log("Guess resolution worker stopped");
  }

  async processExpiredGuesses() {
    try {
      // Get expired guess tasks from Redis
      const expiredTasks = await redisService.getExpiredGuessTasks();

      if (expiredTasks.length === 0) {
        // No expired tasks
        return;
      }

      console.log(`Processing ${expiredTasks.length} expired guesses`);

      // Get current price
      const currentPrice = await redisService.getPriceData();
      if (!currentPrice) {
        console.error("Unable to get current price for guess resolution");
        return;
      }

      console.log(`Current price for resolution: ${currentPrice.price}`);

      // Process each expired guess
      for (const task of expiredTasks) {
        try {
          console.log(`Processing task for user ${task.userId}`);
          await this.resolveGuess(task, currentPrice);
        } catch (error) {
          console.error(
            `Error resolving guess for user ${task.userId}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error processing expired guesses:", error);
    }
  }

  async resolveGuess(task, currentPrice) {
    const { userId, guessData } = task;
    const guessPrice = guessData.price_at_guess;
    const currentPriceValue = currentPrice.price;

    // Determine if guess was correct
    let isCorrect = false;
    let scoreChange = 0;

    if (guessData.guess === "up") {
      isCorrect = currentPriceValue > guessPrice;
    } else if (guessData.guess === "down") {
      isCorrect = currentPriceValue < guessPrice;
    }

    // Update score
    scoreChange = isCorrect ? 1 : -1;

    // Get current user data
    const user = await this.getUserById(userId);
    if (!user) {
      console.error(`User ${userId} not found for guess resolution`);
      return;
    }

    const newScore = user.score + scoreChange;

    // Update user record
    await this.updateUser(userId, {
      score: newScore,
      active_guess: null,
      guess_timestamp: null,
    });

    // Create result object
    const result = {
      user_id: userId,
      username: user.username,
      guess: guessData.guess,
      guess_price: guessPrice,
      current_price: currentPriceValue,
      is_correct: isCorrect,
      score_change: scoreChange,
      new_score: newScore,
      resolved_at: new Date().toISOString(),
    };

    // Send result to specific user via point-to-point messaging
    try {
      const messageSent = sendToUser(userId, result);
      if (!messageSent) {
        console.log(`User ${userId} not connected, guess result not delivered`);
      }
    } catch (error) {
      console.error(`Error sending message to user ${userId}:`, error);
    }

    console.log(
      `Resolved guess for user ${user.username}: ${guessData.guess} (${
        isCorrect ? "CORRECT" : "INCORRECT"
      }) - Score: ${user.score} → ${newScore}`
    );
  }

  async getUserById(userId) {
    try {
      const params = {
        TableName: process.env.DYNAMODB_TABLE || "users",
        KeyConditionExpression: "user_id = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      };

      const result = await this.dynamodb.query(params).promise();

      if (result.Items && result.Items.length > 0) {
        return result.Items[0]; // Return the first (and should be only) item
      } else {
        console.log(`No user found for ID: ${userId}`);
        return null;
      }
    } catch (error) {
      console.error(`Error getting user ${userId}:`, error);
      throw error;
    }
  }

  async updateUser(userId, updates) {
    try {
      // First, get the user to find the timestamp
      const user = await this.getUserById(userId);
      if (!user) {
        console.error(`User not found for update: ${userId}`);
        throw new Error("User not found");
      }

      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.keys(updates).forEach((key) => {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updates[key];
      });

      const params = {
        TableName: process.env.DYNAMODB_TABLE || "users",
        Key: {
          user_id: userId,
          timestamp: user.timestamp, // Include timestamp from the composite key
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      };

      const result = await this.dynamodb.update(params).promise();
      return result.Attributes;
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = new WorkerService();
