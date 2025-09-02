// API client utilities for Jest tests
const axios = require("axios");

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on HTTP error status
    });
  }

  // Enhanced request method with timing and response details
  async request(method, endpoint, data = null, headers = {}) {
    const startTime = Date.now();

    try {
      const config = {
        method,
        url: endpoint,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      };

      if (data && method !== "GET" && method !== "HEAD") {
        config.data = data;
      }

      const response = await this.client.request(config);
      const responseTime = Date.now() - startTime;

      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
        responseTime,
        config: {
          method,
          endpoint,
          data,
          headers,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error.response) {
        return {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
          responseTime,
          error: error.message,
          config: {
            method,
            endpoint,
            data,
            headers,
          },
        };
      } else if (
        error.message.includes("self-signed certificate") ||
        error.message.includes("CERT") ||
        error.message.includes("SSL")
      ) {
        // Handle SSL certificate issues in development
        return {
          status: 526, // Custom status for SSL issues
          data: { 
            error: "SSL certificate issue in development environment",
            details: error.message 
          },
          responseTime,
          sslError: true,
          request: {
            method,
            endpoint,
            data,
            headers,
          },
        };
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  // Convenience methods
  async get(endpoint, headers = {}) {
    return this.request("GET", endpoint, null, headers);
  }

  async post(endpoint, data, headers = {}) {
    return this.request("POST", endpoint, data, headers);
  }

  async put(endpoint, data, headers = {}) {
    return this.request("PUT", endpoint, data, headers);
  }

  async delete(endpoint, headers = {}) {
    return this.request("DELETE", endpoint, null, headers);
  }

  async options(endpoint, headers = {}) {
    return this.request("OPTIONS", endpoint, null, headers);
  }

  // Authenticated request helper
  async authenticatedRequest(
    method,
    endpoint,
    token,
    data = null,
    additionalHeaders = {}
  ) {
    const headers = {
      Authorization: `Bearer ${token}`,
      ...additionalHeaders,
    };
    return this.request(method, endpoint, data, headers);
  }

  // Authenticated convenience methods
  async authenticatedGet(endpoint, token, headers = {}) {
    return this.authenticatedRequest("GET", endpoint, token, null, headers);
  }

  async authenticatedPost(endpoint, token, data, headers = {}) {
    return this.authenticatedRequest("POST", endpoint, token, data, headers);
  }
}

// Test data generators
class TestDataGenerator {
  static generateUniqueUsername() {
    // Generate username that meets API requirements: 3-20 chars, letters/numbers/underscores only
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits
    const randomSuffix = Math.random().toString(36).substr(2, 4); // 4 random chars
    return `test_${timestamp}_${randomSuffix}`.slice(0, 20); // Ensure max 20 chars
  }

  static generateTestPassword() {
    return "testpass123";
  }

  static generateRegistrationData() {
    return {
      username: this.generateUniqueUsername(),
      password: this.generateTestPassword(),
    };
  }

  static generateLoginData(username, password = null) {
    return {
      username,
      password: password || this.generateTestPassword(),
    };
  }

  static generateGuessData(guess = "up") {
    return { guess };
  }

  static generateInvalidData() {
    return {
      invalidJson: "invalid json",
      emptyObject: {},
      nullValue: null,
      arrayInsteadOfObject: ["invalid", "format"],
      numberInsteadOfObject: 12345,
      stringInsteadOfObject: "not an object",
      largePayload: {
        username: "testuser",
        password: "testpass123",
        extraData: "a".repeat(10000),
      },
    };
  }
}

// Authentication helper
class AuthHelper {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async createTestUser() {
    const userData = TestDataGenerator.generateRegistrationData();

    // Register user
    const registerResponse = await this.apiClient.post("/register", userData);
    if (registerResponse.status !== 200 && registerResponse.status !== 201) {
      throw new Error(
        `Registration failed: ${registerResponse.status} - ${JSON.stringify(
          registerResponse.data
        )}`
      );
    }

    // Login to get token
    const loginResponse = await this.apiClient.post("/login", userData);
    if (loginResponse.status !== 200) {
      throw new Error(
        `Login failed: ${loginResponse.status} - ${JSON.stringify(
          loginResponse.data
        )}`
      );
    }

    const token = loginResponse.data?.data?.token;
    if (!token) {
      throw new Error("No token returned from login");
    }

    return {
      username: userData.username,
      password: userData.password,
      token,
      userId: loginResponse.data?.data?.user_id,
    };
  }

  async createMultipleTestUsers(count = 2) {
    const users = [];
    for (let i = 0; i < count; i++) {
      try {
        const user = await this.createTestUser();
        users.push(user);
      } catch (error) {
        console.warn(`Failed to create test user ${i + 1}: ${error.message}`);
      }
    }
    return users;
  }
}

// Response validation helpers
class ResponseValidator {
  static validateSuccessResponse(response, expectedStatus = [200, 201]) {
    const validStatuses = Array.isArray(expectedStatus)
      ? expectedStatus
      : [expectedStatus];
    expect(response.status).toBeValidHttpStatus(validStatuses);
    expect(response.data).toBeDefined();

    if (response.data.success !== undefined) {
      expect(response.data.success).toBe(true);
    }
  }

  static validateErrorResponse(
    response,
    expectedStatus = [400, 401, 404, 409]
  ) {
    const validStatuses = Array.isArray(expectedStatus)
      ? expectedStatus
      : [expectedStatus];
    expect(response.status).toBeValidHttpStatus(validStatuses);
    expect(response.data).toBeDefined();

    if (response.data.success !== undefined) {
      expect(response.data.success).toBe(false);
    }
  }

  static validateResponseTime(response, maxTime = 5000) {
    expect(response.responseTime).toHaveResponseTime(maxTime);
  }

  static validateAuthenticationResponse(response) {
    this.validateSuccessResponse(response);
    const token = response.data.data?.token || response.data.token;
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  }

  static validateUserData(userData) {
    // Handle both nested (response.data.data) and flat (userData) formats
    const data = userData.data || userData;
    expect(data.user_id).toBeDefined();
    expect(data.username).toBeDefined();
    expect(data.score).toBeDefined();
    expect(typeof data.score).toBe("number");
  }
}

module.exports = {
  ApiClient,
  TestDataGenerator,
  AuthHelper,
  ResponseValidator,
};
