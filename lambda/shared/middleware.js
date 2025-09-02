const { createErrorResponse } = require("./response");
const { authenticateUser } = require("./auth");

// Higher-order function wrapper for Lambda handlers
const withMiddleware = (handler, options = {}) => {
  return async (event, context) => {
    console.log(
      `${handler.name || "Handler"} event:`,
      JSON.stringify(event, null, 2)
    );

    try {
      // Handle authentication if required
      if (options.requireAuth) {
        const authResult = authenticateUser(event);
        if (authResult.error) {
          return createErrorResponse(authResult.error, 401);
        }
        // Add user to event for handler to use
        event.user = authResult.user;
      }

      // Call the original handler
      return await handler(event, context);
    } catch (error) {
      console.error(`${handler.name || "Handler"} error:`, error);
      return createErrorResponse("Internal server error", 500);
    }
  };
};

module.exports = {
  withMiddleware,
};
