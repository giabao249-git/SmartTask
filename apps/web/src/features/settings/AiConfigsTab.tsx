"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Check,
  Cpu,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  TestTube,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { api, describeError } from "@/lib/api";
import type {
  AiConfigItem,
  AiModelCatalogItem,
  AiPurpose,
  AiTestResult,
} from "@/lib/types";
import { toast } from "sonner";

export const PURPOSE_META: Record<
  AiPurpose,
  { label: string; description: string; badgeVariant: "default" | "secondary" | "outline" | "info" | "warning" }
> = {
  GENERAL: {
    label: "Chung (Mặc định)",
    description: "Cấu hình dự phòng khi mục đích cụ thể chưa thiết lập",
    badgeVariant: "secondary",
  },
  DECOMPOSE: {
    label: "Phân rã yêu cầu (WBS)",
    description: "Cần model sáng tạo, context window lớn",
    badgeVariant: "info",
  },
  ASSIGN: {
    label: "Gợi ý phân công",
    description: "Cần model tuân thủ schema chặt, ma trận kỹ năng",
    badgeVariant: "default",
  },
  EXPLAIN: {
    label: "Phân tích rủi ro",
    description: "Giải thích tiến độ sprint và rủi ro quá tải",
    badgeVariant: "warning",
  },
  CHAT: {
    label: "Hội thoại tự nhiên",
    description: "Tương tác đa lượt tại màn Trợ lý AI",
    badgeVariant: "outline",
  },
};

export const PROVIDER_LABEL: Record<string, { label: string; icon: string }> = {
  GEMINI: { label: "Google Gemini", icon: "G" },
  OPENAI: { label: "OpenAI", icon: "O" },
  DEEPSEEK: { label: "DeepSeek", icon: "D" },
  OLLAMA: { label: "Ollama (Local)", icon: "L" },
};

interface AiConfigsTabProps {
  workspaceId: string;
  canEdit: boolean;
}

