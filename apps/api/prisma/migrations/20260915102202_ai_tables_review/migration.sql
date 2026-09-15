/*
  Warnings:

  - You are about to drop the column `input_price` on the `ai_configs` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `ai_configs` table. All the data in the column will be lost.
  - You are about to drop the column `output_price` on the `ai_configs` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `ai_configs` table. All the data in the column will be lost.
  - You are about to drop the column `workspace_id` on the `ai_proposals` table. All the data in the column will be lost.
  - You are about to drop the `ai_personal_prompts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ai_usage_daily` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `weekly_checkins` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `catalog_id` on table `ai_configs` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ai_configs" DROP CONSTRAINT "ai_configs_catalog_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_personal_prompts" DROP CONSTRAINT "ai_personal_prompts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_proposals" DROP CONSTRAINT "ai_proposals_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_usage_daily" DROP CONSTRAINT "ai_usage_daily_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_usage_daily" DROP CONSTRAINT "ai_usage_daily_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "weekly_checkins" DROP CONSTRAINT "weekly_checkins_user_id_fkey";

-- AlterTable
ALTER TABLE "ai_configs" DROP COLUMN "input_price",
DROP COLUMN "model",
DROP COLUMN "output_price",
DROP COLUMN "provider",
ALTER COLUMN "catalog_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "ai_proposals" DROP COLUMN "workspace_id";

-- AlterTable
ALTER TABLE "ai_token_logs" ADD COLUMN     "proposal_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ai_personal_prompt" TEXT;

-- DropTable
DROP TABLE "ai_personal_prompts";

-- DropTable
DROP TABLE "ai_usage_daily";

-- DropTable
DROP TABLE "weekly_checkins";

-- CreateTable
CREATE TABLE "ai_response_cache" (
    "cache_key" TEXT NOT NULL,
    "workspace_id" UUID NOT NULL,
    "purpose" "AiPurpose" NOT NULL,
    "response" JSONB NOT NULL,
    "token_log_id" UUID,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_response_cache_pkey" PRIMARY KEY ("cache_key")
);

-- CreateIndex
CREATE INDEX "ai_response_cache_workspace_id_purpose_expires_at_idx" ON "ai_response_cache"("workspace_id", "purpose", "expires_at");

-- AddForeignKey
ALTER TABLE "ai_configs" ADD CONSTRAINT "ai_configs_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "ai_model_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_token_logs" ADD CONSTRAINT "ai_token_logs_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "ai_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_response_cache" ADD CONSTRAINT "ai_response_cache_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_response_cache" ADD CONSTRAINT "ai_response_cache_token_log_id_fkey" FOREIGN KEY ("token_log_id") REFERENCES "ai_token_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════
-- Sau rà soát (docs/05-hien-thuc/ra-soat-bang-ai.md):
-- giới hạn độ dài prompt cá nhân (index sổ token theo ngày khai trong schema.prisma).
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE "users" ADD CONSTRAINT "users_ai_personal_prompt_len" CHECK (char_length("ai_personal_prompt") <= 2000);
