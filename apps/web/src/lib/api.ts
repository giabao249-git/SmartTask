import type { ApiError as ApiErrorShape, ErrorCode } from "@smarttask/shared";
import { ERROR_CODES } from "@smarttask/shared";

/**
 * Fetch wrapper duy nhất của web (docs 11 §2): baseURL từ NEXT_PUBLIC_API_URL, `Authorization: Bearer` lấy từ bộ nhớ,
 * gặp 401 thì gọi `POST /auth/refresh` (cookie httpOnly `rt`, credentials include) rồi thử lại đúng một lần.
 * Mọi lỗi HTTP ném `ApiError { code, status, details }` với `code` theo `packages/shared/errors.ts`.
 * Khi deploy (Vercel), đặt NEXT_PUBLIC_API_URL trỏ tới API trên Render, có đuôi /api/v1.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, body: Partial<ApiErrorShape> | null, fallback?: string) {
    const code = body?.code ?? (status === 401 ? "UNAUTHENTICATED" : status === 0 ? "NETWORK" : "INTERNAL");
    const known = (ERROR_CODES as Record<string, string>)[code];
    super(body?.message ?? known ?? fallback ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = body?.details;
  }

  /** Lấy `details` dưới dạng object khi API trả kèm số liệu (409/422/429). */
  detail<T = Record<string, unknown>>(): T | undefined {
    return this.details && typeof this.details === "object" ? (this.details as T) : undefined;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Thông điệp tiếng Việt cho toast/Alert — ưu tiên bảng mã lỗi dùng chung. */
/** Mã lỗi khiến toàn ứng dụng chỉ đọc / ngừng phục vụ — AppShell hiện banner. */
export const PLATFORM_BLOCK_CODES = ["MAINTENANCE_MODE", "WORKSPACE_SUSPENDED", "WORKSPACE_READ_ONLY"] as const;
export type PlatformBlock = { code: (typeof PLATFORM_BLOCK_CODES)[number]; message: string; details?: unknown };

let platformBlock: PlatformBlock | null = null;
const blockListeners = new Set<(b: PlatformBlock | null) => void>();

export const platformBlockStore = {
  get: () => platformBlock,
  set(b: PlatformBlock | null) {
    const same = platformBlock?.code === b?.code;
    platformBlock = b;
    if (!same) blockListeners.forEach((l) => l(b));
  },
  subscribe(l: (b: PlatformBlock | null) => void) {
    blockListeners.add(l);
    return () => blockListeners.delete(l);
  },
};

export function describeError(e: unknown): { code: string; message: string } {
  if (isApiError(e)) return { code: e.code, message: e.message };
  if (e instanceof Error) return { code: "INTERNAL", message: e.message };
  return { code: "INTERNAL", message: "Lỗi không xác định" };
}

// ── Access token trong bộ nhớ (không localStorage) ──────────
let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null) {
    accessToken = token;
    listeners.forEach((l) => l(token));
  },
  subscribe(l: (token: string | null) => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

let refreshing: Promise<string | null> | null = null;

/** Gọi refresh một lần cho mọi request 401 đồng thời; thất bại → xoá token (AppShell sẽ chuyển về /login). */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
        if (!res.ok) {
          tokenStore.set(null);
          return null;
        }
        const body = (await res.json()) as { accessToken: string };
        tokenStore.set(body.accessToken);
        return body.accessToken;
      } catch {
        tokenStore.set(null);
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export interface RequestOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: unknown;
  headers?: Record<string, string>;
  /** Không gắn Bearer và không refresh (login/register) */
  anonymous?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`);
  if (query)
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  return url.toString();
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, headers = {}, anonymous, query, ...init } = opts;
  const doFetch = async (token: string | null): Promise<Response> => {
    const h: Record<string, string> = { ...headers };
    if (body !== undefined && !(body instanceof FormData)) h["Content-Type"] = "application/json";
    if (token && !anonymous) h.Authorization = `Bearer ${token}`;
    try {
      return await fetch(buildUrl(path, query), {
        ...init,
        headers: h,
        credentials: "include",
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      });
    } catch (e) {
      throw new ApiError(0, { code: "NETWORK", message: "Không kết nối được API" }, String(e));
    }
  };

  let res = await doFetch(tokenStore.get());
  if (res.status === 401 && !anonymous) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await doFetch(fresh);
  }
  const parsed = await parseBody(res);
  if (!res.ok) {
    const errBody = parsed && typeof parsed === "object" ? (parsed as Partial<ApiErrorShape>) : null;
    const err = new ApiError(res.status, errBody, typeof parsed === "string" ? parsed : undefined);
    const blocked = PLATFORM_BLOCK_CODES.find((c) => c === err.code);
    platformBlockStore.set(blocked ? { code: blocked, message: err.message, details: err.details } : null);
    throw err;
  }
  platformBlockStore.set(null);
  return parsed as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"], opts: RequestOptions = {}) => request<T>(path, { ...opts, method: "GET", query }),
  post: <T>(path: string, body?: unknown, opts: RequestOptions = {}) => request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";
