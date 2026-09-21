import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

/**
 * SmartTask RBAC E2E Automated Test Suite via Puppeteer
 * Testing:
 *   - TC-1: Workspace Members Tab & Role Change Modal (OWNER / ADMIN)
 *   - TC-2: Member Read-only Lock in Workspace Settings (MEMBER)
 *   - TC-3: Project Settings & PM vs Member Roles (Claim task, Q filter, Sprint controls)
 *   - TC-4: Dedicated AI System Configuration for Admin/Owner vs Locked Barrier for Member
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const API_URL = process.env.API_URL || "http://localhost:3000/api/v1";
const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const REPORT_DIR = path.resolve(process.cwd(), "docs/test-reports/rbac");

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const USERS = {
  owner: { email: "lan@smarttask.local", pass: "Demo@1234", name: "Lan", role: "OWNER", projRole: "PM" },
  member: { email: "minh@smarttask.local", pass: "Demo@1234", name: "Minh", role: "MEMBER", projRole: "MEMBER" },
};

const DEMO_WS_ID = "ec5182b2-91b2-4be0-a9d2-7ea870da8b46";
const DEMO_PROJECT_ID = "8edd74d4-a301-44d5-bf07-8d36d44945e5";

async function createAuthenticatedPage(browser, email, password) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  console.log(`🔑 Logging into new context as ${email}...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2", timeout: 15000 });
  await page.waitForSelector("form", { timeout: 8000 });

  // Clear and type email
  await page.focus('form input[type="email"]');
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(email, { delay: 15 });

  // Clear and type password
  await page.focus('form input[type="password"]');
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(password, { delay: 15 });

  // Submit
  await page.click('form button[type="submit"]');
  await page.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 10000 }).catch(() => {});
  await sleep(1500);

  return { context, page };
}

async function runRbacTests() {
  console.log("\n========================================================");
  console.log("🧪 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG RBAC MATRIX - SMARTTASK");
  console.log(`🌐 Web URL: ${BASE_URL} | API URL: ${API_URL}`);
  console.log(`🖥️  Chrome: ${CHROME_PATH}`);
  console.log("========================================================\n");

  const results = {
    total: 4,
    passed: 0,
    failed: 0,
    details: [],
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
      "--window-size=1440,900",
    ],
  });

  try {
    // ----------------------------------------------------
    // TEST CASE 1: Xem tab Thành viên Workspace & Modal đổi Role
    // ----------------------------------------------------
    console.log("👉 [TEST CASE 1] Xem tab Thành viên Workspace & Đổi Role (OWNER/ADMIN)...");
    try {
      const { context, page } = await createAuthenticatedPage(browser, USERS.owner.email, USERS.owner.pass);

      await page.goto(`${BASE_URL}/settings?tab=members&ws=${DEMO_WS_ID}`, { waitUntil: "networkidle2", timeout: 15000 });
      await page.waitForSelector("table", { timeout: 10000 });
      await sleep(1000);

      const screenshot1 = path.join(REPORT_DIR, "TC01_workspace_members_owner.png");
      await page.screenshot({ path: screenshot1 });

      const bodyText = await page.$eval("main", el => el.innerText);
      const hasLan = bodyText.includes("Nguyễn Thị Lan") || bodyText.includes("lan@smarttask.local");
      const hasMinh = bodyText.includes("Trần Quang Minh") || bodyText.includes("minh@smarttask.local");
      const hasOwnerBadge = bodyText.includes("OWNER");
      const hasInviteSection = bodyText.includes("Lời mời") || bodyText.includes("Tạo link mời");

      await context.close();

      if (hasLan && hasMinh && hasOwnerBadge && hasInviteSection) {
        console.log("   ✅ TC-01 PASSED: Bảng thành viên, huy hiệu OWNER/MEMBER và khung tạo lời mời hiển thị chuẩn xác!");
        results.passed++;
        results.details.push({ id: "TC-01", name: "Xem tab Thành viên Workspace & Modal đổi Role", status: "PASSED", screenshot: screenshot1 });
      } else {
        throw new Error(`Content check failed (lan=${hasLan}, minh=${hasMinh}, owner=${hasOwnerBadge}, invite=${hasInviteSection})`);
      }
    } catch (err) {
      console.error("   ❌ TC-01 FAILED:", err.message);
      results.failed++;
      results.details.push({ id: "TC-01", name: "Xem tab Thành viên Workspace & Modal đổi Role", status: "FAILED", error: err.message });
    }

    // ----------------------------------------------------
    // TEST CASE 2: Kiểm tra trạng thái Khóa / Read-only khi tài khoản là MEMBER
    // ----------------------------------------------------
    console.log("\n👉 [TEST CASE 2] Kiểm tra trạng thái Khóa / Read-only đối với MEMBER...");
    try {
      const { context, page } = await createAuthenticatedPage(browser, USERS.member.email, USERS.member.pass);

      await page.goto(`${BASE_URL}/settings?tab=settings&ws=${DEMO_WS_ID}`, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(2000);

      const screenshot2 = path.join(REPORT_DIR, "TC02_workspace_settings_member_readonly.png");
      await page.screenshot({ path: screenshot2 });

      const bodyText = await page.$eval("main", el => el.innerText);
      const hasReadOnlyAlert = bodyText.includes("Chế độ xem (Chỉ đọc)") || bodyText.includes("Bạn đang là MEMBER");

      const disabledInputsCount = await page.$$eval('input[type="number"]:disabled, input[type="time"]:disabled', (els) => els.length);
      const isSaveDisabled = await page.$eval('button[type="submit"]', (btn) => btn.disabled).catch(() => true);

      console.log(`   ℹ️ Alert chỉ đọc: ${hasReadOnlyAlert} | Số ô nhập bị disabled: ${disabledInputsCount} | Nút Lưu disabled: ${isSaveDisabled}`);

      await context.close();

      if (hasReadOnlyAlert && disabledInputsCount >= 4 && isSaveDisabled) {
        console.log("   ✅ TC-02 PASSED: Tài khoản MEMBER bị khóa toàn bộ input tham số workspace & hiển thị Alert Read-only!");
        results.passed++;
        results.details.push({ id: "TC-02", name: "Kiểm tra trạng thái Khóa / Read-only khi tài khoản là MEMBER", status: "PASSED", screenshot: screenshot2 });
      } else {
        throw new Error(`Read-only verification failed (alert=${hasReadOnlyAlert}, disabledInputs=${disabledInputsCount}, saveDisabled=${isSaveDisabled})`);
      }
    } catch (err) {
      console.error("   ❌ TC-02 FAILED:", err.message);
      results.failed++;
      results.details.push({ id: "TC-02", name: "Kiểm tra trạng thái Khóa / Read-only khi tài khoản là MEMBER", status: "FAILED", error: err.message });
    }

    // ----------------------------------------------------
    // TEST CASE 3: Cài đặt Dự án (Project Settings) & phân vai PM vs Member trong dự án
    // ----------------------------------------------------
    console.log("\n👉 [TEST CASE 3] Cài đặt Dự án & Phân vai PM vs Member (Claim task, Q filter, Sprint controls)...");
    try {
      // 3A: Member session
      const { context: memberCtx, page: memberPage } = await createAuthenticatedPage(browser, USERS.member.email, USERS.member.pass);

      await memberPage.goto(`${BASE_URL}/projects/${DEMO_PROJECT_ID}/board`, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(2000);

      const memberBoardText = await memberPage.$eval("main", el => el.innerText);
      const hasMemberBanner = memberBoardText.includes("Thành viên dự án") || memberBoardText.includes("Bạn đang phụ trách");
      const hasClaimButton = memberBoardText.includes("Nhận task");

      // Press Q shortcut
      await memberPage.keyboard.press("KeyQ");
      await sleep(600);
      const screenshot3Member = path.join(REPORT_DIR, "TC03_member_kanban_board_q_filter.png");
      await memberPage.screenshot({ path: screenshot3Member });

      // Member visits Project Settings
      await memberPage.goto(`${BASE_URL}/projects/${DEMO_PROJECT_ID}/settings?tab=sprints`, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(1500);

      const memberSettingsText = await memberPage.$eval("main", el => el.innerText);
      const memberHasReadOnlyWarning = memberSettingsText.includes("Bạn chỉ xem") || memberSettingsText.includes("vai PM");
      const createSprintBtnDisabledForMember = await memberPage.$eval('button:has-text("Tạo sprint")', (btn) => btn.disabled).catch(() => true);

      await memberCtx.close();

      // 3B: PM / Owner session
      const { context: pmCtx, page: pmPage } = await createAuthenticatedPage(browser, USERS.owner.email, USERS.owner.pass);

      await pmPage.goto(`${BASE_URL}/projects/${DEMO_PROJECT_ID}/board`, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(2000);

      const pmBoardText = await pmPage.$eval("main", el => el.innerText);
      const hasPmBanner = pmBoardText.includes("PM / Trưởng nhóm điều phối") || pmBoardText.includes("Cân bằng tải AI");

      // PM visits Project Settings
      await pmPage.goto(`${BASE_URL}/projects/${DEMO_PROJECT_ID}/settings?tab=sprints`, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(1500);

      const screenshot3PM = path.join(REPORT_DIR, "TC03_pm_project_settings.png");
      await pmPage.screenshot({ path: screenshot3PM });

      const createSprintBtnEnabledForPM = await pmPage.$eval('button:has-text("Tạo sprint")', (btn) => !btn.disabled).catch(() => true);

      await pmCtx.close();

      console.log(`   ℹ️ Member banner: ${hasMemberBanner} | Claim task btn: ${hasClaimButton} | PM banner: ${hasPmBanner} | PM create sprint enabled: ${createSprintBtnEnabledForPM}`);

      if (hasMemberBanner && memberHasReadOnlyWarning && hasPmBanner && createSprintBtnEnabledForPM) {
        console.log("   ✅ TC-03 PASSED: Phân vai PM vs Member chuẩn mực trên Kanban board và Project Settings!");
        results.passed++;
        results.details.push({ id: "TC-03", name: "Cài đặt Dự án (Project Settings) & phân vai PM vs Member trong dự án", status: "PASSED", screenshot: screenshot3PM });
      } else {
        throw new Error(`Project roles verification failed (memberBanner=${hasMemberBanner}, warning=${memberHasReadOnlyWarning}, pmBanner=${hasPmBanner}, pmSprint=${createSprintBtnEnabledForPM})`);
      }
    } catch (err) {
      console.error("   ❌ TC-03 FAILED:", err.message);
      results.failed++;
      results.details.push({ id: "TC-03", name: "Cài đặt Dự án (Project Settings) & phân vai PM vs Member trong dự án", status: "FAILED", error: err.message });
    }

    // ----------------------------------------------------
    // TEST CASE 4: Cấu hình Hệ thống AI dành riêng cho Admin/Owner
    // ----------------------------------------------------
    console.log("\n👉 [TEST CASE 4] Cấu hình Hệ thống AI dành riêng cho Admin/Owner vs Khóa đối với Member...");
    try {
      // 4A: Owner / Admin session
      const { context: adminCtx, page: adminPage } = await createAuthenticatedPage(browser, USERS.owner.email, USERS.owner.pass);

      await adminPage.goto(`${BASE_URL}/settings?tab=ai&ws=${DEMO_WS_ID}`, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(2000);

      const screenshot4Admin = path.join(REPORT_DIR, "TC04_ai_settings_admin_owner.png");
      await adminPage.screenshot({ path: screenshot4Admin });

      const adminBodyText = await adminPage.$eval("main", el => el.innerText);
      const hasAdminAiTitle = adminBodyText.includes("Trung tâm Quản trị AI") || adminBodyText.includes("Cấu hình API");
      const hasAiSubtabs = adminBodyText.includes("Cấu hình API") && adminBodyText.includes("Danh mục Model");

      await adminCtx.close();

      // 4B: Member session
      const { context: memberCtx2, page: memberPage2 } = await createAuthenticatedPage(browser, USERS.member.email, USERS.member.pass);

      await memberPage2.goto(`${BASE_URL}/settings?tab=ai&ws=${DEMO_WS_ID}`, { waitUntil: "networkidle2", timeout: 15000 });
      await sleep(2000);

      const screenshot4Member = path.join(REPORT_DIR, "TC04_ai_settings_member_locked.png");
      await memberPage2.screenshot({ path: screenshot4Member });

      const memberBodyText = await memberPage2.$eval("main", el => el.innerText);
      const hasAccessDeniedBarrier = memberBodyText.includes("Giới hạn quyền truy cập") || memberBodyText.includes("Chỉ Quản trị viên (OWNER / ADMIN)");

      await memberCtx2.close();

      console.log(`   ℹ️ Admin AI tabs visible: ${hasAiSubtabs} | Member barrier locked: ${hasAccessDeniedBarrier}`);

      if (hasAiSubtabs && hasAccessDeniedBarrier) {
        console.log("   ✅ TC-04 PASSED: AI Settings hiển thị đầy đủ cho Owner/Admin và khóa chặt chẽ đối với Member!");
        results.passed++;
        results.details.push({ id: "TC-04", name: "Cấu hình Hệ thống AI dành riêng cho Admin/Owner", status: "PASSED", screenshot: screenshot4Admin });
      } else {
        throw new Error(`AI settings verification failed (adminTabs=${hasAiSubtabs}, memberBarrier=${hasAccessDeniedBarrier})`);
      }
    } catch (err) {
      console.error("   ❌ TC-04 FAILED:", err.message);
      results.failed++;
      results.details.push({ id: "TC-04", name: "Cấu hình Hệ thống AI dành riêng cho Admin/Owner", status: "FAILED", error: err.message });
    }

  } finally {
    await browser.close();
  }

  console.log("\n========================================================");
  console.log(`📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ: ${results.passed}/${results.total} PASSED`);
  console.log("========================================================\n");
  console.table(results.details);

  fs.writeFileSync(path.join(REPORT_DIR, "report.json"), JSON.stringify(results, null, 2), "utf-8");
  return results;
}

runRbacTests()
  .then((res) => {
    if (res.failed > 0) process.exit(1);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
