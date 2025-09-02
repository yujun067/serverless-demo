// Jest global setup and configuration
const { execSync } = require("child_process");
const fs = require("fs");

// Global test configuration
global.testConfig = {
  apiUrl: null,
  albUrl: null,
  frontendUrl: null,
  testMode: process.env.TEST_MODE || "test",
  timeout: 30000,
};

// Setup function to initialize test environment
beforeAll(async () => {
  console.log("🧪 Initializing Jest test environment...");

  try {
    // Get URLs from Terraform outputs
    const apiUrl = execSync(
      'cd ../../terraform && terraform output -raw api_gateway_url 2>/dev/null || echo ""',
      { encoding: "utf8" }
    ).trim();

    const albUrl = execSync(
      'cd ../../terraform && terraform output -raw websocket_alb_dns_name 2>/dev/null || echo ""',
      { encoding: "utf8" }
    ).trim();

    const frontendUrl = execSync(
      'cd ../../terraform && terraform output -raw website_url 2>/dev/null || echo ""',
      { encoding: "utf8" }
    ).trim();

    if (!apiUrl) {
      throw new Error("API Gateway URL not found. Please deploy first.");
    }

    global.testConfig.apiUrl = apiUrl;
    global.testConfig.albUrl = albUrl;
    global.testConfig.frontendUrl = frontendUrl;

    console.log(`🔗 API Gateway URL: ${apiUrl}`);
    if (albUrl) console.log(`🔗 WebSocket ALB URL: ${albUrl}`);
    if (frontendUrl) console.log(`🌐 Frontend URL: ${frontendUrl}`);
  } catch (error) {
    console.error("❌ Failed to initialize test environment:", error.message);
    process.exit(1);
  }
});

// Global cleanup
afterAll(async () => {
  console.log("🧹 Cleaning up test environment...");

  // Cleanup any temporary files
  const tempFiles = ["/tmp/jest_response.json", "/tmp/jest_test_data.json"];

  tempFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
});

// Custom Jest matchers
expect.extend({
  toBeValidHttpStatus(received, expected) {
    const validStatuses = Array.isArray(expected) ? expected : [expected];
    const pass = validStatuses.includes(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid HTTP status`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be one of ${validStatuses.join(", ")}`,
        pass: false,
      };
    }
  },

  toHaveResponseTime(received, maxTime) {
    const pass = received <= maxTime;

    if (pass) {
      return {
        message: () => `expected ${received}ms not to be within ${maxTime}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received}ms to be within ${maxTime}ms`,
        pass: false,
      };
    }
  },
});

// Suppress console.log during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: console.warn,
    error: console.error,
  };
}
