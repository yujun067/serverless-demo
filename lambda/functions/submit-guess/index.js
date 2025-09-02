const {
  createSuccessResponse,
  createErrorResponse,
  getUserById,
  updateUser,
  getLatestPrice,
  addGuessTask,
  validateGuess,
  withMiddleware,
} = require("./shared/utils");

// Core handler function (without middleware)
const submitGuessHandler = async (event) => {
  console.log("=== Submit Guess Lambda Handler ===");
  console.log("Event:", JSON.stringify(event, null, 2));

  // Parse request body
  const body = JSON.parse(event.body || "{}");
  const { guess } = body;

  console.log("Request body:", { guess });

  // Validate guess
  if (!guess || !validateGuess(guess)) {
    console.log("Invalid guess:", guess);
    return createErrorResponse('Guess must be either "up" or "down"');
  }

  console.log("Guess validation passed");

  // Get user data
  console.log("🔍 Getting user data for ID:", event.user.userId);
  const user = await getUserById(event.user.userId);
  if (!user) {
    console.log("User not found:", event.user.userId);
    return createErrorResponse("User not found", 404);
  }
  console.log("User found:", user.username);

  // Check if user already has an active guess
  if (user.active_guess) {
    console.log("User already has active guess:", user.active_guess);
    return createErrorResponse(
      "You already have an active guess. Please wait for it to be resolved."
    );
  }
  console.log("No active guess found");

  // Get current BTC price
  console.log("💰 Getting current BTC price...");
  const currentPrice = await getLatestPrice();
  if (!currentPrice) {
    console.log("Failed to get current price");
    return createErrorResponse(
      "Unable to get current Bitcoin price. Please try again."
    );
  }
  console.log("Current price:", currentPrice.price);

  // Create guess data
  const now = new Date();
  const resolveTime = new Date(now.getTime() + 60000); // 60 seconds from now

  const guessData = {
    guess: guess,
    price_at_guess: currentPrice.price,
    timestamp: now.toISOString(),
  };

  console.log("Creating guess data:", guessData);
  console.log("⏰ Resolve time:", resolveTime.toISOString());

  // Add guess task to Redis Sorted Set
  console.log("🔗 Adding guess task to Redis...");
  try {
    await addGuessTask(event.user.userId, guessData, resolveTime);
    console.log("Guess task added to Redis successfully");
  } catch (error) {
    console.error("Failed to add guess task to Redis:", error);
    console.error("Error stack:", error.stack);
    return createErrorResponse("Failed to submit guess. Please try again.");
  }

  // Update user with new guess (for UI state management)
  console.log("👤 Updating user record...");
  await updateUser(event.user.userId, {
    active_guess: guessData,
    guess_timestamp: now.toISOString(),
  });
  console.log("User record updated");

  // Return success response
  const responseData = {
    guess: guess,
    price_at_guess: currentPrice.price,
    timestamp: now.toISOString(),
    resolve_time: resolveTime.toISOString(),
    message: `Your guess of "${guess}" has been recorded. It will be resolved in 60 seconds.`,
  };

  console.log("🎉 Guess submitted successfully:", {
    userId: event.user.userId,
    username: user.username,
    guess: guess,
    price: currentPrice.price,
    resolveTime: resolveTime.toISOString(),
  });

  return createSuccessResponse(responseData);
};

// Export the handler wrapped with middleware
exports.handler = withMiddleware(submitGuessHandler, { requireAuth: true });
