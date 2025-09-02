const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Configuration
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "24h";
const SALT_ROUNDS = 10;

// Password hashing
const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// JWT token management
const generateToken = (userId, username) => {
  return jwt.sign({ userId, username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Authentication middleware
const authenticateUser = (event) => {
  // Extract token from Authorization header
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Authorization token required" };
  }

  const token = authHeader.substring(7);

  // Verify token
  const decoded = verifyToken(token);
  if (!decoded) {
    return { error: "Invalid or expired token" };
  }

  return { user: decoded };
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authenticateUser,
  SALT_ROUNDS,
  JWT_EXPIRES_IN,
};
