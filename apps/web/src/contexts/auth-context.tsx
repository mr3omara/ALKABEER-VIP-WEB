import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, ApiError } from '../lib/api-client';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fetchProfile = async () => {
    try {
      const data = await apiClient<User>('/auth/me');
      setUser(data);
    } catch (err) {
      if ((import.meta as any).env.DEV) {
        console.warn('DEVELOPMENT BYPASS ACTIVE: Auth API failed, falling back to mock user profile.');
        setUser({
          id: 'dev-bypass-id',
          username: '009',
          email: 'admin@alkabeer.local',
          fullName: 'System Administrator (Bypass)',
          roles: ['ADMIN'],
          permissions: [],
        });
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiClient<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    } finally {
      setUser(null);
    }
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.roles.includes('ADMIN')) return true;
    return user.permissions.includes(permission);
  };

  const hasRole = (role: string) => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        hasPermission,
        hasRole,
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
