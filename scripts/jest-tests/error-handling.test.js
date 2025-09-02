// Error Handling & Resilience Tests
// Tests system behavior under various error conditions and edge cases

const {
  ApiClient,
  TestDataGenerator,
  AuthHelper,
  ResponseValidator,
} = require("./utils/api-client");

describe("Error Handling & Resilience Tests", () => {
  let apiClient;
  let authHelper;
  let testUser;

  beforeAll(async () => {
    apiClient = new ApiClient(global.testConfig.apiUrl);
    authHelper = new AuthHelper(apiClient);

    // Create test user for authenticated error tests
    testUser = await authHelper.createTestUser();
  });

  describe("HTTP Method Validation", () => {
    test("should reject wrong HTTP methods on registration endpoint", async () => {
      const wrongMethods = ["GET", "PUT", "DELETE", "PATCH"];

      for (const method of wrongMethods) {
        const response = await apiClient.request(method, "/register", {
          username: "testuser",
          password: "testpass123",
        });

        ResponseValidator.validateErrorResponse(response, [403, 404, 405]);
      }
    });

    test("should reject wrong HTTP methods on login endpoint", async () => {
      const wrongMethods = ["GET", "PUT", "DELETE", "PATCH"];

      for (const method of wrongMethods) {
        const response = await apiClient.request(method, "/login", {
          username: "testuser",
          password: "testpass123",
        });

        ResponseValidator.validateErrorResponse(response, [403, 404, 405]);
      }
    });

    test("should reject wrong HTTP methods on protected endpoints", async () => {
      const endpoints = [
        { path: "/price", validMethod: "GET" },
        { path: "/user/score", validMethod: "GET" },
        { path: "/guess", validMethod: "POST" },
      ];

      const wrongMethods = ["PUT", "DELETE", "PATCH"];

      for (const endpoint of endpoints) {
        for (const method of wrongMethods) {
          const response = await apiClient.authenticatedRequest(
            method,
            endpoint.path,
            testUser.token,
            method === "POST" ? { guess: "up" } : null
          );

          ResponseValidator.validateErrorResponse(response, [403, 404, 405]);
        }
      }
    });
  });

  describe("Non-existent Endpoints", () => {
    test("should return 404 for non-existent endpoints", async () => {
      const nonExistentEndpoints = [
        "/nonexistent",
        "/api/invalid",
        "/very/deep/invalid/path",
        "/register/invalid",
        "/login/extra",
        "/price/details",
        "/user/profile",
        "/guess/history",
      ];

      for (const endpoint of nonExistentEndpoints) {
        const response = await apiClient.get(endpoint);
        ResponseValidator.validateErrorResponse(response, [403, 404]);
      }
    });

    test("should return 404 for non-existent endpoints with authentication", async () => {
      const nonExistentEndpoints = [
        "/authenticated/invalid",
        "/user/invalid",
        "/admin/panel",
      ];

      for (const endpoint of nonExistentEndpoints) {
        const response = await apiClient.authenticatedGet(
          endpoint,
          testUser.token
        );
        ResponseValidator.validateErrorResponse(response, [403, 404, 401]); // Could be 401 if auth is checked first
      }
    });
  });

  describe("Content-Type and Header Handling", () => {
    test("should handle requests without Content-Type header", async () => {
      // Most modern APIs are flexible about Content-Type for JSON
      const response = await apiClient.request(
        "POST",
        "/register",
        {
          username: TestDataGenerator.generateUniqueUsername(),
          password: "testpass123",
        },
        {
          "Content-Type": undefined, // Remove Content-Type
        }
      );

      // Should either succeed or fail gracefully
      expect([200, 201, 400, 415]).toContain(response.status);
    });

    test("should handle requests with wrong Content-Type", async () => {
      const response = await apiClient.request(
        "POST",
        "/register",
        JSON.stringify({
          username: TestDataGenerator.generateUniqueUsername(),
          password: "testpass123",
        }),
        {
          "Content-Type": "text/plain",
        }
      );

      // Should handle gracefully
      expect([200, 201, 400, 415]).toContain(response.status);
    });

    test("should handle requests with invalid Accept header", async () => {
      const response = await apiClient.request(
        "POST",
        "/register",
        {
          username: TestDataGenerator.generateUniqueUsername(),
          password: "testpass123",
        },
        {
          Accept: "application/xml",
        }
      );

      // Should still process or fail gracefully
      expect([200, 201, 400, 406]).toContain(response.status);
    });
  });

  describe("Request Size and Limits", () => {
    test("should handle very large request payloads", async () => {
      const largeData = {
        username: TestDataGenerator.generateUniqueUsername(),
        password: "testpass123",
        extraData: "a".repeat(50000), // 50KB of extra data
      };

      const response = await apiClient.post("/register", largeData);

      // Should either process or reject with appropriate error
      expect([200, 201, 400, 413]).toContain(response.status);
    });

    test("should handle requests with excessive nested objects", async () => {
      let nestedObject = { value: "test" };
      for (let i = 0; i < 100; i++) {
        nestedObject = { nested: nestedObject };
      }

      const response = await apiClient.post("/register", {
        username: TestDataGenerator.generateUniqueUsername(),
        password: "testpass123",
        metadata: nestedObject,
      });

      // API might accept or reject complex payloads - both are valid
      expect([200, 201, 400, 413]).toContain(response.status);
    });

    test("should handle very long string values", async () => {
      const response = await apiClient.post("/register", {
        username: TestDataGenerator.generateUniqueUsername(),
        password: "a".repeat(1000), // Very long password
      });

      // API might accept or reject very long strings - both are valid
      expect([200, 201, 400, 413]).toContain(response.status);
    });
  });

  describe("Token and Authentication Error Handling", () => {
    test("should handle various malformed JWT tokens", async () => {
      const malformedTokens = [
        "not.a.valid.jwt.token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ", // Missing signature
        "", // Empty token
        "Bearer", // Just the Bearer keyword
        "   ", // Whitespace
        "null",
        "undefined",
      ];

      for (const token of malformedTokens) {
        const response = await apiClient.get("/price", {
          Authorization: `Bearer ${token}`,
        });

        ResponseValidator.validateErrorResponse(response, 401);
      }
    });

    test("should handle missing Authorization header variations", async () => {
      const protectedEndpoints = ["/price", "/user/score"];

      for (const endpoint of protectedEndpoints) {
        // No Authorization header
        const response1 = await apiClient.get(endpoint);
        ResponseValidator.validateErrorResponse(response1, 401);

        // Empty Authorization header
        const response2 = await apiClient.get(endpoint, { Authorization: "" });
        ResponseValidator.validateErrorResponse(response2, 401);

        // Malformed Authorization header format
        const response3 = await apiClient.get(endpoint, {
          Authorization: testUser.token,
        });
        ResponseValidator.validateErrorResponse(response3, 401);
      }
    });

    test("should handle expired-like tokens gracefully", async () => {
      // Simulate an expired token (this is a mock expired JWT)
      const mockExpiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid";

      const response = await apiClient.authenticatedGet(
        "/price",
        mockExpiredToken
      );
      ResponseValidator.validateErrorResponse(response, 401);
    });
  });

  describe("CORS and Cross-Origin Handling", () => {
    test("should handle OPTIONS requests (CORS preflight)", async () => {
      const endpoints = [
        "/register",
        "/login",
        "/price",
        "/user/score",
        "/guess",
      ];

      for (const endpoint of endpoints) {
        const response = await apiClient.options(endpoint);

        // OPTIONS should either succeed or be handled gracefully
        expect([200, 204, 404]).toContain(response.status);
      }
    });

    test("should handle requests with Origin header", async () => {
      const origins = [
        "https://example.com",
        "http://localhost:3000",
        "https://malicious-site.com",
      ];

      for (const origin of origins) {
        const response = await apiClient.request("GET", "/price", null, {
          Origin: origin,
          Authorization: `Bearer ${testUser.token}`,
        });

        // Should handle CORS appropriately
        expect([200, 401, 403]).toContain(response.status);
      }
    });
  });

  describe("Network and Connectivity Error Handling", () => {
    test("should handle request timeout scenarios", async () => {
      // Create a client with very short timeout for testing
      const timeoutClient = new ApiClient(global.testConfig.apiUrl);
      timeoutClient.client.defaults.timeout = 100; // 100ms timeout

      try {
        const response = await timeoutClient.post("/register", {
          username: TestDataGenerator.generateUniqueUsername(),
          password: "testpass123",
        });

        // If request succeeds despite short timeout, that's also valid
        expect([200, 201, 408, 504]).toContain(response.status);
      } catch (error) {
        // Timeout errors are expected and acceptable
        expect(error.message).toMatch(/timeout|network/i);
      }
    }, 10000);

    test("should handle concurrent request load", async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests)
        .fill()
        .map(() => apiClient.authenticatedGet("/user/score", testUser.token));

      const responses = await Promise.allSettled(requests);

      // Most requests should succeed, some might fail under load
      const successfulResponses = responses.filter(
        (result) =>
          result.status === "fulfilled" &&
          [200, 201].includes(result.value.status)
      );

      // At least 70% should succeed
      expect(successfulResponses.length).toBeGreaterThanOrEqual(
        concurrentRequests * 0.7
      );
    });
  });

  describe("Edge Case Data Handling", () => {
    test("should handle various JSON edge cases", async () => {
      const edgeCases = ["null", "[]", '""', "0", "false", "{}", '{"":""}'];

      for (const edgeCase of edgeCases) {
        const response = await apiClient.request("POST", "/register", edgeCase);
        // API might return 400 (client error) or 500 (server error) for edge cases
        ResponseValidator.validateErrorResponse(response, [400, 500]);
      }
    });

    test("should handle Unicode and special characters", async () => {
      const unicodeData = {
        username: "test用户123", // Contains Unicode characters
        password: "pass密码123",
      };

      const response = await apiClient.post("/register", unicodeData);

      // Should either handle Unicode properly or reject with clear error
      if (response.status >= 400) {
        ResponseValidator.validateErrorResponse(response, 400);
      } else {
        ResponseValidator.validateSuccessResponse(response, [200, 201]);
      }
    });

    test("should handle SQL injection attempts", async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "admin'--",
        "' OR '1'='1",
        "test'; INSERT INTO users VALUES ('hacker', 'password'); --",
      ];

      for (const injection of sqlInjectionAttempts) {
        const response = await apiClient.post("/register", {
          username: injection,
          password: "testpass123",
        });

        // Should reject malicious input
        ResponseValidator.validateErrorResponse(response, 400);
      }
    });

    test("should handle XSS attempts", async () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '"><script>alert("xss")</script>',
      ];

      for (const xss of xssAttempts) {
        const response = await apiClient.post("/register", {
          username: xss,
          password: "testpass123",
        });

        // Should reject or sanitize XSS attempts
        ResponseValidator.validateErrorResponse(response, 400);
      }
    });
  });

  describe("Error Response Consistency", () => {
    test("error responses should have consistent structure", async () => {
      const errorEndpoints = [
        { method: "POST", path: "/register", data: {} },
        { method: "POST", path: "/login", data: {} },
        { method: "GET", path: "/nonexistent", data: null },
      ];

      for (const endpoint of errorEndpoints) {
        const response = await apiClient.request(
          endpoint.method,
          endpoint.path,
          endpoint.data
        );

        ResponseValidator.validateErrorResponse(response, [400, 403, 404]);

        // Error responses should have some kind of error message
        expect(
          response.data.error ||
            response.data.message ||
            response.data.errorMessage
        ).toBeDefined();
      }
    });

    test("should return appropriate HTTP status codes", async () => {
      const testCases = [
        {
          action: () => apiClient.post("/register", {}),
          expectedStatus: 400,
          description: "Invalid input should return 400",
        },
        {
          action: () => apiClient.get("/nonexistent"),
          expectedStatus: 403,
          description: "Non-existent endpoint should return 403",
        },
        {
          action: () => apiClient.get("/price"),
          expectedStatus: 401,
          description: "Unauthenticated access should return 401",
        },
      ];

      for (const testCase of testCases) {
        const response = await testCase.action();
        expect(response.status).toBe(testCase.expectedStatus);
      }
    });
  });
});
