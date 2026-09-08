import { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const USER_CACHE_KEY = "auth_user_cache";
const CREDS_CACHE_KEY = "auth_credentials_cache";

function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function setCachedUser(user: User | null) {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {}
}

function getCachedCredentials(): { email: string; password: string } | null {
  try {
    const raw = localStorage.getItem(CREDS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCachedCredentials(creds: { email: string; password: string } | null) {
  try {
    if (creds) {
      localStorage.setItem(CREDS_CACHE_KEY, JSON.stringify(creds));
    } else {
      localStorage.removeItem(CREDS_CACHE_KEY);
    }
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize from cache for instant 0ms render (WhatsApp-style: never show spinner on reopen)
  const [user, setUser] = useState<User | null>(getCachedUser);
  const [isLoading, setIsLoading] = useState(!getCachedUser());
  const [, setLocation] = useLocation();

  useEffect(() => {
    let mounted = true;

    async function verifySession() {
      try {
        const u = await api.auth.me();
        if (!mounted) return;

        if (u) {
          const verified = u as User;
          setUser(verified);
          setCachedUser(verified);
        } else {
          // Session cookie missing or expired — attempt silent re-authentication
          const creds = getCachedCredentials();
          if (creds?.email && creds?.password) {
            try {
              const reAuth = await api.auth.login(creds.email, creds.password);
              if (reAuth && mounted) {
                const typed = reAuth as User;
                setUser(typed);
                setCachedUser(typed);
                return;
              }
            } catch {
              // Silent re-auth failed
            }
          }
          if (mounted) {
            setUser(null);
            setCachedUser(null);
          }
        }
      } catch (err: any) {
        // Network error, Render waking up, or offline:
        // DO NOT log out the user! Maintain offline/persistent session like WhatsApp
        console.warn("[Auth] Background check error; keeping persistent session:", err?.message);

        // If explicit auth rejection (401/403), attempt recovery
        if (err?.status === 401 || err?.status === 403) {
          const creds = getCachedCredentials();
          if (creds?.email && creds?.password) {
            try {
              const reAuth = await api.auth.login(creds.email, creds.password);
              if (reAuth && mounted) {
                const typed = reAuth as User;
                setUser(typed);
                setCachedUser(typed);
                return;
              }
            } catch {}
          }
          if (mounted) {
            setUser(null);
            setCachedUser(null);
          }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    verifySession();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const u = await api.auth.login(email, password);
      const typedUser = u as User;
      setUser(typedUser);
      setCachedUser(typedUser);
      setCachedCredentials({ email, password });
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    api.auth.logout().catch(() => {});
    setUser(null);
    setCachedUser(null);
    setCachedCredentials(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
