import axios from "axios";

// Create axios instance with base configuration
export const api = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL ||
    "https://2922lbm4sg.execute-api.eu-north-1.amazonaws.com/prod",
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// SSE Client using Fetch Stream API (more reliable than EventSource)
export class SSEClient {
  constructor() {
    this.abortController = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.lastHeartbeat = Date.now();
    this.currentUrl = null;
    this.connectionMonitorTimer = null;
  }

  async connect(url) {
    if (this.abortController) {
      this.disconnect();
    }

    this.currentUrl = url;
    this.abortController = new AbortController();

    try {
      console.log("SSE client connecting to:", url);

      // Get JWT token from localStorage
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No JWT token found. Please login first.");
      }

      const response = await fetch(url, {
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          Authorization: `Bearer ${token}`,
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        // Check if it's a JWT-related error
        if (response.status === 401 || response.status === 403) {
          console.log("JWT token expired or invalid, redirecting to login...");

          // Clear expired token
          localStorage.removeItem("token");

          // Emit auth error event for UI to handle
          window.dispatchEvent(
            new CustomEvent("auth-error", {
              detail: "Session expired. Please login again.",
            })
          );

          throw new Error("JWT token expired - redirecting to login");
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log("SSE connection established");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.startHeartbeatCheck();
      this.startConnectionMonitor();

      // Start reading the stream
      await this.readStream(response);
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("SSE connection aborted");
        return;
      }

      console.error("SSE connection error:", error);
      this.isConnected = false;
      this.stopHeartbeatCheck();
      this.stopConnectionMonitor();

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log("Scheduling reconnect...");
        this.scheduleReconnect(url);
      } else {
        console.log("Max reconnect attempts reached");
      }
    }
  }

  async readStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("SSE stream ended");
          break;
        }

        // Update heartbeat for any data received
        this.lastHeartbeat = Date.now();

        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines
        const lines = buffer.split("\n");
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6); // Remove 'data: ' prefix

            // Handle heartbeat messages
            if (data.trim() === "heartbeat") {
              // Heartbeat received
              continue;
            }

            // Raw SSE message received

            try {
              const parsedData = JSON.parse(data);
              this.handleMessage(parsedData);
            } catch (error) {
              console.error(
                "Error parsing SSE message:",
                error,
                "Raw data:",
                data
              );
            }
          }
        }
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Stream reading aborted");
        return;
      }
      throw error;
    } finally {
      reader.releaseLock();
    }

    // If we get here, the stream ended normally, trigger reconnect
    this.isConnected = false;
    this.stopHeartbeatCheck();
    this.stopConnectionMonitor();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log("Stream ended, scheduling reconnect...");
      this.scheduleReconnect(this.currentUrl);
    }
  }

  scheduleReconnect(url) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `Scheduling SSE reconnect attempt ${this.reconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      console.log(
        `Attempting SSE reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );
      this.connect(url);
    }, delay);
  }

  startHeartbeatCheck() {
    // Check for heartbeat every 35 seconds (heartbeat is sent every 30 seconds)
    this.heartbeatTimer = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
      if (timeSinceLastHeartbeat > 60000) {
        // No heartbeat for 60 seconds
        console.warn("No heartbeat received, connection may be stale");
        this.disconnect();
      }
    }, 35000);
  }

  stopHeartbeatCheck() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  startConnectionMonitor() {
    // Monitor connection state every 10 seconds
    this.connectionMonitorTimer = setInterval(() => {
      if (this.abortController && !this.abortController.signal.aborted) {
        // Connection monitor check

        // Check if we haven't received any message in the last 15 seconds
        const timeSinceLastMessage = Date.now() - this.lastHeartbeat;
        if (timeSinceLastMessage > 15000 && this.isConnected) {
          console.warn(
            `No messages received for ${Math.round(
              timeSinceLastMessage / 1000
            )}s, connection may be stale. Forcing reconnect...`
          );
          this.disconnect();
          if (this.currentUrl) {
            this.scheduleReconnect(this.currentUrl);
          }
          return;
        }
      } else {
        // No active connection to monitor
        this.stopConnectionMonitor();
      }
    }, 10000);
  }

  stopConnectionMonitor() {
    if (this.connectionMonitorTimer) {
      clearInterval(this.connectionMonitorTimer);
      this.connectionMonitorTimer = null;
    }
  }

  handleMessage(data) {
    const { type } = data;
    // Only log price updates and important events
    if (type === "price_update") {
      console.log(
        "📈 Price update:",
        data.data.price,
        "at",
        new Date(data.timestamp).toLocaleTimeString()
      );
    } else if (type !== "test") {
      console.log("SSE message received:", type, data);
    }

    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in SSE listener for ${type}:`, error);
        }
      });
    } else {
      console.log("No listeners registered for message type:", type);
    }
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  removeEventListener(type, callback) {
    if (this.listeners.has(type)) {
      const callbacks = this.listeners.get(type);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeatCheck();
    this.stopConnectionMonitor();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.isConnected = false;
    this.currentUrl = null;
    console.log("🔌 SSE connection disconnected");
  }

  getStatus() {
    return {
      connected: this.isConnected,
      aborted: this.abortController
        ? this.abortController.signal.aborted
        : true,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      currentUrl: this.currentUrl,
    };
  }
}

// Create global SSE client instance
export const sseClient = new SSEClient();
