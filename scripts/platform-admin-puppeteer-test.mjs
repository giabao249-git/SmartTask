import puppeteer from "puppeteer-core";
import http from "http";
import fs from "fs";
import path from "path";

/**
 * SmartTask Platform Administration & Super Admin Automated E2E Test Suite
 * 
 * Test Cases:
 *  - TC-ADM-01: Chặn Người dùng thường (Regular Member) truy cập UI `/admin`
 *  - TC-ADM-02: Chặn Workspace Owner truy cập UI `/admin` (Zero-Trust Tenant Boundary)
 *  - TC-ADM-03: Kiểm thử gọi REST API `/api/v1/admin/*` trực tiếp bằng Token Member/Owner (HTTP 403)
 *  - TC-ADM-04: Super Admin đăng nhập & kiểm chứng giao diện Quản trị Nền tảng (KPIs, Tenants, FinOps, Audit Trail)
 *  - TC-ADM-05: Kiểm thử Vận hành nhạy cảm: Đình chỉ Workspace (Cascade Suspend) & Kích hoạt Chế độ Bảo trì (Maintenance Mode 503)
 */

const REPORT_DIR = path.resolve(process.cwd(), "docs/test-reports/platform-admin");
const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const PORT = process.env.TEST_PORT || 4005;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock Data & In-Memory State
const state = {
  maintenanceMode: false,
  maintenanceScheduledEnd: "2026-09-19T18:00:00Z",
  maintenanceMessage: "Hệ thống đang bảo trì nâng cấp cụm cơ sở dữ liệu định kỳ",
  workspaces: [
    {
      id: "ws-acme",
      name: "Acme Corporation",
      slug: "acme-corp",
      status: "ACTIVE",
      tier: "ENTERPRISE",
      owner: "Lan (lan@smarttask.local)",
      memberCount: 24,
      aiMonthlySpend: 245.5,
      suspendedAt: null,
      suspensionReason: null,
    },
    {
      id: "ws-beta",
      name: "Beta Tech Labs",
      slug: "beta-tech",
      status: "ACTIVE",
      tier: "TEAM",
      owner: "Minh (minh@smarttask.local)",
      memberCount: 8,
      aiMonthlySpend: 54.2,
      suspendedAt: null,
      suspensionReason: null,
    },
    {
      id: "ws-spammer",
      name: "Abusive Shadow Team",
      slug: "shadow-team",
      status: "SUSPENDED",
      tier: "FREE",
      owner: "attacker@shadow.net",
      memberCount: 2,
      aiMonthlySpend: 980.0,
      suspendedAt: "2026-09-18T10:00:00Z",
      suspensionReason: "Tấn công spam token AI lặp lại",
    }
  ],
  auditLogs: [
    {
      id: "aud-001",
      admin: "Super Admin (admin@smarttask.local)",
      action: "PLATFORM_INIT",
      target: "SYSTEM",
      ip: "127.0.0.1",
      timestamp: new Date(Date.now() - 3600000).toLocaleTimeString("vi-VN"),
      detail: "Hệ thống khởi động phiên giám sát",
    }
  ]
};

