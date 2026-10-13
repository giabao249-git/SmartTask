"use client";

import * as React from "react";
import {
  Kanban,
  Grid2X2,
  Scale,
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type AiModelKey = "gemini" | "openai" | "deepseek";
type DemoTabKey = "kanban" | "eisenhower" | "workload";

interface ModelConfig {
  name: string;
  badge: string;
  provider: string;
  speed: string;
  cost: string;
  quote: string;
  accentColor: string;
}

const MODELS: Record<AiModelKey, ModelConfig> = {
  gemini: {
    name: "Gemini 2.5 Flash",
    badge: "Siêu Tốc & Quota Free",
    provider: "Google",
    speed: "0.28s",
    cost: "0.00008 $ / call",
    quote: "Phân rã task tức thì với độ trễ tối thiểu từ Google AI Studio.",
    accentColor: "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  openai: {
    name: "GPT-4o Mini",
    badge: "Chuẩn Xác & Đa Năng",
    provider: "OpenAI",
    speed: "0.55s",
    cost: "0.0003 $ / call",
    quote: "Hiểu ngữ cảnh sâu sắc, đề xuất checklist bám sát yêu cầu nghiệp vụ.",
    accentColor: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  deepseek: {
    name: "DeepSeek R1",
    badge: "Lập Luận Chuỗi CoT",
    provider: "DeepSeek",
    speed: "0.82s",
    cost: "0.00015 $ / call",
    quote: "Suy luận đa tầng, cân đối năng lực và rủi ro chậm hạn thông minh.",
    accentColor: "border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10",
  },
};

export function LandingInteractiveDemo() {
  const [selectedModel, setSelectedModel] = React.useState<AiModelKey>("gemini");
  const [activeTab, setActiveTab] = React.useState<DemoTabKey>("kanban");

  // Kanban State
  const [kanbanTasks, setKanbanTasks] = React.useState([
    { id: "ST-1", title: "Tích hợp API Gemini & mã hoá AES-256", col: "done", priority: "Cao", time: "6/8h" },
    { id: "ST-2", title: "Xây dựng bảng Kanban kéo thả thời gian thực", col: "doing", priority: "Rất cao", time: "10/12h" },
    { id: "ST-3", title: "Thuật toán cân bằng tải tránh quá công suất", col: "doing", priority: "Cao", time: "4/8h" },
    { id: "ST-4", title: "Ma trận Eisenhower lọc việc khẩn cấp", col: "todo", priority: "Trung bình", time: "0/6h" },
    { id: "ST-5", title: "Báo cáo tiến độ Sprint & Burndown Chart", col: "todo", priority: "Thấp", time: "0/4h" },
  ]);

  // Workload State
  const [isBalancing, setIsBalancing] = React.useState(false);
  const [balanceApplied, setBalanceApplied] = React.useState(false);
  const [members, setMembers] = React.useState([
    { name: "Nguyễn Văn Nam", role: "Backend Lead", load: 125, tasks: 5, max: 40, status: "overload" },
    { name: "Trần Thị Linh", role: "Frontend Dev", load: 60, tasks: 2, max: 40, status: "available" },
    { name: "Lê Hoàng An", role: "Fullstack Dev", load: 75, tasks: 3, max: 40, status: "optimal" },
  ]);

  const handleSimulateBalance = () => {
    setIsBalancing(true);
    setTimeout(() => {
      setIsBalancing(false);
      setBalanceApplied(true);
      setMembers([
        { name: "Nguyễn Văn Nam", role: "Backend Lead", load: 85, tasks: 4, max: 40, status: "optimal" },
        { name: "Trần Thị Linh", role: "Frontend Dev", load: 85, tasks: 3, max: 40, status: "optimal" },
        { name: "Lê Hoàng An", role: "Fullstack Dev", load: 75, tasks: 3, max: 40, status: "optimal" },
      ]);
    }, 700);
  };

  const handleResetBalance = () => {
    setBalanceApplied(false);
    setMembers([
      { name: "Nguyễn Văn Nam", role: "Backend Lead", load: 125, tasks: 5, max: 40, status: "overload" },
      { name: "Trần Thị Linh", role: "Frontend Dev", load: 60, tasks: 2, max: 40, status: "available" },
      { name: "Lê Hoàng An", role: "Fullstack Dev", load: 75, tasks: 3, max: 40, status: "optimal" },
    ]);
  };

  const moveTask = (taskId: string) => {
    setKanbanTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextCol = t.col === "todo" ? "doing" : t.col === "doing" ? "done" : "todo";
        return { ...t, col: nextCol };
      })
    );
  };

  const currentModel = MODELS[selectedModel];

  return (
    <section id="sandbox" className="py-16 md:py-24 border-t border-border/60 bg-muted/20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 mb-3 border-primary/30 text-primary">
            Trải Nghiệm Tương Tác Trực Tuyến
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Thử Nghiệm Sandbox BYOK Ngay Tại Đây
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Chọn mô hình AI bạn ưa thích và tương tác với bảng công việc, ma trận Eisenhower hoặc thuật toán cân bằng
            tải nhân sự của SmartTask trước khi đăng nhập.
          </p>
        </div>

        {/* Model Switcher Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm shadow-xs mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Bot className="h-4 w-4 text-primary" />
            <span>Mô hình AI đang kết nối:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(MODELS) as AiModelKey[]).map((key) => {
              const m = MODELS[key];
              const isSelected = selectedModel === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedModel(key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-background border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span>{m.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.provider}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Model Specs Pill */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
            <span>⏱ Tốc độ: <strong className="text-foreground">{currentModel.speed}</strong></span>
            <span>·</span>
            <span>💰 Chi phí: <strong className="text-foreground">{currentModel.cost}</strong></span>
          </div>
        </div>

        {/* Main Sandbox Interactive Box */}
        <div className="rounded-2xl border border-border/80 bg-card shadow-lg overflow-hidden">
          {/* Subheader: View Tabs */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/40">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "kanban"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Bảng Kanban</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("eisenhower")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "eisenhower"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid2X2 className="h-3.5 w-3.5" />
                <span>Ma trận Eisenhower (2x2)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("workload")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "workload"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Scale className="h-3.5 w-3.5" />
                <span>Cân Bằng Tải AI</span>
              </button>
            </div>

            <div className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Socket: Sẵn sàng</span>
            </div>
          </div>

          {/* Tab Content 1: Kanban View */}
          {activeTab === "kanban" && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <p>
                  Nhấp vào từng thẻ task để chuyển trạng thái cột: <strong className="text-foreground">Cần làm → Đang làm → Hoàn thành</strong>
                </p>
                <Badge variant="outline" className="text-[10px]">
                  5 công việc mẫu
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Column 1: Todo */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <span className="text-xs font-bold text-foreground">Cần làm</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {kanbanTasks.filter((t) => t.col === "todo").length}
                    </Badge>
                  </div>
                  {kanbanTasks
                    .filter((t) => t.col === "todo")
                    .map((task) => (
                      <div
                        key={task.id}
                        onClick={() => moveTask(task.id)}
                        className="rounded-lg border border-border/70 bg-card p-3 shadow-xs hover:border-primary/50 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="font-mono font-bold text-muted-foreground">{task.id}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {task.title}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {task.time}
                          </span>
                          <span className="text-primary font-semibold group-hover:underline">Chuyển cột →</span>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Column 2: In Progress */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <span className="text-xs font-bold text-foreground">Đang làm</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {kanbanTasks.filter((t) => t.col === "doing").length}
                    </Badge>
                  </div>
                  {kanbanTasks
                    .filter((t) => t.col === "doing")
                    .map((task) => (
                      <div
                        key={task.id}
                        onClick={() => moveTask(task.id)}
                        className="rounded-lg border border-border/70 bg-card p-3 shadow-xs hover:border-primary/50 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="font-mono font-bold text-muted-foreground">{task.id}</span>
                          <Badge variant="default" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {task.title}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {task.time}
                          </span>
                          <span className="text-emerald-500 font-semibold group-hover:underline">Hoàn thành →</span>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Column 3: Done */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <span className="text-xs font-bold text-foreground">Hoàn thành</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {kanbanTasks.filter((t) => t.col === "done").length}
                    </Badge>
                  </div>
                  {kanbanTasks
                    .filter((t) => t.col === "done")
                    .map((task) => (
                      <div
                        key={task.id}
                        onClick={() => moveTask(task.id)}
                        className="rounded-lg border border-border/70 bg-card p-3 shadow-xs hover:border-primary/50 transition-all cursor-pointer group opacity-90"
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="font-mono font-bold text-muted-foreground">{task.id}</span>
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Đã xong
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-2 line-through text-muted-foreground">
                          {task.title}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {task.time}
                          </span>
                          <span className="text-muted-foreground group-hover:underline">Mở lại ↺</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: Eisenhower Matrix View */}
          {activeTab === "eisenhower" && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <p>
                  Hệ thống tự động xếp thẻ vào <strong className="text-foreground">4 góc phần tư</strong> dựa trên mức độ khẩn cấp và độ ưu tiên.
                </p>
                <Badge variant="outline" className="text-[10px]">
                  Ma trận 2x2 Clean Grid
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Q1: Urgent & Important */}
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Q1: Khẩn cấp &amp; Quan trọng (Làm ngay)
                    </span>
                    <Badge variant="destructive" className="text-[9px] px-1.5">1</Badge>
                  </div>
                  <div className="rounded-lg bg-card border border-border/70 p-2.5 text-xs shadow-xs">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span className="font-mono font-bold">ST-2</span>
                      <span className="text-destructive font-semibold">Hôm nay</span>
                    </div>
                    <p className="font-semibold text-foreground">Xây dựng bảng Kanban kéo thả thời gian thực</p>
                  </div>
                </div>

                {/* Q2: Important Not Urgent */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Q2: Quan trọng &amp; Không khẩn (Lên lịch)
                    </span>
                    <Badge variant="default" className="text-[9px] px-1.5">2</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-lg bg-card border border-border/70 p-2.5 text-xs shadow-xs">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span className="font-mono font-bold">ST-1</span>
                        <span>Đã xong</span>
                      </div>
                      <p className="font-semibold text-foreground">Tích hợp API Gemini &amp; mã hoá AES-256</p>
                    </div>
                    <div className="rounded-lg bg-card border border-border/70 p-2.5 text-xs shadow-xs">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span className="font-mono font-bold">ST-3</span>
                        <span>3 ngày nữa</span>
                      </div>
                      <p className="font-semibold text-foreground">Thuật toán cân bằng tải tránh quá công suất</p>
                    </div>
                  </div>
                </div>

                {/* Q3: Urgent Not Important */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      Q3: Khẩn cấp &amp; Không quan trọng (Ủy quyền)
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1.5 border-amber-500/30">1</Badge>
                  </div>
                  <div className="rounded-lg bg-card border border-border/70 p-2.5 text-xs shadow-xs">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span className="font-mono font-bold">ST-4</span>
                      <span>Ngày mai</span>
                    </div>
                    <p className="font-semibold text-foreground">Ma trận Eisenhower lọc việc khẩn cấp</p>
                  </div>
                </div>

                {/* Q4: Not Urgent Not Important */}
                <div className="rounded-xl border border-muted-foreground/30 bg-muted/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">
                      Q4: Không khẩn &amp; Không quan trọng (Loại bỏ)
                    </span>
                    <Badge variant="secondary" className="text-[9px] px-1.5">1</Badge>
                  </div>
                  <div className="rounded-lg bg-card border border-border/70 p-2.5 text-xs shadow-xs">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span className="font-mono font-bold">ST-5</span>
                      <span>Tuần tới</span>
                    </div>
                    <p className="font-semibold text-foreground">Báo cáo tiến độ Sprint &amp; Burndown Chart</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Workload Balancing AI View */}
          {activeTab === "workload" && (
            <div className="p-4 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    Cân Bằng Công Suất Tuần Bằng {currentModel.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tự động phân bổ công việc theo ma trận kỹ năng cá nhân để triệt tiêu tình trạng kiệt sức (burnout).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {balanceApplied ? (
                    <Button variant="outline" size="sm" onClick={handleResetBalance} className="text-xs h-8">
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Khôi phục ban đầu
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleSimulateBalance}
                      disabled={isBalancing}
                      className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                    >
                      {isBalancing ? (
                        <>
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          <span>{currentModel.name} đang phân tích...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="mr-1.5 h-3.5 w-3.5" />
                          <span>Chạy AI Cân Bằng Tải</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Members Workload Bars */}
              <div className="space-y-4">
                {members.map((m) => (
                  <div key={m.name} className="p-3.5 rounded-xl border border-border/70 bg-background/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px]">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-foreground">{m.name}</span>
                          <span className="text-muted-foreground text-[11px] ml-2 font-mono">({m.role})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span>{m.tasks} tasks ({Math.round((m.load * 40) / 100)}/40h)</span>
                        <Badge
                          variant={m.load > 100 ? "destructive" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {m.load}%
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Progress
                        value={Math.min(m.load, 100)}
                        className={`h-2 ${m.load > 100 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {balanceApplied && (
                <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>
                    <strong>{currentModel.name} thành công:</strong> Đã chuyển 1 task Backend sang Frontend dev tương thích kỹ năng. Cả đội hiện hoạt động ở mức công suất an toàn (85%).
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
