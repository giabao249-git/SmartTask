import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

/**
 * SmartTask Automated Visual Regression QA Script
 * 
 * Usage:
 *   node scripts/visual-qa-audit.mjs --phase=before
 *   node scripts/visual-qa-audit.mjs --phase=after
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const PHASE = process.argv.includes("--phase=after") ? "after" : "before";

const SCREENSHOT_DIR = path.resolve(process.cwd(), `docs/screenshots/${PHASE}`);
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runVisualAudit() {
  console.log(`\n========================================================`);
  console.log(`🚀 BẮT ĐẦU SMARTTASK VISUAL QA AUDIT - GIAI ĐOẠN: [${PHASE.toUpperCase()}]`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`🖥️  Chrome Path: ${CHROME_PATH}`);
  console.log(`📂 Lưu ảnh tại: ${SCREENSHOT_DIR}`);
  console.log(`========================================================\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
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

    const page = await browser.newPage();

    // 1. Mở trang đăng nhập hoặc kiểm tra kết nối server
    console.log("➡️  Bước 1: Kết nối web app và xác thực...");
    await page.setViewport(VIEWPORTS.desktop);
    
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2", timeout: 10000 });
      console.log("   ✅ Đã kết nối trang /login");
      
      // Thử điền form login nếu có
      const emailInput = await page.$('input[type="email"], input[name="email"]');
      if (emailInput) {
        await page.type('input[type="email"], input[name="email"]', "owner@smarttask.dev");
        await page.type('input[type="password"], input[name="password"]', "Password123!");
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) await submitBtn.click();
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 8000 }).catch(() => {});
        console.log("   ✅ Đã gửi thông tin đăng nhập thử nghiệm");
      }
    } catch (e) {
      console.warn("   ⚠️  Không kết nối được /login (máy chủ dev có thể chưa chạy). Vẫn tiếp tục kiểm thử offline/mock nếu có.");
    }

    // 2. AC-1: Chatbot 2-sided alignment & Fluid Layout
    console.log("\n📸 Bước 2: Chụp AC-1 - Chatbot 2-Sided Alignment & Fluid Layout...");
    try {
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle2", timeout: 5000 }).catch(() => {});
      await sleep(1000);

      // Thử tìm link tới Assistant hoặc điều hướng trực tiếp
      const currentUrl = page.url();
      const projMatch = currentUrl.match(/\/projects\/([a-zA-Z0-9-]+)/);
      const projId = projMatch ? projMatch[1] : "default";

      await page.goto(`${BASE_URL}/projects/${projId}/assistant`, { waitUntil: "networkidle2", timeout: 5000 }).catch(() => {});
      await sleep(1500);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "AC1_chatbot_desktop.png") });
      console.log("   ✅ Đã chụp: AC1_chatbot_desktop.png");

      // Chụp trên mobile
      await page.setViewport(VIEWPORTS.mobile);
      await sleep(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "AC1_chatbot_mobile.png") });
      console.log("   ✅ Đã chụp: AC1_chatbot_mobile.png");
      await page.setViewport(VIEWPORTS.desktop);
    } catch (err) {
      console.error("   ❌ Lỗi khi chụp AC-1:", err.message);
    }

    // 3. AC-2: Top Navbar Workspace Switcher
    console.log("\n📸 Bước 3: Chụp AC-2 - Top Navbar Workspace Switcher...");
    try {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "AC2_navbar_switcher_closed.png") });
      console.log("   ✅ Đã chụp: AC2_navbar_switcher_closed.png");

      // Thử tìm nút trigger dropdown switcher
      const switcher = await page.$('[data-testid="workspace-switcher"], button[aria-haspopup="menu"]');
      if (switcher) {
        await switcher.click();
        await sleep(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "AC2_navbar_switcher_open.png") });
        console.log("   ✅ Đã chụp: AC2_navbar_switcher_open.png");
        // Click ra ngoài để đóng dropdown
        await page.mouse.click(10, 10);
        await sleep(300);
      }
    } catch (err) {
      console.error("   ❌ Lỗi khi chụp AC-2:", err.message);
    }

    // 4. AC-3: Cài đặt 3 phân tầng & Phân quyền RBAC
    console.log("\n📸 Bước 4: Chụp AC-3 - Tách bạch Cài đặt & Phân quyền...");
    try {
      await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle2", timeout: 5000 }).catch(() => {});
      await sleep(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "AC3_settings_overview.png") });
      console.log("   ✅ Đã chụp: AC3_settings_overview.png");
    } catch (err) {
      console.error("   ❌ Lỗi khi chụp AC-3:", err.message);
    }

    // 5. AC-4: Quick Filter "Việc của tôi" & Nút "Nhận việc"
    console.log("\n📸 Bước 5: Chụp AC-4 - Quick Filter & Nút Nhận việc...");
    try {
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle2", timeout: 5000 }).catch(() => {});
      await sleep(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "AC4_kanban_board.png") });
      console.log("   ✅ Đã chụp: AC4_kanban_board.png");

      // Thử tìm nút Quick Filter "Việc của tôi"
      const myTasksBtn = await page.$('button:has-text("Việc của tôi"), [data-testid="filter-my-tasks"]');
      if (myTasksBtn) {
        await myTasksBtn.click();
        await sleep(600);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "AC4_kanban_my_tasks_active.png") });
        console.log("   ✅ Đã chụp: AC4_kanban_my_tasks_active.png");
      }
    } catch (err) {
      console.error("   ❌ Lỗi khi chụp AC-4:", err.message);
    }

    console.log(`\n🎉 HOÀN THÀNH TOÀN BỘ QUY TRÌNH CHỤP ẢNH TỰ ĐỘNG GIAI ĐOẠN [${PHASE}]!`);
    console.log(`📂 Các file ảnh kết quả nằm tại: ${SCREENSHOT_DIR}\n`);
  } catch (globalErr) {
    console.error("\n❌ LỖI TRONG QUÁ TRÌNH THỰC THI:", globalErr);
  } finally {
    if (browser) await browser.close();
  }
}

runVisualAudit();
