"use client";

import type { AuthUserDto } from "@secure-commerce/contracts";
import { SecureApiError } from "@secure-commerce/crypto-envelope";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  apiErrorMessage,
  browserRequest,
  clientLogin,
  clientRegister,
} from "@/lib/api";

interface AuthContextValue {
  user: AuthUserDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const result = await browserRequest<{ user: AuthUserDto }>(
        "/auth/me",
        {},
      );
      setUser(result.user);
    } catch (error) {
      if (!(error instanceof SecureApiError && error.status === 401))
        console.info(apiErrorMessage(error));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const hasSessionHint = document.cookie
      .split(";")
      .some((item) => item.trim().startsWith("csrf_token="));
    if (!hasSessionHint) {
      setLoading(false);
      return;
    }
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await clientLogin(email, password);
    setUser(result.user);
  }, []);
  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      phone?: string;
      password: string;
    }) => {
      const result = await clientRegister(input);
      setUser(result.user);
    },
    [],
  );
  const logout = useCallback(async () => {
    await browserRequest("/auth/logout", {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshMe }),
    [user, loading, login, register, logout, refreshMe],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải nằm trong AuthProvider.");
  return context;
}
