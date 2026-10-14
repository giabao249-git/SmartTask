"use client";

import * as React from "react";
import { BarChart3, Cpu, KeyRound, Sparkles, UserCog } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AiConfigsTab } from "./AiConfigsTab";
import { AiModelsTab } from "./AiModelsTab";
import { AiUsageTab } from "./AiUsageTab";
import { AiPolicyView } from "./AiPolicyView";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface AiSettingsViewProps {
  workspaceId: string;
  canEdit: boolean;
}

/**
 * Quản trị AI toàn diện dành cho Quản trị viên (Admin/Owner)
 * Lấy cảm hứng kiến trúc & thiết kế từ ELPREP và TableCalendar:
 * 1. Cấu hình API theo workspace và mục đích chuyên biệt (GENERAL, DECOMPOSE, ASSIGN, EXPLAIN, CHAT)
 * 2. Danh mục Model Catalog xác thực năng lực thực tế & biểu giá token minh bạch
 * 3. Sổ Token & Kiểm toán chi phí (Token logs, Prompt Cache savings, quy đổi USD/VND)
 * 4. Chính sách Prompt & Nhận diện nhân sự (Workspace prompt versioning, Bí danh thành viên)
 */
export function AiSettingsView({ workspaceId, canEdit }: AiSettingsViewProps) {
  const auth = useAuth();
  // Danh mục model là dữ liệu toàn nền tảng: chỉ Platform Admin sửa được (API chặn OWNER/ADMIN workspace)
  const canEditCatalog = auth.user?.isSuperAdmin === true;
  const [subTab, setSubTab] = React.useState<string>("configs");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Trung tâm Quản trị AI & Model Catalog</h2>
            <p className="text-xs text-muted-foreground">
              Cấu hình khóa bảo mật AES-256, điều hướng mục đích, quản lý danh mục model, kiểm toán token và chính sách trợ lý.
            </p>
          </div>
        </div>
      </div>

      {!canEdit && (
        <Alert className="border-blue-500/30 bg-blue-500/5 text-blue-950 dark:text-blue-200 py-3">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-xs font-semibold">Cấu hình AI Workspace & Cá nhân (BYOK)</AlertTitle>
          <AlertDescription className="text-xs">
            Bạn đang tham gia với vai trò Thành viên: bạn có thể <strong>tự do thêm khóa API cá nhân (BYOK)</strong>, chỉnh sửa, kiểm tra kết nối ping và xóa cấu hình do chính bạn tạo (khóa được mã hóa AES-256-GCM bảo mật tuyệt đối). Các cấu hình dùng chung của toàn Workspace và sổ token chi phí thuộc quyền quản lý của Quản trị viên (OWNER / ADMIN).
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={subTab} onValueChange={setSubTab} className="w-full space-y-4">
        <TabsList className={cn("grid w-full bg-muted/60 p-1", canEdit ? "sm:w-[680px] grid-cols-4" : "sm:w-[510px] grid-cols-3")}>
          <TabsTrigger value="configs" className="text-xs gap-1.5 data-[state=active]:font-semibold">
            <KeyRound className="h-3.5 w-3.5" />
            Cấu hình API
          </TabsTrigger>
          <TabsTrigger value="models" className="text-xs gap-1.5 data-[state=active]:font-semibold">
            <Cpu className="h-3.5 w-3.5" />
            Danh mục Model
          </TabsTrigger>
          {canEdit && (
            <TabsTrigger value="usage" className="text-xs gap-1.5 data-[state=active]:font-semibold">
              <BarChart3 className="h-3.5 w-3.5" />
              Sổ Token & Chi phí
            </TabsTrigger>
          )}
          <TabsTrigger value="policy" className="text-xs gap-1.5 data-[state=active]:font-semibold">
            <UserCog className="h-3.5 w-3.5" />
            Chính sách & Danh tính
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4 outline-none">
          <AiConfigsTab workspaceId={workspaceId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="models" className="space-y-4 outline-none">
          {!canEditCatalog && (
            <Alert className="py-2">
              <Cpu className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">Danh mục dùng chung toàn nền tảng</AlertTitle>
              <AlertDescription className="text-xs">
                Bạn xem được năng lực và biểu giá của mọi model. Thêm/sửa model là việc của đội vận hành nền tảng (trang <span className="font-mono">/admin</span>) vì giá và năng lực áp dụng cho tất cả workspace.
              </AlertDescription>
            </Alert>
          )}
          <AiModelsTab canEdit={canEditCatalog} />
        </TabsContent>

        {canEdit && (
          <TabsContent value="usage" className="space-y-4 outline-none">
            <AiUsageTab workspaceId={workspaceId} />
          </TabsContent>
        )}

        <TabsContent value="policy" className="space-y-4 outline-none">
          <AiPolicyView workspaceId={workspaceId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
