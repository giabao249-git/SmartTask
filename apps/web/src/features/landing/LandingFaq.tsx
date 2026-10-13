"use client";

import * as React from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Mô hình BYOK (Bring Your Own Key) là gì và tại sao lại có lợi hơn cho tôi?",
    answer:
      "Thay vì SmartTask bán các gói thuê bao AI đắt đỏ (10$ – 20$/tháng/người) và ăn chênh lệch token, chúng tôi cung cấp nền tảng quản lý dự án Agile 100% miễn phí tính năng cốt lõi. Bạn chỉ cần dán API Key của Google Gemini, OpenAI hoặc DeepSeek vào phần Cài đặt Workspace. Bạn thanh toán tiền token trực tiếp cho các nhà cung cấp AI với giá gốc rẻ hơn tới 95% và dùng bao nhiêu trả bấy nhiêu.",
  },
  {
    question: "Lấy API Key ở đâu và có mất nhiều chi phí không?",
    answer:
      "Rất nhanh chóng và gần như miễn phí! Với Google AI Studio (aistudio.google.com), bạn có thể lấy key Gemini 2.5 Flash hoàn toàn miễn phí với hạn mức rất lớn hàng ngày. Với DeepSeek (platform.deepseek.com), chi phí chỉ khoảng 0.14$ cho 1 triệu token (tương đương vài nghìn đồng dùng cho cả tháng phân rã công việc).",
  },
  {
    question: "Khóa API của tôi có được bảo mật an toàn không?",
    answer:
      "An toàn tuyệt đối. Khóa API của bạn được mã hóa hai chiều bằng thuật toán AES-256-GCM với mã bí mật hệ thống ngay tại máy chủ. Hệ thống không bao giờ lưu trữ khóa dưới dạng văn bản thô (plain text). Khi thực hiện phân rã task, khóa chỉ được giải mã trong bộ nhớ RAM tạm thời và kết nối an toàn qua HTTPS tới máy chủ nhà cung cấp.",
  },
  {
    question: "Nếu tôi chưa có API Key thì có dùng được SmartTask không?",
    answer:
      "Hoàn toàn được 100%! Bạn vẫn sử dụng đầy đủ các tính năng: Bảng Kanban kéo thả, Ma trận Eisenhower 2x2, Quản lý Sprint, Phân quyền thành viên, Báo cáo Burndown chart và Đồng bộ thời gian thực qua WebSocket mà không gặp bất kỳ giới hạn thời gian hay số lượng thẻ việc nào.",
  },
  {
    question: "Dự án có hỗ trợ nhiều thành viên cùng làm việc chung một Workspace không?",
    answer:
      "Có! Toàn bộ thành viên trong Workspace đều có thể cộng tác đồng thời trên các dự án. Quản trị viên (Owner/Admin) chỉ cần cấu hình API Key một lần duy nhất tại Cài đặt Workspace, toàn bộ đội ngũ sẽ được hưởng sức mạnh AI mà các thành viên không cần phải tự cấu hình key riêng lẻ.",
  },
];

export function LandingFaq() {
  const [openIndices, setOpenIndices] = React.useState<number[]>([0]);

  const toggleIndex = (index: number) => {
    setOpenIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <section id="faq" className="py-16 md:py-24 border-t border-border/60 bg-muted/15">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 mb-3 border-primary/30 text-primary">
            Giải Đáp Thắc Mắc
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Câu Hỏi Thường Gặp Về Mô Hình BYOK
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Mọi thắc mắc của bạn về chi phí, cách tích hợp API Key và quyền riêng tư dữ liệu đều được giải đáp minh
            bạch.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3.5">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndices.includes(idx);
            return (
              <div
                key={item.question}
                className="rounded-2xl border border-border/70 bg-card overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => toggleIndex(idx)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm sm:text-base font-bold text-foreground hover:bg-muted/40 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                    <span>{item.question}</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/30 bg-background/50">
                    <p>{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
