"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LandingFooterProps {
  isAuthenticated?: boolean;
}

export function LandingFooter({ isAuthenticated }: LandingFooterProps) {
  return (
    <footer className="border-t border-border/60 bg-card/60 backdrop-blur-sm">
      {/* Big Final CTA Banner */}
      <div className="border-b border-border/60 py-16 md:py-20 bg-gradient-to-b from-transparent to-primary/[0.04]">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Miễn Phí 100% · Không Cần Thẻ Tín Dụng</span>
          </div>

          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground max-w-3xl mx-auto leading-tight">
            Sẵn Sàng Làm Chủ Công Việc Và Tiết Kiệm 95% Chi Phí AI?
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Gia nhập cùng các đội ngũ kỹ thuật và startup tinh gọn đang tối ưu hóa tiến độ dự án mỗi ngày với SmartTask.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {isAuthenticated ? (
              <Button asChild size="lg" className="h-12 px-8 text-sm font-semibold shadow-md">
                <Link href="/workspaces">
                  <span>Vào Không Gian Làm Việc Của Bạn</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                size="lg"
                className="h-12 px-8 text-sm font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Link href="/login?mode=register">
                  <Sparkles className="mr-2 h-4 w-4" />
                  <span>Bắt Đầu Hoàn Toàn Miễn Phí Ngay</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-xs">
                ST
              </div>
              <span className="font-extrabold text-base tracking-tight text-foreground">
                SmartTask
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nền tảng quản lý dự án Agile &amp; Kanban thời gian thực thế hệ mới theo mô hình BYOK (Bring Your Own Key).
              Tự do kết nối Gemini, OpenAI và DeepSeek.
            </p>
          </div>

          {/* Column 2: Tính Năng */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Sản Phẩm</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li><a href="#sandbox" className="hover:text-foreground transition-colors">Bảng Kanban kéo thả</a></li>
              <li><a href="#sandbox" className="hover:text-foreground transition-colors">Ma trận Eisenhower 2x2</a></li>
              <li><a href="#sandbox" className="hover:text-foreground transition-colors">Cân bằng tải AI (Workload)</a></li>
              <li><a href="#features" className="hover:text-foreground transition-colors">Phân rã WBS tự động</a></li>
              <li><a href="#features" className="hover:text-foreground transition-colors">Đồng bộ WebSocket &lt; 50ms</a></li>
            </ul>
          </div>

          {/* Column 3: Tích Hợp AI */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Tích Hợp AI (BYOK)</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li><a href="#how-it-works" className="hover:text-foreground transition-colors">Google Gemini 2.5 Flash / Pro</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground transition-colors">OpenAI GPT-4o / Mini</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground transition-colors">DeepSeek V3 &amp; R1 Reasoning</a></li>
              <li><a href="#cost-comparison" className="hover:text-foreground transition-colors">Bảo mật mã hoá AES-256</a></li>
            </ul>
          </div>

          {/* Column 4: Nền Tảng */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Nền Tảng &amp; Hỗ Trợ</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li><a href="#cost-comparison" className="hover:text-foreground transition-colors">So sánh chi phí</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">Câu hỏi thường gặp (FAQ)</a></li>
              <li><Link href="/login" className="hover:text-foreground transition-colors">Đăng nhập tài khoản</Link></li>
              <li><Link href="/login?mode=register" className="hover:text-foreground transition-colors">Đăng ký Workspace</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© 2026 SmartTask Platform. Bản quyền thuộc về SmartTask.</p>
          <div className="flex items-center gap-1">
            <span>Thiết kế cho các đội ngũ phát triển hiện đại</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
