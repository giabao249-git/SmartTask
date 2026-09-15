-- Một bản nháp mỗi (dự án, người, loại) — đề xuất mới cùng loại phải làm hết hạn bản cũ trước
-- (docs/04-kien-truc/05-ai-agent.md §7c). Ràng buộc DB để service không thể quên.
CREATE UNIQUE INDEX "ai_proposals_one_draft" ON "ai_proposals"("project_id", "user_id", "kind") WHERE "status" = 'DRAFT';
-- Cron dọn theo tuổi cần lọc nhanh theo trạng thái + thời điểm
CREATE INDEX "ai_proposals_status_expires_at_idx" ON "ai_proposals"("status", "expires_at");
