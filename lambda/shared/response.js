// Response handling utilities
const createResponse = (statusCode, body, additionalHeaders = {}) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
      ...additionalHeaders,
    },
    body: JSON.stringify(body),
  };
};

const createSuccessResponse = (data, additionalHeaders = {}) => {
  return createResponse(
    200,
    {
      success: true,
      data,
    },
    additionalHeaders
  );
};

const createErrorResponse = (
  message,
  statusCode = 400,
  additionalHeaders = {}
) => {
  return createResponse(
    statusCode,
    {
      success: false,
      error: message,
    },
    additionalHeaders
  );
};

module.exports = {
  createResponse,
  createSuccessResponse,
  createErrorResponse,
};
