"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  Bot,
  Sparkles,
  Send,
  Check,
  Edit2,
  Code2,
  Calendar,
  Shuffle,
  HelpCircle,
  Clock,
  User,
} from "lucide-react";
import { INITIAL_CHAT_MESSAGES, CHAT_COMMAND_SUGGESTIONS, type ChatMessage } from "@/mocks/chat";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AIAssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAssistantDrawer({ open, onOpenChange }: AIAssistantDrawerProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [inputValue, setInputValue] = React.useState("");
  const [showJsonMap, setShowJsonMap] = React.useState<Record<string, boolean>>({});

  const toggleJson = (id: string) => {
    setShowJsonMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      timestamp: "Vừa xong",
      text: inputValue.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue("");

    // Simulate AI response with Action Card
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        timestamp: "Vừa xong",
        text: "Tôi đã xử lý yêu cầu của bạn và chuẩn bị thẻ hành động bên dưới:",
        actionCard: {
          type: "EXPLAIN_BURNOUT",
          title: "Báo cáo phân rã 6 yếu tố nguy cơ Burnout của Huy",
          description: "Điểm Burnout 74 xuất phát chủ yếu từ Tải tuần này 118% (35đ) và 2 tuần liên tiếp vượt ngưỡng 90% (13.3đ). Khuyến nghị chuyển giao bớt việc sang An.",
          payloadJson: {
            memberId: "user-huy",
            burnoutScore: 74,
            topFactor: "CURRENT_WEEK_UTILIZATION",
            rebalanceSuggested: true,
          },
          status: "pending",
          confirmLabel: "Chuyển sang màn Đề xuất cân bằng",
          modifyLabel: "Bỏ qua",
        },
      };
      setMessages([...newMessages, aiResponse]);
      toast.info("AI Agent vừa tạo thẻ hành động đề xuất mới");
    }, 600);
  };

  const handleConfirmAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.actionCard
          ? { ...m, actionCard: { ...m.actionCard, status: "confirmed" } }
          : m
      )
    );
    toast.success("Đã xác nhận và áp dụng hành động từ AI");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col h-full bg-background border-l border-border"
      >
        {/* Header */}
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold flex items-center gap-2">
                Trợ lý AI SmartTask
                <Badge variant="info" className="text-[10px] px-1.5 py-0">
                  Gemini Pro
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Đề xuất cân bằng tải, phân rã WBS và hỗ trợ quyết định Agile.
              </SheetDescription>
            </div>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col gap-1.5 text-xs",
                msg.sender === "user" ? "items-end" : "items-start"
              )}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                {msg.sender === "ai" ? (
                  <>
                    <Sparkles className="h-3 w-3 text-info" />
                    <span className="font-medium text-foreground">AI Agent</span>
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3" />
                    <span className="font-medium text-foreground">Bạn</span>
                  </>
                )}
                <span>· {msg.timestamp}</span>
              </div>

              {msg.text && (
                <div
                  className={cn(
                    "rounded-xl px-3.5 py-2.5 max-w-[90%] leading-relaxed",
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/70 text-foreground border border-border/50"
                  )}
                >
                  {msg.text}
                </div>
              )}

              {/* Action Card Render */}
              {msg.actionCard && (
                <Card className="w-full border-info/50 bg-info/5 shadow-xs overflow-hidden mt-1">
                  <CardHeader className="p-3 pb-2 bg-info/10 border-b border-info/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {msg.actionCard.type === "RESCHEDULE_TASK" && (
                          <Calendar className="h-3.5 w-3.5 text-info" />
                        )}
                        {msg.actionCard.type === "REBALANCE_WORKLOAD" && (
                          <Shuffle className="h-3.5 w-3.5 text-info" />
                        )}
                        {msg.actionCard.type === "EXPLAIN_BURNOUT" && (
                          <HelpCircle className="h-3.5 w-3.5 text-info" />
                        )}
                        <CardTitle className="text-xs font-semibold text-foreground">
                          {msg.actionCard.title}
                        </CardTitle>
                      </div>
                      <Badge variant="info" className="text-[10px] px-1 py-0 font-normal">
                        Action Card
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-3 text-xs text-muted-foreground space-y-2">
                    <p className="leading-relaxed">{msg.actionCard.description}</p>

                    {/* Collapsible JSON Action Spec */}
                    <div className="pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleJson(msg.id)}
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                      >
                        <Code2 className="h-3 w-3" />
                        <span>{showJsonMap[msg.id] ? "Ẩn JSON" : "Xem JSON action"}</span>
                      </Button>

                      {showJsonMap[msg.id] && (
                        <pre className="mt-1.5 p-2 rounded bg-muted/80 text-[10px] font-mono overflow-x-auto text-foreground border">
                          {JSON.stringify(msg.actionCard.payloadJson, null, 2)}
                        </pre>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="p-3 pt-0 flex items-center justify-end gap-2 border-t border-info/10 bg-background/50">
                    {msg.actionCard.status === "confirmed" ? (
                      <Badge variant="success" className="gap-1 text-xs py-1">
                        <Check className="h-3 w-3" />
                        Đã xác nhận áp dụng
                      </Badge>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5 gap-1"
                          onClick={() => toast.info("Mở giao diện tinh chỉnh chi tiết")}
                        >
                          <Edit2 className="h-3 w-3" />
                          {msg.actionCard.modifyLabel || "Sửa"}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 text-xs px-3 gap-1 bg-info hover:bg-info/90 text-info-foreground"
                          onClick={() => handleConfirmAction(msg.id)}
                        >
                          <Check className="h-3 w-3" />
                          {msg.actionCard.confirmLabel || "Xác nhận"}
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              )}
            </div>
          ))}
        </div>

        {/* Command Quick Suggestions */}
        <div className="p-2 border-t border-border/40 bg-muted/10 flex items-center gap-1.5 overflow-x-auto">
          {CHAT_COMMAND_SUGGESTIONS.map((cmd) => (
            <Button
              key={cmd.command}
              variant="outline"
              size="sm"
              onClick={() => setInputValue(cmd.command + " ")}
              className="h-6 rounded-full px-2 text-[11px] shrink-0 font-mono text-muted-foreground hover:text-foreground"
            >
              {cmd.command}
            </Button>
          ))}
        </div>

        {/* Footer Input */}
        <div className="p-3 border-t border-border/60 bg-background flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Hỏi AI hoặc nhập lệnh (/decompose, /rebalance)..."
            className="text-xs h-9"
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <Button size="sm" onClick={handleSendMessage} className="h-9 px-3 gap-1 shrink-0">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
