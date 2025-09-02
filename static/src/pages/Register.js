import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Bitcoin,
  UserPlus,
  User,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

const Register = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Validation functions
  const validateUsername = (username) => {
    return (
      username.length >= 3 &&
      username.length <= 20 &&
      /^[a-zA-Z0-9_]+$/.test(username)
    );
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const validateConfirmPassword = (password, confirmPassword) => {
    return password === confirmPassword && password.length > 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!validateUsername(formData.username)) {
      toast.error(
        "Username must be 3-20 characters and contain only letters, numbers, and underscores"
      );
      return;
    }

    if (!validatePassword(formData.password)) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (!validateConfirmPassword(formData.password, formData.confirmPassword)) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const result = await register(formData.username, formData.password);

      if (result.success) {
        toast.success("Registration successful! Welcome to the game!");
        navigate("/game");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <Bitcoin className="w-16 h-16 text-bitcoin-400" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">Join the Game</h2>
          <p className="mt-2 text-sm text-gray-400">
            Create your Bitcoin Prediction Game account
          </p>
        </div>

        {/* Registration Form */}
        <div className="card">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Username Field */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="input-field pl-10 w-full"
                  placeholder="Choose a username"
                  value={formData.username}
                  onChange={handleChange}
                />
                {formData.username && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {validateUsername(formData.username) ? (
                      <CheckCircle className="h-5 w-5 text-success-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-error-400" />
                    )}
                  </div>
                )}
              </div>
              {formData.username && !validateUsername(formData.username) && (
                <p className="mt-1 text-xs text-error-400">
                  3-20 characters, letters, numbers, and underscores only
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-field pl-10 pr-10 w-full"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                  )}
                </button>
              </div>
              {formData.password && !validatePassword(formData.password) && (
                <p className="mt-1 text-xs text-error-400">
                  Password must be at least 6 characters long
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  className="input-field pl-10 pr-10 w-full"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                  )}
                </button>
              </div>
              {formData.confirmPassword &&
                !validateConfirmPassword(
                  formData.password,
                  formData.confirmPassword
                ) && (
                  <p className="mt-1 text-xs text-error-400">
                    Passwords do not match
                  </p>
                )}
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex justify-center items-center"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                  </div>
                )}
              </button>
            </div>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-primary-400 hover:text-primary-300 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Start predicting Bitcoin prices and competing for points!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
