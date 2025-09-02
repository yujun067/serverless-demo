// Input validation utilities
const validateUsername = (username) => {
  if (!username || username.length < 3 || username.length > 20) {
    return false;
  }
  return /^[a-zA-Z0-9_]+$/.test(username);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

const validateGuess = (guess) => {
  return guess === "up" || guess === "down";
};

module.exports = {
  validateUsername,
  validatePassword,
  validateGuess,
};