export function AiConfigsTab({ workspaceId, canEdit }: AiConfigsTabProps) {
  const qc = useQueryClient();
  const configKey = ["workspaces", workspaceId, "ai-configs"];
  const modelsKey = ["ai-config", "models"];

  const configsQuery = useQuery({
    queryKey: configKey,
    queryFn: () => api.get<AiConfigItem[]>(`/workspaces/${workspaceId}/ai-configs`),
  });

  const modelsQuery = useQuery({
    queryKey: modelsKey,
    queryFn: () => api.get<AiModelCatalogItem[]>("/ai-config/models"),
  });

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingConfig, setEditingConfig] = React.useState<AiConfigItem | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [testResults, setTestResults] = React.useState<Record<string, AiTestResult>>({});
  const [testingId, setTestingId] = React.useState<string | null>(null);

  // Form State
  const [name, setName] = React.useState("");
  const [catalogId, setCatalogId] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [purpose, setPurpose] = React.useState<AiPurpose>("GENERAL");
  const [temperature, setTemperature] = React.useState("0.2");
  const [maxOutputTokens, setMaxOutputTokens] = React.useState("4096");
  const [timeoutMs, setTimeoutMs] = React.useState("30000");
  const [isDefault, setIsDefault] = React.useState(false);
  const [isActive, setIsActive] = React.useState(true);
  const [promptCacheEnabled, setPromptCacheEnabled] = React.useState(false);
  const [traceEnabled, setTraceEnabled] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  const resetForm = () => {
    setName("");
    setCatalogId(modelsQuery.data?.[0]?.id ?? "");
    setApiKey("");
    setBaseUrl("");
    setPurpose("GENERAL");
    setTemperature("0.2");
    setMaxOutputTokens("4096");
    setTimeoutMs("30000");
    setIsDefault(false);
    setIsActive(true);
    setPromptCacheEnabled(false);
    setTraceEnabled(false);
    setNotes("");
  };

  const handleOpenCreate = () => {
    resetForm();
    if (modelsQuery.data && modelsQuery.data.length > 0) {
      setCatalogId(modelsQuery.data[0].id);
    }
    setCreateOpen(true);
  };

  const handleOpenEdit = (c: AiConfigItem) => {
    setEditingConfig(c);
    setName(c.name);
    setCatalogId(c.catalogId);
    setApiKey(""); // Không điền lại key cũ
    setBaseUrl(c.baseUrl ?? "");
    setPurpose(c.purpose);
    setTemperature(String(c.advancedParams?.temperature ?? 0.2));
    setMaxOutputTokens(String(c.advancedParams?.maxOutputTokens ?? 4096));
    setTimeoutMs(String(c.timeoutMs ?? 30000));
    setIsDefault(c.isDefault);
    setIsActive(c.isActive);
    setPromptCacheEnabled(Boolean(c.advancedParams?.promptCache?.enabled));
    setTraceEnabled(Boolean(c.advancedParams?.trace?.enabled));
    setNotes(c.notes ?? "");
  };

  // Mutations
  const createMut = useMutation({
    mutationFn: (payload: unknown) => api.post<AiConfigItem>(`/workspaces/${workspaceId}/ai-configs`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: configKey });
      setCreateOpen(false);
      toast.success("Đã thêm cấu hình AI API mới");
    },
    onError: (err) => toast.error(describeError(err).message, { description: describeError(err).code }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.patch<AiConfigItem>(`/ai-configs/${id}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: configKey });
      setEditingConfig(null);
      toast.success("Đã cập nhật cấu hình AI API");
    },
    onError: (err) => toast.error(describeError(err).message, { description: describeError(err).code }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/ai-configs/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: configKey });
      setDeleteId(null);
      toast.success("Đã xoá cấu hình");
    },
    onError: (err) => toast.error(describeError(err).message),
  });

  const testConnection = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api.post<AiTestResult>(`/ai-configs/${id}/test`);
      setTestResults((prev) => ({ ...prev, [id]: res }));
      if (res.ok) {
        toast.success(`Kết nối thành công (${res.latencyMs}ms)`, {
          description: `Model: ${res.model} · Phản hồi: ${res.reply?.slice(0, 50)}`,
        });
      } else {
        toast.error(`Kiểm tra thất bại: ${res.error ?? "Không nhận được phản hồi"}`);
      }
    } catch (e) {
      toast.error(describeError(e).message);
    } finally {
      setTestingId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !catalogId) {
      toast.error("Vui lòng điền tên và chọn model");
      return;
    }

    const payload = {
      name: name.trim(),
      catalogId,
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      purpose,
      advancedParams: {
        temperature: Number(temperature) || 0.2,
        maxOutputTokens: Number(maxOutputTokens) || 4096,
        promptCache: { enabled: promptCacheEnabled },
        trace: { enabled: traceEnabled },
      },
      timeoutMs: Number(timeoutMs) || 30000,
      isDefault,
      isActive,
      notes: notes.trim() || undefined,
    };

    if (editingConfig) {
      updateMut.mutate({ id: editingConfig.id, payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const selectedModel = (modelsQuery.data ?? []).find((m) => m.id === catalogId);
  const configs = configsQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <Card className="border-border/80 bg-card/60">
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Cấu hình AI API theo Mục đích</CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                {configs.length} cấu hình
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Mã hoá khoá API bằng AES-256-GCM. Phân định model cho từng mục đích (Phân rã, Giao việc, Phân tích, Chat) kế thừa từ kiến trúc TableCalendar & ELPREP.
            </CardDescription>
          </div>

          {canEdit && (
            <Button size="sm" onClick={handleOpenCreate} className="h-8 text-xs gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" /> Thêm cấu hình
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-4 pt-0">
          {configsQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : configsQuery.isError ? (
            <ErrorState
              code={describeError(configsQuery.error).code}
              message={describeError(configsQuery.error).message}
              onRetry={() => configsQuery.refetch()}
            />
          ) : configs.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="Chưa có cấu hình AI API riêng cho workspace"
              description="Hệ thống hiện đang sử dụng model Gemini mặc định từ biến môi trường của server. Thêm cấu hình để dùng khoá API riêng hoặc model tùy biến (GPT-4o, Ollama...)."
              actionLabel={canEdit ? "Thêm cấu hình AI đầu tiên" : undefined}
              onAction={canEdit ? handleOpenCreate : undefined}
            />
          ) : (
            <div className="rounded-lg border border-border/70 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40 text-[11px]">
                  <TableRow>
                    <TableHead className="w-[180px]">Mục đích & Tên</TableHead>
                    <TableHead>Nhà cung cấp & Model</TableHead>
                    <TableHead>Khoá API (AES-GCM)</TableHead>
                    <TableHead>Thông số (Temp / Max)</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Kiểm tra kết nối</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs divide-y divide-border/40">
                  {configs.map((c) => {
                    const test = testResults[c.id];
                    const isTesting = testingId === c.id;
                    const meta = PURPOSE_META[c.purpose] ?? PURPOSE_META.GENERAL;

                    return (
                      <TableRow key={c.id} className="hover:bg-muted/30">
                        <TableCell className="align-top py-3">
                          <div className="space-y-1">
                            <Badge variant={meta.badgeVariant} className="text-[10px] px-1.5 py-0">
                              {meta.label}
                            </Badge>
                            <div className="font-semibold text-foreground text-xs">{c.name}</div>
                            {c.isDefault && (
                              <span className="inline-flex items-center text-[10px] text-primary font-medium gap-1">
                                <Check className="h-3 w-3" /> Mặc định
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="align-top py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground">{c.catalog?.label ?? c.catalogId}</span>
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground flex items-center gap-2">
                              <span>{c.catalog?.provider}</span>
                              <span>·</span>
                              <span>{c.catalog?.model}</span>
                            </div>
                            {c.baseUrl && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={c.baseUrl}>
                                Base: <span className="font-mono">{c.baseUrl}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="align-top py-3">
                          <div className="space-y-1">
                            {c.hasApiKey ? (
                              <span className="font-mono text-[11px] text-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/60">
                                {c.apiKeyMasked}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                Dùng khoá hệ thống (.env)
                              </span>
                            )}
                            <div className="text-[10px] text-muted-foreground">
                              Timeout: {c.timeoutMs / 1000}s
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="align-top py-3 font-mono text-[11px] text-muted-foreground">
                          <div>Temp: {c.advancedParams?.temperature ?? 0.2}</div>
                          <div>Max: {c.advancedParams?.maxOutputTokens ?? 4096}</div>
                          {c.advancedParams?.promptCache?.enabled && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-info border-info/40 mt-1">
                              Cache ON
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="align-top py-3">
                          <Badge variant={c.isActive ? "success" : "secondary"} className="text-[10px] px-1.5 py-0">
                            {c.isActive ? "Đang bật" : "Tạm dừng"}
                          </Badge>
                        </TableCell>

                        <TableCell className="align-top py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isTesting || !canEdit}
                              title={canEdit ? "Gọi thử một lượt ngắn tới nhà cung cấp" : "Cần vai OWNER/ADMIN để gọi thử"}
                              onClick={() => testConnection(c.id)}
                              className="h-7 text-xs gap-1"
                            >
                              {isTesting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <TestTube className="h-3 w-3 text-info" />
                              )}
                              <span>Gọi thử</span>
                            </Button>

                            {test && (
                              <div className="text-[10px] text-right font-mono mt-0.5">
                                {test.ok ? (
                                  <span className="text-success flex items-center justify-end gap-1">
                                    <Check className="h-2.5 w-2.5" />
                                    <span>{test.latencyMs}ms · pong</span>
                                  </span>
                                ) : (
                                  <span className="text-destructive truncate max-w-[140px]" title={test.error}>
                                    ✕ {test.error}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="align-top py-3 text-right">
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenEdit(c)} className="text-xs">
                                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Chỉnh sửa
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteId(c.id)}
                                  className="text-xs text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Xoá cấu hình
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Thêm / Sửa Cấu hình */}
      <Dialog
        open={createOpen || Boolean(editingConfig)}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditingConfig(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span>{editingConfig ? "Chỉnh sửa cấu hình AI API" : "Thêm cấu hình AI API mới"}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Khoá bí mật được mã hoá AES-256-GCM trên cơ sở dữ liệu và không thể đọc ngược từ trình duyệt.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Tên gợi nhớ *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Gemini 1.5 Flash Chính thức, OpenAI Fallback, v.v."
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Mục đích sử dụng *</label>
                  <Select value={purpose} onValueChange={(v) => setPurpose(v as AiPurpose)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PURPOSE_META).map(([p, meta]) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Chọn Model từ Catalog *</label>
                  <Select value={catalogId} onValueChange={setCatalogId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Chọn model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(modelsQuery.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.label} ({m.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedModel && (
                <div className="p-2.5 rounded-md bg-muted/40 border border-border/60 text-[11px] space-y-1">
                  <div className="font-medium text-foreground flex items-center justify-between">
                    <span>Năng lực: {selectedModel.label}</span>
                    <Badge variant="outline" className="font-mono text-[9px]">
                      {selectedModel.provider}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground flex-wrap text-[10px]">
                    {selectedModel.isReasoning && <span className="text-info font-medium">✓ Suy luận</span>}
                    {selectedModel.supportsStructuredOutput && <span>✓ JSON Schema</span>}
                    {selectedModel.supportsVision && <span>✓ Thị giác</span>}
                    <span>· Ngữ cảnh: {selectedModel.contextWindow?.toLocaleString() ?? "128k"} tokens</span>
                    <span>· Giá: ${selectedModel.inputPrice}/$ {selectedModel.outputPrice} cho 1M tokens</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-medium text-foreground">
                  Khoá API (API Key) {editingConfig && <span className="text-muted-foreground">(để trống nếu giữ nguyên)</span>}
                </label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={editingConfig ? "••••••••••••••••••••••••" : "Nhập khoá API (sk-... hoặc AIza...)"}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">
                  Base URL tuỳ biến <span className="text-muted-foreground font-normal">(tùy chọn, cho Ollama / Proxy / Azure)</span>
                </label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1 hoặc http://localhost:11434"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Nhiệt độ (Temp)</label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="2"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="h-8 text-xs"
                    disabled={selectedModel?.supportsTemperature === false}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Max Tokens</label>
                  <Input
                    type="number"
                    step="256"
                    value={maxOutputTokens}
                    onChange={(e) => setMaxOutputTokens(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Timeout (ms)</label>
                  <Input
                    type="number"
                    step="1000"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="promptCache"
                    checked={promptCacheEnabled}
                    onCheckedChange={(c) => setPromptCacheEnabled(c === true)}
                    disabled={selectedModel?.cacheMode === "NONE"}
                  />
                  <label htmlFor="promptCache" className="text-xs text-foreground cursor-pointer">
                    Bật Prompt Caching tĩnh (tiết kiệm đến 75% chi phí đầu vào theo TableCalendar)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isDefault"
                    checked={isDefault}
                    onCheckedChange={(c) => setIsDefault(c === true)}
                  />
                  <label htmlFor="isDefault" className="text-xs text-foreground cursor-pointer">
                    Đặt làm cấu hình mặc định cho mục đích này ({PURPOSE_META[purpose].label})
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={(c) => setIsActive(c === true)}
                  />
                  <label htmlFor="isActive" className="text-xs text-foreground cursor-pointer">
                    Kích hoạt sử dụng cấu hình này
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Ghi chú nội bộ</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú về tài khoản, hạn mức thanh toán..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreateOpen(false);
                  setEditingConfig(null);
                }}
              >
                Huỷ
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMut.isPending || updateMut.isPending}
                className="gap-1"
              >
                {(createMut.isPending || updateMut.isPending) && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>{editingConfig ? "Lưu thay đổi" : "Tạo cấu hình"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Xác nhận xoá */}
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">Xoá cấu hình AI API này?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Các yêu cầu thuộc mục đích này sẽ tự động chuyển sang sử dụng cấu hình dự phòng GENERAL hoặc cấu hình mặc định từ server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xoá cấu hình
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
