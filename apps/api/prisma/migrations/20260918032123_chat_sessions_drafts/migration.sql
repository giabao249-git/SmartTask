-- AlterEnum
ALTER TYPE "AiProposalKind" ADD VALUE 'TASK_UPDATE';

-- AlterTable
ALTER TABLE "ai_proposals" ADD COLUMN     "applied_map" JSONB,
ADD COLUMN     "item_status" JSONB,
ADD COLUMN     "session_id" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "last_turn_at" TIMESTAMP(3),
ADD COLUMN     "next_draft_seq" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN     "department" VARCHAR(80),
ADD COLUMN     "manager_user_id" UUID,
ADD COLUMN     "title" VARCHAR(80);

-- CreateTable
CREATE TABLE "member_aliases" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "alias" CITEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_aliases_workspace_id_user_id_idx" ON "member_aliases"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_aliases_workspace_id_alias_key" ON "member_aliases"("workspace_id", "alias");

-- CreateIndex
CREATE INDEX "ai_proposals_session_id_status_created_at_idx" ON "ai_proposals"("session_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_project_id_archived_at_last_turn_at_idx" ON "chat_sessions"("user_id", "project_id", "archived_at", "last_turn_at");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_aliases" ADD CONSTRAINT "member_aliases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_aliases" ADD CONSTRAINT "member_aliases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_aliases" ADD CONSTRAINT "member_aliases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SQL tay (docs 12 §2): bản nháp trong PHIÊN chat được nhiều DRAFT cùng loại; ràng buộc "một DRAFT mỗi
-- (dự án, người, loại)" chỉ còn áp cho đề xuất tạo từ form (session_id IS NULL).
DROP INDEX IF EXISTS "ai_proposals_one_draft";
CREATE UNIQUE INDEX "ai_proposals_one_draft" ON "ai_proposals"("project_id", "user_id", "kind")
  WHERE "status" = 'DRAFT' AND "session_id" IS NULL;
-- item_status / applied_map phải là object JSON (giá trị từng item kiểm ở service — CHECK không được dùng subquery)
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_item_status_object" CHECK (
  "item_status" IS NULL OR jsonb_typeof("item_status") = 'object'
);
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_applied_map_object" CHECK (
  "applied_map" IS NULL OR jsonb_typeof("applied_map") = 'object'
);
