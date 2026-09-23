"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { resolveLandingPath } from "@/lib/landing";
import { Skeleton } from "@/components/ui/skeleton";

/** Trang gốc: đưa thẳng vào dự án đang làm dở (hoặc dự án duy nhất) thay vì luôn dừng ở danh sách. */
export default function RootPage() {
  const router = useRouter();
  const auth = useAuth();

  React.useEffect(() => {
    if (auth.status === "loading") return;
    if (auth.status !== "authenticated") {
      router.replace("/login");
      return;
    }
    void resolveLandingPath(auth.workspaces).then((path) => router.replace(path));
  }, [auth.status, auth.workspaces, router]);

  return (
    <div className="min-h-screen p-6 space-y-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}
