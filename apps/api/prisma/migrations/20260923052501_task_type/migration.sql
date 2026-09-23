-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('STORY', 'TASK', 'BUG');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "type" "TaskType" NOT NULL DEFAULT 'TASK';
