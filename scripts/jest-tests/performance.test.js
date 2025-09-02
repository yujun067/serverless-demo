// Performance & Load Tests
// Basic performance and load testing for the API endpoints

const {
  ApiClient,
  AuthHelper,
  ResponseValidator,
  TestDataGenerator,
} = require("./utils/api-client");

describe("Performance & Load Tests", () => {
  let apiClient;
  let authHelper;
  let testUser;

  beforeAll(async () => {
    apiClient = new ApiClient(global.testConfig.apiUrl);
    authHelper = new AuthHelper(apiClient);

    // Create test user for performance tests
    testUser = await authHelper.createTestUser();
  });

  describe("API Response Time Tests", () => {
    test("authentication endpoints should respond quickly", async () => {
      const registrationData = {
        username: TestDataGenerator.generateUniqueUsername(),
        password: "testpass123",
      };

      // Test registration response time
      const registrationResponse = await apiClient.post(
        "/register",
        registrationData
      );
      ResponseValidator.validateSuccessResponse(
        registrationResponse,
        [200, 201]
      );
      ResponseValidator.validateResponseTime(registrationResponse, 5000);

      // Test login response time
      const loginResponse = await apiClient.post("/login", registrationData);
      ResponseValidator.validateSuccessResponse(loginResponse);
      ResponseValidator.validateResponseTime(loginResponse, 3000);
    });

    test("protected endpoints should respond within acceptable time", async () => {
      const endpoints = [
        { method: "GET", path: "/price", maxTime: 5000 },
        { method: "GET", path: "/user/score", maxTime: 3000 },
      ];

      for (const endpoint of endpoints) {
        const response = await apiClient.authenticatedRequest(
          endpoint.method,
          endpoint.path,
          testUser.token
        );

        ResponseValidator.validateSuccessResponse(response);
        ResponseValidator.validateResponseTime(response, endpoint.maxTime);
      }
    });

    test("guess submission should be processed quickly", async () => {
      // Create a new user to avoid active guess conflicts
      const guessUser = await authHelper.createTestUser();

      const response = await apiClient.authenticatedPost(
        "/guess",
        guessUser.token,
        { guess: "up" }
      );

      ResponseValidator.validateSuccessResponse(response, [200, 201]);
      ResponseValidator.validateResponseTime(response, 3000);
    });

    test("should measure cold start vs warm start performance", async () => {
      // First request (potential cold start)
      const coldStartResponse = await apiClient.authenticatedGet(
        "/price",
        testUser.token
      );
      ResponseValidator.validateSuccessResponse(coldStartResponse);

      // Immediate second request (warm start)
      const warmStartResponse = await apiClient.authenticatedGet(
        "/price",
        testUser.token
      );
      ResponseValidator.validateSuccessResponse(warmStartResponse);

      // Both should be reasonably fast, but warm start should be faster or similar
      ResponseValidator.validateResponseTime(coldStartResponse, 10000); // Allow more time for cold start
      ResponseValidator.validateResponseTime(warmStartResponse, 5000);

      console.log(
        `Cold start: ${coldStartResponse.responseTime}ms, Warm start: ${warmStartResponse.responseTime}ms`
      );
    });
  });

  describe("Consecutive Request Handling", () => {
    test("should handle consecutive API calls efficiently", async () => {
      const consecutiveRequests = 5;
      const results = [];

      for (let i = 0; i < consecutiveRequests; i++) {
        const response = await apiClient.authenticatedGet(
          "/user/score",
          testUser.token
        );

        ResponseValidator.validateSuccessResponse(response);
        ResponseValidator.validateResponseTime(response, 5000);

        results.push({
          attempt: i + 1,
          responseTime: response.responseTime,
          status: response.status,
        });

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // All requests should succeed
      const successCount = results.filter((r) => r.status === 200).length;
      expect(successCount).toBe(consecutiveRequests);

      // Calculate average response time
      const avgResponseTime =
        results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(avgResponseTime).toBeLessThan(5000);

      console.log(
        `Average response time over ${consecutiveRequests} requests: ${avgResponseTime.toFixed(
          2
        )}ms`
      );
    });

    test("should maintain performance under rapid requests", async () => {
      const rapidRequests = Array(3)
        .fill()
        .map((_, index) => ({
          promise: apiClient.authenticatedGet("/user/score", testUser.token),
          index,
        }));

      const startTime = Date.now();
      const responses = await Promise.all(rapidRequests.map((r) => r.promise));
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        ResponseValidator.validateSuccessResponse(response);
      });

      // Total time should be reasonable (not much longer than single request)
      expect(totalTime).toBeLessThan(10000);

      console.log(`3 parallel requests completed in ${totalTime}ms`);
    });
  });

  describe("Concurrent Load Testing", () => {
    test("should handle moderate concurrent load", async () => {
      const concurrentUsers = 5;
      const requestsPerUser = 2;

      // Create multiple test users
      const users = await authHelper.createMultipleTestUsers(concurrentUsers);
      expect(users.length).toBeGreaterThanOrEqual(Math.min(concurrentUsers, 3)); // At least 3 users should be created

      // Generate concurrent requests from multiple users
      const allRequests = [];
      users.forEach((user) => {
        for (let i = 0; i < requestsPerUser; i++) {
          allRequests.push({
            promise: apiClient.authenticatedGet("/user/score", user.token),
            userId: user.userId,
            requestIndex: i,
          });
        }
      });

      const startTime = Date.now();
      const responses = await Promise.allSettled(
        allRequests.map((r) => r.promise)
      );
      const totalTime = Date.now() - startTime;

      // Analyze results
      const successful = responses.filter(
        (r) => r.status === "fulfilled" && [200, 201].includes(r.value.status)
      );
      const failed = responses.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && r.value.status >= 400)
      );

      // At least 80% should succeed under concurrent load
      const successRate = successful.length / responses.length;
      expect(successRate).toBeGreaterThanOrEqual(0.8);

      console.log(
        `Concurrent load test: ${successful.length}/${
          responses.length
        } requests succeeded (${(successRate * 100).toFixed(
          1
        )}%) in ${totalTime}ms`
      );
    });

    test("should handle mixed endpoint concurrent access", async () => {
      const mixedRequests = [
        apiClient.authenticatedGet("/price", testUser.token),
        apiClient.authenticatedGet("/user/score", testUser.token),
        apiClient.authenticatedGet("/price", testUser.token),
        apiClient.authenticatedGet("/user/score", testUser.token),
        apiClient.authenticatedGet("/price", testUser.token),
      ];

      const startTime = Date.now();
      const responses = await Promise.allSettled(mixedRequests);
      const totalTime = Date.now() - startTime;

      // Most requests should succeed
      const successful = responses.filter(
        (r) => r.status === "fulfilled" && [200, 201].includes(r.value.status)
      );

      expect(successful.length).toBeGreaterThanOrEqual(4); // At least 4 out of 5
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(
        `Mixed endpoint test: ${successful.length}/${responses.length} requests succeeded in ${totalTime}ms`
      );
    });
  });

  describe("Payload Size Performance", () => {
    test("should handle different request payload sizes efficiently", async () => {
      const payloadTests = [
        {
          name: "Small payload",
          data: { guess: "up" },
          maxTime: 3000,
        },
        {
          name: "Medium payload",
          data: {
            guess: "up",
            metadata: "x".repeat(1000), // 1KB of extra data
          },
          maxTime: 5000,
        },
      ];

      for (const test of payloadTests) {
        // Create new user for each test to avoid active guess conflicts
        const user = await authHelper.createTestUser();

        const response = await apiClient.authenticatedPost(
          "/guess",
          user.token,
          test.data
        );

        // Should either succeed or fail gracefully (not due to performance)
        if (response.status === 200 || response.status === 201) {
          ResponseValidator.validateSuccessResponse(response, [200, 201]);
          ResponseValidator.validateResponseTime(response, test.maxTime);
        } else {
          // Might fail due to payload size, but should respond quickly
          ResponseValidator.validateResponseTime(response, test.maxTime);
        }

        console.log(
          `${test.name}: ${response.status} in ${response.responseTime}ms`
        );
      }
    });

    test("should handle large response payloads efficiently", async () => {
      // Test endpoints that might return larger responses
      const response = await apiClient.authenticatedGet(
        "/user/score",
        testUser.token
      );

      ResponseValidator.validateSuccessResponse(response);
      ResponseValidator.validateResponseTime(response, 3000);

      // Response should contain expected data structure
      const userData = response.data.data || response.data;
      expect(userData.user_id).toBeDefined();
      expect(userData.username).toBeDefined();
      expect(userData.score).toBeDefined();
    });
  });

  describe("Memory and Resource Usage", () => {
    test("should handle resource-intensive request patterns", async () => {
      // Simulate a pattern that might stress the system
      const intensivePattern = [];

      // Rapid authentication requests
      for (let i = 0; i < 3; i++) {
        intensivePattern.push(
          apiClient.authenticatedGet("/price", testUser.token)
        );
        intensivePattern.push(
          apiClient.authenticatedGet("/user/score", testUser.token)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.allSettled(intensivePattern);
      const totalTime = Date.now() - startTime;

      // Most requests should succeed
      const successful = responses.filter(
        (r) => r.status === "fulfilled" && [200, 201].includes(r.value.status)
      );

      const successRate = successful.length / responses.length;
      expect(successRate).toBeGreaterThanOrEqual(0.8);
      expect(totalTime).toBeLessThan(20000);

      console.log(
        `Resource-intensive pattern: ${
          successRate * 100
        }% success rate in ${totalTime}ms`
      );
    });

    test("should maintain performance across extended usage", async () => {
      // Simulate extended usage pattern
      const extendedTests = [];

      for (let i = 0; i < 10; i++) {
        extendedTests.push(
          apiClient
            .authenticatedGet("/user/score", testUser.token)
            .then((response) => ({
              index: i,
              responseTime: response.responseTime,
              status: response.status,
            }))
        );

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const results = await Promise.all(extendedTests);

      // All requests should succeed
      const successCount = results.filter((r) => r.status === 200).length;
      expect(successCount).toBe(results.length);

      // Performance should remain consistent (no significant degradation)
      const responseTimes = results.map((r) => r.responseTime);
      const avgResponseTime =
        responseTimes.reduce((sum, time) => sum + time, 0) /
        responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      expect(avgResponseTime).toBeLessThan(5000);
      expect(maxResponseTime).toBeLessThan(10000);

      console.log(
        `Extended usage: avg ${avgResponseTime.toFixed(
          2
        )}ms, max ${maxResponseTime}ms`
      );
    });
  });

  describe("Error Handling Performance", () => {
    test("should handle error cases quickly", async () => {
      const errorTests = [
        {
          name: "Invalid endpoint",
          request: () => apiClient.get("/nonexistent"),
          expectedStatus: 403,
        },
        {
          name: "Unauthenticated request",
          request: () => apiClient.get("/price"),
          expectedStatus: 401,
        },
        {
          name: "Invalid data",
          request: () => apiClient.post("/register", {}),
          expectedStatus: 400,
        },
      ];

      for (const test of errorTests) {
        const response = await test.request();

        expect(response.status).toBe(test.expectedStatus);
        ResponseValidator.validateResponseTime(response, 5000);

        console.log(
          `${test.name}: ${response.status} in ${response.responseTime}ms`
        );
      }
    });

    test("should handle timeout scenarios gracefully", async () => {
      // Create client with short timeout for testing
      const timeoutClient = new ApiClient(global.testConfig.apiUrl);
      timeoutClient.client.defaults.timeout = 1000; // 1 second timeout

      try {
        const response = await timeoutClient.authenticatedGet(
          "/price",
          testUser.token
        );

        // If request succeeds despite short timeout, validate it
        if (response.status === 200) {
          ResponseValidator.validateSuccessResponse(response);
        }
      } catch (error) {
        // Timeout is acceptable for this test
        expect(error.message).toMatch(/timeout|network/i);
      }
    }, 10000);
  });

  describe("Performance Benchmarking", () => {
    test("should establish performance baseline", async () => {
      const benchmarkTests = [
        { name: "User Score", endpoint: "/user/score", method: "GET" },
        { name: "Price Data", endpoint: "/price", method: "GET" },
      ];

      const benchmarkResults = {};

      for (const test of benchmarkTests) {
        const iterations = 5;
        const times = [];

        for (let i = 0; i < iterations; i++) {
          const response = await apiClient.authenticatedRequest(
            test.method,
            test.endpoint,
            testUser.token
          );

          ResponseValidator.validateSuccessResponse(response);
          times.push(response.responseTime);

          // Small delay between iterations
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const avgTime =
          times.reduce((sum, time) => sum + time, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);

        benchmarkResults[test.name] = {
          average: avgTime,
          minimum: minTime,
          maximum: maxTime,
          iterations,
        };

        // Performance expectations
        expect(avgTime).toBeLessThan(5000);
        expect(maxTime).toBeLessThan(10000);
      }

      console.log("Performance Benchmark Results:");
      Object.entries(benchmarkResults).forEach(([name, stats]) => {
        console.log(
          `${name}: avg ${stats.average.toFixed(2)}ms, min ${
            stats.minimum
          }ms, max ${stats.maximum}ms`
        );
      });
    });
  });
});
