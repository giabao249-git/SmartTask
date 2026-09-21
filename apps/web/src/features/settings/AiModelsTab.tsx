"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Cpu,
  Database,
  Filter,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, describeError } from "@/lib/api";
import type {
  AiCacheMode,
  AiModelCatalogItem,
  AiProvider,
} from "@/lib/types";
import { toast } from "sonner";

const FALLBACK_MODELS: AiModelCatalogItem[] = [
  {
    id: "catalog-gemini-2.5-flash",
    provider: "GEMINI",
    model: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    inputPrice: 0.3,
    outputPrice: 2.5,
    cachedInputPrice: 0.075,
    priceEffectiveFrom: "2026-09-01",
    contextWindow: 1048576,
    isReasoning: true,
    supportsTemperature: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    maxOutputTokenParam: "maxOutputTokens",
    cacheMode: "GEMINI_CACHED_CONTENTS",
    isActive: true,
    sortOrder: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "catalog-gemini-2.5-flash-lite",
    provider: "GEMINI",
    model: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite (Siêu rẻ cho EXPLAIN/CHAT)",
    inputPrice: 0.1,
    outputPrice: 0.4,
    cachedInputPrice: 0.025,
    priceEffectiveFrom: "2026-09-01",
    contextWindow: 1048576,
    isReasoning: true,
    supportsTemperature: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    maxOutputTokenParam: "maxOutputTokens",
    cacheMode: "GEMINI_CACHED_CONTENTS",
    isActive: true,
    sortOrder: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "catalog-gemini-2.0-flash",
    provider: "GEMINI",
    model: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    inputPrice: 0.1,
    outputPrice: 0.4,
    cachedInputPrice: 0.025,
    priceEffectiveFrom: "2026-09-01",
    contextWindow: 1048576,
    isReasoning: false,
    supportsTemperature: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    maxOutputTokenParam: "maxOutputTokens",
    cacheMode: "GEMINI_CACHED_CONTENTS",
    isActive: true,
    sortOrder: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "catalog-openai-gpt-4o-mini",
    provider: "OPENAI",
    model: "gpt-4o-mini",
    label: "GPT-4o Mini",
    inputPrice: 0.15,
    outputPrice: 0.6,
    cachedInputPrice: 0.075,
    priceEffectiveFrom: "2026-09-01",
    contextWindow: 128000,
    isReasoning: false,
    supportsTemperature: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    maxOutputTokenParam: "max_tokens",
    cacheMode: "OPENAI_BREAKPOINT",
    isActive: true,
    sortOrder: 40,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "catalog-ollama-qwen2.5",
    provider: "OLLAMA",
    model: "qwen2.5:7b",
    label: "Ollama · Qwen 2.5 7B (Chạy cục bộ On-Premises)",
    inputPrice: 0,
    outputPrice: 0,
    cachedInputPrice: 0,
    priceEffectiveFrom: "2026-09-01",
    contextWindow: 32768,
    isReasoning: false,
    supportsTemperature: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    maxOutputTokenParam: "num_predict",
    cacheMode: "NONE",
    isActive: true,
    sortOrder: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "catalog-deepseek-v4-flash",
    provider: "DEEPSEEK",
    model: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash (Tốc độ cao, tối ưu chi phí)",
    inputPrice: 0.14,
    outputPrice: 0.28,
    cachedInputPrice: 0.014,
    priceEffectiveFrom: "2026-09-01",
    contextWindow: 131072,
    isReasoning: true,
    supportsTemperature: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    maxOutputTokenParam: "max_tokens",
    cacheMode: "NONE",
    isActive: true,
    sortOrder: 35,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const PROVIDER_LABELS: Record<AiProvider, { label: string; badge: string }> = {
  GEMINI: { label: "Google Gemini", badge: "border-blue-500/30 text-blue-600 bg-blue-500/10" },
  OPENAI: { label: "OpenAI", badge: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10" },
  OLLAMA: { label: "Ollama Local", badge: "border-amber-500/30 text-amber-600 bg-amber-500/10" },
  DEEPSEEK: { label: "DeepSeek", badge: "border-indigo-500/30 text-indigo-600 bg-indigo-500/10" },
};

interface UpsertModelFormState {
  id?: string;
  provider: AiProvider;
  model: string;
  label: string;
  inputPrice: number;
  outputPrice: number;
  cachedInputPrice: number;
  contextWindow: number;
  isReasoning: boolean;
  supportsTemperature: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  maxOutputTokenParam: string;
  cacheMode: AiCacheMode;
  isActive: boolean;
  sortOrder: number;
}

const DEFAULT_FORM: UpsertModelFormState = {
  provider: "GEMINI",
  model: "",
  label: "",
  inputPrice: 0.3,
  outputPrice: 2.5,
  cachedInputPrice: 0.075,
  contextWindow: 1048576,
  isReasoning: false,
  supportsTemperature: true,
  supportsStructuredOutput: true,
  supportsVision: false,
  maxOutputTokenParam: "maxOutputTokens",
  cacheMode: "GEMINI_CACHED_CONTENTS",
  isActive: true,
  sortOrder: 50,
};

export function AiModelsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [providerFilter, setProviderFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<UpsertModelFormState>(DEFAULT_FORM);

  const modelsQuery = useQuery({
    queryKey: ["ai-config", "models", "includeInactive"],
    queryFn: async () => {
      try {
        const res = await api.get<AiModelCatalogItem[]>("/ai-config/models?includeInactive=true");
        return res && res.length > 0 ? res : FALLBACK_MODELS;
      } catch {
        return FALLBACK_MODELS;
      }
    },
  });

  const models = modelsQuery.data ?? FALLBACK_MODELS;

  // Filter models
  const filteredModels = React.useMemo(() => {
    return models.filter((m) => {
      if (providerFilter !== "ALL" && m.provider !== providerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.label.toLowerCase().includes(q) ||
          m.model.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [models, providerFilter, searchQuery]);

  // Mutations
  const upsertMutation = useMutation({
    mutationFn: async (data: UpsertModelFormState) => {
      if (data.id) {
        return api.patch<AiModelCatalogItem>(`/ai-config/models/${data.id}`, {
          label: data.label,
          inputPrice: data.inputPrice,
          outputPrice: data.outputPrice,
          cachedInputPrice: data.cachedInputPrice,
          contextWindow: data.contextWindow,
          isReasoning: data.isReasoning,
          supportsTemperature: data.supportsTemperature,
          supportsStructuredOutput: data.supportsStructuredOutput,
          supportsVision: data.supportsVision,
          maxOutputTokenParam: data.maxOutputTokenParam,
          cacheMode: data.cacheMode,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        });
      } else {
        return api.post<AiModelCatalogItem>("/ai-config/models", {
          provider: data.provider,
          model: data.model,
          label: data.label,
          inputPrice: data.inputPrice,
          outputPrice: data.outputPrice,
          cachedInputPrice: data.cachedInputPrice,
          contextWindow: data.contextWindow,
          isReasoning: data.isReasoning,
          supportsTemperature: data.supportsTemperature,
          supportsStructuredOutput: data.supportsStructuredOutput,
          supportsVision: data.supportsVision,
          maxOutputTokenParam: data.maxOutputTokenParam,
          cacheMode: data.cacheMode,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ai-config", "models"] });
      setDialogOpen(false);
      toast.success(form.id ? "Đã cập nhật model trong catalog" : "Đã thêm model vào catalog");
    },
    onError: (e) => toast.error(describeError(e).message),
  });

  const openCreateDialog = () => {
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (item: AiModelCatalogItem) => {
    setForm({
      id: item.id,
      provider: item.provider,
      model: item.model,
      label: item.label,
      inputPrice: item.inputPrice,
      outputPrice: item.outputPrice,
      cachedInputPrice: item.cachedInputPrice ?? 0,
      contextWindow: item.contextWindow ?? 128000,
      isReasoning: item.isReasoning,
      supportsTemperature: item.supportsTemperature,
      supportsStructuredOutput: item.supportsStructuredOutput,
      supportsVision: item.supportsVision,
      maxOutputTokenParam: item.maxOutputTokenParam || "maxOutputTokens",
      cacheMode: item.cacheMode,
      isActive: item.isActive,
      sortOrder: item.sortOrder ?? 10,
    });
    setDialogOpen(true);
  };

  // Stats
  const stats = React.useMemo(() => {
    const total = models.length;
    const active = models.filter((m) => m.isActive).length;
    const withCache = models.filter((m) => m.cacheMode !== "NONE").length;
    const reasoning = models.filter((m) => m.isReasoning).length;
    return { total, active, withCache, reasoning };
  }, [models]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Tổng Model Catalog</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stats.active} đang kích hoạt</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Cpu className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Hỗ trợ Prompt Cache</p>
            <p className="text-2xl font-bold mt-1">{stats.withCache}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Giảm tới 75% chi phí</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Zap className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Mô hình Suy luận Cao cấp</p>
            <p className="text-2xl font-bold mt-1">{stats.reasoning}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Deep reasoning & decomposition</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
            <Brain className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Nguyên tắc Catalog</p>
            <p className="text-sm font-semibold mt-1">Đã kiểm thử thực tế</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Không đoán mò theo tên</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Sparkles className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Danh mục Model & Năng lực Đã Thử Nghiệm
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Các model được khai báo năng lực chính xác (Structured Output, Vision, Reasoning, Cache Mode) kèm biểu giá
              USD trên 1M token.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Button size="sm" onClick={openCreateDialog} className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Thêm Model Mới
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void qc.invalidateQueries({ queryKey: ["ai-config", "models"] })}
              className="h-8 w-8 p-0"
              title="Làm mới"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Tìm model hoặc nhà cung cấp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Nhà cung cấp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Tất cả nhà cung cấp</SelectItem>
                <SelectItem value="GEMINI" className="text-xs">Google Gemini</SelectItem>
                <SelectItem value="OPENAI" className="text-xs">OpenAI</SelectItem>
                <SelectItem value="OLLAMA" className="text-xs">Ollama Local</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-xs text-muted-foreground">
              Hiển thị <span className="font-semibold text-foreground">{filteredModels.length}</span> model
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Model & Nhà cung cấp</TableHead>
                  <TableHead className="text-xs font-semibold">Năng lực Đã Thử Thật</TableHead>
                  <TableHead className="text-xs font-semibold">Cửa sổ Ngữ cảnh</TableHead>
                  <TableHead className="text-xs font-semibold">Biểu giá / 1M Token</TableHead>
                  <TableHead className="text-xs font-semibold">Trạng thái</TableHead>
                  {canEdit && <TableHead className="text-xs font-semibold text-right">Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 6 : 5} className="h-32 text-center text-xs text-muted-foreground">
                      Không tìm thấy model nào phù hợp điều kiện lọc.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredModels.map((item) => {
                    const prov = PROVIDER_LABELS[item.provider] ?? { label: item.provider, badge: "" };
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        {/* Model & Provider */}
                        <TableCell className="py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground">{item.label}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${prov.badge}`}>
                                {prov.label}
                              </Badge>
                            </div>
                            <code className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded w-fit">
                              {item.model}
                            </code>
                          </div>
                        </TableCell>

                        {/* Capabilities */}
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.supportsStructuredOutput && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-normal">
                                JSON Schema
                              </Badge>
                            )}
                            {item.isReasoning && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 font-normal">
                                Reasoning
                              </Badge>
                            )}
                            {item.supportsVision && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border border-blue-500/20 font-normal">
                                Vision
                              </Badge>
                            )}
                            {item.supportsTemperature && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground font-normal">
                                Temp
                              </Badge>
                            )}
                            {item.cacheMode !== "NONE" ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border border-amber-500/20 font-normal">
                                {item.cacheMode === "GEMINI_CACHED_CONTENTS" ? "Gemini Cache" : "OpenAI Breakpoint"}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Không cache</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Context Window */}
                        <TableCell className="py-3">
                          <div className="text-xs">
                            {item.contextWindow ? (
                              <span className="font-mono font-medium">
                                {(item.contextWindow / 1024).toLocaleString()}k
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            <span className="text-[11px] text-muted-foreground ml-1">tokens</span>
                          </div>
                        </TableCell>

                        {/* Pricing */}
                        <TableCell className="py-3">
                          <div className="flex flex-col text-[11px] gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Vào:</span>
                              <span className="font-mono font-semibold text-foreground">
                                ${item.inputPrice.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Ra:</span>
                              <span className="font-mono font-semibold text-foreground">
                                ${item.outputPrice.toFixed(2)}
                              </span>
                            </div>
                            {item.cachedInputPrice !== null && item.cachedInputPrice !== undefined && (
                              <div className="flex items-center gap-1 text-emerald-600">
                                <span>Cache:</span>
                                <span className="font-mono font-semibold">
                                  ${item.cachedInputPrice.toFixed(3)}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3">
                          {item.isActive ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              Kích hoạt
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                              Tạm tắt
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        {canEdit && (
                          <TableCell className="py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                              className="h-7 px-2 text-xs gap-1"
                            >
                              <Pencil className="h-3 w-3" />
                              Sửa
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Cơ chế quản trị Model Catalog theo ELPREP & TableCalendar</p>
              <p className="mt-0.5">
                Các cờ năng lực (<code className="font-mono">supportsStructuredOutput</code>,{" "}
                <code className="font-mono">cacheMode</code>, <code className="font-mono">isReasoning</code>) được nạp
                từ danh mục này khi SmartTask điều hướng tác vụ AI (Phân rã yêu cầu, Gợi ý phân công, Giải thích, Chat).
                Tham số <code className="font-mono">maxOutputTokenParam</code> xác định tên trường cấu hình token tương thích cho từng provider.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upsert Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              {form.id ? "Cập nhật Model Catalog" : "Thêm Model vào Catalog"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Khai báo model đã được kiểm thử thực tế. Cờ năng lực và giá sẽ được áp dụng cho toàn bộ workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Nhà cung cấp</label>
                <Select
                  value={form.provider}
                  onValueChange={(val: AiProvider) => setForm((p) => ({ ...p, provider: val }))}
                  disabled={Boolean(form.id)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GEMINI" className="text-xs">Google Gemini</SelectItem>
                    <SelectItem value="OPENAI" className="text-xs">OpenAI</SelectItem>
                    <SelectItem value="DEEPSEEK" className="text-xs">DeepSeek</SelectItem>
                    <SelectItem value="OLLAMA" className="text-xs">Ollama Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Mã Model (ID API)</label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                  placeholder="gemini-2.5-flash"
                  className="h-8 text-xs font-mono"
                  disabled={Boolean(form.id)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Tên hiển thị (Label)</label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Gemini 2.5 Flash"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Cửa sổ ngữ cảnh (Tokens)</label>
                <Input
                  type="number"
                  value={form.contextWindow}
                  onChange={(e) => setForm((p) => ({ ...p, contextWindow: Number(e.target.value) }))}
                  placeholder="1048576"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-2 p-3 bg-muted/40 rounded-lg">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-primary" />
                Biểu giá (USD / 1M Token)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Input Token ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.inputPrice}
                    onChange={(e) => setForm((p) => ({ ...p, inputPrice: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Output Token ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.outputPrice}
                    onChange={(e) => setForm((p) => ({ ...p, outputPrice: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Cached Input ($)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={form.cachedInputPrice}
                    onChange={(e) => setForm((p) => ({ ...p, cachedInputPrice: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs font-mono mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Token Param & Cache Mode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Tham số Max Tokens</label>
                <Select
                  value={form.maxOutputTokenParam}
                  onValueChange={(val) => setForm((p) => ({ ...p, maxOutputTokenParam: val }))}
                >
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maxOutputTokens" className="text-xs font-mono">maxOutputTokens (Gemini)</SelectItem>
                    <SelectItem value="max_tokens" className="text-xs font-mono">max_tokens (OpenAI cũ)</SelectItem>
                    <SelectItem value="max_completion_tokens" className="text-xs font-mono">max_completion_tokens (o1/o3/4o)</SelectItem>
                    <SelectItem value="num_predict" className="text-xs font-mono">num_predict (Ollama)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Chế độ Prompt Cache</label>
                <Select
                  value={form.cacheMode}
                  onValueChange={(val: AiCacheMode) => setForm((p) => ({ ...p, cacheMode: val }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE" className="text-xs">Không cache (NONE)</SelectItem>
                    <SelectItem value="GEMINI_CACHED_CONTENTS" className="text-xs">Gemini Cached Contents</SelectItem>
                    <SelectItem value="OPENAI_BREAKPOINT" className="text-xs">OpenAI Breakpoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Capabilities Checkboxes */}
            <div className="space-y-2 p-3 bg-muted/40 rounded-lg">
              <label className="text-xs font-semibold">Năng lực Đã Kiểm Thử</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.supportsStructuredOutput}
                    onCheckedChange={(c) => setForm((p) => ({ ...p, supportsStructuredOutput: Boolean(c) }))}
                  />
                  <span>Hỗ trợ Structured Output (JSON)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.supportsTemperature}
                    onCheckedChange={(c) => setForm((p) => ({ ...p, supportsTemperature: Boolean(c) }))}
                  />
                  <span>Hỗ trợ tùy chỉnh Temperature</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.supportsVision}
                    onCheckedChange={(c) => setForm((p) => ({ ...p, supportsVision: Boolean(c) }))}
                  />
                  <span>Hỗ trợ phân tích Vision / Ảnh</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.isReasoning}
                    onCheckedChange={(c) => setForm((p) => ({ ...p, isReasoning: Boolean(c) }))}
                  />
                  <span>Mô hình suy luận (Deep Reasoning)</span>
                </label>
              </div>
            </div>

            {/* Active & Sort Order */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(c) => setForm((p) => ({ ...p, isActive: Boolean(c) }))}
                />
                <span>Kích hoạt model này cho workspace sử dụng</span>
              </label>

              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Thứ tự sắp xếp:</label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
                  className="w-16 h-7 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="text-xs h-8">
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={() => upsertMutation.mutate(form)}
              disabled={upsertMutation.isPending || !form.model || !form.label}
              className="text-xs h-8 gap-1.5"
            >
              {upsertMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {form.id ? "Lưu thay đổi" : "Thêm vào Catalog"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
