"use client";

import { AppShell } from "@/components/app/AppShell";
import { useRequireAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = useRequireAuth();
  if (auth.status !== "authenticated")
    return (
      <div className="flex min-h-screen">
        <Skeleton className="w-64 h-screen rounded-none" />
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  return <AppShell>{children}</AppShell>;
}
