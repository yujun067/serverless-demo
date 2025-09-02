// Main utilities file - serves as a unified entry point for all shared modules
// This maintains backward compatibility while providing a cleaner modular structure

const response = require("./response");
const auth = require("./auth");
const database = require("./database");
const redis = require("./redis");
const validation = require("./validation");
const middleware = require("./middleware");
const { v4: uuidv4 } = require("uuid");

// Re-export all utilities for backward compatibility
module.exports = {
  // Response utilities
  ...response,

  // Authentication utilities
  ...auth,

  // Database utilities
  ...database,

  // Redis utilities
  ...redis,

  // Validation utilities
  ...validation,

  // Middleware utilities
  ...middleware,

  // Utility functions
  uuidv4,
};
