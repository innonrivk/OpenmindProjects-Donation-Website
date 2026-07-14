/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.getMe();
      if (data.status === 'NO_SESSION') {
        throw new Error('No session');
      }
      setUser(data.user);
      setProfileData(data);
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setProfileData(null);
      setIsAuthenticated(false);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await api.getMe();
        if (data.status === 'NO_SESSION') {
          throw new Error('No session');
        }
        setUser(data.user);
        setProfileData(data);
        setIsAuthenticated(true);
      } catch {
        setUser(null);
        setProfileData(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const loginFn = async (credentials) => {
    const result = await api.login(credentials);
    setUser(result.user);
    setIsAuthenticated(true);
    await refreshUser(); // Fetch full profile
    return result;
  };

  const signupFn = async (data) => {
    const result = await api.signup(data);
    if (result.status === 'CREATED') {
      setUser(result.user);
      setIsAuthenticated(true);
      await refreshUser();
    }
    return result;
  };

  const verifyOtpFn = async (data) => {
    const result = await api.verifyOtp(data);
    if (result.status === 'ACTIVATED' || result.status === 'PASSWORD_CHANGED' || result.status === 'EMAIL_CHANGED') {
      if (result.user) {
        setUser(result.user);
        setIsAuthenticated(true);
      }
      await refreshUser();
    }
    return result;
  };

  const googleLoginFn = async (data) => {
    const result = await api.googleLogin(data);
    setUser(result.user);
    setIsAuthenticated(true);
    await refreshUser();
    return result;
  };

  const logoutFn = async () => {
    await api.logout();
    setUser(null);
    setProfileData(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    profileData,
    loading,
    isAuthenticated,
    login: loginFn,
    signup: signupFn,
    verifyOtp: verifyOtpFn,
    googleLogin: googleLoginFn,
    logout: logoutFn,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
