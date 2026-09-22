-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('ROOT_ADMIN', 'FINOPS_OPERATOR', 'CUSTOMER_SUPPORT', 'SECURITY_AUDITOR');

-- CreateEnum
CREATE TYPE "WorkspaceLifecycleStatus" AS ENUM ('ACTIVE', 'WARNING_GRACE', 'READ_ONLY_ENFORCED', 'SOFT_SUSPENDED', 'COLD_STORAGE_ARCHIVED', 'PURGED');

-- CreateEnum
CREATE TYPE "SupportAccessStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "AiProvider" ADD VALUE 'DEEPSEEK';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platform_role" "PlatformRole";

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "status" "WorkspaceLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspend_reason" TEXT,
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspended_by_id" UUID;

-- CreateTable
CREATE TABLE "system_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_email" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "reason" TEXT,
    "previous_hash" VARCHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
    "current_hash" VARCHAR(64) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_access_sessions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "ticket_reference" VARCHAR(50) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SupportAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "consent_granted_by" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "support_access_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_audit_logs_actor_id_created_at_idx" ON "system_audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "system_audit_logs_created_at_idx" ON "system_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "system_audit_logs_target_type_target_id_idx" ON "system_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "support_access_sessions_workspace_id_status_idx" ON "support_access_sessions"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "users_platform_role_idx" ON "users"("platform_role");

-- AddForeignKey
ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_sessions" ADD CONSTRAINT "support_access_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_sessions" ADD CONSTRAINT "support_access_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

