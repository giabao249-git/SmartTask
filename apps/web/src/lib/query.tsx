"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isApiError } from "./api";

/** Một QueryClient cho toàn app: không retry lỗi 4xx (mã lỗi nghiệp vụ), retry 1 lần lỗi mạng/5xx. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => count < 1 && !(isApiError(err) && err.status >= 400 && err.status < 500),
      },
      mutations: { retry: 0 },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
