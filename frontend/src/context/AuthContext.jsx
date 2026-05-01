import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, getApiErrorMessage } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("ttm_access_token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("ttm_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function boot() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await apiClient.get("/auth/me");
        if (isMounted) {
          setUser(data);
          localStorage.setItem("ttm_user", JSON.stringify(data));
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem("ttm_access_token");
          localStorage.removeItem("ttm_user");
          setToken("");
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    boot();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = async ({ email, password }) => {
    try {
      const { data } = await apiClient.post("/auth/login", { email, password });
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem("ttm_access_token", data.access_token);
      localStorage.setItem("ttm_user", JSON.stringify(data.user));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getApiErrorMessage(error, "Login failed.") };
    }
  };

  const signup = async ({ name, email, password, role, admin_invite_code }) => {
    try {
      const payload = { name, email, password, role };
      if (role === "admin" && admin_invite_code?.trim()) {
        payload.admin_invite_code = admin_invite_code.trim();
      }

      const { data } = await apiClient.post("/auth/signup", payload);
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem("ttm_access_token", data.access_token);
      localStorage.setItem("ttm_user", JSON.stringify(data.user));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getApiErrorMessage(error, "Signup failed.") };
    }
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("ttm_access_token");
    localStorage.removeItem("ttm_user");
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === "admin",
      login,
      signup,
      logout,
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
