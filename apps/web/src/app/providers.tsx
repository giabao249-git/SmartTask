"use client";

import * as React from "react";
import { QueryProvider } from "@/lib/query";
import { AuthProvider } from "@/lib/auth";
import { ChunkReloader } from "@/components/app/ChunkReloader";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ChunkReloader />
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
