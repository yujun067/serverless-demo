// API Input Validation Tests
// Tests various input validation scenarios for all API endpoints

const {
  ApiClient,
  TestDataGenerator,
  ResponseValidator,
} = require("./utils/api-client");

describe("API Input Validation Tests", () => {
  let apiClient;

  beforeAll(() => {
    apiClient = new ApiClient(global.testConfig.apiUrl);
  });

  describe("Registration Input Validation", () => {
    test("should reject registration with missing username", async () => {
      const response = await apiClient.post("/register", {
        password: "testpass123",
      });

      ResponseValidator.validateErrorResponse(response, 400);
      expect(response.data.error || response.data.message).toMatch(/username/i);
    });

    test("should reject registration with missing password", async () => {
      const response = await apiClient.post("/register", {
        username: "testuser",
      });

      ResponseValidator.validateErrorResponse(response, 400);
      expect(response.data.error || response.data.message).toMatch(/password/i);
    });

    test("should reject registration with short username", async () => {
      const response = await apiClient.post("/register", {
        username: "ab",
        password: "testpass123",
      });

      ResponseValidator.validateErrorResponse(response, 400);
      expect(response.data.error || response.data.message).toMatch(/username/i);
    });

    test("should reject registration with long username", async () => {
      const response = await apiClient.post("/register", {
        username: "verylongusernamethatexceedslimit",
        password: "testpass123",
      });

      ResponseValidator.validateErrorResponse(response, 400);
      expect(response.data.error || response.data.message).toMatch(/username/i);
    });

    test("should reject registration with invalid username characters", async () => {
      const response = await apiClient.post("/register", {
        username: "test@user",
        password: "testpass123",
      });

      ResponseValidator.validateErrorResponse(response, 400);
      expect(response.data.error || response.data.message).toMatch(/username/i);
    });

    test("should reject registration with short password", async () => {
      const response = await apiClient.post("/register", {
        username: "validuser",
        password: "123",
      });

      ResponseValidator.validateErrorResponse(response, 400);
      expect(response.data.error || response.data.message).toMatch(/password/i);
    });

    test("should accept valid registration data", async () => {
      const userData = TestDataGenerator.generateRegistrationData();
      const response = await apiClient.post("/register", userData);

      ResponseValidator.validateSuccessResponse(response, [200, 201]);
      expect(response.data.data.username).toBe(userData.username);
      expect(response.data.data.token).toBeDefined();
    });

    test("should reject duplicate username registration", async () => {
      const userData = TestDataGenerator.generateRegistrationData();

      // First registration should succeed
      const firstResponse = await apiClient.post("/register", userData);
      ResponseValidator.validateSuccessResponse(firstResponse, [200, 201]);

      // Second registration with same username should fail
      const secondResponse = await apiClient.post("/register", userData);
      ResponseValidator.validateErrorResponse(secondResponse, 409);
      expect(secondResponse.data.error || secondResponse.data.message).toMatch(
        /username.*exist/i
      );
    });
  });

  describe("Login Input Validation", () => {
    test("should reject login with missing credentials", async () => {
      const response = await apiClient.post("/login", {});

      ResponseValidator.validateErrorResponse(response, 400);
    });

    test("should reject login with missing username", async () => {
      const response = await apiClient.post("/login", {
        password: "testpass123",
      });

      ResponseValidator.validateErrorResponse(response, 400);
      expect(response.data.error || response.data.message).toMatch(/username/i);
    });

    test("should reject login with missing password", async () => {
      const response = await apiClient.post("/login", { username: "testuser" });

      ResponseValidator.validateErrorResponse(response, 400);
      expect(response.data.error || response.data.message).toMatch(/password/i);
    });

    test("should reject login with wrong credentials", async () => {
      const response = await apiClient.post("/login", {
        username: "nonexistent",
        password: "wrongpass",
      });

      ResponseValidator.validateErrorResponse(response, 401);
      expect(response.data.error || response.data.message).toMatch(
        /invalid.*username.*password/i
      );
    });

    test("should accept valid login credentials", async () => {
      // First create a user
      const userData = TestDataGenerator.generateRegistrationData();
      await apiClient.post("/register", userData);

      // Then login with the same credentials
      const loginResponse = await apiClient.post("/login", userData);

      ResponseValidator.validateAuthenticationResponse(loginResponse);
      expect(loginResponse.data.data.username).toBe(userData.username);
    });
  });

  describe("Malformed Request Handling", () => {
    test("should reject malformed JSON in registration", async () => {
      const response = await apiClient.request(
        "POST",
        "/register",
        "invalid json"
      );

      ResponseValidator.validateErrorResponse(response, 400);
    });

    test("should reject malformed JSON in login", async () => {
      const response = await apiClient.request(
        "POST",
        "/login",
        "invalid json"
      );

      ResponseValidator.validateErrorResponse(response, 400);
    });

    test("should handle empty request body in registration", async () => {
      const response = await apiClient.request("POST", "/register", "");

      ResponseValidator.validateErrorResponse(response, 400);
    });

    test("should handle empty request body in login", async () => {
      const response = await apiClient.request("POST", "/login", "");

      ResponseValidator.validateErrorResponse(response, 400);
    });

    test("should reject null JSON body", async () => {
      const response = await apiClient.request("POST", "/register", null);

      ResponseValidator.validateErrorResponse(response, 400);
    });

    test("should reject array instead of object", async () => {
      const response = await apiClient.post("/register", ["invalid", "format"]);

      ResponseValidator.validateErrorResponse(response, 400);
    });

    test("should reject number instead of object", async () => {
      const response = await apiClient.request("POST", "/register", 12345);

      ResponseValidator.validateErrorResponse(response, 400);
    });

    test("should reject string instead of object", async () => {
      const response = await apiClient.request(
        "POST",
        "/register",
        "not an object"
      );

      ResponseValidator.validateErrorResponse(response, 400);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    test("should handle username at minimum length boundary", async () => {
      const response = await apiClient.post("/register", {
        username: "abc", // 3 characters - minimum valid
        password: "testpass123",
      });

      // Either success or conflict (both are valid outcomes for this boundary test)
      expect([200, 201, 409]).toContain(response.status);

      if (response.status === 409) {
        // Username already exists - this validates that the API correctly enforces uniqueness
        expect(response.data.success).toBe(false);
      } else {
        // Successfully created - this validates that 3-character usernames are accepted
        ResponseValidator.validateSuccessResponse(response, [200, 201]);
      }
    });

    test("should handle username at maximum length boundary", async () => {
      const timestamp = Date.now().toString().slice(-4);
      const response = await apiClient.post("/register", {
        username: `a`.repeat(16) + timestamp, // 20 characters - maximum valid
        password: "testpass123",
      });

      ResponseValidator.validateSuccessResponse(response, [200, 201]);
    });

    test("should handle password at minimum length boundary", async () => {
      const response = await apiClient.post("/register", {
        username: TestDataGenerator.generateUniqueUsername(),
        password: "123456", // 6 characters - minimum valid
      });

      ResponseValidator.validateSuccessResponse(response, [200, 201]);
    });

    test("should handle special characters in valid username", async () => {
      const timestamp = Date.now().toString().slice(-6);
      const response = await apiClient.post("/register", {
        username: `test_user_${timestamp}`,
        password: "testpass123",
      });

      ResponseValidator.validateSuccessResponse(response, [200, 201]);
    });

    test("should handle case sensitivity in usernames", async () => {
      const baseUsername =
        TestDataGenerator.generateUniqueUsername().toLowerCase();

      // Register with lowercase
      const lowerResponse = await apiClient.post("/register", {
        username: baseUsername,
        password: "testpass123",
      });
      ResponseValidator.validateSuccessResponse(lowerResponse, [200, 201]);

      // Try to register with uppercase version
      const upperResponse = await apiClient.post("/register", {
        username: baseUsername.toUpperCase(),
        password: "testpass123",
      });

      // Should either reject as duplicate or normalize to lowercase
      if (upperResponse.status === 409) {
        ResponseValidator.validateErrorResponse(upperResponse, 409);
      } else {
        ResponseValidator.validateSuccessResponse(upperResponse, [200, 201]);
      }
    });
  });

  describe("Response Time Validation", () => {
    test("registration endpoint should respond within reasonable time", async () => {
      const userData = TestDataGenerator.generateRegistrationData();
      const response = await apiClient.post("/register", userData);

      ResponseValidator.validateResponseTime(response, 5000); // 5 seconds max
    });

    test("login endpoint should respond within reasonable time", async () => {
      // Create user first
      const userData = TestDataGenerator.generateRegistrationData();
      await apiClient.post("/register", userData);

      // Test login response time
      const response = await apiClient.post("/login", userData);

      ResponseValidator.validateResponseTime(response, 3000); // 3 seconds max
    });
  });
});
