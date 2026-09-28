"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, CheckCircle2, ChevronDown, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillLevel } from "@/components/app/SkillLevel";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useSkillEvidence } from "@/lib/hooks/analytics";
import { confidenceLabel, projectRoleLabel } from "@/lib/status";
import type { EvidenceItemView, MemberProfileView, SkillEvidenceView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dm, pct, vn } from "./format";

/** "mức 3" / "chưa đạt (2 phải làm lại)" / "chưa đủ bằng chứng" — mức 0 không bao giờ in trần là "0" */
export function levelText(s: Pick<SkillEvidenceView, "level" | "failed" | "confidence">): string {
  if (s.confidence === "none") return "chưa có bằng chứng";
  if (s.level > 0) return `mức ${s.level}`;
  return s.failed ? `chưa đạt (${s.failed} phải làm lại)` : "chưa đủ bằng chứng";
}

/**
 * Hồ sơ một thành viên (docs 02/08): kỹ năng TỪ BẰNG CHỨNG, mở ra xem các việc làm nên mức; hiệu suất diễn giải
 * bằng lời. Mức tự khai chỉ đứng cạnh để đối chiếu, không bao giờ là con số chính.
 */
export function MemberProfile({ projectId, member, self }: { projectId: string; member: MemberProfileView; self?: boolean }) {
  const proven = member.skills.filter((s) => s.confidence !== "none");
  const claimed = member.skills.filter((s) => s.confidence === "none");
  const p = member.performance;
  return (
    <div className="space-y-5 text-xs">
      {!self && (
        <div className="flex items-center gap-3">
          <UserAvatar name={member.shortName ?? member.fullName} avatar={member.avatarUrl ?? undefined} size="lg" showTooltip={false} />
          <div>
            <p className="text-base font-semibold text-foreground">{member.fullName}</p>
            <p className="text-muted-foreground">{projectRoleLabel(member.role)}</p>
          </div>
        </div>
      )}

      {p && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Hiệu suất {p.windowWeeks} tuần gần nhất</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Fact label="Việc đã xong" value={String(p.doneTasks)} />
            <Fact
              label="Xong đúng hạn"
              value={p.onTimeRate == null ? "—" : pct(p.onTimeRate)}
              hint={p.onTimeRate == null ? "chưa có việc có hạn" : undefined}
              tone={p.onTimeRate != null && p.onTimeRate < 0.6 ? "warning" : undefined}
            />
            <Fact label="Đánh giá trung bình" value={p.avgRating == null ? "—" : `${vn(p.avgRating)}/5`} hint={p.avgRating == null ? "PM chưa đánh giá việc nào" : undefined} />
            <Fact label="Thực tế so với ước lượng" value={`×${vn(p.ear, 2)}`} hint={p.ear > 1.15 ? "thường tốn hơn ước lượng" : p.ear < 0.85 ? "thường nhanh hơn ước lượng" : "sát ước lượng"} />
            <Fact label="Phải làm lại (mở lại)" value={String(p.reopenCount)} tone={p.reopenCount ? "warning" : undefined} />
            <Fact label="Đang mở" value={String(p.openTasks)} hint={p.overdueOpen ? `${p.overdueOpen} việc quá hạn` : undefined} tone={p.overdueOpen ? "danger" : undefined} />
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3" /> Chỉ {self ? "bạn" : "người này"} và PM thấy phần hiệu suất.
          </p>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Kỹ năng theo việc đã làm</h3>
        <p className="text-muted-foreground">Tính từ việc đã xong có yêu cầu kỹ năng, đánh giá của PM, số lần phải làm lại và xác nhận của PM — 26 tuần gần nhất. Trợ lý AI chia việc theo phần này.</p>
        {proven.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/80 px-3 py-2.5 text-muted-foreground">
            Chưa có việc nào đã xong có gắn kỹ năng. Khi việc được gắn &quot;Kỹ năng yêu cầu&quot; và làm xong, mức sẽ hiện ở đây.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {proven.map((s) => (
              <SkillRow key={s.skillId} projectId={projectId} userId={member.id} skill={s} />
            ))}
          </ul>
        )}
      </section>

      {claimed.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Tự khai, chưa có việc làm chứng</h3>
          <div className="flex flex-wrap gap-1.5">
            {claimed.map((s) => (
              <Badge key={s.skillId} variant="outline" className="font-normal text-[11px]">
                {s.name} · tự khai {s.declared}
              </Badge>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Không dùng để chia việc. PM có thể xác nhận mức ở tab Kỹ năng nhóm, hoặc giao một việc nhỏ để có bằng chứng.</p>
        </section>
      )}
    </div>
  );
}

function Fact({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warning" | "danger" }) {
  return (
    <div className="rounded-md border border-border/70 px-2.5 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums text-foreground", tone === "danger" && "text-destructive")}>{value}</div>
      {hint && <div className={cn("text-[11px] text-muted-foreground", tone === "warning" && "text-foreground")}>{hint}</div>}
    </div>
  );
}

function SkillRow({ projectId, userId, skill }: { projectId: string; userId: string; skill: SkillEvidenceView }) {
  const [open, setOpen] = React.useState(false);
  return (
    <li className="rounded-md border border-border/70">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          {/* Button mặc định whitespace-nowrap → chữ bằng chứng dài tràn ra ngoài ngăn; ép xuống dòng */}
          <Button variant="ghost" className="h-auto w-full items-start justify-start gap-3 whitespace-normal px-3 py-2 text-left font-normal">
            <span className="flex w-28 shrink-0 flex-col gap-1 sm:w-36">
              <span className="truncate text-xs font-medium text-foreground">{skill.name}</span>
              {skill.level > 0 && <SkillLevel level={skill.level} />}
            </span>
            <span className="min-w-0 flex-1 text-xs text-foreground">
              <span className="font-medium">{levelText(skill)}</span>
              {skill.verified && <BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-success" aria-label="PM đã xác nhận" />}
              <span className="block text-muted-foreground">
                {skill.evidence}
                {skill.declared != null ? ` · tự khai ${skill.declared}` : ""}
              </span>
            </span>
            <ChevronDown className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>{open && <EvidenceList projectId={projectId} userId={userId} skill={skill} />}</CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function EvidenceList({ projectId, userId, skill }: { projectId: string; userId: string; skill: SkillEvidenceView }) {
  const q = useSkillEvidence(projectId, userId, skill.skillId);
  if (q.isPending) return <Skeleton className="mx-3 mb-3 h-12" />;
  if (q.isError || !q.data) return <p className="px-3 pb-3 text-destructive">Không tải được bằng chứng.</p>;
  return (
    <div className="space-y-1 border-t border-border/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{confidenceLabel(skill.confidence)} · đạt mức L khi số việc đạt ≥ 1 và nhiều hơn số việc phải làm lại ở mức đó</p>
      <ul className="space-y-1">
        {q.data.map((e, i) => (
          <li key={i} className="flex items-start gap-2">
            {e.passed ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-label="Đạt" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Phải làm lại" />
            )}
            <span className="flex-1 min-w-0">
              {e.task ? (
                <Link href={`/projects/${projectId}/tasks/${e.task.key}`} className="hover:underline">
                  <span className="font-mono text-muted-foreground mr-1">{e.task.key}</span>
                  {e.task.title}
                </Link>
              ) : (
                <span>PM xác nhận mức {e.required}</span>
              )}
              <span className="block text-[11px] text-muted-foreground">{evidenceWhy(e)}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{dm(e.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function evidenceWhy(e: EvidenceItemView): string {
  if (e.source === "verified") return "tính một việc đạt";
  const parts = [
    `yêu cầu mức ${e.required}${e.demonstrated > e.required ? ` · làm tốt việc khó hơn → thể hiện mức ${e.demonstrated}` : ""}`,
    e.rating != null ? `PM đánh giá ${e.rating}/5` : "chưa đánh giá (tính nửa)",
    e.reopened ? `bị mở lại ${e.reopened} lần` : null,
    e.bugs ? `sinh ${e.bugs} bug` : null,
    e.weight < 1 && e.rating != null ? "làm chung (chia phần)" : null,
  ];
  return parts.filter(Boolean).join(" · ");
}
