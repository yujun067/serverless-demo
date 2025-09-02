const jwt = require("jsonwebtoken");

// JWT verification utility
class JWTUtils {
  constructor() {
    this.secret =
      process.env.JWT_SECRET || "your-secret-key-change-in-production";
  }

  // Verify JWT token and extract user information
  verifyToken(token) {
    try {
      if (!token) {
        throw new Error("No token provided");
      }

      // Remove Bearer prefix if present
      const cleanToken = token.replace(/^Bearer\s+/, "");

      // Verify and decode the token
      const decoded = jwt.verify(cleanToken, this.secret);

      // Return user information
      return {
        success: true,
        userId: decoded.userId,
        username: decoded.username,
        exp: decoded.exp,
      };
    } catch (error) {
      console.error("JWT verification failed:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Check if token is expired
  isTokenExpired(decoded) {
    if (!decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  }
}

module.exports = new JWTUtils();
