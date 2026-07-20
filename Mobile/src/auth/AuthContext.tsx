import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";

import * as authApi from "@/src/api/auth";
import type { User } from "@/src/api/auth";
import { clearToken, clearUser, getPersistedUser, getToken, saveToken, saveUser } from "@/src/auth/tokenStorage";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function deviceName() {
  return `mobile-${Platform.OS}-${Platform.OS === "android" ? "android" : "ios"}-${Date.now().toString(36)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth(retries = 3) {
    setIsLoading(true);

    const token = await getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      const response = await authApi.getUser();

      if (response.success && response.data) {
        setUser(response.data);
        await saveUser(response.data);
        setIsLoading(false);
        return;
      }

      if (response.message?.includes("Unauthenticated") || response.status === 401) {
        await clearToken();
        await clearUser();
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // All retries failed on network errors (not an explicit auth rejection) —
    // fall back to the last-known user so the app stays usable offline.
    const storedUser = await getPersistedUser<User>();
    setUser(storedUser);
    setIsLoading(false);
  }

  async function login(email: string, password: string) {
    const response = await authApi.login(email, password, deviceName());
    if (response.success && response.data?.token && response.data?.user) {
      await saveToken(response.data.token);
      await saveUser(response.data.user);
      setUser(response.data.user);
      return { success: true };
    }
    return { success: false, message: response.message };
  }

  async function logout() {
    setUser(null);
    await clearToken();
    await clearUser();
    try {
      await authApi.logout();
    } catch {
      // Best-effort — local session is already cleared.
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
