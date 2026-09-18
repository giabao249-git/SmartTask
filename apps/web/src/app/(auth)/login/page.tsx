"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, User, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { describeError } from "@/lib/api";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const next = params.get("next");
  const [email, setEmail] = React.useState("lan@smarttask.local");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ code: string; message: string } | null>(null);

  // Đã có phiên (F5 hoặc quay lại /login) → vào thẳng
  React.useEffect(() => {
    if (auth.status === "authenticated") router.replace(next && next.startsWith("/") ? next : "/workspaces");
  }, [auth.status, next, router]);

  const submit = async (mode: "login" | "register") => {
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === "login" ? await auth.login(email.trim().toLowerCase(), password) : await auth.register(email.trim().toLowerCase(), password, fullName.trim());
      toast.success(`Xin chào ${user.shortName ?? user.fullName}`);
      router.replace(next && next.startsWith("/") ? next : "/workspaces");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  if (auth.status === "loading")
    return (
      <Card className="w-full max-w-md p-6 space-y-4">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    );

  return (
    <Card className="w-full max-w-md shadow-lg border-border/80">
      <CardHeader className="text-center space-y-1.5 pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl mx-auto mb-2">
          ST
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">SmartTask</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Nền tảng quản trị dự án Agile/Kanban & AI Agent cân bằng tải
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4 py-2">
            <AlertTitle className="text-xs font-semibold flex items-center gap-2">
              Không đăng nhập được
              <Badge variant="destructive" className="font-mono text-[10px]">
                {error.code}
              </Badge>
            </AlertTitle>
            <AlertDescription className="text-[11px]">{error.message}</AlertDescription>
          </Alert>
        )}
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login" className="text-xs">
              Đăng nhập
            </TabsTrigger>
            <TabsTrigger value="register" className="text-xs">
              Đăng ký
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit("login");
              }}
              className="space-y-4"
            >
              <Field label="Email" icon={Mail}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 text-xs h-9" required autoComplete="email" />
              </Field>
              <Field label="Mật khẩu" icon={Lock}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 text-xs h-9" required autoComplete="current-password" />
              </Field>
              <Button type="submit" className="w-full text-xs h-9 gap-2" disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                <span>Đăng nhập</span>
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit("register");
              }}
              className="space-y-4"
            >
              <Field label="Họ và tên" icon={User}>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" className="pl-9 text-xs h-9" required />
              </Field>
              <Field label="Email" icon={Mail}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 text-xs h-9" required autoComplete="email" />
              </Field>
              <Field label="Mật khẩu (≥ 8 ký tự)" icon={Lock}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 text-xs h-9" required minLength={8} autoComplete="new-password" />
              </Field>
              <Button type="submit" className="w-full text-xs h-9 gap-2" disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                <span>Tạo tài khoản SmartTask</span>
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex flex-col border-t border-border/40 pt-4 text-center">
        <p className="text-[11px] text-muted-foreground">
          Tài khoản demo: <span className="font-semibold text-foreground">lan@smarttask.local</span> / Demo@1234
        </p>
      </CardFooter>
    </Card>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <React.Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
        <LoginForm />
      </React.Suspense>
    </div>
  );
}
