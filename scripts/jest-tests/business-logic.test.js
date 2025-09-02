// Business Logic Tests
// Tests core game rules, authentication, and business constraints

const {
  ApiClient,
  TestDataGenerator,
  AuthHelper,
  ResponseValidator,
} = require("./utils/api-client");

describe("Business Logic & Game Rules Tests", () => {
  let apiClient;
  let authHelper;
  let testUser;

  beforeAll(async () => {
    apiClient = new ApiClient(global.testConfig.apiUrl);
    authHelper = new AuthHelper(apiClient);

    // Create a test user for authenticated tests
    testUser = await authHelper.createTestUser();
  });

  describe("Authentication & Authorization", () => {
    test("should require authentication for protected endpoints", async () => {
      const protectedEndpoints = [
        { method: "GET", path: "/price" },
        { method: "GET", path: "/user/score" },
        { method: "POST", path: "/guess", data: { guess: "up" } },
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await apiClient.request(
          endpoint.method,
          endpoint.path,
          endpoint.data
        );

        ResponseValidator.validateErrorResponse(response, 401);
        expect(response.data.error || response.data.message).toMatch(
          /unauthorized|authentication|token/i
        );
      }
    });

    test("should reject invalid JWT tokens", async () => {
      const invalidTokens = [
        "invalid_token",
        "Bearer invalid_token",
        "not.a.valid.jwt.token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
      ];

      for (const token of invalidTokens) {
        const response = await apiClient.get("/price", {
          Authorization: token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`,
        });

        ResponseValidator.validateErrorResponse(response, 401);
      }
    });

    test("should accept valid JWT tokens", async () => {
      const response = await apiClient.authenticatedGet(
        "/price",
        testUser.token
      );

      ResponseValidator.validateSuccessResponse(response);
      expect(response.data.price || response.data.data.price).toBeDefined();
    });

    test("should return user data for authenticated user score request", async () => {
      const response = await apiClient.authenticatedGet(
        "/user/score",
        testUser.token
      );

      ResponseValidator.validateSuccessResponse(response);
      ResponseValidator.validateUserData(response.data.data || response.data);
      expect(response.data.data?.username || response.data.username).toBe(
        testUser.username
      );
    });

    test("should handle malformed Authorization headers", async () => {
      const malformedHeaders = [
        "InvalidBearer " + testUser.token,
        testUser.token, // Missing Bearer prefix
        "Bearer", // Missing token
        "", // Empty header
      ];

      for (const header of malformedHeaders) {
        const response = await apiClient.get("/price", {
          Authorization: header,
        });

        ResponseValidator.validateErrorResponse(response, 401);
      }
    });
  });

  describe("Game Rules & Constraints", () => {
    let gameTestUser;

    beforeAll(async () => {
      // Create a dedicated user for game rule testing
      gameTestUser = await authHelper.createTestUser();
    });

    test("should accept valid guess values", async () => {
      const validGuesses = ["up", "down"];

      for (const guess of validGuesses) {
        // Create new user for each test to avoid active guess conflicts
        const user = await authHelper.createTestUser();
        const response = await apiClient.authenticatedPost(
          "/guess",
          user.token,
          { guess }
        );

        ResponseValidator.validateSuccessResponse(response, [200, 201]);
        expect(response.data.guess || response.data.data?.guess).toBe(guess);
      }
    });

    test("should reject invalid guess values", async () => {
      const invalidGuesses = [
        "invalid",
        "UP", // case sensitive
        "DOWN", // case sensitive
        "left",
        "right",
        "",
        null,
        undefined,
        123,
        true,
        {},
      ];

      for (const guess of invalidGuesses) {
        const response = await apiClient.authenticatedPost(
          "/guess",
          gameTestUser.token,
          { guess }
        );

        ResponseValidator.validateErrorResponse(response, 400);
        expect(response.data.error || response.data.message).toMatch(
          /guess.*up.*down/i
        );
      }
    });

    test("should reject guess with missing guess field", async () => {
      const invalidPayloads = [
        {},
        { other: "value" },
        { gues: "up" }, // typo
        { Guess: "up" }, // case sensitive
      ];

      for (const payload of invalidPayloads) {
        const response = await apiClient.authenticatedPost(
          "/guess",
          gameTestUser.token,
          payload
        );

        ResponseValidator.validateErrorResponse(response, 400);
      }
    });

    test("should enforce single active guess per user", async () => {
      const user = await authHelper.createTestUser();

      // Submit first guess
      const firstGuess = await apiClient.authenticatedPost(
        "/guess",
        user.token,
        { guess: "up" }
      );
      ResponseValidator.validateSuccessResponse(firstGuess, [200, 201]);

      // Try to submit second guess while first is still active
      const secondGuess = await apiClient.authenticatedPost(
        "/guess",
        user.token,
        { guess: "down" }
      );
      ResponseValidator.validateErrorResponse(secondGuess, 400);
      expect(secondGuess.data.error || secondGuess.data.message).toMatch(
        /active.*guess/i
      );
    });

    test("should track user score correctly", async () => {
      const response = await apiClient.authenticatedGet(
        "/user/score",
        testUser.token
      );

      ResponseValidator.validateSuccessResponse(response);
      const userData = response.data.data || response.data;

      expect(userData.score).toBeDefined();
      expect(typeof userData.score).toBe("number");
      expect(userData.user_id).toBeDefined();
      expect(userData.username).toBe(testUser.username);
    });

    test("should include active guess status in user data", async () => {
      const response = await apiClient.authenticatedGet(
        "/user/score",
        testUser.token
      );

      ResponseValidator.validateSuccessResponse(response);
      const userData = response.data.data || response.data;

      expect(userData).toHaveProperty("active_guess");
      expect(userData).toHaveProperty("guess_timestamp");

      // active_guess should be null or an object
      if (userData.active_guess !== null) {
        expect(typeof userData.active_guess).toBe("object");
      }
    });
  });

  describe("Data Consistency & Integrity", () => {
    test("should maintain consistent user data across endpoints", async () => {
      // Get user data from score endpoint
      const scoreResponse = await apiClient.authenticatedGet(
        "/user/score",
        testUser.token
      );
      ResponseValidator.validateSuccessResponse(scoreResponse);

      const userData = scoreResponse.data.data || scoreResponse.data;

      // Verify data structure
      expect(userData.user_id).toBe(testUser.userId);
      expect(userData.username).toBe(testUser.username);
      expect(userData.score).toBeDefined();
      expect(userData.active_guess).toBeDefined();
    });

    test("should return consistent price data", async () => {
      const responses = await Promise.all([
        apiClient.authenticatedGet("/price", testUser.token),
        apiClient.authenticatedGet("/price", testUser.token),
        apiClient.authenticatedGet("/price", testUser.token),
      ]);

      // All responses should be successful
      responses.forEach((response) => {
        ResponseValidator.validateSuccessResponse(response);
        const priceData = response.data.data || response.data;
        expect(priceData.price || priceData).toBeDefined();
      });

      // Prices should be numeric and reasonable
      responses.forEach((response) => {
        const price =
          response.data.data?.price || response.data.price || response.data;
        if (typeof price === "number") {
          expect(price).toBeGreaterThan(0);
          expect(price).toBeLessThan(1000000); // Reasonable upper bound
        }
      });
    });

    test("should handle concurrent requests properly", async () => {
      const concurrentRequests = Array(5)
        .fill()
        .map(() => apiClient.authenticatedGet("/user/score", testUser.token));

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach((response) => {
        ResponseValidator.validateSuccessResponse(response);
      });

      // All responses should have the same user data
      const firstUserData = responses[0].data.data || responses[0].data;
      responses.slice(1).forEach((response) => {
        const userData = response.data.data || response.data;
        expect(userData.user_id).toBe(firstUserData.user_id);
        expect(userData.username).toBe(firstUserData.username);
      });
    });
  });

  describe("Authentication Workflow", () => {
    test("should complete full registration and login workflow", async () => {
      const userData = TestDataGenerator.generateRegistrationData();

      // Step 1: Register new user
      const registerResponse = await apiClient.post("/register", userData);
      ResponseValidator.validateSuccessResponse(registerResponse, [200, 201]);
      ResponseValidator.validateAuthenticationResponse(registerResponse);

      // Step 2: Login with same credentials
      const loginResponse = await apiClient.post("/login", userData);
      ResponseValidator.validateAuthenticationResponse(loginResponse);

      // Step 3: Use token to access protected endpoint
      const token = loginResponse.data.data.token;
      const protectedResponse = await apiClient.authenticatedGet(
        "/user/score",
        token
      );
      ResponseValidator.validateSuccessResponse(protectedResponse);

      // Verify user data consistency
      expect(registerResponse.data.data.username).toBe(userData.username);
      expect(loginResponse.data.data.username).toBe(userData.username);

      const scoreData = protectedResponse.data.data || protectedResponse.data;
      expect(scoreData.username).toBe(userData.username);
    });

    test("should maintain session state correctly", async () => {
      // Make multiple authenticated requests with same token
      const requests = [
        apiClient.authenticatedGet("/price", testUser.token),
        apiClient.authenticatedGet("/user/score", testUser.token),
        apiClient.authenticatedGet("/price", testUser.token),
      ];

      const responses = await Promise.all(requests);

      // All requests should succeed, indicating session is maintained
      responses.forEach((response) => {
        ResponseValidator.validateSuccessResponse(response);
      });
    });
  });

  describe("Response Time & Performance", () => {
    test("authenticated endpoints should respond within reasonable time", async () => {
      const endpoints = [
        { method: "GET", path: "/price" },
        { method: "GET", path: "/user/score" },
      ];

      for (const endpoint of endpoints) {
        const response = await apiClient.authenticatedRequest(
          endpoint.method,
          endpoint.path,
          testUser.token
        );

        ResponseValidator.validateSuccessResponse(response);
        ResponseValidator.validateResponseTime(response, 5000);
      }
    });

    test("guess submission should be processed quickly", async () => {
      const user = await authHelper.createTestUser();
      const response = await apiClient.authenticatedPost("/guess", user.token, {
        guess: "up",
      });

      ResponseValidator.validateSuccessResponse(response, [200, 201]);
      ResponseValidator.validateResponseTime(response, 3000);
    });
  });
});
