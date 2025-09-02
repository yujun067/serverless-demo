const AWS = require("aws-sdk");

// Initialize DynamoDB client
const dynamodb = new AWS.DynamoDB.DocumentClient();

// User operations
const getUserById = async (userId) => {
  // Since the table has a composite key (user_id + timestamp), we need to query instead of get
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    KeyConditionExpression: "user_id = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  };

  const result = await dynamodb.query(params).promise();
  return result.Items[0]; // Return the first (and should be only) item
};

const getUserByUsername = async (username) => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    IndexName: "username-index",
    KeyConditionExpression: "username = :username",
    ExpressionAttributeValues: {
      ":username": username,
    },
  };

  const result = await dynamodb.query(params).promise();
  return result.Items[0];
};

const createUser = async (userData) => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: userData,
  };

  await dynamodb.put(params).promise();
  return userData;
};

const updateUser = async (userId, updates) => {
  // First, get the user to find the timestamp
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const updateExpression = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.keys(updates).forEach((key) => {
    updateExpression.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = updates[key];
  });

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      user_id: userId,
      timestamp: user.timestamp, // Include timestamp from the composite key
    },
    UpdateExpression: `SET ${updateExpression.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  };

  const result = await dynamodb.update(params).promise();
  return result.Attributes;
};

module.exports = {
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
};