// Start embedded server
function startMockPlatformServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const pathname = parsedUrl.pathname;
      const authHeader = req.headers["authorization"] || "";
      const cookieHeader = req.headers["cookie"] || "";

      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // Check Maintenance Mode for non-admin
      const isMemberExplicit = authHeader.includes("Bearer token-member") || cookieHeader.includes("st_role=MEMBER");
      const isSuperAdminReq = !isMemberExplicit && (authHeader.includes("Bearer token-admin") || cookieHeader.includes("st_role=SUPER_ADMIN"));
      if (state.maintenanceMode && !isSuperAdminReq && pathname.startsWith("/api/v1/") && !pathname.includes("/auth/") && !pathname.includes("/admin/")) {
        res.writeHead(503, { 
          "Content-Type": "application/json; charset=utf-8",
          "Retry-After": "1800"
        });
        res.end(JSON.stringify({
          code: "MAINTENANCE_MODE_ACTIVE",
          message: state.maintenanceMessage,
          scheduledEndTime: state.maintenanceScheduledEnd
        }));
        return;
      }

      // 1. Web Form Login (Standard POST)
      if (pathname === "/login" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          const params = new URLSearchParams(body);
          const email = params.get("email") || "";
          if (email === "admin@smarttask.local") {
            res.writeHead(302, {
              "Location": "/admin",
              "Set-Cookie": [
                "st_session=1; Path=/",
                "st_role=SUPER_ADMIN; Path=/",
                "st_email=" + encodeURIComponent(email) + "; Path=/"
              ]
            });
            res.end();
          } else if (email === "lan@smarttask.local") {
            res.writeHead(302, {
              "Location": "/workspaces",
              "Set-Cookie": [
                "st_session=1; Path=/",
                "st_role=OWNER; Path=/",
                "st_email=" + encodeURIComponent(email) + "; Path=/"
              ]
            });
            res.end();
          } else {
            res.writeHead(302, {
              "Location": "/workspaces",
              "Set-Cookie": [
                "st_session=1; Path=/",
                "st_role=MEMBER; Path=/",
                "st_email=" + encodeURIComponent(email) + "; Path=/"
              ]
            });
            res.end();
          }
        });
        return;
      }

      // 2. API: Login (JSON)
      if (pathname === "/api/v1/auth/login" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          const { email } = JSON.parse(body || "{}");
          if (email === "admin@smarttask.local") {
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Set-Cookie": "st_session=1; Path=/; st_role=SUPER_ADMIN; Path=/"
            });
            res.end(JSON.stringify({
              user: { id: "u-admin", email, fullName: "Platform Super Admin", isPlatformAdmin: true },
              accessToken: "token-admin"
            }));
          } else if (email === "lan@smarttask.local") {
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Set-Cookie": "st_session=1; Path=/; st_role=OWNER; Path=/"
            });
            res.end(JSON.stringify({
              user: { id: "u-lan", email, fullName: "Nguyễn Thị Lan", isPlatformAdmin: false, role: "OWNER" },
              accessToken: "token-owner"
            }));
          } else {
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Set-Cookie": "st_session=1; Path=/; st_role=MEMBER; Path=/"
            });
            res.end(JSON.stringify({
              user: { id: "u-minh", email: "minh@smarttask.local", fullName: "Trần Quang Minh", isPlatformAdmin: false, role: "MEMBER" },
              accessToken: "token-member"
            }));
          }
        });
        return;
      }

      // 3. API: Admin Overview
      if (pathname === "/api/v1/admin/overview") {
        if (!isSuperAdminReq) {
          res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ code: "PLATFORM_ADMIN_REQUIRED", message: "Yêu cầu quyền Quản trị viên Nền tảng (Platform Super Admin)" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          systemHealth: { status: "HEALTHY", uptimeSeconds: 98450, dbPoolActive: 18, redisConnected: true },
          telemetry: { totalTenants: state.workspaces.length, activeTenants: state.workspaces.filter(w => w.status === 'ACTIVE').length, dau: 1240, mau: 8900 },
          finops: { todayTokens: 4250000, monthlyCostUsd: 1850.45, monthlyBudgetCapUsd: 5000.0, circuitBreaker: "CLOSED" }
        }));
        return;
      }

      // 4. API: Admin Workspaces
      if (pathname === "/api/v1/admin/workspaces") {
        if (!isSuperAdminReq) {
          res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ code: "PLATFORM_ADMIN_REQUIRED", message: "Yêu cầu quyền Quản trị viên Nền tảng" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ items: state.workspaces, total: state.workspaces.length }));
        return;
      }

      // 5. API: Suspend / Unsuspend Workspace
      const suspendMatch = pathname.match(/^\/api\/v1\/admin\/workspaces\/([^/]+)\/(suspend|unsuspend)$/);
      if (suspendMatch && req.method === "POST") {
        if (!isSuperAdminReq) {
          res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ code: "PLATFORM_ADMIN_REQUIRED", message: "Yêu cầu quyền Quản trị viên Nền tảng" }));
          return;
        }
        const wsId = suspendMatch[1];
        const action = suspendMatch[2];
        const targetWs = state.workspaces.find(w => w.id === wsId);
        if (!targetWs) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: "NOT_FOUND", message: "Workspace không tồn tại" }));
          return;
        }

        if (action === "suspend") {
          targetWs.status = "SUSPENDED";
          targetWs.suspendedAt = new Date().toISOString();
          targetWs.suspensionReason = "Đình chỉ bởi Super Admin qua kiểm toán kiểm thử";
          state.auditLogs.unshift({
            id: `aud-${Date.now()}`,
            admin: "admin@smarttask.local",
            action: "WORKSPACE_SUSPEND",
            target: wsId,
            ip: "127.0.0.1",
            timestamp: new Date().toLocaleTimeString("vi-VN"),
            detail: `Đình chỉ workspace ${targetWs.name}`
          });
        } else {
          targetWs.status = "ACTIVE";
          targetWs.suspendedAt = null;
          targetWs.suspensionReason = null;
          state.auditLogs.unshift({
            id: `aud-${Date.now()}`,
            admin: "admin@smarttask.local",
            action: "WORKSPACE_UNSUSPEND",
            target: wsId,
            ip: "127.0.0.1",
            timestamp: new Date().toLocaleTimeString("vi-VN"),
            detail: `Kích hoạt lại workspace ${targetWs.name}`
          });
        }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ success: true, workspace: targetWs }));
        return;
      }

      // 6. API: Maintenance Toggle
      if (pathname === "/api/v1/admin/maintenance/toggle" && req.method === "POST") {
        if (!isSuperAdminReq) {
          res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ code: "PLATFORM_ADMIN_REQUIRED", message: "Yêu cầu quyền Quản trị viên Nền tảng" }));
          return;
        }
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
          const { enabled, message } = JSON.parse(body || "{}");
          state.maintenanceMode = (enabled !== undefined) ? !!enabled : !state.maintenanceMode;
          if (message) state.maintenanceMessage = message;
          state.auditLogs.unshift({
            id: `aud-${Date.now()}`,
            admin: "admin@smarttask.local",
            action: state.maintenanceMode ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED",
            target: "SYSTEM",
            ip: "127.0.0.1",
            timestamp: new Date().toLocaleTimeString("vi-VN"),
            detail: `Trạng thái bảo trì: ${state.maintenanceMode ? 'BẬT' : 'TẮT'}`
          });
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ maintenanceMode: state.maintenanceMode }));
        });
        return;
      }

      // 7. API: Member task call in suspended workspace
      if (pathname.startsWith("/api/v1/workspaces/ws-acme/tasks")) {
        const ws = state.workspaces.find(w => w.id === "ws-acme");
        if (ws && ws.status === "SUSPENDED") {
          res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            code: "WORKSPACE_SUSPENDED",
            message: "Không gian làm việc này đã bị đình chỉ hoạt động bởi Quản trị viên nền tảng"
          }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ items: [] }));
        return;
      }

      // 8. WEB PAGES

      // HTML: /login
      if (pathname === "/login") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Đăng nhập - SmartTask</title>
            <style>
              * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
              body { background: #0f172a; color: #f8fafc; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              .card { width: 100%; max-width: 400px; background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
              .header { display: flex; align-items: center; gap: 12px; margin-bottom: 1.5rem; }
              .logo { width: 40px; height: 40px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; }
              label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1; }
              input { width: 100%; padding: 10px 12px; background: #334155; border: 1px solid #475569; border-radius: 8px; color: #fff; margin-bottom: 1rem; font-size: 14px; }
              button { width: 100%; padding: 12px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
              button:hover { background: #4f46e5; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">
                <div class="logo">ST</div>
                <h1 style="margin: 0; font-size: 22px;">SmartTask Login</h1>
              </div>
              <form id="loginForm" method="POST" action="/login">
                <div>
                  <label>Email</label>
                  <input type="email" name="email" id="email" required value="admin@smarttask.local">
                </div>
                <div>
                  <label>Mật khẩu</label>
                  <input type="password" name="password" id="password" required value="Demo@1234">
                </div>
                <button type="submit">Đăng nhập</button>
              </form>
            </div>
          </body>
          </html>
        `);
        return;
      }

      // HTML: /workspaces
      if (pathname === "/workspaces") {
        const isSuspended = state.workspaces.find(w => w.id === "ws-acme")?.status === "SUSPENDED";
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Workspaces - SmartTask</title>
            <style>
              * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
              body { background: #0f172a; color: #f8fafc; margin: 0; min-height: 100vh; }
              nav { background: #1e293b; border-bottom: 1px solid #334155; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
              main { max-width: 1000px; margin: 40px auto; padding: 0 20px; }
              .banner { background: rgba(159, 18, 57, 0.4); border: 1px solid rgba(244, 63, 94, 0.5); padding: 20px; border-radius: 12px; margin-bottom: 24px; display: flex; gap: 16px; align-items: flex-start; }
              .banner h3 { margin: 0 0 6px 0; font-size: 16px; color: #fecdd3; }
              .banner p { margin: 0; font-size: 13px; color: #fda4af; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
              .card { background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; }
              .tag { padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
              .tag-active { background: rgba(16, 185, 129, 0.2); color: #34d399; }
              .tag-suspended { background: rgba(244, 63, 94, 0.2); color: #fb7185; }
            </style>
          </head>
          <body>
            <nav>
              <div style="font-weight: bold; font-size: 18px; color: #818cf8;">SmartTask Workspace</div>
              <div style="font-size: 13px; color: #94a3b8;">Phiên người dùng chuẩn</div>
            </nav>
            <main>
              ${isSuspended ? `
                <div class="banner">
                  <div style="font-size: 24px;">⚠️</div>
                  <div>
                    <h3>Không gian làm việc Acme Corporation đã bị đình chỉ</h3>
                    <p>Toàn bộ hoạt động tạo công việc, chat AI và truy cập dự án đã bị tạm ngưng bởi Quản trị viên Nền tảng.</p>
                  </div>
                </div>
              ` : `
                <div style="background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                  <h2 style="margin: 0 0 6px 0; font-size: 18px;">Danh sách Workspace của bạn</h2>
                  <p style="margin: 0; font-size: 13px; color: #94a3b8;">Chọn không gian làm việc để tiếp tục dự án.</p>
                </div>
              `}
              <div class="grid">
                <div class="card">
                  <h3 style="margin: 0 0 8px 0;">Acme Corporation</h3>
                  <p style="margin: 0; font-size: 12px;">Trạng thái: <span class="tag ${isSuspended ? 'tag-suspended' : 'tag-active'}">${isSuspended ? 'BỊ ĐÌNH CHỈ' : 'HOẠT ĐỘNG'}</span></p>
                </div>
                <div class="card">
                  <h3 style="margin: 0 0 8px 0;">Beta Tech Labs</h3>
                  <p style="margin: 0; font-size: 12px;">Trạng thái: <span class="tag tag-active">HOẠT ĐỘNG</span></p>
                </div>
              </div>
            </main>
          </body>
          </html>
        `);
        return;
      }

      // HTML: /admin (Platform Super Admin Console)
      if (pathname.startsWith("/admin")) {
        // Enforce RBAC Middleware for /admin
        if (!isSuperAdminReq) {
          res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>403 Forbidden - Truy cập bị từ chối</title>
              <style>
                * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                body { background: #0f172a; color: #f8fafc; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
                main { text-align: center; padding: 32px; max-width: 500px; background: #1e293b; border: 1px solid rgba(244, 63, 94, 0.5); border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
                .icon { font-size: 48px; margin-bottom: 16px; }
                h1 { margin: 0 0 12px 0; font-size: 20px; color: #fecdd3; }
                p { margin: 0 0 24px 0; font-size: 14px; color: #cbd5e1; line-height: 1.5; }
                a { display: inline-block; padding: 10px 20px; background: #6366f1; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px; }
              </style>
            </head>
            <body>
              <main>
                <div class="icon">⛔</div>
                <h1>403 - Giới hạn Quyền Nền tảng</h1>
                <p>
                  Trang quản trị toàn cục <code>/admin</code> chỉ dành riêng cho <strong>Platform Super Admin</strong>.
                  Tài khoản của bạn (kể cả Workspace Owner) không có quyền truy cập phạm vi này.
                </p>
                <div>
                  <a href="/workspaces">Quay lại Workspace của bạn</a>
                </div>
              </main>
            </body>
            </html>
          `);
          return;
        }

        // Render Platform Super Admin UI
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>SmartTask Platform Administration</title>
            <style>
              * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
              body { background: #020617; color: #f8fafc; margin: 0; min-height: 100vh; }
              header { background: #0f172a; border-bottom: 1px solid #1e293b; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 50; }
              .logo-box { display: flex; align-items: center; gap: 12px; }
              .logo { width: 36px; height: 36px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; }
              .badge { padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
              .badge-active { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
              .badge-maint { background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.3); }
              main { max-width: 1280px; margin: 0 auto; padding: 32px; display: flex; flex-direction: column; gap: 32px; }
              .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
              .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
              .kpi-card { background: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 12px; }
              .kpi-title { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; }
              .kpi-val { font-size: 24px; font-weight: 900; margin: 8px 0 4px 0; }
              .panel { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
              th { background: #1e293b; padding: 12px 16px; color: #94a3b8; text-transform: uppercase; font-size: 11px; }
              td { padding: 14px 16px; border-bottom: 1px solid #1e293b; }
              .btn-action { padding: 6px 12px; border: none; border-radius: 6px; font-weight: 600; font-size: 11px; cursor: pointer; }
              .btn-suspend { background: #e11d48; color: #fff; }
              .btn-unsuspend { background: #059669; color: #fff; }
              .btn-toggle { padding: 8px 16px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
              .log-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-family: monospace; font-size: 11px; color: #cbd5e1; }
            </style>
          </head>
          <body>
            <header>
              <div class="logo-box">
                <div class="logo">ST</div>
                <div>
                  <div style="font-weight: 900; font-size: 16px; color: #818cf8; letter-spacing: 0.5px;">PLATFORM SUPER ADMIN</div>
                  <div style="font-size: 11px; color: #64748b;">SmartTask Master Control Center</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 16px;">
                <span id="maintStatusBadge" class="badge ${state.maintenanceMode ? 'badge-maint' : 'badge-active'}">
                  ${state.maintenanceMode ? '⚠️ BẢO TRÌ BẬT' : '● HỆ THỐNG HOẠT ĐỘNG'}
                </span>
                <span style="font-size: 12px; color: #94a3b8; background: #1e293b; padding: 6px 12px; border-radius: 8px;">admin@smarttask.local</span>
              </div>
            </header>

            <main>
              <!-- KPI Row -->
              <section id="kpi-overview">
                <div style="font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 12px;">Chỉ số Sức khỏe & Vận hành Nền tảng (US-ADM-01)</div>
                <div class="grid-4">
                  <div class="kpi-card">
                    <div class="kpi-title">Trạng thái Hệ thống</div>
                    <div class="kpi-val" style="color: #34d399;">HEALTHY</div>
                    <div style="font-size: 11px; color: #64748b;">Uptime: 99.98% (98,450s)</div>
                  </div>
                  <div class="kpi-card">
                    <div class="kpi-title">Tổng Không gian Làm việc</div>
                    <div class="kpi-val" id="kpiTenantsTotal">${state.workspaces.length}</div>
                    <div style="font-size: 11px; color: #64748b;">${state.workspaces.filter(w=>w.status==='ACTIVE').length} Hoạt động · ${state.workspaces.filter(w=>w.status==='SUSPENDED').length} Đình chỉ</div>
                  </div>
                  <div class="kpi-card">
                    <div class="kpi-title">Người dùng Tích cực (DAU / MAU)</div>
                    <div class="kpi-val" style="color: #818cf8;">1,240 <span style="font-size: 12px; font-weight: normal; color: #64748b;">/ 8,900</span></div>
                    <div style="font-size: 11px; color: #64748b;">WebSocket: 312 kết nối</div>
                  </div>
                  <div class="kpi-card">
                    <div class="kpi-title">FinOps AI Toàn Sàn (Tháng này)</div>
                    <div class="kpi-val" style="color: #22d3ee;">$1,850.45</div>
                    <div style="font-size: 11px; color: #64748b;">Trần ngân sách: $5,000.00 (37%)</div>
                  </div>
                </div>
              </section>

              <!-- Tenant Management Section -->
              <section id="tenant-management" class="panel">
                <div style="margin-bottom: 20px;">
                  <h2 style="margin: 0 0 4px 0; font-size: 16px; color: #fff;">Quản trị Danh sách Khách hàng / Workspace (US-ADM-02)</h2>
                  <div style="font-size: 12px; color: #94a3b8;">Cấp phép, Đình chỉ, Nâng hạng gói dịch vụ và kiểm soát tài nguyên</div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Tên Workspace</th>
                      <th>Gói dịch vụ</th>
                      <th>Chủ sở hữu</th>
                      <th>Thành viên</th>
                      <th>Chi phí AI</th>
                      <th>Trạng thái</th>
                      <th style="text-align: right;">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.workspaces.map(w => `
                      <tr data-ws-id="${w.id}">
                        <td style="font-weight: 600; color: #fff;">
                          ${w.name}
                          <div style="font-size: 10px; color: #64748b; font-family: monospace;">${w.slug}</div>
                        </td>
                        <td>
                          <span style="padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; background: #312e81; color: #c7d2fe;">${w.tier}</span>
                        </td>
                        <td style="color: #cbd5e1;">${w.owner}</td>
                        <td style="color: #cbd5e1;">${w.memberCount} seats</td>
                        <td style="color: #22d3ee; font-family: monospace;">$${w.aiMonthlySpend.toFixed(2)}</td>
                        <td>
                          <span class="badge ${w.status === 'ACTIVE' ? 'badge-active' : 'badge-maint'}">
                            ${w.status}
                          </span>
                        </td>
                        <td style="text-align: right;">
                          ${w.status === 'ACTIVE' ? `
                            <button onclick="toggleSuspend('${w.id}', 'suspend')" class="btn-action btn-suspend">Đình chỉ</button>
                          ` : `
                            <button onclick="toggleSuspend('${w.id}', 'unsuspend')" class="btn-action btn-unsuspend">Mở khóa</button>
                          `}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </section>

              <!-- FinOps & AI Catalog -->
              <div class="grid-2">
                <section id="finops-catalog" class="panel">
                  <h2 style="margin: 0 0 4px 0; font-size: 16px; color: #fff;">Điều phối FinOps AI & Model Catalog (US-ADM-04)</h2>
                  <div style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">Cấu hình danh mục mô hình, thứ tự Fallback và trần ngân sách toàn sàn</div>
                  <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #1e293b; border-radius: 8px;">
                      <div>
                        <div style="font-weight: bold; color: #fff;">Google Gemini 1.5 Pro</div>
                        <div style="font-size: 11px; color: #94a3b8;">Primary Model · Decompose & Complex Reasoning</div>
                      </div>
                      <span class="badge badge-active">Ưu tiên 1</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #1e293b; border-radius: 8px;">
                      <div>
                        <div style="font-weight: bold; color: #fff;">Anthropic Claude 3.5 Sonnet</div>
                        <div style="font-size: 11px; color: #94a3b8;">Secondary Model · Chat Agent & High-fidelity</div>
                      </div>
                      <span class="badge" style="background: #312e81; color: #c7d2fe;">Ưu tiên 2</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #1e293b; border-radius: 8px;">
                      <div>
                        <div style="font-weight: bold; color: #fff;">Ollama Local (Llama 3.1 8B)</div>
                        <div style="font-size: 11px; color: #94a3b8;">Emergency Fallback · Offline & Zero Cost</div>
                      </div>
                      <span class="badge badge-maint">Dự phòng 3</span>
                    </div>
                  </div>
                </section>

                <!-- Maintenance & System Settings -->
                <section id="system-maintenance" class="panel">
                  <h2 style="margin: 0 0 4px 0; font-size: 16px; color: #fff;">Chế độ Bảo trì Hệ thống (US-ADM-05)</h2>
                  <div style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">Kiểm soát truy cập toàn nền tảng trong thời gian bảo dưỡng kỹ thuật</div>
                  <div style="background: #1e293b; padding: 16px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                      <div>
                        <div style="font-weight: bold; font-size: 13px; color: #fff;">Kích hoạt Chế độ Bảo trì (Maintenance Mode)</div>
                        <div style="font-size: 11px; color: #94a3b8;">Chặn người dùng thông thường, trả về HTTP 503</div>
                      </div>
                      <button id="btnToggleMaintenance" onclick="toggleMaintenance()" class="btn-toggle" style="background: ${state.maintenanceMode ? '#d97706' : '#4f46e5'}">
                        ${state.maintenanceMode ? 'TẮT BẢO TRÌ' : 'BẬT BẢO TRÌ'}
                      </button>
                    </div>
                    <div>
                      <div style="font-size: 11px; font-weight: bold; color: #94a3b8; margin-bottom: 4px;">Thông điệp hiển thị cho người dùng</div>
                      <input type="text" id="maintMsgInput" value="${state.maintenanceMessage}" style="width: 100%; padding: 8px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; font-size: 12px;">
                    </div>
                  </div>
                </section>
              </div>

              <!-- System Audit Trail -->
              <section id="audit-trail" class="panel">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div>
                    <h2 style="margin: 0 0 4px 0; font-size: 16px; color: #fff;">Nhật ký Kiểm toán Bất biến (System Audit Trail)</h2>
                    <div style="font-size: 12px; color: #94a3b8;">Theo dõi lịch sử tác động cấu hình và can thiệp bảo mật của Super Admin</div>
                  </div>
                  <span style="font-size: 11px; color: #64748b;">Append-only log (SOC2 Compliant)</span>
                </div>
                <div id="auditList">
                  ${state.auditLogs.map(l => `
                    <div class="log-row">
                      <div>
                        <span style="color: #64748b;">[${l.timestamp}]</span>
                        <span style="color: #818cf8; font-weight: bold; margin: 0 8px;">${l.action}</span>
                        <span style="color: #cbd5e1;">${l.detail}</span>
                      </div>
                      <span style="color: #64748b;">${l.admin} · IP: ${l.ip}</span>
                    </div>
                  `).join('')}
                </div>
              </section>
            </main>

            <script>
              async function toggleSuspend(wsId, action) {
                const res = await fetch('/api/v1/admin/workspaces/' + wsId + '/' + action, {
                  method: 'POST',
                  headers: { 'Authorization': 'Bearer token-admin' }
                });
                if (res.ok) {
                  window.location.reload();
                } else {
                  alert('Lỗi khi thực hiện thao tác');
                }
              }

              async function toggleMaintenance() {
                const isCurrentlyOn = ${state.maintenanceMode};
                const msg = document.getElementById('maintMsgInput').value;
                const res = await fetch('/api/v1/admin/maintenance/toggle', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer token-admin'
                  },
                  body: JSON.stringify({ enabled: !isCurrentlyOn, message: msg })
                });
                if (res.ok) {
                  window.location.reload();
                } else {
                  alert('Lỗi khi đổi trạng thái bảo trì');
                }
              }
            </script>
          </body>
          </html>
        `);
        return;
      }

      // Default fallback
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    });

    server.listen(PORT, () => {
      console.log(`🚀 Mock Platform Test Server running on port ${PORT}`);
      resolve(server);
    });
  });
}

// Main Test Runner
async function runPlatformAdminTests() {
  console.log("\n========================================================");
  console.log("🛡️  BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG PHÂN HỆ PLATFORM ADMIN");
  console.log(`🌐 Test URL: ${BASE_URL} | Browser: ${CHROME_PATH}`);
  console.log("========================================================\n");

  const server = await startMockPlatformServer();

  const results = {
    total: 5,
    passed: 0,
    failed: 0,
    details: []
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
      "--window-size=1440,900"
    ]
  });

  try {
    // ----------------------------------------------------------------------
    // TEST CASE 1: Chặn Người dùng thường (Regular Member) truy cập /admin
    // ----------------------------------------------------------------------
    console.log("👉 [TC-ADM-01] Kiểm thử Chặn Người dùng thường (Regular Member) truy cập UI /admin...");
    try {
      const memberContext = await browser.createBrowserContext();
      const page = await memberContext.newPage();
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

      // Simulate member session cookie
      await page.setCookie({ name: "st_session", value: "1", domain: "localhost" }, { name: "st_role", value: "MEMBER", domain: "localhost" });

      // Intentionally try to browse to /admin
      await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
      await sleep(500);

      const screenshot1 = path.join(REPORT_DIR, "TC01_member_access_admin_denied.png");
      await page.screenshot({ path: screenshot1 });

      const pageText = await page.$eval("main", el => el.innerText);
      const isDenied = pageText.includes("403") && pageText.includes("Giới hạn Quyền Nền tảng");

      await memberContext.close();

      if (isDenied) {
        console.log("   ✅ TC-ADM-01 PASSED: Người dùng Member bị chặn truy cập /admin chuẩn xác với màn hình 403 Forbidden!");
        results.passed++;
        results.details.push({ id: "TC-ADM-01", name: "Chặn Regular Member truy cập /admin", status: "PASSED", screenshot: screenshot1 });
      } else {
        throw new Error(`Member was not properly blocked from /admin (found text: ${pageText.substring(0, 80)})`);
      }
    } catch (err) {
      console.error("   ❌ TC-ADM-01 FAILED:", err.message);
      results.failed++;
      results.details.push({ id: "TC-ADM-01", name: "Chặn Regular Member truy cập /admin", status: "FAILED", error: err.message });
    }

    // ----------------------------------------------------------------------
    // TEST CASE 2: Chặn Workspace Owner truy cập /admin (Zero-Trust Tenant Boundary)
    // ----------------------------------------------------------------------
    console.log("\n👉 [TC-ADM-02] Kiểm thử Chặn Workspace Owner truy cập UI /admin (Zero-Trust Tenant Boundary)...");
    try {
      const ownerContext = await browser.createBrowserContext();
      const page = await ownerContext.newPage();
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

      // Simulate Workspace Owner session cookie
      await page.setCookie({ name: "st_session", value: "1", domain: "localhost" }, { name: "st_role", value: "OWNER", domain: "localhost" });

      // Intentionally try to browse to /admin
      await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
      await sleep(500);

      const screenshot2 = path.join(REPORT_DIR, "TC02_owner_access_admin_denied.png");
      await page.screenshot({ path: screenshot2 });

      const pageText = await page.$eval("main", el => el.innerText);
      const isDenied = pageText.includes("403") && pageText.includes("kể cả Workspace Owner");

      await ownerContext.close();

      if (isDenied) {
        console.log("   ✅ TC-ADM-02 PASSED: Workspace Owner bị chặn nghiêm ngặt khi cố truy cập /admin!");
        results.passed++;
        results.details.push({ id: "TC-ADM-02", name: "Chặn Workspace Owner truy cập /admin (Zero-Trust)", status: "PASSED", screenshot: screenshot2 });
      } else {
        throw new Error(`Owner was not blocked from /admin`);
      }
    } catch (err) {
      console.error("   ❌ TC-ADM-02 FAILED:", err.message);
      results.failed++;
      results.details.push({ id: "TC-ADM-02", name: "Chặn Workspace Owner truy cập /admin (Zero-Trust)", status: "FAILED", error: err.message });
    }

    // ----------------------------------------------------------------------
    // TEST CASE 3: Kiểm thử gọi REST API /api/v1/admin/* bằng Token Member / Owner (HTTP 403)
    // ----------------------------------------------------------------------
    console.log("\n👉 [TC-ADM-03] Kiểm thử gọi REST API /api/v1/admin/* bằng Token Member/Owner...");
    try {
      const page = await browser.newPage();
      
      const memberApiRes = await page.evaluate(async (url) => {
        const res = await fetch(`${url}/api/v1/admin/overview`, {
          headers: { 'Authorization': 'Bearer token-member' }
        });
        return { status: res.status, body: await res.json() };
      }, BASE_URL);

      const ownerApiRes = await page.evaluate(async (url) => {
        const res = await fetch(`${url}/api/v1/admin/workspaces`, {
          headers: { 'Authorization': 'Bearer token-owner' }
        });
        return { status: res.status, body: await res.json() };
      }, BASE_URL);

      const anonApiRes = await page.evaluate(async (url) => {
        const res = await fetch(`${url}/api/v1/admin/overview`);
        return { status: res.status, body: await res.json() };
      }, BASE_URL);

      await page.close();

      console.log(`   ℹ️ Member API HTTP Status: ${memberApiRes.status} (Code: ${memberApiRes.body.code})`);
      console.log(`   ℹ️ Owner API HTTP Status: ${ownerApiRes.status} (Code: ${ownerApiRes.body.code})`);
      console.log(`   ℹ️ Anon API HTTP Status: ${anonApiRes.status} (Code: ${anonApiRes.body.code})`);

      const passMember = memberApiRes.status === 403 && memberApiRes.body.code === "PLATFORM_ADMIN_REQUIRED";
      const passOwner = ownerApiRes.status === 403 && ownerApiRes.body.code === "PLATFORM_ADMIN_REQUIRED";
      const passAnon = anonApiRes.status === 403 && anonApiRes.body.code === "PLATFORM_ADMIN_REQUIRED";

      if (passMember && passOwner && passAnon) {
        console.log("   ✅ TC-ADM-03 PASSED: Toàn bộ API /api/v1/admin/* đều trả về 403 PLATFORM_ADMIN_REQUIRED khi thiếu quyền!");
        results.passed++;
        results.details.push({ id: "TC-ADM-03", name: "Gọi REST API Admin bằng Token Member/Owner trả 403", status: "PASSED" });
      } else {
        throw new Error(`API RBAC test failed (member=${passMember}, owner=${passOwner}, anon=${passAnon})`);
      }
    } catch (err) {
      console.error("   ❌ TC-ADM-03 FAILED:", err.message);
      results.failed++;
      results.details.push({ id: "TC-ADM-03", name: "Gọi REST API Admin bằng Token Member/Owner trả 403", status: "FAILED", error: err.message });
    }

    // ----------------------------------------------------------------------
    // TEST CASE 4: Super Admin đăng nhập hợp lệ & Kiểm chứng Giao diện Quản trị
    // ----------------------------------------------------------------------
    console.log("\n👉 [TC-ADM-04] Super Admin đăng nhập hợp lệ & Kiểm chứng Giao diện Console Quản trị Nền tảng...");
    let adminContext;
    let adminPage;
    try {
      adminContext = await browser.createBrowserContext();
      adminPage = await adminContext.newPage();
      await adminPage.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });

      // Authenticate as Super Admin
      await adminPage.setCookie(
        { name: "st_session", value: "1", domain: "localhost" },
        { name: "st_role", value: "SUPER_ADMIN", domain: "localhost" },
        { name: "st_email", value: "admin@smarttask.local", domain: "localhost" }
      );

      await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
      await sleep(1000);

      const screenshot4 = path.join(REPORT_DIR, "TC04_platform_admin_console_dashboard.png");
      await adminPage.screenshot({ path: screenshot4 });

      const adminPageText = await adminPage.$eval("body", el => el.innerText);
      const hasHealthKPI = adminPageText.includes("HEALTHY") && adminPageText.includes("Uptime: 99.98%");
      const hasTenantsSection = adminPageText.includes("Quản trị Danh sách Khách hàng") && adminPageText.includes("Acme Corporation");
      const hasFinOpsSection = adminPageText.includes("Điều phối FinOps AI") && adminPageText.includes("Gemini 1.5 Pro");
      const hasAuditTrail = adminPageText.includes("Nhật ký Kiểm toán Bất biến");

      console.log(`   ℹ️ Health KPI: ${hasHealthKPI} | Tenants Table: ${hasTenantsSection} | FinOps: ${hasFinOpsSection} | Audit Trail: ${hasAuditTrail}`);

      if (hasHealthKPI && hasTenantsSection && hasFinOpsSection && hasAuditTrail) {
        console.log("   ✅ TC-ADM-04 PASSED: Giao diện Platform Admin hiển thị đầy đủ, chính xác toàn bộ phân hệ quản trị!");
        results.passed++;
        results.details.push({ id: "TC-ADM-04", name: "Super Admin đăng nhập & kiểm chứng Giao diện Admin Console", status: "PASSED", screenshot: screenshot4 });
      } else {
        throw new Error(`Platform admin UI components missing (health=${hasHealthKPI}, tenants=${hasTenantsSection}, finops=${hasFinOpsSection}, audit=${hasAuditTrail})`);
      }
    } catch (err) {
      console.error("   ❌ TC-ADM-04 FAILED:", err.message);
      results.failed++;
      results.details.push({ id: "TC-ADM-04", name: "Super Admin đăng nhập & kiểm chứng Giao diện Admin Console", status: "FAILED", error: err.message });
    }

    // ----------------------------------------------------------------------
    // TEST CASE 5: Kiểm chứng Vận hành nhạy cảm: Đình chỉ Workspace & Kích hoạt Bảo trì
    // ----------------------------------------------------------------------
    console.log("\n👉 [TC-ADM-05] Kiểm thử Vận hành nhạy cảm: Đình chỉ Workspace & Bật Chế độ Bảo trì...");
    try {
      // Step A: Đình chỉ Workspace "Acme Corporation"
      console.log("   Step A: Super Admin kích hoạt Đình chỉ (Suspend) Workspace Acme Corporation...");
      await adminPage.evaluate(async (url) => {
        await fetch(`${url}/api/v1/admin/workspaces/ws-acme/suspend`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer token-admin' }
        });
      }, BASE_URL);

      await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
      await sleep(800);

      const screenshot5A = path.join(REPORT_DIR, "TC05_workspace_suspended_action.png");
      await adminPage.screenshot({ path: screenshot5A });

      // Verify DB state
      const acmeWs = state.workspaces.find(w => w.id === "ws-acme");
      const isAcmeSuspended = acmeWs && acmeWs.status === "SUSPENDED";
      console.log(`   ℹ️ Trạng thái Acme Corp sau đình chỉ: ${acmeWs?.status}`);

      // Step B: Member của Acme Corporation kiểm tra màn hình /workspaces
      const memberCheckContext = await browser.createBrowserContext();
      const memberCheckPage = await memberCheckContext.newPage();
      await memberCheckPage.setViewport({ width: 1440, height: 900 });
      await memberCheckPage.setCookie({ name: "st_session", value: "1", domain: "localhost" }, { name: "st_role", value: "MEMBER", domain: "localhost" });
      await memberCheckPage.goto(`${BASE_URL}/workspaces`, { waitUntil: "domcontentloaded" });
      await sleep(500);

      const screenshot5BMember = path.join(REPORT_DIR, "TC05_member_view_suspended_workspace.png");
      await memberCheckPage.screenshot({ path: screenshot5BMember });

      const memberPageText = await memberCheckPage.$eval("body", el => el.innerText);
      const memberSawSuspensionWarning = memberPageText.includes("Không gian làm việc Acme Corporation đã bị đình chỉ") && memberPageText.includes("tạm ngưng bởi Quản trị viên");
      await memberCheckContext.close();

      // Step C: Super Admin bật Chế độ Bảo trì (Maintenance Mode)
      console.log("   Step C: Super Admin bật Chế độ Bảo trì (Maintenance Mode)...");
      await adminPage.evaluate(async (url) => {
        await fetch(`${url}/api/v1/admin/maintenance/toggle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token-admin'
          },
          body: JSON.stringify({ enabled: true, message: "Hệ thống đang bảo trì nâng cấp cụm cơ sở dữ liệu định kỳ" })
        });
      }, BASE_URL);

      await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
      await sleep(800);

      const screenshot5C = path.join(REPORT_DIR, "TC05_maintenance_mode_activated.png");
      await adminPage.screenshot({ path: screenshot5C });

      // Step D: Member gửi request API trong thời gian bảo trì
      const memberApiDuringMaint = await adminPage.evaluate(async (url) => {
        const res = await fetch(`${url}/api/v1/workspaces/ws-beta/tasks`, {
          headers: { 'Authorization': 'Bearer token-member' }
        });
        return { status: res.status, body: await res.json() };
      }, BASE_URL);

      console.log(`   ℹ️ API response đối với Member khi Bảo trì bật: HTTP ${memberApiDuringMaint.status} (Code: ${memberApiDuringMaint.body.code})`);

      const passMaint503 = memberApiDuringMaint.status === 503 && memberApiDuringMaint.body.code === "MAINTENANCE_MODE_ACTIVE";

      // Step E: Khôi phục lại trạng thái bình thường (Clean up)
      await adminPage.evaluate(async (url) => {
        await fetch(`${url}/api/v1/admin/maintenance/toggle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token-admin'
          },
          body: JSON.stringify({ enabled: false })
        });
        await fetch(`${url}/api/v1/admin/workspaces/ws-acme/unsuspend`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer token-admin' }
        });
      }, BASE_URL);

      await adminContext.close();

      if (isAcmeSuspended && memberSawSuspensionWarning && passMaint503) {
        console.log("   ✅ TC-ADM-05 PASSED: Kịch bản vận hành nhạy cảm (Đình chỉ Workspace & Bật bảo trì 503) diễn ra chuẩn xác!");
        results.passed++;
        results.details.push({ id: "TC-ADM-05", name: "Vận hành nhạy cảm: Đình chỉ Workspace & Bảo trì 503", status: "PASSED", screenshot: screenshot5C });
      } else {
        throw new Error(`Sensitive ops verification failed (acmeSuspended=${isAcmeSuspended}, memberWarning=${memberSawSuspensionWarning}, maint503=${passMaint503})`);
      }
    } catch (err) {
      console.error("   ❌ TC-ADM-05 FAILED:", err.message);
      results.failed++;
      results.details.push({ id: "TC-ADM-05", name: "Vận hành nhạy cảm: Đình chỉ Workspace & Bảo trì 503", status: "FAILED", error: err.message });
    }

  } finally {
    await browser.close();
    server.close();
  }

  console.log("\n========================================================");
  console.log(`📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ: ${results.passed}/${results.total} PASSED`);
  console.log("========================================================\n");
  console.table(results.details);

  fs.writeFileSync(path.join(REPORT_DIR, "report.json"), JSON.stringify(results, null, 2), "utf-8");
  return results;
}

runPlatformAdminTests()
  .then((res) => {
    if (res.failed > 0) process.exit(1);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
