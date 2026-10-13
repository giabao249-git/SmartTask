import { NextResponse, type NextRequest } from "next/server";
import { SESSION_FLAG_COOKIE } from "@/lib/auth-cookie";

/**
 * Chặn sớm các trang cần đăng nhập khi thiếu cờ phiên (cookie `st_session` do AuthProvider đặt sau khi có token).
 * Kiểm thật sự vẫn ở client (refresh cookie httpOnly của API) — middleware chỉ tránh nháy màn.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_FLAG_COOKIE);
  if (pathname === "/") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/login")) {
    if (hasSession) return NextResponse.redirect(new URL("/workspaces", req.url));
    return NextResponse.next();
  }
  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
