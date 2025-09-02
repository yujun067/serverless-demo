import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, sseClient } from "../services/api";
import {
  Bitcoin,
  TrendingUp,
  TrendingDown,
  LogOut,
  Trophy,
  DollarSign,
  Timer,
  User,
} from "lucide-react";
import toast from "react-hot-toast";

const Game = () => {
  const { user, logout, updateUser } = useAuth();
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeUntilNextGuess, setTimeUntilNextGuess] = useState(0);
  const [canGuess, setCanGuess] = useState(true);
  const [showSSLGuide, setShowSSLGuide] = useState(false);
  const [sslCheckPassed, setSSLCheckPassed] = useState(false);

  // SSE event handlers
  const handlePriceUpdate = useCallback((data) => {
    // Price update received
    setPriceData(data.data);
  }, []);

  const handleGuessResult = useCallback(
    (data) => {
      const result = data.data;

      // Update user score
      updateUser({
        score: result.new_score,
        active_guess: null,
        guess_timestamp: null,
      });

      // Show result notification
      const message = result.is_correct
        ? `🎉 Correct! +1 point. Score: ${result.new_score}`
        : `❌ Wrong! -1 point. Score: ${result.new_score}`;

      toast.success(message, {
        duration: 5000,
        icon: result.is_correct ? "🎉" : "❌",
      });

      // Reset guess state
      setCanGuess(true);
      setTimeUntilNextGuess(0);
    },
    [updateUser]
  );

  const handleConnection = useCallback((data) => {
    console.log("SSE connected:", data.message);
    setSSLCheckPassed(true);
    setShowSSLGuide(false);
  }, []);

  const handleTestMessage = useCallback((data) => {
    console.log("SSE test message received:", data.message);
  }, []);

  // Check SSL certificate validity
  const checkSSLCertificate = useCallback(async (updateState = true) => {
    const sseUrl =
      process.env.REACT_APP_SSE_URL ||
      "https://bitcoin-game-websocket-alb-1129153088.eu-north-1.elb.amazonaws.com/sse/price";
    const albUrl = sseUrl.replace("/sse/price", "");

    try {
      const response = await fetch(`${albUrl}/health`, {
        method: "GET",
        mode: "cors",
      });
      if (response.ok) {
        if (updateState) {
          setSSLCheckPassed(true);
          setShowSSLGuide(false); // Hide SSL guide when check passes
        }
        return true;
      }
    } catch (error) {
      console.log("SSL check failed:", error.message);
      if (
        error.name === "TypeError" ||
        error.message.includes("certificate") ||
        error.message.includes("ERR_CERT") ||
        error.message.includes("SSL")
      ) {
        if (updateState) {
          setSSLCheckPassed(false);
          setShowSSLGuide(true);
        }
        return false;
      }
    }
    return false;
  }, []);

  // Handle SSL certificate setup
  const handleSSLSetup = () => {
    const sseUrl =
      process.env.REACT_APP_SSE_URL ||
      "https://bitcoin-game-websocket-alb-1129153088.eu-north-1.elb.amazonaws.com/sse/price";
    const albUrl = sseUrl.replace("/sse/price", "");
    window.open(`${albUrl}/health`, "_blank");
    toast.success(
      "Please accept the security certificate in the new window, then refresh this page",
      {
        duration: 8000,
      }
    );
  };

  // Initialize SSE connection with automatic data freshness monitoring
  useEffect(() => {
    // Don't initialize SSE connection if user is not authenticated
    if (!user) {
      console.log("User not authenticated, skipping SSE connection");
      return;
    }

    // Verify JWT token exists before attempting SSE connection
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("No JWT token found, skipping SSE connection");
      return;
    }

    let dataFreshnessTimer;

    const initializeConnection = async () => {
      try {
        // First check SSL certificate (don't update state to avoid infinite loop)
        const sslOk = await checkSSLCertificate(false);

        if (sslOk || sslCheckPassed) {
          const sseUrl =
            process.env.REACT_APP_SSE_URL ||
            "https://bitcoin-game-websocket-alb-1129153088.eu-north-1.elb.amazonaws.com/sse/price";

          console.log(
            "Starting SSE connection with auto-recovery for authenticated user"
          );

          // Initial fetch for immediate data
          await fetchLatestPrice();

          // Start SSE connection
          await sseClient.connect(sseUrl);

          // Add event listeners
          sseClient.addEventListener("connection", handleConnection);
          sseClient.addEventListener("test", handleTestMessage);
          sseClient.addEventListener("price_update", handlePriceUpdate);
          sseClient.addEventListener("guess_result", handleGuessResult);

          // Monitor data freshness - fallback to API if SSE fails
          dataFreshnessTimer = setInterval(() => {
            if (priceData) {
              const dataAge =
                Date.now() - new Date(priceData.timestamp).getTime();
              // If data is older than 30 seconds, fetch fresh data via API
              if (dataAge > 30000) {
                console.warn("Price data is stale, fetching fresh data...");
                fetchLatestPrice().catch(console.error);
              }
            }
          }, 15000); // Check every 15 seconds
        }
      } catch (error) {
        // Handle connection errors (including JWT expiration)
        console.log("SSE connection failed:", error.message);

        // If it's a JWT error, the auth-error event has already been triggered
        // and the user will be redirected to login automatically
        if (error.message.includes("JWT token expired")) {
          console.log("JWT error handled, user will be redirected to login");
          return; // Early return, let the auth system handle it
        }

        // For other errors, we could add retry logic or fallback behavior
        console.error("Unexpected SSE connection error:", error);
      }
    };

    initializeConnection();

    // Cleanup on unmount or when user becomes unauthenticated
    return () => {
      if (dataFreshnessTimer) {
        clearInterval(dataFreshnessTimer);
      }
      sseClient.removeEventListener("connection", handleConnection);
      sseClient.removeEventListener("test", handleTestMessage);
      sseClient.removeEventListener("price_update", handlePriceUpdate);
      sseClient.removeEventListener("guess_result", handleGuessResult);
      sseClient.disconnect();
      console.log(
        "SSE connection cleaned up due to auth state change or component unmount"
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sslCheckPassed]); // Re-run when user auth state or SSL check status changes

  // Fetch initial price data
  const fetchLatestPrice = useCallback(async () => {
    try {
      const response = await api.get("/price");
      setPriceData(response.data.data);
    } catch (error) {
      console.error("Failed to fetch price:", error);
    }
  }, []);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    try {
      const response = await api.get("/user/score");
      updateUser(response.data.data);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // updateUser is stable from context

  // Submit guess
  const submitGuess = async (guess) => {
    if (!canGuess) {
      toast.error("Please wait for your current guess to be resolved");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/guess", { guess });
      toast.success(response.data.data.message);

      // Update user data to reflect active guess
      await fetchUserData();

      // Start countdown
      setCanGuess(false);
      setTimeUntilNextGuess(60);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to submit guess");
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    let interval;
    if (timeUntilNextGuess > 0) {
      interval = setInterval(() => {
        setTimeUntilNextGuess((prev) => {
          if (prev <= 1) {
            setCanGuess(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timeUntilNextGuess]);

  // Check for active guess and update countdown
  useEffect(() => {
    if (user?.active_guess && user?.guess_timestamp) {
      const guessTime = new Date(user.guess_timestamp).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - guessTime) / 1000);
      const remaining = Math.max(0, 60 - elapsed);

      if (remaining > 0) {
        setCanGuess(false);
        setTimeUntilNextGuess(remaining);
      } else {
        setCanGuess(true);
        setTimeUntilNextGuess(0);
      }
    } else {
      setCanGuess(true);
      setTimeUntilNextGuess(0);
    }
  }, [user?.active_guess, user?.guess_timestamp]);

  // Initial SSL check and data fetch
  useEffect(() => {
    // Initial SSL check to set state for UI
    checkSSLCertificate(true);
    fetchLatestPrice();
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - we want this to run only once on mount

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Bitcoin className="w-8 h-8 text-bitcoin-400" />
              <h1 className="text-xl font-bold text-white">
                Bitcoin Prediction Game
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-300">
                <Trophy className="w-5 h-5 text-primary-400" />
                <span className="score-display">{user?.score || 0}</span>
              </div>

              <div className="flex items-center space-x-2 text-gray-300">
                <User className="w-5 h-5 text-primary-400" />
                <span className="font-medium">{user?.username}</span>
              </div>

              <button
                onClick={handleLogout}
                className="btn-secondary flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Price Display Card */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <DollarSign className="w-6 h-6 text-bitcoin-400 mr-2" />
                  Current Bitcoin Price
                </h2>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      sseClient.getStatus().connected
                        ? "bg-green-500"
                        : showSSLGuide
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  ></div>
                  <span className="text-sm text-gray-400">
                    {sseClient.getStatus().connected
                      ? "Live (Stream)"
                      : showSSLGuide
                      ? "Certificate Setup Required"
                      : "Connecting..."}
                  </span>
                  {showSSLGuide && (
                    <button
                      onClick={handleSSLSetup}
                      className="btn-primary flex items-center space-x-2 text-xs px-2 py-1"
                    >
                      <span>Setup SSL</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="text-center">
                {priceData ? (
                  <div className="space-y-4">
                    <div className="price-display text-4xl lg:text-6xl">
                      {formatPrice(priceData.price)}
                    </div>

                    <div className="flex justify-center space-x-8 text-sm text-gray-400">
                      <div>
                        <span className="block">High Price</span>
                        <span className="font-mono text-green-400">
                          $
                          {priceData.high_price
                            ? Number(priceData.high_price).toLocaleString(
                                "en-US",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )
                            : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="block">Low Price</span>
                        <span className="font-mono text-red-400">
                          $
                          {priceData.low_price
                            ? Number(priceData.low_price).toLocaleString(
                                "en-US",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )
                            : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="block">Trades</span>
                        <span className="font-mono text-blue-400">
                          {priceData.trades_count || 0} txs
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">
                      Last updated:{" "}
                      {new Date(priceData.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Game Controls Card */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-xl font-bold text-white mb-6">
                Make Your Prediction
              </h2>

              {/* SSL Certificate Guide */}
              {showSSLGuide && (
                <div className="mb-6 p-4 bg-yellow-900/50 border border-yellow-600 rounded-lg">
                  <h3 className="text-sm font-medium text-yellow-200 mb-2 flex items-center">
                    🔒 SSL Certificate Setup Required
                  </h3>
                  <p className="text-xs text-yellow-300 mb-3">
                    To connect to the real-time price feed, you need to accept
                    the SSL certificate. This is a one-time setup.
                  </p>
                  <div className="space-y-2 text-xs text-yellow-300">
                    <div>1. Click the "Setup SSL" button above</div>
                    <div>
                      2. In the new window, click "Advanced" → "Proceed to..."
                    </div>
                    <div>3. Close the window and refresh this page</div>
                  </div>
                  <button
                    onClick={handleSSLSetup}
                    className="mt-3 w-full btn-primary text-sm py-2"
                  >
                    🔒 Setup SSL Certificate
                  </button>
                </div>
              )}

              {/* Active Guess Status */}
              {user?.active_guess && (
                <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-300 mb-2">
                    Active Guess
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Prediction:</span>
                      <span
                        className={`font-medium ${
                          user.active_guess.guess === "up"
                            ? "text-success-400"
                            : "text-error-400"
                        }`}
                      >
                        {user.active_guess.guess.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price at guess:</span>
                      <span className="font-mono">
                        {formatPrice(user.active_guess.price_at_guess)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Time remaining:</span>
                      <span className="font-mono text-primary-400">
                        {formatTime(timeUntilNextGuess)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Guess Buttons */}
              <div className="space-y-4">
                <button
                  onClick={() => submitGuess("up")}
                  disabled={!canGuess || loading}
                  className="btn-success w-full flex items-center justify-center space-x-2 py-4 text-lg font-semibold"
                >
                  <TrendingUp className="w-6 h-6" />
                  <span>PRICE WILL GO UP</span>
                </button>

                <button
                  onClick={() => submitGuess("down")}
                  disabled={!canGuess || loading}
                  className="btn-error w-full flex items-center justify-center space-x-2 py-4 text-lg font-semibold"
                >
                  <TrendingDown className="w-6 h-6" />
                  <span>PRICE WILL GO DOWN</span>
                </button>
              </div>

              {/* Status Message */}
              {!canGuess && (
                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <Timer className="w-4 h-4 text-primary-400" />
                    <span>
                      Wait {formatTime(timeUntilNextGuess)} before next guess
                    </span>
                  </div>
                </div>
              )}

              {loading && (
                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                    <span>Submitting guess...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Game Rules */}
            <div className="card mt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                How to Play
              </h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Predict if Bitcoin price will go UP or DOWN</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Wait 60 seconds for your guess to be resolved</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Correct guess: +1 point, Wrong guess: -1 point</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>You can only make one guess at a time</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Game;
