"use client";

import * as React from "react";
import {
  Bot,
  Zap,
  Grid2X2,
  Scale,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function LandingBentoFeatures() {
  return (
    <section id="features" className="py-16 md:py-24 border-t border-border/60 bg-muted/15">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 mb-3 border-primary/30 text-primary">
            Sức Mạnh Nền Tảng
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Thiết Kế Chuẩn Agile Hiện Đại Cho Đội Ngũ Tinh Gọn
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Kết hợp sức mạnh trí tuệ nhân tạo thế hệ mới với bộ công cụ quản trị công việc công thái học, giúp đội ngũ
            của bạn tập trung vào việc tạo ra giá trị.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bento 1: AI Decompose WBS (Col-span 2) */}
          <div className="md:col-span-2 rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bot className="h-6 w-6" />
                </div>
                <Badge variant="default" className="text-xs font-semibold px-2.5 py-0.5">
                  BYOK Powered
                </Badge>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">
                Trợ Lý Phân Rã WBS Bằng Mô Hình Bạn Chọn
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Chỉ cần nhập một câu tóm tắt yêu cầu nghiệp vụ, AI (Gemini, GPT-4o hoặc DeepSeek) sẽ tự động phân tích,
                bẻ nhỏ thành các công việc con (WBS), đề xuất checklist chi tiết, mức độ ưu tiên và ước lượng thời gian
                chuẩn xác.
              </p>

              {/* Visual Mockup inside Card */}
              <div className="rounded-xl border border-border/70 bg-background/80 p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center gap-2 text-muted-foreground pb-2 border-b border-border/40">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">Prompt:</span>
                  <span className="truncate">&quot;Xây dựng module thanh toán đa cổng VNPay/MoMo&quot;</span>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-foreground">ST-101: Thiết kế schema giao dịch &amp; webhook IPN</span>
                    <Badge variant="outline" className="text-[9px]">4 giờ</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-foreground">ST-102: Tích hợp SDK xác thực chữ ký SHA256</span>
                    <Badge variant="outline" className="text-[9px]">6 giờ</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-foreground">ST-103: Viết test case hoàn tiền tự động (Refund)</span>
                    <Badge variant="outline" className="text-[9px]">3 giờ</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bento 2: WebSocket Realtime (Col-span 1) */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs hover:border-emerald-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Zap className="h-6 w-6" />
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                  &lt; 50ms Latency
                </Badge>
              </div>

              <h3 className="text-lg font-bold text-foreground mb-2">
                Đồng Bộ Thời Gian Thực Dưới 50ms
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Kiến trúc Socket.IO hai chiều phản chiếu tức thì mọi thao tác kéo thả bảng, chuyển sprint hoặc phân công
                task đến toàn bộ đồng đội đang mở dự án mà không cần nhấn F5.
              </p>

              {/* Visual Mini Presence Bar */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-background/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Đang online
                  </span>
                  <span className="text-muted-foreground text-[11px]">3 thành viên</span>
                </div>
                <div className="flex -space-x-1.5 overflow-hidden">
                  <div className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">L</div>
                  <div className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">N</div>
                  <div className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">A</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bento 3: Eisenhower Matrix (Col-span 1) */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs hover:border-amber-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Grid2X2 className="h-6 w-6" />
                </div>
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                  Ma Trận 2x2
                </Badge>
              </div>

              <h3 className="text-lg font-bold text-foreground mb-2">
                Ma Trận Eisenhower Định Vị Tự Động
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Tự động đánh giá độ khẩn cấp theo hạn chót (Deadline) và độ quan trọng theo mức ưu tiên, giúp loại bỏ
                bẫy việc gấp và tập trung năng lượng vào các mục tiêu dài hạn.
              </p>

              {/* Visual 2x2 Mini Grid */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-center">
                <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive font-semibold">
                  Q1: Làm ngay
                </div>
                <div className="p-2 rounded bg-primary/10 border border-primary/20 text-primary font-semibold">
                  Q2: Lên lịch
                </div>
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 font-semibold">
                  Q3: Ủy quyền
                </div>
                <div className="p-2 rounded bg-muted border border-border/40 text-muted-foreground">
                  Q4: Loại bỏ
                </div>
              </div>
            </div>
          </div>

          {/* Bento 4: Workload Balancing (Col-span 2) */}
          <div className="md:col-span-2 rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Scale className="h-6 w-6" />
                </div>
                <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-500/30">
                  Ngăn Ngừa Kiệt Sức
                </Badge>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">
                Thuật Toán Cân Bằng Tải Ngăn Ngừa Kiệt Sức (Burnout Protection)
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Hệ thống tự động đối chiếu độ khó của từng task với ma trận kỹ năng (Skill-Matrix) của từng thành viên,
                cảnh báo ngay khi có người vượt quá 100% công suất tuần và đưa ra đề xuất điều phối task thông minh.
              </p>

              {/* Visual Workload comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-destructive">Trước khi cân bằng:</span>
                    <span className="font-mono text-destructive font-bold">125% tải (Quá hạn)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">1 thành viên gánh 5 task khó, nguy cơ trễ sprint cao.</p>
                </div>

                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sau AI điều phối:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">85% tải (Tối ưu)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Công việc được san sẻ theo đúng năng lực chuyên môn.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
