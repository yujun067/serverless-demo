const {
  createSuccessResponse,
  createErrorResponse,
  getUserById,
  withMiddleware,
} = require("./shared/utils");

// Core handler function (without middleware)
const getUserScoreHandler = async (event) => {
  // Get user data
  const user = await getUserById(event.user.userId);
  if (!user) {
    return createErrorResponse("User not found", 404);
  }

  // Return user data (without sensitive information)
  const responseData = {
    user_id: user.user_id,
    username: user.username,
    score: user.score,
    active_guess: user.active_guess,
    guess_timestamp: user.guess_timestamp,
    last_login: user.last_login,
  };

  console.log("User score retrieved successfully:", user.user_id);
  return createSuccessResponse(responseData);
};

// Export the handler wrapped with middleware
exports.handler = withMiddleware(getUserScoreHandler, { requireAuth: true });
