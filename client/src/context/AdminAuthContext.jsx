/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { adminApi } from '../lib/api';

const AdminAuthContext = createContext(null);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * AdminAuthProvider — Controls JWT-in-memory auth state and axios interceptors.
 * Incorporates parallel request queuing for 401 Token Refresh to eliminate race conditions.
 */
export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Silent refresh function to fetch new access token via HttpOnly refresh cookie
  const silentRefresh = useCallback(async () => {
    try {
      const { data } = await adminApi.post('/auth/refresh');
      if (data.status === 'NO_SESSION') {
        throw new Error('No session');
      }
      setToken(data.accessToken);
      setIsAuthenticated(true);
      return data.accessToken;
    } catch (err) {
      setToken(null);
      setIsAuthenticated(false);
      setAdmin(null);
      throw err;
    }
  }, []);

  // Fetch current admin profile details
  const fetchProfile = useCallback(async (accessToken) => {
    try {
      const { data } = await adminApi.get('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setAdmin(data.user);
    } catch {
      setToken(null);
      setIsAuthenticated(false);
      setAdmin(null);
    }
  }, []);

  // Initialize JWT interceptors on mount
  useEffect(() => {
    // 1. Request interceptor: inject token dynamically from React state
    const reqInterceptor = adminApi.interceptors.request.use(
      (config) => {
        if (token && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 2. Response interceptor: handle 401 and queue parallel requests
    const resInterceptor = adminApi.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Prevent infinite loops if authentication endpoints themselves fail with 401
        if (originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh')) {
          return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((newToken) => {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return adminApi(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            const newToken = await silentRefresh();
            processQueue(null, newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return adminApi(originalRequest);
          } catch (refreshError) {
            processQueue(refreshError, null);
            setToken(null);
            setIsAuthenticated(false);
            setAdmin(null);
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      adminApi.interceptors.request.eject(reqInterceptor);
      adminApi.interceptors.response.eject(resInterceptor);
    };
  }, [token, silentRefresh]);

  // Initial session check on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const activeToken = await silentRefresh();
        await fetchProfile(activeToken);
      } catch {
        // Safe to ignore on initial mount (user not logged in)
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [silentRefresh, fetchProfile]);

  const login = async (email, password) => {
    try {
      const { data } = await adminApi.post('/auth/login', { email, password });
      setToken(data.accessToken);
      setAdmin(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      setToken(null);
      setIsAuthenticated(false);
      setAdmin(null);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await adminApi.post('/auth/logout');
    } finally {
      setToken(null);
      setAdmin(null);
      setIsAuthenticated(false);
    }
  };

  /**
   * upgradeAdminSession — Exchanges a valid public (donor) admin session for an administrative Bearer JWT token.
   *
   * Why? Enables unified public portal login for administrators, keeping the ADMIN_JWT_SECRET isolated
   * behind the /admin namespace upgrade request.
   */
  const upgradeAdminSession = async () => {
    try {
      const { data } = await adminApi.post('/auth/upgrade');
      setToken(data.accessToken);
      setAdmin(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      setToken(null);
      setIsAuthenticated(false);
      setAdmin(null);
      throw error;
    }
  };

  const updateAdminState = useCallback((user, accessToken = null) => {
    setAdmin(user);
    if (accessToken) {
      setToken(accessToken);
    }
  }, []);

  const value = {
    admin,
    token,
    loading,
    isAuthenticated,
    login,
    logout,
    refreshSession: silentRefresh,
    upgradeAdminSession,
    updateAdminState,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
