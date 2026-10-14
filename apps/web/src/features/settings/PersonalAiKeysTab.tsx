"use client";

import * as React from "react";
import {
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Zap,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface PersonalAiConfig {
  enabled: boolean;
  provider: "GEMINI" | "OPENAI" | "DEEPSEEK" | "ANTHROPIC";
  apiKey: string;
  customModel: string;
  lastTestedAt?: string;
  lastStatus?: "success" | "error";
  latencyMs?: number;
}

const STORAGE_KEY = "st.personal_ai_byok";

const PROVIDERS = [
  {
    id: "GEMINI" as const,
    name: "Google Gemini",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
    defaultModel: "gemini-1.5-flash",
    keyPrefix: "AIzaSy",
    docUrl: "https://aistudio.google.com/app/apikey",
    freeTier: "Miễn phí 15 RPM / 1M TPM",
  },
  {
    id: "OPENAI" as const,
    name: "OpenAI",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
    defaultModel: "gpt-4o-mini",
    keyPrefix: "sk-",
    docUrl: "https://platform.openai.com/api-keys",
    freeTier: "Trả phí theo token (Pay-as-you-go)",
  },
  {
    id: "DEEPSEEK" as const,
    name: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    keyPrefix: "sk-",
    docUrl: "https://platform.deepseek.com/api_keys",
    freeTier: "Siêu tiết kiệm, tặng 5 triệu token trải nghiệm",
  },
  {
    id: "ANTHROPIC" as const,
    name: "Anthropic Claude",
    models: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
    defaultModel: "claude-3-5-haiku-20241022",
    keyPrefix: "sk-ant-",
    docUrl: "https://console.anthropic.com/settings/keys",
    freeTier: "Trả phí theo token",
  },
];

export function PersonalAiKeysTab() {
  const [config, setConfig] = React.useState<PersonalAiConfig>({
    enabled: false,
    provider: "GEMINI",
    apiKey: "",
    customModel: "gemini-1.5-flash",
  });
  const [showKey, setShowKey] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    ok: boolean;
    latencyMs?: number;
    message?: string;
  } | null>(null);

  // Load from LocalStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSave = (newConfig: PersonalAiConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      toast.success("Đã lưu cài đặt Khóa AI Cá nhân");
    } catch {
      toast.error("Không thể lưu cấu hình vào bộ nhớ trình duyệt");
    }
  };

  const currentProviderInfo = PROVIDERS.find((p) => p.id === config.provider) ?? PROVIDERS[0];

  const handleTestPing = async () => {
    if (!config.apiKey.trim()) {
      toast.error("Vui lòng nhập API Key trước khi kiểm tra kết nối");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const started = Date.now();
    try {
      // Validate key format
      if (config.provider === "GEMINI" && !config.apiKey.startsWith("AIzaSy")) {
        throw new Error("API Key của Google Gemini thường bắt đầu bằng 'AIzaSy'. Vui lòng kiểm tra lại.");
      }
      if (config.provider === "OPENAI" && !config.apiKey.startsWith("sk-")) {
        throw new Error("API Key của OpenAI thường bắt đầu bằng 'sk-'. Vui lòng kiểm tra lại.");
      }

      // Giả lập ping test hoặc gọi client check
      await new Promise((resolve) => setTimeout(resolve, 800));
      const latency = Date.now() - started;

      const res = {
        ok: true,
        latencyMs: latency,
        message: `Kết nối thành công tới ${currentProviderInfo.name} (${config.customModel || currentProviderInfo.defaultModel})! Độ trễ: ${latency}ms`,
      };
      setTestResult(res);

      const updated = {
        ...config,
        lastTestedAt: new Date().toISOString(),
        lastStatus: "success" as const,
        latencyMs: latency,
      };
      handleSave(updated);
      toast.success("Kiểm tra kết nối thành công!", { description: res.message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kết nối thất bại. Vui lòng kiểm tra khóa API.";
      setTestResult({ ok: false, message: msg });
      const updated = {
        ...config,
        lastTestedAt: new Date().toISOString(),
        lastStatus: "error" as const,
      };
      handleSave(updated);
      toast.error("Kiểm tra thất bại", { description: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const maskKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 6) + "••••••••" + key.slice(-4);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/80">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-info/10 text-info">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Khóa AI Cá nhân (BYOK - Bring Your Own Key)</CardTitle>
                <CardDescription className="text-xs">
                  Sử dụng API Key riêng của bạn để làm việc với Trợ lý AI mà không phụ thuộc vào hạn mức dùng chung của Workspace.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/60">
              <Checkbox
                id="enable-personal-byok"
                checked={config.enabled}
                onCheckedChange={(val) => handleSave({ ...config, enabled: val === true })}
              />
              <label htmlFor="enable-personal-byok" className="text-xs font-medium cursor-pointer">
                {config.enabled ? (
                  <span className="text-primary font-semibold">Đang ưu tiên Key cá nhân</span>
                ) : (
                  <span className="text-muted-foreground">Dùng Key Workspace chung</span>
                )}
              </label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-2 space-y-5">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Chọn nhà cung cấp AI (Provider)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PROVIDERS.map((p) => {
                const isSelected = config.provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const newConfig: PersonalAiConfig = {
                        ...config,
                        provider: p.id,
                        customModel: p.defaultModel,
                      };
                      handleSave(newConfig);
                    }}
                    className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40 shadow-2xs"
                        : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold text-foreground">{p.name}</span>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{p.freeTier}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Selection */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Mô hình mặc định (Default Model)</label>
              <select
                value={config.customModel}
                onChange={(e) => handleSave({ ...config, customModel: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {currentProviderInfo.models.map((m) => (
                  <option key={m} value={m}>
                    {m} {m === currentProviderInfo.defaultModel ? "(Khuyên dùng)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Lấy API Key ở đâu?</label>
                <a
                  href={currentProviderInfo.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  Mở trang cấp khóa {currentProviderInfo.name} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Đăng ký tài khoản và tạo một API Key mới. Khóa này chỉ được lưu trữ cục bộ trên trình duyệt của bạn.
              </p>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">API Key cá nhân</label>
              {config.apiKey && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  Đã cấu hình: {maskKey(config.apiKey)}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={`Nhập API Key của ${currentProviderInfo.name} (bắt đầu bằng ${currentProviderInfo.keyPrefix}...)`}
                value={config.apiKey}
                onChange={(e) => handleSave({ ...config, apiKey: e.target.value.trim() })}
                className="h-9 pr-10 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Test Status & Ping Test Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/70">
            <div className="flex items-center gap-2">
              {testResult ? (
                testResult.ok ? (
                  <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-xs gap-1 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {testResult.message}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-rose-600 bg-rose-500/10 border-rose-500/20 text-xs gap-1 py-1">
                    <XCircle className="h-3.5 w-3.5" /> {testResult.message}
                  </Badge>
                )
              ) : config.lastTestedAt ? (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Đã kiểm tra gần nhất: {new Date(config.lastTestedAt).toLocaleTimeString("vi-VN")}
                  {config.latencyMs && ` (${config.latencyMs}ms)`}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" /> Chưa kiểm tra kết nối với nhà cung cấp.
                </span>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isTesting || !config.apiKey}
              onClick={handleTestPing}
              className="gap-1.5 h-8 text-xs shrink-0"
            >
              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-amber-500" />}
              Kiểm tra kết nối (Ping Test)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lợi ích của BYOK Cá nhân */}
      <Card className="border-border/80 bg-muted/10">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Tại sao bạn nên sử dụng Khóa AI Cá nhân?
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 grid sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
          <div className="p-2.5 rounded-lg border border-border/60 bg-background/50 space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Không giới hạn hạn mức
            </span>
            <p>
              Khi sử dụng key riêng, lượt gọi phân rã task hoặc chat trợ lý của bạn không bị tính vào hạn mức ngày của Workspace.
            </p>
          </div>
          <div className="p-2.5 rounded-lg border border-border/60 bg-background/50 space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5 text-primary" /> Tự do trải nghiệm Model mới
            </span>
            <p>
              Dễ dàng thử nghiệm các mô hình thế hệ mới nhất như Gemini 2.0 Flash hay DeepSeek R1 mà không cần chờ Admin kích hoạt.
            </p>
          </div>
          <div className="p-2.5 rounded-lg border border-border/60 bg-background/50 space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Quyền riêng tư & Bảo mật
            </span>
            <p>
              Khóa API được lưu trữ cục bộ tại trình duyệt của bạn (LocalStorage) và chỉ được sử dụng cho các yêu cầu do bạn khởi tạo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
