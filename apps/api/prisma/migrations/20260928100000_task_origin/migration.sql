-- Bug → việc gốc (docs 02/08 — hồ sơ kỹ năng từ bằng chứng). Cột null được, không đụng dữ liệu cũ.
ALTER TABLE "tasks" ADD COLUMN "origin_task_id" UUID;

CREATE INDEX "tasks_origin_task_id_idx" ON "tasks"("origin_task_id");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_origin_task_id_fkey" FOREIGN KEY ("origin_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
