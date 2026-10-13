"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LandingHeroProps {
  isAuthenticated?: boolean;
}

export function LandingHero({ isAuthenticated }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 lg:pt-24 lg:pb-32">
      {/* Background Glow & Gradient Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-72 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute top-1/3 left-1/3 -z-10 h-64 w-64 rounded-full bg-info/10 blur-3xl" />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Eyebrow Tag */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 mb-6 shadow-xs">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Tự Do Tuyệt Đối Với Mô Hình BYOK (Bring Your Own Key)</span>
          <span className="hidden sm:inline-block h-3.5 w-px bg-primary/20" />
          <span className="hidden sm:inline-block text-muted-foreground font-normal">
            Zero Markup Token
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="mx-auto max-w-4xl text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-6xl leading-[1.15]">
          Quản Trị Dự Án Thông Minh <br />
          <span className="bg-gradient-to-r from-primary via-indigo-500 to-sky-500 bg-clip-text text-transparent">
            Với Sức Mạnh AI Do Bạn Làm Chủ
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl leading-relaxed">
          Nền tảng quản lý dự án Agile & Kanban thời gian thực{" "}
          <strong className="text-foreground font-semibold">100% miễn phí tính năng</strong>. Kết nối trực tiếp khóa
          API của Google Gemini, OpenAI hoặc DeepSeek để tự động phân rã công việc, cân bằng tải nhân sự mà không lo phụ
          phí hay gói cước đắt đỏ.
        </p>

        {/* Call to Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          {isAuthenticated ? (
            <Button asChild size="lg" className="w-full sm:w-auto h-12 px-7 text-sm font-semibold shadow-md">
              <Link href="/workspaces">
                <span>Vào Không Gian Làm Việc Của Bạn</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto h-12 px-7 text-sm font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Link href="/login?mode=register">
                <Sparkles className="mr-2 h-4 w-4" />
                <span>Tạo Workspace Miễn Phí Ngay</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}

          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto h-12 px-6 text-sm font-semibold border-border hover:bg-muted/60"
          >
            <a href="#sandbox">
              <span>Trải Nghiệm Sandbox Tương Tác</span>
            </a>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="lg"
            className="w-full sm:w-auto h-12 px-5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <a href="#cost-comparison">
              <span>Xem So Sánh Chi Phí ↓</span>
            </a>
          </Button>
        </div>

        {/* Trust Points */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Không yêu cầu thẻ tín dụng</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Mã hóa AES-256 bảo vệ Key</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Đồng bộ WebSocket &lt; 50ms</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Không giới hạn số lượng task</span>
          </div>
        </div>

        {/* Supported AI Providers Banner */}
        <div className="mt-14 max-w-4xl mx-auto rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm p-4 sm:p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-4">
            Tự Do Lựa Chọn &amp; Kết Nối Đa Mô Hình AI Hàng Đầu Thế Giới
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Google Gemini Card */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-muted/20 transition-all text-left">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-black text-sm">
                G
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-foreground">Google Gemini</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-600 dark:text-blue-400">
                    Flash / Pro
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  Tốc độ phản hồi cực nhanh, quota miễn phí hào phóng từ Google AI Studio.
                </p>
              </div>
            </div>

            {/* OpenAI Card */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/50 bg-background/50 hover:border-emerald-500/40 hover:bg-muted/20 transition-all text-left">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-black text-sm">
                O
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-foreground">OpenAI</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    GPT-4o / mini
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  Tiêu chuẩn phân rã yêu cầu chuẩn xác, hệ sinh thái trí tuệ nhân tạo toàn cầu.
                </p>
              </div>
            </div>

            {/* DeepSeek Card */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/50 bg-background/50 hover:border-sky-500/40 hover:bg-muted/20 transition-all text-left">
              <div className="h-9 w-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 font-black text-sm">
                D
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-foreground">DeepSeek</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-sky-500/30 text-sky-600 dark:text-sky-400">
                    V3 / R1 Reasoning
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  Lập luận chuỗi tư duy (CoT) sâu sắc với mức giá token rẻ kỷ lục.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
