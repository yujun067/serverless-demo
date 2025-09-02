const {
  createSuccessResponse,
  createErrorResponse,
  getLatestPrice,
  withMiddleware,
} = require("./shared/utils");

// Core handler function (without middleware)
const getLatestPriceHandler = async (event) => {
  // Get latest price from Redis
  const priceData = await getLatestPrice();

  if (!priceData) {
    return createErrorResponse("Bitcoin price data not available", 503);
  }

  // Return price data with kline fields
  const responseData = {
    price: priceData.price,
    timestamp: priceData.timestamp,
    volume: priceData.volume || 0,
    open_price: priceData.open_price || priceData.price,
    high_price: priceData.high_price || priceData.price,
    low_price: priceData.low_price || priceData.price,
    quote_volume: priceData.quote_volume || 0,
    trades_count: priceData.trades_count || 0,
    kline_start_time: priceData.kline_start_time || priceData.timestamp,
    kline_close_time: priceData.kline_close_time || priceData.timestamp,
    is_closed: priceData.is_closed || true,
    event_type: priceData.event_type || "kline",
  };

  console.log("Latest price retrieved successfully:", responseData.price);
  return createSuccessResponse(responseData);
};

// Export the handler wrapped with middleware
exports.handler = withMiddleware(getLatestPriceHandler, { requireAuth: true });
