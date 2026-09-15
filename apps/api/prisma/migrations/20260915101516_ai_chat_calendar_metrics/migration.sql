-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('GEMINI', 'OPENAI', 'OLLAMA');

-- CreateEnum
CREATE TYPE "AiPurpose" AS ENUM ('GENERAL', 'DECOMPOSE', 'ASSIGN', 'EXPLAIN', 'CHAT');

-- CreateEnum
CREATE TYPE "AiCacheMode" AS ENUM ('NONE', 'GEMINI_CACHED_CONTENTS', 'OPENAI_BREAKPOINT');

-- CreateEnum
CREATE TYPE "AiPromptType" AS ENUM ('MASTER', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "AiLogStatus" AS ENUM ('SUCCESS', 'ERROR', 'TIMEOUT', 'INVALID_OUTPUT', 'QUOTA');

-- CreateEnum
CREATE TYPE "AiMemoryKind" AS ENUM ('PERSONAL', 'SCHEDULE', 'ASSIGNMENT', 'CAPACITY', 'PROJECT');

-- CreateEnum
CREATE TYPE "AiMemoryStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'DISABLED', 'STRUCTURED');

-- CreateEnum
CREATE TYPE "AiHabitType" AS ENUM ('ASSIGN_PATTERN', 'TIME_PATTERN', 'ESTIMATE_PATTERN', 'SKILL_GROWTH', 'SCOPE_PATTERN');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AiProposalKind" AS ENUM ('DECOMPOSE', 'ASSIGN', 'RESCHEDULE', 'REBALANCE', 'TASK_DRAFT');

-- CreateEnum
CREATE TYPE "AiProposalStatus" AS ENUM ('DRAFT', 'APPLIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiFeedbackKind" AS ENUM ('ACCEPTED', 'CHANGED_USER', 'CHANGED_TIME', 'CHANGED_HOURS', 'REJECTED');

-- CreateEnum
CREATE TYPE "CalendarSource" AS ENUM ('TABLE_CALENDAR', 'ICS', 'MANUAL');

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('MANUAL', 'CYCLE_TIME');

-- DropIndex
DROP INDEX "skills_name_trgm";

-- DropIndex
DROP INDEX "tasks_title_trgm";

-- CreateTable
CREATE TABLE "ai_model_catalog" (
    "id" UUID NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "input_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "output_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cached_input_price" DOUBLE PRECISION,
    "price_effective_from" DATE,
    "context_window" INTEGER,
    "is_reasoning" BOOLEAN NOT NULL DEFAULT false,
    "supports_temperature" BOOLEAN NOT NULL DEFAULT true,
    "supports_structured_output" BOOLEAN NOT NULL DEFAULT false,
    "supports_vision" BOOLEAN NOT NULL DEFAULT false,
    "max_output_token_param" TEXT NOT NULL DEFAULT 'max_tokens',
    "cache_mode" "AiCacheMode" NOT NULL DEFAULT 'NONE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_configs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "name" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "catalog_id" UUID,
    "api_key_encrypted" TEXT,
    "base_url" TEXT,
    "purpose" "AiPurpose" NOT NULL DEFAULT 'GENERAL',
    "advanced_params" JSONB,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "input_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "output_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_configs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "type" "AiPromptType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "change_note" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_personal_prompts" (
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_personal_prompts_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ai_memories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "kind" "AiMemoryKind" NOT NULL DEFAULT 'PERSONAL',
    "content" TEXT NOT NULL,
    "status" "AiMemoryStatus" NOT NULL DEFAULT 'PROPOSED',
    "suggested_structured" JSONB,
    "source_message_id" UUID,
    "valid_until" DATE,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_habits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" "AiHabitType" NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "times_observed" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "last_observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "ChatRole" NOT NULL,
    "text" TEXT NOT NULL,
    "structured_data" JSONB,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "parse_failed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_proposals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "message_id" UUID,
    "kind" "AiProposalKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "code_map" JSONB,
    "validation_result" JSONB,
    "status" "AiProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "applied_by_id" UUID,
    "applied_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "task_id" UUID,
    "proposed" JSONB NOT NULL,
    "final" JSONB,
    "edit_kind" "AiFeedbackKind" NOT NULL,
    "spread_before" DOUBLE PRECISION,
    "spread_after" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_token_logs" (
    "id" UUID NOT NULL,
    "config_id" UUID,
    "workspace_id" UUID,
    "user_id" UUID,
    "message_id" UUID,
    "endpoint" TEXT NOT NULL,
    "purpose" "AiPurpose" NOT NULL DEFAULT 'GENERAL',
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "reasoning_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "status" "AiLogStatus" NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "prompt_chars" INTEGER,
    "prompt_hash" TEXT,
    "master_prompt_version" INTEGER,
    "workspace_prompt_version" INTEGER,
    "user_message" TEXT,
    "prompt_text" TEXT,
    "raw_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_token_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_daily" (
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "usage_date" DATE NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("workspace_id","user_id","usage_date")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" "CalendarSource" NOT NULL,
    "external_ref_encrypted" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "external_id" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "is_busy" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reviews" (
    "task_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "difficulty_actual" INTEGER NOT NULL,
    "actual_hours_confirmed" DECIMAL(7,2),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reviews_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "user_metrics_weekly" (
    "user_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "skill_category" TEXT NOT NULL DEFAULT '*',
    "ear" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "velocity_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "on_time_rate" DOUBLE PRECISION,
    "avg_rating" DOUBLE PRECISION,
    "median_cycle_days" DOUBLE PRECISION,
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_metrics_weekly_pkey" PRIMARY KEY ("user_id","workspace_id","week_start","skill_category")
);

-- CreateTable
CREATE TABLE "weekly_checkins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_model_catalog_provider_is_active_idx" ON "ai_model_catalog"("provider", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_catalog_provider_model_key" ON "ai_model_catalog"("provider", "model");

-- CreateIndex
CREATE INDEX "ai_configs_workspace_id_purpose_is_active_is_default_idx" ON "ai_configs"("workspace_id", "purpose", "is_active", "is_default");

-- CreateIndex
CREATE INDEX "ai_prompt_configs_workspace_id_type_is_active_idx" ON "ai_prompt_configs"("workspace_id", "type", "is_active");

-- CreateIndex
CREATE INDEX "ai_memories_user_id_workspace_id_status_idx" ON "ai_memories"("user_id", "workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_habits_user_id_workspace_id_type_key_key" ON "ai_habits"("user_id", "workspace_id", "type", "key");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_workspace_id_updated_at_idx" ON "chat_sessions"("user_id", "workspace_id", "updated_at");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_created_at_idx" ON "chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_proposals_project_id_status_created_at_idx" ON "ai_proposals"("project_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ai_feedback_proposal_id_idx" ON "ai_feedback"("proposal_id");

-- CreateIndex
CREATE INDEX "ai_token_logs_workspace_id_created_at_idx" ON "ai_token_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_token_logs_user_id_created_at_idx" ON "ai_token_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_token_logs_status_created_at_idx" ON "ai_token_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "calendar_connections_user_id_is_active_idx" ON "calendar_connections"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_start_at_idx" ON "calendar_events"("user_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_connection_id_external_id_key" ON "calendar_events"("connection_id", "external_id");

-- CreateIndex
CREATE INDEX "time_entries_user_id_work_date_idx" ON "time_entries"("user_id", "work_date");

-- CreateIndex
CREATE INDEX "time_entries_task_id_idx" ON "time_entries"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_checkins_user_id_week_start_key" ON "weekly_checkins"("user_id", "week_start");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ai_proposal_id_fkey" FOREIGN KEY ("ai_proposal_id") REFERENCES "ai_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_configs" ADD CONSTRAINT "ai_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_configs" ADD CONSTRAINT "ai_configs_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "ai_model_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_configs" ADD CONSTRAINT "ai_configs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompt_configs" ADD CONSTRAINT "ai_prompt_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompt_configs" ADD CONSTRAINT "ai_prompt_configs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_personal_prompts" ADD CONSTRAINT "ai_personal_prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_habits" ADD CONSTRAINT "ai_habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_habits" ADD CONSTRAINT "ai_habits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_applied_by_id_fkey" FOREIGN KEY ("applied_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "ai_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_token_logs" ADD CONSTRAINT "ai_token_logs_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "ai_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_token_logs" ADD CONSTRAINT "ai_token_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_token_logs" ADD CONSTRAINT "ai_token_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_token_logs" ADD CONSTRAINT "ai_token_logs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reviews" ADD CONSTRAINT "task_reviews_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reviews" ADD CONSTRAINT "task_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_metrics_weekly" ADD CONSTRAINT "user_metrics_weekly_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_metrics_weekly" ADD CONSTRAINT "user_metrics_weekly_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════
-- Ràng buộc tay cho nhóm bảng AI (docs/04-kien-truc/08 §3)
-- ═══════════════════════════════════════════════════════════════════════
-- Một cấu hình mặc định mỗi (workspace, mục đích); workspace_id NULL = cấu hình hệ thống
CREATE UNIQUE INDEX "ai_configs_one_default_ws" ON "ai_configs"("workspace_id", "purpose")
  WHERE "is_default" AND "workspace_id" IS NOT NULL;
CREATE UNIQUE INDEX "ai_configs_one_default_sys" ON "ai_configs"("purpose")
  WHERE "is_default" AND "workspace_id" IS NULL;
-- Một prompt ACTIVE mỗi (workspace, loại); phiên bản không trùng
CREATE UNIQUE INDEX "ai_prompt_one_active_ws" ON "ai_prompt_configs"("workspace_id", "type")
  WHERE "is_active" AND "workspace_id" IS NOT NULL;
CREATE UNIQUE INDEX "ai_prompt_one_active_sys" ON "ai_prompt_configs"("type")
  WHERE "is_active" AND "workspace_id" IS NULL;
CREATE UNIQUE INDEX "ai_prompt_version_ws" ON "ai_prompt_configs"("workspace_id", "type", "version")
  WHERE "workspace_id" IS NOT NULL;
CREATE UNIQUE INDEX "ai_prompt_version_sys" ON "ai_prompt_configs"("type", "version")
  WHERE "workspace_id" IS NULL;
-- Khoảng giá trị
ALTER TABLE "task_reviews"    ADD CONSTRAINT "task_reviews_rating_check"     CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "task_reviews"    ADD CONSTRAINT "task_reviews_difficulty_check" CHECK ("difficulty_actual" BETWEEN 1 AND 5);
ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_score_check"   CHECK ("score" BETWEEN 1 AND 5);
ALTER TABLE "ai_habits"       ADD CONSTRAINT "ai_habits_confidence_check"    CHECK ("confidence" BETWEEN 0 AND 1);
ALTER TABLE "time_entries"    ADD CONSTRAINT "time_entries_hours_check"      CHECK ("hours" > 0 AND "hours" <= 24);
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_range_check"   CHECK ("start_at" < "end_at");
-- Truy vấn sổ token theo ngày cho màn chi phí
CREATE INDEX "ai_token_logs_workspace_id_purpose_created_at_idx" ON "ai_token_logs"("workspace_id", "purpose", "created_at");
