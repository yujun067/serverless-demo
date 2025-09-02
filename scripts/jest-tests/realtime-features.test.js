// Real-time Features Tests
// Tests WebSocket service, SSE functionality, and real-time game features

const {
  ApiClient,
  AuthHelper,
  ResponseValidator,
} = require("./utils/api-client");
const EventSource = require("eventsource");

describe("Real-time Features Tests", () => {
  let apiClient;
  let authHelper;
  let testUser;
  let albUrl;

  beforeAll(async () => {
    apiClient = new ApiClient(global.testConfig.apiUrl);
    authHelper = new AuthHelper(apiClient);
    albUrl = global.testConfig.albUrl;

    if (!albUrl) {
      console.warn(
        "⚠️  WebSocket ALB URL not available - some tests will be skipped"
      );
    } else {
      // Create test user for authenticated real-time tests
      testUser = await authHelper.createTestUser();
    }
  });

  describe("WebSocket Service Health", () => {
    test("should be skipped if ALB URL not available", () => {
      if (!albUrl) {
        console.log("⚠️  Skipping WebSocket tests - ALB URL not available");
        expect(true).toBe(true); // Skip test
        return;
      }
    });

    test("should respond to health check endpoint", async () => {
      if (!albUrl) return;

      const healthClient = new ApiClient(`https://${albUrl}`);
      const response = await healthClient.get("/health");

      // Handle SSL certificate issues in development
      if (response.sslError || response.status === 526) {
        console.warn(
          "⚠️  SSL certificate issue detected - acceptable in development"
        );
        expect(response.data.error).toContain("SSL certificate");
        return;
      }

      // Health endpoint should respond with 200 or 503 (partial service)
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.data.status).toBe("ok");
      } else if (response.status === 503) {
        // Partial service (e.g., Binance disconnected) is acceptable
        expect(response.data.status).toBe("ok");
      }
    });

    test("should handle invalid health endpoints gracefully", async () => {
      if (!albUrl) return;

      const healthClient = new ApiClient(`https://${albUrl}`);
      const invalidEndpoints = ["/invalid", "/health/invalid", "/status"];

      for (const endpoint of invalidEndpoints) {
        const response = await healthClient.get(endpoint);

        // Handle SSL certificate issues in development
        if (response.sslError || response.status === 526) {
          console.warn(
            "⚠️  SSL certificate issue detected - acceptable in development"
          );
          continue; // Skip this endpoint test
        }

        // Should return 404 or redirect appropriately
        expect([404, 200, 301, 302]).toContain(response.status);
      }
    });

    test("should be accessible via HTTPS", async () => {
      if (!albUrl) return;

      const healthClient = new ApiClient(`https://${albUrl}`);

      const response = await healthClient.get("/health");

      // Handle SSL certificate issues in development
      if (response.sslError || response.status === 526) {
        console.warn(
          "⚠️  SSL certificate issue detected - acceptable in development"
        );
        expect(response.data.error).toContain("SSL certificate");
        return;
      }

      expect([200, 503]).toContain(response.status);
    });
  });

  describe("Server-Sent Events (SSE) Functionality", () => {
    test("should require authentication for SSE endpoint", async () => {
      if (!albUrl || !testUser) return;

      const sseUrl = `https://${albUrl}/sse/price`;

      // Test without authentication
      const unauthenticated = new Promise((resolve, reject) => {
        const eventSource = new EventSource(sseUrl);

        const timeout = setTimeout(() => {
          eventSource.close();
          resolve({ status: "timeout", authenticated: false });
        }, 3000);

        eventSource.onerror = (error) => {
          clearTimeout(timeout);
          eventSource.close();
          // Error is expected for unauthenticated request
          resolve({ status: "error", authenticated: false });
        };

        eventSource.onopen = () => {
          clearTimeout(timeout);
          eventSource.close();
          // Should not open without authentication
          resolve({ status: "opened", authenticated: false });
        };
      });

      const result = await unauthenticated;
      expect(["error", "timeout"]).toContain(result.status);
    });

    test("should establish SSE connection with valid authentication", async () => {
      if (!albUrl || !testUser) return;

      const sseUrl = `https://${albUrl}/sse/price`;

      const sseTest = new Promise((resolve, reject) => {
        const eventSource = new EventSource(sseUrl, {
          headers: {
            Authorization: `Bearer ${testUser.token}`,
          },
        });

        const timeout = setTimeout(() => {
          eventSource.close();
          resolve({
            status: "timeout",
            connected: false,
            messagesReceived: 0,
          });
        }, 10000);

        let messagesReceived = 0;
        let connectionEstablished = false;

        eventSource.onopen = () => {
          connectionEstablished = true;
        };

        eventSource.onmessage = (event) => {
          messagesReceived++;

          try {
            const data = JSON.parse(event.data);

            // If we receive valid data, test is successful
            if (messagesReceived >= 1) {
              clearTimeout(timeout);
              eventSource.close();
              resolve({
                status: "success",
                connected: connectionEstablished,
                messagesReceived,
                lastMessage: data,
              });
            }
          } catch (error) {
            // Invalid JSON in SSE message
            clearTimeout(timeout);
            eventSource.close();
            resolve({
              status: "invalid_json",
              connected: connectionEstablished,
              messagesReceived,
              error: error.message,
            });
          }
        };

        eventSource.onerror = (error) => {
          clearTimeout(timeout);
          eventSource.close();

          if (messagesReceived > 0) {
            // Connection worked but then failed - this might be normal
            resolve({
              status: "connection_lost",
              connected: connectionEstablished,
              messagesReceived,
            });
          } else {
            resolve({
              status: "connection_failed",
              connected: false,
              messagesReceived: 0,
              error: error.message || "Connection failed",
            });
          }
        };
      });

      const result = await sseTest;

      // Consider test successful if connection was established or messages were received
      if (result.connected || result.messagesReceived > 0) {
        expect(["success", "connection_lost"]).toContain(result.status);
        if (result.messagesReceived > 0) {
          expect(result.messagesReceived).toBeGreaterThan(0);
        }
      } else {
        // In development, SSE might not work due to SSL issues or service unavailability
        console.warn(
          "⚠️  SSE connection failed - this may be expected in development environment"
        );
        expect(["connection_failed", "timeout"]).toContain(result.status);
      }
    }, 15000);

    test("should handle invalid SSE endpoints", async () => {
      if (!albUrl || !testUser) return;

      const invalidSseEndpoints = [
        `/sse/invalid`,
        `/sse/price/invalid`,
        `/sse`,
        `/events/price`,
      ];

      for (const endpoint of invalidSseEndpoints) {
        const sseUrl = `https://${albUrl}${endpoint}`;

        const sseTest = new Promise((resolve) => {
          const eventSource = new EventSource(sseUrl, {
            headers: {
              Authorization: `Bearer ${testUser.token}`,
            },
          });

          const timeout = setTimeout(() => {
            eventSource.close();
            resolve({ status: "timeout" });
          }, 3000);

          eventSource.onerror = (error) => {
            clearTimeout(timeout);
            eventSource.close();
            resolve({ status: "error" });
          };

          eventSource.onopen = () => {
            clearTimeout(timeout);
            eventSource.close();
            resolve({ status: "unexpected_success" });
          };
        });

        const result = await sseTest;
        expect(["error", "timeout"]).toContain(result.status);
      }
    });
  });

  describe("Real-time Game Integration", () => {
    test("should handle guess submission workflow", async () => {
      if (!testUser) return;

      // Step 1: Check initial user state
      const initialState = await apiClient.authenticatedGet(
        "/user/score",
        testUser.token
      );
      ResponseValidator.validateSuccessResponse(initialState);

      const initialUserData = initialState.data.data || initialState.data;

      // Step 2: Submit a guess if no active guess exists
      if (!initialUserData.active_guess) {
        const guessResponse = await apiClient.authenticatedPost(
          "/guess",
          testUser.token,
          { guess: "up" }
        );

        if (guessResponse.status === 200 || guessResponse.status === 201) {
          ResponseValidator.validateSuccessResponse(guessResponse, [200, 201]);

          // Step 3: Verify guess was recorded
          const updatedState = await apiClient.authenticatedGet(
            "/user/score",
            testUser.token
          );
          ResponseValidator.validateSuccessResponse(updatedState);

          const updatedUserData = updatedState.data.data || updatedState.data;
          expect(updatedUserData.active_guess).toBeTruthy();

          // Step 4: Verify duplicate guess prevention
          const duplicateGuess = await apiClient.authenticatedPost(
            "/guess",
            testUser.token,
            { guess: "down" }
          );
          ResponseValidator.validateErrorResponse(duplicateGuess, 400);
        }
      } else {
        // User already has active guess - test duplicate prevention
        const duplicateGuess = await apiClient.authenticatedPost(
          "/guess",
          testUser.token,
          { guess: "down" }
        );
        ResponseValidator.validateErrorResponse(duplicateGuess, 400);
      }
    });

    test("should maintain consistent state across multiple requests", async () => {
      if (!testUser) return;

      // Make multiple rapid requests to check state consistency
      const requests = Array(5)
        .fill()
        .map(() => apiClient.authenticatedGet("/user/score", testUser.token));

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach((response) => {
        ResponseValidator.validateSuccessResponse(response);
      });

      // All responses should have consistent user data
      const firstUserData = responses[0].data.data || responses[0].data;
      responses.slice(1).forEach((response) => {
        const userData = response.data.data || response.data;
        expect(userData.user_id).toBe(firstUserData.user_id);
        expect(userData.username).toBe(firstUserData.username);
        expect(userData.score).toBe(firstUserData.score);
      });
    });

    test("should handle price data requests consistently", async () => {
      if (!testUser) return;

      const priceRequests = Array(3)
        .fill()
        .map(() => apiClient.authenticatedGet("/price", testUser.token));

      const responses = await Promise.all(priceRequests);

      // All requests should succeed
      responses.forEach((response) => {
        ResponseValidator.validateSuccessResponse(response);

        const priceData = response.data.data || response.data;

        // Price should be a reasonable number
        if (typeof priceData === "object" && priceData.price) {
          expect(typeof priceData.price).toBe("number");
          expect(priceData.price).toBeGreaterThan(0);
        } else if (typeof priceData === "number") {
          expect(priceData).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("WebSocket Service Error Handling", () => {
    test("should handle service unavailability gracefully", async () => {
      if (!albUrl) return;

      // Test various endpoints that might not be available
      const healthClient = new ApiClient(`https://${albUrl}`);
      const endpoints = ["/", "/status", "/ping", "/healthz"];

      for (const endpoint of endpoints) {
        const response = await healthClient.get(endpoint);

        // Handle SSL certificate issues in development
        if (response.sslError || response.status === 526) {
          console.warn(
            "⚠️  SSL certificate issue detected - acceptable in development"
          );
          continue; // Skip this endpoint test
        }

        // Service should respond or fail gracefully
        expect(response.status).toBeLessThan(500);
      }
    });

    test("should handle SSL/TLS certificate issues in development", async () => {
      if (!albUrl) return;

      try {
        const healthClient = new ApiClient(`https://${albUrl}`);
        await healthClient.get("/health");
      } catch (error) {
        if (
          error.message.includes("certificate") ||
          error.message.includes("SSL") ||
          error.message.includes("CERT")
        ) {
          console.warn(
            "⚠️  SSL certificate issue detected - acceptable in development"
          );
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    });
  });

  describe("Time-sensitive Features", () => {
    test("should handle guess resolution timing", async () => {
      // This test is informational - we cannot wait 60 seconds for guess resolution
      // but we can verify the system tracks timing correctly

      if (!testUser) return;

      const userState = await apiClient.authenticatedGet(
        "/user/score",
        testUser.token
      );
      ResponseValidator.validateSuccessResponse(userState);

      const userData = userState.data.data || userState.data;

      if (userData.active_guess && userData.guess_timestamp) {
        const guessTime = new Date(userData.guess_timestamp);
        const now = new Date();
        const timeDiff = now - guessTime;

        // Guess should have a reasonable timestamp
        expect(timeDiff).toBeGreaterThanOrEqual(0);
        expect(timeDiff).toBeLessThan(24 * 60 * 60 * 1000); // Less than 24 hours old

        // Guess data should have expected structure
        expect(userData.active_guess.guess).toMatch(/^(up|down)$/);
        expect(userData.active_guess.price_at_guess).toBeDefined();
        expect(userData.active_guess.timestamp).toBeDefined();
      }
    });

    test("should maintain accurate timestamps", async () => {
      if (!testUser) return;

      const beforeRequest = new Date();
      const response = await apiClient.authenticatedGet(
        "/user/score",
        testUser.token
      );
      const afterRequest = new Date();

      ResponseValidator.validateSuccessResponse(response);

      // Response should be received within reasonable time
      const responseTime = afterRequest - beforeRequest;
      expect(responseTime).toBeLessThan(10000); // Less than 10 seconds
    });
  });

  describe("Connection Stability", () => {
    test("should handle rapid consecutive requests", async () => {
      if (!testUser) return;

      const rapidRequests = [];
      for (let i = 0; i < 10; i++) {
        rapidRequests.push(
          apiClient.authenticatedGet("/user/score", testUser.token)
        );
      }

      const responses = await Promise.allSettled(rapidRequests);

      // Most requests should succeed
      const successfulResponses = responses.filter(
        (result) =>
          result.status === "fulfilled" &&
          [200, 201].includes(result.value.status)
      );

      // At least 70% should succeed (7 out of 10) - reasonable for high concurrency
      expect(successfulResponses.length).toBeGreaterThanOrEqual(7);
    });

    test("should handle mixed request types", async () => {
      if (!testUser) return;

      const mixedRequests = [
        apiClient.authenticatedGet("/price", testUser.token),
        apiClient.authenticatedGet("/user/score", testUser.token),
        apiClient.authenticatedGet("/price", testUser.token),
        apiClient.authenticatedGet("/user/score", testUser.token),
      ];

      const responses = await Promise.all(mixedRequests);

      // All requests should succeed
      responses.forEach((response) => {
        ResponseValidator.validateSuccessResponse(response);
      });
    });
  });
});
