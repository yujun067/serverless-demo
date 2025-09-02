const {
  createSuccessResponse,
  createErrorResponse,
  comparePassword,
  generateToken,
  getUserByUsername,
  updateUser,
  withMiddleware,
} = require("./shared/utils");

// Core handler function (without middleware)
const userLoginHandler = async (event) => {
  // Parse request body
  const body = JSON.parse(event.body || "{}");
  const { username, password } = body;

  // Validate input
  if (!username || !password) {
    return createErrorResponse("Username and password are required");
  }

  // Get user by username
  const user = await getUserByUsername(username.toLowerCase());
  if (!user) {
    return createErrorResponse("Invalid username or password", 401);
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    return createErrorResponse("Invalid username or password", 401);
  }

  // Update last login time
  const now = new Date().toISOString();
  await updateUser(user.user_id, { last_login: now });

  // Generate JWT token
  const token = generateToken(user.user_id, user.username);

  // Return success response (without password hash)
  const responseData = {
    user_id: user.user_id,
    username: user.username,
    score: user.score,
    token: token,
    active_guess: user.active_guess,
    guess_timestamp: user.guess_timestamp,
  };

  console.log("User logged in successfully:", user.user_id);
  return createSuccessResponse(responseData);
};

// Export the handler wrapped with middleware (no authentication required)
exports.handler = withMiddleware(userLoginHandler, { requireAuth: false });
