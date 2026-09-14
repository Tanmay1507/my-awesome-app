import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  provider: string;
}

export interface Session {
  sessionId: string;
  userId: string;
  deviceToken: string;
  agentName: string;
  createdAt: number;
  expiresAt: number;
  expiresAtFormatted?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  session: Session | null;
  serverUrl: string;
  isLoading: boolean;
  setServerUrl: (url: string) => void;
  devLogin: (username?: string, name?: string, userId?: string) => Promise<{ success: boolean; error?: string }>;
  pairWithCode: (code: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  disconnectSession: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getDefaultServerUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3000`;
  }
  return 'http://10.76.102.117:3000';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [serverUrl, setServerUrlState] = useState<string>(getDefaultServerUrl());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize storage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedUrl = localStorage.getItem('ag_server_url');
        const savedUser = localStorage.getItem('ag_user');
        const savedToken = localStorage.getItem('ag_token');
        const savedSession = localStorage.getItem('ag_session');

        if (savedUrl) setServerUrlState(savedUrl);
        if (savedUser) setUser(JSON.parse(savedUser));
        if (savedToken) setToken(savedToken);
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
            setSession(parsed);
          } else {
            localStorage.removeItem('ag_session');
          }
        }
      }
    } catch (e) {
      console.warn('Storage read error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setServerUrl = (url: string) => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    setServerUrlState(cleanUrl);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('ag_server_url', cleanUrl);
      }
    } catch {}
  };

  const devLogin = async (username = 'tanmay1507', name = 'Tanmay Wagh', userId = 'usr_tanmay') => {
    setIsLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, userId }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        setToken(data.token);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('ag_user', JSON.stringify(data.user));
            localStorage.setItem('ag_token', data.token);
          }
        } catch {}
        return { success: true };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: `Could not connect to server at ${serverUrl}: ${err.message}` };
    } finally {
      setIsLoading(false);
    }
  };

  const pairWithCode = async (code: string) => {
    if (!user) {
      return { success: false, error: 'Must be logged in to pair a device.' };
    }

    try {
      const res = await fetch(`${serverUrl}/api/relay/phone/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          code: code.trim(),
          mobileUserId: user.id,
          mobileUserToken: token,
        }),
      });

      const data = await res.json();
      if (data.success && data.session) {
        setSession(data.session);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('ag_session', JSON.stringify(data.session));
          }
        } catch {}
        return { success: true, message: data.message };
      }
      return { success: false, error: data.message || data.error || 'Pairing failed' };
    } catch (err: any) {
      return { success: false, error: `Network error connecting to ${serverUrl}: ${err.message}` };
    }
  };

  const disconnectSession = () => {
    setSession(null);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('ag_session');
      }
    } catch {}
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setSession(null);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('ag_user');
        localStorage.removeItem('ag_token');
        localStorage.removeItem('ag_session');
      }
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        session,
        serverUrl,
        isLoading,
        setServerUrl,
        devLogin,
        pairWithCode,
        disconnectSession,
        logout,
      }}>
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
