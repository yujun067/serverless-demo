import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api } from "../services/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Verify token by fetching user data
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  // Listen for auth-error events (token expiration)
  useEffect(() => {
    const handleAuthError = (event) => {
      console.log("Auth error received:", event.detail);
      logout(); // This will clear token and redirect to login
    };

    window.addEventListener("auth-error", handleAuthError);

    return () => {
      window.removeEventListener("auth-error", handleAuthError);
    };
  }, [logout]);

  const fetchUserData = async () => {
    try {
      const response = await api.get("/user/score");
      setUser(response.data.data);
    } catch (error) {
      console.error("Token validation failed:", error);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await api.post("/login", { username, password });
      const { token, ...userData } = response.data.data;

      localStorage.setItem("token", token);
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Login failed",
      };
    }
  };

  const register = async (username, password) => {
    try {
      const response = await api.post("/register", { username, password });
      const { token, ...userData } = response.data.data;

      localStorage.setItem("token", token);
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Registration failed",
      };
    }
  };

  const updateUser = useCallback((userData) => {
    setUser((prevUser) => ({ ...prevUser, ...userData }));
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    fetchUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
