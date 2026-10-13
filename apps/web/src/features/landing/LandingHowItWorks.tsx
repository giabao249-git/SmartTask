"use client";

import * as React from "react";
import { UserPlus, KeyRound, Rocket, Check, ArrowRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function LandingHowItWorks() {
  const steps = [
    {
      number: "01",
      icon: UserPlus,
      title: "Tạo Tài Khoản & Workspace (30 Giây)",
      description:
        "Đăng ký hoàn toàn miễn phí mà không cần thẻ tín dụng. Khởi tạo dự án Agile đầu tiên chỉ với 1 cú click với đầy đủ Sprint, Kanban và Eisenhower.",
      highlights: ["Không yêu cầu thẻ tín dụng", "Khởi tạo dự án tức thì", "Không giới hạn số lượng task"],
    },
    {
      number: "02",
      icon: KeyRound,
      title: "Dán Khóa API Của Bạn (1 Phút)",
      description:
        "Lấy API Key từ Google AI Studio (miễn phí), OpenAI hoặc DeepSeek và dán vào phần Cài đặt Workspace. Khóa được mã hóa AES-256 an toàn tuyệt đối.",
      highlights: ["Google Gemini (Hào phóng quota)", "OpenAI GPT-4o / DeepSeek R1", "Mã hoá AES-256 đối xứng"],
      links: [
        { label: "Lấy Key Google AI Studio", url: "https://aistudio.google.com" },
        { label: "Lấy Key DeepSeek", url: "https://platform.deepseek.com" },
      ],
    },
    {
      number: "03",
      icon: Rocket,
      title: "Tăng Tốc Toàn Diện Cho Đội Ngũ",
      description:
        "Sử dụng AI phân rã mục tiêu lớn thành 20 tasks con (WBS), cân bằng tải nhân sự theo kỹ năng và cộng tác thời gian thực với độ trễ dưới 50ms.",
      highlights: ["Phân rã WBS tự động", "Cân bằng tải tránh kiệt sức", "Đồng bộ WebSocket thời gian thực"],
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 border-t border-border/60 bg-background">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 mb-3 border-primary/30 text-primary">
            Quy Trình Triển Khai BYOK
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Khởi Đầu Với SmartTask Chỉ Trong 3 Bước Đơn Giản
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Không thủ tục rườm rà, không hợp đồng ràng buộc. Bạn làm chủ hoàn toàn dữ liệu dự án và chi phí AI của
            mình.
          </p>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative rounded-2xl border border-border/70 bg-card p-6 shadow-xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Step Number & Icon */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <span className="font-mono font-black text-2xl text-muted-foreground/30">
                    {step.number}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-bold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4">
                  {step.description}
                </p>

                {/* Highlights */}
                <div className="space-y-1.5 pt-3 border-t border-border/40">
                  {step.highlights.map((h) => (
                    <div key={h} className="flex items-center gap-2 text-xs text-foreground/80">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              {step.links && (
                <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap gap-2">
                  {step.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                    >
                      <span>{l.label}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA Banner */}
        <div className="mt-12 text-center">
          <Button asChild size="lg" className="h-11 px-6 font-semibold shadow-sm">
            <Link href="/login?mode=register">
              <span>Bắt Đầu Ngay — Chỉ Mất 2 Phút</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
