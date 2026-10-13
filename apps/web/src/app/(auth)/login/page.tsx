"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Check,
  Shield,
  ArrowLeft,
  Sun,
  Moon,
  Sparkles,
  Zap,
  Users2,
  CheckCircle2,
  KeyRound,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BrandIcon, BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/lib/auth";
import { describeError } from "@/lib/api";
import { resolveLandingPath } from "@/lib/landing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Danh sách tài khoản demo đã seed sẵn trong DB
const DEMO_ACCOUNTS = [
  {
    role: "Workspace Owner / PM",
    name: "Nguyễn Thị Lan",
    email: "lan@smarttask.local",
    password: "Demo@1234",
    badge: "OWNER",
    badgeVariant: "default" as const,
    desc: "Toàn quyền quản trị workspace, dự án và cấu hình AI",
  },
  {
    role: "Backend Developer",
    name: "Trần Quang Minh",
    email: "minh@smarttask.local",
    password: "Demo@1234",
    badge: "MEMBER",
    badgeVariant: "secondary" as const,
    desc: "Thực thi công việc kỹ thuật, nhận task & cập nhật tiến độ",
  },
  {
    role: "Platform Admin",
    name: "Bùi Hoàng Long",
    email: "admin@smarttask.local",
    password: "Demo@1234",
    badge: "ADMIN",
    badgeVariant: "destructive" as const,
    desc: "Quản trị nền tảng toàn hệ thống và FinOps",
  },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const next = params.get("next");
  const tabParam = params.get("tab");

  const isRegisterInitial = tabParam === "register";
  const [activeTab, setActiveTab] = React.useState<"login" | "register">(
    isRegisterInitial ? "register" : "login"
  );
  const [email, setEmail] = React.useState(isRegisterInitial ? "" : "lan@smarttask.local");
  const [password, setPassword] = React.useState(isRegisterInitial ? "" : "Demo@1234");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);
  const [agreeTerms, setAgreeTerms] = React.useState(false);
  const [selectedDemoIndex, setSelectedDemoIndex] = React.useState<number | null>(
    isRegisterInitial ? null : 0
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ code: string; message: string } | null>(null);

  // Đã có phiên (F5 hoặc quay lại /login) → vào thẳng nơi đang làm dở
  React.useEffect(() => {
    if (auth.status !== "authenticated") return;
    if (next && next.startsWith("/")) {
      router.replace(next);
      return;
    }
    void resolveLandingPath(auth.workspaces).then((path) => router.replace(path));
  }, [auth.status, auth.workspaces, next, router]);

  // Đánh giá độ mạnh mật khẩu (chế độ đăng ký)
  const passwordStrength = React.useMemo(() => {
    if (!password) return { score: 0, label: "Trống", color: "bg-muted" };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 1, label: "Yếu", color: "bg-destructive" };
    if (score <= 3) return { score: 2, label: "Trung bình", color: "bg-amber-500" };
    return { score: 3, label: "Mạnh", color: "bg-emerald-500" };
  }, [password]);

  const passwordsMatch =
    activeTab !== "register" ||
    (!confirmPassword ? true : password === confirmPassword);

  const fillDemoAccount = (acc: typeof DEMO_ACCOUNTS[0], index: number) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelectedDemoIndex(index);
    setError(null);
    toast.info(`Đã điền tài khoản: ${acc.name} (${acc.role})`);
  };

  const submit = async (mode: "login" | "register") => {
    if (mode === "register" && !agreeTerms) {
      toast.error("Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo mật");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const user =
        mode === "login"
          ? await auth.login(email.trim().toLowerCase(), password)
          : await auth.register(
              email.trim().toLowerCase(),
              password,
              fullName.trim()
            );

      toast.success(`Xin chào ${user.shortName ?? user.fullName}!`);
      router.replace(
        next && next.startsWith("/")
          ? next
          : await resolveLandingPath(auth.workspaces)
      );
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  if (auth.status === "loading") {
    return (
      <Card className="w-full max-w-md p-6 space-y-4 border-border/80 shadow-xl bg-card">
        <Skeleton className="h-10 w-36 mx-auto rounded-lg" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-2xl border-border/70 bg-card/95 backdrop-blur-md">
      <CardHeader className="text-center space-y-2 pb-3 pt-6 flex flex-col items-center">
        <Link href="/" className="hover:opacity-90 transition-opacity mb-1">
          <BrandLogo
            size="lg"
            variant="full"
            showBadge
            badgeText="Agile + AI"
            className="justify-center"
          />
        </Link>
        <CardDescription className="text-xs text-muted-foreground max-w-sm">
          {activeTab === "login"
            ? "Đăng nhập để vào không gian làm việc Agile và điều phối AI"
            : "Tạo tài khoản mới để trải nghiệm quản trị dự án thông minh"}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-2">
        {error && (
          <Alert variant="destructive" className="mb-4 py-2.5 animate-in fade-in duration-200">
            <AlertTitle className="text-xs font-semibold flex items-center justify-between">
              <span>Không thể thực hiện</span>
              <Badge variant="destructive" className="font-mono text-[10px]">
                {error.code}
              </Badge>
            </AlertTitle>
            <AlertDescription className="text-[11px] mt-0.5">{error.message}</AlertDescription>
          </Alert>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const nextMode = v as "login" | "register";
            setActiveTab(nextMode);
            setError(null);
            if (nextMode === "register") {
              if (email.endsWith("@smarttask.local")) setEmail("");
              setPassword("");
              setConfirmPassword("");
              setSelectedDemoIndex(null);
            } else if (nextMode === "login") {
              if (!email) {
                setEmail("lan@smarttask.local");
                setPassword("Demo@1234");
                setSelectedDemoIndex(0);
              }
            }
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4 h-10 p-1 bg-muted/60">
            <TabsTrigger value="login" className="text-xs font-semibold">
              Đăng nhập
            </TabsTrigger>
            <TabsTrigger value="register" className="text-xs font-semibold">
              Đăng ký
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ĐĂNG NHẬP */}
          <TabsContent value="login" className="space-y-4 focus-visible:outline-none">
            {/* Quick Demo Selector */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <KeyRound className="h-3 w-3 text-primary" />
                  Chọn nhanh tài khoản Demo:
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Demo@1234</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DEMO_ACCOUNTS.map((acc, idx) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemoAccount(acc, idx)}
                    className={cn(
                      "flex flex-col items-center justify-center p-1.5 rounded-md border text-center transition-all cursor-pointer",
                      selectedDemoIndex === idx
                        ? "border-primary/60 bg-primary/10 shadow-xs"
                        : "border-border/60 bg-card hover:bg-muted/70 hover:border-border"
                    )}
                    title={acc.desc}
                  >
                    <span className="text-[11px] font-semibold text-foreground truncate w-full">
                      {acc.name.split(" ").slice(-1)[0]}
                    </span>
                    <Badge
                      variant={acc.badgeVariant}
                      className="text-[9px] px-1 py-0 h-3.5 font-mono mt-0.5"
                    >
                      {acc.badge}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit("login");
              }}
              className="space-y-3.5"
            >
              <Field label="Địa chỉ Email" icon={Mail}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedDemoIndex(null);
                  }}
                  className="pl-9 text-xs h-9"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                />
              </Field>

              <Field label="Mật khẩu" icon={Lock}>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setSelectedDemoIndex(null);
                    }}
                    className="pl-9 pr-9 text-xs h-9"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-primary hover:underline text-[11px] font-medium flex items-center gap-1"
                    >
                      <HelpCircle className="h-3 w-3" /> Quên mật khẩu?
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-64 p-3 text-xs space-y-1.5">
                    <p className="font-semibold text-foreground">Chính sách đặt lại mật khẩu</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Để bảo mật dữ liệu công việc, hãy liên hệ <strong>Platform Super Admin</strong> hoặc <strong>Workspace Owner</strong> để cấp lại mật khẩu. Với môi trường thử nghiệm cục bộ, bạn có thể chạy lại <code className="bg-muted px-1 rounded font-mono">npm run api:seed</code> (mật khẩu mặc định: <span className="font-mono text-primary">Demo@1234</span>).
                    </p>
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                type="submit"
                className="w-full text-xs h-9 gap-2 font-semibold shadow-sm transition-all"
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                <span>Đăng nhập vào SmartTask</span>
              </Button>
            </form>
          </TabsContent>

          {/* TAB 2: ĐĂNG KÝ */}
          <TabsContent value="register" className="space-y-4 focus-visible:outline-none">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit("register");
              }}
              className="space-y-3.5"
            >
              <Field label="Họ và tên" icon={User}>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="pl-9 text-xs h-9"
                  required
                />
              </Field>

              <Field label="Email làm việc" icon={Mail}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs h-9"
                  required
                  autoComplete="email"
                  placeholder="ban@congty.com"
                />
              </Field>

              <div className="space-y-1">
                <Field label="Mật khẩu khởi tạo" icon={Lock}>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-9 text-xs h-9"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Tối thiểu 8 ký tự"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="space-y-1 pt-1 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Độ an toàn mật khẩu:</span>
                      <span className="font-semibold text-foreground">
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          passwordStrength.score >= 1 ? passwordStrength.color : "bg-transparent"
                        )}
                      />
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          passwordStrength.score >= 2 ? passwordStrength.color : "bg-transparent"
                        )}
                      />
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          passwordStrength.score >= 3 ? passwordStrength.color : "bg-transparent"
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Field label="Xác nhận lại mật khẩu" icon={Lock}>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      "pl-9 pr-9 text-xs h-9 transition-colors",
                      confirmPassword && (passwordsMatch ? "border-emerald-500/50" : "border-destructive/60")
                    )}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu ở trên"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>

              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <span>Mật khẩu xác nhận chưa trùng khớp</span>
                </p>
              )}

              <label className="flex items-start gap-2 cursor-pointer select-none text-xs text-muted-foreground pt-1">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 mt-0.5"
                  required
                />
                <span className="text-[11px] leading-tight">
                  Tôi đồng ý với{" "}
                  <Link href="#terms" className="text-primary hover:underline">
                    Điều khoản dịch vụ
                  </Link>{" "}
                  và{" "}
                  <Link href="#privacy" className="text-primary hover:underline">
                    Chính sách bảo mật
                  </Link>{" "}
                  của SmartTask.
                </span>
              </label>

              <Button
                type="submit"
                className="w-full text-xs h-9 gap-2 font-semibold shadow-sm transition-all"
                disabled={busy || !agreeTerms || (confirmPassword.length > 0 && !passwordsMatch)}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Tạo tài khoản &amp; Khởi tạo Workspace</span>
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex flex-col border-t border-border/40 py-3 text-center bg-muted/20">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          <span>Bảo mật chuẩn doanh nghiệp · Mã hóa khóa API AES-256</span>
        </div>
      </CardFooter>
    </Card>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [isDark, setIsDark] = React.useState(false);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      setIsDark(true);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground transition-colors">
      {/* LEFT COLUMN: Visual Brand Showcase & Feature highlights (Visible on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-[#090D1A] text-white overflow-hidden border-r border-border/40">
        {/* Ambient mesh background glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-20 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <BrandIcon size={38} />
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-xl tracking-tight text-white">
                Smart<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Task</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase mt-0.5">
                Enterprise Agile OS
              </span>
            </div>
          </Link>
          <Badge
            variant="outline"
            className="border-white/20 bg-white/5 text-white text-[11px] px-2.5 py-0.5 font-medium"
          >
            100% BYOK Model
          </Badge>
        </div>

        {/* Center Content: Value Propositions & Live Preview Card */}
        <div className="relative z-10 space-y-8 my-auto py-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-white max-w-lg">
              Kiến tạo tiến độ vượt bậc với Agile &amp; AI do chính bạn làm chủ.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md">
              Nền tảng quản trị công việc thời gian thực tích hợp AI Agent phân rã yêu cầu, cân bằng tải nhân sự theo kỹ năng với chi phí token gốc siêu rẻ.
            </p>
          </div>

          {/* Interactive Feature Pills */}
          <div className="space-y-3 max-w-md">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                <Zap className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">100% BYOK AI Model</p>
                <p className="text-slate-400 text-[11px]">
                  Cắm API Key Google Gemini, OpenAI hoặc DeepSeek trực tiếp, tiết kiệm tới 95% chi phí so với mô hình thuê bao cố định.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">4 Chế Độ Xem Linh Hoạt</p>
                <p className="text-slate-400 text-[11px]">
                  Chuyển đổi tức thời giữa Bảng Kanban, Danh sách, Timeline Gantt và Ma trận Eisenhower 2x2 đồng bộ thời gian thực qua Socket.IO.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                <Users2 className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Cân Bằng Tải Ma Trận Kỹ Năng</p>
                <p className="text-slate-400 text-[11px]">
                  AI tự động phân tích năng lực nhân sự và đề xuất phân công tối ưu, loại bỏ tình trạng thắt nút cổ chai trong Sprint.
                </p>
              </div>
            </div>
          </div>

          {/* Mini Live Preview Badge */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-900/40 to-slate-900/60 border border-indigo-500/30 max-w-md">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Sprint 1 · Đang diễn ra
              </span>
              <span className="text-indigo-300 font-mono text-[11px]">78% Hoàn thành</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full w-[78%]" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
              <span>12/15 Nhiệm vụ đã giải quyết</span>
              <span className="text-emerald-400 font-medium">AI Rebalance: Cân bằng</span>
            </div>
          </div>
        </div>

        {/* Left Footer: Trust statement */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
          <p>© 2026 SmartTask Platform. Bản quyền thuộc về SmartTask.</p>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-[11px]">AES-256 Encrypted</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: The Auth Container */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 md:p-12 relative overflow-y-auto">
        {/* Top Navbar: Back link & Theme toggle */}
        <div className="flex items-center justify-between w-full max-w-md mx-auto mb-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Về trang chủ</span>
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        {/* Center Card */}
        <div className="my-auto flex items-center justify-center py-4">
          <React.Suspense
            fallback={
              <Card className="w-full max-w-md p-6 space-y-4">
                <Skeleton className="h-10 w-36 mx-auto rounded-lg" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </Card>
            }
          >
            <LoginForm />
          </React.Suspense>
        </div>

        {/* Bottom micro footer for mobile/tablet */}
        <div className="text-center text-[11px] text-muted-foreground mt-4">
          Cần hỗ trợ? Liên hệ quản trị viên qua{" "}
          <a
            href="mailto:support@smarttask.local"
            className="text-primary hover:underline"
          >
            support@smarttask.local
          </a>
        </div>
      </div>
    </div>
  );
}
