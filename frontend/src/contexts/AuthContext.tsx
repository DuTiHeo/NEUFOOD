import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/user';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredAuth(key: string) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => readStoredAuth('neufood_token'));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = readStoredAuth('neufood_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    await authService.logout();
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback((newToken: string, newUser: User, newRefreshToken?: string) => {
    ['neufood_token', 'neufood_refresh_token', 'neufood_user'].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    localStorage.setItem('neufood_token', newToken);
    if (newRefreshToken) {
      localStorage.setItem('neufood_refresh_token', newRefreshToken);
    }
    localStorage.setItem('neufood_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
      const storage = localStorage.getItem('neufood_token') ? localStorage : sessionStorage;
      storage.setItem('neufood_user', JSON.stringify(currentUser));
    } catch (err) {
      console.warn('Failed to load user info:', err);
      if ((err as any)?.response?.status === 401) {
        ['neufood_token', 'neufood_refresh_token', 'neufood_user'].forEach((key) => {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        });
        setToken(null);
        setUser(null);
      }
    }
  }, [token]);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        await refreshUser();
      }
      setIsLoading(false);
    };
    initAuth();
  }, [token, refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token),
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
