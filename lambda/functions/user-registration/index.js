const {
  createSuccessResponse,
  createErrorResponse,
  hashPassword,
  generateToken,
  getUserByUsername,
  createUser,
  validateUsername,
  validatePassword,
  withMiddleware,
  uuidv4,
} = require("./shared/utils");

// Core handler function (without middleware)
const userRegistrationHandler = async (event) => {
  // Parse request body
  const body = JSON.parse(event.body || "{}");
  const { username, password } = body;

  // Validate input
  if (!username || !password) {
    return createErrorResponse("Username and password are required");
  }

  if (!validateUsername(username)) {
    return createErrorResponse(
      "Username must be 3-20 characters and contain only letters, numbers, and underscores"
    );
  }

  if (!validatePassword(password)) {
    return createErrorResponse("Password must be at least 6 characters long");
  }

  // Check if username already exists
  const existingUser = await getUserByUsername(username);
  if (existingUser) {
    return createErrorResponse("Username already exists", 409);
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user data
  const userId = uuidv4();
  const now = new Date().toISOString();

  const userData = {
    user_id: userId,
    timestamp: now, // Required for DynamoDB RANGE key
    username: username.toLowerCase(),
    password_hash: hashedPassword,
    score: 0,
    created_at: now,
    last_login: now,
    active_guess: null,
    guess_timestamp: null,
  };

  // Save user to DynamoDB
  await createUser(userData);

  // Generate JWT token
  const token = generateToken(userId, username);

  // Return success response (without password hash)
  const responseData = {
    user_id: userId,
    username: username,
    score: 0,
    token: token,
  };

  console.log("User registered successfully:", userId);
  return createSuccessResponse(responseData);
};

// Export the handler wrapped with middleware (no authentication required)
exports.handler = withMiddleware(userRegistrationHandler, {
  requireAuth: false,
});
