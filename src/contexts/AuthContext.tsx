import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE_URL = 'https://binario-api.databin81.workers.dev';

interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  apiKey: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string; apiKey?: string }>;
  logout: () => Promise<void>;
  regenerateApiKey: () => Promise<{ success: boolean; apiKey?: string; error?: string }>;
  clearStoredApiKey: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session and API key on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('binario_token');
    const storedApiKey = localStorage.getItem('binario_api_key');
    
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
    
    if (storedToken) {
      verifySession(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifySession = async (sessionToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setToken(sessionToken);
      } else {
        // Invalid session, clear storage
        localStorage.removeItem('binario_token');
        localStorage.removeItem('binario_api_key');
        setApiKey(null);
      }
    } catch (error) {
      console.error('Session verification failed:', error);
      localStorage.removeItem('binario_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('binario_token', data.token);

      // Check if we have a stored API key, if not try to get one
      const storedApiKey = localStorage.getItem('binario_api_key');
      if (!storedApiKey) {
        // User needs to regenerate API key to get a new one
        setApiKey(null);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const signup = async (email: string, password: string): Promise<{ success: boolean; error?: string; apiKey?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Signup failed' };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('binario_token', data.token);
      
      // Store the full API key from signup response
      if (data.apiKey) {
        setApiKey(data.apiKey);
        localStorage.setItem('binario_api_key', data.apiKey);
      }

      return { success: true, apiKey: data.apiKey };
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const regenerateApiKey = async (): Promise<{ success: boolean; apiKey?: string; error?: string }> => {
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/v1/keys/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to regenerate API key' };
      }

      // Store the new API key
      setApiKey(data.key);
      localStorage.setItem('binario_api_key', data.key);

      return { success: true, apiKey: data.key };
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const clearStoredApiKey = () => {
    setApiKey(null);
    localStorage.removeItem('binario_api_key');
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('Logout request failed:', error);
      }
    }

    setUser(null);
    setToken(null);
    setApiKey(null);
    localStorage.removeItem('binario_token');
    localStorage.removeItem('binario_api_key');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        apiKey,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        regenerateApiKey,
        clearStoredApiKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export the API base URL for use in other components
export { API_BASE_URL };
