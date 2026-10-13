"use client";

import * as React from "react";
import { Check, X, ShieldCheck, Key, Lock, DollarSign, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function LandingCostComparison() {
  const securityCommitments = [
    {
      icon: Lock,
      title: "Mã Hoá AES-256-GCM Đối Xứng",
      description:
        "Khóa API được mã hoá hai chiều bằng hệ thống khoá bí mật cấp máy chủ. Không bao giờ lưu văn bản thuần (plain text) trong cơ sở dữ liệu.",
    },
    {
      icon: ShieldCheck,
      title: "Không Lưu Trữ Prompt Để Đào Tạo",
      description:
        "Dữ liệu công việc và mô tả sprint đi thẳng từ API Key của bạn tới nhà cung cấp (Google/OpenAI). Không có trung gian huấn luyện AI.",
    },
    {
      icon: DollarSign,
      title: "Toàn Quyền Giới Hạn Ngân Sách",
      description:
        "Bạn toàn quyền đặt mức trần chi tiêu (Spend Limit) trực tiếp trên bảng điều khiển của Google AI Studio hoặc OpenAI để kiểm soát 100% chi phí.",
    },
    {
      icon: Key,
      title: "Đổi Hoặc Thu Hồi Khóa Tức Thì",
      description:
        "Chỉ cần 1 cú click trong phần Cài đặt Workspace để thay đổi hoặc thu hồi khóa bất cứ lúc nào bạn muốn.",
    },
  ];

  return (
    <section id="cost-comparison" className="py-16 md:py-24 border-t border-border/60 bg-background">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 mb-3 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            Tối Ưu Ngân Sách 95%
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Bảng So Sánh Chi Phí &amp; Cam Kết Bảo Mật BYOK
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Tại sao phải trả hàng trăm USD mỗi tháng cho các gói cước AI đóng gói sẵn khi bạn có thể trả đúng giá gốc
            với chi phí chỉ vài nghìn đồng?
          </p>
        </div>

        {/* Cost Comparison Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto mb-16">
          {/* Card 1: Traditional SaaS (Jira / Asana + AI) */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  SaaS Quản Lý Truyền Thống
                </span>
                <Badge variant="secondary" className="text-xs">
                  Gói Cước Đóng Gói
                </Badge>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-foreground">~250$ - 350$</span>
                  <span className="text-sm text-muted-foreground font-medium">/ tháng</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  (Khoảng 6.500.000đ – 9.000.000đ/tháng cho đội ngũ 10 người)
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-border/40 text-sm">
                <div className="flex items-start gap-2.5 text-muted-foreground">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>Phí bản quyền $15 - $25 / người dùng / tháng</span>
                </div>
                <div className="flex items-start gap-2.5 text-muted-foreground">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>Phụ phí tính năng AI cộng thêm $10 / người dùng</span>
                </div>
                <div className="flex items-start gap-2.5 text-muted-foreground">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>Phải trả trọn gói dù tháng đó ít dùng AI</span>
                </div>
                <div className="flex items-start gap-2.5 text-muted-foreground">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>Bị khóa vào 1 mô hình cố định duy nhất</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-border/40">
              <p className="text-xs text-muted-foreground text-center">
                Chi phí tăng lũy tiến khi quy mô đội ngũ mở rộng
              </p>
            </div>
          </div>

          {/* Card 2: SmartTask BYOK (Highlight) */}
          <div className="rounded-2xl border-2 border-primary bg-primary/5 dark:bg-primary/[0.03] p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
              Khuyên Dùng · Tiết Kiệm 95%
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-primary uppercase tracking-wider">
                  SmartTask (Mô Hình BYOK)
                </span>
                <Badge variant="outline" className="text-xs border-primary/30 text-primary font-semibold">
                  100% Free Core
                </Badge>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-foreground">0 đ</span>
                  <span className="text-base text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                    + ~0.20$ token
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  (Chỉ khoảng <strong>5.000đ – 35.000đ/tháng</strong> cho toàn bộ đội ngũ 10 người)
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-primary/20 text-sm">
                <div className="flex items-start gap-2.5 text-foreground font-medium">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Phần mềm SmartTask miễn phí hoàn toàn 100%</span>
                </div>
                <div className="flex items-start gap-2.5 text-foreground font-medium">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Trả tiền token trực tiếp cho Google / DeepSeek theo giá gốc</span>
                </div>
                <div className="flex items-start gap-2.5 text-foreground font-medium">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Dùng bao nhiêu trả bấy nhiêu (Zero Markup Token)</span>
                </div>
                <div className="flex items-start gap-2.5 text-foreground font-medium">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Tự do đổi linh hoạt giữa Gemini, GPT-4o và DeepSeek</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-primary/20">
              <Button asChild size="lg" className="w-full font-bold shadow-md">
                <Link href="/login?mode=register">
                  <Sparkles className="mr-2 h-4 w-4" />
                  <span>Bắt Đầu Tiết Kiệm Ngay Hôm Nay</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* 4 Enterprise Security Commitments */}
        <div className="max-w-5xl mx-auto rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              4 Cam Kết Bảo Mật API Key Cấp Doanh Nghiệp
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Sự an toàn và quyền riêng tư dữ liệu của bạn là ưu tiên số một trong thiết kế hệ thống của chúng tôi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {securityCommitments.map((sec) => (
              <div
                key={sec.title}
                className="flex items-start gap-3.5 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/30 transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <sec.icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-1">{sec.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{sec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
