import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { realEstateAPI, User, Subscription, LoginCredentials } from "../shared/api";

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          await refreshUser();
        } catch (error) {
          console.error("Failed to restore session:", error);
          // Clear invalid token
          localStorage.removeItem('access_token');
          realEstateAPI.setToken(null);
        }
      }
      setInitialLoading(false);
    };

    initAuth();
  }, []);

  const refreshUser = async () => {
    try {
      const userData = await realEstateAPI.getCurrentUser();
      setUser(userData);

      // Also fetch subscription info
      try {
        const subscriptionResponse = await realEstateAPI.getUserSubscription();
        setSubscription(subscriptionResponse.subscription || null);
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
        setSubscription(null);
      }
    } catch (error) {
      throw error;
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      const loginResponse = await realEstateAPI.login(credentials);
      
      setUser(loginResponse.user);
      setSubscription(loginResponse.subscription || null);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await realEstateAPI.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      setSubscription(null);
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    subscription,
    isAuthenticated: !!user,
    login,
    logout,
    loading: loading || initialLoading,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
