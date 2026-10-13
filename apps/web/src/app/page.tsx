"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth";
import { LandingPageView } from "@/features/landing/LandingPageView";

/**
 * Trang gốc (Root / Landing Page):
 * - Khi chưa đăng nhập: Hiển thị Landing Page giới thiệu sản phẩm theo mô hình BYOK (Bring Your Own Key).
 * - Khi đã đăng nhập: Hiển thị Landing Page kèm banner thông minh và các nút lối tắt dẫn thẳng vào Workspace.
 */
export default function RootPage() {
  const auth = useAuth();

  const isAuthenticated = auth.status === "authenticated";
  const userFullName = auth.user?.fullName ?? null;
  const workspaceName = auth.workspaces[0]?.name ?? null;

  return (
    <LandingPageView
      isAuthenticated={isAuthenticated}
      userFullName={userFullName}
      workspaceName={workspaceName}
    />
  );
}
