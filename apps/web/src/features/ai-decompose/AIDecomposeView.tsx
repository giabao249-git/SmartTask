"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, Check, X, Bot } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/PageHeader";
import { api, describeError, isApiError } from "@/lib/api";
import { useCurrentProject } from "@/lib/hooks/use-project";
import { useSkills, useSprints } from "@/lib/hooks/queries";
import { draftItemToVariant } from "@/lib/status";
import type { ApplyResponse, ProposalView, TurnUsage } from "@/lib/types";
import type { ValidationResult } from "@smarttask/shared";
import { toast } from "sonner";
import { ValidationNote } from "@/features/assistant/ActionCard";
import { makeResolver } from "@/features/assistant/codes";

interface DecomposeResponse {
  proposalId: string | null;
  action: import("@smarttask/shared").StructuredAction;
  validation: ValidationResult | null;
  cached: boolean;
  usage: TurnUsage | null;
}

/** Form phân rã (UC-28, docs 11 §3.11): POST /projects/:id/ai/decompose → bảng xem trước → apply/reject. Chat nhiều lượt ở màn Trợ lý AI. */
export function AIDecomposeView() {
  const project = useCurrentProject();
  const router = useRouter();
  const sprints = useSprints(project.id);
  const skills = useSkills(project.workspaceId);
  const [requirement, setRequirement] = React.useState("");
  const [sprintId, setSprintId] = React.useState<string>(project.activeSprint?.id ?? "__backlog");
  const [detail, setDetail] = React.useState<"coarse" | "normal" | "fine">("normal");
  const [result, setResult] = React.useState<DecomposeResponse | null>(null);
  const [proposal, setProposal] = React.useState<ProposalView | null>(null);
  const [error, setError] = React.useState<{ code: string; message: string } | null>(null);

  const decompose = useMutation({
    mutationFn: () => api.post<DecomposeResponse>(`/projects/${project.id}/ai/decompose`, { requirement: requirement.trim(), sprintId: sprintId === "__backlog" ? undefined : sprintId, detail }),
    onSuccess: async (r) => {
      setError(null);
      setResult(r);
      setProposal(r.proposalId ? await api.get<ProposalView>(`/ai/proposals/${r.proposalId}`) : null);
    },
    onError: (e) => {
      const { code, message } = describeError(e);
      if (code === "AI_QUOTA_EXCEEDED") {
        const d = isApiError(e) ? e.detail<{ used: number; limit: number }>() : undefined;
        toast.error(`Hết hạn mức AI hôm nay${d ? ` (${d.used}/${d.limit})` : ""}`);
      } else if (code === "AI_IN_PROGRESS") toast.warning("Đang có một lượt phân rã chưa xong");
      else setError({ code, message });
    },
  });
  const apply = useMutation({
    mutationFn: () => api.post<ApplyResponse>(`/ai/proposals/${proposal!.id}/apply`, { version: proposal!.version }),
    onSuccess: (r) => {
      setProposal(r.proposal);
      toast.success(`Đã tạo ${r.createdTasks.length} công việc: ${r.createdTasks.map((t) => t.key).join(", ")}`, { action: { label: "Mở Kanban", onClick: () => router.push(`/projects/${project.id}/work`) } });
    },
    onError: (e) => {
      const { code, message } = describeError(e);
      toast.error(code === "PROPOSAL_VALIDATION_FAILED" ? "Đề xuất còn lỗi kiểm tra — sửa trong Trợ lý AI trước khi tạo" : message, { description: code });
    },
  });
  const reject = useMutation({
    mutationFn: () => api.post<void>(`/ai/proposals/${proposal!.id}/reject`, {}),
    onSuccess: () => {
      setProposal(null);
      setResult(null);
      toast.success("Đã từ chối đề xuất");
    },
    onError: (e) => toast.error(describeError(e).message),
  });

  const resolver = makeResolver(proposal?.codeMap, project.members, (sprints.data ?? []).map((s) => ({ id: s.id, name: s.name })), (skills.data ?? []).map((s) => ({ id: s.id, name: s.name })));
  const busy = decompose.isPending || apply.isPending || reject.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`AI phân rã yêu cầu · ${project.key}`}
        description="Mô tả yêu cầu → LLM đề xuất danh sách công việc → hệ thống kiểm trên dữ liệu sống → bạn duyệt mới tạo thật."
        breadcrumbs={[{ label: "Workspace", href: "/workspaces" }, { label: project.name, href: `/projects/${project.id}/dashboard` }, { label: "AI phân rã" }]}
      >
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => router.push(`/projects/${project.id}/assistant${requirement.trim() ? `?prompt=${encodeURIComponent(`Phân rã yêu cầu: ${requirement.trim()}`)}` : ""}`)}>
          <Bot className="h-3.5 w-3.5" /> Chat nhiều lượt
        </Button>
      </PageHeader>

      {!project.canManage && (
        <Alert>
          <AlertTitle className="text-xs">Chỉ PM/quản trị workspace mới phân rã bằng AI</AlertTitle>
          <AlertDescription className="text-[11px]">Bạn có thể xem, nhưng nút gửi bị khoá.</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/80">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-info" /> Yêu cầu
          </CardTitle>
          <CardDescription className="text-xs">20–4.000 ký tự. Ví dụ: &quot;Xây dựng quên mật khẩu qua email: gửi link 15 phút, đặt mật khẩu mới, khoá sau 5 lần sai.&quot;</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <Textarea value={requirement} onChange={(e) => setRequirement(e.target.value)} className="text-xs min-h-[110px]" minLength={20} maxLength={4000} disabled={busy} />
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={sprintId} onValueChange={setSprintId} disabled={busy}>
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__backlog" className="text-xs">
                  Backlog
                </SelectItem>
                {(sprints.data ?? []).filter((s) => s.status !== "CLOSED").map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} · {s.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={detail} onValueChange={(v) => setDetail(v as typeof detail)} disabled={busy}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coarse" className="text-xs">
                  Thô (3–6 task)
                </SelectItem>
                <SelectItem value="normal" className="text-xs">
                  Vừa (5–12)
                </SelectItem>
                <SelectItem value="fine" className="text-xs">
                  Chi tiết (8–25)
                </SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">{requirement.trim().length}/4000</span>
            <Button size="sm" className="ml-auto h-8 text-xs gap-1.5" disabled={!project.canManage || busy || requirement.trim().length < 20} onClick={() => decompose.mutate()}>
              {decompose.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Phân rã
            </Button>
          </div>
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertTitle className="text-xs flex items-center gap-2">
                AI không trả lời được{" "}
                <Badge variant="destructive" className="font-mono text-[10px]">
                  {error.code}
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-[11px]">{error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && result.action.type !== "DECOMPOSE_PROPOSAL" && (
        <Alert>
          <AlertTitle className="text-xs">{result.action.type === "ASK_CLARIFICATION" ? "AI cần làm rõ" : "AI trả lời"}</AlertTitle>
          <AlertDescription className="text-[11px]">
            {result.action.reply}
            {result.action.type === "ASK_CLARIFICATION" && ` — ${result.action.question}`} Bổ sung vào yêu cầu rồi gửi lại, hoặc dùng chat nhiều lượt.
          </AlertDescription>
        </Alert>
      )}

      {proposal && (
        <Card className="border-border/80">
          <CardHeader className="p-4 pb-2 flex-row items-start justify-between space-y-0 gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                Đề xuất {proposal.items.length} công việc
                <Badge variant={draftItemToVariant(proposal.status)} className="text-[10px]">
                  {proposal.status}
                </Badge>
                {result?.cached && (
                  <Badge variant="outline" className="text-[10px]">
                    bản nháp đang mở
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {proposal.action.reply}
                {result?.usage && ` · ${result.usage.model} · ${result.usage.durationMs} ms · ${result.usage.inputTokens + result.usage.outputTokens} token`}
              </CardDescription>
              {proposal.validation && <ValidationNote validation={proposal.validation} />}
            </div>
            {proposal.status === "DRAFT" && (
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" disabled={busy} onClick={() => reject.mutate()}>
                  <X className="h-3.5 w-3.5" /> Từ chối
                </Button>
                <Button size="sm" className="h-8 text-xs gap-1" disabled={busy || !(proposal.validation?.ok ?? true)} onClick={() => apply.mutate()}>
                  <Check className="h-3.5 w-3.5" /> Tạo {proposal.items.length} công việc
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-12">Mã</TableHead>
                  <TableHead className="text-xs">Tiêu đề</TableHead>
                  <TableHead className="text-xs text-right">Giờ</TableHead>
                  <TableHead className="text-xs">Người gợi ý</TableHead>
                  <TableHead className="text-xs">Kỹ năng</TableHead>
                  <TableHead className="text-xs">Sau</TableHead>
                  <TableHead className="text-xs">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposal.items.map((i) => (
                  <TableRow key={i.draftKey} className="text-xs">
                    <TableCell className="font-mono">{i.draftKey}</TableCell>
                    <TableCell>{i.title}</TableCell>
                    <TableCell className="text-right font-mono">{i.estimateHours ?? "—"}</TableCell>
                    <TableCell>{resolver.user(i.assignee)?.name ?? (i.assignee ? i.assignee : <span className="italic text-muted-foreground">chưa giao</span>)}</TableCell>
                    <TableCell className="text-muted-foreground">{(i.skills ?? []).map((s) => resolver.skillLabel(s)).join(", ")}</TableCell>
                    <TableCell className="font-mono">{i.dependsOn?.join(", ")}</TableCell>
                    <TableCell>
                      <Badge variant={draftItemToVariant(i.status)} className="text-[10px]">
                        {i.status === "APPLIED" ? (proposal.applied?.tasks.find((t) => t.draftKey === i.draftKey)?.key ?? "đã tạo") : i.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {proposal.status === "DRAFT" && proposal.validation && !proposal.validation.ok && (
              <p className="text-[11px] text-muted-foreground mt-2">Sửa từng mục (giờ, người, phụ thuộc) ở màn Trợ lý AI rồi duyệt; form này chỉ tạo khi đề xuất qua kiểm tra.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
