"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const isInvitation = pathname?.startsWith("/invitations");

  React.useEffect(() => {
    if (!isInvitation && auth.status === "anonymous") {
      router.replace("/");
    }
  }, [auth.status, isInvitation, router]);

  if (isInvitation) {
    return <main className="min-h-screen bg-background flex flex-col justify-center">{children}</main>;
  }

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
