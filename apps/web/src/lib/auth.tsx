"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, refreshAccessToken, tokenStore } from "./api";
import { disconnectSocket } from "./socket";
import type { MeResponse, UserView, WorkspaceSummary } from "./types";

import { SESSION_FLAG_COOKIE } from "./auth-cookie";

function setSessionFlag(on: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = on
    ? `${SESSION_FLAG_COOKIE}=1; path=/; max-age=${7 * 86400}; samesite=lax`
    : `${SESSION_FLAG_COOKIE}=; path=/; max-age=0`;
}

export interface AuthState {
  status: "loading" | "authenticated" | "anonymous";
  user: UserView | null;
  workspaces: WorkspaceSummary[];
  login: (email: string, password: string) => Promise<MeResponse["user"]>;
  register: (email: string, password: string, fullName: string) => Promise<MeResponse["user"]>;
  logout: () => Promise<void>;
  refetchMe: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

/**
 * Khởi động: thử `POST /auth/refresh` bằng cookie rt → có token thì `GET /me`; không có → anonymous.
 * Token access chỉ ở bộ nhớ; F5 vẫn giữ phiên nhờ refresh cookie.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthState["status"]>("loading");
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const queryClient = useQueryClient();

  const loadMe = React.useCallback(async () => {
    const data = await api.get<MeResponse>("/me");
    setMe(data);
    setStatus("authenticated");
    setSessionFlag(true);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = tokenStore.get() ?? (await refreshAccessToken());
      if (cancelled) return;
      if (!token) {
        setStatus("anonymous");
        setSessionFlag(false);
        return;
      }
      try {
        await loadMe();
      } catch {
        if (!cancelled) {
          tokenStore.set(null);
          setStatus("anonymous");
          setSessionFlag(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  // Token bị xoá (refresh thất bại giữa chừng) → về anonymous
  React.useEffect(
    () =>
      tokenStore.subscribe((t) => {
        if (!t) {
          setMe(null);
          setStatus("anonymous");
          setSessionFlag(false);
        }
      }),
    [],
  );

  const login = React.useCallback<AuthState["login"]>(
    async (email, password) => {
      queryClient.clear();
      const res = await api.post<{ user: UserView; accessToken: string }>("/auth/login", { email, password }, { anonymous: true });
      tokenStore.set(res.accessToken);
      await loadMe();
      return res.user;
    },
    [loadMe, queryClient],
  );

  const register = React.useCallback<AuthState["register"]>(
    async (email, password, fullName) => {
      const res = await api.post<{ user: UserView; accessToken: string }>("/auth/register", { email, password, fullName }, { anonymous: true });
      tokenStore.set(res.accessToken);
      await loadMe();
      return res.user;
    },
    [loadMe],
  );

  const logout = React.useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // token đã hết hạn cũng coi như đăng xuất xong
    }
    disconnectSocket();
    tokenStore.set(null);
    queryClient.clear();
    setMe(null);
    setStatus("anonymous");
    setSessionFlag(false);
  }, [queryClient]);

  const value = React.useMemo<AuthState>(
    () => ({ status, user: me?.user ?? null, workspaces: me?.workspaces ?? [], login, register, logout, refetchMe: loadMe }),
    [status, me, login, register, logout, loadMe],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong AuthProvider");
  return ctx;
}

/** Chuyển về /login khi chưa đăng nhập (dùng trong layout dashboard). */
export function useRequireAuth(): AuthState {
  const auth = useAuth();
  const router = useRouter();
  React.useEffect(() => {
    if (auth.status === "anonymous") {
      const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [auth.status, router]);
  return auth;
}
