"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/app/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  const [email, setEmail] = React.useState("lan.pm@vnpt.vn");
  const [password, setPassword] = React.useState("••••••••••••");
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [forgotOpen, setForgotOpen] = React.useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Đăng nhập thành công! Chào mừng Lan (PM VNPT)");
    router.push("/projects/ST/board");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Đăng ký tài khoản thành công! Đang chuyển hướng...");
    router.push("/workspaces");
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotOpen(false);
    toast.success("Đã gửi hướng dẫn đặt lại mật khẩu qua email", {
      description: `Kiểm tra hộp thư ${forgotEmail || email}`,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative">
      {screenState === "loading" && (
        <Card className="w-full max-w-md p-6 space-y-4">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      )}

      {screenState === "empty" && (
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-base font-semibold">Hệ thống chưa có tài khoản</h3>
          <p className="text-xs text-muted-foreground">
            Vui lòng đăng ký tài khoản Quản trị viên ban đầu để tạo Workspace mới.
          </p>
          <Button onClick={() => setScreenState("data")} className="w-full">
            Đăng ký ngay
          </Button>
        </Card>
      )}

      {screenState === "error" && (
        <div className="w-full max-w-md">
          <ErrorState
            code="INVALID_CREDENTIALS"
            message="Email hoặc mật khẩu không chính xác. Hãy kiểm tra lại hoặc dùng chức năng Quên mật khẩu."
            onRetry={() => setScreenState("data")}
          />
        </div>
      )}

      {screenState === "data" && (
        <Card className="w-full max-w-md shadow-lg border-border/80">
          <CardHeader className="text-center space-y-1.5 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl mx-auto mb-2">
              ST
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              SmartTask
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Nền tảng quản trị dự án Agile/Kanban & AI Agent cân bằng tải
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login" className="text-xs">Đăng nhập</TabsTrigger>
                <TabsTrigger value="register" className="text-xs">Đăng ký</TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Email doanh nghiệp
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="lan.pm@vnpt.vn"
                        className="pl-9 text-xs h-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Mật khẩu
                      </label>
                      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-[11px] text-primary hover:underline"
                          >
                            Quên mật khẩu?
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-base">Đặt lại mật khẩu</DialogTitle>
                            <DialogDescription className="text-xs">
                              Nhập email tài khoản của bạn để nhận liên kết xác thực đặt lại mật khẩu an toàn.
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleForgotSubmit} className="space-y-4 py-2">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">Email</label>
                              <Input
                                type="email"
                                value={forgotEmail || email}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                className="text-xs h-9"
                                required
                              />
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" size="sm" onClick={() => setForgotOpen(false)}>
                                Hủy
                              </Button>
                              <Button type="submit" size="sm">
                                Gửi mã xác nhận
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 text-xs h-9 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full text-xs h-9 gap-2">
                    <span>Đăng nhập</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </TabsContent>

              {/* Register Form */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Họ và tên</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Nguyễn Văn A"
                        className="pl-9 text-xs h-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Email công việc</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="ten@vnpt.vn"
                        className="pl-9 text-xs h-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Mật khẩu mới</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="Tối thiểu 8 ký tự"
                        className="pl-9 text-xs h-9"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full text-xs h-9 gap-2">
                    <span>Tạo tài khoản SmartTask</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="flex flex-col border-t border-border/40 pt-4 text-center">
            <p className="text-[11px] text-muted-foreground">
              Tài khoản mẫu: <span className="font-semibold text-foreground">lan.pm@vnpt.vn</span> (PM dự án)
            </p>
          </CardFooter>
        </Card>
      )}

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
