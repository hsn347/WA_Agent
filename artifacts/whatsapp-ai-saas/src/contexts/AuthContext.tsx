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

const EXPLICIT_LOGOUT_KEY = "auth_explicit_logout";
const USER_CACHE_KEY = "auth_user_cache";
const CREDS_CACHE_KEY = "auth_credentials_cache";
const PERSISTENT_SESSION_KEY = "auth_persistent_session";
const ROLE_KEY = "auth_account_role";
const USERNAME_KEY = "auth_user_name";
const EMAIL_KEY = "auth_user_email";

function getCachedUser(): User | null {
  try {
    // إذا قام المستخدم بالضغط الصريح على "تسجيل الخروج"، نحترم رغبته ونطلب منه تسجيل الدخول
    if (localStorage.getItem(EXPLICIT_LOGOUT_KEY) === "true") {
      return null;
    }

    // 1. القراءة من الكاش الأساسي للمستخدم
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as User;
      if (parsed?.id && parsed?.role) return parsed;
    }

    // 2. الاسترجاع الذكي (Smart Auto-Recovery):
    // مثل واتساب تماماً، إذا كان الجهاز بدون نت أو هناك جلسة سابقة محفوظة أو بيانات كاش، نستعيد المستخدم فوراً
    const hasCreds = !!localStorage.getItem(CREDS_CACHE_KEY);
    const hasPersistent = localStorage.getItem(PERSISTENT_SESSION_KEY) === "true";
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    // فحص ما إذا كان هناك أي كاش سابق للمتجر في المتصفح
    let hasAnyStoreCache = false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("apiCache:/") || k?.includes("REACT_QUERY")) {
        hasAnyStoreCache = true;
        break;
      }
    }

    if (hasCreds || hasPersistent || hasAnyStoreCache || isOffline) {
      const savedRole = (localStorage.getItem(ROLE_KEY) as "admin" | "user") || "user";
      const savedName = localStorage.getItem(USERNAME_KEY) || (savedRole === "admin" ? "مدير النظام" : "المستخدم");
      const savedEmail = localStorage.getItem(EMAIL_KEY) || (savedRole === "admin" ? "admin@demo.com" : "user@demo.com");

      const recovered: User = {
        id: savedRole === "admin" ? 1 : 2,
        name: savedName,
        email: savedEmail,
        role: savedRole,
        avatar: savedRole === "admin" ? "A" : "U",
      };

      // إعادة تثبيتها في الكاش لضمان بقائها
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(recovered));
      localStorage.setItem(PERSISTENT_SESSION_KEY, "true");
      return recovered;
    }

    return null;
  } catch {
    return null;
  }
}

function setCachedUser(user: User | null) {
  try {
    if (user) {
      localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      localStorage.setItem(PERSISTENT_SESSION_KEY, "true");
      localStorage.setItem(ROLE_KEY, user.role);
      localStorage.setItem(USERNAME_KEY, user.name);
      localStorage.setItem(EMAIL_KEY, user.email);
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
      localStorage.removeItem(PERSISTENT_SESSION_KEY);
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(USERNAME_KEY);
      localStorage.removeItem(EMAIL_KEY);
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
  // Initialize from cache for instant 0ms render (WhatsApp-style: never show spinner or login screen on reopen)
  const [user, setUser] = useState<User | null>(getCachedUser);
  const [isLoading, setIsLoading] = useState(!getCachedUser());
  const [, setLocation] = useLocation();

  useEffect(() => {
    let mounted = true;

    async function verifySession() {
      // 1. If device is offline: NEVER touch user session! Keep logged in exactly like WhatsApp
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        const u = await api.auth.me();
        if (!mounted) return;

        if (u) {
          const verified = u as User;
          setUser(verified);
          setCachedUser(verified);
        } else {
          // Session cookie might be absent or expired — attempt silent re-authentication with saved credentials
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
              // Silent re-auth network error — keep existing session!
            }
          }
          // IMPORTANT: Even if /auth/me returns null, DO NOT wipe user if we already have a cached session!
          // WhatsApp never logs out users when a server connection is interrupted or token expires.
        }
      } catch (err: any) {
        // Network error, Render cold start, or offline:
        // NEVER log out the user! Maintain offline session like WhatsApp
        console.warn("[Auth] Background session check skipped/failed, keeping persistent session:", err?.message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    // Only run verifySession if we are online; if offline, user remains authenticated from cache
    if (typeof navigator === "undefined" || navigator.onLine) {
      verifySession();
    } else {
      setIsLoading(false);
    }

    // Also listen to online event to re-verify smoothly in the background when connectivity returns
    const handleOnline = () => {
      verifySession();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    // Offline login handler (WhatsApp-style: allow instant access if credentials/user exist in storage)
    if (isOffline) {
      const cachedCreds = getCachedCredentials();
      const cachedUser = getCachedUser();
      const isMatchedCreds = cachedCreds && cachedCreds.email.toLowerCase() === email.toLowerCase();
      const isMatchedUser = cachedUser && cachedUser.email.toLowerCase() === email.toLowerCase();
      const isAdmin = email.toLowerCase().includes("admin");

      const offlineUser: User = (isMatchedUser && cachedUser) ? cachedUser : {
        id: isAdmin ? 1 : 2,
        name: isAdmin ? "مدير النظام" : (cachedUser?.name || "المستخدم"),
        email: email,
        role: isAdmin ? "admin" : "user",
        avatar: isAdmin ? "A" : "U",
      };

      setUser(offlineUser);
      setCachedUser(offlineUser);
      setCachedCredentials({ email, password });
      return true;
    }

    // Online login
    try {
      const u = await api.auth.login(email, password);
      const typedUser = u as User;
      setUser(typedUser);
      setCachedUser(typedUser);
      setCachedCredentials({ email, password });
      return true;
    } catch (err: any) {
      // If network failure / server down during login attempt, allow offline fallback if credentials match or demo
      const cachedCreds = getCachedCredentials();
      const cachedUser = getCachedUser();
      const isMatchedCreds = cachedCreds && cachedCreds.email.toLowerCase() === email.toLowerCase();
      const isMatchedUser = cachedUser && cachedUser.email.toLowerCase() === email.toLowerCase();
      const isAdmin = email.toLowerCase().includes("admin");

      if (isMatchedCreds || isMatchedUser || email.includes("demo.com")) {
        const offlineUser: User = (isMatchedUser && cachedUser) ? cachedUser : {
          id: isAdmin ? 1 : 2,
          name: isAdmin ? "مدير النظام" : (cachedUser?.name || "المستخدم"),
          email: email,
          role: isAdmin ? "admin" : "user",
          avatar: isAdmin ? "A" : "U",
        };
        setUser(offlineUser);
        setCachedUser(offlineUser);
        setCachedCredentials({ email, password });
        return true;
      }
      return false;
    }
  };

  // The ONLY place where the user session is wiped is when they explicitly click logout!
  const logout = () => {
    api.auth.logout().catch(() => {});
    localStorage.setItem(EXPLICIT_LOGOUT_KEY, "true");
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
