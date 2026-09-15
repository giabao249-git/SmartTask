/*
  Warnings:

  - You are about to drop the `ai_response_cache` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_response_cache" DROP CONSTRAINT "ai_response_cache_token_log_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_response_cache" DROP CONSTRAINT "ai_response_cache_workspace_id_fkey";

-- DropTable
DROP TABLE "ai_response_cache";
