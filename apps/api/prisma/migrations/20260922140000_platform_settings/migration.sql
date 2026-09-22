-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" VARCHAR(255),

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

