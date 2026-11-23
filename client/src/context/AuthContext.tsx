import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { getCurrentUser } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('gallery_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const fetchedUser = await getCurrentUser();
          if (fetchedUser) {
            setUser(fetchedUser);
          } else {
            localStorage.removeItem('gallery_token');
            setToken(null);
          }
        } catch {
          localStorage.removeItem('gallery_token');
          setToken(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('gallery_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('gallery_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
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
