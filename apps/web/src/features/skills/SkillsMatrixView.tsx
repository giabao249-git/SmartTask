"use client";

import * as React from "react";
import {
  Plus,
  CheckCircle2,
  ShieldCheck,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/PageHeader";
import { UserAvatar } from "@/components/app/UserAvatar";
import { SkillLevel } from "@/components/app/SkillLevel";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StateToggle, type ScreenState } from "@/components/app/StateToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { MEMBERS } from "@/mocks/members";
import {
  SKILL_DEFINITIONS,
  MEMBER_SKILLS_RATINGS,
  type SkillDefinition,
  type MemberSkillRating,
} from "@/mocks/skills";
import { toast } from "sonner";

export function SkillsMatrixView() {
  const [screenState, setScreenState] = React.useState<ScreenState>("data");
  const [ratings, setRatings] = React.useState<MemberSkillRating[]>(MEMBER_SKILLS_RATINGS);
  const [skills] = React.useState<SkillDefinition[]>(SKILL_DEFINITIONS);
  const [addSkillOpen, setAddSkillOpen] = React.useState(false);
  const [selectedMemberId, setSelectedMemberId] = React.useState(MEMBERS[4].id); // An (Fullstack)
  const [selectedSkillId, setSelectedSkillId] = React.useState(skills[0].id);
  const [selectedLevel, setSelectedLevel] = React.useState("3");
  const [comboboxOpen, setComboboxOpen] = React.useState(false);

  const getRating = (memberId: string, skillId: string) => {
    return ratings.find((r) => r.memberId === memberId && r.skillId === skillId);
  };

  const handleEndorse = (memberId: string, skillId: string) => {
    const member = MEMBERS.find((m) => m.id === memberId);
    const skill = skills.find((s) => s.id === skillId);

    setRatings((prev) =>
      prev.map((r) =>
        r.memberId === memberId && r.skillId === skillId
          ? {
              ...r,
              verified: true,
              verifiedBy: "Lan (PM)",
              verifiedAt: "Vừa xong",
            }
          : r
      )
    );

    toast.success(`PM Lan đã xác nhận kỹ năng ${skill?.name} cho ${member?.name}!`);
  };

  const handleAddSkillRating = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = ratings.find(
      (r) => r.memberId === selectedMemberId && r.skillId === selectedSkillId
    );

    if (existing) {
      setRatings((prev) =>
        prev.map((r) =>
          r.memberId === selectedMemberId && r.skillId === selectedSkillId
            ? { ...r, level: Number(selectedLevel) }
            : r
        )
      );
    } else {
      setRatings((prev) => [
        ...prev,
        {
          memberId: selectedMemberId,
          skillId: selectedSkillId,
          level: Number(selectedLevel),
          verified: false,
        },
      ]);
    }

    setAddSkillOpen(false);
    toast.success("Đã thêm/cập nhật đánh giá kỹ năng cho thành viên");
  };

  const selectedSkillDef = skills.find((s) => s.id === selectedSkillId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ma trận Kỹ năng & Đánh giá Năng lực"
        description="Ma trận phân loại trình độ từ mức 1–5 theo chuẩn màu chart-1..5, phục vụ gán việc tự động và tối ưu cân bằng tải."
        breadcrumbs={[
          { label: "VNPT Dev Team", href: "/workspaces" },
          { label: "SmartTask v1", href: "/projects/ST/dashboard" },
          { label: "Ma trận kỹ năng" },
        ]}
      >
        <div className="flex items-center gap-2">
          {/* Add / Update Skill Dialog */}
          <Dialog open={addSkillOpen} onOpenChange={setAddSkillOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Thêm kỹ năng thành viên
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">
                  Cập nhật đánh giá kỹ năng
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Chọn thành viên, tra cứu kỹ năng (hỗ trợ alias viết tắt) và chỉ định mức 1–5.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddSkillRating} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Thành viên</label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBERS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Combobox with Aliases */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Kỹ năng (Tìm kiếm theo tên hoặc alias)
                  </label>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-9 text-xs"
                      >
                        {selectedSkillDef ? selectedSkillDef.name : "Chọn kỹ năng..."}
                        <Search className="h-3.5 w-3.5 opacity-50 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Tìm 'Next', 'pg', 'SQL', 'TS'..." />
                        <CommandList>
                          <CommandEmpty>Không tìm thấy kỹ năng</CommandEmpty>
                          <CommandGroup heading="Kỹ năng công nghệ">
                            {skills.map((sk) => (
                              <CommandItem
                                key={sk.id}
                                value={`${sk.name} ${sk.aliases.join(" ")}`}
                                onSelect={() => {
                                  setSelectedSkillId(sk.id);
                                  setComboboxOpen(false);
                                }}
                                className="cursor-pointer flex flex-col items-start py-2"
                              >
                                <span className="font-medium text-xs">{sk.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  Alias: {sk.aliases.join(", ")}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Trình độ đánh giá (Mức 1 đến 5)
                  </label>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Mức 1 — Cơ bản / Đang học</SelectItem>
                      <SelectItem value="2">Mức 2 — Tự tin làm việc với hỗ trợ</SelectItem>
                      <SelectItem value="3">Mức 3 — Thành thạo độc lập</SelectItem>
                      <SelectItem value="4">Mức 4 — Chuyên sâu / Hướng dẫn người khác</SelectItem>
                      <SelectItem value="5">Mức 5 — Chuyên gia / Kiến trúc sư</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAddSkillOpen(false)}>
                    Hủy
                  </Button>
                  <Button type="submit" size="sm">
                    Lưu đánh giá
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {screenState === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {screenState === "empty" && (
        <EmptyState
          title="Chưa có ma trận kỹ năng"
          description="Khởi tạo bảng kỹ năng để AI Agent có thể đối chiếu năng lực khi phân rã yêu cầu phần mềm."
          actionLabel="Tải bộ kỹ năng chuẩn VNPT"
          onAction={() => setScreenState("data")}
        />
      )}

      {screenState === "error" && (
        <ErrorState
          code="SKILL_MERGE_SAME"
          message="Không thể cập nhật kỹ năng do xung đột định danh trong danh mục kỹ năng của workspace."
          onRetry={() => setScreenState("data")}
        />
      )}

      {screenState === "data" && (
        <Card className="shadow-xs overflow-hidden border-border/80">
          <CardHeader className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">
                Bảng đối chiếu Kỹ năng thành viên (Người × Kỹ năng)
              </CardTitle>
              <CardDescription className="text-xs">
                Mức 1–5: Mức 1 (Chart-1) → Mức 5 (Chart-5). PM bấm nút ✓ để xác nhận trình độ.
              </CardDescription>
            </div>

            {/* Color Legend */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-[hsl(var(--chart-1))]" />
                1 (Cơ bản)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-[hsl(var(--chart-2))]" />
                2
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-[hsl(var(--chart-3))]" />
                3 (Thành thạo)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-[hsl(var(--chart-4))]" />
                4
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-[hsl(var(--chart-5))]" />
                5 (Chuyên gia)
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table className="min-w-[960px]">
                <TableHeader className="bg-muted/40 text-xs">
                  <TableRow>
                    <TableHead className="min-w-[180px]">Thành viên</TableHead>
                    {skills.map((sk) => (
                      <TableHead key={sk.id} className="min-w-[120px] text-center">
                        <div className="flex flex-col items-center">
                          <span>{sk.name}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {sk.category}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody className="text-xs">
                  {MEMBERS.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/40 transition-colors">
                      {/* Member Info */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={member.name}
                            avatar={member.avatar}
                            role={member.role}
                            initials={member.initials}
                            isOnline={member.isOnline}
                            size="sm"
                            showTooltip={false}
                          />
                          <div>
                            <p className="font-semibold text-foreground">{member.name}</p>
                            <p className="text-[10px] text-muted-foreground">{member.role}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Skill columns */}
                      {skills.map((sk) => {
                        const rating = getRating(member.id, sk.id);

                        return (
                          <TableCell key={sk.id} className="text-center p-2">
                            {rating ? (
                              <div className="flex flex-col items-center gap-1">
                                <SkillLevel level={rating.level} showText={true} />

                                <div className="flex items-center gap-1 mt-0.5">
                                  {rating.verified ? (
                                    <Badge
                                      variant="success"
                                      className="text-[9px] py-0 px-1 font-normal gap-0.5 cursor-help"
                                      title={`Đã được xác nhận bởi ${rating.verifiedBy || "PM"}`}
                                    >
                                      <CheckCircle2 className="h-2.5 w-2.5" />
                                      Đã duyệt
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEndorse(member.id, sk.id)}
                                      className="h-5 px-1.5 text-[9px] gap-0.5 text-primary hover:bg-primary/10 border-primary/40"
                                      title="PM bấm để xác nhận kỹ năng này"
                                    >
                                      <ShieldCheck className="h-2.5 w-2.5" />
                                      Xác nhận
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <StateToggle state={screenState} onChange={setScreenState} />
    </div>
  );
}
